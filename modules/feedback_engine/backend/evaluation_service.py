import os
import json
import logging
import requests
from typing import Dict, Any, List

logger = logging.getLogger("evaluation_service")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def evaluate_with_gemini(
    role: str,
    category: str,
    difficulty: str,
    question: str,
    answer: str,
    resume_skills: List[str],
    jd_skills: List[str]
) -> Dict[str, Any]:
    """
    Calls Google Gemini API to evaluate an answer against the 5 criteria:
    relevance, clarity, structure, completeness, examples (all 0-100).
    """
    if not GEMINI_API_KEY:
        return evaluate_heuristically(role, category, difficulty, question, answer, resume_skills, jd_skills)

    prompt = f"""You are an expert HR interviewer and hiring manager assessing an interview candidate.
Evaluate the candidate's answer for the following position:
Role: {role}
Category: {category}
Difficulty: {difficulty}
Resume Skills: {', '.join(resume_skills) if resume_skills else 'Not specified'}
Job Required Skills: {', '.join(jd_skills) if jd_skills else 'Not specified'}

Interview Question: "{question}"
Candidate Answer: "{answer}"

Evaluate the answer strictly on 5 criteria using a 0-100 scale:
1. relevance (0-100): How directly and accurately the answer addresses the question and aligns with the role/JD.
2. clarity (0-100): Professional tone, clear articulation, conciseness.
3. structure (0-100): Logical organization (e.g., STAR technique - Situation, Task, Action, Result).
4. completeness (0-100): Thoroughness and covering all key aspects asked.
5. examples (0-100): Concrete project achievements, real situations, and technical/behavioral evidence.

Respond ONLY with valid JSON with this exact structure:
{{
  "relevance": 85,
  "clarity": 75,
  "structure": 70,
  "completeness": 80,
  "examples": 75,
  "strengths": ["Clear introduction", "Mentioned key skills"],
  "weaknesses": ["Needs specific project examples", "Could elaborate more on impact"],
  "improved_answer": "A compelling, polished 2-3 sentence model answer using the STAR method."
}}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "response_mime_type": "application/json"}
    }

    try:
        resp = requests.post(url, json=payload, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            res = json.loads(raw_text)
            return res
    except Exception as e:
        logger.warning(f"Gemini API call failed or timed out: {e}. Using robust heuristic evaluation.")

    return evaluate_heuristically(role, category, difficulty, question, answer, resume_skills, jd_skills)


def evaluate_heuristically(
    role: str,
    category: str,
    difficulty: str,
    question: str,
    answer: str,
    resume_skills: List[str],
    jd_skills: List[str]
) -> Dict[str, Any]:
    """
    Intelligent rubric fallback that guarantees instant, high-quality, reproducible evaluations
    adhering exactly to the 0-100 scale and contract.
    """
    words = answer.strip().split()
    word_count = len(words)
    answer_lower = answer.lower()
    question_lower = question.lower()

    # Criteria calculations
    # 1. Relevance: checks overlap with question keywords and skills
    relevance = 70
    key_terms = [w.strip("?,.") for w in question_lower.split() if len(w) > 3]
    term_matches = sum(1 for t in key_terms if t in answer_lower)
    relevance += min(20, term_matches * 5)
    
    matched_skills = [s for s in (jd_skills + resume_skills) if s.lower() in answer_lower]
    if matched_skills:
        relevance = min(95, relevance + 10)

    # 2. Clarity
    clarity = 75
    if word_count > 15:
        clarity += 5
    if any(p in answer for p in [".", ",", ";"]):
        clarity += 5
    if word_count < 8:
        clarity -= 15

    # 3. Structure: look for sequence or STAR markers
    structure = 68
    star_markers = ["when", "during", "project", "responsible", "result", "solved", "team", "worked", "because"]
    found_markers = sum(1 for m in star_markers if m in answer_lower)
    structure += min(22, found_markers * 6)

    # 4. Completeness
    completeness = 70
    if word_count >= 25:
        completeness = 85
    elif word_count >= 15:
        completeness = 78
    elif word_count < 8:
        completeness = 55

    # 5. Examples: concrete numbers or project references
    examples = 65
    example_markers = ["project", "for example", "built", "implemented", "mini-project", "internship", "developed", "%", "users"]
    if any(m in answer_lower for m in example_markers):
        examples += 15
    if any(char.isdigit() for char in answer):
        examples += 8

    # Cap all between 40 and 96
    relevance = max(40, min(95, relevance))
    clarity = max(40, min(95, clarity))
    structure = max(40, min(95, structure))
    completeness = max(40, min(95, completeness))
    examples = max(40, min(95, examples))

    # Formulate strengths & weaknesses
    strengths = []
    weaknesses = []

    if matched_skills:
        strengths.append(f"Directly referenced relevant competencies: {', '.join(matched_skills[:2])}")
    else:
        strengths.append("Direct and prompt response to the interviewer's prompt")

    if word_count > 15:
        strengths.append("Demonstrated good sentence structure and professional demeanor")
    else:
        strengths.append("Clear and concise core statement")

    if not matched_skills and jd_skills:
        weaknesses.append(f"Did not highlight core job requirements such as {', '.join(jd_skills[:2])}")
    if examples < 75:
        weaknesses.append("Could benefit from specific quantitative results or concrete project examples")
    if word_count < 15:
        weaknesses.append("Answer is slightly brief; expand on the impact and your personal contribution")

    # Generate an improved sample answer
    context_skill = matched_skills[0] if matched_skills else (jd_skills[0] if jd_skills else "software engineering principles")
    improved_answer = (
        f"In my academic and project work, I have focused heavily on {context_skill}. "
        f"For instance, during my recent project, I applied these competencies to design and deliver functional components under tight deadlines. "
        f"This experience honed both my problem-solving ability and readiness to contribute immediately to your development team."
    )

    return {
        "relevance": relevance,
        "clarity": clarity,
        "structure": structure,
        "completeness": completeness,
        "examples": examples,
        "strengths": strengths[:2],
        "weaknesses": weaknesses[:2] if weaknesses else ["Incorporate metrics and measurable business outcomes"],
        "improved_answer": improved_answer
    }
