"""Conservative checks for off-topic output. They supplement the HR-only prompt."""

import re
import unicodedata

from .question_schemas import GenerationRequest, ProposedQuestions
from .schemas import Category


def normalized(text: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())


def question_key(text: str) -> str:
    return re.sub(r"[^\w ]", "", normalized(text))


HR_FRAMING = re.compile(
    r"motivat|interest|career|goal|strength|weakness|team|collaborat|communicat|conflict|"
    r"disagree|feedback|prioriti|deadline|pressure|stress|adapt|learn|mistake|fail|responsib|"
    r"ownership|integrity|ethic|honest|trust|lead|initiative|decision|support|challenge|"
    r"resilien|colleague|manager|customer|stakeholder|proud|achievement|success|contribut|"
    r"experience|handle|resolve|cope|about yourself|suitable|fit for|expectation|outcome|reflect"
)
TECHNICAL_TASK = re.compile(
    r"\b(write|implement|debug|refactor|optimi[sz]e|solve|derive|calculate|compute)\b.{0,100}"
    r"\b(code|program|function|query|queries|algorithm|equation|complexity|class|script|database|sort|tree|array)\b|"
    r"\b(time complexity|space complexity|big[ -]?o|system design|pseudocode|polymorphism|"
    r"normalization|normalisation|binary search|deadlock|sql joins?|object inheritance)\b|"
    r"\b(design|build)\b.{0,50}\b(scalable system|database schema|architecture|rest api)\b|"
    r"\b(explain|define|describe|compare|differentiate|demonstrate)\b.{0,80}"
    r"\b(algorithms?|sorting|source code|database schema|architecture|recursion|sql queries|"
    r"class inheritance|closures?|promises?|memory management)\b|"
    r"\b(difference between|differentiate between|explain how|how does|how do|what is|what are|define)\b"
    r".{0,80}\b(python|java|javascript|react|sql|database|algorithm|api|http|tcp|thread|process|"
    r"compiler|interpreter|recursion|closure|promise|index|indexes|stack|queue|hash|tree|sort|inheritance)\b"
)


def is_hr_question(question: str) -> bool:
    text = normalized(question)
    return (
        text.endswith("?") and text.count("?") == 1
        and not any(character in question for character in ("`", "\n", "\r"))
        and HR_FRAMING.search(text) is not None
        and TECHNICAL_TASK.search(text) is None
    )


def evidence_corpora(request: GenerationRequest) -> tuple[str, str]:
    resume = "\n".join([request.resume_context, *request.resume_profile.skills,
                        *request.resume_profile.projects, *request.resume_profile.education,
                        *request.resume_profile.experience])
    jd = "\n".join([request.job_description.text, *request.job_description.required_skills])
    return normalized(resume), normalized(jd)


def validate_proposal(proposal: ProposedQuestions, request: GenerationRequest) -> None:
    if len(proposal.questions) != request.question_count:
        raise ValueError("Question count does not match settings.")
    seen, has_resume, has_jd = {question_key(question) for question in request.previous_questions}, False, False
    resume, jd = evidence_corpora(request)
    for item in proposal.questions:
        key = question_key(item.question)
        if key in seen or not is_hr_question(item.question):
            raise ValueError("Duplicate or non-HR question rejected.")
        if request.category == Category.BEHAVIORAL and not re.search(r"\b(time|experience|past|example)\b", normalized(item.question)):
            raise ValueError("Behavioral questions must invite a past example.")
        if request.category == Category.SITUATIONAL and not re.search(r"\b(if|would|imagine|suppose)\b", normalized(item.question)):
            raise ValueError("Situational questions must describe a hypothetical situation.")
        seen.add(key)
        if not item.resume_evidence and not item.jd_evidence:
            raise ValueError("Every question needs document evidence.")
        for evidence, corpus in [(item.resume_evidence, resume), (item.jd_evidence, jd)]:
            if evidence and (len(normalized(evidence)) < 5 or normalized(evidence) not in corpus):
                raise ValueError("Document evidence could not be verified.")
        has_resume |= bool(item.resume_evidence)
        has_jd |= bool(item.jd_evidence)
    if not has_resume or not has_jd:
        raise ValueError("A question plan must use both resume and JD context.")
