"""Webhook từ dịch vụ bên ngoài. Tài liệu: docs/api.md (Webhook).

Không cần đăng nhập; xác thực bằng chữ ký. Đi qua CSRF được vì không có Origin và cookie
(app/api/csrf.py). Trả 2xx nhanh: việc chậm (gọi lại Cloudflare) chạy nền sau khi trả lời.
"""

import json
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Request

from app.core.config import get_settings
from app.core.db import DbSession
from app.core.errors import ApiError, ErrorCode
from app.models.enums import StreamStatus
from app.services import episode_video
from app.services import stream as stream_service
from app.services.audit import Actor

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Thân webhook Stream là một đối tượng video, chỉ vài KB.
MAX_WEBHOOK_BODY = 64 * 1024


def _too_large() -> ApiError:
    return ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, "Dữ liệu gửi lên quá lớn.")


async def read_limited_body(request: Request, limit: int = MAX_WEBHOOK_BODY) -> bytes:
    """Đọc thân thô (chữ ký tính trên đúng các byte này), dừng ngay khi vượt giới hạn."""
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > limit:
        raise _too_large()
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > limit:
            raise _too_large()
    return bytes(body)


@router.post("/stream")
async def stream_webhook(
    request: Request, db: DbSession, background: BackgroundTasks
) -> dict[str, str]:
    """Cloudflare Stream báo video chuyển mã xong (ready) hoặc lỗi (error)."""
    secret = get_settings().cf_stream_webhook_secret.get_secret_value()
    if not secret:
        raise ApiError(503, ErrorCode.STREAM_UNAVAILABLE, "Chưa cấu hình webhook Stream.")
    body = await read_limited_body(request)
    try:
        stream_service.verify_webhook(
            request.headers.get("webhook-signature"), body, secret, now=datetime.now(UTC)
        )
    except stream_service.InvalidWebhookSignatureError:
        raise ApiError(401, ErrorCode.INVALID_SIGNATURE, "Chữ ký webhook không hợp lệ.") from None
    try:
        data = json.loads(body)
        video = stream_service.parse_video(data if isinstance(data, dict) else {})
    except ValueError:
        raise ApiError(400, ErrorCode.BAD_REQUEST, "Dữ liệu webhook không hợp lệ.") from None

    result, episode = await episode_video.apply_video_state(
        db, video, actor=Actor.webhook(), action="episodes.stream_update"
    )
    await db.commit()
    # Theo trạng thái cuối của tập: video không bật signed URL bị hạ thành error.
    if (
        result == episode_video.ApplyResult.UPDATED
        and episode is not None
        and episode.stream_status == StreamStatus.READY
    ):
        background.add_task(stream_service.set_allowed_origins_quietly, video.video_id)
    return {"result": result.value}
