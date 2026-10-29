"""Định dạng lỗi thống nhất cho mọi API nghiệp vụ.

    {"error": {"code": "invalid_credentials", "message": "Email hoặc mật khẩu không đúng."}}

`code` cố định để frontend xử lý theo; `message` tiếng Việt để hiển thị. Lỗi validate (422)
kèm thêm `fields`. Endpoint ném lỗi bằng `ApiError(...)`, không tự dựng JSON lỗi.
"""

import logging
from enum import StrEnum
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ErrorCode(StrEnum):
    # Chung
    BAD_REQUEST = "bad_request"
    VALIDATION_ERROR = "validation_error"
    NOT_AUTHENTICATED = "not_authenticated"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    METHOD_NOT_ALLOWED = "method_not_allowed"
    CONFLICT = "conflict"
    RATE_LIMITED = "rate_limited"
    INTERNAL_ERROR = "internal_error"
    # Auth
    INVALID_CREDENTIALS = "invalid_credentials"
    ACCOUNT_DISABLED = "account_disabled"
    EMAIL_TAKEN = "email_taken"
    SESSION_EXPIRED = "session_expired"
    VIP_REQUIRED = "vip_required"
    # Xem phim
    VIDEO_NOT_READY = "video_not_ready"
    STREAM_UNAVAILABLE = "stream_unavailable"
    STREAM_PROVIDER_ERROR = "stream_provider_error"


# Lỗi HTTP chung (route không tồn tại, sai method...) đổi về code + câu tiếng Việt.
_GENERIC: dict[int, tuple[ErrorCode, str]] = {
    400: (ErrorCode.BAD_REQUEST, "Yêu cầu không hợp lệ."),
    401: (ErrorCode.NOT_AUTHENTICATED, "Bạn cần đăng nhập."),
    403: (ErrorCode.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này."),
    404: (ErrorCode.NOT_FOUND, "Không tìm thấy."),
    405: (ErrorCode.METHOD_NOT_ALLOWED, "Phương thức không được hỗ trợ."),
    409: (ErrorCode.CONFLICT, "Dữ liệu bị xung đột."),
    429: (ErrorCode.RATE_LIMITED, "Bạn thao tác quá nhanh, vui lòng thử lại sau."),
}
_INTERNAL = (ErrorCode.INTERNAL_ERROR, "Đã có lỗi xảy ra, vui lòng thử lại sau.")


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        message: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(code.value)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers


def error_body(code: ErrorCode, message: str, **extra: Any) -> dict[str, Any]:
    return {"error": {"code": code.value, "message": message, **extra}}


def _field_errors(exc: RequestValidationError) -> list[dict[str, str]]:
    fields = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", ())]
        if loc and loc[0] in ("body", "query", "path", "header", "cookie"):
            loc = loc[1:]
        # Chỉ trả vị trí và lý do; không trả lại giá trị đã gửi (có thể là mật khẩu).
        fields.append({"field": ".".join(loc), "type": err.get("type", ""), "message": err["msg"]})
    return fields


async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message),
        headers=exc.headers,
    )


async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, message = _GENERIC.get(exc.status_code, _INTERNAL)
    if exc.status_code < 500 and exc.status_code not in _GENERIC:
        code, message = ErrorCode.BAD_REQUEST, _GENERIC[400][1]
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, message),
        headers=getattr(exc, "headers", None),
    )


async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=error_body(
            ErrorCode.VALIDATION_ERROR, "Dữ liệu không hợp lệ.", fields=_field_errors(exc)
        ),
    )


def internal_error_response() -> JSONResponse:
    """500 đúng định dạng, không lộ chi tiết lỗi (chi tiết chỉ nằm trong log)."""
    return JSONResponse(status_code=500, content=error_body(*_INTERNAL))


async def _unhandled_error(_: Request, exc: Exception) -> JSONResponse:
    # Dự phòng: lỗi trong route đã được middleware request context bắt (để 500 có X-Request-ID);
    # tới được đây chỉ khi lỗi xảy ra ngoài middleware đó.
    logger.exception("Unhandled error", exc_info=exc)
    return internal_error_response()


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, _http_error)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_error)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _unhandled_error)
