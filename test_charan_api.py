import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import json
from modules.feedback_engine.backend.routes import evaluate_interview, get_report, get_sample_interview, get_history
from modules.feedback_engine.backend.standalone_server import health_check


def test_suite():
    print("Testing Charan's AI Feedback Engine...")

    # 1. Health check
    hc = health_check()
    assert hc["module"] == "Feedback Engine"
    print(f"✓ Health Check: {hc['status']} (Owner: {hc['owner']}, Port: {hc['port']})")

    # 2. Get Sample Interview Contract
    sample = get_sample_interview()
    assert "session_id" in sample
    assert "answers" in sample
    print(f"✓ Sample Contract Loaded: Session {sample['session_id']} with {len(sample['answers'])} answers")

    # 3. POST /api/feedback/evaluate
    print("✓ Evaluating Interview Answers...")
    report = evaluate_interview(sample)

    assert report["session_id"] == sample["session_id"]
    assert "overall_score" in report
    assert "evaluations" in report
    assert len(report["evaluations"]) == len(sample["answers"])

    first_eval = report["evaluations"][0]
    assert "score" in first_eval
    assert "criteria" in first_eval
    criteria = first_eval["criteria"]
    for crit in ["relevance", "clarity", "structure", "completeness", "examples"]:
        assert crit in criteria, f"Missing criterion: {crit}"
        assert 0 <= criteria[crit] <= 100, f"Criterion out of range: {crit}"

    print(f"✓ Evaluation Complete: Overall Score = {report['overall_score']}/100")
    print(f"  • Q1 Score: {first_eval['score']}/100")
    print(f"  • Q1 Rubric Criteria: {criteria}")
    print(f"  • Q1 Strengths: {first_eval['strengths']}")
    print(f"  • Q1 Weaknesses: {first_eval['weaknesses']}")
    print(f"  • Q1 AI Improved Answer: {first_eval['improved_answer'][:60]}...")
    print(f"  • Recommendations: {report['recommendations']}")

    # 4. GET /api/feedback/report/{session_id}
    saved = get_report(sample["session_id"])
    assert saved["session_id"] == sample["session_id"]
    assert saved["overall_score"] == report["overall_score"]
    print(f"✓ Persistence Verified: Saved and retrieved report for session '{saved['session_id']}'")

    # 5. History check
    hist = get_history()
    assert sample["session_id"] in hist["sessions"]
    print(f"✓ Session History Verified: {hist['sessions']}")

    print("\n" + "="*70)
    print("🎉 ALL ENDPOINT CONTRACTS AND RUBRIC SCORING CHECKS PASSED 100%!")
    print("="*70)


if __name__ == "__main__":
    test_suite()
