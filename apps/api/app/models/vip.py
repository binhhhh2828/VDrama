"""Nhóm VIP & thanh toán: vip_plans, payments, subscriptions, payment_events.

Quy tắc chính nằm ở tầng DB để đúng kể cả khi code có lỗi:
- Một payment chỉ cộng VIP một lần: subscriptions.payment_id là unique.
- Webhook trùng không xử lý hai lần: unique (provider, event_id).
- Không xóa user/gói còn lịch sử thanh toán: khóa ngoại RESTRICT.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import CreatedAtMixin, TimestampMixin

PAYMENT_STATUSES = ("pending", "paid", "failed", "expired", "refunded")
SUBSCRIPTION_STATUSES = ("active", "expired", "cancelled")


class VipPlan(TimestampMixin, Base):
    __tablename__ = "vip_plans"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    __table_args__ = (
        CheckConstraint("price_vnd > 0", name="price_positive"),
        CheckConstraint("duration_days > 0", name="duration_positive"),
    )


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    plan_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("vip_plans.id", ondelete="RESTRICT"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(30), nullable=False)  # momo, vnpay, payos...
    # Mã đơn do server sinh và gửi sang cổng; duy nhất trên mọi cổng.
    provider_order_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    # Lưu giá tại thời điểm mua (giá gói có thể đổi sau đó). Đối chiếu với số tiền cổng báo về.
    amount_vnd: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("amount_vnd > 0", name="amount_positive"),
        CheckConstraint(f"status IN {PAYMENT_STATUSES!r}", name="status"),
        CheckConstraint(
            "status NOT IN ('paid', 'refunded') OR paid_at IS NOT NULL", name="paid_at_set"
        ),
        Index("ix_payments_user_id_created_at", "user_id", text("created_at DESC")),
        Index("ix_payments_plan_id", "plan_id"),
        # Job đối soát / đóng đơn quá hạn chỉ quét đơn pending (luôn ít dòng).
        Index("ix_payments_pending", "expires_at", postgresql_where=text("status = 'pending'")),
    )


class Subscription(CreatedAtMixin, Base):
    """Một khoảng thời gian VIP. Gia hạn = thêm dòng mới nối tiếp, không sửa dòng cũ."""

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    plan_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("vip_plans.id", ondelete="RESTRICT"), nullable=False
    )
    # NULL khi admin tặng VIP thủ công (bồi thường...). Unique: một payment cộng VIP một lần.
    payment_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("payments.id", ondelete="RESTRICT"), unique=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")

    __table_args__ = (
        CheckConstraint(f"status IN {SUBSCRIPTION_STATUSES!r}", name="status"),
        CheckConstraint("expires_at > starts_at", name="period_valid"),
        # "User còn VIP không / hết hạn khi nào": lấy dòng expires_at lớn nhất của user.
        Index("ix_subscriptions_user_id_expires_at", "user_id", text("expires_at DESC")),
        Index("ix_subscriptions_plan_id", "plan_id"),
    )


class PaymentEvent(Base):
    """Nhật ký webhook/IPN thô từ cổng thanh toán, dùng để chống xử lý trùng và đối soát."""

    __tablename__ = "payment_events"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    event_id: Mapped[str] = mapped_column(String(200), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        # Hai cổng có thể dùng trùng mã sự kiện, nên unique theo cặp.
        UniqueConstraint("provider", "event_id", name="uq_payment_events_provider_event_id"),
    )
