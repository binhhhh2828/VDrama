"""Bật extension pg_trgm và unaccent (chuẩn bị cho tìm kiếm tiếng Việt không dấu)

Revision ID: 0001
Revises:
Create Date: 2026-10-27
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS unaccent")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
