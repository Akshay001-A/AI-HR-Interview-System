from datetime import datetime, timezone
import json

from google import genai
from google.genai import types
import httpx
from pydantic import SecretStr
import pytest

from modules.interview_engine.backend.config import get_settings
from modules.interview_engine.backend.question_schemas import HRQuestion, QuestionPlan
from modules.interview_engine.backend.session_schemas import ProposedFollowup
from modules.interview_engine.backend import followup_service, question_service
from modules.interview_engine.backend.tests.test_gemini_questions import client, payload, proposed, no_live_google_requests

REAL_CLIENT = genai.Client
ANSWER = "I scheduled a team discussion to clarify responsibilities. We agreed on shared milestones and delivered the project together."


@pytest.fixture
def plan(payload):
    return QuestionPlan(
        plan_id="plan_synthetic", created_at=datetime.now(timezone.utc),
        settings={key: payload[key] for key in ["role", "category", "difficulty", "question_count"]},
        resume_context=payload["resume_context"], resume_profile=payload["resume_profile"],
        job_description=payload["job_description"], matched_skills=[], skill_gaps=["Teamwork"],
        questions=[HRQuestion(question_id=f"q{index}", **item.model_dump()) for index, item in enumerate(proposed().questions, 1)],
        model="gemini-test", notice="Synthetic plan for tests.",
    ).model_dump(mode="json")


def followup_proposal():
    return ProposedFollowup(question="How did your team respond to the decision to schedule a discussion?", focus="teamwork", answer_evidence="I scheduled a team discussion")


def followup_record(parent="q1"):
    return {**followup_proposal().model_dump(), "question_id": parent + "_followup", "parent_question_id": parent,
            "based_on_answer": ANSWER, "source": "gemini", "model": "gemini-test"}


def completion_body(plan, include_followup=False):
    answers = [{"question_id": q["question_id"], "question": q["question"], "answer": ANSWER,
                "input_mode": "text", "duration_seconds": 12.5} for q in plan["questions"]]
    followups = [followup_record()] if include_followup else []
    if include_followup:
        answers.insert(1, {"question_id": "q1_followup", "question": followups[0]["question"], "answer": "The team felt heard and agreed to take ownership of the next milestone.", "input_mode": "voice", "duration_seconds": 18.2})
    return {"session_id": "interview_test", "plan": plan, "followups": followups, "answers": answers}


def test_imported_plan_validation(client, plan):
    assert client.post("/api/interview/plan/validate", json=plan).status_code == 200
    plan["questions"][0]["question_id"] = "duplicate"
    assert client.post("/api/interview/plan/validate", json=plan).status_code == 422


def test_imported_draft_checks_its_followups(client, plan):
    body = {"plan": plan, "followups": [followup_record()]}
    assert client.post("/api/interview/draft/validate", json=body).status_code == 200
    body["followups"][0]["question"] = "Explain how SQL indexes work using your experience?"
    assert client.post("/api/interview/draft/validate", json=body).status_code == 422


def test_followup_limit_is_five_per_interview(client, plan):
    for index in range(4, 7):
        plan["questions"].append({"question_id": f"q{index}", "question": f"How did your team prioritize shared milestone {index} in your project experience?", "focus": "prioritization", "resume_evidence": "Student placement tracker", "jd_evidence": ""})
    plan["settings"]["question_count"] = 6
    followups = []
    for index in range(1, 6):
        child = followup_record(f"q{index}")
        child["question"] = f"How did your team communicate about shared decision number {index}?"
        followups.append(child)
    response = client.post("/api/interview/followup", json={"plan": plan, "question_id": "q6", "answer": ANSWER, "followups": followups})
    assert response.status_code == 422
    assert "five follow-ups" in response.json()["detail"]


def test_answer_dependent_followup_is_grounded(client, plan, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", SecretStr("test-key"))
    monkeypatch.setattr(followup_service, "call_followup", lambda request, **kwargs: followup_proposal())
    response = client.post("/api/interview/followup", json={"plan": plan, "question_id": "q1", "answer": ANSWER})
    assert response.status_code == 200, response.text
    value = response.json()["followup"]
    assert value["question_id"] == "q1_followup" and value["parent_question_id"] == "q1"
    assert value["based_on_answer"] == ANSWER and value["source"] == "gemini"
    assert value["answer_evidence"] in ANSWER


@pytest.mark.parametrize("question_id,answer,followups", [
    ("q1_followup", ANSWER, []), ("q1", "short", []), ("q1", ANSWER, [followup_record()]),
])
def test_invalid_followup_requests_do_not_call_ai(client, plan, question_id, answer, followups):
    response = client.post("/api/interview/followup", json={"plan": plan, "question_id": question_id, "answer": answer, "followups": followups})
    assert response.status_code == 422


@pytest.mark.parametrize("bad", ["technical", "fabricated_evidence", "duplicate"])
def test_followup_rejects_technical_or_ungrounded_output(client, plan, monkeypatch, bad):
    monkeypatch.setattr(get_settings(), "gemini_api_key", SecretStr("test-key"))
    value = followup_proposal()
    if bad == "technical": value.question = "Explain how SQL indexes work using your experience?"
    elif bad == "fabricated_evidence": value.answer_evidence = "I managed a hundred employees"
    else: value.question = plan["questions"][0]["question"]
    monkeypatch.setattr(followup_service, "call_followup", lambda request, **kwargs: value)
    response = client.post("/api/interview/followup", json={"plan": plan, "question_id": "q1", "answer": ANSWER})
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "invalid_output"


def test_complete_preserves_shared_interview_contract(client, plan):
    response = client.post("/api/interview/complete", json=completion_body(plan, True))
    assert response.status_code == 200, response.text
    value = response.json()
    assert value["schema_version"] == "1.0" and value["session_id"] == "interview_test"
    assert value["question_count"] == 3 and len(value["questions"]) == len(value["answers"]) == 4
    assert [q["question_id"] for q in value["questions"]] == ["q1", "q1_followup", "q2", "q3"]
    assert value["answers"][1]["input_mode"] == "voice"
    assert "score" not in value and "plan" not in value
    validated = client.post("/api/interview/validate", json=value)
    assert validated.status_code == 200 and validated.json() == value


@pytest.mark.parametrize("corruption", ["missing", "duplicate", "question_text", "parent_changed", "nested_followup", "technical_followup"])
def test_completion_rejects_broken_sessions(client, plan, corruption):
    body = completion_body(plan, True)
    if corruption == "missing": body["answers"].pop()
    elif corruption == "duplicate": body["answers"].append(body["answers"][0])
    elif corruption == "question_text": body["answers"][0]["question"] = "A different question?"
    elif corruption == "parent_changed": body["answers"][0]["answer"] = "I changed my answer after asking for the follow-up."
    elif corruption == "nested_followup": body["followups"][0]["parent_question_id"] = "q1_followup"
    else: body["followups"][0]["question"] = "Write a Python program to handle a team challenge?"
    assert client.post("/api/interview/complete", json=body).status_code == 422


def test_followup_sdk_includes_answer_and_hr_instruction(client, plan, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", SecretStr("test-key"))
    captured = []
    def respond(request):
        body = json.loads(request.content)
        captured.append(body)
        content = json.loads(body["contents"][0]["parts"][0]["text"])
        assert content["candidate_answer"] == ANSWER
        assert content["resume_context"] == plan["resume_context"]
        assert content["job_description"]["text"] == plan["job_description"]["text"]
        assert "Never ask technical theory" in body["systemInstruction"]["parts"][0]["text"]
        return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": [{"text": followup_proposal().model_dump_json()}]}, "finishReason": "STOP"}]})
    def fake_client(**kwargs):
        return REAL_CLIENT(api_key=kwargs["api_key"], http_options=types.HttpOptions(httpx_client=httpx.Client(transport=httpx.MockTransport(respond)), retry_options=types.HttpRetryOptions(attempts=1)))
    monkeypatch.setattr(question_service.genai, "Client", fake_client)
    response = client.post("/api/interview/followup", json={"plan": plan, "question_id": "q1", "answer": ANSWER})
    assert response.status_code == 200, response.text
    assert len(captured) == 1
