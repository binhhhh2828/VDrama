"""Cloudflare Stream: ký token xem phim, dựng URL phát, gọi API Cloudflare.

- Token ký ngay trong backend bằng khóa riêng (RS256), không gọi API Cloudflare mỗi lượt xem.
  Video phải đặt `requireSignedURLs = true`, nếu không ai biết id video đều xem được.
  https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
- API Cloudflare chỉ gọi cho việc của admin (upload, đồng bộ trạng thái) và lệnh cài đặt.
  https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
"""

import base64
import hashlib
import hmac
import logging
import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlsplit

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

from app.core.config import MAX_STREAM_TOKEN_TTL_MINUTES, Settings, get_settings
from app.models.enums import StreamStatus

MAX_TOKEN_LIFETIME = timedelta(minutes=MAX_STREAM_TOKEN_TTL_MINUTES)
# Segment cũng mang token: hết hạn giữa chừng là đứt phim, nên chừa thêm thời gian tua/tạm dừng.
DURATION_BUFFER = timedelta(minutes=30)
# Chịu lệch đồng hồ giữa VPS và Cloudflare.
NOT_BEFORE_SKEW = timedelta(seconds=60)


logger = logging.getLogger(__name__)

CF_API = "https://api.cloudflare.com/client/v4"
# Ngắn: gọi Cloudflare nằm trong request của admin, không để treo lâu.
API_TIMEOUT = httpx.Timeout(15.0, connect=5.0)
# Tập phim dài nhất Cloudflare chấp nhận khi upload (video dài hơn bị báo lỗi chuyển mã).
MAX_VIDEO_DURATION_SEC = 4 * 3600
# Id video (UID) của Cloudflare: 32 ký tự hex.
VIDEO_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")

# Test thay bằng httpx.MockTransport để không gọi Cloudflare thật.
transport: httpx.AsyncBaseTransport | None = None


class StreamNotConfiguredError(Exception):
    """Thiếu cấu hình Stream cần cho việc đang làm (thường gặp ở dev)."""


class StreamProviderError(Exception):
    """Cloudflare lỗi, hết thời gian, hoặc trả về dữ liệu không như mong đợi."""


class InvalidWebhookSignatureError(Exception):
    pass


@dataclass(frozen=True)
class PlaybackUrls:
    hls_url: str
    dash_url: str
    iframe_url: str
    expires_at: datetime


def token_lifetime(ttl_minutes: int, duration_sec: int | None) -> timedelta:
    """Hạn token: ít nhất TTL cấu hình, đủ dài cho cả tập, không quá 24 giờ."""
    lifetime = timedelta(minutes=ttl_minutes)
    if duration_sec:
        lifetime = max(lifetime, timedelta(seconds=duration_sec) + DURATION_BUFFER)
    return min(lifetime, MAX_TOKEN_LIFETIME)


def sign_token(
    video_id: str,
    *,
    key_id: str,
    private_key: RSAPrivateKey,
    now: datetime,
    lifetime: timedelta,
) -> tuple[str, datetime]:
    """Ký token cho một video. Trả (token, thời điểm hết hạn đã làm tròn xuống giây)."""
    issued = math.floor(now.timestamp())
    exp = issued + int(lifetime.total_seconds())
    payload = {
        "sub": video_id,
        "kid": key_id,
        "nbf": issued - int(NOT_BEFORE_SKEW.total_seconds()),
        "exp": exp,
    }
    token = jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": key_id})
    return token, datetime.fromtimestamp(exp, UTC)


def playback_urls(
    video_id: str,
    *,
    duration_sec: int | None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> PlaybackUrls:
    """URL phát (HLS, DASH, Stream player) có token. Chỉ gọi sau khi đã kiểm tra quyền xem."""
    settings = settings or get_settings()
    key = settings.stream_signing_key
    if key is None or not settings.stream_playback_configured:
        raise StreamNotConfiguredError
    token, expires_at = sign_token(
        video_id,
        key_id=settings.cf_stream_signing_key_id,
        private_key=key,
        now=now or datetime.now(UTC),
        lifetime=token_lifetime(settings.stream_token_ttl_minutes, duration_sec),
    )
    base = f"https://customer-{settings.cf_stream_customer_code}.cloudflarestream.com/{token}"
    return PlaybackUrls(
        hls_url=f"{base}/manifest/video.m3u8",
        dash_url=f"{base}/manifest/video.mpd",
        iframe_url=f"{base}/iframe",
        expires_at=expires_at,
    )


# --- API Cloudflare ---


def _account_url(settings: Settings, path: str = "") -> str:
    token = settings.cf_stream_api_token.get_secret_value()
    if not settings.cf_account_id or not token:
        raise StreamNotConfiguredError
    return f"{CF_API}/accounts/{settings.cf_account_id}/stream{path}"


def _client(settings: Settings) -> httpx.AsyncClient:
    token = settings.cf_stream_api_token.get_secret_value()
    return httpx.AsyncClient(
        headers={"Authorization": f"Bearer {token}"},
        timeout=API_TIMEOUT,
        transport=transport,
    )


def _b64(value: str) -> str:
    return base64.b64encode(value.encode()).decode()


def tus_metadata(*, max_duration_sec: int = MAX_VIDEO_DURATION_SEC) -> str:
    """Header Upload-Metadata: "khóa giá_trị_base64" nối bằng dấu phẩy, không dấu cách thừa.

    `requiresignedurls` là khóa không có giá trị: video chỉ phát được bằng token đã ký.
    """
    return f"maxDurationSeconds {_b64(str(max_duration_sec))},requiresignedurls"


def _video_id_from(location: str, header_id: str | None) -> str | None:
    """Id video: header `stream-media-id`, thiếu thì lấy phần cuối đường dẫn của Location.

    Tài liệu Cloudflare chỉ nêu Location; khi thử thật sẽ ghi lại cách nào đúng.
    """
    candidate = (header_id or "").strip() or urlsplit(location).path.rstrip("/").rsplit("/")[-1]
    return candidate if VIDEO_ID_PATTERN.match(candidate) else None


@dataclass(frozen=True)
class UploadTicket:
    upload_url: str  # URL tus dùng một lần, trình duyệt upload thẳng lên Cloudflare
    video_id: str


async def create_upload(size_bytes: int, *, settings: Settings | None = None) -> UploadTicket:
    """Tạo video mới trên Cloudflare và URL upload tus (cho file lớn hơn 200 MB)."""
    settings = settings or get_settings()
    url = _account_url(settings)
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": str(size_bytes),
        "Upload-Metadata": tus_metadata(),
    }
    try:
        async with _client(settings) as client:
            res = await client.post(url, params={"direct_user": "true"}, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("Không gọi được Cloudflare Stream để tạo upload: %r", exc)
        raise StreamProviderError("Không kết nối được Cloudflare Stream") from exc
    if not res.is_success:
        # Thân lỗi của Cloudflare không chứa token; cắt ngắn cho gọn log.
        logger.warning(
            "Cloudflare Stream từ chối tạo upload: %s %s", res.status_code, res.text[:500]
        )
        raise StreamProviderError(f"Cloudflare Stream trả {res.status_code}")
    location = res.headers.get("location", "")
    video_id = _video_id_from(location, res.headers.get("stream-media-id"))
    if not location.startswith("https://") or video_id is None:
        logger.warning("Phản hồi tạo upload thiếu Location/id video: %s", dict(res.headers))
        raise StreamProviderError("Cloudflare Stream không trả URL upload hợp lệ")
    return UploadTicket(upload_url=location, video_id=video_id)


async def _call(settings: Settings, method: str, path: str, **kw: Any) -> dict[str, Any]:
    """Gọi API JSON của Cloudflare, trả `result`. Lỗi mạng/HTTP → StreamProviderError."""
    url = _account_url(settings, path)
    try:
        async with _client(settings) as client:
            res = await client.request(method, url, **kw)
        body = res.json() if res.content else {}
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Gọi Cloudflare Stream %s %s lỗi: %r", method, path, exc)
        raise StreamProviderError("Không kết nối được Cloudflare Stream") from exc
    result = body.get("result") if isinstance(body, dict) else None
    if not res.is_success or not isinstance(result, dict):
        logger.warning(
            "Cloudflare Stream %s %s trả %s %s", method, path, res.status_code, res.text[:500]
        )
        raise StreamProviderError(f"Cloudflare Stream trả {res.status_code}")
    return result


async def get_video(video_id: str, *, settings: Settings | None = None) -> dict[str, Any]:
    """Thông tin video (cùng dạng thân webhook), dùng cho đồng bộ tay."""
    if not VIDEO_ID_PATTERN.match(video_id):
        raise StreamProviderError("Id video không hợp lệ")
    return await _call(settings or get_settings(), "GET", f"/{video_id}")


async def set_allowed_origins(video_id: str, *, settings: Settings | None = None) -> None:
    """Chỉ cho nhúng video trên domain của site (tus không đặt được lúc tạo video)."""
    settings = settings or get_settings()
    host = urlsplit(settings.public_origin).netloc
    await _call(settings, "POST", f"/{video_id}", json={"allowedOrigins": [host]})


async def set_allowed_origins_quietly(video_id: str) -> None:
    """Chạy nền sau webhook: lỗi chỉ ghi log (video vẫn chỉ phát được bằng token)."""
    try:
        await set_allowed_origins(video_id)
    except (StreamProviderError, StreamNotConfiguredError):
        logger.warning("Không đặt được allowedOrigins cho video %s", video_id)


# --- Webhook ---

# Tài liệu Cloudflare không nêu con số; 5 phút đủ cho lệch đồng hồ và gửi lại chậm.
WEBHOOK_TOLERANCE = timedelta(minutes=5)


def webhook_signature(secret: str, timestamp: int, body: bytes) -> str:
    message = str(timestamp).encode() + b"." + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_webhook(header: str | None, body: bytes, secret: str, *, now: datetime) -> None:
    """Kiểm tra `Webhook-Signature: time=<unix>,sig1=<hex>` trên thân thô.

    Sai chữ ký, thiếu trường, hoặc thời điểm lệch quá 5 phút (chống phát lại) → lỗi.
    """
    parts: dict[str, str] = {}
    for item in (header or "").split(","):
        key, sep, value = item.strip().partition("=")
        if sep:
            parts[key] = value
    try:
        timestamp = int(parts["time"])
        signature = parts["sig1"]
    except (KeyError, ValueError):
        raise InvalidWebhookSignatureError from None
    if abs(now.timestamp() - timestamp) > WEBHOOK_TOLERANCE.total_seconds():
        raise InvalidWebhookSignatureError
    expected = webhook_signature(secret, timestamp, body)
    if not hmac.compare_digest(expected, signature.lower()):
        raise InvalidWebhookSignatureError


@dataclass(frozen=True)
class VideoState:
    """Trạng thái video đọc từ thân webhook hoặc `GET /stream/{id}` (cùng dạng)."""

    video_id: str
    status: StreamStatus
    require_signed_urls: bool
    duration_sec: int | None
    thumbnail_url: str | None
    error_code: str | None


def parse_video(data: dict[str, Any]) -> VideoState:
    """Đọc dữ liệu video của Cloudflare. Thiếu id hợp lệ → ValueError."""
    video_id = data.get("uid")
    if not isinstance(video_id, str) or not VIDEO_ID_PATTERN.match(video_id):
        raise ValueError("Thiếu uid video hợp lệ")
    raw_status = data.get("status")
    status_info: dict[str, Any] = raw_status if isinstance(raw_status, dict) else {}
    state = status_info.get("state")
    if state == "ready" and data.get("readyToStream") is True:
        status = StreamStatus.READY
    elif state == "error":
        status = StreamStatus.ERROR
    elif state == "pendingupload":
        status = StreamStatus.UPLOADING
    else:  # queued, downloading, inprogress, hoặc ready nhưng chưa phát được
        status = StreamStatus.PROCESSING
    duration = data.get("duration")
    thumbnail = data.get("thumbnail")
    # Tài liệu lúc ghi errorReasonCode, lúc ghi errReasonCode: đọc cả hai.
    error_code = status_info.get("errorReasonCode") or status_info.get("errReasonCode")
    return VideoState(
        video_id=video_id,
        status=status,
        require_signed_urls=data.get("requireSignedURLs") is True,
        # Cloudflare trả -1 khi chưa biết thời lượng.
        duration_sec=round(duration)
        if isinstance(duration, int | float) and not isinstance(duration, bool) and duration > 0
        else None,
        thumbnail_url=thumbnail
        if isinstance(thumbnail, str) and thumbnail.startswith("https://")
        else None,
        error_code=str(error_code)[:100] if error_code else None,
    )
