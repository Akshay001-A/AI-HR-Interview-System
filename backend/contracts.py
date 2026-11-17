"""Shared boundary for current Akshay sessions and legacy Charan JSON."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100, pattern=r'^[A-Za-z0-9_-]+$')]


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Profile(Contract):
    skills: list[Text] = Field(default_factory=list, max_length=200)
    projects: list[Text] = Field(default_factory=list, max_length=100)
    education: list[Text] = Field(default_factory=list, max_length=100)
    experience: list[Text] = Field(default_factory=list, max_length=100)


class JobDescription(Contract):
    text: Text = Field(max_length=30000)
    required_skills: list[Text] = Field(default_factory=list, max_length=200)


class Question(Contract):
    question_id: Identifier
    question: Text = Field(max_length=5000)
    parent_question_id: Identifier | None = None


class Answer(Contract):
    question_id: Identifier
    question: Text = Field(max_length=5000)
    answer: Text = Field(max_length=20000)
    input_mode: Literal['text', 'voice']
    duration_seconds: float | None = Field(default=None, ge=0, allow_inf_nan=False,
        description='Active engagement time including reading/editing; never speech duration.')


class CompletedInterview(Contract):
    schema_version: Literal['1.0'] = '1.0'
    session_id: Identifier
    role: Text = Field(max_length=120)
    category: Literal['HR', 'Behavioral', 'Situational'] = 'HR'
    difficulty: Literal['Beginner', 'Intermediate', 'Advanced'] = 'Beginner'
    question_count: int = Field(ge=1, le=15, strict=True)
    resume_profile: Profile
    job_description: JobDescription
    resume_context: str | None = Field(default=None, max_length=60000)
    matched_skills: list[Text] = Field(default_factory=list, max_length=200)
    skill_gaps: list[Text] = Field(default_factory=list, max_length=200)
    questions: list[Question] = Field(min_length=1, max_length=20)
    answers: list[Answer] = Field(min_length=1, max_length=20)

    @model_validator(mode='before')
    @classmethod
    def normalize_legacy(cls, value):
        if not isinstance(value, dict):
            return value
        data = dict(value)
        answers, questions = data.get('answers'), data.get('questions')
        if questions is None and isinstance(answers, list):
            questions = [{k: a[k] for k in ('question_id', 'question') if k in a} for a in answers if isinstance(a, dict)]
            data['questions'] = questions
        if isinstance(questions, list) and all(isinstance(q, dict) for q in questions):
            by_id = {q.get('question_id'): q.get('question') for q in questions if isinstance(q.get('question_id'), str)}
            if isinstance(answers, list):
                data['answers'] = [dict(a, question=by_id.get(a.get('question_id'))) if isinstance(a, dict) and 'question' not in a and isinstance(a.get('question_id'), str) else a for a in answers]
            data.setdefault('question_count', sum(not q.get('parent_question_id') for q in questions))
        return data

    @model_validator(mode='after')
    def validate_links(self):
        questions = {q.question_id: q for q in self.questions}
        if len(questions) != len(self.questions):
            raise ValueError('Question IDs must be unique.')
        ids = [a.question_id for a in self.answers]
        if len(set(ids)) != len(ids) or set(ids) != set(questions):
            raise ValueError('Each question must have exactly one answer.')
        roots = {q.question_id for q in self.questions if not q.parent_question_id}
        if len(roots) != self.question_count or len(self.questions) - len(roots) > 5:
            raise ValueError('Primary question count or follow-up count is invalid.')
        seen, parents = set(), set()
        for q in self.questions:
            if q.parent_question_id:
                if q.parent_question_id not in seen or q.parent_question_id not in roots or q.parent_question_id in parents:
                    raise ValueError('A follow-up must reference an earlier primary question, once only.')
                parents.add(q.parent_question_id)
            seen.add(q.question_id)
        for a in self.answers:
            if a.question != questions[a.question_id].question:
                raise ValueError('Answer question text must match its question ID.')
        if sum(len(a.answer) for a in self.answers) > 120000:
            raise ValueError('Combined answers exceed 120,000 characters.')
        if len(self.model_dump_json()) > 240000:
            raise ValueError('Interview exceeds the evaluation context limit.')
        return self


Score = Annotated[int, Field(ge=0, le=100, strict=True)]


class Rubric(Contract):
    relevance: Score
    clarity: Score
    structure: Score
    completeness: Score
    examples: Score


class ProposedEvaluation(Contract):
    question_id: Identifier
    criteria: Rubric
    strengths: list[Text] = Field(min_length=1, max_length=5)
    weaknesses: list[Text] = Field(min_length=1, max_length=5)
    answer_template: Text = Field(max_length=5000)


class ProposedReport(Contract):
    evaluations: list[ProposedEvaluation] = Field(min_length=1, max_length=20)
    recommendations: list[Text] = Field(min_length=1, max_length=8)


class Generation(Contract):
    source: Literal['gemini']
    model: Text
    models_attempted: list[Text] = Field(min_length=1, max_length=20)
    attempt_count: int = Field(ge=1, le=20)
    elapsed_seconds: float = Field(ge=0, allow_inf_nan=False)


class Storage(Contract):
    saved: bool
    engine: Literal['sqlite', 'mongodb']
    message: Text


class AnswerStatistic(Contract):
    question_id: Identifier
    word_count: int = Field(ge=0)
    input_mode: Literal['text', 'voice']


class TextAnalysis(Contract):
    word_count: int = Field(ge=0)
    per_answer: list[AnswerStatistic]
    filler_breakdown: dict[str, Annotated[int, Field(ge=0)]]
    filler_words_detected: list[str]
    filler_word_count: int = Field(ge=0)
    notice: Text
    timing_notice: Text


class Evaluation(ProposedEvaluation):
    question: Text
    parent_question_id: Identifier | None
    answer: Text
    input_mode: Literal['text', 'voice']
    score: Score


class FeedbackReport(Contract):
    report_version: Literal['2.0']
    session_id: Identifier
    role: Text
    category: Literal['HR', 'Behavioral', 'Situational']
    difficulty: Literal['Beginner', 'Intermediate', 'Advanced']
    overall_score: Score
    criteria_averages: Rubric
    evaluations: list[Evaluation] = Field(min_length=1, max_length=20)
    communication_analysis: TextAnalysis
    recommendations: list[Text] = Field(min_length=1, max_length=8)
    generation: Generation
    created_at: Text
    notice: Text
    storage: Storage
