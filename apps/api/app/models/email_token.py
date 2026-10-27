from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import CreatedAtMixin

EMAIL_TOKEN_PURPOSES = ("verify_email", "reset_password")


class EmailToken(CreatedAtMixin, Base):
    """Token một lần cho xác thực email / đặt lại mật khẩu. Chỉ lưu hash."""

    __tablename__ = "email_tokens"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(30), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(f"purpose IN {EMAIL_TOKEN_PURPOSES!r}", name="purpose"),
        Index("ix_email_tokens_user_id", "user_id"),
        Index("ix_email_tokens_expires_at", "expires_at"),  # job dọn token hết hạn
    )
