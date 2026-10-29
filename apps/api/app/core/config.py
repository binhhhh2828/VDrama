import base64
import binascii
import re
import secrets
from functools import lru_cache
from typing import Literal

from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from pydantic import PrivateAttr, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# HS256 cần khóa tối thiểu 256 bit; ngắn hơn thì đoán được bằng vét cạn.
MIN_JWT_SECRET_BYTES = 32
MIN_STREAM_KEY_BITS = 2048
# Cloudflare không nhận token có `exp` quá 24 giờ kể từ lúc ký.
MAX_STREAM_TOKEN_TTL_MINUTES = 24 * 60
_CUSTOMER_CODE = re.compile(r"^[a-z0-9]+$")


def load_stream_signing_key(value: str) -> RSAPrivateKey:
    """Đọc khóa ký của Cloudflare Stream.

    Cloudflare trả trường `pem` đã mã base64; dán nguyên giá trị đó vào .env. Chấp nhận cả PEM
    thô (bắt đầu bằng -----BEGIN) cho tiện khi tự sinh khóa.
    """
    raw = value.strip()
    if raw.startswith("-----BEGIN"):
        pem = raw.encode()
    else:
        try:
            pem = base64.b64decode(raw, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("CF_STREAM_SIGNING_KEY_PEM không phải base64 hợp lệ") from None
    try:
        key = load_pem_private_key(pem, password=None)
    except (ValueError, TypeError):
        raise ValueError("CF_STREAM_SIGNING_KEY_PEM không phải khóa PEM hợp lệ") from None
    if not isinstance(key, RSAPrivateKey) or key.key_size < MIN_STREAM_KEY_BITS:
        raise ValueError(f"CF_STREAM_SIGNING_KEY_PEM phải là khóa RSA >= {MIN_STREAM_KEY_BITS} bit")
    return key


def to_psycopg_url(url: str) -> str:
    """Neon cấp URL dạng postgresql://; SQLAlchemy cần chỉ rõ driver psycopg 3."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: Literal["dev", "prod"] = "dev"
    app_name: str = "VDrama API"

    # App dùng URL qua pooler; migration dùng URL direct (trống thì dùng database_url).
    database_url: str = ""
    database_url_direct: str = ""
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: int = 10  # giây chờ lấy kết nối từ pool
    db_connect_timeout: int = 10  # giây chờ mở kết nối mới tới DB

    # --- Auth ---
    # Khóa ký access token. Bắt buộc ở prod. Ở dev để trống thì mỗi lần chạy sinh khóa ngẫu
    # nhiên (khởi động lại thì access token cũ hết hiệu lực, refresh token vẫn dùng được).
    jwt_secret: SecretStr = SecretStr("")
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    # Origin của site (scheme + host), dùng cho kiểm tra CSRF. Ví dụ https://vdrama.vn
    public_origin: str = "http://localhost:3000"
    # Cookie chỉ gửi qua HTTPS. Dev chạy http://localhost nên đặt false.
    cookie_secure: bool = True
    # Chỉ bật khi API nằm sau Cloudflare và firewall chỉ mở cho dải IP Cloudflare.
    trust_cloudflare_ip: bool = False

    # --- Cloudflare Stream ---
    # Gọi API Cloudflare: chỉ cho upload, đồng bộ trạng thái, lệnh cài đặt (không dùng khi xem).
    cf_account_id: str = ""
    cf_stream_api_token: SecretStr = SecretStr("")
    # Phần <code> trong domain phát customer-<code>.cloudflarestream.com
    cf_stream_customer_code: str = ""
    # Khóa ký token xem phim (tạo một lần bằng lệnh CLI). Ký ngay trong backend, không gọi API.
    cf_stream_signing_key_id: str = ""
    cf_stream_signing_key_pem: SecretStr = SecretStr("")
    cf_stream_webhook_secret: SecretStr = SecretStr("")
    # Hạn token xem phim; tự kéo dài nếu tập dài hơn (tối đa 24 giờ).
    stream_token_ttl_minutes: int = 180
    # Kích thước file video tối đa admin được upload (byte), mặc định 10 GB.
    stream_max_upload_bytes: int = 10 * 1024**3

    _stream_signing_key: RSAPrivateKey | None = PrivateAttr(default=None)

    @field_validator("public_origin")
    @classmethod
    def _strip_trailing_slash(cls, v: str) -> str:
        return v.rstrip("/")

    @model_validator(mode="after")
    def _check_security(self) -> "Settings":
        secret = self.jwt_secret.get_secret_value()
        if secret and len(secret.encode()) < MIN_JWT_SECRET_BYTES:
            raise ValueError(f"JWT_SECRET phải dài ít nhất {MIN_JWT_SECRET_BYTES} byte")
        if self.env == "prod":
            if not secret:
                raise ValueError("ENV=prod bắt buộc đặt JWT_SECRET")
            if not self.cookie_secure:
                raise ValueError("ENV=prod bắt buộc COOKIE_SECURE=true")
            if not self.public_origin.startswith("https://"):
                raise ValueError("ENV=prod bắt buộc PUBLIC_ORIGIN dạng https://...")
            # Prod chạy sau Cloudflare + Caddy: không đọc CF-Connecting-IP thì IP kết nối của mọi
            # request là IP của Caddy, rate limit gộp cả site vào một bộ đếm (10 lần đăng nhập
            # mỗi phút cho tất cả người dùng), sessions/audit_logs cũng mất IP thật.
            if not self.trust_cloudflare_ip:
                raise ValueError(
                    "ENV=prod bắt buộc TRUST_CLOUDFLARE_IP=true (API chạy sau Cloudflare; "
                    "firewall phải chỉ mở cho dải IP Cloudflare)"
                )
        elif not secret:
            self.jwt_secret = SecretStr(secrets.token_urlsafe(48))
        if self.access_token_ttl_minutes <= 0 or self.refresh_token_ttl_days <= 0:
            raise ValueError("Thời hạn token phải lớn hơn 0")
        self._check_stream()
        return self

    def _check_stream(self) -> None:
        if not 0 < self.stream_token_ttl_minutes <= MAX_STREAM_TOKEN_TTL_MINUTES:
            raise ValueError(
                f"STREAM_TOKEN_TTL_MINUTES phải trong khoảng 1–{MAX_STREAM_TOKEN_TTL_MINUTES}"
            )
        if self.stream_max_upload_bytes <= 0:
            raise ValueError("STREAM_MAX_UPLOAD_BYTES phải lớn hơn 0")
        code = self.cf_stream_customer_code
        if code and not _CUSTOMER_CODE.match(code):
            raise ValueError("CF_STREAM_CUSTOMER_CODE chỉ gồm chữ thường và số")
        pem = self.cf_stream_signing_key_pem.get_secret_value()
        if bool(pem) != bool(self.cf_stream_signing_key_id):
            raise ValueError(
                "CF_STREAM_SIGNING_KEY_ID và CF_STREAM_SIGNING_KEY_PEM phải đặt cùng nhau"
            )
        # Đọc khóa ngay lúc khởi động: khóa hỏng thì báo luôn, không đợi lượt xem đầu tiên.
        self._stream_signing_key = load_stream_signing_key(pem) if pem else None
        if self.env == "prod":
            missing = [
                name
                for name, value in (
                    ("CF_STREAM_CUSTOMER_CODE", code),
                    ("CF_STREAM_SIGNING_KEY_ID", self.cf_stream_signing_key_id),
                    ("CF_STREAM_WEBHOOK_SECRET", self.cf_stream_webhook_secret.get_secret_value()),
                )
                if not value
            ]
            if missing:
                raise ValueError("ENV=prod bắt buộc đặt " + ", ".join(missing))

    @property
    def stream_signing_key(self) -> RSAPrivateKey | None:
        return self._stream_signing_key

    @property
    def stream_playback_configured(self) -> bool:
        """Đủ cấu hình để cấp URL phát (dev có thể thiếu: `play` trả 503)."""
        return bool(self._stream_signing_key and self.cf_stream_customer_code)

    @property
    def app_db_url(self) -> str:
        return to_psycopg_url(self.database_url)

    @property
    def migration_db_url(self) -> str:
        return to_psycopg_url(self.database_url_direct or self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
