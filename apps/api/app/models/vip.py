"""Nhóm VIP & thanh toán: vip_plans, payments, subscriptions, payment_events.

Quy tắc chính nằm ở tầng DB để đúng kể cả khi code có lỗi:
- Một payment chỉ cộng VIP một lần: subscriptions.payment_id là unique.
- Webhook trùng không xử lý hai lần: unique (provider, event_id).
- Không xóa user/gói còn lịch sử thanh toán: khóa ngoại RESTRICT.
- Đơn chỉ `paid` khi gắn với một giao dịch ngân hàng thật (paid_event_id); một giao dịch
  chỉ trả cho một đơn. Admin không thể tự đánh dấu đã thanh toán.
- Chuyển trạng thái chỉ theo PAYMENT_TRANSITIONS / SUBSCRIPTION_TRANSITIONS (trigger, 0007).
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
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import PaymentFailureCode, PaymentStatus, SubscriptionStatus, sql_in
from app.models.mixins import CreatedAtMixin, TimestampMixin


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
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=PaymentStatus.PENDING.value
    )
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Giao dịch ngân hàng thật (từ webhook/đối soát SePay) đã trả cho đơn này.
    paid_event_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("payment_events.id", ondelete="RESTRICT"), unique=True
    )
    failure_code: Mapped[str | None] = mapped_column(String(50))
    failure_detail: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("amount_vnd > 0", name="amount_positive"),
        CheckConstraint(sql_in("status", PaymentStatus), name="status"),
        CheckConstraint(
            "status NOT IN ('paid', 'refunded') OR paid_at IS NOT NULL", name="paid_at_set"
        ),
        # Không có giao dịch thật thì không thể "đã thanh toán", kể cả admin sửa tay.
        CheckConstraint(
            "status NOT IN ('paid', 'refunded') OR paid_event_id IS NOT NULL",
            name="paid_requires_event",
        ),
        CheckConstraint(
            f"failure_code IS NULL OR {sql_in('failure_code', PaymentFailureCode)}",
            name="failure_code",
        ),
        # Chỉ đơn thất bại / hết hạn / hoàn tiền mới có lý do; đơn failed bắt buộc có mã.
        CheckConstraint(
            "failure_code IS NULL OR status IN ('failed', 'expired', 'refunded')",
            name="failure_code_status",
        ),
        CheckConstraint("status <> 'failed' OR failure_code IS NOT NULL", name="failed_has_code"),
        CheckConstraint(
            "failure_detail IS NULL OR failure_code IS NOT NULL", name="detail_has_code"
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
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=SubscriptionStatus.ACTIVE.value
    )

    __table_args__ = (
        CheckConstraint(sql_in("status", SubscriptionStatus), name="status"),
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
