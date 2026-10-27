"""Ghi tiến độ xem: upsert một dòng cho mỗi (user, tập)."""

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import Insert, insert

from app.models import WatchHistory


def upsert_progress_stmt(user_id: int, episode_id: int, progress_sec: int) -> Insert:
    """INSERT ... ON CONFLICT DO UPDATE: lần đầu tạo dòng, các lần sau ghi đè tại chỗ.

    Chỉ đổi progress_sec và updated_at (không có index) để Postgres dùng được HOT update.
    """
    stmt = insert(WatchHistory).values(
        user_id=user_id, episode_id=episode_id, progress_sec=max(progress_sec, 0)
    )
    return stmt.on_conflict_do_update(
        index_elements=[WatchHistory.user_id, WatchHistory.episode_id],
        set_={"progress_sec": stmt.excluded.progress_sec, "updated_at": func.now()},
    )
