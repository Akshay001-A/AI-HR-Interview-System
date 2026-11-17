"""Phase 3 question plans; separate from answered interview sessions."""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from .document_schemas import PreparationInput
from .schemas import ContractModel, InterviewSettings, NonBlank


class HRFocus(StrEnum):
    MOTIVATION = "motivation"
    SELF_AWARENESS = "self_awareness"
    TEAMWORK = "teamwork"
    COMMUNICATION = "communication"
    CONFLICT = "conflict"
    OWNERSHIP = "ownership"
    PRIORITIZATION = "prioritization"
    ADAPTABILITY = "adaptability"
    LEARNING = "learning"
    RESILIENCE = "resilience"
    LEADERSHIP = "leadership"
    INTEGRITY = "integrity"
    FEEDBACK = "feedback"
    CAREER_GOALS = "career_goals"
    ROLE_ALIGNMENT = "role_alignment"


class GenerationRequest(PreparationInput, InterviewSettings):
    resume_context: Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=60000)]
    previous_questions: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=600)]] = Field(default_factory=list, max_length=30)


class ProposedQuestion(ContractModel):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=600)]
    focus: HRFocus
    resume_evidence: str = Field(default="", max_length=240)
    jd_evidence: str = Field(default="", max_length=240)


class ProposedQuestions(ContractModel):
    questions: list[ProposedQuestion] = Field(min_length=1, max_length=15)


class HRQuestion(ProposedQuestion):
    question_id: NonBlank


class QuestionPlan(PreparationInput):
    schema_version: Literal["question-plan-2.0"] = "question-plan-2.0"
    plan_id: NonBlank = Field(max_length=100)
    created_at: datetime
    settings: InterviewSettings
    resume_context: Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=60000)]
    matched_skills: list[str]
    skill_gaps: list[str]
    questions: list[HRQuestion] = Field(min_length=1, max_length=15)
    source: Literal["gemini"] = "gemini"
    model: NonBlank = Field(max_length=120)
    models_attempted: list[Annotated[str, StringConstraints(max_length=120)]] = Field(default_factory=list, max_length=20)
    attempt_count: int = Field(default=1, ge=1, le=20)
    elapsed_seconds: float = Field(default=0, ge=0)
    notice: str = Field(max_length=2000)
