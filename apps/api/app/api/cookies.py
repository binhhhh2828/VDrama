"""Đặt/xóa cookie đăng nhập. Cả hai token đều trong cookie httpOnly (JavaScript không đọc được).

- Access: Path=/ . Khi Secure bật (prod) dùng tiền tố __Host- để trình duyệt cấm subdomain
  ghi đè cookie này.
- Refresh: Path=/api/v1/auth, trình duyệt chỉ gửi kèm khi gọi các endpoint auth. Sống bằng
  thời hạn phiên và được đặt lại mỗi lần refresh (đăng nhập trượt 30 ngày).
"""

from fastapi import Request, Response

from app.core.config import get_settings
from app.services.auth import IssuedSession

REFRESH_COOKIE = "vd_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def access_cookie_name() -> str:
    return "__Host-vd_access" if get_settings().cookie_secure else "vd_access"


def _flags() -> dict:
    return {"httponly": True, "secure": get_settings().cookie_secure, "samesite": "lax"}


def set_auth_cookies(response: Response, issued: IssuedSession) -> None:
    settings = get_settings()
    response.set_cookie(
        access_cookie_name(),
        issued.access_token,
        max_age=settings.access_token_ttl_minutes * 60,
        path="/",
        **_flags(),
    )
    if issued.refresh_token is None:
        return  # giữ nguyên cookie refresh đang có
    response.set_cookie(
        REFRESH_COOKIE,
        issued.refresh_token,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        **_flags(),
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(access_cookie_name(), path="/", **_flags())
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, **_flags())


def read_access_cookie(request: Request) -> str | None:
    return request.cookies.get(access_cookie_name())


def read_refresh_cookie(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE)
