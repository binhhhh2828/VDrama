"""Lịch sử xem và yêu thích của người dùng.

Tiến độ xem: upsert một dòng cho mỗi (user, tập), cập nhật tại chỗ (HOT update). Quyền ghi tiến
độ giống quyền xem (`play.find_watchable_episode`). Không commit: router commit.
"""

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import Insert, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, WatchHistory
from app.services.play import find_watchable_episode

# Một ngày: không tập nào dài hơn (Cloudflare nhận video tối đa 4 giờ).
MAX_PROGRESS_SEC = 24 * 3600


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


async def record_progress(db: AsyncSession, user: User, episode_id: int, progress_sec: int) -> int:
    """Ghi tiến độ xem của `user`; trả giá trị đã lưu (cắt bằng thời lượng tập nếu vượt).

    Ném lỗi quyền của `find_watchable_episode` (tập ẩn → không tìm thấy, tập VIP → cần VIP).
    """
    episode, _ = await find_watchable_episode(db, episode_id, user)
    if episode.duration_sec:
        progress_sec = min(progress_sec, episode.duration_sec)
    await db.execute(upsert_progress_stmt(user.id, episode.id, progress_sec))
    return progress_sec
