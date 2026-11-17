# Interview Studio — shared dashboard and feedback engine

This `main` implementation uses Akshay's green-and-cream Interview Studio design
in the root `frontend/`. The root `backend/` serves the feedback API. Domain logic
and report components stay under `modules/feedback_engine/`.

The `akshay-interview` branch is unchanged. Live interview screens will be connected
in the next integration step. For now upload its **completed-interview JSON** to
get feedback; no sample/demo scores or local AI substitutes are shown.

## Run locally (PowerShell)

From the project root:

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
Copy-Item .env.example .env
```

Add your `GEMINI_API_KEY` to the root `.env` using your editor. Do not commit it.
Do not run `Copy-Item` again if you already have a configured root `.env`.
The interview branch's module `.env` is not automatically copied or loaded here.

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The dev server proxies `/api` to port 8000.
If that port is occupied, start the API on another port and set `BACKEND_ORIGIN`
in the frontend terminal before starting Vite. `VITE_API_BASE` can configure a
separate API origin when needed. API keys belong only in the backend environment.
Do not run the old interview server and the shared server on the same port.

## Use

1. Select **Interview feedback**, then upload a completed JSON export (maximum 2 MB).
2. Review the role, question count and included answers. Validation uses only the
   local API; it does not call Gemini or save the uploaded interview.
3. Confirm the disclosure, then select **Get interview feedback**. This sends the
   question/answer pairs, reviewed resume profile, optional resume context and full
   JD to Google Gemini. A complete validated report is generated in one batch.
4. Review the overview, per-answer feedback, text insights and next steps.
   Answer templates use placeholders for details absent from the candidate's answer.
5. Download the report or reopen it from **Saved reports**.

A provider failure displays an actionable error. No heuristic evaluation, fixed
score, made-up speech metric or client-side fallback report replaces it. The prior
report remains available after a failed new request. Gemini scores are practice
feedback, not placement predictions. A zero score remains zero throughout the UI.

## Shared interview contract

Canonical input and report schemas are in `contracts/interview.schema.json` and
`contracts/feedback.schema.json`; the API validates both evaluation and retrieval responses.

`POST /api/feedback/validate` accepts:

- Current `schema_version: "1.0"` sessions from Akshay, including separate ordered
  `questions` and `answers`, primary count, parent IDs and optional duration.
- Answer records with or without repeated `question` text. When missing, text is
  resolved from `questions` by ID. If supplied, it must match exactly.
- Charan's older answers-with-question JSON. The API derives primary questions
  and count when those fields are absent.

It rejects empty/blank answers, duplicate IDs, missing answers, mismatched question
text, invalid parents, invalid counts, more than five follow-ups, unsupported schema
versions and excessive payloads before any AI request. Normalization is on a copy.
Every primary and adaptive follow-up receives its own evaluation, joined by ID.

Reports use **report_version 2.0**. Earlier demo report formats are not accepted by
the new UI. Re-evaluate the completed interview to create a current report.

## Timing and text analysis

`duration_seconds` means active engagement (reading, typing, editing and answering),
not speech-only time. Neither typed nor voice-assisted answers produce speaking
rate, pace, vocal confidence or grammar accuracy scores. Text insights show word
counts and possible filler-pattern counts, with limitations explained in the UI.
They do not claim those words are necessarily hesitations.

## Storage

The default `STORAGE_BACKEND=sqlite` keeps durable reports in
`.cache/feedback.sqlite3`. This works without a MongoDB service and survives restart.
Set `STORAGE_BACKEND=mongodb`, `MONGODB_URI` and `DATABASE_NAME` to use MongoDB instead.
That adapter has a unique session ID index and upserts reports by session ID.

Storage does not silently switch to memory. If saving fails, the generated report
is returned with `storage.saved=false`; the UI tells you to download it. History
and lookup return a clear service error when the configured storage is unavailable.
History is paginated. Raw resume/JD context is not stored in the report; answers,
feedback and session metadata are stored. Downloaded reports contain those answers.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Local service health |
| `POST /api/feedback/validate` | Normalize and validate completed interview, no AI/save |
| `POST /api/feedback/evaluate` | Gemini feedback and report persistence |
| `GET /api/feedback/report/{session_id}` | Retrieve saved report |
| `GET /api/feedback/history?limit=20&offset=0` | List report summaries |

The old `/sample` route and demo frontend were removed. The standalone compatibility
entry point uses the same shared backend on port 8001; there is one implementation.
The app binds to localhost by default and permits only configured frontend origins.

## Verification

```powershell
.\backend\.venv\Scripts\python.exe -m pytest test_charan_api.py -q
cd frontend
npm test
npm run build
```

Tests use synthetic data, mocked Gemini HTTP transport, temporary SQLite storage,
and mocked MongoDB failures. They never need or print a real API key. Optional real
Gemini/MongoDB connectivity remains environment-dependent. Model failover is bounded
by a request budget, per-model timeout, maximum 20 attempts and two concurrent
feedback jobs per API process. Auth/quota errors stop rather than cycling models.
A recent transient outage cools that model down for 45 seconds in the current process.

## Next integration step

Reuse `frontend/src/Workspace.jsx`, the root theme and `frontend/src/api.js` when
bringing the live interview screens into this dashboard. Pass the completed
session into the feedback import/review stage and preserve explicit generation
consent. The feedback engine already normalizes both current answer shapes; changing
Akshay's output first is not required. Do not merge or push until reviewed.
