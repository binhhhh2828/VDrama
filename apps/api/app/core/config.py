import secrets
from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# HS256 cần khóa tối thiểu 256 bit; ngắn hơn thì đoán được bằng vét cạn.
MIN_JWT_SECRET_BYTES = 32


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
        return self

    @property
    def app_db_url(self) -> str:
        return to_psycopg_url(self.database_url)

    @property
    def migration_db_url(self) -> str:
        return to_psycopg_url(self.database_url_direct or self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
