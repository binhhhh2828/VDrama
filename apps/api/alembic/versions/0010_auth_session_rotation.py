"""Auth: xoay vòng refresh token, đồng ý điều khoản, tóm tắt hạn VIP

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-28

Xem docs/plans/gd2-b2-auth.md.
- sessions.previous_refresh_token_hash + rotated_at: token liền trước được chấp nhận 60 giây sau
  khi xoay (hai tab refresh cùng lúc); dùng lại muộn hơn thì thu hồi cả phiên.
- users.terms_accepted_at: bằng chứng đồng ý điều khoản khi đăng ký.
- users.vip_expires_at: VIP khi > now(); tóm tắt của subscriptions, chỉ services/vip.py ghi.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("previous_refresh_token_hash", sa.Text(), nullable=True))
    op.add_column("sessions", sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint(
        op.f("uq_sessions_previous_refresh_token_hash"),
        "sessions",
        ["previous_refresh_token_hash"],
    )
    op.create_check_constraint(
        op.f("ck_sessions_rotation_pair"),
        "sessions",
        "(previous_refresh_token_hash IS NULL) = (rotated_at IS NULL)",
    )

    op.add_column("users", sa.Column("terms_accepted_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("vip_expires_at", sa.DateTime(timezone=True)))
    op.create_index(
        "ix_users_vip_expires_at",
        "users",
        ["vip_expires_at"],
        postgresql_where=sa.text("vip_expires_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_vip_expires_at", table_name="users")
    op.drop_column("users", "vip_expires_at")
    op.drop_column("users", "terms_accepted_at")

    op.drop_constraint(op.f("ck_sessions_rotation_pair"), "sessions", type_="check")
    op.drop_constraint(op.f("uq_sessions_previous_refresh_token_hash"), "sessions", type_="unique")
    op.drop_column("sessions", "rotated_at")
    op.drop_column("sessions", "previous_refresh_token_hash")
