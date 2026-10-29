import pytest
from pydantic import ValidationError

from app.core.config import Settings, to_psycopg_url
from app.tests import stream_keys

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


PROD = {
    "env": "prod",
    "jwt_secret": SECRET,
    "public_origin": "https://vdrama.vn",
    "trust_cloudflare_ip": True,
    **stream_keys.stream_settings(),
}


def test_prod_valid_config():
    make(**PROD)


def test_prod_requires_jwt_secret():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        make(**{**PROD, "jwt_secret": ""})


def test_prod_requires_secure_cookie_and_https_origin():
    with pytest.raises(ValidationError, match="COOKIE_SECURE"):
        make(**{**PROD, "cookie_secure": False})
    with pytest.raises(ValidationError, match="PUBLIC_ORIGIN"):
        make(**{**PROD, "public_origin": "http://vdrama.vn"})


def test_prod_requires_trust_cloudflare_ip():
    """Sau Caddy, không đọc CF-Connecting-IP thì mọi người dùng chung một IP (và một bộ đếm)."""
    with pytest.raises(ValidationError, match="TRUST_CLOUDFLARE_IP"):
        make(**{**PROD, "trust_cloudflare_ip": False})
    make(env="dev", trust_cloudflare_ip=False)  # dev không bắt buộc


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


# --- Cloudflare Stream ---


def test_dev_starts_without_stream_config():
    s = make(env="dev")
    assert s.stream_signing_key is None
    assert not s.stream_playback_configured


@pytest.mark.parametrize(
    ("field", "env_name"),
    [
        ("cf_stream_customer_code", "CF_STREAM_CUSTOMER_CODE"),
        ("cf_stream_webhook_secret", "CF_STREAM_WEBHOOK_SECRET"),
    ],
)
def test_prod_requires_stream_config(field, env_name):
    with pytest.raises(ValidationError, match=env_name):
        make(**{**PROD, field: ""})


def test_prod_requires_signing_key():
    with pytest.raises(ValidationError, match="CF_STREAM_SIGNING_KEY_ID"):
        make(**{**PROD, "cf_stream_signing_key_id": "", "cf_stream_signing_key_pem": ""})


def test_signing_key_id_and_pem_go_together():
    for missing in ("cf_stream_signing_key_id", "cf_stream_signing_key_pem"):
        with pytest.raises(ValidationError, match="phải đặt cùng nhau"):
            make(**{**stream_keys.stream_settings(), missing: ""})


def test_signing_key_loaded_at_startup():
    s = make(**stream_keys.stream_settings())
    assert s.stream_signing_key is not None
    assert s.stream_playback_configured


def test_signing_key_accepts_raw_pem():
    raw = stream_keys.pem().decode()
    s = make(**{**stream_keys.stream_settings(), "cf_stream_signing_key_pem": raw})
    assert s.stream_signing_key is not None


@pytest.mark.parametrize(
    ("value", "message"),
    [
        ("không phải base64!", "base64"),
        ("aGVsbG8=", "PEM"),  # base64 hợp lệ nhưng không phải PEM
        (stream_keys.pem_b64(bits=1024), "2048"),
    ],
)
def test_bad_signing_key_rejected_at_startup(value, message):
    with pytest.raises(ValidationError, match=message):
        make(**{**stream_keys.stream_settings(), "cf_stream_signing_key_pem": value})


def test_signing_key_not_in_repr():
    s = make(**stream_keys.stream_settings())
    assert stream_keys.pem_b64() not in repr(s)
    assert "PRIVATE KEY" not in repr(s)


@pytest.mark.parametrize("ttl", [0, -1, 24 * 60 + 1])
def test_stream_token_ttl_bounds(ttl):
    with pytest.raises(ValidationError, match="STREAM_TOKEN_TTL_MINUTES"):
        make(stream_token_ttl_minutes=ttl)
    make(stream_token_ttl_minutes=24 * 60)


def test_customer_code_format():
    with pytest.raises(ValidationError, match="CF_STREAM_CUSTOMER_CODE"):
        make(cf_stream_customer_code="customer-abc.cloudflarestream.com")
