from functools import lru_cache
from pathlib import Path
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    gemini_api_key: SecretStr = SecretStr('')
    gemini_model: str = 'gemini-flash-latest'
    gemini_fallback_models: list[str] = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
    gemini_request_budget_seconds: float = Field(default=60, ge=5, le=180)
    gemini_model_timeout_seconds: float = Field(default=18, ge=1, le=60)
    storage_backend: str = Field(default='sqlite', pattern='^(sqlite|mongodb)$')
    sqlite_path: Path = ROOT / '.cache' / 'feedback.sqlite3'
    mongodb_uri: SecretStr = SecretStr('mongodb://localhost:27017/')
    database_name: str = 'ai_hr_interview'
    cors_origins: list[str] = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174']


@lru_cache
def get_settings():
    return Settings()
