"""Yêu thích: thêm/bỏ (xóa mềm), favorite_count, danh sách có con trỏ, trạng thái, quyền."""

import asyncio

import httpx
import pytest
from limits import parse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.models import Favorite, Series, SeriesStats
from app.models.soft_delete import INCLUDE_DELETED
from app.services.audit import Actor
from app.services.catalog import SeriesCursor
from app.services.soft_delete import soft_delete
from app.tests.test_auth_api import error_code
from app.tests.test_catalog_api import add_series
from app.tests.test_me_admin import signed_up

FAVORITES = "/api/v1/me/favorites"


def url(series: Series | int | str) -> str:
    series_id = series.id if isinstance(series, Series) else series
    return f"{FAVORITES}/{series_id}"


def favorite_count(db: Session, series: Series) -> int:
    db.expire_all()
    stmt = select(SeriesStats.favorite_count).where(SeriesStats.series_id == series.id)
    return db.scalar(stmt) or 0


def raw_favorites(db: Session, user_id: int) -> dict[int, bool]:
    """Mọi dòng trong DB (kể cả đã bỏ): series_id → đã xóa mềm."""
    db.expire_all()
    stmt = (
        select(Favorite)
        .where(Favorite.user_id == user_id)
        .execution_options(**{INCLUDE_DELETED: True})
    )
    return {f.series_id: f.is_deleted for f in db.scalars(stmt)}


async def favorited(api: httpx.AsyncClient, series: Series) -> bool:
    res = await api.get(url(series))
    assert res.status_code == 200, res.text
    return res.json()["favorited"]


async def listed(api: httpx.AsyncClient, **params) -> list[str]:
    res = await api.get(FAVORITES, params=params)
    assert res.status_code == 200, res.text
    return [s["slug"] for s in res.json()["items"]]


@pytest.fixture
def show(db: Session) -> Series:
    s = add_series(db, "nang-tho")
    db.commit()
    return s


# --- Thêm / bỏ ---


async def test_add_favorite(api: httpx.AsyncClient, db: Session, show: Series):
    user_id, _ = await signed_up(api)
    assert not await favorited(api, show)
    res = await api.put(url(show))
    assert res.status_code == 204 and res.content == b""
    assert await favorited(api, show)
    assert raw_favorites(db, user_id) == {show.id: False}
    assert favorite_count(db, show) == 1


async def test_add_twice_counts_once(api: httpx.AsyncClient, db: Session, show: Series):
    user_id, _ = await signed_up(api)
    for _ in range(3):
        assert (await api.put(url(show))).status_code == 204
    assert raw_favorites(db, user_id) == {show.id: False}
    assert favorite_count(db, show) == 1


async def test_concurrent_adds_count_once(api: httpx.AsyncClient, db: Session, show: Series):
    await signed_up(api)
    results = await asyncio.gather(*(api.put(url(show)) for _ in range(5)))
    assert [r.status_code for r in results] == [204] * 5
    assert favorite_count(db, show) == 1


async def test_remove_is_soft_and_idempotent(api: httpx.AsyncClient, db: Session, show: Series):
    user_id, _ = await signed_up(api)
    await api.put(url(show))
    for _ in range(2):
        assert (await api.delete(url(show))).status_code == 204
    # Người dùng thấy đã bỏ, hệ thống vẫn giữ dòng.
    assert not await favorited(api, show)
    assert await listed(api) == []
    assert raw_favorites(db, user_id) == {show.id: True}
    assert favorite_count(db, show) == 0


async def test_remove_without_favorite_does_not_go_negative(
    api: httpx.AsyncClient, db: Session, show: Series
):
    db.add(SeriesStats(series_id=show.id, favorite_count=0))
    db.commit()
    await signed_up(api)
    assert (await api.delete(url(show))).status_code == 204
    assert (await api.delete(url(999999))).status_code == 204  # phim không tồn tại: vẫn 204
    assert favorite_count(db, show) == 0


async def test_add_again_reuses_row_and_moves_to_top(
    api: httpx.AsyncClient, db: Session, show: Series
):
    other = add_series(db, "khac", days=1)
    db.commit()
    user_id, _ = await signed_up(api)
    await api.put(url(show))
    await api.put(url(other))
    assert await listed(api) == ["khac", "nang-tho"]
    await api.delete(url(show))
    await api.put(url(show))
    assert await listed(api) == ["nang-tho", "khac"]
    assert raw_favorites(db, user_id) == {show.id: False, other.id: False}
    assert favorite_count(db, show) == 1


async def test_count_across_users(api: httpx.AsyncClient, db: Session, show: Series):
    await signed_up(api)
    await api.put(url(show))
    api.cookies.clear()
    user2, _ = await signed_up(api, email="khac@example.com")
    assert not await favorited(api, show)  # trạng thái là của từng người
    await api.put(url(show))
    assert favorite_count(db, show) == 2
    await api.delete(url(show))
    assert favorite_count(db, show) == 1
    assert raw_favorites(db, user2) == {show.id: True}


async def test_existing_stats_row_kept(api: httpx.AsyncClient, db: Session, show: Series):
    db.add(SeriesStats(series_id=show.id, view_count=99, favorite_count=4))
    db.commit()
    await signed_up(api)
    await api.put(url(show))
    db.expire_all()
    stats = db.get(SeriesStats, show.id)
    assert (stats.view_count, stats.favorite_count) == (99, 5)


# --- Phim không xem được ---


@pytest.mark.parametrize("case", ["draft", "deleted", "missing"])
async def test_add_hidden_series_404(
    api: httpx.AsyncClient, db: Session, adb: AsyncSession, case: str
):
    target: int
    if case == "draft":
        target = add_series(db, "nhap", published=False).id
    elif case == "deleted":
        target = add_series(db, "xoa").id
    else:
        target = 999999
    db.commit()
    if case == "deleted":
        await soft_delete(adb, await adb.get(Series, target), actor=Actor.system(), reason="x")
        await adb.commit()
    user_id, _ = await signed_up(api)
    res = await api.put(url(target))
    assert res.status_code == 404
    assert error_code(res) == "not_found"
    assert raw_favorites(db, user_id) == {}


async def test_unpublished_later_hidden_but_kept(api: httpx.AsyncClient, db: Session, show: Series):
    user_id, _ = await signed_up(api)
    await api.put(url(show))
    db.execute(text("UPDATE series SET is_published = false WHERE id = :id"), {"id": show.id})
    db.commit()
    assert await listed(api) == []
    assert not await favorited(api, show)
    assert raw_favorites(db, user_id) == {show.id: False}
    db.execute(text("UPDATE series SET is_published = true WHERE id = :id"), {"id": show.id})
    db.commit()
    assert await listed(api) == ["nang-tho"]


# --- Danh sách, con trỏ ---


def set_favorited_at(db: Session, user_id: int, series: Series, iso: str) -> None:
    db.execute(
        text(
            "UPDATE favorites SET created_at = CAST(:t AS timestamptz) "
            "WHERE user_id = :u AND series_id = :s"
        ),
        {"t": iso, "u": user_id, "s": series.id},
    )
    db.commit()


async def test_pagination_covers_everything_once(api: httpx.AsyncClient, db: Session):
    shows = [add_series(db, f"phim-{i}", days=i) for i in range(7)]
    db.commit()
    user_id, _ = await signed_up(api)
    for s in shows:
        await api.put(url(s))
    # Thời điểm cố định, có hai cặp trùng giờ (thứ tự phụ thuộc id).
    times = ["2026-10-01", "2026-10-02", "2026-10-02", "2026-10-03", "2026-10-04"] + [
        "2026-10-04",
        "2026-10-05",
    ]
    for s, t in zip(shows, times, strict=True):
        set_favorited_at(db, user_id, s, t + "T00:00:00+00:00")
    seen, cursor = [], None
    for _ in range(10):
        body = (
            await api.get(FAVORITES, params={"limit": 2, **({"cursor": cursor} if cursor else {})})
        ).json()
        seen += [s["slug"] for s in body["items"]]
        cursor = body["next_cursor"]
        if cursor is None:
            break
    expected = ["phim-6", "phim-5", "phim-4", "phim-3", "phim-2", "phim-1", "phim-0"]
    assert seen == expected


async def test_list_item_is_series_card(api: httpx.AsyncClient, db: Session, show: Series):
    await signed_up(api)
    await api.put(url(show))
    body = (await api.get(FAVORITES)).json()
    assert body["next_cursor"] is None
    [card] = body["items"]
    assert card["id"] == show.id and card["slug"] == "nang-tho" and "genres" in card


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 51},
        {"cursor": "khong-hop-le"},
        # Con trỏ của danh sách phim mới không dùng được cho yêu thích.
        {"cursor": SeriesCursor(sort="new", value="2026-10-01T00:00:00+00:00", id=1).encode()},
        {"cursor": SeriesCursor(sort="favorites", value="khong-phai-ngay", id=1).encode()},
    ],
)
async def test_invalid_list_params_422(api: httpx.AsyncClient, params: dict):
    await signed_up(api)
    res = await api.get(FAVORITES, params=params)
    assert res.status_code == 422
    assert error_code(res) == "validation_error"


async def test_list_only_own(api: httpx.AsyncClient, db: Session, show: Series):
    await signed_up(api, email="khac@example.com")
    await api.put(url(show))
    api.cookies.clear()
    await signed_up(api)
    assert await listed(api) == []


# --- Trang chi tiết phim ---


async def test_series_detail_has_favorite_count(api: httpx.AsyncClient, db: Session, show: Series):
    assert (await api.get("/api/v1/series/nang-tho")).json()["favorite_count"] == 0
    await signed_up(api)
    await api.put(url(show))
    api.cookies.clear()
    assert (await api.get("/api/v1/series/nang-tho")).json()["favorite_count"] == 1


# --- Quyền, CSRF, dữ liệu vào, rate limit ---


async def test_requires_login(api: httpx.AsyncClient, show: Series):
    for method, path in (
        ("GET", FAVORITES),
        ("GET", url(show)),
        ("PUT", url(show)),
        ("DELETE", url(show)),
    ):
        res = await api.request(method, path)
        assert res.status_code == 401, (method, path)


async def test_foreign_origin_403(api: httpx.AsyncClient, db: Session, show: Series):
    user_id, _ = await signed_up(api)
    res = await api.put(url(show), headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    assert raw_favorites(db, user_id) == {}


@pytest.mark.parametrize("bad_id", ["0", "abc", str(2**63)])
async def test_invalid_id_422(api: httpx.AsyncClient, bad_id: str):
    await signed_up(api)
    for method in ("GET", "PUT", "DELETE"):
        assert (await api.request(method, url(bad_id))).status_code == 422, method


def test_favorite_limit_value():
    assert str(rate_limit.FAVORITE_PER_USER) == str(parse("60/minute"))


async def test_rate_limited(api: httpx.AsyncClient, show: Series, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(rate_limit, "FAVORITE_PER_USER", parse("3/minute"))
    await signed_up(api)
    for _ in range(3):
        assert (await api.put(url(show))).status_code == 204
    res = await api.delete(url(show))  # thêm và bỏ dùng chung bộ đếm
    assert res.status_code == 429
    assert (await api.get(FAVORITES)).status_code == 200  # đọc không bị giới hạn
