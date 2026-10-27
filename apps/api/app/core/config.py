from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


def to_psycopg_url(url: str) -> str:
    """Neon cấp URL dạng postgresql://; SQLAlchemy cần chỉ rõ driver psycopg 3."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"  # dev | prod
    app_name: str = "VDrama API"

    # App dùng URL qua pooler; migration dùng URL direct (trống thì dùng database_url).
    database_url: str = ""
    database_url_direct: str = ""
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout: int = 10  # giây chờ lấy kết nối từ pool
    db_connect_timeout: int = 10  # giây chờ mở kết nối mới tới DB

    @property
    def app_db_url(self) -> str:
        return to_psycopg_url(self.database_url)

    @property
    def migration_db_url(self) -> str:
        return to_psycopg_url(self.database_url_direct or self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
