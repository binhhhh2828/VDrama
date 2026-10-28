"""Catalog công khai: thể loại, danh sách phim mới, lọc, phân trang keyset."""

import base64
import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import insert, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models import Episode, Genre, Series, SeriesStats, series_genres
from app.services.audit import Actor
from app.services.catalog import SeriesCursor, series_list_stmt
from app.services.soft_delete import soft_delete
from app.tests.test_auth_api import error_code
from app.tests.test_me_admin import signed_up

BASE = datetime(2026, 10, 1, tzinfo=UTC)


def add_series(db: Session, slug: str, *, days: int = 0, published: bool = True, **kw) -> Series:
    s = Series(
        slug=slug,
        title=kw.pop("title", slug.replace("-", " ").title()),
        is_published=published,
        published_at=BASE + timedelta(days=days) if published else None,
        **kw,
    )
    db.add(s)
    db.flush()
    return s


def add_genre(db: Session, slug: str, name: str, *series: Series) -> Genre:
    g = Genre(slug=slug, name=name)
    db.add(g)
    db.flush()
    for s in series:
        db.execute(insert(series_genres).values(series_id=s.id, genre_id=g.id))
    return g


async def slugs(api: httpx.AsyncClient, **params) -> list[str]:
    res = await api.get("/api/v1/series", params=params)
    assert res.status_code == 200, res.text
    return [s["slug"] for s in res.json()["items"]]


async def all_pages(api: httpx.AsyncClient, **params) -> list[str]:
    seen, cursor = [], None
    for _ in range(50):
        query = {**params, **({"cursor": cursor} if cursor else {})}
        body = (await api.get("/api/v1/series", params=query)).json()
        seen += [s["slug"] for s in body["items"]]
        cursor = body["next_cursor"]
        if cursor is None:
            return seen
    raise AssertionError("phân trang không kết thúc")


# --- Thể loại ---


async def test_genres_sorted_and_hide_deleted(api: httpx.AsyncClient, db: Session, adb):
    add_genre(db, "tinh-cam", "Tình cảm")
    add_genre(db, "hai", "Hài")
    gone = add_genre(db, "cu", "Cũ")
    db.commit()
    await soft_delete(adb, await adb.get(Genre, gone.id), actor=Actor.system(), reason="test")
    await adb.commit()

    res = await api.get("/api/v1/genres")
    assert res.status_code == 200
    assert res.json() == [{"slug": "hai", "name": "Hài"}, {"slug": "tinh-cam", "name": "Tình cảm"}]


# --- Danh sách phim mới ---


async def test_new_list_only_published_newest_first(api: httpx.AsyncClient, db: Session):
    add_series(db, "cu", days=1)
    add_series(db, "moi", days=3)
    add_series(db, "giua", days=2)
    add_series(db, "nhap", published=False)
    db.commit()
    assert await slugs(api) == ["moi", "giua", "cu"]


async def test_card_fields(api: httpx.AsyncClient, db: Session):
    s = add_series(db, "nang-tho", title="Nàng Thơ", year=2026, poster_url="https://x/p.jpg")
    add_genre(db, "tinh-cam", "Tình cảm", s)
    db.commit()
    [card] = (await api.get("/api/v1/series")).json()["items"]
    assert card["title"] == "Nàng Thơ" and card["year"] == 2026
    assert card["genres"] == [{"slug": "tinh-cam", "name": "Tình cảm"}]
    assert set(card) == {
        "id",
        "slug",
        "title",
        "poster_url",
        "banner_url",
        "year",
        "country",
        "status",
        "total_episodes",
        "published_at",
        "genres",
    }


async def test_deleted_series_hidden(api: httpx.AsyncClient, db: Session, adb: AsyncSession):
    add_series(db, "con", days=1)
    gone = add_series(db, "xoa", days=2)
    db.commit()
    await soft_delete(adb, await adb.get(Series, gone.id), actor=Actor.system(), reason="test")
    await adb.commit()
    assert await slugs(api) == ["con"]


async def test_admin_sees_only_published_in_list(api: httpx.AsyncClient, db: Session):
    """Danh sách công khai không lộ phim chưa xuất bản, kể cả khi admin gọi."""
    add_series(db, "nhap", published=False)
    db.commit()
    user_id, _ = await signed_up(api)  # client giữ cookie đăng nhập
    db.execute(text("UPDATE users SET role = 'admin' WHERE id = :id"), {"id": user_id})
    db.commit()
    assert await slugs(api) == []


# --- Lọc ---


async def test_filter_by_genre(api: httpx.AsyncClient, db: Session, adb: AsyncSession):
    a, b, c = (add_series(db, slug, days=i) for i, slug in enumerate(["a", "b", "c"]))
    add_genre(db, "hai", "Hài", a, c)
    gone = add_genre(db, "cu", "Cũ", b)
    db.commit()
    assert await slugs(api, genre="hai") == ["c", "a"]
    assert await slugs(api, genre="khong-co") == []

    await soft_delete(adb, await adb.get(Genre, gone.id), actor=Actor.system(), reason="test")
    await adb.commit()
    assert await slugs(api, genre="cu") == []  # thể loại đã xóa: lọc theo nó trả rỗng
    [card] = (await api.get("/api/v1/series", params={"genre": "hai", "limit": 1})).json()["items"]
    assert card["slug"] == "c"


async def test_deleted_genre_not_listed_on_card(
    api: httpx.AsyncClient, db: Session, adb: AsyncSession
):
    s = add_series(db, "a")
    add_genre(db, "hai", "Hài", s)
    gone = add_genre(db, "cu", "Cũ", s)
    db.commit()
    await soft_delete(adb, await adb.get(Genre, gone.id), actor=Actor.system(), reason="test")
    await adb.commit()
    [card] = (await api.get("/api/v1/series")).json()["items"]
    assert card["genres"] == [{"slug": "hai", "name": "Hài"}]


async def test_with_banner(api: httpx.AsyncClient, db: Session):
    add_series(db, "co-banner", days=2, banner_url="https://x/b.jpg")
    add_series(db, "rong", days=3, banner_url="")
    add_series(db, "khong", days=1)
    db.commit()
    assert await slugs(api, with_banner="true") == ["co-banner"]


# --- Phân trang ---


async def test_pagination_covers_everything_once(api: httpx.AsyncClient, db: Session):
    for i in range(7):
        add_series(db, f"s{i}", days=i)
    db.commit()
    assert await all_pages(api, limit=3) == [f"s{i}" for i in range(6, -1, -1)]


async def test_pagination_ties_on_published_at(api: httpx.AsyncClient, db: Session):
    """Nhiều phim cùng giờ xuất bản: id phân định thứ tự, không trùng/sót."""
    ids = [add_series(db, f"t{i}", days=0).id for i in range(5)]
    db.commit()
    expected = [f"t{i}" for i in sorted(range(5), key=lambda i: ids[i], reverse=True)]
    assert await all_pages(api, limit=2) == expected


async def test_pagination_stable_when_new_series_published(api: httpx.AsyncClient, db: Session):
    for i in range(4):
        add_series(db, f"s{i}", days=i)
    db.commit()
    page1 = (await api.get("/api/v1/series", params={"limit": 2})).json()
    add_series(db, "moi-chen", days=10)  # xuất bản giữa chừng
    db.commit()
    page2 = (
        await api.get("/api/v1/series", params={"limit": 2, "cursor": page1["next_cursor"]})
    ).json()
    got = [s["slug"] for s in page1["items"] + page2["items"]]
    assert got == ["s3", "s2", "s1", "s0"]
    assert page2["next_cursor"] is None


async def test_last_page_has_no_cursor(api: httpx.AsyncClient, db: Session):
    for i in range(2):
        add_series(db, f"s{i}", days=i)
    db.commit()
    body = (await api.get("/api/v1/series", params={"limit": 2})).json()
    assert len(body["items"]) == 2 and body["next_cursor"] is None


def _cursor(payload) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


@pytest.mark.parametrize(
    "params",
    [
        {"cursor": "rac!!"},
        {"cursor": _cursor({"s": "new", "v": "khong-phai-ngay", "i": 1})},
        {"cursor": _cursor({"s": "hot", "v": BASE.isoformat(), "i": 1})},  # sai kiểu sắp xếp
        {"cursor": _cursor({"x": 1})},
        {"cursor": _cursor([1, 2])},
        {"limit": 0},
        {"limit": 51},
        {"sort": "abc"},
    ],
)
async def test_invalid_params_422(api: httpx.AsyncClient, params: dict):
    res = await api.get("/api/v1/series", params=params)
    assert res.status_code == 422
    assert error_code(res) == "validation_error"
    field = next(iter(params))
    assert field in [f["field"] for f in res.json()["error"]["fields"]]


def test_cursor_roundtrip():
    c = SeriesCursor(sort="new", value=BASE.isoformat(), id=42)
    assert SeriesCursor.decode(c.encode(), sort="new") == c


def test_list_query_uses_published_index(db: Session):
    """Câu truy vấn thật của service (trang sau, có con trỏ) dùng index ix_series_published."""
    stmt = series_list_stmt(cursor=SeriesCursor(sort="new", value=BASE.isoformat(), id=10))
    compiled = stmt.compile(dialect=postgresql.psycopg.dialect())
    conn = db.connection()
    conn.exec_driver_sql("SET LOCAL enable_seqscan = off")
    conn.exec_driver_sql("SET LOCAL enable_bitmapscan = off")
    plan = "\n".join(
        r[0] for r in conn.exec_driver_sql("EXPLAIN " + str(compiled), compiled.params)
    )
    assert "ix_series_published" in plan


# --- Chi tiết phim và danh sách tập ---


def add_episode(
    db: Session, series: Series, number: int, *, published: bool = True, free: bool = False, **kw
) -> Episode:
    ep = Episode(
        series_id=series.id,
        number=number,
        is_free=free,
        stream_video_id=f"vid-{series.slug}-{number}",
        stream_status="ready" if published else kw.pop("stream_status", "processing"),
        is_published=published,
        published_at=BASE if published else None,
        **kw,
    )
    db.add(ep)
    db.flush()
    return ep


async def become_admin(api: httpx.AsyncClient, db: Session) -> None:
    user_id, _ = await signed_up(api, email="admin@example.com")  # client giữ cookie
    db.execute(text("UPDATE users SET role = 'admin' WHERE id = :id"), {"id": user_id})
    db.commit()


async def test_series_detail(api: httpx.AsyncClient, db: Session):
    s = add_series(db, "nang-tho", title="Nàng Thơ", description="Mô tả")
    add_genre(db, "tinh-cam", "Tình cảm", s)
    add_episode(db, s, 1, free=True)
    add_episode(db, s, 2)
    add_episode(db, s, 3, published=False)  # chưa xuất bản: không tính
    db.add(SeriesStats(series_id=s.id, view_count=123))
    db.commit()

    res = await api.get("/api/v1/series/nang-tho")
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Nàng Thơ" and body["description"] == "Mô tả"
    assert body["genres"] == [{"slug": "tinh-cam", "name": "Tình cảm"}]
    assert body["episode_count"] == 2 and body["latest_episode_number"] == 2
    assert body["view_count"] == 123 and body["is_published"] is True


async def test_series_detail_without_episodes_or_stats(api: httpx.AsyncClient, db: Session):
    add_series(db, "trong")
    db.commit()
    body = (await api.get("/api/v1/series/trong")).json()
    assert body["episode_count"] == 0
    assert body["latest_episode_number"] is None and body["view_count"] == 0


async def test_episodes_sorted_only_published(api: httpx.AsyncClient, db: Session, adb):
    s = add_series(db, "a")
    for n in (3, 1, 2):
        add_episode(db, s, n, free=(n == 1), title=f"Tập {n}", duration_sec=1500)
    add_episode(db, s, 4, published=False)
    gone = add_episode(db, s, 5)
    db.commit()
    await soft_delete(adb, await adb.get(Episode, gone.id), actor=Actor.system(), reason="test")
    await adb.commit()

    res = await api.get("/api/v1/series/a/episodes")
    assert res.status_code == 200
    eps = res.json()
    assert [e["number"] for e in eps] == [1, 2, 3]
    assert [e["access"] for e in eps] == ["free", "vip", "vip"]
    assert eps[0]["title"] == "Tập 1" and eps[0]["duration_sec"] == 1500
    assert all(e["is_published"] for e in eps)
    assert "stream_video_id" not in eps[0] and "vid-" not in res.text


@pytest.mark.parametrize("path", ["/api/v1/series/{slug}", "/api/v1/series/{slug}/episodes"])
async def test_hidden_series_404(api: httpx.AsyncClient, db: Session, adb, path: str):
    """Chưa xuất bản, đã xóa, không tồn tại: 404 cho khách; tập của chúng cũng không lộ ra."""
    draft = add_series(db, "nhap", published=False)
    add_episode(db, draft, 1)  # tập đã xuất bản nhưng series thì chưa
    gone = add_series(db, "xoa")
    add_episode(db, gone, 1)
    db.commit()
    await soft_delete(adb, await adb.get(Series, gone.id), actor=Actor.system(), reason="test")
    await adb.commit()

    for slug in ("nhap", "xoa", "khong-co"):
        res = await api.get(path.format(slug=slug))
        assert res.status_code == 404, slug
        assert error_code(res) == "not_found"


async def test_logged_in_user_cannot_preview(api: httpx.AsyncClient, db: Session):
    add_series(db, "nhap", published=False)
    db.commit()
    await signed_up(api)
    assert (await api.get("/api/v1/series/nhap")).status_code == 404


async def test_admin_previews_unpublished(api: httpx.AsyncClient, db: Session):
    draft = add_series(db, "nhap", published=False)
    add_episode(db, draft, 1)
    add_episode(db, draft, 2, published=False)
    db.commit()
    await become_admin(api, db)

    detail = (await api.get("/api/v1/series/nhap")).json()
    assert detail["is_published"] is False and detail["episode_count"] == 1
    eps = (await api.get("/api/v1/series/nhap/episodes")).json()
    assert [(e["number"], e["is_published"]) for e in eps] == [(1, True), (2, False)]


async def test_admin_cannot_see_deleted_via_public_api(
    api: httpx.AsyncClient, db: Session, adb: AsyncSession
):
    gone = add_series(db, "xoa")
    db.commit()
    await soft_delete(adb, await adb.get(Series, gone.id), actor=Actor.system(), reason="test")
    await adb.commit()
    await become_admin(api, db)
    assert (await api.get("/api/v1/series/xoa")).status_code == 404


async def test_slug_too_long_422(api: httpx.AsyncClient):
    res = await api.get("/api/v1/series/" + "a" * 201)
    assert res.status_code == 422
