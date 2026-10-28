"""Lệnh seed-demo: dữ liệu mẫu đủ trường hợp, chạy lại không trùng, không chạy ở prod."""

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AuditLog, Episode, Genre, Series
from app.models.soft_delete import INCLUDE_DELETED
from app.services import demo_seed
from app.services.demo_seed import SERIES, DemoSeedRefusedError, seed_demo

PUBLIC = [s for s in SERIES if s.published and not s.deleted]


async def count(adb: AsyncSession, model) -> int:
    stmt = select(func.count()).select_from(model).execution_options(**{INCLUDE_DELETED: True})
    return await adb.scalar(stmt)


async def test_seed_twice_creates_nothing_new(adb: AsyncSession):
    first = await seed_demo(adb)
    await adb.commit()
    assert first.series_created == len(SERIES) and first.series_skipped == 0
    assert first.genres_created == len(demo_seed.GENRES)
    totals = (await count(adb, Series), await count(adb, Episode), await count(adb, Genre))

    second = await seed_demo(adb)
    await adb.commit()
    assert second.series_created == 0 and second.genres_created == 0
    assert second.series_skipped == len(SERIES)
    assert (await count(adb, Series), await count(adb, Episode), await count(adb, Genre)) == totals


async def test_refused_in_prod(adb: AsyncSession, monkeypatch):
    for key, value in {
        "ENV": "prod",
        "JWT_SECRET": "x" * 32,
        "PUBLIC_ORIGIN": "https://vdrama.vn",
        "TRUST_CLOUDFLARE_IP": "true",
    }.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    try:
        with pytest.raises(DemoSeedRefusedError):
            await seed_demo(adb)
    finally:
        get_settings.cache_clear()
    assert await count(adb, Series) == 0


async def test_seeded_catalog_covers_cases(api: httpx.AsyncClient, adb: AsyncSession):
    await seed_demo(adb)
    await adb.commit()

    async def all_slugs(**params) -> list[str]:
        body = (await api.get("/api/v1/series", params={"limit": 50, **params})).json()
        return [s["slug"] for s in body["items"]]

    listed = await all_slugs()
    assert set(listed) == {s.slug for s in PUBLIC}  # không có phim nháp, phim đã xóa
    assert set(await all_slugs(with_banner="true")) == {s.slug for s in PUBLIC if s.banner}

    hot = await all_slugs(sort="hot")
    assert hot[0] == max(PUBLIC, key=lambda s: s.views).slug

    genres = (await api.get("/api/v1/genres")).json()
    assert {g["slug"] for g in genres} == {slug for slug, _ in demo_seed.GENRES}

    # Phim có tập cuối chưa xuất bản: danh sách tập bỏ tập đó, tập đầu miễn phí, sau là VIP.
    drafty = next(s for s in PUBLIC if s.draft_last_episode)
    eps = (await api.get(f"/api/v1/series/{drafty.slug}/episodes")).json()
    assert [e["number"] for e in eps] == list(range(1, drafty.episodes))
    assert [e["access"] for e in eps[:3]] == ["free", "free", "vip"]

    draft = next(s for s in SERIES if not s.published)
    assert (await api.get(f"/api/v1/series/{draft.slug}")).status_code == 404
    gone = next(s for s in SERIES if s.deleted)
    assert (await api.get(f"/api/v1/series/{gone.slug}")).status_code == 404

    found = (await api.get("/api/v1/search", params={"q": "hen uoc"})).json()["items"]
    assert [s["slug"] for s in found] == ["hen-uoc-mua-thu"]


async def test_soft_delete_of_demo_series_is_logged(adb: AsyncSession):
    await seed_demo(adb)
    await adb.commit()
    actions = list((await adb.execute(select(AuditLog.action))).scalars())
    assert actions == ["series.delete"]


def test_cli_seed_demo(migrated_db_url: str, db: Session, monkeypatch):
    from app.cli import main

    monkeypatch.setenv("DATABASE_URL", migrated_db_url)
    get_settings.cache_clear()
    try:
        assert main(["seed-demo"]) == 0
        assert main(["seed-demo"]) == 0  # chạy lại vẫn thành công, không trùng
    finally:
        get_settings.cache_clear()
    total = db.scalar(
        select(func.count()).select_from(Series).execution_options(**{INCLUDE_DELETED: True})
    )
    assert total == len(SERIES)
