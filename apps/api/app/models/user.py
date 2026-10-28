from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Identity, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import UserRole, sql_in
from app.models.mixins import SoftDeleteMixin, TimestampMixin


class User(SoftDeleteMixin, TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=UserRole.USER.value
    )
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Thời điểm tick "đồng ý điều khoản" khi đăng ký (bằng chứng đồng ý). NULL: admin tạo bằng CLI.
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Bản tóm tắt VIP: đang là VIP khi vip_expires_at > now() (tự hết hạn, không cần job).
    # Nguồn sự thật là bảng subscriptions; chỉ services/vip.py được ghi cột này.
    vip_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(sql_in("role", UserRole), name="role"),
        # Email duy nhất không phân biệt hoa/thường. Truy vấn phải dùng lower(email) = lower(:x).
        Index("uq_users_email_lower", func.lower(email), unique=True),
        # Job nhắc hạn VIP ("ai hết hạn trong 5 ngày tới"); bỏ qua user chưa từng mua.
        Index(
            "ix_users_vip_expires_at",
            vip_expires_at,
            postgresql_where=vip_expires_at.is_not(None),
        ),
    )
