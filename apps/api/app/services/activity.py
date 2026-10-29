"""Lịch sử xem và yêu thích của người dùng.

Tiến độ xem: upsert một dòng cho mỗi (user, tập), cập nhật tại chỗ (HOT update). Quyền ghi tiến
độ giống quyền xem (`play.find_watchable_episode`). Không commit: router commit.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import Insert, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Episode, Series, User, WatchHistory
from app.models.enums import UserRole
from app.services.play import find_watchable_episode

# Một ngày: không tập nào dài hơn (Cloudflare nhận video tối đa 4 giờ).
MAX_PROGRESS_SEC = 24 * 3600


def upsert_progress_stmt(user_id: int, episode_id: int, progress_sec: int) -> Insert:
    """INSERT ... ON CONFLICT DO UPDATE: lần đầu tạo dòng, các lần sau ghi đè tại chỗ.

    Chỉ đổi progress_sec, updated_at, deleted_at (đều không có index) để Postgres dùng được HOT
    update. Xem lại tập người dùng đã xóa khỏi lịch sử thì dòng cũ hiện lại (deleted_at = NULL).
    """
    stmt = insert(WatchHistory).values(
        user_id=user_id, episode_id=episode_id, progress_sec=max(progress_sec, 0)
    )
    return stmt.on_conflict_do_update(
        index_elements=[WatchHistory.user_id, WatchHistory.episode_id],
        set_={
            "progress_sec": stmt.excluded.progress_sec,
            "updated_at": func.now(),
            "deleted_at": None,
        },
    )


async def record_progress(db: AsyncSession, user: User, episode_id: int, progress_sec: int) -> int:
    """Ghi tiến độ xem của `user`; trả giá trị đã lưu (cắt bằng thời lượng tập nếu vượt).

    Ném lỗi quyền của `find_watchable_episode` (tập ẩn → không tìm thấy, tập VIP → cần VIP).
    """
    episode, _ = await find_watchable_episode(db, episode_id, user)
    if episode.duration_sec:
        progress_sec = min(progress_sec, episode.duration_sec)
    await db.execute(upsert_progress_stmt(user.id, episode.id, progress_sec))
    return progress_sec


# --- Xem tiếp, tiến độ theo phim ---


@dataclass(frozen=True)
class ContinueItem:
    series: Series
    episode: Episode
    progress_sec: int
    updated_at: datetime


def continue_watching_stmt(user_id: int):
    """Lịch sử của một user kèm tập và phim, mới xem trước.

    Lọc theo khóa chính `(user_id, …)`: mỗi user chỉ vài trăm dòng nên sắp xếp trong bộ nhớ
    của Postgres là đủ, không cần index `updated_at` (index đó làm mất HOT update).
    Bộ lọc xóa mềm áp cho cả ba bảng; tập/phim gỡ xuất bản cũng bị ẩn ("theo cha").
    """
    return (
        select(WatchHistory, Episode, Series)
        .join(Episode, Episode.id == WatchHistory.episode_id)
        .join(Series, Series.id == Episode.series_id)
        .where(WatchHistory.user_id == user_id, Episode.is_published, Series.is_published)
        .order_by(WatchHistory.updated_at.desc(), WatchHistory.episode_id.desc())
        .options(selectinload(Series.genres))
    )


async def continue_watching(db: AsyncSession, user_id: int, *, limit: int) -> list[ContinueItem]:
    """ "Xem tiếp": mỗi phim một dòng là tập xem gần nhất, phim xem gần nhất trước."""
    items: list[ContinueItem] = []
    seen: set[int] = set()
    for history, episode, series in (await db.execute(continue_watching_stmt(user_id))).all():
        if series.id in seen:
            continue
        seen.add(series.id)
        items.append(ContinueItem(series, episode, history.progress_sec, history.updated_at))
        if len(items) == limit:
            break
    return items


async def series_progress(
    db: AsyncSession, user: User, slug: str
) -> list[tuple[Episode, WatchHistory]] | None:
    """Tiến độ các tập đã xem của một phim, theo số tập. None khi phim không xem được.

    Cùng độ hiển thị với danh sách tập ở catalog: admin xem trước được phim/tập chưa xuất bản.
    """
    preview = user.role == UserRole.ADMIN
    series_stmt = select(Series.id).where(Series.slug == slug)
    if not preview:
        series_stmt = series_stmt.where(Series.is_published)
    series_id = await db.scalar(series_stmt)
    if series_id is None:
        return None
    stmt = (
        select(Episode, WatchHistory)
        .join(WatchHistory, WatchHistory.episode_id == Episode.id)
        .where(WatchHistory.user_id == user.id, Episode.series_id == series_id)
        .order_by(Episode.number)
    )
    if not preview:
        stmt = stmt.where(Episode.is_published)
    return [(ep, h) for ep, h in (await db.execute(stmt)).all()]


# --- Xóa lịch sử (người dùng thấy là đã xóa, hệ thống xóa mềm) ---


async def delete_history(db: AsyncSession, user_id: int, episode_id: int | None = None) -> int:
    """Xóa mềm lịch sử của user (một tập, hoặc tất cả khi `episode_id` là None).

    Trả số dòng vừa bị ẩn (gọi lại trả 0). Giữ nguyên `updated_at` (lần xem cuối) cho phân
    tích; thời điểm xóa nằm ở `deleted_at`. Chỉ đổi cột không có index nên vẫn là HOT update.
    """
    stmt = (
        update(WatchHistory)
        .where(WatchHistory.user_id == user_id, WatchHistory.deleted_at.is_(None))
        # Gán lại chính nó để ORM không tự đặt updated_at = now() (onupdate).
        .values(deleted_at=func.now(), updated_at=WatchHistory.updated_at)
        .execution_options(synchronize_session=False)
    )
    if episode_id is not None:
        stmt = stmt.where(WatchHistory.episode_id == episode_id)
    result = await db.execute(stmt)
    return result.rowcount
