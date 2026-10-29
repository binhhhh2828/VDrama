"""Admin: upload video tập phim lên Cloudflare Stream. Tài liệu: docs/api.md (Admin / Video).

File video đi thẳng từ trình duyệt lên Cloudflare (tus), không qua VPS: API chỉ cấp URL upload.
"""

from fastapi import APIRouter, BackgroundTasks, status
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import AdminUser
from app.core.config import get_settings
from app.core.db import DbSession
from app.core.errors import ApiError, ErrorCode
from app.models.enums import StreamStatus
from app.routers.play import EpisodeId
from app.services import episode_video
from app.services import stream as stream_service
from app.services.audit import Actor

router = APIRouter(prefix="/admin", tags=["admin"])


class UploadIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # tus cần biết trước kích thước file (header Upload-Length).
    size_bytes: int = Field(ge=1)


class UploadOut(BaseModel):
    upload_url: str  # dùng làm `uploadUrl` của tus-js-client
    video_id: str


class StreamSyncOut(BaseModel):
    episode_id: int
    video_id: str | None
    stream_status: StreamStatus
    duration_sec: int | None
    thumbnail_url: str | None
    # updated | unchanged | skipped_published (tập đang xuất bản mà video không còn ready)
    result: episode_video.ApplyResult


def stream_errors(exc: Exception) -> ApiError:
    if isinstance(exc, stream_service.StreamNotConfiguredError):
        return ApiError(503, ErrorCode.STREAM_UNAVAILABLE, "Chưa cấu hình Cloudflare Stream.")
    return ApiError(
        502,
        ErrorCode.STREAM_PROVIDER_ERROR,
        "Không làm việc được với Cloudflare Stream, vui lòng thử lại sau.",
    )


@router.post("/episodes/{episode_id}/upload", status_code=status.HTTP_201_CREATED)
async def start_upload(
    episode_id: EpisodeId, data: UploadIn, db: DbSession, admin: AdminUser
) -> UploadOut:
    limit = get_settings().stream_max_upload_bytes
    if data.size_bytes > limit:
        raise RequestValidationError(
            [
                {
                    "loc": ("body", "size_bytes"),
                    "msg": f"File quá lớn (tối đa {limit} byte)",
                    "type": "value_error",
                }
            ]
        )
    try:
        ticket = await episode_video.start_upload(
            db, episode_id, size_bytes=data.size_bytes, actor=Actor.admin(admin.id)
        )
    except episode_video.EpisodeNotFoundError:
        raise ApiError(404, ErrorCode.NOT_FOUND, "Không tìm thấy tập phim.") from None
    except episode_video.EpisodePublishedError:
        raise ApiError(
            409, ErrorCode.CONFLICT, "Tập đang xuất bản: gỡ xuất bản trước khi thay video."
        ) from None
    except (stream_service.StreamNotConfiguredError, stream_service.StreamProviderError) as exc:
        raise stream_errors(exc) from None
    await db.commit()
    return UploadOut(upload_url=ticket.upload_url, video_id=ticket.video_id)


@router.post("/episodes/{episode_id}/stream-sync")
async def stream_sync(
    episode_id: EpisodeId, db: DbSession, admin: AdminUser, background: BackgroundTasks
) -> StreamSyncOut:
    """Hỏi Cloudflare trạng thái video của tập (khi webhook bị trượt, hoặc ở dev)."""
    try:
        result, episode = await episode_video.sync_episode(
            db, episode_id, actor=Actor.admin(admin.id)
        )
    except episode_video.EpisodeNotFoundError:
        raise ApiError(404, ErrorCode.NOT_FOUND, "Không tìm thấy tập phim.") from None
    except episode_video.NoVideoError:
        raise ApiError(409, ErrorCode.CONFLICT, "Tập này chưa có video.") from None
    except (stream_service.StreamNotConfiguredError, stream_service.StreamProviderError) as exc:
        raise stream_errors(exc) from None
    out = StreamSyncOut(
        episode_id=episode.id,
        video_id=episode.stream_video_id,
        stream_status=StreamStatus(episode.stream_status),
        duration_sec=episode.duration_sec,
        thumbnail_url=episode.thumbnail_url,
        result=result,
    )
    await db.commit()
    if result == episode_video.ApplyResult.UPDATED and out.stream_status == StreamStatus.READY:
        background.add_task(stream_service.set_allowed_origins_quietly, episode.stream_video_id)
    return out
