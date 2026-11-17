"""The versioned handoff to the feedback engine. Scores belong to Charan."""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Category(StrEnum):
    HR = "HR"
    BEHAVIORAL = "Behavioral"
    SITUATIONAL = "Situational"


class Difficulty(StrEnum):
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"


class InterviewSettings(ContractModel):
    role: NonBlank = Field(max_length=120)
    category: Category = Category.HR
    difficulty: Difficulty = Difficulty.BEGINNER
    question_count: int = Field(default=5, ge=1, le=15, strict=True)


class ResumeProfile(ContractModel):
    skills: list[NonBlank] = Field(default_factory=list)
    projects: list[NonBlank] = Field(default_factory=list)
    education: list[NonBlank] = Field(default_factory=list)
    experience: list[NonBlank] = Field(default_factory=list)


class JobDescription(ContractModel):
    text: NonBlank = Field(max_length=30000)
    required_skills: list[NonBlank] = Field(default_factory=list)


class Question(ContractModel):
    question_id: NonBlank
    question: NonBlank = Field(max_length=5000)
    parent_question_id: NonBlank | None = None


class Answer(ContractModel):
    question_id: NonBlank
    question: NonBlank = Field(max_length=5000)
    answer: NonBlank = Field(max_length=20000)
    input_mode: Literal["text", "voice"]
    # Missing timing is unknown, never a fabricated zero.
    duration_seconds: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class InterviewSession(InterviewSettings):
    schema_version: Literal["1.0"] = "1.0"
    session_id: NonBlank = Field(max_length=100)
    resume_profile: ResumeProfile
    job_description: JobDescription
    matched_skills: list[NonBlank] = Field(default_factory=list)
    skill_gaps: list[NonBlank] = Field(default_factory=list)
    questions: list[Question] = Field(min_length=1)
    answers: list[Answer] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_completed_session(self) -> "InterviewSession":
        questions = {q.question_id: q for q in self.questions}
        if len(questions) != len(self.questions):
            raise ValueError("Question IDs must be unique.")
        answer_ids = [a.question_id for a in self.answers]
        if len(set(answer_ids)) != len(answer_ids):
            raise ValueError("An answer may appear only once per question.")
        if set(answer_ids) != set(questions):
            raise ValueError("A completed session must answer every question exactly once.")
        roots = [q for q in self.questions if q.parent_question_id is None]
        if len(roots) != self.question_count:
            raise ValueError("question_count must match the number of primary questions.")
        seen: set[str] = set()
        for question in self.questions:
            if question.parent_question_id is not None and question.parent_question_id not in seen:
                raise ValueError("Follow-ups must reference an earlier question.")
            seen.add(question.question_id)
        for answer in self.answers:
            if answer.question != questions[answer.question_id].question:
                raise ValueError("Answer question text must match its question ID.")
        return self
