# AI HR Interview System

Akshay's interview engine and Charan's feedback engine are developed independently,
then connected using the same session JSON. Work in this checkout is on
`akshay-interview`; the feedback module and root integration apps are untouched.

## Current milestone: Phase 2 — resume and JD preparation

- React + Vite dashboard, Tailwind CSS, Axios and Lucide icons.
- FastAPI backend, environment configuration, restricted local CORS and API docs.
- Versioned Pydantic contract, generated JSON Schema, synthetic sample and validation API.
- Working frontend → backend sample load and contract validation, plus JSON download.
- Responsive overview and interview-preference preview.
- Resume PDF upload with editable skills, projects, education and experience.
- Job description PDF upload or pasted text, with editable required skills.
- Reviewed skill comparison with alias matching and preparation JSON export.
- Bounded local PDF extraction with clear errors and extraction warnings.

**Not implemented yet:** Gemini generation, live interviews, voice capture,
draft recovery, MongoDB persistence or feedback. Phase 3 has not started.
Sample-session data is synthetic. Setup controls remain a preview and are not saved.
Resume/JD work stays in browser memory across navigation, but clears on refresh.
The backend does not save uploaded PDFs, extracted text or preparation records to
application storage. Multipart handling may use temporary spooling while reading
the request. Phase 2 makes no requests to Gemini or other AI services.

## Run locally (PowerShell)

Prerequisites: Node.js 20.19+ (22.12+ also supported), npm and Python 3.11+.
Run commands from the repository root unless a `Set-Location` command is shown.

### 1. Backend — terminal one

```powershell
git branch --show-current
# Expected: akshay-interview

python -m venv modules/interview_engine/backend/.venv
.\modules\interview_engine\backend\.venv\Scripts\python.exe -m pip install -r modules/interview_engine/backend/requirements.lock.txt
Copy-Item modules/interview_engine/backend/.env.example modules/interview_engine/backend/.env
.\modules\interview_engine\backend\.venv\Scripts\python.exe -m uvicorn modules.interview_engine.backend.main:app --reload --host 127.0.0.1 --port 8000
```

On subsequent starts, run only the last command. Do not overwrite an existing `.env`.
No Gemini key or MongoDB account is required for Phases 1–2. The reserved server-only
environment values are for later phases; the health check does not claim those
services are connected. Never put secrets in `VITE_*` variables.

`requirements.lock.txt` records the exact environment verified on Windows with
Python 3.14. The direct runtime and development dependency lists are also retained
as `requirements.txt` and `requirements-dev.txt` for intentional updates.

Backend health: <http://127.0.0.1:8000/api/health>
API documentation: <http://127.0.0.1:8000/docs>

### 2. Frontend — terminal two

```powershell
Set-Location modules/interview_engine/frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` to the backend on port 8000.
The port is strict so it does not silently change and break CORS configuration.

For a different backend, set `VITE_API_BASE_URL` using the frontend `.env.example`,
and add the frontend origin to backend `CORS_ORIGINS` (a JSON array). Restart servers
after changing environment files. CORS is not authentication: this local-only,
single-user foundation should not be exposed publicly without deployment hardening.

### 3. Check the Phase 2 flow

1. Confirm the overview says **Backend connected**.
2. Click **Prepare with your resume** or **Resume & JD**.
3. Upload a text-based resume PDF (maximum 10 MB and 20 pages).
4. Paste a JD (20–30,000 characters) and click **Extract JD skills**, or select
   **Upload PDF** and upload the JD PDF.
5. Review the extraction notes and edit the suggested profile fields. Lists use one
   entry per line. Add uncommon skills manually; remove preferred/negated JD mentions
   when they are not actual requirements. If you change JD text, review its skill list too.
6. Click **Compare reviewed skills**. Review matches and skills not listed in the resume.
7. Edit a profile and verify the old comparison clears, then compare again.
8. Download the preparation JSON to preserve the reviewed context.

The **Sample session** navigation item retains Phase 1 contract validation/export.
The preparation JSON is a distinct `preparation-1.0` document, not a completed
`InterviewSession`. Later question generation will consume its reviewed profiles.

If the backend is offline, the dashboard explains the error. Start the backend and
use its retry button. No button simulates AI generation or database saving.

### Phase 2 endpoints and limitations

| Method | Endpoint | Body / result |
| --- | --- | --- |
| POST | `/api/interview/resume` | Multipart `file`: PDF → resume profile, source text, metadata |
| POST | `/api/interview/jd` | Multipart `file` **or** form `text`, exactly one → JD profile, metadata |
| POST | `/api/interview/analyze` | JSON `resume_profile` and `job_description` → reviewed profiles, matches, gaps |

File constraints: nonempty PDF, at most 10 MB and 20 pages. Resume text is limited
to 60,000 characters; JD text to 30,000. Password-protected, unreadable and image-only
PDFs are rejected with instructions. OCR is not included; image-only pages in a
mixed document trigger a warning. Tables, unusual headings and multi-column text
can extract imperfectly, so inspect **View extracted resume text** and edit fields.

Extraction is local and rule-based. A curated vocabulary finds common skills;
section headings identify projects, education and experience. No qualifications
are inferred. Soft-skill keywords are mentions, not proof of demonstrated ability.
Unrecognized skills can be entered manually. Review limits: 100 skills, 120 characters
per skill; 60 entries per resume section, 2,000 characters per entry. API validation
reports errors when manually entered fields exceed these limits.

Comparison uses the reviewed lists, never a cached extraction. Known aliases match
(for example, JS/JavaScript), while custom skills match by case-insensitive spelling
and normalized whitespace. Related technologies such as SQL and MySQL remain
separate. There is no suitability score: a gap only means a JD skill is not listed
in the resume profile. Both required and preferred/negated keywords may be suggested
from source text; users must review the JD skill list.

## Verification

From the repository root:

```powershell
.\modules\interview_engine\backend\.venv\Scripts\python.exe -m modules.interview_engine.backend.export_schema
.\modules\interview_engine\backend\.venv\Scripts\python.exe -m pytest modules/interview_engine/backend/tests -q
npm --prefix modules/interview_engine/frontend run build
```

The frontend build writes ignored `dist/` output. `npm run preview` serves that build
on port 4173 but has no backend proxy; for a full-stack local check use `npm run dev`.

## Structure

```text
modules/interview_engine/
  frontend/                 Independent React app, port 5173
    InterviewApp.jsx        Default export reserved for later integration
    src/                    API client, styles and standalone entry point
  backend/                  Independent FastAPI app, port 8000
    main.py                 Standalone app factory
    routes.py               Router reserved for shared backend integration
    schemas.py              Source of truth for completed interview JSON
    document_schemas.py     Separate editable preparation models
    pdf_service.py          Bounded PDF extraction and upload checks
    profile_service.py      Local section/skill extraction and comparison
    tests/                  Contract, PDF, extraction, comparison and CORS checks
contracts/
  interview.sample.json     Synthetic handoff fixture
  interview.schema.json     Generated JSON Schema
  README.md                 Cross-field rules and compatibility notes
```

The shared `contracts/` files and Python package markers support independent work.
There are no changes to `modules/feedback_engine/`, `frontend/` or `backend/`.
`InterviewApp` will accept `onComplete` when actual interview completion is added.
Later the shared backend can mount `routes.router` at `/api/interview`.

## Five-phase roadmap

1. **Foundation:** standalone apps, dashboard, configuration and shared contract.
2. **Resume and JD intelligence:** upload, extraction, editable profiles and skill comparison.
3. **Personalized questions:** interview settings, Gemini generation, validation and labelled fallback.
4. **Interview experience:** text/voice answers, timer, progress, draft recovery and follow-ups.
5. **Storage and delivery:** MongoDB persistence, session retrieval, export and integration checks.

Charan's scoring, recommendations and reports are a separate module. Preserve the
agreed contract and session ID when integrating; the version 1.0 fixture is a proposal
to share with him, not confirmation that his module already supports it.
