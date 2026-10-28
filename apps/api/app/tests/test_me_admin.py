"""/me, CurrentUser, OptionalUser, require_admin và lệnh create-admin."""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from argon2 import PasswordHasher
from fastapi import FastAPI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import AdminUser, OptionalUser
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.security import create_access_token, decode_access_token
from app.models import AuditLog, User
from app.services.admin_accounts import AdminAccountError, create_or_promote_admin
from app.services.audit import Actor
from app.services.soft_delete import soft_delete
from app.tests.test_auth_api import ACCESS, PASSWORD, error_code, register, set_cookies

ME = "/api/v1/me"


async def me_with(api: httpx.AsyncClient, access: str | None) -> httpx.Response:
    api.cookies.clear()
    return await api.get(ME, headers={"Cookie": f"{ACCESS}={access}"} if access else {})


async def signed_up(api: httpx.AsyncClient, **kw) -> tuple[int, str]:
    res = await register(api, **kw)
    return res.json()["id"], set_cookies(res)[ACCESS]["value"]


# --- /me và CurrentUser ---


async def test_me_returns_current_user(api: httpx.AsyncClient):
    user_id, access = await signed_up(api)
    res = await me_with(api, access)
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == user_id and body["email"] == "Binh@example.com"
    assert body["is_vip"] is False
    assert "password" not in res.text


async def test_me_without_or_with_bad_cookie(api: httpx.AsyncClient):
    for access in (None, "rac", create_access_token(1, uuid.uuid4())):
        res = await me_with(api, access)
        assert res.status_code == 401
        assert error_code(res) == "not_authenticated"


async def test_me_with_expired_access_token(api: httpx.AsyncClient):
    user_id, access = await signed_up(api)
    sid = decode_access_token(access).session_id
    old = create_access_token(user_id, sid, now=datetime.now(UTC) - timedelta(minutes=16))
    assert (await me_with(api, old)).status_code == 401


async def test_me_after_logout_is_401_immediately(api: httpx.AsyncClient):
    """Access token còn hạn nhưng phiên đã thu hồi: chặn ngay, không chờ token hết hạn."""
    _, access = await signed_up(api)
    await api.post("/api/v1/auth/logout")
    assert (await me_with(api, access)).status_code == 401


async def test_me_session_expired_in_db(api: httpx.AsyncClient, db: Session):
    _, access = await signed_up(api)
    db.execute(text("UPDATE sessions SET expires_at = now() - interval '1 second'"))
    db.commit()
    assert (await me_with(api, access)).status_code == 401


async def test_me_disabled_user_is_401(api: httpx.AsyncClient, db: Session):
    user_id, access = await signed_up(api)
    db.execute(text("UPDATE users SET is_active = false WHERE id = :id"), {"id": user_id})
    db.commit()
    assert (await me_with(api, access)).status_code == 401


async def test_me_soft_deleted_user_is_401(api: httpx.AsyncClient, adb: AsyncSession):
    user_id, access = await signed_up(api)
    await soft_delete(adb, await adb.get(User, user_id), actor=Actor.system(), reason="test")
    await adb.commit()
    assert (await me_with(api, access)).status_code == 401


async def test_token_of_other_user_with_my_session_rejected(api: httpx.AsyncClient):
    """sub và sid phải khớp nhau (token ký đúng nhưng ghép sai không qua được)."""
    _, access = await signed_up(api)
    other_id, _ = await signed_up(api, email="khac@example.com")
    forged = create_access_token(other_id, decode_access_token(access).session_id)
    assert (await me_with(api, forged)).status_code == 401


# --- OptionalUser và require_admin (app thử nghiệm dùng chung DB và cookie) ---


def probe_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/public")
    async def public(user: OptionalUser) -> dict:
        return {"user_id": user.id if user else None}

    @app.get("/admin-only")
    async def admin_only(user: AdminUser) -> dict:
        return {"admin_id": user.id}

    return app


async def probe(path: str, access: str | None) -> httpx.Response:
    transport = httpx.ASGITransport(app=probe_app())
    async with httpx.AsyncClient(transport=transport, base_url="https://test") as c:
        return await c.get(path, headers={"Cookie": f"{ACCESS}={access}"} if access else {})


async def test_optional_user(api: httpx.AsyncClient):
    user_id, access = await signed_up(api)
    assert (await probe("/public", None)).json() == {"user_id": None}
    assert (await probe("/public", "rac")).json() == {"user_id": None}
    assert (await probe("/public", access)).json() == {"user_id": user_id}


async def test_require_admin(api: httpx.AsyncClient, db: Session):
    user_id, access = await signed_up(api)

    res = await probe("/admin-only", None)
    assert res.status_code == 401 and error_code(res) == "not_authenticated"
    res = await probe("/admin-only", access)
    assert res.status_code == 403 and error_code(res) == "forbidden"

    # Role đọc từ DB mỗi request: nâng quyền có hiệu lực ngay với token đang dùng.
    db.execute(text("UPDATE users SET role = 'admin' WHERE id = :id"), {"id": user_id})
    db.commit()
    res = await probe("/admin-only", access)
    assert res.status_code == 200 and res.json() == {"admin_id": user_id}


# --- create-admin ---


async def audit_rows(adb: AsyncSession, action: str) -> list[AuditLog]:
    return list((await adb.execute(select(AuditLog).where(AuditLog.action == action))).scalars())


async def test_create_new_admin_is_logged(adb: AsyncSession):
    result = await create_or_promote_admin(
        adb, email="Admin@VDrama.vn", password=PASSWORD, reason="Admin đầu tiên"
    )
    await adb.commit()
    assert result.created and result.user.role == "admin"
    [log] = await audit_rows(adb, "users.create_admin")
    assert log.actor_type == "system" and log.subject_user_id == result.user.id
    assert log.reason == "Admin đầu tiên"
    assert log.changes == {"email": "Admin@VDrama.vn", "role": "admin"}


async def test_promote_existing_user_is_logged(api: httpx.AsyncClient, adb: AsyncSession):
    user_id, _ = await signed_up(api)
    result = await create_or_promote_admin(adb, email="binh@EXAMPLE.com", reason="Nhân sự mới")
    await adb.commit()
    assert not result.created and result.changed and result.user.id == user_id
    [log] = await audit_rows(adb, "users.role_change")
    assert log.changes["role"] == ["user", "admin"]

    again = await create_or_promote_admin(adb, email="binh@example.com", reason="Lần nữa")
    assert not again.changed
    assert len(await audit_rows(adb, "users.role_change")) == 1


async def test_create_admin_requires_reason_and_password(adb: AsyncSession):
    with pytest.raises(ValueError, match="lý do"):
        await create_or_promote_admin(adb, email="a@vdrama.vn", password=PASSWORD, reason=" ")
    with pytest.raises(AdminAccountError, match="mật khẩu"):
        await create_or_promote_admin(adb, email="a@vdrama.vn", reason="x")


async def test_cannot_promote_soft_deleted_user(api: httpx.AsyncClient, adb: AsyncSession):
    user_id, _ = await signed_up(api)
    await soft_delete(adb, await adb.get(User, user_id), actor=Actor.system(), reason="test")
    await adb.commit()
    with pytest.raises(AdminAccountError, match="đã bị xóa"):
        await create_or_promote_admin(adb, email="binh@example.com", reason="x")


def test_cli_create_admin(migrated_db_url: str, db: Session, monkeypatch):
    """Chạy đúng hàm main của lệnh CLI (mật khẩu đi qua prompt, không qua tham số)."""
    from app.cli import main

    monkeypatch.setenv("DATABASE_URL", migrated_db_url)
    get_settings.cache_clear()
    try:
        answers = iter([PASSWORD, PASSWORD])
        code = main(
            ["create-admin", "--email", "boss@vdrama.vn", "--reason", "Admin đầu tiên"],
            prompt=lambda _: next(answers),
        )
        assert code == 0

        # Nhập lại không khớp, mật khẩu quá ngắn, email sai: báo lỗi, không tạo gì.
        answers = iter([PASSWORD, "khac-hoan-toan"])
        assert (
            main(
                ["create-admin", "--email", "boss2@vdrama.vn", "--reason", "x"],
                prompt=lambda _: next(answers),
            )
            == 1
        )
        assert (
            main(
                ["create-admin", "--email", "boss3@vdrama.vn", "--reason", "x"],
                prompt=lambda _: "ngan",
            )
            == 1
        )
        assert main(["create-admin", "--email", "khong-hop-le", "--reason", "x"]) == 2
    finally:
        get_settings.cache_clear()

    users = {u.email: u for u in db.scalars(select(User))}
    assert set(users) == {"boss@vdrama.vn"}
    boss = users["boss@vdrama.vn"]
    assert boss.role == "admin"
    assert PasswordHasher().verify(boss.password_hash, PASSWORD)
    actions = list(db.scalars(select(AuditLog.action)))
    assert actions == ["users.create_admin"]
