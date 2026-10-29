"""Lịch sử xem và yêu thích của người dùng.

Tiến độ xem: upsert một dòng cho mỗi (user, tập), cập nhật tại chỗ (HOT update). Quyền ghi tiến
độ giống quyền xem (`play.find_watchable_episode`). Không commit: router commit.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select, tuple_, update
from sqlalchemy.dialects.postgresql import Insert, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Episode, Favorite, Series, SeriesStats, User, WatchHistory
from app.models.enums import UserRole
from app.services.catalog import InvalidCursorError, SeriesCursor
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


# --- Yêu thích (bỏ yêu thích: người dùng thấy đã bỏ, hệ thống xóa mềm) ---

FAVORITES_SORT = "favorites"  # loại con trỏ: con trỏ của danh sách khác không dùng được ở đây


class SeriesNotFoundError(Exception):
    pass


async def _bump_favorite_count(db: AsyncSession, series_id: int, delta: int) -> None:
    stmt = insert(SeriesStats).values(series_id=series_id, favorite_count=max(delta, 0))
    stmt = stmt.on_conflict_do_update(
        index_elements=[SeriesStats.series_id],
        set_={
            # Không xuống dưới 0 (CHECK non_negative) dù số đếm từng bị lệch.
            "favorite_count": func.greatest(SeriesStats.favorite_count + delta, 0),
            "updated_at": func.now(),
        },
    )
    await db.execute(stmt)


async def add_favorite(db: AsyncSession, user_id: int, series_id: int) -> bool:
    """Yêu thích một phim đang xuất bản. Trả True nếu trạng thái đổi (thêm mới hoặc thêm lại).

    Thêm lại sau khi bỏ: dùng lại đúng dòng cũ, đặt lại `created_at` để lên đầu danh sách.
    Đã đang yêu thích thì không đổi gì (bấm nhiều lần, hai tab cùng lúc vẫn chỉ đếm một).
    """
    visible = await db.scalar(select(Series.id).where(Series.id == series_id, Series.is_published))
    if visible is None:
        raise SeriesNotFoundError
    stmt = (
        insert(Favorite)
        .values(user_id=user_id, series_id=series_id)
        .on_conflict_do_update(
            index_elements=[Favorite.user_id, Favorite.series_id],
            set_={"deleted_at": None, "created_at": func.now()},
            where=Favorite.deleted_at.is_not(None),
        )
        .returning(Favorite.series_id)
    )
    changed = (await db.execute(stmt)).first() is not None
    if changed:
        await _bump_favorite_count(db, series_id, +1)
    return changed


async def remove_favorite(db: AsyncSession, user_id: int, series_id: int) -> bool:
    """Bỏ yêu thích (xóa mềm). Trả True nếu trạng thái đổi; chưa yêu thích thì không làm gì."""
    stmt = (
        update(Favorite)
        .where(
            Favorite.user_id == user_id,
            Favorite.series_id == series_id,
            Favorite.deleted_at.is_(None),
        )
        .values(deleted_at=func.now())
        .returning(Favorite.series_id)
        .execution_options(synchronize_session=False)
    )
    changed = (await db.execute(stmt)).first() is not None
    if changed:
        await _bump_favorite_count(db, series_id, -1)
    return changed


async def is_favorite(db: AsyncSession, user_id: int, series_id: int) -> bool:
    """Đang yêu thích một phim còn xem được (phim bị gỡ thì coi như không)."""
    found = await db.scalar(
        select(Favorite.series_id)
        .join(Series, Series.id == Favorite.series_id)
        .where(Favorite.user_id == user_id, Favorite.series_id == series_id, Series.is_published)
    )
    return found is not None


def favorites_stmt(user_id: int, *, limit: int, cursor: SeriesCursor | None = None):
    stmt = (
        select(Series, Favorite.created_at)
        .join(Favorite, Favorite.series_id == Series.id)
        .where(Favorite.user_id == user_id, Series.is_published)
        .order_by(Favorite.created_at.desc(), Series.id.desc())
        .limit(limit + 1)
        .options(selectinload(Series.genres))
    )
    if cursor is not None:
        after = datetime.fromisoformat(cursor.value)
        stmt = stmt.where(tuple_(Favorite.created_at, Series.id) < tuple_(after, cursor.id))
    return stmt


async def list_favorites(
    db: AsyncSession, user_id: int, *, limit: int, cursor: str | None = None
) -> tuple[list[Series], str | None]:
    """Phim đã yêu thích, mới yêu thích trước; phân trang keyset (created_at, series_id).

    Phim bị gỡ/xóa sau khi yêu thích thì ẩn (dòng yêu thích vẫn giữ).
    """
    after = SeriesCursor.decode(cursor, sort=FAVORITES_SORT) if cursor else None
    if after is not None:
        try:
            datetime.fromisoformat(after.value)
        except ValueError:
            raise InvalidCursorError("Con trỏ không hợp lệ") from None
    rows = (await db.execute(favorites_stmt(user_id, limit=limit, cursor=after))).all()
    page = rows[:limit]
    next_cursor = None
    if len(rows) > limit:
        last_series, last_at = page[-1]
        next_cursor = SeriesCursor(
            sort=FAVORITES_SORT, value=last_at.isoformat(), id=last_series.id
        ).encode()
    return [series for series, _ in page], next_cursor
