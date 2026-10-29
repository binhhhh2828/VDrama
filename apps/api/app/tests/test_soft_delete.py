"""Xóa mềm (migration 0008): dòng bị ẩn chứ không mất, mọi truy vấn ORM tự lọc,
DB chặn xóa thật, service xóa/khôi phục đúng hành vi đã chốt trong plan."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models import (
    Episode,
    Favorite,
    Genre,
    Payment,
    PaymentEvent,
    Series,
    Subscription,
    User,
    UserSession,
    VipPlan,
    WatchHistory,
)
from app.models.enums import PaymentStatus
from app.models.soft_delete import INCLUDE_DELETED
from app.services.audit import Actor
from app.services.soft_delete import get_including_deleted, restore, soft_delete
from app.tests.conftest import hard_delete

NOW = datetime.now(UTC)


def make_user(db, email="xoa@example.com") -> User:
    u = User(email=email, password_hash="x", display_name="X")
    db.add(u)
    return u


def mark_deleted(db: Session, obj) -> None:
    obj.deleted_at = NOW
    db.flush()


# --- bộ lọc tự động -----------------------------------------------------------


def make_each(db: Session) -> dict[type, object]:
    user = make_user(db)
    series = Series(slug="s", title="Phim")
    genre = Genre(slug="g", name="Thể loại")
    plan = VipPlan(name="Gói", price_vnd=1, duration_days=1)
    db.add_all([series, genre, plan])
    db.flush()
    ep = Episode(series_id=series.id, number=1)
    db.add(ep)
    db.flush()
    return {User: user, Series: series, Genre: genre, VipPlan: plan, Episode: ep}


@pytest.mark.parametrize("model", [User, Series, Genre, VipPlan, Episode])
def test_deleted_rows_hidden_from_orm_queries(db: Session, model):
    obj = make_each(db)[model]
    db.commit()
    obj_id = obj.id  # lưu trước: sau expunge_all đối tượng rời phiên, không đọc lại được
    assert db.scalar(select(model).where(model.id == obj_id)) is not None

    mark_deleted(db, obj)
    db.commit()
    db.expunge_all()  # bỏ bản đã nạp trong phiên, buộc truy vấn lại DB

    assert db.scalar(select(model).where(model.id == obj_id)) is None
    assert obj_id not in db.scalars(select(model.id)).all()
    assert db.get(model, obj_id) is None
    # Admin / thùng rác vẫn thấy được
    found = db.scalar(
        select(model).where(model.id == obj_id).execution_options(**{INCLUDE_DELETED: True})
    )
    assert found is not None and found.is_deleted


def test_deleted_row_still_in_database(db: Session):
    s = Series(slug="con-day", title="Vẫn còn")
    db.add(s)
    db.flush()
    mark_deleted(db, s)
    db.commit()
    # SQL thật: dòng vẫn nằm trong bảng
    assert db.scalar(text("SELECT count(*) FROM series WHERE slug = 'con-day'")) == 1


def test_deleted_genre_hidden_in_relationship(db: Session):
    s = Series(slug="s", title="Phim")
    keep, gone = Genre(slug="giu", name="Giữ"), Genre(slug="an", name="Ẩn")
    s.genres.extend([keep, gone])
    db.add(s)
    db.flush()
    mark_deleted(db, gone)
    db.commit()
    db.expunge_all()

    loaded = db.scalar(select(Series).where(Series.slug == "s"))
    assert [g.slug for g in loaded.genres] == ["giu"]


def test_search_and_listing_skip_deleted(db: Session):
    from app.services.search import series_search_condition

    a, b = Series(slug="a", title="Nàng Thơ"), Series(slug="b", title="Nàng Tiên")
    db.add_all([a, b])
    db.flush()
    mark_deleted(db, b)
    db.commit()
    db.expunge_all()
    titles = db.scalars(select(Series.title).where(series_search_condition("nang"))).all()
    assert titles == ["Nàng Thơ"]


def test_unique_kept_for_deleted_rows(db: Session):
    """Slug của phim đã xóa vẫn giữ chỗ, để khôi phục luôn thành công (quyết định đã chốt)."""
    s = Series(slug="giu-cho", title="A")
    db.add(s)
    db.flush()
    mark_deleted(db, s)
    db.add(Series(slug="giu-cho", title="B"))
    with pytest.raises(IntegrityError, match="uq_series_slug"):
        db.flush()


# --- chặn xóa thật ------------------------------------------------------------

GUARDED = [
    "users",
    "series",
    "episodes",
    "genres",
    "vip_plans",
    "payments",
    "subscriptions",
    "payment_events",
    # Dữ liệu người dùng tự xóa (migration 0011): người dùng thấy đã xóa, hệ thống vẫn giữ.
    "watch_history",
    "favorites",
]


@pytest.fixture
def one_row_each(db: Session) -> None:
    """Một dòng trong mỗi bảng được bảo vệ (trigger theo dòng chỉ chạy khi có dòng bị xóa)."""
    rows = make_each(db)
    user, plan = rows[User], rows[VipPlan]
    db.add(WatchHistory(user_id=user.id, episode_id=rows[Episode].id, progress_sec=1))
    db.add(Favorite(user_id=user.id, series_id=rows[Series].id))
    event = PaymentEvent(provider="sepay", event_id="tx-1", payload={})
    db.add(event)
    db.flush()
    payment = Payment(
        user_id=user.id,
        plan_id=plan.id,
        provider="sepay",
        provider_order_id="VD1",
        amount_vnd=1,
        expires_at=NOW,
        status=PaymentStatus.PAID,
        paid_at=NOW,
        paid_event_id=event.id,
    )
    db.add(payment)
    db.flush()
    db.add(
        Subscription(
            user_id=user.id,
            plan_id=plan.id,
            payment_id=payment.id,
            starts_at=NOW,
            expires_at=NOW + timedelta(days=1),
        )
    )
    db.commit()


@pytest.mark.parametrize("table", GUARDED)
def test_hard_delete_blocked(db: Session, one_row_each, table: str):
    assert db.scalar(text(f"SELECT count(*) FROM {table}")) >= 1
    with pytest.raises(IntegrityError, match="hard_delete_blocked"):
        db.execute(text(f"DELETE FROM {table}"))


@pytest.mark.parametrize("table", GUARDED)
def test_truncate_blocked(db: Session, table: str):
    with pytest.raises(IntegrityError, match="hard_delete_blocked"):
        db.execute(text(f"TRUNCATE {table} CASCADE"))


def test_maintenance_flag_allows_hard_delete(db: Session):
    g = Genre(slug="tam", name="Tạm")
    db.add(g)
    db.commit()
    hard_delete(db, "genres", g.id)
    db.commit()
    assert db.scalar(text("SELECT count(*) FROM genres")) == 0


def test_maintenance_flag_does_not_leak_to_next_transaction(db: Session):
    g = Genre(slug="tam", name="Tạm")
    db.add(g)
    db.commit()
    db.execute(text("SET LOCAL vdrama.allow_hard_delete = 'on'"))
    db.commit()  # SET LOCAL hết hiệu lực khi transaction kết thúc
    with pytest.raises(IntegrityError, match="hard_delete_blocked"):
        db.execute(text("DELETE FROM genres WHERE id = :id"), {"id": g.id})


# --- service xóa / khôi phục (async, như code ứng dụng) -------------------------


async def test_soft_delete_and_restore_series(adb: AsyncSession):
    admin = make_user(adb, "admin@example.com")
    s = Series(slug="phim", title="Phim")
    adb.add(s)
    await adb.flush()

    assert await soft_delete(adb, s, actor=Actor.admin(admin.id), reason="Đăng nhầm") is True
    await adb.commit()
    assert s.deleted_by_id == admin.id
    assert (await adb.execute(select(Series).where(Series.id == s.id))).scalar() is None

    again = await soft_delete(adb, s, actor=Actor.admin(admin.id), reason="Đăng nhầm")
    assert again is False  # xóa lần hai không làm gì

    found = await get_including_deleted(adb, Series, s.id)
    assert found is not None
    assert await restore(adb, found, actor=Actor.admin(admin.id), reason="Xóa nhầm") is True
    await adb.commit()
    adb.expunge_all()
    back = (await adb.execute(select(Series).where(Series.id == s.id))).scalar()
    assert back is not None and back.deleted_at is None and back.deleted_by_id is None


async def test_deleting_user_revokes_all_sessions(adb: AsyncSession):
    user = make_user(adb)
    await adb.flush()
    later = NOW + timedelta(days=30)
    adb.add_all(
        UserSession(user_id=user.id, refresh_token_hash=f"h{i}", expires_at=later) for i in range(3)
    )
    await adb.flush()

    await soft_delete(adb, user, actor=Actor.system(), reason="Tài khoản vi phạm")
    await adb.commit()

    active = await adb.scalar(
        select(func.count()).select_from(UserSession).where(UserSession.revoked_at.is_(None))
    )
    total = await adb.scalar(select(func.count()).select_from(UserSession))
    assert active == 0
    assert total == 3  # dòng phiên vẫn giữ để truy vết


async def test_restore_not_deleted_is_noop(adb: AsyncSession):
    s = Series(slug="phim", title="Phim")
    adb.add(s)
    await adb.flush()
    assert await restore(adb, s, actor=Actor.system(), reason="Thử") is False
