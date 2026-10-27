"""Nhóm catalog: genres, series, series_stats, series_genres, episodes

Xem thiết kế ở docs/plans/gd2-b1-database.md (Nhóm catalog).
Cột series.search_text và index trigram nằm ở migration 0004.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "genres",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_genres")),
        sa.UniqueConstraint("slug", name=op.f("uq_genres_slug")),
    )
    op.create_table(
        "series",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("poster_url", sa.Text(), nullable=True),
        sa.Column("banner_url", sa.Text(), nullable=True),
        sa.Column("year", sa.SmallInteger(), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ongoing", nullable=False),
        sa.Column("total_episodes", sa.Integer(), nullable=True),
        sa.Column("is_published", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("status IN ('ongoing', 'completed')", name=op.f("ck_series_status")),
        sa.CheckConstraint(
            "NOT is_published OR published_at IS NOT NULL", name=op.f("ck_series_published_at_set")
        ),
        sa.CheckConstraint(
            "total_episodes IS NULL OR total_episodes >= 0", name=op.f("ck_series_total_episodes")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_series")),
        sa.UniqueConstraint("slug", name=op.f("uq_series_slug")),
    )
    # Danh sách phim mới (phân trang keyset), chỉ gồm phim đã xuất bản.
    op.create_index(
        "ix_series_published",
        "series",
        [sa.literal_column("published_at DESC"), sa.literal_column("id DESC")],
        unique=False,
        postgresql_where=sa.text("is_published"),
    )
    op.create_table(
        "episodes",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("series_id", sa.BigInteger(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("stream_video_id", sa.String(length=100), nullable=True),
        sa.Column("stream_status", sa.String(length=20), server_default="none", nullable=False),
        sa.Column("is_free", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "NOT is_published OR (published_at IS NOT NULL AND stream_status = 'ready')",
            name=op.f("ck_episodes_publish_requires_ready"),
        ),
        sa.CheckConstraint(
            "stream_status IN ('none', 'uploading', 'processing', 'ready', 'error')",
            name=op.f("ck_episodes_stream_status"),
        ),
        sa.CheckConstraint(
            "duration_sec IS NULL OR duration_sec >= 0", name=op.f("ck_episodes_duration_sec")
        ),
        sa.CheckConstraint("number > 0", name=op.f("ck_episodes_number_positive")),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["series.id"],
            name=op.f("fk_episodes_series_id_series"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_episodes")),
        sa.UniqueConstraint("series_id", "number", name="uq_episodes_series_id_number"),
        sa.UniqueConstraint("stream_video_id", name=op.f("uq_episodes_stream_video_id")),
    )
    op.create_table(
        "series_genres",
        sa.Column("series_id", sa.BigInteger(), nullable=False),
        sa.Column("genre_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["genre_id"],
            ["genres.id"],
            name=op.f("fk_series_genres_genre_id_genres"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["series.id"],
            name=op.f("fk_series_genres_series_id_series"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("series_id", "genre_id", name=op.f("pk_series_genres")),
    )
    op.create_index("ix_series_genres_genre_id", "series_genres", ["genre_id"], unique=False)
    op.create_table(
        "series_stats",
        sa.Column("series_id", sa.BigInteger(), nullable=False),
        sa.Column("view_count", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("favorite_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "view_count >= 0 AND favorite_count >= 0", name=op.f("ck_series_stats_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["series.id"],
            name=op.f("fk_series_stats_series_id_series"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("series_id", name=op.f("pk_series_stats")),
    )


def downgrade() -> None:
    op.drop_table("series_stats")
    op.drop_index("ix_series_genres_genre_id", table_name="series_genres")
    op.drop_table("series_genres")
    op.drop_table("episodes")
    op.drop_index(
        "ix_series_published", table_name="series", postgresql_where=sa.text("is_published")
    )
    op.drop_table("series")
    op.drop_table("genres")
