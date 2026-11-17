"""Server-only configuration; optional services are enabled in later phases."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).with_name(".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )
    gemini_api_key: SecretStr = SecretStr("")
    mongodb_uri: SecretStr = SecretStr("")
    mongodb_database: str = "ai_hr_interview"
    gemini_model: str = "gemini-2.5-flash"
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, ge=1024, le=25 * 1024 * 1024)
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
