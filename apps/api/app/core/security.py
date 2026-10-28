"""Hàm bảo mật dùng chung: hash mật khẩu, access token (JWT), refresh token.

- Mật khẩu: argon2id. Hash/verify tốn CPU (cố ý) nên chạy trong thread riêng để không chặn
  event loop; vì vậy các hàm public là async.
- Access token: JWT HS256, sống ngắn (mặc định 15 phút), không lưu ở server.
- Refresh token: chuỗi ngẫu nhiên 256 bit, server chỉ lưu SHA-256 của nó (sessions).
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from anyio import to_thread
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_BYTES = 32  # 256 bit

_hasher = PasswordHasher()  # argon2id, tham số mặc định của thư viện


# --- Mật khẩu ---


async def hash_password(password: str) -> str:
    return await to_thread.run_sync(_hasher.hash, password)


def _verify(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


async def verify_password(password_hash: str, password: str) -> bool:
    return await to_thread.run_sync(_verify, password_hash, password)


def password_needs_rehash(password_hash: str) -> bool:
    """True khi hash tạo bằng tham số cũ: hash lại sau lần đăng nhập thành công."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


@lru_cache
def _dummy_hash() -> str:
    return _hasher.hash(secrets.token_urlsafe(16))


async def dummy_verify_password() -> None:
    """Verify giả khi email không tồn tại, để thời gian phản hồi giống như sai mật khẩu."""
    dummy = await to_thread.run_sync(_dummy_hash)
    await verify_password(dummy, "not-the-password")


# --- Access token (JWT) ---


class InvalidTokenError(Exception):
    """Token sai chữ ký, hết hạn, sai loại hoặc thiếu claim. Không phân biệt lý do với client."""


@dataclass(frozen=True)
class AccessClaims:
    user_id: int
    session_id: uuid.UUID


def create_access_token(user_id: int, session_id: uuid.UUID, now: datetime | None = None) -> str:
    settings = get_settings()
    issued = now or datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "typ": ACCESS_TOKEN_TYPE,
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.access_token_ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> AccessClaims:
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=[JWT_ALGORITHM],  # cố định thuật toán: chặn "alg": "none" và đổi thuật toán
            options={"require": ["sub", "sid", "typ", "iat", "exp"]},
        )
        if payload["typ"] != ACCESS_TOKEN_TYPE:
            raise InvalidTokenError("wrong token type")
        return AccessClaims(user_id=int(payload["sub"]), session_id=uuid.UUID(payload["sid"]))
    except InvalidTokenError:
        raise
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise InvalidTokenError(str(exc)) from exc


# --- Refresh token ---


def new_refresh_token() -> str:
    return secrets.token_urlsafe(REFRESH_TOKEN_BYTES)


def hash_refresh_token(token: str) -> str:
    """SHA-256 là đủ (không cần argon2): token đã ngẫu nhiên 256 bit, không dò được."""
    return hashlib.sha256(token.encode()).hexdigest()
