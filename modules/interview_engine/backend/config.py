"""Server-only configuration; optional services are enabled in later phases."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
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
    gemini_model: str = "gemini-flash-latest"
    gemini_fallback_models: list[str] = Field(default_factory=lambda: [
        "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash",
    ], max_length=19)
    gemini_model_timeout_seconds: float = Field(default=18, ge=5, le=35)
    gemini_request_budget_seconds: float = Field(default=60, ge=10, le=90)
    gemini_model_cooldown_seconds: float = Field(default=45, ge=5, le=300)
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, ge=1024, le=25 * 1024 * 1024)
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("gemini_fallback_models")
    @classmethod
    def clean_model_ids(cls, values: list[str]) -> list[str]:
        import re
        cleaned = []
        for value in values:
            name = value.strip().removeprefix("models/")
            if not re.fullmatch(r"gemini-[a-z0-9._-]+", name):
                raise ValueError("Fallback models must be Gemini model IDs, not URLs.")
            if name not in cleaned:
                cleaned.append(name)
        return cleaned


@lru_cache
def get_settings() -> Settings:
    return Settings()
