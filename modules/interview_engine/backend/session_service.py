"""Validate plans and assemble the unchanged completed-interview handoff."""

from fastapi import HTTPException

from .hr_validation import is_hr_question, normalized, question_key, validate_proposal
from .question_schemas import GenerationRequest, ProposedQuestions, QuestionPlan
from .schemas import InterviewSession, Question
from .session_schemas import CompleteInterviewRequest, FollowupQuestion


def validate_plan(plan: QuestionPlan) -> QuestionPlan:
    if len(plan.questions) != plan.settings.question_count:
        raise HTTPException(422, "The plan's primary question count does not match its settings.")
    if [q.question_id for q in plan.questions] != [f"q{i}" for i in range(1, len(plan.questions) + 1)]:
        raise HTTPException(422, "The plan must contain ordered, unique primary IDs q1, q2, ... .")
    request = GenerationRequest(
        **plan.settings.model_dump(), resume_context=plan.resume_context,
        resume_profile=plan.resume_profile, job_description=plan.job_description,
    )
    proposal = ProposedQuestions(questions=[q.model_dump(exclude={"question_id"}) for q in plan.questions])
    try:
        validate_proposal(proposal, request)
    except ValueError as error:
        raise HTTPException(422, "The question plan failed HR or document-reference validation.") from error
    return plan


def validate_followups(plan: QuestionPlan, followups: list[FollowupQuestion]) -> None:
    ids = {q.question_id for q in plan.questions}
    parents, texts = set(), {question_key(q.question) for q in plan.questions}
    for followup in followups:
        if followup.parent_question_id not in ids or followup.parent_question_id in parents:
            raise HTTPException(422, "Each primary question may have at most one follow-up.")
        if followup.question_id != followup.parent_question_id + "_followup":
            raise HTTPException(422, "A follow-up ID must match its parent question.")
        if not is_hr_question(followup.question) or question_key(followup.question) in texts:
            raise HTTPException(422, "Follow-ups must be distinct HR questions.")
        if normalized(followup.answer_evidence) not in normalized(followup.based_on_answer):
            raise HTTPException(422, "Follow-up evidence does not match its source answer.")
        parents.add(followup.parent_question_id)
        texts.add(question_key(followup.question))


def complete_interview(request: CompleteInterviewRequest) -> InterviewSession:
    validate_plan(request.plan)
    validate_followups(request.plan, request.followups)
    answers = {a.question_id: a for a in request.answers}
    for followup in request.followups:
        parent = answers.get(followup.parent_question_id)
        if parent is None or parent.answer.strip() != followup.based_on_answer:
            raise HTTPException(422, "A parent answer changed after its follow-up was generated. Remove the follow-up before revising that answer.")
    followups = {q.parent_question_id: q for q in request.followups}
    questions = []
    for primary in request.plan.questions:
        questions.append(Question(question_id=primary.question_id, question=primary.question))
        if primary.question_id in followups:
            child = followups[primary.question_id]
            questions.append(Question(question_id=child.question_id, question=child.question, parent_question_id=child.parent_question_id))
    try:
        return InterviewSession(
            session_id=request.session_id, **request.plan.settings.model_dump(),
            resume_profile=request.plan.resume_profile.model_dump(),
            job_description=request.plan.job_description.model_dump(),
            matched_skills=request.plan.matched_skills, skill_gaps=request.plan.skill_gaps,
            questions=questions, answers=request.answers,
        )
    except ValueError as error:
        raise HTTPException(422, "Complete every question exactly once with matching question text before finishing.") from error
