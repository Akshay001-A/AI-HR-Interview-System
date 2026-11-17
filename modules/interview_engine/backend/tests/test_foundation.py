from copy import deepcopy
import json

from fastapi.testclient import TestClient
import pytest

from modules.interview_engine.backend.config import get_settings
from modules.interview_engine.backend.main import create_app
from modules.interview_engine.backend.routes import CONTRACTS_DIR
from modules.interview_engine.backend.schemas import InterviewSession


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


@pytest.fixture
def session():
    return json.loads((CONTRACTS_DIR / "interview.sample.json").read_text(encoding="utf-8"))


def test_health_does_not_expose_secrets(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "private-test-api-key")
    monkeypatch.setenv("MONGODB_URI", "mongodb://private-test-uri")
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            response = client.get("/api/health")
            assert response.status_code == 200
            assert response.json()["status"] == "ok"
            assert "private-test" not in response.text
            assert response.json()["integrations"]["gemini"] == "configured"
    finally:
        get_settings.cache_clear()


def test_sample_roundtrip(client, session):
    sample = client.get("/api/interview/sample")
    assert sample.status_code == 200
    validated = client.post("/api/interview/validate", json=sample.json())
    assert validated.status_code == 200
    assert validated.json() == sample.json()
    assert validated.json()["session_id"] == session["session_id"]
    assert "duration_seconds" not in validated.json()["answers"][0]


@pytest.mark.parametrize("corruption", [
    "blank_answer", "missing_answer", "duplicate_question", "unknown_question",
    "wrong_question_text", "wrong_question_count", "cyclic_followup", "negative_duration",
    "unknown_field", "duplicate_answer", "unsupported_version",
])
def test_rejects_broken_handoffs(client, session, corruption):
    if corruption == "blank_answer":
        session["answers"][0]["answer"] = "  "
    elif corruption == "missing_answer":
        session["answers"] = []
    elif corruption == "duplicate_question":
        session["questions"].append(deepcopy(session["questions"][0]))
    elif corruption == "unknown_question":
        session["answers"][0]["question_id"] = "missing"
    elif corruption == "wrong_question_text":
        session["answers"][0]["question"] = "Different question"
    elif corruption == "wrong_question_count":
        session["question_count"] = 2
    elif corruption == "cyclic_followup":
        session["questions"][0]["parent_question_id"] = "q1"
    elif corruption == "negative_duration":
        session["answers"][0]["duration_seconds"] = -1
    elif corruption == "unknown_field":
        session["api_key"] = "should-not-be-here"
    elif corruption == "duplicate_answer":
        session["answers"].append(deepcopy(session["answers"][0]))
    else:
        session["schema_version"] = "2.0"
    assert client.post("/api/interview/validate", json=session).status_code == 422


def test_followup_is_additional_to_primary_count(client, session):
    question = {"question_id": "q2", "question": "What did you learn?", "parent_question_id": "q1"}
    session["questions"].append(question)
    session["answers"].append({
        "question_id": "q2", "question": question["question"],
        "answer": "I learned to agree on the API contract early.", "input_mode": "voice",
        "duration_seconds": 12.5,
    })
    assert client.post("/api/interview/validate", json=session).status_code == 200


def test_cors_only_allows_local_frontend(client):
    for origin, allowed in [("http://localhost:5173", True), ("https://unrelated.example", False)]:
        response = client.options("/api/interview/validate", headers={
            "Origin": origin, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        assert (response.headers.get("access-control-allow-origin") == origin) is allowed


def test_checked_in_schema_matches_models():
    checked_in = json.loads((CONTRACTS_DIR / "interview.schema.json").read_text(encoding="utf-8"))
    checked_in.pop("$schema")
    assert checked_in == InterviewSession.model_json_schema()
