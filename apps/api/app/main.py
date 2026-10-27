from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.db import DatabaseNotConfiguredError, dispose_engine
from app.core.request_context import request_context_middleware
from app.routers import health

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

# Gán request_id cho mọi request (header X-Request-ID), dùng cho nhật ký và log.
app.middleware("http")(request_context_middleware)

app.include_router(health.router, prefix="/api")


@app.exception_handler(DatabaseNotConfiguredError)
async def database_not_configured(_: Request, __: DatabaseNotConfiguredError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "unavailable", "reason": "database not configured"},
    )
