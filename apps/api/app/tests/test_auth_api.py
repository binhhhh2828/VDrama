"""Đăng ký, đăng nhập, đăng xuất qua API thật trên Postgres (database tạm đã migrate)."""

from http.cookies import SimpleCookie

import httpx
import pytest
from argon2 import PasswordHasher
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, hash_refresh_token, password_needs_rehash
from app.models import User, UserSession
from app.services import auth as auth_service
from app.services.audit import Actor
from app.services.soft_delete import soft_delete

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
LOGOUT = "/api/v1/auth/logout"
ACCESS = "__Host-vd_access"
REFRESH = "vd_refresh"
PASSWORD = "mat-khau-du-dai"


def payload(**kw) -> dict:
    return {
        "email": "Binh@Example.com",
        "password": PASSWORD,
        "display_name": "Bình",
        "accept_terms": True,
        **kw,
    }


def set_cookies(res: httpx.Response) -> dict[str, dict]:
    """Phân tích các header Set-Cookie thành {tên: {value, các cờ...}}."""
    out = {}
    for header in res.headers.get_list("set-cookie"):
        cookie = SimpleCookie()
        cookie.load(header)
        for name, morsel in cookie.items():
            out[name] = {"value": morsel.value, "raw": header.lower(), **dict(morsel)}
    return out


def error_code(res: httpx.Response) -> str:
    return res.json()["error"]["code"]


def sessions_of(db: Session, user_id: int) -> list[UserSession]:
    db.expire_all()
    return list(db.scalars(select(UserSession).where(UserSession.user_id == user_id)))


async def register(api: httpx.AsyncClient, **kw) -> httpx.Response:
    res = await api.post(REGISTER, json=payload(**kw))
    assert res.status_code == 201, res.text
    return res


# --- Đăng ký ---


async def test_register_creates_user_and_logs_in(api: httpx.AsyncClient, db: Session):
    res = await register(api)
    body = res.json()
    assert body["email"] == "Binh@example.com"  # email-validator chuẩn hóa tên miền
    assert body["display_name"] == "Bình"
    assert body["role"] == "user"
    assert body["email_verified"] is False
    assert set(body) == {
        "id",
        "email",
        "display_name",
        "avatar_url",
        "role",
        "email_verified",
        "created_at",
    }

    user = db.get(User, body["id"])
    assert user.terms_accepted_at is not None
    assert user.password_hash.startswith("$argon2id$")

    cookies = set_cookies(res)
    claims = decode_access_token(cookies[ACCESS]["value"])
    assert claims.user_id == user.id
    [session] = sessions_of(db, user.id)
    assert session.id == claims.session_id
    assert session.refresh_token_hash == hash_refresh_token(cookies[REFRESH]["value"])
    assert str(session.ip) == "127.0.0.1"


async def test_auth_cookie_flags(api: httpx.AsyncClient):
    cookies = set_cookies(await register(api))
    access, refresh = cookies[ACCESS], cookies[REFRESH]
    for c in (access, refresh):
        assert "httponly" in c["raw"]
        assert "secure" in c["raw"]
        assert "samesite=lax" in c["raw"]
        assert "domain" not in c["raw"]  # __Host- yêu cầu không có Domain
    assert access["path"] == "/"
    assert access["max-age"] == str(15 * 60)
    assert refresh["path"] == "/api/v1/auth"
    assert refresh["max-age"] == str(30 * 24 * 3600)


async def test_dev_cookie_without_secure(api: httpx.AsyncClient, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("COOKIE_SECURE", "false")
    get_settings.cache_clear()
    cookies = set_cookies(await register(api))
    assert "vd_access" in cookies and ACCESS not in cookies
    assert "secure" not in cookies["vd_access"]["raw"]


@pytest.mark.parametrize("email", ["binh@example.com", "BINH@EXAMPLE.COM", " binh@Example.com"])
async def test_register_duplicate_email_case_insensitive(api: httpx.AsyncClient, email: str):
    await register(api)
    res = await api.post(REGISTER, json=payload(email=email.strip()))
    assert res.status_code == 409
    assert res.json()["error"] == {"code": "email_taken", "message": "Email đã được sử dụng."}


async def test_register_email_of_soft_deleted_user_is_taken(
    api: httpx.AsyncClient, adb: AsyncSession
):
    user_id = (await register(api)).json()["id"]
    user = await adb.get(User, user_id)
    await soft_delete(adb, user, actor=Actor.system(), reason="test")
    await adb.commit()

    res = await api.post(REGISTER, json=payload())
    assert res.status_code == 409
    assert error_code(res) == "email_taken"


async def test_register_race_on_unique_index(api: httpx.AsyncClient, monkeypatch):
    """Hai request song song cùng qua bước kiểm tra: unique index của DB chặn người đến sau."""
    await register(api)

    async def never_taken(db, email):
        return False

    monkeypatch.setattr(auth_service, "email_taken", never_taken)
    res = await api.post(REGISTER, json=payload(email="BINH@example.com"))
    assert res.status_code == 409
    assert error_code(res) == "email_taken"


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"accept_terms": False}, ""),
        ({"accept_terms": None}, "accept_terms"),
        ({"password": "1234567"}, "password"),  # 7 ký tự
        ({"password": "x" * 129}, "password"),
        ({"password": "binh@example.com"}, ""),  # trùng email
        ({"email": "khong-phai-email"}, "email"),
        ({"email": "a@b"}, "email"),
        ({"display_name": "   "}, "display_name"),
        ({"display_name": "x" * 101}, "display_name"),
        ({"role": "admin"}, "role"),  # không tự đặt quyền khi đăng ký
    ],
)
async def test_register_validation(api: httpx.AsyncClient, override: dict, field: str):
    data = {k: v for k, v in payload(**override).items() if v is not None}
    res = await api.post(REGISTER, json=data)
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "validation_error"
    assert field in [f["field"] for f in err["fields"]]
    assert "set-cookie" not in res.headers


async def test_register_password_boundaries(api: httpx.AsyncClient):
    await register(api, email="a@example.com", password="x" * 8)
    await register(api, email="b@example.com", password="x" * 128)


# --- Đăng nhập ---


async def test_login_success(api: httpx.AsyncClient, db: Session):
    user_id = (await register(api)).json()["id"]
    res = await api.post(LOGIN, json={"email": "BINH@example.COM", "password": PASSWORD})
    assert res.status_code == 200
    assert res.json()["id"] == user_id
    cookies = set_cookies(res)
    assert decode_access_token(cookies[ACCESS]["value"]).user_id == user_id
    assert len(sessions_of(db, user_id)) == 2  # mỗi lần đăng nhập là một thiết bị
    db.expire_all()
    assert db.get(User, user_id).last_login_at is not None


async def test_wrong_password_and_unknown_email_same_error(api: httpx.AsyncClient, monkeypatch):
    await register(api)
    wrong = await api.post(LOGIN, json={"email": "binh@example.com", "password": "sai-mat-khau"})

    dummy_calls = []
    real_dummy = auth_service.dummy_verify_password

    async def spy():
        dummy_calls.append(1)
        await real_dummy()

    monkeypatch.setattr(auth_service, "dummy_verify_password", spy)
    unknown = await api.post(LOGIN, json={"email": "ai@example.com", "password": PASSWORD})

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert error_code(wrong) == "invalid_credentials"
    assert dummy_calls == [1]  # vẫn chạy verify giả để thời gian phản hồi như nhau
    assert "set-cookie" not in wrong.headers and "set-cookie" not in unknown.headers


async def test_login_malformed_email_is_invalid_credentials(api: httpx.AsyncClient):
    res = await api.post(LOGIN, json={"email": "khong-phai-email", "password": PASSWORD})
    assert res.status_code == 401
    assert error_code(res) == "invalid_credentials"


async def test_login_disabled_account(api: httpx.AsyncClient, db: Session):
    user_id = (await register(api)).json()["id"]
    db.execute(text("UPDATE users SET is_active = false WHERE id = :id"), {"id": user_id})
    db.commit()

    res = await api.post(LOGIN, json={"email": "binh@example.com", "password": PASSWORD})
    assert res.status_code == 403
    assert error_code(res) == "account_disabled"
    # Sai mật khẩu thì không lộ là tài khoản bị khóa.
    res = await api.post(LOGIN, json={"email": "binh@example.com", "password": "sai-mat-khau"})
    assert res.status_code == 401
    assert len(sessions_of(db, user_id)) == 1  # chỉ phiên lúc đăng ký


async def test_login_soft_deleted_user(api: httpx.AsyncClient, adb: AsyncSession):
    user_id = (await register(api)).json()["id"]
    await soft_delete(adb, await adb.get(User, user_id), actor=Actor.system(), reason="test")
    await adb.commit()

    res = await api.post(LOGIN, json={"email": "binh@example.com", "password": PASSWORD})
    assert res.status_code == 401
    assert error_code(res) == "invalid_credentials"


async def test_login_rehashes_old_password_hash(api: httpx.AsyncClient, db: Session):
    user_id = (await register(api)).json()["id"]
    weak = PasswordHasher(time_cost=1, memory_cost=8 * 1024, parallelism=1).hash(PASSWORD)
    db.execute(
        text("UPDATE users SET password_hash = :h WHERE id = :id"), {"h": weak, "id": user_id}
    )
    db.commit()

    res = await api.post(LOGIN, json={"email": "binh@example.com", "password": PASSWORD})
    assert res.status_code == 200
    db.expire_all()
    new_hash = db.get(User, user_id).password_hash
    assert new_hash != weak and not password_needs_rehash(new_hash)


async def test_responses_never_contain_password_hash(api: httpx.AsyncClient):
    for res in (
        await register(api),
        await api.post(LOGIN, json={"email": "binh@example.com", "password": PASSWORD}),
    ):
        assert "password" not in res.text
        assert "$argon2" not in res.text


# --- Đăng xuất ---


async def test_logout_revokes_session_and_clears_cookies(api: httpx.AsyncClient, db: Session):
    user_id = (await register(api)).json()["id"]
    res = await api.post(LOGOUT)
    assert res.status_code == 204

    [session] = sessions_of(db, user_id)
    assert session.revoked_at is not None
    cookies = set_cookies(res)
    assert cookies[ACCESS]["max-age"] == "0" and cookies[ACCESS]["path"] == "/"
    assert cookies[REFRESH]["max-age"] == "0" and cookies[REFRESH]["path"] == "/api/v1/auth"
    assert not api.cookies  # client đã xóa cookie theo phản hồi


async def logout_with(api: httpx.AsyncClient, **cookies: str) -> httpx.Response:
    """Đăng xuất chỉ với đúng các cookie truyền vào (bỏ cookie đang có trong client)."""
    api.cookies.clear()
    header = "; ".join(f"{k}={v}" for k, v in cookies.items())
    return await api.post(LOGOUT, headers={"Cookie": header} if header else {})


async def test_logout_only_revokes_this_device(api: httpx.AsyncClient, db: Session):
    user_id = (await register(api)).json()["id"]
    other = set_cookies(
        await api.post(LOGIN, json={"email": "binh@example.com", "password": PASSWORD})
    )
    res = await logout_with(api, **{REFRESH: other[REFRESH]["value"]})
    assert res.status_code == 204
    revoked = {s.id: s.revoked_at is not None for s in sessions_of(db, user_id)}
    assert sorted(revoked.values()) == [False, True]
    other_sid = decode_access_token(other[ACCESS]["value"]).session_id
    assert revoked[other_sid] is True


async def test_logout_with_access_cookie_only(api: httpx.AsyncClient, db: Session):
    """Mất cookie refresh (ví dụ bị xóa tay) vẫn đăng xuất được nhờ id phiên trong access token."""
    user_id = (await register(api)).json()["id"]
    res = await logout_with(api, **{ACCESS: api.cookies.get(ACCESS)})
    assert res.status_code == 204
    [session] = sessions_of(db, user_id)
    assert session.revoked_at is not None


async def test_logout_without_or_with_garbage_cookies_is_204(api: httpx.AsyncClient):
    assert (await logout_with(api)).status_code == 204
    assert (await logout_with(api, **{REFRESH: "rac", ACCESS: "rac"})).status_code == 204
