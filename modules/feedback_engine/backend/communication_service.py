import re
from typing import List, Dict, Any, Optional

FILLER_WORDS_LIST = [
    "um", "uh", "er", "ah", "like", "you know", "actually", "basically", 
    "literally", "sort of", "kind of", "i mean", "so yeah", "honestly"
]


def detect_filler_words(text: str) -> Dict[str, Any]:
    """
    Detects filler words in the provided text.
    Returns detected items and total count.
    """
    text_lower = text.lower()
    detected = {}
    total_count = 0

    for filler in FILLER_WORDS_LIST:
        # Pattern match whole words/phrases
        pattern = r'\b' + re.escape(filler) + r'\b'
        matches = re.findall(pattern, text_lower)
        count = len(matches)
        if count > 0:
            detected[filler] = count
            total_count += count

    return {
        "filler_words_detected": list(detected.keys()),
        "breakdown": detected,
        "filler_word_count": total_count
    }


def analyze_communication(answers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Performs communication and speech NLP analysis on student answers.
    Adheres strictly to the rule:
    "If speech timing data is unavailable, omit speaking-rate metrics rather than inventing them."
    """
    total_words = 0
    total_duration = 0
    has_timing_data = False
    all_filler_counts: Dict[str, int] = {}
    total_filler_words = 0
    grammar_notes = []

    for idx, ans in enumerate(answers):
        answer_text = ans.get("answer", "").strip()
        words = re.findall(r'\b\w+\b', answer_text)
        word_count = len(words)
        total_words += word_count

        # Check for timing
        duration = ans.get("duration_seconds")
        if duration is not None and isinstance(duration, (int, float)) and duration > 0:
            total_duration += duration
            has_timing_data = True

        # Check fillers
        fillers = detect_filler_words(answer_text)
        for f, cnt in fillers["breakdown"].items():
            all_filler_counts[f] = all_filler_counts.get(f, 0) + cnt
            total_filler_words += cnt

        # Basic sentence and grammar heuristic checks
        if word_count < 10:
            grammar_notes.append(f"Q{idx+1}: Answer is very brief. Expand with complete sentences to demonstrate fluency.")
        elif not answer_text.endswith(('.', '!', '?')):
            grammar_notes.append(f"Q{idx+1}: Consider concluding answers with a definitive closing statement.")

    # Calculate communication clarity score (0-100)
    # Deduct points for high filler word density or overly sparse answers
    base_clarity = 85
    if total_words > 0:
        filler_density = (total_filler_words / total_words) * 100
        if filler_density > 8:
            base_clarity -= 20
        elif filler_density > 4:
            base_clarity -= 10
        elif filler_density == 0 and total_words > 20:
            base_clarity += 5
    else:
        base_clarity = 50

    base_clarity = max(30, min(95, base_clarity))

    # Grammar score (0-100)
    grammar_score = 85
    if len(grammar_notes) > 2:
        grammar_score -= 15
    elif len(grammar_notes) > 0:
        grammar_score -= 8
    else:
        grammar_notes.append("Clear articulation, grammatical coherence, and professional tone maintained.")

    # Speaking metrics if timing data is available
    speaking_metrics: Optional[Dict[str, Any]] = None
    if has_timing_data and total_duration > 0:
        wpm = round((total_words / total_duration) * 60)
        if wpm < 100:
            pace_evaluation = "Speaking pace is relatively slow (<100 WPM). Optimal conversational range is 120-150 WPM."
        elif 110 <= wpm <= 155:
            pace_evaluation = "Ideal speaking pace within the professional target zone (120-150 WPM)."
        elif 155 < wpm <= 180:
            pace_evaluation = "Slightly brisk speaking pace. Ensure clear pauses for key points."
        else:
            pace_evaluation = "Pace is noticeably rapid (>180 WPM). Slow down to give the interviewer time to digest."

        speaking_metrics = {
            "words_spoken": total_words,
            "duration_seconds": round(total_duration, 1),
            "words_per_minute": wpm,
            "pace_evaluation": pace_evaluation
        }

    result = {
        "overall_clarity": base_clarity,
        "filler_words_detected": list(all_filler_counts.keys()),
        "filler_word_count": total_filler_words,
        "filler_breakdown": all_filler_counts,
        "grammar_score": grammar_score,
        "grammar_notes": grammar_notes
    }

    if speaking_metrics is not None:
        result["speaking_metrics"] = speaking_metrics

    return result
