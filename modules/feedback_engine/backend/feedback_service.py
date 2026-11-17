from datetime import datetime
from typing import Dict, Any, List

from .evaluation_service import evaluate_with_gemini
from .communication_service import analyze_communication
from .database import save_feedback


def generate_feedback_report(interview_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main orchestrator for Charan's AI Feedback Engine.
    Evaluates answers, calculates scoring rubrics, analyzes communication,
    formulates actionable recommendations, and saves to MongoDB.
    """
    session_id = interview_data.get("session_id", "session_001")
    role = interview_data.get("role", "Software Developer")
    category = interview_data.get("category", "HR")
    difficulty = interview_data.get("difficulty", "Beginner")

    resume_profile = interview_data.get("resume_profile", {}) or {}
    job_description = interview_data.get("job_description", {}) or {}

    resume_skills = resume_profile.get("skills", [])
    jd_skills = job_description.get("required_skills", [])

    answers = interview_data.get("answers", [])

    evaluations = []
    answer_scores = []

    for item in answers:
        q_id = item.get("question_id", "q1")
        question_text = item.get("question", "")
        answer_text = item.get("answer", "")

        eval_result = evaluate_with_gemini(
            role=role,
            category=category,
            difficulty=difficulty,
            question=question_text,
            answer=answer_text,
            resume_skills=resume_skills,
            jd_skills=jd_skills
        )

        r = eval_result["relevance"]
        c = eval_result["clarity"]
        s = eval_result["structure"]
        comp = eval_result["completeness"]
        ex = eval_result["examples"]

        # Average of the 5 criteria for this answer
        answer_score = round((r + c + s + comp + ex) / 5)
        answer_scores.append(answer_score)

        eval_entry = {
            "question_id": q_id,
            "question": question_text,
            "answer": answer_text,
            "score": answer_score,
            "relevance": r,
            "clarity": c,
            "structure": s,
            "completeness": comp,
            "examples": ex,
            "criteria": {
                "relevance": r,
                "clarity": c,
                "structure": s,
                "completeness": comp,
                "examples": ex
            },
            "strengths": eval_result.get("strengths", []),
            "weaknesses": eval_result.get("weaknesses", []),
            "improved_answer": eval_result.get("improved_answer", "")
        }
        evaluations.append(eval_entry)

    # Average of answer scores for the overall score
    overall_score = round(sum(answer_scores) / len(answer_scores)) if answer_scores else 75

    # Communication and speech metrics
    comm_analysis = analyze_communication(answers)

    # Recommendations based on evaluation & JD gap analysis
    recommendations = []
    
    # Resume-JD gap recommendations
    missing_jd_skills = [s for s in jd_skills if s.lower() not in [r.lower() for r in resume_skills]]
    if missing_jd_skills:
        recommendations.append(f"Prepare concrete experiences highlighting job-required skills: {', '.join(missing_jd_skills[:3])}")

    # Rubric recommendations
    avg_structure = round(sum(e["structure"] for e in evaluations) / len(evaluations)) if evaluations else 70
    if avg_structure < 75:
        recommendations.append("Practice structured responses using the STAR method (Situation, Task, Action, Result)")

    avg_examples = round(sum(e["examples"] for e in evaluations) / len(evaluations)) if evaluations else 70
    if avg_examples < 75:
        recommendations.append("Incorporate quantifiable metrics and concrete project achievements in technical and behavioral answers")

    if comm_analysis.get("filler_word_count", 0) > 3:
        recommendations.append("Consciously pause instead of using verbal filler words when formulating thoughts")

    if not recommendations:
        recommendations.append("Maintain structured self-introductions and align responses closely to target job descriptions")

    report = {
        "session_id": session_id,
        "role": role,
        "category": category,
        "difficulty": difficulty,
        "overall_score": overall_score,
        "evaluations": evaluations,
        "communication_analysis": comm_analysis,
        "recommendations": recommendations,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    # Save to MongoDB
    saved_doc = save_feedback(report)
    report["storage_engine"] = saved_doc.get("storage_engine", "mongodb")

    return report
