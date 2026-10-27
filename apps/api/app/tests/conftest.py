import asyncio
import os
import uuid
from collections.abc import AsyncIterator, Callable, Iterator
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.core.config import get_settings, to_psycopg_url
from app.core.db import dispose_engine
from app.main import app


def pytest_asyncio_loop_factories(config, item):
    # psycopg async cần SelectorEventLoop (Windows mặc định là Proactor).
    return {"selector": asyncio.SelectorEventLoop}


@pytest.fixture
def test_db_url() -> str:
    """URL Postgres cho test cần DB. Bỏ qua (có thông báo) khi chưa đặt; CI luôn đặt."""
    url = os.environ.get("TEST_DATABASE_URL", "")
    if not url:
        pytest.skip("TEST_DATABASE_URL chưa đặt: bỏ qua test cần Postgres")
    return url


@pytest_asyncio.fixture
async def set_database_url(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[Callable[[str], None]]:
    """Trỏ app sang một DATABASE_URL khác, dọn cache engine/settings trước và sau test."""

    async def reset() -> None:
        await dispose_engine()
        get_settings.cache_clear()

    await reset()

    def _set(url: str) -> None:
        monkeypatch.setenv("DATABASE_URL", url)
        get_settings.cache_clear()

    yield _set
    await reset()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


API_DIR = Path(__file__).resolve().parents[2]


def alembic_config() -> Config:
    return Config(str(API_DIR / "alembic.ini"))


@pytest.fixture
def empty_db_url(test_db_url: str) -> Iterator[str]:
    """Một database tạm hoàn toàn trống, tạo mới cho mỗi test và xóa sau đó.

    Cần quyền CREATEDB (user của Postgres trong compose/CI có sẵn).
    """
    base = make_url(to_psycopg_url(test_db_url))
    name = f"vdrama_test_{uuid.uuid4().hex[:12]}"
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    try:
        yield base.set(database=name).render_as_string(hide_password=False)
    finally:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture
def migration_env(empty_db_url: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[str]:
    """Trỏ Alembic (env.py đọc settings) sang database tạm. Trả về URL của nó."""
    monkeypatch.setenv("DATABASE_URL_DIRECT", empty_db_url)
    get_settings.cache_clear()
    yield empty_db_url
    get_settings.cache_clear()


@pytest.fixture
def migrated_db_url(migration_env: str) -> str:
    """Database tạm đã chạy `upgrade head`."""
    command.upgrade(alembic_config(), "head")
    return migration_env
