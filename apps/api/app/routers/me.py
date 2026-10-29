"""Tài khoản đang đăng nhập: thông tin, lịch sử xem. Tài liệu: docs/api.md."""

from fastapi import APIRouter, status

from app.api.deps import CurrentUser
from app.core import rate_limit
from app.core.db import DbSession
from app.routers.play import EpisodeId, play_denied
from app.schemas.activity import ProgressIn
from app.schemas.auth import UserOut
from app.services import activity
from app.services.play import PlayDeniedError

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.of(user)


@router.put("/me/history/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def report_progress(
    episode_id: EpisodeId, data: ProgressIn, db: DbSession, user: CurrentUser
) -> None:
    """Player báo tiến độ mỗi ~15–30 giây và khi tạm dừng/đóng trang."""
    rate_limit.hit(rate_limit.HISTORY_PER_USER, "history", str(user.id))
    try:
        await activity.record_progress(db, user, episode_id, data.progress_sec)
    except PlayDeniedError as exc:
        raise play_denied(exc) from None
    await db.commit()
