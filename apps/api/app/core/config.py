from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"  # dev | prod
    app_name: str = "VDrama API"
    database_url: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
