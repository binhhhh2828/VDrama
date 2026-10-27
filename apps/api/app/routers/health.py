import logging

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.db import DbSession

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness: không đụng DB, dùng cho UptimeRobot / healthcheck container."""
    return {"status": "ok"}


@router.get("/health/db")
async def health_db(response: Response, db: DbSession) -> dict[str, str]:
    """Readiness: kiểm tra kết nối DB. Chưa cấu hình DB thì handler chung trả 503."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("DB health check failed")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "reason": "database unreachable"}
    return {"status": "ok"}
