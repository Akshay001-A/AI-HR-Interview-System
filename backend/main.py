import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure modules can be imported
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

app = FastAPI(title="AI HR Interview System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Try importing Akshay's interview engine if present
try:
    from modules.interview_engine.backend.routes import router as interview_router
    app.include_router(interview_router, prefix="/api/interview")
except ImportError:
    pass

# Import Charan's feedback engine
from modules.feedback_engine.backend.routes import router as feedback_router
app.include_router(feedback_router, prefix="/api/feedback")


@app.get("/")
def root():
    return {
        "project": "AI-Powered HR Interview Preparation and Personalized Feedback System for Students",
        "team": [
            "Akshay R (1MS23IS008) - AI Interview Engine",
            "Charan Kumar R (1MS23IS031) - AI Feedback Engine"
        ],
        "feedback_engine_status": "Ready",
        "endpoints": {
            "evaluate": "POST /api/feedback/evaluate",
            "report": "GET /api/feedback/report/{session_id}"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
