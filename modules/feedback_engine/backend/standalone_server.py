"""Compatibility entry point using the common backend and configuration."""
from backend.main import app

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('backend.main:app', host='127.0.0.1', port=8001, reload=True)
