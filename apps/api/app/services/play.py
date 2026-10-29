"""Xem tập phim: chỗ **duy nhất** kiểm tra quyền xem rồi cấp URL phát có token.

Catalog trả cùng nội dung cho mọi người (`access: free | vip`); quyền thật chỉ quyết ở đây.
Ma trận phân quyền: docs/plans/gd2-b2-auth.md, docs/api.md (Xem tập).

Thứ tự kiểm tra:
1. Tập (hoặc series của nó) không có / đã xóa / chưa xuất bản → không tìm thấy. Admin xem trước
   được tập và series chưa xuất bản, không xem được thứ đã xóa (giống catalog).
2. Khách → cần đăng nhập (kể cả tập miễn phí).
3. Tập VIP mà user không còn VIP → cần VIP. Admin xem mọi tập.
4. Video chưa sẵn sàng (chỉ gặp khi admin xem trước) → chưa phát được.

Không commit: router commit.
"""

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.models import Episode, Series, SeriesStats, User
from app.models.enums import StreamStatus, UserRole
from app.services import stream
from app.services.vip import is_vip


class PlayDeniedError(Exception):
    pass


class EpisodeNotFoundError(PlayDeniedError):
    pass


class LoginRequiredError(PlayDeniedError):
    pass


class VipRequiredError(PlayDeniedError):
    pass


class VideoNotReadyError(PlayDeniedError):
    pass


def _is_admin(user: User | None) -> bool:
    return user is not None and user.role == UserRole.ADMIN


async def _find_episode(db: AsyncSession, episode_id: int, *, include_unpublished: bool):
    # Join Series: bộ lọc xóa mềm áp cho cả series, nên tập của series đã xóa cũng bị ẩn.
    stmt = (
        select(Episode, Series.id)
        .join(Series, Series.id == Episode.series_id)
        .where(Episode.id == episode_id)
    )
    if not include_unpublished:
        stmt = stmt.where(Episode.is_published, Series.is_published)
    return (await db.execute(stmt)).one_or_none()


async def _count_view(db: AsyncSession, user: User, episode: Episode, series_id: int) -> None:
    """Cộng một lượt xem cho series; mỗi (user, tập) chỉ một lần mỗi cửa sổ, admin không tính.

    Bộ nhớ chống trùng nằm trong RAM: khởi động lại thì có thể đếm thêm một lượt. Chấp nhận
    được vì con số chỉ dùng để xếp "phim hot".
    """
    if _is_admin(user):
        return
    if not rate_limit.first_in_window(
        rate_limit.VIEW_COUNT_WINDOW, "view", str(user.id), str(episode.id)
    ):
        return
    stmt = insert(SeriesStats).values(series_id=series_id, view_count=1)
    stmt = stmt.on_conflict_do_update(
        index_elements=[SeriesStats.series_id],
        set_={"view_count": SeriesStats.view_count + 1, "updated_at": func.now()},
    )
    await db.execute(stmt)


async def play_episode(
    db: AsyncSession, episode_id: int, user: User | None
) -> tuple[Episode, stream.PlaybackUrls]:
    """Kiểm tra quyền rồi cấp URL phát.

    Ném `PlayDeniedError` (các lớp con) khi không được xem, `stream.StreamNotConfiguredError`
    khi thiếu cấu hình Stream.
    """
    found = await _find_episode(db, episode_id, include_unpublished=_is_admin(user))
    if found is None:
        raise EpisodeNotFoundError
    episode, series_id = found
    if user is None:
        raise LoginRequiredError
    if not episode.is_free and not _is_admin(user) and not is_vip(user):
        raise VipRequiredError
    if episode.stream_status != StreamStatus.READY or not episode.stream_video_id:
        raise VideoNotReadyError
    urls = stream.playback_urls(episode.stream_video_id, duration_sec=episode.duration_sec)
    await _count_view(db, user, episode, series_id)
    return episode, urls
