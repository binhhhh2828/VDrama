import pytest
from pydantic import ValidationError

from app.core.config import Settings, to_psycopg_url

SECRET = "x" * 32


def make(**kw) -> Settings:
    return Settings(_env_file=None, **kw)


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


def test_prod_requires_jwt_secret():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        make(env="prod", public_origin="https://vdrama.vn")
    make(env="prod", jwt_secret=SECRET, public_origin="https://vdrama.vn")


def test_prod_requires_secure_cookie_and_https_origin():
    with pytest.raises(ValidationError, match="COOKIE_SECURE"):
        make(env="prod", jwt_secret=SECRET, public_origin="https://vdrama.vn", cookie_secure=False)
    with pytest.raises(ValidationError, match="PUBLIC_ORIGIN"):
        make(env="prod", jwt_secret=SECRET, public_origin="http://vdrama.vn")


def test_short_jwt_secret_rejected_everywhere():
    for env in ("dev", "prod"):
        with pytest.raises(ValidationError, match="ít nhất 32 byte"):
            make(env=env, jwt_secret="x" * 31, public_origin="https://vdrama.vn")


def test_dev_generates_random_secret_when_missing():
    a, b = make(env="dev"), make(env="dev")
    assert len(a.jwt_secret.get_secret_value()) >= 32
    assert a.jwt_secret.get_secret_value() != b.jwt_secret.get_secret_value()


def test_unknown_env_rejected():
    with pytest.raises(ValidationError):
        make(env="production")


def test_secret_not_in_repr():
    assert SECRET not in repr(make(jwt_secret=SECRET))


def test_public_origin_trailing_slash_removed():
    assert make(public_origin="http://localhost:3000/").public_origin == "http://localhost:3000"
