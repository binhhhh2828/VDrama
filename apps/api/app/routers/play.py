"""Xem tập phim: kiểm tra quyền rồi cấp URL phát. Tài liệu: docs/api.md (Xem tập)."""

from typing import Annotated

from fastapi import APIRouter, Path, Response

from app.api.deps import OptionalUser, not_authenticated
from app.core import rate_limit
from app.core.db import DbSession
from app.core.errors import ApiError, ErrorCode
from app.schemas.stream import PlayOut
from app.services import play as play_service
from app.services.stream import StreamNotConfiguredError

router = APIRouter(tags=["play"])

# Giới hạn của cột BIGINT: id lớn hơn thì trả 422 thay vì để DB báo lỗi.
EpisodeId = Annotated[int, Path(ge=1, le=2**63 - 1)]


def _denied(exc: play_service.PlayDeniedError) -> ApiError:
    match exc:
        case play_service.LoginRequiredError():
            return not_authenticated()
        case play_service.VipRequiredError():
            return ApiError(403, ErrorCode.VIP_REQUIRED, "Tập này dành cho thành viên VIP.")
        case play_service.VideoNotReadyError():
            return ApiError(409, ErrorCode.VIDEO_NOT_READY, "Video của tập này chưa sẵn sàng.")
        case _:
            return ApiError(404, ErrorCode.NOT_FOUND, "Không tìm thấy tập phim.")


@router.get("/episodes/{episode_id}/play")
async def play(
    episode_id: EpisodeId, db: DbSession, user: OptionalUser, response: Response
) -> PlayOut:
    # URL có token riêng cho người xem: không để trình duyệt hay CDN lưu lại.
    response.headers["Cache-Control"] = "no-store"
    if user is not None:
        rate_limit.hit(rate_limit.PLAY_PER_USER, "play", str(user.id))
    try:
        episode, urls = await play_service.play_episode(db, episode_id, user)
    except play_service.PlayDeniedError as exc:
        raise _denied(exc) from None
    except StreamNotConfiguredError:
        raise ApiError(
            503, ErrorCode.STREAM_UNAVAILABLE, "Chức năng xem phim tạm thời chưa sẵn sàng."
        ) from None
    await db.commit()  # lượt xem
    return PlayOut(
        episode_id=episode.id,
        hls_url=urls.hls_url,
        dash_url=urls.dash_url,
        iframe_url=urls.iframe_url,
        expires_at=urls.expires_at,
    )
