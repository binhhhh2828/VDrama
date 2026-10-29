"""Lịch sử xem: báo tiến độ (PUT /me/history/{episode_id})."""

import httpx
import pytest
from limits import parse
from sqlalchemy import select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.models import Episode, Series, User, WatchHistory
from app.models.soft_delete import INCLUDE_DELETED
from app.services.activity import continue_watching_stmt, record_progress
from app.services.audit import Actor
from app.services.soft_delete import soft_delete
from app.tests.test_auth_api import error_code
from app.tests.test_catalog_api import add_episode, add_series, become_admin
from app.tests.test_me_admin import signed_up
from app.tests.test_play_api import set_vip


def url(episode: Episode | int | str) -> str:
    episode_id = episode.id if isinstance(episode, Episode) else episode
    return f"/api/v1/me/history/{episode_id}"


def progress_of(db: Session, user_id: int) -> dict[int, int]:
    db.expire_all()
    rows = db.execute(
        select(WatchHistory.episode_id, WatchHistory.progress_sec).where(
            WatchHistory.user_id == user_id
        )
    )
    return {episode_id: progress for episode_id, progress in rows}


@pytest.fixture
def show(db: Session) -> tuple[Series, Episode, Episode]:
    """Tập 1 miễn phí (25 phút), tập 2 VIP."""
    s = add_series(db, "nang-tho")
    free = add_episode(db, s, 1, free=True, duration_sec=1500)
    vip = add_episode(db, s, 2, duration_sec=1500)
    db.commit()
    return s, free, vip


# --- Ghi tiến độ ---


async def test_report_progress(api: httpx.AsyncClient, db: Session, show):
    _, free, _ = show
    user_id, _ = await signed_up(api)
    res = await api.put(url(free), json={"progress_sec": 754})
    assert res.status_code == 204
    assert res.content == b""
    assert progress_of(db, user_id) == {free.id: 754}


async def test_repeated_reports_keep_one_row_latest_value(
    api: httpx.AsyncClient, db: Session, show
):
    _, free, _ = show
    user_id, _ = await signed_up(api)
    for progress in (15, 30, 45, 20):  # tua lại cũng ghi giá trị mới nhất
        assert (await api.put(url(free), json={"progress_sec": progress})).status_code == 204
    assert progress_of(db, user_id) == {free.id: 20}


async def test_progress_capped_at_duration(api: httpx.AsyncClient, db: Session, show):
    _, free, _ = show
    user_id, _ = await signed_up(api)
    await api.put(url(free), json={"progress_sec": 1600})
    assert progress_of(db, user_id) == {free.id: 1500}


async def test_unknown_duration_not_capped(api: httpx.AsyncClient, db: Session):
    s = add_series(db, "chua-ro")
    ep = add_episode(db, s, 1, free=True)  # duration_sec chưa có
    db.commit()
    user_id, _ = await signed_up(api)
    await api.put(url(ep), json={"progress_sec": 5000})
    assert progress_of(db, user_id) == {ep.id: 5000}


async def test_users_do_not_share_progress(api: httpx.AsyncClient, db: Session, show):
    _, free, _ = show
    first, _ = await signed_up(api)
    await api.put(url(free), json={"progress_sec": 100})
    api.cookies.clear()
    second, _ = await signed_up(api, email="khac@example.com")
    await api.put(url(free), json={"progress_sec": 900})
    assert progress_of(db, first) == {free.id: 100}
    assert progress_of(db, second) == {free.id: 900}


# --- Quyền: giống play ---


async def test_guest_401(api: httpx.AsyncClient, show):
    _, free, _ = show
    res = await api.put(url(free), json={"progress_sec": 10})
    assert res.status_code == 401
    assert error_code(res) == "not_authenticated"


async def test_vip_episode_requires_vip(api: httpx.AsyncClient, db: Session, show):
    _, _, vip = show
    user_id, _ = await signed_up(api)
    res = await api.put(url(vip), json={"progress_sec": 10})
    assert res.status_code == 403
    assert error_code(res) == "vip_required"
    set_vip(db, user_id, "-1 second")  # VIP hết hạn
    assert (await api.put(url(vip), json={"progress_sec": 10})).status_code == 403
    set_vip(db, user_id, "1 day")
    assert (await api.put(url(vip), json={"progress_sec": 10})).status_code == 204
    assert progress_of(db, user_id) == {vip.id: 10}


@pytest.mark.parametrize("case", ["unpublished_episode", "draft_series", "deleted", "missing"])
async def test_hidden_episode_404(
    api: httpx.AsyncClient, db: Session, adb: AsyncSession, show, case: str
):
    s, free, _ = show
    if case == "unpublished_episode":
        target = add_episode(db, s, 3, published=False, stream_status="ready", free=True).id
    elif case == "draft_series":
        target = add_episode(db, add_series(db, "nhap", published=False), 1, free=True).id
    elif case == "deleted":
        target = free.id
    else:
        target = 999999
    db.commit()
    if case == "deleted":
        await soft_delete(adb, await adb.get(Episode, free.id), actor=Actor.system(), reason="x")
        await adb.commit()
    user_id, _ = await signed_up(api)
    res = await api.put(url(target), json={"progress_sec": 10})
    assert res.status_code == 404
    assert progress_of(db, user_id) == {}


async def test_admin_can_report_on_preview(api: httpx.AsyncClient, db: Session):
    draft = add_series(db, "nhap", published=False)
    ep = add_episode(db, draft, 1, published=False, stream_status="processing")
    db.commit()
    await become_admin(api, db)
    assert (await api.put(url(ep), json={"progress_sec": 10})).status_code == 204


# --- Dữ liệu vào, CSRF, rate limit ---


@pytest.mark.parametrize(
    "body",
    [
        {"progress_sec": -1},
        {"progress_sec": 86401},
        {"progress_sec": "abc"},
        {},
        {"progress_sec": 10, "user_id": 1},
    ],
)
async def test_invalid_body_422(api: httpx.AsyncClient, show, body):
    _, free, _ = show
    await signed_up(api)
    assert (await api.put(url(free), json=body)).status_code == 422


@pytest.mark.parametrize("bad_id", ["0", "abc", str(2**63)])
async def test_invalid_id_422(api: httpx.AsyncClient, bad_id: str):
    await signed_up(api)
    assert (await api.put(url(bad_id), json={"progress_sec": 1})).status_code == 422


async def test_foreign_origin_403(api: httpx.AsyncClient, db: Session, show):
    _, free, _ = show
    user_id, _ = await signed_up(api)
    res = await api.put(
        url(free), json={"progress_sec": 10}, headers={"Origin": "https://evil.example"}
    )
    assert res.status_code == 403
    assert progress_of(db, user_id) == {}


def test_history_limit_value():
    assert str(rate_limit.HISTORY_PER_USER) == str(parse("30/minute"))


async def test_rate_limited_per_user(api: httpx.AsyncClient, show, monkeypatch: pytest.MonkeyPatch):
    _, free, _ = show
    monkeypatch.setattr(rate_limit, "HISTORY_PER_USER", parse("3/minute"))
    await signed_up(api)
    for _ in range(3):
        assert (await api.put(url(free), json={"progress_sec": 1})).status_code == 204
    res = await api.put(url(free), json={"progress_sec": 1})
    assert res.status_code == 429
    api.cookies.clear()
    await signed_up(api, email="khac@example.com")
    assert (await api.put(url(free), json={"progress_sec": 1})).status_code == 204


# --- Hiệu năng ghi ---


async def test_service_writes_are_hot_updates(adb: AsyncSession, db: Session, show):
    """Ghi qua service (đúng câu lệnh API dùng) vẫn là HOT update, không sửa index."""
    _, free, _ = show
    user = User(email="hot@example.com", password_hash="x", display_name="H")
    db.add(user)
    db.commit()
    user = await adb.get(User, user.id)
    await record_progress(adb, user, free.id, 0)
    for progress in range(15, 15 * 11, 15):
        await record_progress(adb, user, free.id, progress)
    upd, hot = (
        await adb.execute(
            text(
                "SELECT n_tup_upd, n_tup_hot_upd FROM pg_stat_xact_user_tables "
                "WHERE relname = 'watch_history'"
            )
        )
    ).one()
    assert upd == 10
    assert hot == upd
    await adb.rollback()


# --- Xem tiếp ---

HISTORY = "/api/v1/me/history"


def watched(db: Session, user_id: int, episode: Episode, progress: int, minutes_ago: int) -> None:
    """Ghi thẳng một dòng lịch sử với thời điểm cố định (thứ tự không phụ thuộc tốc độ test)."""
    db.execute(
        text(
            "INSERT INTO watch_history (user_id, episode_id, progress_sec, updated_at) "
            "VALUES (:u, :e, :p, now() - make_interval(mins => :m)) "
            "ON CONFLICT (user_id, episode_id) DO UPDATE "
            "SET progress_sec = EXCLUDED.progress_sec, updated_at = EXCLUDED.updated_at, "
            "deleted_at = NULL"
        ),
        {"u": user_id, "e": episode.id, "p": progress, "m": minutes_ago},
    )
    db.commit()


@pytest.fixture
def two_shows(db: Session) -> dict[str, Episode]:
    a = add_series(db, "phim-a")
    b = add_series(db, "phim-b")
    eps = {
        "a1": add_episode(db, a, 1, free=True, duration_sec=1500, title="A1"),
        "a2": add_episode(db, a, 2, free=True, duration_sec=1500),
        "b1": add_episode(db, b, 1, free=True, duration_sec=1500),
    }
    db.commit()
    return eps


async def items(api: httpx.AsyncClient, **params) -> list[tuple[str, int, int]]:
    res = await api.get(HISTORY, params=params)
    assert res.status_code == 200, res.text
    return [
        (i["series"]["slug"], i["episode"]["number"], i["progress_sec"])
        for i in res.json()["items"]
    ]


async def test_continue_one_row_per_series_newest_first(
    api: httpx.AsyncClient, db: Session, two_shows
):
    user_id, _ = await signed_up(api)
    watched(db, user_id, two_shows["a1"], 1400, minutes_ago=30)
    watched(db, user_id, two_shows["a2"], 300, minutes_ago=20)
    watched(db, user_id, two_shows["b1"], 100, minutes_ago=10)
    assert await items(api) == [("phim-b", 1, 100), ("phim-a", 2, 300)]
    # Xem lại tập 1 của phim A: phim A lên đầu, dòng của nó là tập 1.
    watched(db, user_id, two_shows["a1"], 50, minutes_ago=1)
    assert await items(api) == [("phim-a", 1, 50), ("phim-b", 1, 100)]


async def test_continue_item_fields(api: httpx.AsyncClient, db: Session, two_shows):
    user_id, _ = await signed_up(api)
    watched(db, user_id, two_shows["a1"], 754, minutes_ago=5)
    [item] = (await api.get(HISTORY)).json()["items"]
    assert set(item) == {"series", "episode", "progress_sec", "updated_at"}
    assert item["series"]["slug"] == "phim-a" and "genres" in item["series"]
    assert item["episode"]["id"] == two_shows["a1"].id
    assert item["episode"]["title"] == "A1" and item["episode"]["access"] == "free"
    assert item["episode"]["duration_sec"] == 1500
    assert "stream_video_id" not in str(item)


async def test_continue_limit(api: httpx.AsyncClient, db: Session, two_shows):
    user_id, _ = await signed_up(api)
    watched(db, user_id, two_shows["a1"], 1, minutes_ago=2)
    watched(db, user_id, two_shows["b1"], 1, minutes_ago=1)
    assert await items(api, limit=1) == [("phim-b", 1, 1)]
    for bad in (0, 51):
        assert (await api.get(HISTORY, params={"limit": bad})).status_code == 422


async def test_continue_hides_unpublished_and_deleted(
    api: httpx.AsyncClient, db: Session, adb: AsyncSession, two_shows
):
    user_id, _ = await signed_up(api)
    watched(db, user_id, two_shows["a1"], 10, minutes_ago=30)
    watched(db, user_id, two_shows["a2"], 20, minutes_ago=20)
    watched(db, user_id, two_shows["b1"], 30, minutes_ago=10)
    # Gỡ tập A2: phim A lùi về tập còn xem được gần nhất (A1).
    db.execute(
        text("UPDATE episodes SET is_published = false, published_at = NULL WHERE id = :id"),
        {"id": two_shows["a2"].id},
    )
    db.commit()
    assert await items(api) == [("phim-b", 1, 30), ("phim-a", 1, 10)]
    # Gỡ cả phim B, rồi xuất bản lại: dòng hiện lại (lịch sử không mất).
    db.execute(text("UPDATE series SET is_published = false WHERE slug = 'phim-b'"))
    db.commit()
    assert await items(api) == [("phim-a", 1, 10)]
    db.execute(text("UPDATE series SET is_published = true WHERE slug = 'phim-b'"))
    db.commit()
    assert await items(api) == [("phim-b", 1, 30), ("phim-a", 1, 10)]
    # Tập bị admin xóa mềm: ẩn.
    await soft_delete(
        adb, await adb.get(Episode, two_shows["b1"].id), actor=Actor.system(), reason="x"
    )
    await adb.commit()
    assert await items(api) == [("phim-a", 1, 10)]


async def test_continue_only_own_history(api: httpx.AsyncClient, db: Session, two_shows):
    other, _ = await signed_up(api, email="khac@example.com")
    watched(db, other, two_shows["a1"], 10, minutes_ago=1)
    api.cookies.clear()
    await signed_up(api)
    assert await items(api) == []


async def test_history_requires_login(api: httpx.AsyncClient):
    for method, path in (
        ("GET", HISTORY),
        ("GET", f"{HISTORY}/series/phim-a"),
        ("DELETE", HISTORY),
        ("DELETE", f"{HISTORY}/1"),
    ):
        assert (await api.request(method, path)).status_code == 401, (method, path)


def test_continue_query_uses_primary_key(db: Session):
    """Câu truy vấn thật của service lọc theo khóa chính (user_id, …), không quét cả bảng."""
    compiled = continue_watching_stmt(1).compile(dialect=postgresql.psycopg.dialect())
    conn = db.connection()
    conn.exec_driver_sql("SET LOCAL enable_seqscan = off")
    plan = "\n".join(
        r[0] for r in conn.exec_driver_sql("EXPLAIN " + str(compiled), compiled.params)
    )
    assert "pk_watch_history" in plan


# --- Tiến độ theo phim ---


async def test_series_progress(api: httpx.AsyncClient, db: Session, two_shows):
    user_id, _ = await signed_up(api)
    watched(db, user_id, two_shows["a2"], 300, minutes_ago=1)
    watched(db, user_id, two_shows["a1"], 1500, minutes_ago=5)
    watched(db, user_id, two_shows["b1"], 9, minutes_ago=2)  # phim khác: không lẫn vào
    res = await api.get(f"{HISTORY}/series/phim-a")
    assert res.status_code == 200
    body = res.json()["items"]
    assert [(i["episode_id"], i["number"], i["progress_sec"]) for i in body] == [
        (two_shows["a1"].id, 1, 1500),
        (two_shows["a2"].id, 2, 300),
    ]
    assert set(body[0]) == {"episode_id", "number", "progress_sec", "updated_at"}


async def test_series_progress_empty_and_404(api: httpx.AsyncClient, db: Session, two_shows):
    add_series(db, "nhap", published=False)
    db.commit()
    await signed_up(api)
    assert (await api.get(f"{HISTORY}/series/phim-a")).json() == {"items": []}
    for slug in ("nhap", "khong-co"):
        res = await api.get(f"{HISTORY}/series/{slug}")
        assert res.status_code == 404
        assert error_code(res) == "not_found"


async def test_series_progress_admin_preview(api: httpx.AsyncClient, db: Session):
    draft = add_series(db, "nhap", published=False)
    ep = add_episode(db, draft, 1, published=False, stream_status="processing")
    db.commit()
    await become_admin(api, db)
    assert (await api.put(url(ep), json={"progress_sec": 7})).status_code == 204
    body = (await api.get(f"{HISTORY}/series/nhap")).json()["items"]
    assert [(i["number"], i["progress_sec"]) for i in body] == [(1, 7)]


# --- Xóa lịch sử: người dùng thấy đã xóa, hệ thống xóa mềm ---


def raw_history(db: Session, user_id: int) -> dict[int, tuple[int, bool]]:
    """Mọi dòng trong DB của user (kể cả đã xóa mềm): episode_id → (tiến độ, đã xóa)."""
    db.expire_all()
    stmt = (
        select(WatchHistory)
        .where(WatchHistory.user_id == user_id)
        .execution_options(**{INCLUDE_DELETED: True})
    )
    return {h.episode_id: (h.progress_sec, h.is_deleted) for h in db.scalars(stmt)}


async def test_delete_one_episode(api: httpx.AsyncClient, db: Session, two_shows):
    user_id, _ = await signed_up(api)
    watched(db, user_id, two_shows["a1"], 10, minutes_ago=30)
    watched(db, user_id, two_shows["a2"], 20, minutes_ago=20)
    before = db.scalar(
        text("SELECT updated_at FROM watch_history WHERE episode_id = :e"),
        {"e": two_shows["a2"].id},
    )
    res = await api.delete(f"{HISTORY}/{two_shows['a2'].id}")
    assert res.status_code == 204
    # Người dùng không thấy nữa...
    assert await items(api) == [("phim-a", 1, 10)]
    progress = (await api.get(f"{HISTORY}/series/phim-a")).json()["items"]
    assert [i["number"] for i in progress] == [1]
    # ...nhưng hệ thống vẫn giữ, kể cả lần xem cuối.
    assert raw_history(db, user_id) == {
        two_shows["a1"].id: (10, False),
        two_shows["a2"].id: (20, True),
    }
    after = db.scalar(
        text("SELECT updated_at FROM watch_history WHERE episode_id = :e"),
        {"e": two_shows["a2"].id},
    )
    assert after == before
    # Gọi lại, hoặc xóa tập chưa từng xem / không tồn tại: vẫn 204.
    assert (await api.delete(f"{HISTORY}/{two_shows['a2'].id}")).status_code == 204
    assert (await api.delete(f"{HISTORY}/999999")).status_code == 204


async def test_delete_all_only_own(api: httpx.AsyncClient, db: Session, two_shows):
    other, _ = await signed_up(api, email="khac@example.com")
    watched(db, other, two_shows["a1"], 5, minutes_ago=1)
    api.cookies.clear()
    user_id, _ = await signed_up(api)
    watched(db, user_id, two_shows["a1"], 10, minutes_ago=2)
    watched(db, user_id, two_shows["b1"], 30, minutes_ago=1)
    assert (await api.delete(HISTORY)).status_code == 204
    assert await items(api) == []
    assert all(deleted for _, deleted in raw_history(db, user_id).values())
    assert raw_history(db, other) == {two_shows["a1"].id: (5, False)}
    assert (await api.delete(HISTORY)).status_code == 204


async def test_watching_again_after_delete(api: httpx.AsyncClient, db: Session, two_shows):
    user_id, _ = await signed_up(api)
    await api.put(url(two_shows["a1"]), json={"progress_sec": 10})
    await api.delete(HISTORY)
    assert await items(api) == []
    await api.put(url(two_shows["a1"]), json={"progress_sec": 40})
    assert await items(api) == [("phim-a", 1, 40)]
    assert raw_history(db, user_id) == {two_shows["a1"].id: (40, False)}


async def test_delete_foreign_origin_403(api: httpx.AsyncClient, db: Session, two_shows):
    user_id, _ = await signed_up(api)
    watched(db, user_id, two_shows["a1"], 10, minutes_ago=1)
    res = await api.delete(HISTORY, headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    assert raw_history(db, user_id) == {two_shows["a1"].id: (10, False)}
