"""Lệnh seed-demo: dữ liệu mẫu đủ trường hợp, chạy lại không trùng, không chạy ở prod."""

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AuditLog, Episode, Genre, Series, User, VipPlan
from app.models.soft_delete import INCLUDE_DELETED
from app.services import demo_seed
from app.services.demo_seed import ACCOUNTS, SERIES, DemoSeedRefusedError, seed_demo
from app.tests import stream_keys

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
        "PUBLIC_ORIGIN": "https://vdrama.com",
        "TRUST_CLOUDFLARE_IP": "true",
        **stream_keys.stream_env(),
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

    found = (await api.get("/api/v1/search", params={"q": "city"})).json()["items"]
    assert [s["slug"] for s in found] == ["virtual-city"]

    detail = (await api.get("/api/v1/series/virtual-city")).json()
    assert detail["title"] == "Virtual City" and detail["genres"][0]["name"] == "Romance"
    eps = (await api.get("/api/v1/series/virtual-city/episodes")).json()
    assert eps[0]["title"] == "Episode 1"


async def test_soft_delete_of_demo_series_is_logged(adb: AsyncSession):
    await seed_demo(adb)
    await adb.commit()
    actions = list((await adb.execute(select(AuditLog.action))).scalars())
    assert actions == ["series.delete"]


DEMO_PASSWORD = "demo-pass-123"


async def test_no_password_skips_accounts(adb: AsyncSession):
    result = await seed_demo(adb)
    await adb.commit()
    assert result.accounts_skipped_no_password and result.accounts_created == 0
    assert await count(adb, User) == 0
    assert result.plans_created == len(demo_seed.PLANS)


async def test_password_too_short_refused(adb: AsyncSession):
    with pytest.raises(DemoSeedRefusedError):
        await seed_demo(adb, password="short")
    assert await count(adb, Series) == 0


async def test_demo_accounts_roles_and_vip(api: httpx.AsyncClient, adb: AsyncSession):
    first = await seed_demo(adb, password=DEMO_PASSWORD)
    await adb.commit()
    assert first.accounts_created == len(ACCOUNTS)

    second = await seed_demo(adb, password=DEMO_PASSWORD)
    await adb.commit()
    assert second.accounts_created == 0 and second.plans_created == 0
    assert await count(adb, User) == len(ACCOUNTS)
    assert await count(adb, VipPlan) == len(demo_seed.PLANS)

    expected = {
        "viewer@example.com": ("user", False),
        "vip@example.com": ("user", True),
        "admin@example.com": ("admin", False),
    }
    for email, (role, vip) in expected.items():
        api.cookies.clear()
        res = await api.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
        assert res.status_code == 200, email
        me = (await api.get("/api/v1/me")).json()
        assert (me["role"], me["is_vip"]) == (role, vip), email

    # Cấp admin và VIP đi qua service có nhật ký, như thao tác thật.
    actions = set((await adb.execute(select(AuditLog.action))).scalars())
    assert {"users.create_admin", "subscriptions.grant_vip"} <= actions


def test_cli_seed_demo(migrated_db_url: str, db: Session, monkeypatch, capsys):
    from app.cli import main

    monkeypatch.setenv("DATABASE_URL", migrated_db_url)
    monkeypatch.setenv("DEMO_PASSWORD", DEMO_PASSWORD)
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
    users = db.scalar(select(func.count()).select_from(User))
    assert users == len(ACCOUNTS)
    assert DEMO_PASSWORD not in capsys.readouterr().out  # không in mật khẩu ra màn hình
