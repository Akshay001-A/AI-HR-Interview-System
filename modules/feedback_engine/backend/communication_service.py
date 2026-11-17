"""Observable text statistics; engagement timers never become speech measurements."""
import re
FILLERS = ['um', 'uh', 'er', 'ah', 'like', 'you know', 'actually', 'basically',
           'literally', 'sort of', 'kind of', 'i mean', 'so yeah', 'honestly']


def detect_filler_words(text):
    counts = {f: len(re.findall(r'\b' + re.escape(f) + r'\b', text.lower())) for f in FILLERS}
    counts = {f: n for f, n in counts.items() if n}
    return {'filler_words_detected': list(counts), 'breakdown': counts,
            'filler_word_count': sum(counts.values())}


def analyze_communication(answers):
    words, counts, per_answer = 0, {}, []
    for answer in answers:
        data = answer.model_dump() if hasattr(answer, 'model_dump') else answer
        text = data['answer']
        count = len(re.findall(r"\b[\w]+(?:['-][\w]+)*\b", text))
        words += count
        detected = detect_filler_words(text)
        for filler, n in detected['breakdown'].items():
            counts[filler] = counts.get(filler, 0) + n
        per_answer.append({'question_id': data['question_id'], 'word_count': count, 'input_mode': data['input_mode']})
    return {'word_count': words, 'per_answer': per_answer,
            'filler_breakdown': counts, 'filler_words_detected': list(counts),
            'filler_word_count': sum(counts.values()),
            'notice': 'Text pattern counts only. Words such as "like" can be meaningful, not hesitation. Browser transcripts may omit fillers. No grammar or vocal-quality score is inferred.',
            'timing_notice': 'Interview duration includes reading and editing. Speech speed and speaking pace are unavailable.'}
