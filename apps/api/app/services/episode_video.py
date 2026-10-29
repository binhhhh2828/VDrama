"""Gắn video Cloudflare Stream vào tập phim (việc của admin) và cập nhật trạng thái chuyển mã.

Mọi thay đổi ghi `audit_logs` trong cùng transaction. Không commit: router commit.
"""

import logging
from enum import StrEnum

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Episode, Series
from app.models.enums import StreamStatus
from app.models.soft_delete import INCLUDE_DELETED
from app.services import stream
from app.services.audit import Actor, diff, load_snapshot, record

logger = logging.getLogger(__name__)


class EpisodeNotFoundError(Exception):
    pass


class EpisodePublishedError(Exception):
    """Tập đang xuất bản: thay video sẽ làm tập không phát được (CHECK publish_requires_ready)."""


class NoVideoError(Exception):
    """Tập chưa có video để đồng bộ."""


class ApplyResult(StrEnum):
    UPDATED = "updated"
    UNCHANGED = "unchanged"  # Cloudflare gửi lại sự kiện cũ
    UNKNOWN_VIDEO = "unknown_video"  # video đã bị thay, hoặc của môi trường khác
    SKIPPED_PUBLISHED = "skipped_published"  # tập đang xuất bản mà video không còn ready


async def _lock_episode(db: AsyncSession, episode_id: int) -> Episode | None:
    # Join Series để tập của series đã xóa mềm cũng bị ẩn (bộ lọc áp cho cả series).
    stmt = (
        select(Episode)
        .join(Series, Series.id == Episode.series_id)
        .where(Episode.id == episode_id)
        .with_for_update(of=Episode)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def start_upload(
    db: AsyncSession, episode_id: int, *, size_bytes: int, actor: Actor
) -> stream.UploadTicket:
    """Tạo video mới trên Cloudflare cho tập và trả URL upload.

    Khóa dòng tập trong lúc gọi Cloudflare (tối đa vài giây) để hai admin bấm cùng lúc, hoặc
    vừa upload vừa xuất bản, không ghi đè lẫn nhau. Video cũ (nếu có) vẫn nằm trên Cloudflare:
    id của nó lưu trong nhật ký để dọn sau (Giai đoạn 4).
    """
    episode = await _lock_episode(db, episode_id)
    if episode is None:
        raise EpisodeNotFoundError
    if episode.is_published:
        raise EpisodePublishedError
    before = await load_snapshot(db, episode)
    ticket = await stream.create_upload(size_bytes)
    episode.stream_video_id = ticket.video_id
    episode.stream_status = StreamStatus.UPLOADING
    # Thời lượng và ảnh của video cũ không còn đúng; webhook điền lại khi chuyển mã xong.
    episode.duration_sec = None
    episode.thumbnail_url = None
    await db.flush()
    await record(
        db,
        action="episodes.upload_start",
        actor=actor,
        obj=episode,
        before=before,
        after=await load_snapshot(db, episode),
        extra={"size_bytes": size_bytes},
    )
    return ticket


def _target_status(episode: Episode, video: stream.VideoState) -> StreamStatus:
    if video.status == StreamStatus.READY and not video.require_signed_urls:
        # Video phát công khai được, không cần token: đánh dấu ready là lộ phim VIP.
        logger.warning(
            "Video %s của tập %s không bật requireSignedURLs: không đánh dấu ready",
            video.video_id,
            episode.id,
        )
        return StreamStatus.ERROR
    return video.status


async def apply_video_state(
    db: AsyncSession, video: stream.VideoState, *, actor: Actor, action: str
) -> tuple[ApplyResult, Episode | None]:
    """Cập nhật tập theo trạng thái video Cloudflare báo (webhook hoặc đồng bộ tay).

    Gọi lại nhiều lần với cùng dữ liệu là an toàn: không đổi gì thì không ghi nhật ký.
    Tìm cả tập đã xóa mềm (video vẫn tốn tiền lưu trữ, trạng thái vẫn nên đúng).
    """
    stmt = (
        select(Episode)
        .where(Episode.stream_video_id == video.video_id)
        .with_for_update()
        .execution_options(**{INCLUDE_DELETED: True})
    )
    episode = (await db.execute(stmt)).scalar_one_or_none()
    if episode is None:
        logger.info("Bỏ qua trạng thái của video lạ %s", video.video_id)
        return ApplyResult.UNKNOWN_VIDEO, None

    status = _target_status(episode, video)
    if episode.is_published and status != StreamStatus.READY:
        # CHECK publish_requires_ready không cho đổi; admin phải gỡ xuất bản rồi xử lý.
        logger.warning(
            "Video %s của tập đang xuất bản %s báo %s: giữ nguyên",
            video.video_id,
            episode.id,
            status,
        )
        return ApplyResult.SKIPPED_PUBLISHED, episode

    before = await load_snapshot(db, episode)
    episode.stream_status = status
    if status == StreamStatus.READY:
        if video.duration_sec is not None:
            episode.duration_sec = video.duration_sec
        # Không ghi đè ảnh admin đã chọn.
        if not episode.thumbnail_url and video.thumbnail_url:
            episode.thumbnail_url = video.thumbnail_url
    await db.flush()
    after = await load_snapshot(db, episode)
    if not diff(before, after):
        return ApplyResult.UNCHANGED, episode
    await record(
        db,
        action=action,
        actor=actor,
        obj=episode,
        before=before,
        after=after,
        extra={"error_code": video.error_code} if video.error_code else None,
    )
    return ApplyResult.UPDATED, episode


async def sync_episode(
    db: AsyncSession, episode_id: int, *, actor: Actor
) -> tuple[ApplyResult, Episode]:
    """Đồng bộ tay: hỏi Cloudflare trạng thái video của tập rồi áp như webhook.

    Dùng khi webhook bị trượt (VPS sập, sai secret) hoặc ở dev (không đăng ký webhook).
    """
    episode = await _lock_episode(db, episode_id)
    if episode is None:
        raise EpisodeNotFoundError
    if not episode.stream_video_id:
        raise NoVideoError
    try:
        video = stream.parse_video(await stream.get_video(episode.stream_video_id))
    except ValueError as exc:
        raise stream.StreamProviderError("Cloudflare trả dữ liệu video không hợp lệ") from exc
    if video.video_id != episode.stream_video_id:
        raise stream.StreamProviderError("Cloudflare trả về video khác")
    result, _ = await apply_video_state(db, video, actor=actor, action="episodes.stream_sync")
    return result, episode
