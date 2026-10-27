"""Nhật ký thao tác (audit log): ai, lúc nào, làm gì, trên đối tượng nào, đổi gì, vì sao.

- Chỉ thêm: DB chặn UPDATE, chặn DELETE/TRUNCATE (migration 0009).
- Chỉ ghi qua app/services/audit.py, cùng transaction với thay đổi được ghi.
- Thay cho bảng admin_audit_logs riêng: actor_user_id ~ admin_user_id, subject_user_id ~
  target_user_id, changes + reason ~ details. Lọc thao tác admin bằng actor_type = 'admin'.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import ActorType, sql_in


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Ai làm (NULL khi là job/webhook).
    actor_user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT")
    )
    # Tên hành động dạng "<đối tượng>.<động từ>", ví dụ series.delete, payment.refund.
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(100))
    # User bị ảnh hưởng (chủ gói VIP bị hủy, tài khoản bị khóa...).
    subject_user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT")
    )
    # {"trường": [trước, sau]}; trường nhạy cảm đã bị che.
    changes: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    reason: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
    request_id: Mapped[str | None] = mapped_column(String(64))

    __table_args__ = (
        CheckConstraint(sql_in("actor_type", ActorType), name="actor_type"),
        # Admin/user phải biết là ai; job/webhook thì không có user.
        CheckConstraint(
            "actor_type NOT IN ('admin', 'user') OR actor_user_id IS NOT NULL",
            name="actor_user_known",
        ),
        CheckConstraint("action ~ '^[a-z_]+\\.[a-z_]+$'", name="action_format"),
        # Lịch sử một đối tượng; mọi thao tác của một người; mọi thứ liên quan tới một user.
        Index("ix_audit_logs_entity", "entity_type", "entity_id", text("occurred_at DESC")),
        Index("ix_audit_logs_actor_user_id", "actor_user_id", text("occurred_at DESC")),
        Index("ix_audit_logs_subject_user_id", "subject_user_id", text("occurred_at DESC")),
        Index("ix_audit_logs_occurred_at", "occurred_at"),
    )
