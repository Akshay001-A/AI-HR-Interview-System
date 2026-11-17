from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="AI HR Interview — Interview Engine",
        version="0.4.0",
        description="Akshay's standalone module. Phase 4: interactive HR interviews, answer-dependent follow-ups and completed-session handoff.",
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
            "phase": 4,
            "schema_version": "1.0",
            "integrations": {
                "gemini": "configured" if settings.gemini_api_key.get_secret_value() else "not_configured",
                "mongodb": "not_enabled",
            },
        }

    return app


app = create_app()
