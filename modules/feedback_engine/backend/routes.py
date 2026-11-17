import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any

from .feedback_service import generate_feedback_report
from .database import get_feedback, list_saved_sessions

router = APIRouter()

CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "contracts"


@router.post("/evaluate")
def evaluate_interview(interview_data: Dict[str, Any] = Body(...)):
    """
    POST /api/feedback/evaluate
    Evaluates Akshay's completed interview JSON, produces detailed scoring,
    communication analysis, sample answers, and saves to MongoDB.
    """
    try:
        report = generate_feedback_report(interview_data)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@router.get("/report/{session_id}")
def get_report(session_id: str):
    """
    GET /api/feedback/report/{session_id}
    Retrieves saved feedback report from MongoDB for the specified session_id.
    """
    report = get_feedback(session_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report for session '{session_id}' not found.")
    return report


@router.get("/sample")
def get_sample_interview():
    """
    GET /api/feedback/sample
    Provides sample interview contract JSON for standalone testing without Akshay's backend.
    """
    interview_file = CONTRACTS_DIR / "interview.json"
    if interview_file.exists():
        with open(interview_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "session_id": "session_001",
        "role": "Software Developer",
        "category": "HR",
        "difficulty": "Beginner",
        "resume_profile": {
            "skills": ["Python", "SQL"],
            "projects": ["Machine Learning Project"]
        },
        "job_description": {
            "text": "Seeking Python, SQL and teamwork skills.",
            "required_skills": ["Python", "SQL", "Teamwork"]
        },
        "answers": [
            {
                "question_id": "q1",
                "question": "Why are you suitable for this role?",
                "answer": "I have worked with Python and SQL.",
                "input_mode": "voice",
                "duration_seconds": 35
            }
        ]
    }


@router.get("/history")
def get_history():
    """
    GET /api/feedback/history
    Lists all saved session IDs.
    """
    return {"sessions": list_saved_sessions()}
