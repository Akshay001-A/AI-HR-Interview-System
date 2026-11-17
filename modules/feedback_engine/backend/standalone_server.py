import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from modules.feedback_engine.backend.routes import router as feedback_router

app = FastAPI(
    title="Charan's AI Feedback Engine",
    description="Independent API module for interview answer evaluation, communication analysis, scoring, and feedback reports.",
    version="1.0.0"
)

# Enable CORS for standalone frontend testing (React dev port 5174 and integration port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the router under /api/feedback as specified in contract
app.include_router(feedback_router, prefix="/api/feedback")


@app.get("/")
def health_check():
    return {
        "module": "Feedback Engine",
        "owner": "Charan Kumar R (1MS23IS031)",
        "status": "online",
        "port": 8001,
        "endpoints": {
            "evaluate": "POST /api/feedback/evaluate",
            "report": "GET /api/feedback/report/{session_id}",
            "sample": "GET /api/feedback/sample",
            "history": "GET /api/feedback/history"
        }
    }


if __name__ == "__main__":
    uvicorn.run("modules.feedback_engine.backend.standalone_server:app", host="0.0.0.0", port=8001, reload=True)
