# AI-Powered HR Interview Preparation and Personalized Feedback System for Students

### Team Members
- **Akshay R (1MS23IS008)**: AI Interview Engine (`modules/interview_engine/`, branch: `feature/akshay-interview`)
- **Charan Kumar R (1MS23IS031)**: AI Feedback Engine (`modules/feedback_engine/`, branch: `feature/charan-feedback`)

**Department of Information Science and Engineering, M. S. Ramaiah Institute of Technology, Bengaluru**

---

## Charan's Module: AI Feedback Engine

The **AI Feedback Engine** accepts completed interview session data (from Akshay's interview engine or directly via contract JSON), performs deep AI rubric scoring across 5 key dimensions, conducts speech & communication NLP analysis, generates improved model answers, provides placement recommendations, and persists reports into MongoDB Atlas (`ai_hr_interview.feedback`).

```
Answers → Evaluation → Feedback → Report
```

### Architecture & Folder Structure
```
AI-HR-Interview-System/
│
├── modules/
│   ├── interview_engine/            # AKSHAY
│   │   ├── frontend/
│   │   └── backend/
│   │
│   └── feedback_engine/             # CHARAN
│       ├── frontend/
│       │   ├── FeedbackApp.jsx
│       │   ├── AnswerEvaluation.jsx
│       │   ├── CommunicationAnalysis.jsx
│       │   ├── FinalReport.jsx
│       │   └── Recommendations.jsx
│       └── backend/
│           ├── __init__.py
│           ├── routes.py
│           ├── evaluation_service.py
│           ├── communication_service.py
│           ├── feedback_service.py
│           ├── database.py
│           └── standalone_server.py
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   └── main.py
│
├── contracts/
│   ├── interview.json
│   └── feedback.json
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 5 Evaluation Criteria (0–100 Scale)
Every answer is scored across 5 rubric criteria:
1. **Relevance**: Alignment with interview question and Job Description requirements.
2. **Clarity**: Professional phrasing, coherence, and concise delivery.
3. **Structure**: Logical organization using the STAR method (Situation, Task, Action, Result).
4. **Completeness**: Thoroughness in addressing every facet of the question.
5. **Examples**: Concrete project achievements, metrics, and technical evidence.

*Answer Score = Average of the 5 criteria.*
*Overall Score = Average of all answer scores.*

---

## Communication & Speech NLP Analysis
- **Filler Word Detection**: Identifies hesitation markers (`um`, `uh`, `like`, `you know`, `actually`, `basically`).
- **Speaking Rate (WPM)**: If `duration_seconds` is recorded, calculates words-per-minute with feedback (120–150 WPM target). *Omitted cleanly if timing is unavailable as per contract.*
- **Grammar & Flow**: Evaluates sentence structure and provides actionable tips.

---

## Quickstart: Running Charan's Module

### 1. Backend (FastAPI - Port 8001)
From project root:
```bash
# Optional: Set GEMINI_API_KEY and MONGODB_URI in .env
python -m modules.feedback_engine.backend.standalone_server
```
API Documentation will be live at: `http://localhost:8001/docs`

### 2. Frontend (React + Vite - Port 5174)
From `frontend/` directory:
```bash
npm install
npm run dev
```
Open `http://localhost:5174` in your browser.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/feedback/evaluate` | Evaluates completed interview JSON & saves to MongoDB |
| `GET` | `/api/feedback/report/{session_id}` | Retrieves saved report by session ID |
| `GET` | `/api/feedback/sample` | Returns contract sample interview JSON |
| `GET` | `/api/feedback/history` | Lists saved session IDs |

---

## Git Workflow
Charan works strictly on branch `feature/charan-feedback`:
```bash
git checkout -b feature/charan-feedback
git add modules/feedback_engine/ contracts/ README.md
git commit -m "Complete AI feedback engine"
git push -u origin feature/charan-feedback
```
