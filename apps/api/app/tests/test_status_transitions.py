"""Trạng thái payments/subscriptions chỉ đi theo sơ đồ (trigger migration 0007), trường tiền bị khóa
sau khi đơn rời `pending`, và đơn không thể `paid` nếu thiếu giao dịch ngân hàng thật.

Đáp án lấy từ PAYMENT_TRANSITIONS / SUBSCRIPTION_TRANSITIONS trong app/models/enums.py,
nên trigger trong DB và code luôn phải khớp nhau.
"""

import itertools
import re
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Payment, PaymentEvent, Subscription, User, VipPlan
from app.models.enums import (
    PAYMENT_TRANSITIONS,
    SUBSCRIPTION_TRANSITIONS,
    EmailTokenPurpose,
    PaymentFailureCode,
    PaymentStatus,
    SeriesStatus,
    StreamStatus,
    SubscriptionStatus,
    UserRole,
)

NOW = datetime.now(UTC)
_counter = itertools.count(1)


@pytest.fixture
def user(db: Session) -> User:
    u = User(email="trangthai@example.com", password_hash="x", display_name="T")
    db.add(u)
    db.flush()
    return u


@pytest.fixture
def plan(db: Session) -> VipPlan:
    p = VipPlan(name="VIP 1 tháng", price_vnd=49_000, duration_days=30)
    db.add(p)
    db.flush()
    return p


def make_event(db: Session) -> PaymentEvent:
    ev = PaymentEvent(provider="sepay", event_id=f"tx-{next(_counter)}", payload={"ok": True})
    db.add(ev)
    db.flush()
    return ev


def fields_for(db: Session, status: PaymentStatus) -> dict[str, Any]:
    """Các trường bắt buộc đi kèm từng trạng thái (theo CHECK constraint)."""
    if status in (PaymentStatus.PAID, PaymentStatus.REFUNDED):
        return {"paid_event_id": make_event(db).id, "paid_at": NOW}
    if status == PaymentStatus.FAILED:
        return {"failure_code": PaymentFailureCode.AMOUNT_MISMATCH}
    return {}


def make_payment(db: Session, user: User, plan: VipPlan, status=PaymentStatus.PENDING, **kw):
    kw = {**fields_for(db, status), **kw}
    p = Payment(
        user_id=user.id,
        plan_id=plan.id,
        provider="sepay",
        provider_order_id=f"VD{next(_counter)}",
        amount_vnd=plan.price_vnd,
        expires_at=NOW + timedelta(minutes=15),
        status=status,
        **kw,
    )
    db.add(p)
    db.flush()
    return p


def make_subscription(db: Session, user: User, plan: VipPlan, status=SubscriptionStatus.ACTIVE):
    s = Subscription(
        user_id=user.id,
        plan_id=plan.id,
        starts_at=NOW,
        expires_at=NOW + timedelta(days=30),
        status=status,
    )
    db.add(s)
    db.flush()
    return s


# --- sơ đồ chuyển trạng thái ------------------------------------------------


@pytest.mark.parametrize(
    ("old", "new"), [(a, b) for a in PaymentStatus for b in PaymentStatus if a != b]
)
def test_payment_transitions(db: Session, user: User, plan: VipPlan, old, new):
    p = make_payment(db, user, plan, status=old)
    # Chuẩn bị trường đi kèm TRƯỚC khi đổi trạng thái: fields_for có flush (tạo giao dịch),
    # nếu đổi status trước thì autoflush ghi status thiếu trường đi kèm.
    extra = fields_for(db, new) if old == PaymentStatus.PENDING else {}
    p.status = new
    for k, v in extra.items():
        setattr(p, k, v)
    if new in PAYMENT_TRANSITIONS[old]:
        db.flush()
        db.refresh(p)
        assert p.status == new
    else:
        with pytest.raises(IntegrityError, match="payments_status_transition"):
            db.flush()


@pytest.mark.parametrize(
    ("old", "new"),
    [(a, b) for a in SubscriptionStatus for b in SubscriptionStatus if a != b],
)
def test_subscription_transitions(db: Session, user: User, plan: VipPlan, old, new):
    s = make_subscription(db, user, plan, status=old)
    s.status = new
    if new in SUBSCRIPTION_TRANSITIONS[old]:
        db.flush()
        db.refresh(s)
        assert s.status == new
    else:
        with pytest.raises(IntegrityError, match="subscriptions_status_transition"):
            db.flush()


def test_terminal_states_have_no_exit():
    terminal = [s for s, nxt in PAYMENT_TRANSITIONS.items() if not nxt]
    assert set(terminal) == {PaymentStatus.FAILED, PaymentStatus.EXPIRED, PaymentStatus.REFUNDED}
    assert not SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.EXPIRED]
    assert not SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.CANCELLED]


# --- chặn "đã thanh toán" giả ------------------------------------------------


def test_paid_without_bank_transaction_rejected(db: Session, user: User, plan: VipPlan):
    """Kể cả admin sửa tay cũng không thể có đơn paid mà không có giao dịch thật."""
    p = make_payment(db, user, plan)
    p.status = PaymentStatus.PAID
    p.paid_at = NOW
    with pytest.raises(IntegrityError, match="ck_payments_paid_requires_event"):
        db.flush()


def test_paid_without_bank_transaction_rejected_by_raw_sql(db: Session, user: User, plan: VipPlan):
    p = make_payment(db, user, plan)
    db.commit()
    with pytest.raises(IntegrityError, match="ck_payments_paid_requires_event"):
        db.execute(
            text("UPDATE payments SET status = 'paid', paid_at = now() WHERE id = :id"),
            {"id": p.id},
        )


def test_one_bank_transaction_pays_one_order(db: Session, user: User, plan: VipPlan):
    ev = make_event(db)
    make_payment(db, user, plan, status=PaymentStatus.PAID, paid_event_id=ev.id)
    with pytest.raises(IntegrityError, match="uq_payments_paid_event_id"):
        make_payment(db, user, plan, status=PaymentStatus.PAID, paid_event_id=ev.id)


# --- khóa trường tiền -------------------------------------------------------


@pytest.mark.parametrize(
    "change",
    [
        {"amount_vnd": 1_000},
        {"plan_id": None},  # thay bằng gói khác trong test
        {"paid_at": NOW + timedelta(days=1)},
        {"paid_event_id": None},  # thay bằng giao dịch khác trong test
    ],
)
def test_money_fields_locked_after_paid(db: Session, user: User, plan: VipPlan, change):
    p = make_payment(db, user, plan, status=PaymentStatus.PAID)
    if "plan_id" in change:
        other = VipPlan(name="Khác", price_vnd=1, duration_days=1)
        db.add(other)
        db.flush()
        change = {"plan_id": other.id}
    if "paid_event_id" in change:
        change = {"paid_event_id": make_event(db).id}
    for k, v in change.items():
        setattr(p, k, v)
    with pytest.raises(IntegrityError, match="payments_immutable"):
        db.flush()


def test_pending_order_can_still_be_edited(db: Session, user: User, plan: VipPlan):
    p = make_payment(db, user, plan)
    p.amount_vnd = 39_000
    db.flush()
    db.refresh(p)
    assert p.amount_vnd == 39_000


def test_order_code_never_changes(db: Session, user: User, plan: VipPlan):
    p = make_payment(db, user, plan)
    p.provider_order_id = "VD-KHAC"
    with pytest.raises(IntegrityError, match="payments_immutable"):
        db.flush()


def test_refund_keeps_bank_transaction(db: Session, user: User, plan: VipPlan):
    p = make_payment(db, user, plan, status=PaymentStatus.PAID)
    p.status = PaymentStatus.REFUNDED
    p.failure_code = PaymentFailureCode.REFUNDED_BY_ADMIN
    p.failure_detail = "Khách chuyển nhầm gói"
    db.flush()
    db.refresh(p)
    assert p.paid_event_id is not None


# --- lý do thất bại ---------------------------------------------------------


@pytest.mark.parametrize(
    ("status", "kw", "constraint"),
    [
        (PaymentStatus.FAILED, {"failure_code": None}, "ck_payments_failed_has_code"),
        (
            PaymentStatus.PENDING,
            {"failure_code": "amount_mismatch"},
            "ck_payments_failure_code_status",
        ),
        (PaymentStatus.FAILED, {"failure_code": "het_tien"}, "ck_payments_failure_code"),
        (PaymentStatus.EXPIRED, {"failure_detail": "không mã"}, "ck_payments_detail_has_code"),
    ],
)
def test_failure_reason_checks(db: Session, user: User, plan: VipPlan, status, kw, constraint):
    with pytest.raises(IntegrityError, match=constraint):
        make_payment(db, user, plan, status=status, **kw)


def test_expired_order_with_reason(db: Session, user: User, plan: VipPlan):
    p = make_payment(
        db,
        user,
        plan,
        status=PaymentStatus.EXPIRED,
        failure_code=PaymentFailureCode.EXPIRED_UNPAID,
        failure_detail="Quá 30 phút chưa nhận được tiền",
    )
    assert p.id is not None


# --- subscriptions: khóa trường ---------------------------------------------


def test_subscription_owner_and_plan_locked(db: Session, user: User, plan: VipPlan):
    s = make_subscription(db, user, plan)
    other = User(email="khac@example.com", password_hash="x", display_name="K")
    db.add(other)
    db.flush()
    s.user_id = other.id
    with pytest.raises(IntegrityError, match="subscriptions_immutable"):
        db.flush()


def test_active_subscription_can_be_rescheduled(db: Session, user: User, plan: VipPlan):
    """Dồn gói khi hủy gói phía trước: gói còn active được dời thời gian."""
    s = make_subscription(db, user, plan)
    s.starts_at = NOW - timedelta(days=1)
    s.expires_at = NOW + timedelta(days=29)
    db.flush()


def test_ended_subscription_times_locked(db: Session, user: User, plan: VipPlan):
    s = make_subscription(db, user, plan, status=SubscriptionStatus.EXPIRED)
    s.expires_at = NOW + timedelta(days=365)
    with pytest.raises(IntegrityError, match="subscriptions_immutable"):
        db.flush()


# --- enum khớp CHECK trong DB -----------------------------------------------


@pytest.mark.parametrize(
    ("constraint", "enum"),
    [
        ("ck_users_role", UserRole),
        ("ck_email_tokens_purpose", EmailTokenPurpose),
        ("ck_series_status", SeriesStatus),
        ("ck_episodes_stream_status", StreamStatus),
        ("ck_payments_status", PaymentStatus),
        ("ck_payments_failure_code", PaymentFailureCode),
        ("ck_subscriptions_status", SubscriptionStatus),
    ],
)
def test_db_check_matches_enum(db: Session, constraint: str, enum):
    """Thêm giá trị vào enum mà quên migration (hoặc ngược lại) thì test này báo."""
    definition = db.scalar(
        text("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = :n"),
        {"n": constraint},
    )
    assert definition is not None, constraint
    # Postgres viết lại IN (...) thành ANY (ARRAY['a'::character varying, ...]):
    # lấy mọi chuỗi nằm trong dấu nháy đơn.
    in_db = set(re.findall(r"'([^']*)'", definition))
    assert in_db == {e.value for e in enum}
