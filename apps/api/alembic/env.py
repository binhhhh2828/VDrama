"""Alembic dùng driver sync (psycopg 3) qua URL direct, không đi qua pooler."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool, text

import app.models  # noqa: F401  (import để model đăng ký vào metadata)
from app.core.config import get_settings
from app.core.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata

# Migration phải thất bại nhanh thay vì khóa bảng làm treo cả site.
LOCK_TIMEOUT = "5s"


def get_url() -> str:
    url = get_settings().migration_db_url
    if not url:
        raise RuntimeError("Chưa cấu hình DATABASE_URL_DIRECT hoặc DATABASE_URL")
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(get_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        connection.execute(text(f"SET lock_timeout = '{LOCK_TIMEOUT}'"))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            transaction_per_migration=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
