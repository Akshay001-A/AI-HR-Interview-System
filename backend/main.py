"""Common API for interview preparation, live practice and feedback."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.config import get_settings
from modules.feedback_engine.backend.routes import router
from modules.interview_engine.backend.routes import router as interview_router
from modules.interview_engine.backend.config import get_settings as interview_settings

MAX_BODY = 2 * 1024 * 1024


class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope.get('method') not in ('POST', 'PUT', 'PATCH'):
            return await self.app(scope, receive, send)
        limit = interview_settings().max_upload_bytes + 1024 * 1024 if scope.get('path') in ('/api/interview/resume', '/api/interview/jd') else MAX_BODY
        body = bytearray()
        while True:
            event = await receive()
            if event['type'] == 'http.disconnect':
                return
            body.extend(event.get('body', b''))
            if len(body) > limit:
                return await JSONResponse({'detail': 'The uploaded file exceeds the request size limit.'}, status_code=413)(scope, receive, send)
            if not event.get('more_body', False):
                break
        consumed = False
        async def replay():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()
        await self.app(scope, replay, send)


app = FastAPI(title='Interview Studio', version='0.5.0')
app.add_middleware(BodyLimit)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins,
                    allow_credentials=False, allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
app.include_router(router, prefix='/api/feedback')
app.include_router(interview_router, prefix='/api/interview')


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={'detail': 'The request could not be completed. Please try again. No substitute feedback was created.'})


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('backend.main:app', host='127.0.0.1', port=8000, reload=True)
