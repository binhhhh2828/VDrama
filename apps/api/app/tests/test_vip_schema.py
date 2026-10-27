"""Ràng buộc DB và index của nhóm VIP & thanh toán.

Đây là phần dính tới tiền, nên các quy tắc chống cộng VIP hai lần / xử lý webhook trùng
được kiểm tra thẳng ở tầng DB.
"""

from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Payment, PaymentEvent, Subscription, User, VipPlan
from app.tests.conftest import alembic_config

NOW = datetime.now(UTC)


@pytest.fixture
def user(db: Session) -> User:
    u = User(email="vip@example.com", password_hash="x", display_name="V")
    db.add(u)
    db.flush()
    return u


@pytest.fixture
def plan(db: Session) -> VipPlan:
    p = VipPlan(name="VIP 1 tháng", price_vnd=49_000, duration_days=30)
    db.add(p)
    db.flush()
    return p


def make_event(db: Session, event_id: str = "sepay-1") -> PaymentEvent:
    """Giả lập một giao dịch ngân hàng SePay đã ghi nhận."""
    ev = PaymentEvent(provider="sepay", event_id=event_id, payload={"transferAmount": 49000})
    db.add(ev)
    db.flush()
    return ev


def make_payment(db: Session, user: User, plan: VipPlan, order: str = "VD-1", **kw) -> Payment:
    kw.setdefault("amount_vnd", plan.price_vnd)
    kw.setdefault("expires_at", NOW + timedelta(minutes=15))
    # Đơn đã thanh toán phải gắn giao dịch thật (ck_payments_paid_requires_event).
    if kw.get("status") in ("paid", "refunded") and "paid_event_id" not in kw:
        kw["paid_event_id"] = make_event(db, f"sepay-{order}").id
    p = Payment(user_id=user.id, plan_id=plan.id, provider="sepay", provider_order_id=order, **kw)
    db.add(p)
    db.flush()
    return p


def make_subscription(db: Session, user: User, plan: VipPlan, **kw) -> Subscription:
    kw.setdefault("starts_at", NOW)
    kw.setdefault("expires_at", NOW + timedelta(days=plan.duration_days))
    s = Subscription(user_id=user.id, plan_id=plan.id, **kw)
    db.add(s)
    db.flush()
    return s


def explain(db: Session, sql: str, **params) -> str:
    db.execute(text("SET LOCAL enable_seqscan = off"))
    db.execute(text("SET LOCAL enable_bitmapscan = off"))
    return "\n".join(r[0] for r in db.execute(text(f"EXPLAIN {sql}"), params))


# --- vip_plans --------------------------------------------------------------


@pytest.mark.parametrize(
    ("kw", "constraint"),
    [
        ({"price_vnd": 0}, "ck_vip_plans_price_positive"),
        ({"duration_days": 0}, "ck_vip_plans_duration_positive"),
    ],
)
def test_plan_checks(db: Session, kw: dict, constraint: str):
    db.add(VipPlan(**{"name": "X", "price_vnd": 1, "duration_days": 1, **kw}))
    with pytest.raises(IntegrityError, match=constraint):
        db.flush()


# --- payments ---------------------------------------------------------------


def test_payment_defaults_to_pending(db: Session, user: User, plan: VipPlan):
    p = make_payment(db, user, plan)
    db.refresh(p)
    assert p.status == "pending" and p.paid_at is None


def test_provider_order_id_unique(db: Session, user: User, plan: VipPlan):
    make_payment(db, user, plan, "VD-1")
    with pytest.raises(IntegrityError, match="uq_payments_provider_order_id"):
        make_payment(db, user, plan, "VD-1")


@pytest.mark.parametrize(
    ("kw", "constraint"),
    [
        ({"amount_vnd": 0}, "ck_payments_amount_positive"),
        ({"status": "success"}, "ck_payments_status"),
        ({"status": "paid"}, "ck_payments_paid_at_set"),  # paid mà thiếu paid_at
        ({"status": "refunded"}, "ck_payments_paid_at_set"),
    ],
)
def test_payment_checks(db: Session, user: User, plan: VipPlan, kw: dict, constraint: str):
    with pytest.raises(IntegrityError, match=constraint):
        make_payment(db, user, plan, **kw)


def test_raw_payload_stored_as_jsonb(db: Session, user: User, plan: VipPlan):
    payload = {"resultCode": 0, "message": "Thành công", "amount": 49000}
    p = make_payment(db, user, plan, raw_payload=payload)
    db.commit()
    db.expire_all()
    assert db.get(Payment, p.id).raw_payload == payload
    found = db.scalar(select(Payment.id).where(Payment.raw_payload["resultCode"].as_integer() == 0))
    assert found == p.id


def test_pending_sweep_uses_partial_index(db: Session):
    plan = explain(
        db,
        "SELECT id FROM payments WHERE status = 'pending' AND expires_at < :now",
        now=NOW,
    )
    assert "ix_payments_pending" in plan


# --- subscriptions ----------------------------------------------------------


def test_one_payment_grants_vip_once(db: Session, user: User, plan: VipPlan):
    """Webhook gửi lại nhiều lần cũng chỉ tạo được một subscription cho một payment."""
    pay = make_payment(db, user, plan, status="paid", paid_at=NOW)
    make_subscription(db, user, plan, payment_id=pay.id)
    with pytest.raises(IntegrityError, match="uq_subscriptions_payment_id"):
        make_subscription(db, user, plan, payment_id=pay.id)


def test_manual_grants_without_payment_allowed(db: Session, user: User, plan: VipPlan):
    """Admin tặng VIP thủ công: payment_id NULL, được phép nhiều lần."""
    make_subscription(db, user, plan)
    make_subscription(
        db, user, plan, starts_at=NOW + timedelta(days=30), expires_at=NOW + timedelta(days=60)
    )


@pytest.mark.parametrize(
    ("kw", "constraint"),
    [
        ({"status": "paused"}, "ck_subscriptions_status"),
        ({"expires_at": NOW}, "ck_subscriptions_period_valid"),
        ({"expires_at": NOW - timedelta(days=1)}, "ck_subscriptions_period_valid"),
    ],
)
def test_subscription_checks(db: Session, user: User, plan: VipPlan, kw: dict, constraint: str):
    with pytest.raises(IntegrityError, match=constraint):
        make_subscription(db, user, plan, **kw)


def test_current_vip_lookup_uses_index(db: Session):
    plan = explain(
        db,
        "SELECT max(expires_at) FROM subscriptions WHERE user_id = :uid AND status = 'active'",
        uid=1,
    )
    assert "ix_subscriptions_user_id_expires_at" in plan


# --- payment_events ---------------------------------------------------------


def test_duplicate_webhook_event_rejected(db: Session):
    db.add(PaymentEvent(provider="momo", event_id="evt-1", payload={"a": 1}))
    db.flush()
    db.add(PaymentEvent(provider="vnpay", event_id="evt-1", payload={"a": 1}))  # khác cổng: được
    db.flush()
    db.add(PaymentEvent(provider="momo", event_id="evt-1", payload={"a": 2}))
    with pytest.raises(IntegrityError, match="uq_payment_events_provider_event_id"):
        db.flush()


# --- xóa --------------------------------------------------------------------


def test_cannot_delete_user_with_payments(db: Session, user: User, plan: VipPlan):
    make_payment(db, user, plan)
    db.commit()
    with pytest.raises(IntegrityError, match="fk_payments_user_id_users"):
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user.id})


def test_cannot_delete_user_with_subscriptions(db: Session, user: User, plan: VipPlan):
    make_subscription(db, user, plan)
    db.commit()
    with pytest.raises(IntegrityError, match="fk_subscriptions_user_id_users"):
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user.id})


def test_cannot_delete_plan_in_use(db: Session, user: User, plan: VipPlan):
    """Gói cũ không bán nữa thì tắt is_active, không xóa."""
    make_payment(db, user, plan)
    db.commit()
    with pytest.raises(IntegrityError, match="fk_payments_plan_id_vip_plans"):
        db.execute(text("DELETE FROM vip_plans WHERE id = :id"), {"id": plan.id})


def test_cannot_delete_payment_that_granted_vip(db: Session, user: User, plan: VipPlan):
    pay = make_payment(db, user, plan, status="paid", paid_at=NOW)
    make_subscription(db, user, plan, payment_id=pay.id)
    db.commit()
    with pytest.raises(IntegrityError, match="fk_subscriptions_payment_id_payments"):
        db.execute(text("DELETE FROM payments WHERE id = :id"), {"id": pay.id})


# --- migration --------------------------------------------------------------


def test_downgrade_to_0004_drops_vip_tables(migrated_db_url: str, db: Session):
    db.close()
    command.downgrade(alembic_config(), "0004")
    tables = set(inspect(db.get_bind()).get_table_names())
    assert not {"vip_plans", "payments", "subscriptions", "payment_events"} & tables
    assert "series" in tables  # các nhóm trước vẫn còn
