"""Hàm bảo mật: hash mật khẩu, access token (JWT), refresh token."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from argon2 import PasswordHasher

from app.core.config import get_settings
from app.core.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    dummy_verify_password,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    password_needs_rehash,
    verify_password,
)

SID = uuid.uuid4()


def secret() -> str:
    return get_settings().jwt_secret.get_secret_value()


# --- Mật khẩu ---


async def test_hash_and_verify():
    h = await hash_password("mat-khau-dai-du")
    assert h.startswith("$argon2id$")
    assert "mat-khau-dai-du" not in h
    assert await verify_password(h, "mat-khau-dai-du")
    assert not await verify_password(h, "mat-khau-sai")


async def test_same_password_different_hash():
    assert await hash_password("abcdefgh") != await hash_password("abcdefgh")


async def test_verify_garbage_hash_returns_false():
    assert not await verify_password("khong-phai-hash", "abcdefgh")
    assert not await verify_password("", "abcdefgh")


async def test_needs_rehash_when_params_change():
    current = await hash_password("abcdefgh")
    assert not password_needs_rehash(current)
    weak = PasswordHasher(time_cost=1, memory_cost=8 * 1024, parallelism=1).hash("abcdefgh")
    assert password_needs_rehash(weak)
    assert await verify_password(weak, "abcdefgh")  # hash cũ vẫn đăng nhập được
    assert password_needs_rehash("khong-phai-hash")


async def test_dummy_verify_runs():
    await dummy_verify_password()


# --- Access token ---


def test_access_token_roundtrip():
    claims = decode_access_token(create_access_token(42, SID))
    assert claims.user_id == 42
    assert claims.session_id == SID


def test_access_token_lifetime_from_settings():
    now = datetime.now(UTC).replace(microsecond=0)
    payload = jwt.decode(create_access_token(1, SID, now=now), secret(), algorithms=["HS256"])
    ttl = get_settings().access_token_ttl_minutes
    assert payload["exp"] - payload["iat"] == ttl * 60


def test_expired_token_rejected():
    old = datetime.now(UTC) - timedelta(hours=1)
    with pytest.raises(InvalidTokenError):
        decode_access_token(create_access_token(1, SID, now=old))


def test_wrong_signature_rejected():
    token = create_access_token(1, SID)
    payload = jwt.decode(token, options={"verify_signature": False})
    with pytest.raises(InvalidTokenError):
        decode_access_token(jwt.encode(payload, "k" * 40, algorithm="HS256"))
    header, body, sig = token.split(".")
    tampered_sig = ("A" if sig[0] != "A" else "B") + sig[1:]
    with pytest.raises(InvalidTokenError):
        decode_access_token(f"{header}.{body}.{tampered_sig}")


def test_alg_none_rejected():
    payload = jwt.decode(create_access_token(1, SID), options={"verify_signature": False})
    unsigned = jwt.encode(payload, None, algorithm="none")
    with pytest.raises(InvalidTokenError):
        decode_access_token(unsigned)


def _sign(**overrides) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": "1",
        "sid": str(SID),
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(minutes=5),
        **overrides,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    return jwt.encode(payload, secret(), algorithm="HS256")


@pytest.mark.parametrize(
    "overrides",
    [
        {"typ": "refresh"},  # sai loại token
        {"typ": None},  # thiếu loại token
        {"sid": None},
        {"sub": None},
        {"exp": None},
        {"iat": None},
        {"sid": "khong-phai-uuid"},
        {"sub": "abc"},
    ],
)
def test_bad_claims_rejected(overrides):
    with pytest.raises(InvalidTokenError):
        decode_access_token(_sign(**overrides))


def test_garbage_token_rejected():
    for token in ("", "abc", "a.b.c"):
        with pytest.raises(InvalidTokenError):
            decode_access_token(token)


# --- Refresh token ---


def test_refresh_tokens_unique_and_long():
    tokens = {new_refresh_token() for _ in range(1000)}
    assert len(tokens) == 1000
    assert all(len(t) >= 43 for t in tokens)  # 32 byte base64url


def test_refresh_token_hash_is_sha256():
    t = new_refresh_token()
    h = hash_refresh_token(t)
    assert len(h) == 64 and h == hash_refresh_token(t)
    assert t not in h
    assert hash_refresh_token(new_refresh_token()) != h
