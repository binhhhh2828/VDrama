"""Cloudflare Stream: ký token xem phim, dựng URL phát, gọi API Cloudflare.

- Token ký ngay trong backend bằng khóa riêng (RS256), không gọi API Cloudflare mỗi lượt xem.
  Video phải đặt `requireSignedURLs = true`, nếu không ai biết id video đều xem được.
  https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
- API Cloudflare chỉ gọi cho việc của admin (upload, đồng bộ trạng thái) và lệnh cài đặt.
  https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
"""

import base64
import logging
import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

from app.core.config import MAX_STREAM_TOKEN_TTL_MINUTES, Settings, get_settings

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
