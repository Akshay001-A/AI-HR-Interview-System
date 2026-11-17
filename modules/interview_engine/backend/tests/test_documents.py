import pytest
import pymupdf
from fastapi.testclient import TestClient

from modules.interview_engine.backend.config import get_settings
from modules.interview_engine.backend.main import create_app
from modules.interview_engine.backend.profile_service import extract_skills


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


def make_pdf(text="", pages=1, encrypted=False):
    with pymupdf.open() as document:
        for _ in range(pages):
            page = document.new_page()
            if text:
                page.insert_text((50, 50), text)
        options = {"encryption": pymupdf.PDF_ENCRYPT_AES_256, "owner_pw": "owner", "user_pw": "secret"} if encrypted else {}
        return document.tobytes(**options)


RESUME = """Synthetic Student
Skills: Python, SQL, ReactJS, C++
Projects
Placement tracker with a Python API and PostgreSQL database.
Education
B.E. Information Science, 2023-2027
Experience
Software Intern - built an API with a three-person team.
Certifications
Introduction to cloud computing
"""


def test_resume_extracts_fields_and_source_without_saving(client):
    response = client.post("/api/interview/resume", files={"file": ("resume.pdf", make_pdf(RESUME), "application/pdf")})
    assert response.status_code == 200
    data = response.json()
    profile = data["resume_profile"]
    assert {"Python", "SQL", "React", "C++", "PostgreSQL"} <= set(profile["skills"])
    assert "C" not in profile["skills"]
    assert any("Placement tracker" in entry for entry in profile["projects"])
    assert any("B.E." in entry for entry in profile["education"])
    assert any("Software Intern" in entry for entry in profile["experience"])
    assert all("cloud computing" not in entry for entry in profile["experience"])
    assert "Synthetic Student" in data["extracted_text"]
    assert data["metadata"]["page_count"] == 1
    assert data["metadata"]["method"] == "local_rules"


def test_jd_pdf_and_paste_have_same_skills(client):
    text = "We require Python, JavaScript and teamwork for a graduate software developer role."
    pasted = client.post("/api/interview/jd", data={"text": text})
    uploaded = client.post("/api/interview/jd", files={"file": ("jd.pdf", make_pdf(text), "application/pdf")})
    assert pasted.status_code == uploaded.status_code == 200
    assert pasted.json()["job_description"] == uploaded.json()["job_description"]
    assert "filename" not in pasted.json()["metadata"]
    assert pasted.json()["job_description"]["required_skills"] == ["Python", "JavaScript", "Teamwork"]


@pytest.mark.parametrize("name,content,mime,status", [
    ("resume.txt", b"not a pdf", "text/plain", 415),
    ("resume.pdf", b"plain text disguised as pdf", "application/pdf", 415),
    ("resume.pdf", b"", "application/pdf", 422),
    ("resume.pdf", b"%PDF-1.4\ncorrupted data", "application/pdf", 422),
    ("resume.pdf", b"fake", "image/png", 415),
])
def test_rejects_invalid_uploads(client, name, content, mime, status):
    response = client.post("/api/interview/resume", files={"file": (name, content, mime)})
    assert response.status_code == status
    assert isinstance(response.json()["detail"], str)


@pytest.mark.parametrize("content,expected", [
    (lambda: make_pdf(), "selectable text"),
    (lambda: make_pdf(RESUME, encrypted=True), "password protected"),
    (lambda: make_pdf(RESUME, pages=21), "20 pages"),
])
def test_rejects_unusable_pdfs(client, content, expected):
    response = client.post("/api/interview/resume", files={"file": ("resume.pdf", content(), "application/pdf")})
    assert response.status_code == 422
    assert expected in response.json()["detail"]


def test_upload_limit_is_enforced(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_upload_bytes", 1024)
    response = client.post("/api/interview/resume", files={"file": ("large.pdf", b"%PDF-" + b"x" * 1024, "application/pdf")})
    assert response.status_code == 413


@pytest.mark.parametrize("text", ["", "too short", " " * 40, "x" * 30001])
def test_rejects_invalid_jd_text(client, text):
    assert client.post("/api/interview/jd", data={"text": text}).status_code == 422


def test_jd_requires_exactly_one_source(client):
    assert client.post("/api/interview/jd").status_code == 422
    response = client.post("/api/interview/jd", data={"text": "Python developer with teamwork skills"}, files={"file": ("jd.pdf", make_pdf(RESUME), "application/pdf")})
    assert response.status_code == 422


def test_word_boundaries_do_not_confuse_languages():
    skills = extract_skills("JavaScript, C++, C#, ReactJS and PostgreSQL")
    assert {"JavaScript", "C++", "C#", "React", "PostgreSQL"} <= set(skills)
    assert "Java" not in skills and "C" not in skills and "SQL" not in skills


def test_reviewed_custom_skills_and_aliases_are_compared(client):
    response = client.post("/api/interview/analyze", json={
        "resume_profile": {"skills": ["JS", "nodejs", "  Custom   Tool  ", "JavaScript"]},
        "job_description": {"text": "Seeking a developer with JavaScript, Node.js and Kubernetes skills.", "required_skills": ["JavaScript", "Node.js", "custom tool", "Kubernetes", "javascript"]},
    })
    assert response.status_code == 200
    data = response.json()
    assert data["matched_skills"] == ["JavaScript", "Node.js", "custom tool"]
    assert data["skill_gaps"] == ["Kubernetes"]
    assert data["resume_profile"]["skills"] == ["JS", "nodejs", "Custom   Tool"]
    assert data["schema_version"] == "preparation-1.0"
    assert "judgment of ability" in data["note"]


def test_unknown_skills_are_not_invented(client):
    response = client.post("/api/interview/jd", data={"text": "We need a skilled operator of the Quuxometer platform."})
    assert response.status_code == 200
    assert response.json()["job_description"]["required_skills"] == []
    assert any("manually" in warning for warning in response.json()["metadata"]["warnings"])


def test_rejects_overlong_review_fields(client):
    response = client.post("/api/interview/analyze", json={
        "resume_profile": {"skills": ["x" * 121]},
        "job_description": {"text": "A role with some custom requirements."},
    })
    assert response.status_code == 422
