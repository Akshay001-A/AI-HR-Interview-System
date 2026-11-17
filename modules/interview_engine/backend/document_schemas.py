"""Editable preparation data, separate from the completed interview contract."""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from .schemas import ContractModel

Skill = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Entry = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=30000)]


class ReviewedResume(ContractModel):
    skills: list[Skill] = Field(default_factory=list, max_length=100)
    projects: list[Entry] = Field(default_factory=list, max_length=60)
    education: list[Entry] = Field(default_factory=list, max_length=60)
    experience: list[Entry] = Field(default_factory=list, max_length=60)


class ReviewedJD(ContractModel):
    text: Text
    required_skills: list[Skill] = Field(default_factory=list, max_length=100)


class DocumentMetadata(ContractModel):
    filename: str | None = None
    page_count: int | None = None
    method: Literal["local_rules"] = "local_rules"
    warnings: list[str] = Field(default_factory=list)


class ResumeExtraction(ContractModel):
    resume_profile: ReviewedResume
    extracted_text: str
    metadata: DocumentMetadata


class JDExtraction(ContractModel):
    job_description: ReviewedJD
    metadata: DocumentMetadata


class PreparationInput(ContractModel):
    resume_profile: ReviewedResume
    job_description: ReviewedJD


class PreparationResult(PreparationInput):
    schema_version: Literal["preparation-1.0"] = "preparation-1.0"
    matched_skills: list[str]
    skill_gaps: list[str]
    note: str = (
        "Matches compare reviewed skill lists using known aliases. A gap means the skill "
        "was not listed in the resume profile; it is not a judgment of ability. "
        "Requirements may include preferred or negated terms: review the JD list first."
    )
