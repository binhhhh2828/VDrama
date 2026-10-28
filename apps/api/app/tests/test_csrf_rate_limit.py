"""Chống CSRF theo Origin, rate limit đăng nhập/đăng ký/refresh, IP thật sau Cloudflare."""

import httpx
import pytest
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.client_ip import client_ip
from app.core.config import get_settings
from app.tests.test_auth_api import (
    ACCESS,
    LOGIN,
    LOGOUT,
    PASSWORD,
    REFRESH,
    REGISTER,
    error_code,
    payload,
    register,
    sessions_of,
    set_cookies,
)

SITE = "http://localhost:3000"
EVIL = "https://evil.example"


@pytest.fixture
def trust_cloudflare(monkeypatch):
    monkeypatch.setenv("TRUST_CLOUDFLARE_IP", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def login_body(email: str = "binh@example.com", password: str = PASSWORD) -> dict:
    return {"email": email, "password": password}


# --- CSRF ---


async def post_with(api: httpx.AsyncClient, url: str, *, cookie: str | None, **headers):
    """POST với đúng các header truyền vào (không dùng Origin mặc định của client)."""
    api.cookies.clear()
    h = {"Origin": None, **headers}  # None: bỏ header Origin mặc định
    if cookie:
        h["Cookie"] = cookie
    req = api.build_request("POST", url, headers={k: v for k, v in h.items() if v is not None})
    if h["Origin"] is None:
        del req.headers["Origin"]
    return await api.send(req)


async def test_cookie_with_foreign_origin_rejected(api: httpx.AsyncClient, db: Session):
    user_id = (await register(api)).json()["id"]
    access = api.cookies.get(ACCESS)
    res = await post_with(api, LOGOUT, cookie=f"{ACCESS}={access}", Origin=EVIL)
    assert res.status_code == 403
    assert error_code(res) == "forbidden"
    assert "X-Request-ID" in res.headers
    [session] = sessions_of(db, user_id)
    assert session.revoked_at is None  # request bị chặn trước khi tới endpoint


async def test_cookie_with_site_origin_passes(api: httpx.AsyncClient, db: Session):
    user_id = (await register(api)).json()["id"]
    access = api.cookies.get(ACCESS)
    res = await post_with(api, LOGOUT, cookie=f"{ACCESS}={access}", Origin=SITE)
    assert res.status_code == 204
    [session] = sessions_of(db, user_id)
    assert session.revoked_at is not None


async def test_cookie_without_origin_rejected_referer_accepted(api: httpx.AsyncClient):
    await register(api)
    cookie = f"{REFRESH}={api.cookies.get(REFRESH)}"
    assert (await post_with(api, LOGOUT, cookie=cookie)).status_code == 403
    res = await post_with(api, LOGOUT, cookie=cookie, Referer=f"{SITE}/tai-khoan")
    assert res.status_code == 204
    res = await post_with(api, LOGOUT, cookie=cookie, Referer=f"{EVIL}/x")
    assert res.status_code == 403


async def test_null_origin_rejected(api: httpx.AsyncClient):
    res = await post_with(api, LOGIN, cookie=None, Origin="null")
    assert res.status_code == 403


async def test_no_cookie_no_origin_passes(api: httpx.AsyncClient):
    """curl, webhook thanh toán: không cookie, không Origin, không bị chặn."""
    res = await post_with(api, REGISTER, cookie=None)
    assert res.status_code == 422  # tới được endpoint (body rỗng nên lỗi validate)


async def test_login_from_foreign_origin_rejected(api: httpx.AsyncClient):
    """Trang lạ không đăng nhập hộ người dùng vào tài khoản của kẻ khác (login CSRF)."""
    await register(api)
    api.cookies.clear()
    res = await api.post(LOGIN, json=login_body(), headers={"Origin": EVIL})
    assert res.status_code == 403


async def test_get_is_not_checked(api: httpx.AsyncClient):
    await register(api)
    res = await api.get("/api/v1/me", headers={"Origin": EVIL})
    assert res.status_code == 200


# --- Rate limit ---


def assert_429(res: httpx.Response) -> None:
    assert res.status_code == 429
    assert error_code(res) == "rate_limited"
    assert 1 <= int(res.headers["Retry-After"]) <= 3600


async def test_login_limited_per_ip_and_email(api: httpx.AsyncClient):
    for _ in range(5):
        res = await api.post(LOGIN, json=login_body(password="sai-mat-khau"))
        assert res.status_code == 401
    res = await api.post(LOGIN, json=login_body(password="sai-mat-khau"))
    assert_429(res)
    assert int(res.headers["Retry-After"]) <= 60
    # Khác hoa/thường vẫn là cùng email.
    assert_429(await api.post(LOGIN, json=login_body(email="BINH@example.com")))
    # Email khác từ cùng IP vẫn thử được (tới ngưỡng theo IP).
    assert (await api.post(LOGIN, json=login_body(email="khac@example.com"))).status_code == 401


async def test_login_limited_per_ip(api: httpx.AsyncClient):
    for i in range(10):
        res = await api.post(LOGIN, json=login_body(email=f"u{i}@example.com"))
        assert res.status_code == 401
    assert_429(await api.post(LOGIN, json=login_body(email="u99@example.com")))


async def test_register_limited_per_ip(api: httpx.AsyncClient):
    for i in range(5):
        await register(api, email=f"u{i}@example.com")
    res = await api.post(REGISTER, json=payload(email="u9@example.com"))
    assert_429(res)
    assert int(res.headers["Retry-After"]) > 60  # ngưỡng tính theo giờ


async def test_refresh_limited_per_ip(api: httpx.AsyncClient):
    for _ in range(30):
        res = await api.post("/api/v1/auth/refresh")
        assert res.status_code in (204, 401)
    assert_429(await api.post("/api/v1/auth/refresh"))


async def test_spoofed_cf_header_ignored_when_not_trusted(api: httpx.AsyncClient):
    """Chưa bật TRUST_CLOUDFLARE_IP: tự đặt CF-Connecting-IP không lách được rate limit."""
    for i in range(5):
        headers = {"CF-Connecting-IP": f"203.0.113.{i}"}
        await api.post(LOGIN, json=login_body(password="sai"), headers=headers)
    res = await api.post(LOGIN, json=login_body(), headers={"CF-Connecting-IP": "203.0.113.99"})
    assert_429(res)


async def test_cf_ip_used_when_trusted(api: httpx.AsyncClient, db: Session, trust_cloudflare):
    res = await api.post(REGISTER, json=payload(), headers={"CF-Connecting-IP": "203.0.113.7"})
    assert res.status_code == 201
    [session] = sessions_of(db, res.json()["id"])
    assert str(session.ip) == "203.0.113.7"

    # Mỗi IP thật có bộ đếm riêng.
    for _ in range(5):
        await api.post(
            LOGIN, json=login_body(password="sai"), headers={"CF-Connecting-IP": "203.0.113.1"}
        )
    blocked = {"CF-Connecting-IP": "203.0.113.1"}
    assert_429(await api.post(LOGIN, json=login_body(), headers=blocked))
    other = {"CF-Connecting-IP": "203.0.113.2"}
    res = await api.post(LOGIN, json=login_body(), headers=other)
    assert res.status_code == 200
    assert set_cookies(res)[ACCESS]


# --- client_ip ---


def make_request(headers: dict[str, str]) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
            "client": ("10.0.0.1", 1234),
        }
    )


def test_client_ip_ignores_cf_header_by_default():
    get_settings.cache_clear()
    assert client_ip(make_request({"CF-Connecting-IP": "203.0.113.7"})) == "10.0.0.1"


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("203.0.113.7", "203.0.113.7"),
        (" 2001:db8::1 ", "2001:db8::1"),
        ("rac", "10.0.0.1"),
        ("1.2.3.4, 5.6.7.8", "10.0.0.1"),
        ("", "10.0.0.1"),
    ],
)
def test_client_ip_trusts_cf_when_enabled(trust_cloudflare, header: str, expected: str):
    assert client_ip(make_request({"CF-Connecting-IP": header})) == expected


# --- Bộ đếm khi thiếu IP ---


def test_missing_key_is_not_counted_together(caplog):
    """IP không xác định: không gộp mọi request như vậy vào một bộ đếm chung."""
    from app.core import rate_limit

    for _ in range(50):
        rate_limit.hit(rate_limit.LOGIN_PER_IP, "login", None)
        rate_limit.hit(rate_limit.LOGIN_PER_IP_EMAIL, "login", None, "a@example.com")
    assert "a@example.com" not in caplog.text  # không ghi email vào log


def test_known_key_still_limited():
    from app.core import rate_limit

    for _ in range(10):
        rate_limit.hit(rate_limit.LOGIN_PER_IP, "login", "203.0.113.5")
    with pytest.raises(rate_limit.ApiError) as exc:
        rate_limit.hit(rate_limit.LOGIN_PER_IP, "login", "203.0.113.5")
    assert exc.value.status_code == 429
