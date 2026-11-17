from datetime import datetime, timezone
from backend.contracts import CompletedInterview
from .evaluation_service import evaluate_session
from .communication_service import analyze_communication
from .database import save_feedback, StorageUnavailable


def generate_feedback_report(interview_data):
    session = interview_data if isinstance(interview_data, CompletedInterview) else CompletedInterview.model_validate(interview_data)
    proposed, generation = evaluate_session(session)
    by_id = {item.question_id: item for item in proposed.evaluations}
    questions = {q.question_id: q for q in session.questions}
    evaluations = []
    for answer in session.answers:
        item = by_id[answer.question_id]
        criteria = item.criteria.model_dump()
        evaluations.append({'question_id': answer.question_id, 'question': answer.question,
            'parent_question_id': questions[answer.question_id].parent_question_id,
            'answer': answer.answer, 'input_mode': answer.input_mode,
            'score': round(sum(criteria.values()) / len(criteria)), 'criteria': criteria,
            'strengths': item.strengths, 'weaknesses': item.weaknesses,
            'answer_template': item.answer_template})
    average = {key: round(sum(e['criteria'][key] for e in evaluations)/len(evaluations)) for key in evaluations[0]['criteria']}
    report = {'report_version': '2.0', 'session_id': session.session_id, 'role': session.role,
        'category': session.category, 'difficulty': session.difficulty,
        'overall_score': round(sum(e['score'] for e in evaluations)/len(evaluations)),
        'criteria_averages': average, 'evaluations': evaluations,
        'communication_analysis': analyze_communication(session.answers),
        'recommendations': proposed.recommendations, 'generation': generation,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'notice': 'Practice feedback on these answers, not a hiring or placement prediction. Suggested templates must be completed with your real experience.'}
    try:
        return save_feedback(report)
    except StorageUnavailable:
        report['storage'] = {'saved': False, 'engine': get_storage_engine(),
            'message': 'Your feedback was generated but could not be saved. Download it before leaving.'}
        return report


def get_storage_engine():
    from backend.config import get_settings
    return get_settings().storage_backend
