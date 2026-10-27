from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

# Tên constraint ổn định để Alembic autogenerate/downgrade không lỗi.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class DatabaseNotConfiguredError(RuntimeError):
    pass


@lru_cache
def get_engine() -> AsyncEngine:
    """Tạo lười: import module không kết nối DB."""
    settings = get_settings()
    if not settings.database_url:
        raise DatabaseNotConfiguredError("DATABASE_URL chưa được cấu hình")
    return create_async_engine(
        settings.app_db_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_pre_ping=True,  # chịu được DB (Neon) ngắt kết nối nhàn rỗi
        # Tắt prepared statement phía client để an toàn với PgBouncer (pooler của Neon).
        connect_args={
            "prepare_threshold": None,
            "connect_timeout": settings.db_connect_timeout,
        },
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency. Sau này thêm get_db_ro cho read replica mà không sửa chỗ khác."""
    async with get_sessionmaker()() as session:
        yield session


async def dispose_engine() -> None:
    if get_engine.cache_info().currsize:
        await get_engine().dispose()
    get_sessionmaker.cache_clear()
    get_engine.cache_clear()


DbSession = Annotated[AsyncSession, Depends(get_db)]
