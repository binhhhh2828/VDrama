"""Ký token xem phim cục bộ (Cloudflare Stream signing key, RS256)."""

from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import jwt
import pytest

from app.core.config import Settings
from app.services import stream
from app.services.stream import (
    DURATION_BUFFER,
    MAX_TOKEN_LIFETIME,
    StreamNotConfiguredError,
    playback_urls,
    token_lifetime,
)
from app.tests import stream_keys

VIDEO_ID = "ea95132c15732412d22c1476fa83f27a"
NOW = datetime(2026, 10, 29, 12, 0, 0, 500_000, tzinfo=UTC)


def make(**kw) -> Settings:
    return Settings(_env_file=None, **{**stream_keys.stream_settings(), **kw})


def decode(token: str) -> dict:
    """Giải mã bằng khóa công khai (như phía Cloudflare), kèm header ở khóa `_header`."""
    public = stream_keys.private_key().public_key()
    return jwt.decode(
        token,
        public,
        algorithms=["RS256"],
        options={"verify_exp": False, "verify_nbf": False},
    ) | {"_header": jwt.get_unverified_header(token)}


def token_of(url: str) -> str:
    return urlsplit(url).path.split("/")[1]


def test_token_claims_and_header():
    urls = playback_urls(VIDEO_ID, duration_sec=None, settings=make(), now=NOW)
    claims = decode(token_of(urls.hls_url))
    assert claims["_header"] == {"alg": "RS256", "kid": stream_keys.KEY_ID, "typ": "JWT"}
    assert claims["sub"] == VIDEO_ID
    assert claims["kid"] == stream_keys.KEY_ID
    issued = int(NOW.timestamp())
    assert claims["exp"] == issued + 180 * 60  # TTL mặc định 3 giờ
    assert claims["nbf"] == issued - 60  # chịu lệch đồng hồ
    assert urls.expires_at == datetime.fromtimestamp(claims["exp"], UTC)


def test_token_verifies_with_public_key_and_expires():
    """Chữ ký đúng với khóa công khai; quá hạn thì bị từ chối."""
    public = stream_keys.private_key().public_key()
    now = datetime.now(UTC)
    fresh = playback_urls(VIDEO_ID, duration_sec=None, settings=make(), now=now)
    jwt.decode(token_of(fresh.hls_url), public, algorithms=["RS256"])  # không ném lỗi
    old = playback_urls(VIDEO_ID, duration_sec=None, settings=make(), now=now - timedelta(hours=4))
    with pytest.raises(jwt.ExpiredSignatureError):
        jwt.decode(token_of(old.hls_url), public, algorithms=["RS256"])


def test_token_signed_by_other_key_rejected():
    other = Settings(
        _env_file=None,
        **{**stream_keys.stream_settings(), "cf_stream_signing_key_pem": stream_keys.pem_b64(3072)},
    )
    token = token_of(playback_urls(VIDEO_ID, duration_sec=None, settings=other, now=NOW).hls_url)
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(
            token,
            stream_keys.private_key().public_key(),
            algorithms=["RS256"],
            options={"verify_exp": False},
        )


def test_playback_url_formats():
    urls = playback_urls(VIDEO_ID, duration_sec=None, settings=make(), now=NOW)
    token = token_of(urls.hls_url)
    base = f"https://customer-{stream_keys.CUSTOMER_CODE}.cloudflarestream.com/{token}"
    assert urls.hls_url == f"{base}/manifest/video.m3u8"
    assert urls.dash_url == f"{base}/manifest/video.mpd"
    assert urls.iframe_url == f"{base}/iframe"
    # Id video chỉ nằm trong token (đã ký), không lộ ra ở đường dẫn.
    assert VIDEO_ID not in urls.hls_url


def test_ttl_from_settings():
    urls = playback_urls(
        VIDEO_ID, duration_sec=None, settings=make(stream_token_ttl_minutes=120), now=NOW
    )
    assert urls.expires_at - NOW.replace(microsecond=0) == timedelta(minutes=120)


@pytest.mark.parametrize(
    ("ttl_minutes", "duration_sec", "expected"),
    [
        (180, None, timedelta(minutes=180)),
        (180, 0, timedelta(minutes=180)),
        (180, 45 * 60, timedelta(minutes=180)),  # tập ngắn: dùng TTL
        # Tập dài hơn TTL: đủ cả tập + thời gian dự phòng.
        (60, 2 * 3600, timedelta(hours=2) + DURATION_BUFFER),
        (180, 30 * 3600, MAX_TOKEN_LIFETIME),  # không vượt 24 giờ (giới hạn Cloudflare)
        (24 * 60, 3600, MAX_TOKEN_LIFETIME),
    ],
)
def test_token_lifetime(ttl_minutes, duration_sec, expected):
    assert token_lifetime(ttl_minutes, duration_sec) == expected


def test_long_episode_extends_token():
    urls = playback_urls(
        VIDEO_ID, duration_sec=4 * 3600, settings=make(stream_token_ttl_minutes=60), now=NOW
    )
    claims = decode(token_of(urls.hls_url))
    assert claims["exp"] - int(NOW.timestamp()) == 4 * 3600 + int(DURATION_BUFFER.total_seconds())


def test_never_exceeds_24_hours():
    urls = playback_urls(VIDEO_ID, duration_sec=48 * 3600, settings=make(), now=NOW)
    claims = decode(token_of(urls.hls_url))
    assert claims["exp"] - int(NOW.timestamp()) == 24 * 3600


@pytest.mark.parametrize(
    "missing",
    [
        {"cf_stream_signing_key_id": "", "cf_stream_signing_key_pem": ""},
        {"cf_stream_customer_code": ""},
    ],
)
def test_not_configured(missing):
    with pytest.raises(StreamNotConfiguredError):
        playback_urls(VIDEO_ID, duration_sec=None, settings=make(**missing), now=NOW)


def test_uses_app_settings_by_default(monkeypatch):
    monkeypatch.setattr(stream, "get_settings", lambda: make())
    urls = playback_urls(VIDEO_ID, duration_sec=None)
    assert decode(token_of(urls.hls_url))["sub"] == VIDEO_ID
