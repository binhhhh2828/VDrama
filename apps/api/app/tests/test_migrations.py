"""Kiểm tra bản thân chuỗi migration (chạy trên database tạm riêng)."""

from alembic import command
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

from app.tests.conftest import alembic_config


def installed_extensions(url: str) -> set[str]:
    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            return {r[0] for r in conn.execute(text("SELECT extname FROM pg_extension"))}
    finally:
        engine.dispose()


def test_single_head():
    """Chuỗi migration không được rẽ nhánh."""
    heads = ScriptDirectory.from_config(alembic_config()).get_heads()
    assert len(heads) == 1


def test_upgrade_installs_extensions(migrated_db_url: str):
    assert {"pg_trgm", "unaccent"} <= installed_extensions(migrated_db_url)


def test_downgrade_to_base_is_clean(migrated_db_url: str):
    command.downgrade(alembic_config(), "base")
    assert not {"pg_trgm", "unaccent"} & installed_extensions(migrated_db_url)


def test_upgrade_is_repeatable(migrated_db_url: str):
    """down rồi up lại vẫn chạy được (migration không để lại trạng thái dở)."""
    command.downgrade(alembic_config(), "base")
    command.upgrade(alembic_config(), "head")
    assert {"pg_trgm", "unaccent"} <= installed_extensions(migrated_db_url)


def test_models_match_migrations(migrated_db_url: str):
    """Model và migration không lệch nhau (tương đương `alembic check`)."""
    command.check(alembic_config())
