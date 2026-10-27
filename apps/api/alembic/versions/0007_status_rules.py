"""Trạng thái có kiểm soát cho payments/subscriptions, lý do thất bại, chặn "paid" giả

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-27

Xem docs/plans/gd2-b1b-trang-thai-xoa-mem-nhat-ky.md (mục 1).
- payments.paid_event_id: đơn chỉ `paid`/`refunded` khi gắn với giao dịch ngân hàng thật
  (payment_events); một giao dịch chỉ trả cho một đơn.
- payments.failure_code / failure_detail: lý do thất bại.
- Trigger chỉ cho chuyển trạng thái theo sơ đồ, và khóa các trường tiền sau khi đơn rời `pending`.

Các cặp chuyển trạng thái ở đây được viết cứng (migration không import code ứng dụng, để
không đổi theo code sau này). Test so sánh chúng với app/models/enums.py.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FAILURE_CODES = (
    "'amount_mismatch', 'expired_unpaid', 'duplicate_transfer', "
    "'provider_error', 'refunded_by_admin', 'other'"
)

PAYMENTS_GUARD = """
CREATE FUNCTION payments_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'pending' AND NEW.status IN ('paid', 'failed', 'expired'))
        OR (OLD.status = 'paid' AND NEW.status = 'refunded')
    ) THEN
        RAISE EXCEPTION 'payments_status_transition: % -> % không hợp lệ', OLD.status, NEW.status
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id
        OR NEW.provider IS DISTINCT FROM OLD.provider THEN
        RAISE EXCEPTION 'payments_immutable: không được đổi mã đơn hoặc cổng thanh toán'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Đơn đã rời trạng thái pending: các trường tiền bị khóa.
    IF OLD.status <> 'pending' AND (
        NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
        OR NEW.amount_vnd IS DISTINCT FROM OLD.amount_vnd
        OR NEW.paid_event_id IS DISTINCT FROM OLD.paid_event_id
        OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
    ) THEN
        RAISE EXCEPTION 'payments_immutable: đơn % không còn pending, không được sửa trường tiền',
            OLD.id USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END $$;
"""

SUBSCRIPTIONS_GUARD = """
CREATE FUNCTION subscriptions_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        OLD.status = 'active' AND NEW.status IN ('expired', 'cancelled')
    ) THEN
        RAISE EXCEPTION 'subscriptions_status_transition: % -> % không hợp lệ',
            OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
        OR NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
        RAISE EXCEPTION 'subscriptions_immutable: không được đổi user, gói hoặc payment'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Chỉ gói còn active mới được dời thời gian (dồn gói khi hủy một gói phía trước).
    IF OLD.status <> 'active' AND (
        NEW.starts_at IS DISTINCT FROM OLD.starts_at
        OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    ) THEN
        RAISE EXCEPTION 'subscriptions_immutable: gói % đã kết thúc, không được đổi thời gian',
            OLD.id USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END $$;
"""


def upgrade() -> None:
    op.add_column("payments", sa.Column("paid_event_id", sa.BigInteger(), nullable=True))
    op.add_column("payments", sa.Column("failure_code", sa.String(length=50), nullable=True))
    op.add_column("payments", sa.Column("failure_detail", sa.Text(), nullable=True))
    # Một giao dịch ngân hàng chỉ trả cho một đơn (unique cũng là index cho khóa ngoại).
    op.create_unique_constraint(op.f("uq_payments_paid_event_id"), "payments", ["paid_event_id"])
    op.create_foreign_key(
        op.f("fk_payments_paid_event_id_payment_events"),
        "payments",
        "payment_events",
        ["paid_event_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_check_constraint(
        op.f("ck_payments_paid_requires_event"),
        "payments",
        "status NOT IN ('paid', 'refunded') OR paid_event_id IS NOT NULL",
    )
    op.create_check_constraint(
        op.f("ck_payments_failure_code"),
        "payments",
        f"failure_code IS NULL OR failure_code IN ({FAILURE_CODES})",
    )
    op.create_check_constraint(
        op.f("ck_payments_failure_code_status"),
        "payments",
        "failure_code IS NULL OR status IN ('failed', 'expired', 'refunded')",
    )
    op.create_check_constraint(
        op.f("ck_payments_failed_has_code"),
        "payments",
        "status <> 'failed' OR failure_code IS NOT NULL",
    )
    op.create_check_constraint(
        op.f("ck_payments_detail_has_code"),
        "payments",
        "failure_detail IS NULL OR failure_code IS NOT NULL",
    )

    op.execute(PAYMENTS_GUARD)
    op.execute(
        "CREATE TRIGGER trg_payments_guard BEFORE UPDATE ON payments "
        "FOR EACH ROW EXECUTE FUNCTION payments_guard()"
    )
    op.execute(SUBSCRIPTIONS_GUARD)
    op.execute(
        "CREATE TRIGGER trg_subscriptions_guard BEFORE UPDATE ON subscriptions "
        "FOR EACH ROW EXECUTE FUNCTION subscriptions_guard()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_subscriptions_guard ON subscriptions")
    op.execute("DROP FUNCTION subscriptions_guard()")
    op.execute("DROP TRIGGER trg_payments_guard ON payments")
    op.execute("DROP FUNCTION payments_guard()")

    for name in (
        "ck_payments_detail_has_code",
        "ck_payments_failed_has_code",
        "ck_payments_failure_code_status",
        "ck_payments_failure_code",
        "ck_payments_paid_requires_event",
    ):
        op.drop_constraint(op.f(name), "payments", type_="check")
    op.drop_constraint(
        op.f("fk_payments_paid_event_id_payment_events"), "payments", type_="foreignkey"
    )
    op.drop_constraint(op.f("uq_payments_paid_event_id"), "payments", type_="unique")
    op.drop_column("payments", "failure_detail")
    op.drop_column("payments", "failure_code")
    op.drop_column("payments", "paid_event_id")
