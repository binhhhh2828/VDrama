from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.api.csrf import csrf_middleware
from app.core.config import get_settings
from app.core.db import DatabaseNotConfiguredError, dispose_engine
from app.core.errors import register_error_handlers
from app.core.request_context import request_context_middleware
from app.routers import admin_stream, auth, catalog, health, me, play, webhooks

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await dispose_engine()


# Caddy chuyển /api/* tới service này, nên mọi route nằm dưới /api.
app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/api/docs" if settings.env == "dev" else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.env == "dev" else None,
)

# Middleware thêm sau chạy ngoài cùng: request context bọc ngoài CSRF, nên phản hồi 403 của
# CSRF vẫn có X-Request-ID.
# Chặn request thay đổi dữ liệu đến từ trang lạ (kiểm tra Origin, xem app/api/csrf.py).
app.middleware("http")(csrf_middleware)
# Gán request_id cho mọi request (header X-Request-ID), dùng cho nhật ký và log.
app.middleware("http")(request_context_middleware)

app.include_router(health.router, prefix="/api")
# API nghiệp vụ có phiên bản: /api/v1/...
app.include_router(auth.router, prefix="/api/v1")
app.include_router(me.router, prefix="/api/v1")
app.include_router(catalog.router, prefix="/api/v1")
app.include_router(play.router, prefix="/api/v1")
app.include_router(admin_stream.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")

# Lỗi trả về dạng {"error": {"code", "message"}} (xem app/core/errors.py).
register_error_handlers(app)


@app.exception_handler(DatabaseNotConfiguredError)
async def database_not_configured(_: Request, __: DatabaseNotConfiguredError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "unavailable", "reason": "database not configured"},
    )
