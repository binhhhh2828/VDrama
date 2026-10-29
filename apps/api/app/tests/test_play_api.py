"""GET /episodes/{id}/play: ma trận quyền xem, URL có token, đếm lượt xem, rate limit."""

from collections.abc import Iterator
from datetime import UTC, datetime
from urllib.parse import urlsplit

import httpx
import jwt
import pytest
from limits import parse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.config import get_settings
from app.models import Episode, Series, SeriesStats
from app.services.audit import Actor
from app.services.soft_delete import soft_delete
from app.tests import stream_keys
from app.tests.test_auth_api import error_code
from app.tests.test_catalog_api import add_episode, add_series, become_admin
from app.tests.test_me_admin import signed_up


@pytest.fixture(autouse=True)
def stream_on(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Cấu hình Stream đầy đủ bằng khóa test (test nào cần tắt thì tự đặt lại).

    Cố định JWT_SECRET: dev để trống thì mỗi lần dựng lại Settings sinh khóa mới, cookie đăng
    nhập đã cấp sẽ mất hiệu lực khi test đổi cấu hình giữa chừng.
    """
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-" + "x" * 32)
    for key, value in stream_keys.stream_env().items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def url(episode: Episode) -> str:
    return f"/api/v1/episodes/{episode.id}/play"


def token_claims(play_url: str) -> dict:
    token = urlsplit(play_url).path.split("/")[1]
    return jwt.decode(token, stream_keys.private_key().public_key(), algorithms=["RS256"])


def set_vip(db: Session, user_id: int, interval: str) -> None:
    """Đặt thẳng hạn VIP cho test (code thật chỉ đổi qua services/vip.py)."""
    db.execute(
        text(f"UPDATE users SET vip_expires_at = now() + interval '{interval}' WHERE id = :id"),
        {"id": user_id},
    )
    db.commit()


def views(db: Session, series: Series) -> int:
    db.expire_all()
    return db.scalar(select(SeriesStats.view_count).where(SeriesStats.series_id == series.id)) or 0


@pytest.fixture
def show(db: Session) -> tuple[Series, Episode, Episode]:
    """Một series đã xuất bản: tập 1 miễn phí, tập 2 VIP."""
    s = add_series(db, "nang-tho")
    free = add_episode(db, s, 1, free=True, duration_sec=1500)
    vip = add_episode(db, s, 2)
    db.commit()
    return s, free, vip


# --- Ma trận quyền xem ---


async def test_guest_must_log_in_even_for_free(api: httpx.AsyncClient, show):
    _, free, vip = show
    for ep in (free, vip):
        res = await api.get(url(ep))
        assert res.status_code == 401
        assert error_code(res) == "not_authenticated"


async def test_user_watches_free_episode(api: httpx.AsyncClient, show):
    _, free, _ = show
    await signed_up(api)
    res = await api.get(url(free))
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"episode_id", "hls_url", "dash_url", "iframe_url", "expires_at"}
    assert body["episode_id"] == free.id
    base = f"https://customer-{stream_keys.CUSTOMER_CODE}.cloudflarestream.com/"
    assert body["hls_url"].startswith(base) and body["hls_url"].endswith("/manifest/video.m3u8")
    assert body["dash_url"].endswith("/manifest/video.mpd")
    assert body["iframe_url"].endswith("/iframe")
    claims = token_claims(body["hls_url"])
    assert claims["sub"] == free.stream_video_id
    assert datetime.fromisoformat(body["expires_at"]) == datetime.fromtimestamp(claims["exp"], UTC)
    assert res.headers["cache-control"] == "no-store"


async def test_user_without_vip_blocked_from_vip_episode(api: httpx.AsyncClient, show):
    _, _, vip = show
    await signed_up(api)
    res = await api.get(url(vip))
    assert res.status_code == 403
    assert error_code(res) == "vip_required"


async def test_vip_watches_vip_episode(api: httpx.AsyncClient, db: Session, show):
    _, _, vip = show
    user_id, _ = await signed_up(api)
    set_vip(db, user_id, "1 day")
    res = await api.get(url(vip))
    assert res.status_code == 200, res.text
    assert token_claims(res.json()["hls_url"])["sub"] == vip.stream_video_id


async def test_expired_vip_blocked(api: httpx.AsyncClient, db: Session, show):
    _, free, vip = show
    user_id, _ = await signed_up(api)
    set_vip(db, user_id, "-1 second")
    res = await api.get(url(vip))
    assert res.status_code == 403
    assert error_code(res) == "vip_required"
    assert (await api.get(url(free))).status_code == 200  # tập miễn phí vẫn xem được


async def test_admin_watches_vip_without_subscription(api: httpx.AsyncClient, db: Session, show):
    _, _, vip = show
    await become_admin(api, db)
    assert (await api.get(url(vip))).status_code == 200


# --- Tập/series ẩn ---


@pytest.fixture
def hidden(db: Session) -> dict[str, Episode]:
    """Các tập người thường không được thấy (đều đã có video ready)."""
    s = add_series(db, "cong-khai")
    draft = add_series(db, "nhap", published=False)
    eps = {
        "unpublished_episode": add_episode(
            db, s, 1, published=False, stream_status="ready", free=True
        ),
        # Tập đã xuất bản nhưng series thì chưa.
        "draft_series": add_episode(db, draft, 1, free=True),
    }
    db.commit()
    return eps


@pytest.mark.parametrize("case", ["unpublished_episode", "draft_series"])
async def test_hidden_episode_404_for_user(api: httpx.AsyncClient, hidden, case):
    await signed_up(api)
    res = await api.get(url(hidden[case]))
    assert res.status_code == 404
    assert error_code(res) == "not_found"


@pytest.mark.parametrize("case", ["unpublished_episode", "draft_series"])
async def test_hidden_episode_404_for_guest(api: httpx.AsyncClient, hidden, case):
    """404 trước 401: khách không dò được tập ẩn có tồn tại hay không."""
    assert (await api.get(url(hidden[case]))).status_code == 404


@pytest.mark.parametrize("case", ["unpublished_episode", "draft_series"])
async def test_admin_previews_hidden_episode(api: httpx.AsyncClient, db: Session, hidden, case):
    await become_admin(api, db)
    assert (await api.get(url(hidden[case]))).status_code == 200


async def test_admin_preview_video_not_ready_409(api: httpx.AsyncClient, db: Session):
    s = add_series(db, "dang-lam", published=False)
    ep = add_episode(db, s, 1, published=False, stream_status="processing")
    db.commit()
    await become_admin(api, db)
    res = await api.get(url(ep))
    assert res.status_code == 409
    assert error_code(res) == "video_not_ready"


@pytest.mark.parametrize("target", ["episode", "series"])
async def test_deleted_404_even_for_admin(
    api: httpx.AsyncClient, db: Session, adb: AsyncSession, show, target
):
    s, free, _ = show
    obj = await adb.get(Episode, free.id) if target == "episode" else await adb.get(Series, s.id)
    await soft_delete(adb, obj, actor=Actor.system(), reason="test")
    await adb.commit()
    await become_admin(api, db)
    assert (await api.get(url(free))).status_code == 404


async def test_unknown_episode_404(api: httpx.AsyncClient):
    await signed_up(api)
    res = await api.get("/api/v1/episodes/999999/play")
    assert res.status_code == 404


@pytest.mark.parametrize("bad_id", ["0", "-1", "abc", str(2**63)])
async def test_invalid_id_422(api: httpx.AsyncClient, bad_id: str):
    res = await api.get(f"/api/v1/episodes/{bad_id}/play")
    assert res.status_code == 422


async def test_stream_not_configured_503(
    api: httpx.AsyncClient, show, monkeypatch: pytest.MonkeyPatch
):
    _, free, _ = show
    await signed_up(api)
    monkeypatch.setenv("CF_STREAM_SIGNING_KEY_ID", "")
    monkeypatch.setenv("CF_STREAM_SIGNING_KEY_PEM", "")
    get_settings.cache_clear()
    res = await api.get(url(free))
    assert res.status_code == 503
    assert error_code(res) == "stream_unavailable"


async def test_response_has_no_raw_video_id_field(api: httpx.AsyncClient, show):
    _, free, _ = show
    await signed_up(api)
    body = (await api.get(url(free))).json()
    assert "stream_video_id" not in body
    assert free.stream_video_id not in body["hls_url"]


# --- Lượt xem ---


async def test_view_counted_once_per_user_episode(api: httpx.AsyncClient, db: Session, show):
    s, free, _ = show
    await signed_up(api)
    for _ in range(3):
        assert (await api.get(url(free))).status_code == 200
    assert views(db, s) == 1


async def test_views_per_episode_and_per_user(api: httpx.AsyncClient, db: Session, show):
    s, free, vip = show
    user_id, _ = await signed_up(api)
    set_vip(db, user_id, "1 day")
    await api.get(url(free))
    await api.get(url(vip))
    assert views(db, s) == 2
    api.cookies.clear()
    await signed_up(api, email="khac@example.com")
    await api.get(url(free))
    assert views(db, s) == 3


async def test_denied_play_not_counted(api: httpx.AsyncClient, db: Session, show):
    s, _, vip = show
    await signed_up(api)
    assert (await api.get(url(vip))).status_code == 403
    assert views(db, s) == 0


async def test_admin_views_not_counted(api: httpx.AsyncClient, db: Session, show):
    s, free, _ = show
    await become_admin(api, db)
    assert (await api.get(url(free))).status_code == 200
    assert views(db, s) == 0


async def test_view_adds_to_existing_stats(api: httpx.AsyncClient, db: Session, show):
    s, free, _ = show
    db.add(SeriesStats(series_id=s.id, view_count=41))
    db.commit()
    await signed_up(api)
    await api.get(url(free))
    assert views(db, s) == 42


# --- Rate limit ---


def test_play_limit_value():
    assert str(rate_limit.PLAY_PER_USER) == str(parse("60/minute"))


async def test_play_rate_limited_per_user(
    api: httpx.AsyncClient, show, monkeypatch: pytest.MonkeyPatch
):
    _, free, _ = show
    monkeypatch.setattr(rate_limit, "PLAY_PER_USER", parse("3/minute"))
    await signed_up(api)
    for _ in range(3):
        assert (await api.get(url(free))).status_code == 200
    res = await api.get(url(free))
    assert res.status_code == 429
    assert error_code(res) == "rate_limited"
    assert int(res.headers["retry-after"]) > 0
    # Người khác không bị ảnh hưởng.
    api.cookies.clear()
    await signed_up(api, email="khac@example.com")
    assert (await api.get(url(free))).status_code == 200
