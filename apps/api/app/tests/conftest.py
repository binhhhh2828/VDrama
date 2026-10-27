import asyncio
import os
from collections.abc import AsyncIterator, Callable

import httpx
import pytest
import pytest_asyncio

from app.core.config import get_settings
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
