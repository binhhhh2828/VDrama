"""Tìm kiếm không dấu cho series: hàm immutable_unaccent, cột search_text, index trigram

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-27

unaccent() của Postgres không được đánh dấu IMMUTABLE nên không dùng trực tiếp trong
cột sinh sẵn hay index được. Bọc nó bằng một hàm IMMUTABLE chỉ định rõ từ điển.
Truy vấn tìm kiếm phải so với cùng biểu thức: lower(immutable_unaccent(:q)).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION immutable_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
        """
    )
    op.add_column(
        "series",
        sa.Column(
            "search_text",
            sa.Text(),
            sa.Computed("lower(immutable_unaccent((title)::text))", persisted=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_series_search_text_trgm",
        "series",
        ["search_text"],
        postgresql_using="gin",
        postgresql_ops={"search_text": "gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_series_search_text_trgm", table_name="series")
    op.drop_column("series", "search_text")
    op.execute("DROP FUNCTION immutable_unaccent(text)")
