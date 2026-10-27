"""Mọi tập giá trị cố định (trạng thái, vai trò...) của DB.

Tên viết hoa dùng trong code (`SubscriptionStatus.ACTIVE`), giá trị viết thường lưu trong DB
(`'active'`). CHECK constraint sinh từ chính các enum này nên code và DB không thể lệch.
"""

from enum import StrEnum


class UserRole(StrEnum):
    USER = "user"
    ADMIN = "admin"


class EmailTokenPurpose(StrEnum):
    VERIFY_EMAIL = "verify_email"
    RESET_PASSWORD = "reset_password"


class SeriesStatus(StrEnum):
    ONGOING = "ongoing"
    COMPLETED = "completed"


class StreamStatus(StrEnum):
    NONE = "none"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    EXPIRED = "expired"
    REFUNDED = "refunded"


class PaymentFailureCode(StrEnum):
    AMOUNT_MISMATCH = "amount_mismatch"  # chuyển thiếu/sai số tiền
    EXPIRED_UNPAID = "expired_unpaid"  # quá hạn đơn mà chưa nhận được tiền
    DUPLICATE_TRANSFER = "duplicate_transfer"  # chuyển hai lần cho một đơn
    PROVIDER_ERROR = "provider_error"  # lỗi phía cổng thanh toán
    REFUNDED_BY_ADMIN = "refunded_by_admin"
    OTHER = "other"


class ActorType(StrEnum):
    """Ai thực hiện một thao tác được ghi vào audit_logs."""

    ADMIN = "admin"
    USER = "user"
    SYSTEM = "system"  # job chạy định kỳ, lệnh bảo trì
    WEBHOOK = "webhook"  # cổng thanh toán, Cloudflare Stream


class SubscriptionStatus(StrEnum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


# Chuyển trạng thái hợp lệ. Trigger trong migration 0007 dùng đúng các cặp này;
# test kiểm tra hai nơi khớp nhau.
PAYMENT_TRANSITIONS: dict[PaymentStatus, frozenset[PaymentStatus]] = {
    PaymentStatus.PENDING: frozenset(
        {PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.EXPIRED}
    ),
    PaymentStatus.PAID: frozenset({PaymentStatus.REFUNDED}),
    PaymentStatus.FAILED: frozenset(),
    PaymentStatus.EXPIRED: frozenset(),
    PaymentStatus.REFUNDED: frozenset(),
}

SUBSCRIPTION_TRANSITIONS: dict[SubscriptionStatus, frozenset[SubscriptionStatus]] = {
    SubscriptionStatus.ACTIVE: frozenset(
        {SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED}
    ),
    SubscriptionStatus.EXPIRED: frozenset(),
    SubscriptionStatus.CANCELLED: frozenset(),
}


def sql_in(column: str, values: type[StrEnum] | list[StrEnum]) -> str:
    """Biểu thức SQL `column IN ('a', 'b')` cho CHECK constraint."""
    items = ", ".join(f"'{v.value}'" for v in values)
    return f"{column} IN ({items})"
