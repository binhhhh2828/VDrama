"""Nhật ký thao tác audit_logs: chỉ thêm, không sửa, không xóa

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-27

Xem docs/plans/gd2-b1b-trang-thai-xoa-mem-nhat-ky.md (mục 3).
- UPDATE luôn bị từ chối (kể cả script bảo trì): nhật ký không bao giờ được sửa.
- DELETE/TRUNCATE dùng chung trigger block_hard_delete của 0008 (chỉ cờ bảo trì mới qua được).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BLOCK_UPDATE = """
CREATE FUNCTION audit_logs_block_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log_immutable: nhật ký thao tác không được sửa (id %)', OLD.id
        USING ERRCODE = 'restrict_violation';
END $$;
"""


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("actor_type", sa.String(length=20), nullable=False),
        sa.Column("actor_user_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("subject_user_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "changes",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.CheckConstraint(
            "action ~ '^[a-z_]+\\.[a-z_]+$'", name=op.f("ck_audit_logs_action_format")
        ),
        sa.CheckConstraint(
            "actor_type IN ('admin', 'user', 'system', 'webhook')",
            name=op.f("ck_audit_logs_actor_type"),
        ),
        sa.CheckConstraint(
            "actor_type NOT IN ('admin', 'user') OR actor_user_id IS NOT NULL",
            name=op.f("ck_audit_logs_actor_user_known"),
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_audit_logs_actor_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["subject_user_id"],
            ["users.id"],
            name=op.f("fk_audit_logs_subject_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
    )
    op.create_index(
        "ix_audit_logs_actor_user_id",
        "audit_logs",
        ["actor_user_id", sa.literal_column("occurred_at DESC")],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_entity",
        "audit_logs",
        ["entity_type", "entity_id", sa.literal_column("occurred_at DESC")],
        unique=False,
    )
    op.create_index("ix_audit_logs_occurred_at", "audit_logs", ["occurred_at"], unique=False)
    op.create_index(
        "ix_audit_logs_subject_user_id",
        "audit_logs",
        ["subject_user_id", sa.literal_column("occurred_at DESC")],
        unique=False,
    )

    op.execute(BLOCK_UPDATE)
    op.execute(
        "CREATE TRIGGER trg_audit_logs_block_update BEFORE UPDATE ON audit_logs "
        "FOR EACH ROW EXECUTE FUNCTION audit_logs_block_update()"
    )
    op.execute(
        "CREATE TRIGGER trg_audit_logs_block_delete BEFORE DELETE ON audit_logs "
        "FOR EACH ROW EXECUTE FUNCTION block_hard_delete()"
    )
    op.execute(
        "CREATE TRIGGER trg_audit_logs_block_truncate BEFORE TRUNCATE ON audit_logs "
        "FOR EACH STATEMENT EXECUTE FUNCTION block_hard_delete()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_audit_logs_block_truncate ON audit_logs")
    op.execute("DROP TRIGGER trg_audit_logs_block_delete ON audit_logs")
    op.execute("DROP TRIGGER trg_audit_logs_block_update ON audit_logs")
    op.execute("DROP FUNCTION audit_logs_block_update()")
    op.drop_index("ix_audit_logs_subject_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_occurred_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
