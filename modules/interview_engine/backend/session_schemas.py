"""Phase 4 answer-dependent follow-ups and stateless completion requests."""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from .question_schemas import HRFocus, QuestionPlan
from .schemas import Answer, ContractModel, NonBlank

AnswerText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=20000)]


class ProposedFollowup(ContractModel):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=600)]
    focus: HRFocus
    answer_evidence: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=240)]


class FollowupQuestion(ProposedFollowup):
    question_id: NonBlank = Field(max_length=100)
    parent_question_id: NonBlank = Field(max_length=100)
    based_on_answer: AnswerText
    source: Literal["gemini"] = "gemini"
    model: NonBlank = Field(max_length=120)


class FollowupRequest(ContractModel):
    plan: QuestionPlan
    question_id: NonBlank = Field(max_length=100)
    answer: AnswerText
    followups: list[FollowupQuestion] = Field(default_factory=list, max_length=5)


class FollowupResult(ContractModel):
    followup: FollowupQuestion
    models_attempted: list[str]
    attempt_count: int
    elapsed_seconds: float


class CompleteInterviewRequest(ContractModel):
    session_id: NonBlank = Field(max_length=100)
    plan: QuestionPlan
    followups: list[FollowupQuestion] = Field(default_factory=list, max_length=5)
    answers: list[Answer] = Field(min_length=1, max_length=20)


class DraftContextRequest(ContractModel):
    plan: QuestionPlan
    followups: list[FollowupQuestion] = Field(default_factory=list, max_length=5)
