from fastapi import APIRouter, HTTPException, Query
from backend.contracts import CompletedInterview, FeedbackReport, Identifier
from .feedback_service import generate_feedback_report
from .database import get_feedback, list_saved_sessions, StorageUnavailable

router = APIRouter()


@router.post('/validate', response_model=CompletedInterview)
def validate_interview(session: CompletedInterview):
    """Normalize without calling AI or saving candidate data."""
    return session


@router.post('/evaluate', response_model=FeedbackReport)
def evaluate_interview(session: CompletedInterview):
    return generate_feedback_report(session)


@router.get('/report/{session_id}', response_model=FeedbackReport)
def get_report(session_id: Identifier):
    try:
        report = get_feedback(session_id)
    except StorageUnavailable:
        raise HTTPException(503, 'Saved reports are unavailable. Please try again.') from None
    if report is None:
        raise HTTPException(404, 'No saved report was found for this interview.')
    return report


@router.get('/history')
def get_history(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    try:
        return {'sessions': list_saved_sessions(limit, offset), 'limit': limit, 'offset': offset}
    except StorageUnavailable:
        raise HTTPException(503, 'Saved reports are unavailable. Please try again.') from None
