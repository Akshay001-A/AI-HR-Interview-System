"""Compatibility launcher for the common interview-and-feedback backend."""
from backend.main import app


def create_app():
    return app
