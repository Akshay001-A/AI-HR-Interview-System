# Phase 4 — interview room, voice and recovery

This phase completes the standalone interview experience. MongoDB saving, history
across devices, scoring, feedback and Charan's report are not part of this phase.

## Run and practise

Use the two-server commands in the root README (FastAPI 8000, Vite 5173).

1. Prepare/review the resume and JD, then open **Interview room**. Choose your
   settings and browser recovery preference, confirm document review, and click
   **Start interview**. Once generation succeeds, the first question opens directly.
   There is no full question-set preview or question download before practice.
2. Questions appear one at a time. Starting a new interview while a saved draft
   exists requires replacement confirmation. To import an earlier plan/draft, choose
   **Load saved interview**, then **Load saved plan or draft** and confirm restoration.
3. Answer one question at a time. Use the question navigation, Previous/Next,
   Pause/Resume and progress bar. Questions can be visited without answering, but
   every question must have a nonblank answer before completion.
4. Optionally use **Start microphone** and allow permission yourself. Finalized
   speech is appended to the editable answer; interim text is displayed separately.
   Stop the microphone before navigation or pausing. Typed answers always remain
   available when speech recognition is unsupported or fails.
5. With at least 20 answer characters, request **Ask an HR follow-up**. This sends
   the current answer and reviewed context to Gemini. The running timer pauses while
   waiting. The follow-up appears immediately after its primary question; resume
   practice when ready. At most one follow-up per primary and five per interview.
6. Review all answers, edit any unfinished questions, then **Complete interview**.
   The backend validates the entire session. Download the completed-interview JSON
   for Charan's module. Completion does not imply it was saved to MongoDB or scored.

A parent answer is locked after its follow-up is added, preventing stale adaptive
context. Removing the linked follow-up (with confirmation) also removes its answer
and unlocks the parent. Remaining answers are preserved. Follow-ups remain HR-only:
specific actions, decisions, communication, outcomes, motivation and reflection.
There are no local template questions or automatic evaluation responses.

## Voice behavior

The interface uses `SpeechRecognition` / `webkitSpeechRecognition`, not a backend
audio upload endpoint. It only starts after a user click. Recognition availability,
microphone permissions, network access and English-language support depend on the
browser and device. Permission denial, missing microphones, no speech, unsupported
languages and speech-service network errors are reported without deleting answers.

Some browsers send audio to their speech-service provider; the UI discloses this.
This app keeps finalized transcript text and does not create or save audio files.
See [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
Use localhost/127.0.0.1 for development and a supported secure browser context.

Interim results are not saved or exported. Repeated final events are deduplicated.
Cancellation discards unconfirmed interim text and invalidates late callbacks, so
an older question never receives speech after navigation. Recognition is cancelled
when this app view is left or the tab becomes hidden; it never automatically restarts.
Window blur alone does not cancel, because it can be caused by a microphone permission
prompt. Keep an eye on the recording indicator and stop it explicitly when done.

`input_mode` becomes `voice` only after finalized voice text is accepted. Editing that
transcript retains voice-assisted provenance. Clearing the entire answer resets its
mode to text. Speech-device behavior must also be checked manually on the target
browser; automated tests use a fake recognition event source, not a live microphone.

## Timer and recovery

The timer measures running time on each question, including reading and editing.
Pause, review, hidden tabs, app navigation, Gemini wait time and recovered offline time
do not add time. Recovery snapshots always store running sessions as paused.
The export's `duration_seconds` is engagement time, **not speaking time**. It must not
be used to invent words-per-minute, speech fluency or confidence measurements.

When enabled, one current session is kept in localStorage under
`interview-studio:session:v1`, including full document context and answers. It is local
to this browser profile and origin; `localhost` and `127.0.0.1` are different origins.
Use one app tab for an interview. Draft changes are saved after a 350 ms idle delay,
running timing is checkpointed every five seconds, and page exit triggers a best-effort
snapshot. Browser crashes can lose the most recent unsaved changes.

Recovery is optional. When off, the interview stays only in memory until downloaded.
The UI distinguishes saved/saving/off/error states. Storage failures preserve in-memory
answers and recommend downloading a backup. Saved drafts are size/shape checked; corrupt
data is not silently overwritten. It can be downloaded before choosing replacement.

**Download draft backup** saves `draft_version: 1` JSON, including partial answers.
Import it through **Load saved plan or draft** to recover it paused. Plan and draft
imports are capped at 2 MB. Imported question plans/follow-ups are checked by the
backend for valid HR context; importing is not proof of original provider provenance.
**Clear browser draft** requires confirmation and removes the browser copy. Starting
another interview replaces the current copy only after confirmation. Download first
if you want to retain completed work; permanent history arrives in Phase 5.

## Backend and integration

| Endpoint | Purpose |
| --- | --- |
| POST `/api/interview/plan/validate` | Validate an imported unanswered plan |
| POST `/api/interview/draft/validate` | Validate imported plan/follow-up context |
| POST `/api/interview/followup` | Generate one answer-dependent HR follow-up |
| POST `/api/interview/complete` | Assemble and validate the completed session |

Follow-up generation reuses the existing Gemini failover chain, deadline and shared
two-request concurrency bound. It requires a short verbatim quote from the current
answer, rejects technical and duplicate questions, and never substitutes fixed text.
The generation runtime is shared with initial question generation to keep policies
consistent. Explicit quota/authentication failures still stop the chain.

Completion accepts the session ID, source plan, follow-ups and answers. It reconstructs
primary/follow-up order, checks answer text against question IDs and ensures parent
answers match the source of follow-ups. It returns the existing `schema_version: 1.0`
interview contract with the same `session_id`. Primary `question_count` excludes follow-ups.

`InterviewApp` supports an optional `onComplete(session)` prop for the later shared
dashboard. It calls this once after successful user-initiated completion validation.
There are no external feedback calls or database writes in Phase 4.

## Checks

```powershell
.\modules\interview_engine\backend\.venv\Scripts\python.exe -m pytest modules/interview_engine/backend/tests -q
npm --prefix modules/interview_engine/frontend test
npm --prefix modules/interview_engine/frontend run build
```

Tests cover question-plan validation, grounded/nontechnical follow-ups, limits,
stale parents, completed handoff compatibility, timer/recovery math, answer navigation,
transcript finalization, late speech events and speech errors. Live browser checks
cover typed answers, recovery, Gemini follow-ups, review and completed JSON export.
