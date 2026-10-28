"""Mã request (request_id) và thông tin request hiện tại, dùng chung cho nhật ký và log.

Middleware gán mỗi request một request_id (nhận từ header X-Request-ID nếu hợp lệ, không thì
tự sinh) và trả lại trong header phản hồi. Nhật ký thao tác (audit_logs), log ứng dụng và Sentry
dùng cùng mã này để nối các nguồn khi truy vết.

IP: lấy qua app/core/client_ip.py (đọc CF-Connecting-IP khi chạy sau Cloudflare).
"""

import logging
import re
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from dataclasses import dataclass

from fastapi import Request, Response

from app.core.client_ip import client_ip
from app.core.errors import internal_error_response

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


@dataclass(frozen=True)
class RequestInfo:
    request_id: str | None = None
    ip: str | None = None
    user_agent: str | None = None


_EMPTY = RequestInfo()
_current: ContextVar[RequestInfo | None] = ContextVar("request_info", default=None)


def current_request() -> RequestInfo:
    """Thông tin request đang xử lý (rỗng khi chạy ngoài request: job, lệnh CLI, test)."""
    return _current.get() or _EMPTY


def _pick_request_id(incoming: str | None) -> str:
    if incoming and _VALID_REQUEST_ID.match(incoming):
        return incoming
    return uuid.uuid4().hex


async def request_context_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    info = RequestInfo(
        request_id=_pick_request_id(request.headers.get(REQUEST_ID_HEADER)),
        ip=client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:500] or None,
    )
    token = _current.set(info)
    try:
        response = await call_next(request)
    except Exception:
        # Bắt ở đây (không để handler 500 ngoài cùng xử lý) để phản hồi 500 vẫn có X-Request-ID:
        # đó là lúc người dùng cần mã này nhất để báo lỗi, và log có cùng mã để tra.
        logger.exception("Unhandled error (request_id=%s)", info.request_id)
        response = internal_error_response()
    finally:
        _current.reset(token)
    response.headers[REQUEST_ID_HEADER] = info.request_id or ""
    return response
