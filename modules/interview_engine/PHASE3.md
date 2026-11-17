# Phase 3 — Gemini HR question studio

All question generation uses Gemini. There is no local question bank, template mode,
or substitution on failure. The interview room, answers, voice, adaptive follow-ups,
database saving and feedback belong to later phases.

## Use the studio

1. On **Resume & JD**, upload and review both documents. Correct the full
   **Reviewed resume context**, the structured profile and the complete reviewed JD.
   Structured fields take priority over conflicting source text in the model instruction.
2. Open **HR questions** or click **Create HR questions**.
3. Choose the role, HR category, reflection depth and question count (1–15).
   Depth means richer HR reflection, never technical complexity.
4. Check the Gemini status. It refreshes when this page opens; the refresh button
   checks again without losing documents. This reports configuration, not quota
   or provider availability. Confirm that you reviewed both documents, then generate.
5. Inspect the questions and expand **Grounded in your documents** for exact excerpts.
6. Use **Generate a fresh set** for another set or **Download questions** to keep it.

Generating sends the reviewed resume text/profile, complete JD and settings to
Google's Gemini API. No model browsing, tools or code execution are enabled. Downloads
include reviewed document context and should be handled like the source resume.

## API key

Install the locked dependencies from the repository root:

```powershell
.\modules\interview_engine\backend\.venv\Scripts\python.exe -m pip install -r modules/interview_engine/backend/requirements.lock.txt
```

Obtain a key from [Google AI Studio](https://aistudio.google.com/apikey), then edit
`modules/interview_engine/backend/.env` locally. Copy `.env.example` only if `.env`
does not exist. Do not overwrite existing configuration or put keys in frontend files.

```dotenv
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-flash-latest
```

Restart the backend after editing `.env`, then refresh Gemini status in the studio.
The default model is Google's Flash alias; alias versions can change. Choose another
account-accessible model with JSON Schema structured-output support if necessary.

### Automatic model failover

The default ordered chain is the primary `GEMINI_MODEL`, followed by
`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3.1-flash-lite` and
`gemini-3.5-flash`. These text-generation IDs were returned by the configured key's
model inventory during setup. Inventory visibility does not guarantee quota or uptime.
Configure an ordered JSON array in `.env` to change the alternatives:

```dotenv
GEMINI_FALLBACK_MODELS=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-3.1-flash-lite","gemini-3.5-flash"]
GEMINI_MODEL_TIMEOUT_SECONDS=18
GEMINI_REQUEST_BUDGET_SECONDS=60
GEMINI_MODEL_COOLDOWN_SECONDS=45
```

Up to 19 alternatives (20 IDs including the primary) are supported. Duplicate IDs
and `models/` prefixes are normalized. Avoid multiple aliases for the same underlying
model, unsupported modalities or unverified IDs. Restart after configuration changes.

A 404, 500, 502, 503, 504, timeout or network transport failure advances to the next
configured model. Recently failed models are skipped for 45 seconds by default.
Cooldown state is process-local and resets on restart. If all candidates are cooling
down, the API returns 503 with `Retry-After` instead of calling them again immediately.

Authentication, request-configuration and quota/rate-limit errors (400/401/403/429)
stop the chain immediately. Failover does not guarantee success during a shared
provider outage or work around account/project limits. Model availability and limits
are described in [Google's API errors](https://ai.google.dev/gemini-api/docs/generate-content/api-errors)
and [rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).

The chain has a default 60-second elapsed budget and a hard limit of 20 provider calls
including content repair. The budget is checked before every call and remaining time
caps its timeout. Transport timeouts apply to phases of an HTTP request; this is not
a strict wall-clock deadline. The frontend allows the budget plus 15 seconds before
stopping its wait. The UI shows real elapsed time, not fabricated progress or model
switch notifications. A completed plan reports the actual successful model and attempts.

## Fresh questions and errors

The prompt uses the full reviewed documents, asks for specific experiences and role
responsibilities, and instructs Gemini to vary topics and openers. Each request has
a new generation nonce. The browser includes up to 30 recent questions from this
context; normalized exact repeats are rejected. The prompt also discourages lightly
reworded repeats, but semantic novelty cannot be guaranteed by an exact-match check.

Changing documents or settings clears the plan, review confirmation and recent-question
history, and cancels the frontend request. Navigation retains them. Refresh clears
browser memory. This phase has no durable session storage. Download plans to keep them.
If regeneration fails, the previous Gemini set stays visible and is clearly identified
as the previous set. It is not presented as a new result.

Missing keys, quota/rate limits, unavailable models, authentication/configuration errors,
provider high demand, timeouts and rejected model output produce explicit errors.
Raw provider details and secrets are never returned. No fixed questions are shown
in their place.

## API contract

`POST /api/interview/generate` accepts reviewed `resume_profile`, `job_description`,
`resume_context` (20–60,000 characters), `role`, `category`, `difficulty`,
`question_count` (1–15) and optional `previous_questions` (up to 30 strings, each
20–600 characters). Removed `mode` and `allow_fallback` fields are rejected.

The response is `question-plan-2.0`: `plan_id`, UTC `created_at`, settings, full reviewed
context, listed skill matches/gaps, questions (`q1`, `q2`, ...), `source: gemini`,
model and notice. It has no fallback fields. This is a breaking change from the earlier
plan preview, so old plans are not interchangeable. It is still an **unanswered plan**,
not the completed `InterviewSession` used by Charan for answer evaluation.

The response also includes `models_attempted` (ordered distinct model IDs),
`attempt_count` (includes content repair) and measured `elapsed_seconds`. These
describe the real successful request. All-model failures expose sanitized error
metadata and never return fixed questions.

## HR-only checks and timeouts

The system instruction treats all document fields as untrusted reference data and
restricts Gemini to professional HR, behavioral and situational questions. Projects
and technologies provide context for motivation, actions, decisions and collaboration.
Technical theory, coding exercises, algorithms, SQL and system-design tasks are excluded.

Every model uses the same HR-only system instruction, schema and validation.
The server checks schema, count, duplicates and recent exact repeats, HR framing,
common technical-task patterns, category framing, and verbatim evidence. Every question
needs a source excerpt; the set must reference both documents. These are conservative
checks, not proof of semantic truth or exhaustive topic classification. Review output.

Gemini receives standard JSON Schema through `response_json_schema`; this avoids an
older SDK native-Schema field-serialization problem. Pydantic independently validates
the returned JSON. One content-repair attempt is permitted after validation fails.
No SDK retries occur for provider/transport failures; eligible failures use the next
configured model. A maximum of two generation requests run concurrently per process;
additional requests get 429.

Each call defaults to an 18-second transport timeout, capped by the remaining elapsed
budget. Cancelling the frontend request cannot guarantee that a provider call already
in flight stops.

## Verification

Run backend tests and frontend build using the root README commands. Tests use mocked
HTTP transport for the real SDK and verify the exact outgoing JSON Schema field,
full-context payload, repeat rejection, repair limits, sanitized provider errors and
the absence of local substitution. They do not consume live API quota.
