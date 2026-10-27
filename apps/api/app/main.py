from fastapi import FastAPI

from app.core.config import get_settings
from app.routers import health

settings = get_settings()

# Caddy chuyển /api/* tới service này, nên mọi route nằm dưới /api.
app = FastAPI(
    title=settings.app_name,
    docs_url="/api/docs" if settings.env == "dev" else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.env == "dev" else None,
)

app.include_router(health.router, prefix="/api")
