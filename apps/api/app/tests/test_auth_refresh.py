"""/auth/refresh: xoay vòng refresh token, ân hạn 60 giây, phát hiện token bị dùng lại."""

import asyncio
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, hash_refresh_token
from app.models import User
from app.services.audit import Actor
from app.services.soft_delete import soft_delete
from app.tests.test_auth_api import (
    ACCESS,
    REFRESH,
    error_code,
    register,
    sessions_of,
    set_cookies,
)

REFRESH_URL = "/api/v1/auth/refresh"


async def refresh_with(api: httpx.AsyncClient, token: str | None) -> httpx.Response:
    """Gọi refresh với đúng một cookie refresh (bỏ cookie đang có trong client)."""
    api.cookies.clear()
    headers = {"Cookie": f"{REFRESH}={token}"} if token else {}
    return await api.post(REFRESH_URL, headers=headers)


async def signed_up(api: httpx.AsyncClient) -> tuple[int, str]:
    res = await register(api)
    return res.json()["id"], set_cookies(res)[REFRESH]["value"]


def assert_session_expired(res: httpx.Response) -> None:
    assert res.status_code == 401
    assert error_code(res) == "session_expired"
    cookies = set_cookies(res)
    assert cookies[ACCESS]["max-age"] == "0"
    assert cookies[REFRESH]["max-age"] == "0"


def run_sql(db: Session, sql: str, **params) -> None:
    db.execute(text(sql), params)
    db.commit()


async def test_refresh_rotates_both_cookies(api: httpx.AsyncClient, db: Session):
    user_id, t0 = await signed_up(api)
    res = await refresh_with(api, t0)
    assert res.status_code == 204

    cookies = set_cookies(res)
    t1 = cookies[REFRESH]["value"]
    assert t1 != t0
    assert cookies[REFRESH]["path"] == "/api/v1/auth"
    claims = decode_access_token(cookies[ACCESS]["value"])

    [session] = sessions_of(db, user_id)
    assert claims.user_id == user_id and claims.session_id == session.id
    assert session.refresh_token_hash == hash_refresh_token(t1)
    assert session.previous_refresh_token_hash == hash_refresh_token(t0)
    assert session.rotated_at is not None and session.revoked_at is None

    # Token mới tiếp tục xoay được.
    assert (await refresh_with(api, t1)).status_code == 204


async def test_refresh_slides_expiry_30_days(api: httpx.AsyncClient, db: Session):
    user_id, t0 = await signed_up(api)
    run_sql(db, "UPDATE sessions SET expires_at = now() + interval '1 day'")

    assert (await refresh_with(api, t0)).status_code == 204
    [session] = sessions_of(db, user_id)
    remaining = session.expires_at - datetime.now(UTC)
    assert timedelta(days=29, hours=23) < remaining <= timedelta(days=30)


async def test_previous_token_within_grace_gets_access_only(api: httpx.AsyncClient, db: Session):
    """Hai tab refresh cùng lúc: tab chậm dùng token vừa bị xoay vẫn được, không bị đăng xuất."""
    user_id, t0 = await signed_up(api)
    t1 = set_cookies(await refresh_with(api, t0))[REFRESH]["value"]

    res = await refresh_with(api, t0)
    assert res.status_code == 204
    cookies = set_cookies(res)
    assert decode_access_token(cookies[ACCESS]["value"]).user_id == user_id
    assert REFRESH not in cookies  # không xoay tiếp: cookie t1 của tab nhanh được giữ nguyên

    [session] = sessions_of(db, user_id)
    assert session.revoked_at is None
    assert session.refresh_token_hash == hash_refresh_token(t1)
    assert (await refresh_with(api, t1)).status_code == 204


async def test_previous_token_after_grace_revokes_session(api: httpx.AsyncClient, db: Session):
    """Token cũ dùng lại sau 60 giây = bị đánh cắp: thu hồi cả phiên, cả token mới cũng chết."""
    user_id, t0 = await signed_up(api)
    t1 = set_cookies(await refresh_with(api, t0))[REFRESH]["value"]
    run_sql(db, "UPDATE sessions SET rotated_at = now() - interval '61 seconds'")

    assert_session_expired(await refresh_with(api, t0))
    [session] = sessions_of(db, user_id)
    assert session.revoked_at is not None
    assert_session_expired(await refresh_with(api, t1))


async def test_token_two_rotations_old_is_unknown(api: httpx.AsyncClient):
    """Token cũ hơn "liền trước" không còn trong DB: từ chối."""
    _, t0 = await signed_up(api)
    t1 = set_cookies(await refresh_with(api, t0))[REFRESH]["value"]
    await refresh_with(api, t1)
    assert_session_expired(await refresh_with(api, t0))


async def test_concurrent_refresh_same_token(api: httpx.AsyncClient, db: Session):
    user_id, t0 = await signed_up(api)
    api.cookies.clear()
    headers = {"Cookie": f"{REFRESH}={t0}"}
    results = await asyncio.gather(
        api.post(REFRESH_URL, headers=headers), api.post(REFRESH_URL, headers=headers)
    )
    assert [r.status_code for r in results] == [204, 204]
    rotated = [r for r in results if REFRESH in set_cookies(r)]
    assert len(rotated) == 1  # đúng một request xoay, request kia nhận ân hạn
    [session] = sessions_of(db, user_id)
    assert session.revoked_at is None


async def test_expired_session(api: httpx.AsyncClient, db: Session):
    _, t0 = await signed_up(api)
    run_sql(db, "UPDATE sessions SET expires_at = now() - interval '1 second'")
    assert_session_expired(await refresh_with(api, t0))


async def test_revoked_session(api: httpx.AsyncClient):
    _, t0 = await signed_up(api)
    api.cookies.clear()
    await api.post("/api/v1/auth/logout", headers={"Cookie": f"{REFRESH}={t0}"})
    assert_session_expired(await refresh_with(api, t0))


async def test_missing_or_garbage_token(api: httpx.AsyncClient):
    assert_session_expired(await refresh_with(api, None))
    assert_session_expired(await refresh_with(api, "rac"))


async def test_disabled_user_cannot_refresh(api: httpx.AsyncClient, db: Session):
    user_id, t0 = await signed_up(api)
    run_sql(db, "UPDATE users SET is_active = false WHERE id = :id", id=user_id)
    assert_session_expired(await refresh_with(api, t0))
    [session] = sessions_of(db, user_id)
    assert session.revoked_at is not None


async def test_soft_deleted_user_cannot_refresh(api: httpx.AsyncClient, adb: AsyncSession):
    user_id, t0 = await signed_up(api)
    await soft_delete(adb, await adb.get(User, user_id), actor=Actor.system(), reason="test")
    await adb.commit()
    assert_session_expired(await refresh_with(api, t0))


async def test_refresh_cookie_only_sent_to_auth_path(api: httpx.AsyncClient):
    """Cookie jar (như trình duyệt) không gửi cookie refresh ra ngoài /api/v1/auth."""
    await register(api)
    req = api.build_request("GET", "/api/health")
    api.cookies.set_cookie_header(req)
    assert REFRESH not in req.headers.get("cookie", "")
    assert ACCESS in req.headers.get("cookie", "")
