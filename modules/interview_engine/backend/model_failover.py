"""Bounded model ordering and short, process-local outage cooldowns."""

from threading import Lock
from time import monotonic

from .config import Settings

MAX_ATTEMPTS = 20
_cooldowns: dict[str, float] = {}
_lock = Lock()


def configured_models(settings: Settings) -> list[str]:
    models = []
    for value in [settings.gemini_model, *settings.gemini_fallback_models]:
        name = value.strip().removeprefix("models/")
        if name and name not in models:
            models.append(name)
    return models[:MAX_ATTEMPTS]


def available_models(settings: Settings) -> tuple[list[str], int]:
    now = monotonic()
    configured = configured_models(settings)
    with _lock:
        for model in list(_cooldowns):
            if _cooldowns[model] <= now:
                del _cooldowns[model]
        available = [model for model in configured if model not in _cooldowns]
        wait = min((_cooldowns[model] - now for model in configured if model in _cooldowns), default=0)
    return available, max(1, int(wait) + 1)


def mark_unavailable(model: str, settings: Settings) -> None:
    with _lock:
        _cooldowns[model] = monotonic() + settings.gemini_model_cooldown_seconds


def clear_cooldowns() -> None:
    """Reset process-local state for deterministic tests."""
    with _lock:
        _cooldowns.clear()
