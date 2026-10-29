"""Lịch sử xem: báo tiến độ (PUT /me/history/{episode_id})."""

import httpx
import pytest
from limits import parse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.models import Episode, Series, User, WatchHistory
from app.services.activity import record_progress
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
