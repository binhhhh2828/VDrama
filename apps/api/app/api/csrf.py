"""Chống CSRF bằng kiểm tra Origin (web và API cùng một domain nên không cần CSRF token).

Với request thay đổi dữ liệu (POST/PUT/PATCH/DELETE):
- Có header Origin (hoặc Referer khi thiếu Origin) mà khác PUBLIC_ORIGIN: 403. Áp dụng cả khi
  chưa có cookie, để trang lạ không đăng nhập/đăng ký hộ người dùng (login CSRF).
- Không có Origin/Referer nhưng có cookie đăng nhập: 403. Trình duyệt luôn gửi Origin cho POST,
  nên thiếu nó mà vẫn mang cookie là bất thường.
- Không có Origin/Referer, không có cookie (curl, webhook thanh toán): cho qua.

Cookie SameSite=Lax đã chặn phần lớn trường hợp; đây là lớp thứ hai.
"""

from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from app.api.cookies import REFRESH_COOKIE
from app.core.config import get_settings
from app.core.errors import ErrorCode, error_body

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
AUTH_COOKIES = ("__Host-vd_access", "vd_access", REFRESH_COOKIE)


def _origin_of(url: str) -> str | None:
    parts = urlsplit(url)
    if not parts.scheme or not parts.netloc:
        return None
    return f"{parts.scheme}://{parts.netloc}".lower()


def request_origin(request: Request) -> str | None:
    origin = request.headers.get("origin")
    if origin and origin != "null":
        return origin.rstrip("/").lower()
    if origin == "null":
        return "null"  # trang sandbox/file://: không bao giờ hợp lệ
    referer = request.headers.get("referer")
    return _origin_of(referer) if referer else None


def _rejected() -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content=error_body(ErrorCode.FORBIDDEN, "Yêu cầu bị từ chối vì không đến từ trang VDrama."),
    )


async def csrf_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    if request.method in UNSAFE_METHODS:
        origin = request_origin(request)
        if origin is not None:
            if origin != get_settings().public_origin.lower():
                return _rejected()
        elif any(name in request.cookies for name in AUTH_COOKIES):
            return _rejected()
    return await call_next(request)
