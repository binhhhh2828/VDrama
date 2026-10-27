"""Xóa mềm cho users, series, episodes, genres, vip_plans; chặn xóa thật ở tầng DB

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-27

Xem docs/plans/gd2-b1b-trang-thai-xoa-mem-nhat-ky.md (mục 2).
- deleted_at / deleted_by_id: dòng bị ẩn chứ không mất. Ứng dụng tự lọc (app/models/soft_delete.py).
- Trigger block_hard_delete: từ chối DELETE và TRUNCATE trên các bảng quan trọng, kể cả gõ tay
  trong công cụ quản trị DB. Script bảo trì muốn xóa thật phải bật cờ trong đúng transaction:
      SET LOCAL vdrama.allow_hard_delete = 'on';
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOFT_DELETE_TABLES = ("users", "series", "episodes", "genres", "vip_plans")
# Bảng không bao giờ được xóa thật qua ứng dụng (audit_logs thêm ở migration 0009).
GUARDED_TABLES = (*SOFT_DELETE_TABLES, "payments", "subscriptions", "payment_events")

BLOCK_HARD_DELETE = """
CREATE FUNCTION block_hard_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF coalesce(current_setting('vdrama.allow_hard_delete', true), '') <> 'on' THEN
        RAISE EXCEPTION 'hard_delete_blocked: không được xóa thật bảng %, hãy dùng xóa mềm',
            TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
    END IF;
    IF TG_LEVEL = 'ROW' THEN
        RETURN OLD;
    END IF;
    RETURN NULL;
END $$;
"""


def upgrade() -> None:
    for table in SOFT_DELETE_TABLES:
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
        op.add_column(table, sa.Column("deleted_by_id", sa.BigInteger(), nullable=True))
        op.create_index(op.f(f"ix_{table}_deleted_by_id"), table, ["deleted_by_id"])
        op.create_foreign_key(
            op.f(f"fk_{table}_deleted_by_id_users"),
            table,
            "users",
            ["deleted_by_id"],
            ["id"],
            ondelete="RESTRICT",
        )

    op.execute(BLOCK_HARD_DELETE)
    for table in GUARDED_TABLES:
        op.execute(
            f"CREATE TRIGGER trg_{table}_block_delete BEFORE DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION block_hard_delete()"
        )
        op.execute(
            f"CREATE TRIGGER trg_{table}_block_truncate BEFORE TRUNCATE ON {table} "
            "FOR EACH STATEMENT EXECUTE FUNCTION block_hard_delete()"
        )


def downgrade() -> None:
    for table in GUARDED_TABLES:
        op.execute(f"DROP TRIGGER trg_{table}_block_truncate ON {table}")
        op.execute(f"DROP TRIGGER trg_{table}_block_delete ON {table}")
    op.execute("DROP FUNCTION block_hard_delete()")

    for table in reversed(SOFT_DELETE_TABLES):
        op.drop_constraint(op.f(f"fk_{table}_deleted_by_id_users"), table, type_="foreignkey")
        op.drop_index(op.f(f"ix_{table}_deleted_by_id"), table_name=table)
        op.drop_column(table, "deleted_by_id")
        op.drop_column(table, "deleted_at")
