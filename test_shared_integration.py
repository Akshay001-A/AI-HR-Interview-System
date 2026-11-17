"""Exercise actual completed-session handoff through the common API."""
from fastapi.testclient import TestClient
from pydantic import SecretStr
from backend.main import app
from backend.config import get_settings
from modules.feedback_engine.backend import evaluation_service as ai
from modules.interview_engine.backend.tests.test_interview_sessions import plan, completion_body, payload, no_live_google_requests
from test_charan_api import proposal


def test_completed_live_interview_moves_to_feedback(plan, monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), 'gemini_api_key', SecretStr('test-key'))
    monkeypatch.setattr(get_settings(), 'sqlite_path', tmp_path/'integration.sqlite3')
    monkeypatch.setattr(get_settings(), 'storage_backend', 'sqlite')
    monkeypatch.setattr(ai, 'call_provider', lambda session,*args:proposal(session))
    ai.COOLDOWNS.clear()
    with TestClient(app) as client:
        response = client.post('/api/interview/complete', json=completion_body(plan, include_followup=True))
        assert response.status_code == 200, response.text
        session = response.json()
        assert all(a['question'] for a in session['answers'])
        normalized = client.post('/api/feedback/validate', json=session)
        assert normalized.status_code == 200, normalized.text
        result = client.post('/api/feedback/evaluate', json=session)
        assert result.status_code == 200, result.text
        report = result.json()
        assert len(report['evaluations']) == len(session['answers'])
        assert report['evaluations'][1]['parent_question_id'] == 'q1'
        assert 'speaking_metrics' not in report['communication_analysis']
        assert client.get('/api/feedback/report/'+session['session_id']).json() == report


def test_shared_backend_accepts_resume_upload():
    import fitz
    document = fitz.open()
    document.new_page().insert_text((40,50), 'Synthetic student resume. Skills: Python, teamwork. Project: student placement tracker.')
    content = document.tobytes(); document.close()
    with TestClient(app) as client:
        response = client.post('/api/interview/resume', files={'file':('resume.pdf',content,'application/pdf')})
        assert response.status_code == 200, response.text
        assert 'Synthetic student' in response.json()['extracted_text']
