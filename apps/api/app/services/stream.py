"""Cloudflare Stream: ký token xem phim và dựng URL phát.

Token ký ngay trong backend bằng khóa riêng (RS256), không gọi API Cloudflare mỗi lượt xem.
Video phải đặt `requireSignedURLs = true`, nếu không ai biết id video đều xem được.
Tài liệu: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
"""

import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

from app.core.config import MAX_STREAM_TOKEN_TTL_MINUTES, Settings, get_settings

MAX_TOKEN_LIFETIME = timedelta(minutes=MAX_STREAM_TOKEN_TTL_MINUTES)
# Segment cũng mang token: hết hạn giữa chừng là đứt phim, nên chừa thêm thời gian tua/tạm dừng.
DURATION_BUFFER = timedelta(minutes=30)
# Chịu lệch đồng hồ giữa VPS và Cloudflare.
NOT_BEFORE_SKEW = timedelta(seconds=60)


class StreamNotConfiguredError(Exception):
    """Thiếu khóa ký hoặc customer code (thường gặp ở dev)."""


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
