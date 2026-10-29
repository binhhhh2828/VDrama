"""Gắn video Cloudflare Stream vào tập phim (việc của admin) và cập nhật trạng thái chuyển mã.

Mọi thay đổi ghi `audit_logs` trong cùng transaction. Không commit: router commit.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Episode, Series
from app.models.enums import StreamStatus
from app.services import stream
from app.services.audit import Actor, load_snapshot, record


class EpisodeNotFoundError(Exception):
    pass


class EpisodePublishedError(Exception):
    """Tập đang xuất bản: thay video sẽ làm tập không phát được (CHECK publish_requires_ready)."""


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
