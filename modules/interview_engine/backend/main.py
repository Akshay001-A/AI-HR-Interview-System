from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="AI HR Interview — Interview Engine",
        version="0.2.0",
        description="Akshay's standalone module. Phase 2: resume/JD extraction and reviewed skill comparison.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router, prefix="/api/interview", tags=["interview"])

    @app.get("/api/health", tags=["system"])
    def health():
        return {
            "status": "ok",
            "service": "interview-engine",
            "phase": 2,
            "schema_version": "1.0",
            "integrations": {
                "gemini": "not_enabled",
                "mongodb": "not_enabled",
            },
        }

    return app


app = create_app()
