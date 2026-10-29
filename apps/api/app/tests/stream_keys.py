"""Khóa ký Stream dùng trong test (sinh RSA chậm nên sinh một lần cho cả lượt chạy)."""

import base64
from functools import lru_cache

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

KEY_ID = "test-signing-key-id"
CUSTOMER_CODE = "testcode123"
WEBHOOK_SECRET = "test-webhook-secret"
ACCOUNT_ID = "test-account-id"
API_TOKEN = "test-cf-api-token"


@lru_cache
def _key(bits: int) -> RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=bits)


def private_key(bits: int = 2048) -> RSAPrivateKey:
    return _key(bits)


def pem(bits: int = 2048) -> bytes:
    return private_key(bits).private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )


def pem_b64(bits: int = 2048) -> str:
    """Đúng dạng Cloudflare trả trong trường `pem` (PEM mã base64)."""
    return base64.b64encode(pem(bits)).decode()


def stream_settings() -> dict[str, str]:
    """Các trường Settings để cấp URL phát và gọi API Cloudflare (giả)."""
    return {
        "cf_stream_customer_code": CUSTOMER_CODE,
        "cf_stream_signing_key_id": KEY_ID,
        "cf_stream_signing_key_pem": pem_b64(),
        "cf_stream_webhook_secret": WEBHOOK_SECRET,
        "cf_account_id": ACCOUNT_ID,
        "cf_stream_api_token": API_TOKEN,
    }


def stream_env() -> dict[str, str]:
    """Như `stream_settings()` nhưng dạng biến môi trường."""
    return {k.upper(): v for k, v in stream_settings().items()}
