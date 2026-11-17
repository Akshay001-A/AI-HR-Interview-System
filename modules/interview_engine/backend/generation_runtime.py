"""Shared bounded Gemini failover for question plans and adaptive follow-ups."""

from dataclasses import dataclass

from fastapi import HTTPException
from google.genai import errors
import httpx
from pydantic import ValidationError

from .config import get_settings
from .model_failover import MAX_ATTEMPTS, available_models, mark_unavailable


@dataclass
class GenerationOutcome:
    output: object
    model: str
    models_attempted: list[str]
    attempt_count: int
    elapsed_seconds: float


def run_generation(invoke, validate, *, slots, clock, error_factory, repair_instruction):
    settings = get_settings()
    started = clock()
    deadline = started + settings.gemini_request_budget_seconds
    attempted, attempts, last_failure = [], 0, None
    if not settings.gemini_api_key.get_secret_value().strip():
        raise HTTPException(503, {"code": "missing_key", "message": "Add GEMINI_API_KEY to the backend .env and restart the backend. Questions are generated only by Gemini."})
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Question generation is busy. Please try again shortly.", headers={"Retry-After": "5"})
    try:
        models, wait = available_models(settings)
        if not models:
            raise HTTPException(503, {"code": "models_cooling_down", "message": "The configured Gemini models recently reported temporary failures. Please try again shortly."}, headers={"Retry-After": str(wait)})
        for model in models:
            if attempts >= MAX_ATTEMPTS or deadline - clock() < 1:
                break
            feedback = None
            for repair in range(2):
                remaining = deadline - clock()
                if attempts >= MAX_ATTEMPTS or remaining < 1:
                    break
                if model not in attempted:
                    attempted.append(model)
                attempts += 1
                try:
                    output = invoke(validation_feedback=feedback, model=model,
                                    timeout_seconds=min(settings.gemini_model_timeout_seconds, remaining))
                    validate(output)
                    return GenerationOutcome(output, model, attempted, attempts, round(clock() - started, 2))
                except (ValidationError, ValueError):
                    feedback = repair_instruction
                    last_failure = HTTPException(502, {"code": "invalid_output", "message": "Gemini did not produce valid, fresh HR questions after validation and repair. Please try again or review the context.", "models_attempted": attempted.copy(), "attempt_count": attempts})
                    if repair == 1:
                        raise last_failure from None
                except (errors.APIError, httpx.HTTPError, TimeoutError, ConnectionError, RuntimeError) as error:
                    code = getattr(error, "code", None)
                    if code in (400, 401, 403, 429):
                        raise error_factory(error) from None
                    retryable = code in (404, 500, 502, 503, 504) or isinstance(error, (httpx.TransportError, TimeoutError, ConnectionError))
                    last_failure = error_factory(error)
                    if not retryable:
                        raise last_failure from None
                    mark_unavailable(model, settings)
                    break
    finally:
        slots.release()
    if deadline - clock() < 1:
        raise HTTPException(504, {"code": "generation_deadline", "message": f"Gemini generation reached its time budget after trying {len(attempted)} model(s). Please try again shortly. No fixed questions were substituted."})
    if last_failure:
        detail = dict(last_failure.detail) if isinstance(last_failure.detail, dict) else {"message": last_failure.detail}
        detail.update(models_attempted=attempted, attempt_count=attempts)
        detail["message"] = f"Tried {len(attempted)} Gemini model(s). " + detail["message"]
        raise HTTPException(last_failure.status_code, detail, headers=last_failure.headers)
    raise HTTPException(503, {"code": "models_unavailable", "message": "No Gemini model completed generation. Please try again shortly."})
