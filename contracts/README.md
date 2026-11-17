# Interview handoff — version 1.0

`interview.sample.json` is synthetic data for Charan's independent feedback development.
`interview.schema.json` is generated from Akshay's Pydantic models. Preserve the PDF's
core field names (`session_id`, `role`, `category`, `difficulty`, `resume_profile`,
`job_description`, `answers`); the additional fields make the handoff explicit.

- `question_count` counts primary questions (1–15); follow-ups do not increase it.
- Every question has a unique `question_id`. A follow-up's `parent_question_id`
  refers to an earlier question in the same session.
- This is a **completed** session: each question must have one nonblank answer.
  Both modules use the same session ID. Drafts will use a separate model later.
- Answer `question` text must match the entry in `questions`.
- `input_mode` is `text` or `voice`. Only include `duration_seconds` when measured.
  Missing duration means unknown. It must never be inferred from the answer text.
- Match and gap lists are context, not an assessment of the student's answers.
- This data contains no scores. Charan owns evaluation and feedback.
- Unknown fields are rejected to catch integration mistakes early.

The JSON Schema describes field-level constraints. Cross-field rules above are
enforced by `POST /api/interview/validate`; use it before handoff.

Generate the schema from the repository root:

```powershell
.\modules\interview_engine\backend\.venv\Scripts\python.exe -m modules.interview_engine.backend.export_schema
```

The proposed contract extends the PDF example. Share the fixture and this document
with Charan before he relies on the additions; change the schema version for breaking changes.

Phase 3 exports a separate `question-plan-2.0` document from `/api/interview/generate`.
It contains reviewed context, settings, grounded questions and Gemini model/source
metadata. Local templates and fallback fields have been removed. This is **not** an answered `InterviewSession`; Charan must not use it
directly for answer evaluation. Phase 4 captures answers and constructs a completed
session using the existing interview contract through `/api/interview/complete`.

Timing clarification: `answers[].duration_seconds` measures running time on the
question, including reading, typing and transcript review. It is **not** speech-only
duration. Do not use it to infer speaking rate. A voice-assisted answer has
`input_mode: "voice"` only after a finalized speech transcript was captured; manually
edited transcripts retain that mode. No speaking-rate or confidence metrics are invented.

Adaptive follow-ups use `parent_question_id`; primary `question_count` is unchanged.
The completion API reconstructs question order, requires one answer per question,
and verifies that parent answers still match the answers used to generate follow-ups.
Browser `interview-draft.json` backups (`draft_version: 1`) are local recovery data,
not the handoff contract. Send only the completed-interview JSON to feedback evaluation.
