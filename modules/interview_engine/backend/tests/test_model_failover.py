from types import SimpleNamespace

from google.genai import errors
import httpx
from pydantic import SecretStr, ValidationError
import pytest

from modules.interview_engine.backend.config import Settings, get_settings
from modules.interview_engine.backend import model_failover, question_service as service
from modules.interview_engine.backend.tests.test_gemini_questions import client, payload, proposed, no_live_google_requests


@pytest.fixture(autouse=True)
def configured_chain(monkeypatch, no_live_google_requests):
    monkeypatch.setattr(get_settings(), "gemini_api_key", SecretStr("test-key"))
    monkeypatch.setattr(get_settings(), "gemini_fallback_models", ["gemini-2.5-flash", "gemini-2.5-flash-lite"])


def error_with_code(code):
    return errors.APIError(code, {"error": {"code": code, "message": "temporary failure"}})


@pytest.mark.parametrize("failure", [503, 500, 502, 504, 404, "timeout", "network"])
def test_transient_failure_uses_next_model(client, payload, monkeypatch, failure):
    calls = []
    def attempt(request, **kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            if failure == "timeout": raise httpx.ReadTimeout("private transport details")
            if failure == "network": raise httpx.ConnectError("private transport details")
            raise error_with_code(failure)
        return proposed()
    monkeypatch.setattr(service, "call_gemini", attempt)
    response = client.post("/api/interview/generate", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert [item["model"] for item in calls] == ["gemini-flash-latest", "gemini-2.5-flash"]
    assert data["model"] == "gemini-2.5-flash"
    assert data["models_attempted"] == ["gemini-flash-latest", "gemini-2.5-flash"]
    assert data["attempt_count"] == 2
    assert data["source"] == "gemini"
    assert "private" not in response.text


@pytest.mark.parametrize("status", [400, 401, 403, 429])
def test_auth_and_quota_errors_stop_chain(client, payload, monkeypatch, status):
    calls = []
    def attempt(request, **kwargs):
        calls.append(kwargs["model"])
        raise error_with_code(status)
    monkeypatch.setattr(service, "call_gemini", attempt)
    response = client.post("/api/interview/generate", json=payload)
    assert response.status_code in (429, 502)
    assert len(calls) == 1


def test_recently_failed_model_is_skipped_on_next_request(client, payload, monkeypatch):
    calls = []
    def attempt(request, **kwargs):
        calls.append(kwargs["model"])
        if kwargs["model"] == "gemini-flash-latest": raise error_with_code(503)
        return proposed()
    monkeypatch.setattr(service, "call_gemini", attempt)
    assert client.post("/api/interview/generate", json=payload).status_code == 200
    assert client.post("/api/interview/generate", json=payload).status_code == 200
    assert calls == ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash"]


def test_all_models_busy_then_cooldown_returns_retry_header(client, payload, monkeypatch):
    calls = []
    def attempt(request, **kwargs):
        calls.append(kwargs["model"])
        raise error_with_code(503)
    monkeypatch.setattr(service, "call_gemini", attempt)
    first = client.post("/api/interview/generate", json=payload)
    assert first.status_code == 503
    assert len(first.json()["detail"]["models_attempted"]) == 3
    second = client.post("/api/interview/generate", json=payload)
    assert second.status_code == 503
    assert second.json()["detail"]["code"] == "models_cooling_down"
    assert int(second.headers["retry-after"]) >= 1
    assert len(calls) == 3


def test_elapsed_budget_prevents_another_attempt(client, payload, monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(service, "monotonic", lambda: clock[0])
    calls = []
    def attempt(request, **kwargs):
        calls.append(kwargs)
        clock[0] += get_settings().gemini_request_budget_seconds
        raise error_with_code(503)
    monkeypatch.setattr(service, "call_gemini", attempt)
    response = client.post("/api/interview/generate", json=payload)
    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "generation_deadline"
    assert len(calls) == 1
    assert calls[0]["timeout_seconds"] <= get_settings().gemini_model_timeout_seconds


def test_model_ids_are_deduplicated_and_capped():
    settings = Settings(_env_file=None, gemini_model="gemini-2.5-flash", gemini_fallback_models=["models/gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-lite"])
    assert model_failover.configured_models(settings) == ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
    with pytest.raises(ValidationError):
        Settings(_env_file=None, gemini_fallback_models=["https://untrusted.example/model"])
    with pytest.raises(ValidationError):
        Settings(_env_file=None, gemini_fallback_models=[f"gemini-test-{i}" for i in range(20)])


def test_at_most_twenty_provider_calls(client, payload, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_fallback_models", [f"gemini-test-{i}" for i in range(19)])
    monkeypatch.setattr(service, "monotonic", lambda: 100)
    calls = []
    def attempt(request, **kwargs):
        calls.append(kwargs)
        raise error_with_code(503)
    monkeypatch.setattr(service, "call_gemini", attempt)
    response = client.post("/api/interview/generate", json=payload)
    assert response.status_code == 503
    assert len(calls) == 20
