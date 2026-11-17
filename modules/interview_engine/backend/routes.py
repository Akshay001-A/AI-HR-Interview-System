"""Standalone foundation and document preparation endpoints."""

from pathlib import Path

from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from .schemas import Category, Difficulty, InterviewSession
from .document_schemas import (
    DocumentMetadata, JDExtraction, PreparationInput, PreparationResult,
    ResumeExtraction,
)
from .pdf_service import extract_pdf, read_upload
from .profile_service import compare_profiles, extract_jd, extract_resume

router = APIRouter()
CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "contracts"


@router.get("/options")
def interview_options():
    return {
        "categories": [c.value for c in Category],
        "difficulties": [d.value for d in Difficulty],
        "question_count": {"min": 1, "max": 15, "default": 5},
    }


@router.get("/sample", response_model=InterviewSession, response_model_exclude_none=True)
def sample_interview():
    """Synthetic fixture for independent development, never a real interview."""
    return InterviewSession.model_validate_json(
        (CONTRACTS_DIR / "interview.sample.json").read_text(encoding="utf-8")
    )


@router.post("/validate", response_model=InterviewSession, response_model_exclude_none=True)
def validate_interview(session: InterviewSession):
    """Validate the completed handoff without persisting or evaluating it."""
    return session


@router.post("/resume", response_model=ResumeExtraction, response_model_exclude_none=True)
async def upload_resume(file: Annotated[UploadFile, File(description="Text-based resume PDF, at most 10 MB and 20 pages.")]):
    data = await read_upload(file)
    document = await run_in_threadpool(extract_pdf, data, file.filename or "resume.pdf")
    profile, warnings = extract_resume(document.text)
    return ResumeExtraction(
        resume_profile=profile,
        extracted_text=document.text,
        metadata=DocumentMetadata(filename=document.filename, page_count=document.page_count, warnings=[*document.warnings, *warnings]),
    )


@router.post("/jd", response_model=JDExtraction, response_model_exclude_none=True)
async def upload_job_description(
    file: Annotated[UploadFile | None, File(description="JD PDF. Send exactly one of file or text.")] = None,
    text: Annotated[str | None, Form(min_length=20, max_length=30000, description="Pasted JD text (20–30,000 characters). Send exactly one of text or file.")] = None,
):
    """Multipart form: either a PDF `file` or a plain `text` field; never both."""
    if file is not None and text is not None:
        await file.close()
        raise HTTPException(422, "Send either a JD PDF or JD text, not both.")
    if file is None and text is None:
        raise HTTPException(422, "Upload a JD PDF or paste a job description.")
    metadata = DocumentMetadata()
    if file is not None:
        data = await read_upload(file)
        document = await run_in_threadpool(extract_pdf, data, file.filename or "job-description.pdf", 30000)
        text = document.text
        metadata.filename = document.filename
        metadata.page_count = document.page_count
        metadata.warnings.extend(document.warnings)
    if text is None or len(text.strip()) < 20:
        raise HTTPException(422, "Please provide at least 20 characters of job description text.")
    profile, warnings = extract_jd(text.strip())
    metadata.warnings.extend(warnings)
    return JDExtraction(job_description=profile, metadata=metadata)


@router.post("/analyze", response_model=PreparationResult)
def analyze_resume_and_jd(preparation: PreparationInput):
    """Compare the user's reviewed skill lists without AI calls or storage."""
    return compare_profiles(preparation)
