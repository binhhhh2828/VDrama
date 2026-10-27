from app.core.config import Settings, to_psycopg_url


def test_url_scheme_is_normalized():
    assert to_psycopg_url("postgresql://u:p@h/db?sslmode=require") == (
        "postgresql+psycopg://u:p@h/db?sslmode=require"
    )
    assert to_psycopg_url("postgres://u:p@h/db").startswith("postgresql+psycopg://")
    assert to_psycopg_url("postgresql+psycopg://u:p@h/db") == "postgresql+psycopg://u:p@h/db"


def test_migration_url_falls_back_to_app_url():
    s = Settings(database_url="postgresql://a@h/db", database_url_direct="")
    assert s.migration_db_url == "postgresql+psycopg://a@h/db"
    s = Settings(database_url="postgresql://a@h/db", database_url_direct="postgresql://b@h2/db")
    assert s.migration_db_url == "postgresql+psycopg://b@h2/db"
