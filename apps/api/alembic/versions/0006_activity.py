"""Nhóm hoạt động người dùng: watch_history, favorites

Xem thiết kế ở docs/plans/gd2-b1-database.md (Nhóm hoạt động người dùng).
watch_history ghi nhiều: fillfactor 70 và không index cột hay đổi để Postgres cập nhật tại chỗ.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("series_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["series.id"],
            name=op.f("fk_favorites_series_id_series"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_favorites_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "series_id", name=op.f("pk_favorites")),
    )
    op.create_index("ix_favorites_series_id", "favorites", ["series_id"], unique=False)
    op.create_table(
        "watch_history",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("episode_id", sa.BigInteger(), nullable=False),
        sa.Column("progress_sec", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "progress_sec >= 0", name=op.f("ck_watch_history_progress_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["episode_id"],
            ["episodes.id"],
            name=op.f("fk_watch_history_episode_id_episodes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_watch_history_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "episode_id", name=op.f("pk_watch_history")),
        postgresql_with={"fillfactor": 70},
    )
    op.create_index("ix_watch_history_episode_id", "watch_history", ["episode_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_watch_history_episode_id", table_name="watch_history")
    op.drop_table("watch_history")
    op.drop_index("ix_favorites_series_id", table_name="favorites")
    op.drop_table("favorites")
