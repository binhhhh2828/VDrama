"""Xóa mềm cho watch_history, favorites; chặn xóa thật hai bảng này

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-29

Xem docs/plans/gd2-b5-activity.md (mục "Xóa mềm cho dữ liệu của người dùng").
- Người dùng xóa lịch sử / bỏ yêu thích: chỉ đặt deleted_at (người dùng thấy là đã xóa, hệ thống
  vẫn giữ để phân tích). Không có deleted_by_id: người xóa luôn là chính chủ dòng.
- Không index deleted_at: watch_history cần HOT update (ghi mỗi 15–30 giây khi đang xem).
- Dùng lại hàm block_hard_delete() của migration 0008. Bảo trì vẫn xóa thật được bằng
  SET LOCAL vdrama.allow_hard_delete = 'on' (kể cả cascade khi xóa user/tập).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("watch_history", "favorites")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
        op.execute(
            f"CREATE TRIGGER trg_{table}_block_delete BEFORE DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION block_hard_delete()"
        )
        op.execute(
            f"CREATE TRIGGER trg_{table}_block_truncate BEFORE TRUNCATE ON {table} "
            "FOR EACH STATEMENT EXECUTE FUNCTION block_hard_delete()"
        )


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"DROP TRIGGER trg_{table}_block_truncate ON {table}")
        op.execute(f"DROP TRIGGER trg_{table}_block_delete ON {table}")
        op.drop_column(table, "deleted_at")
