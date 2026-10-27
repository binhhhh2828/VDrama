"""Nhóm VIP & thanh toán: vip_plans, payments, subscriptions, payment_events

Xem thiết kế ở docs/plans/gd2-b1-database.md (Nhóm VIP & thanh toán).

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payment_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("event_id", sa.String(length=200), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment_events")),
        sa.UniqueConstraint("provider", "event_id", name="uq_payment_events_provider_event_id"),
    )
    op.create_table(
        "vip_plans",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("price_vnd", sa.Integer(), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("duration_days > 0", name=op.f("ck_vip_plans_duration_positive")),
        sa.CheckConstraint("price_vnd > 0", name=op.f("ck_vip_plans_price_positive")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_vip_plans")),
    )
    op.create_table(
        "payments",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("plan_id", sa.BigInteger(), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("provider_order_id", sa.String(length=100), nullable=False),
        sa.Column("amount_vnd", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'paid', 'failed', 'expired', 'refunded')",
            name=op.f("ck_payments_status"),
        ),
        sa.CheckConstraint(
            "status NOT IN ('paid', 'refunded') OR paid_at IS NOT NULL",
            name=op.f("ck_payments_paid_at_set"),
        ),
        sa.CheckConstraint("amount_vnd > 0", name=op.f("ck_payments_amount_positive")),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["vip_plans.id"],
            name=op.f("fk_payments_plan_id_vip_plans"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_payments_user_id_users"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payments")),
        sa.UniqueConstraint("provider_order_id", name=op.f("uq_payments_provider_order_id")),
    )
    # Job đối soát / đóng đơn quá hạn chỉ quét đơn pending.
    op.create_index(
        "ix_payments_pending",
        "payments",
        ["expires_at"],
        unique=False,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index("ix_payments_plan_id", "payments", ["plan_id"], unique=False)
    op.create_index(
        "ix_payments_user_id_created_at",
        "payments",
        ["user_id", sa.literal_column("created_at DESC")],
        unique=False,
    )
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("plan_id", sa.BigInteger(), nullable=False),
        sa.Column("payment_id", sa.BigInteger(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('active', 'expired', 'cancelled')", name=op.f("ck_subscriptions_status")
        ),
        sa.CheckConstraint("expires_at > starts_at", name=op.f("ck_subscriptions_period_valid")),
        sa.ForeignKeyConstraint(
            ["payment_id"],
            ["payments.id"],
            name=op.f("fk_subscriptions_payment_id_payments"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["vip_plans.id"],
            name=op.f("fk_subscriptions_plan_id_vip_plans"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_subscriptions_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_subscriptions")),
        # Một payment chỉ cộng VIP một lần.
        sa.UniqueConstraint("payment_id", name=op.f("uq_subscriptions_payment_id")),
    )
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"], unique=False)
    op.create_index(
        "ix_subscriptions_user_id_expires_at",
        "subscriptions",
        ["user_id", sa.literal_column("expires_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_subscriptions_user_id_expires_at", table_name="subscriptions")
    op.drop_index("ix_subscriptions_plan_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index("ix_payments_user_id_created_at", table_name="payments")
    op.drop_index("ix_payments_plan_id", table_name="payments")
    op.drop_index(
        "ix_payments_pending", table_name="payments", postgresql_where=sa.text("status = 'pending'")
    )
    op.drop_table("payments")
    op.drop_table("vip_plans")
    op.drop_table("payment_events")
