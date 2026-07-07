import os
import re
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.db.database import engine
from app.models.user import Base
from app.api import auth
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Auth Microservice",
    description="Authentication and User Management",
    version="1.0.0",
    lifespan=lifespan
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Pydantic v2 error details can contain non-JSON-serializable objects (e.g. ValueError)
    # inside the 'ctx' key. We strip those out and keep only the human-readable 'msg'.
    errors = []
    for err in exc.errors():
        errors.append({
            "loc": err.get("loc"),
            "msg": err.get("msg"),
            "type": err.get("type"),
        })
    return JSONResponse(
        status_code=422,
        content={"detail": errors},
    )

# ── CORS ──────────────────────────────────────────────────────────────────────
# In production, FRONTEND_URL is set to https://yourdomain.com via .env
# In development it falls back to localhost origins automatically
_frontend_url = os.getenv("FRONTEND_URL", "")

# Build the allowed origins list
_allowed_origins: list[str] = [
    # Production
    "https://webchat.aniksutradhar.com",
    # Dev origins — new port scheme (5000/5001/5002)
    "http://localhost:5000",
    "http://localhost:5001",
    "http://localhost:5002",
    "http://127.0.0.1:5000",
    # Legacy dev origins (6000/6001/6002)
    "http://localhost:6000",
    "http://localhost:6001",
    "http://localhost:6002",
    "http://127.0.0.1:6000",
    # Legacy dev fallbacks
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

if _frontend_url and _frontend_url not in _allowed_origins:
    _allowed_origins.append(_frontend_url)
    # Also allow www variant
    _www = re.sub(r"(https?://)", r"\1www.", _frontend_url)
    if _www not in _allowed_origins:
        _allowed_origins.append(_www)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(auth.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to Auth Server"}
