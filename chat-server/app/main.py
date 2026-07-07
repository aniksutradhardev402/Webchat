import os
import re
from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chats, users
from app.websocket.routes import router as websocket_router
from app.db.database import engine
from app.models.chat import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up Chat Server")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    print("Shutting down Chat Server")

app = FastAPI(
    title="Real-Time Chat Server",
    description="FastAPI based backend for real-time messaging",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_frontend_url = os.getenv("FRONTEND_URL", "")

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

app.include_router(chats.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(websocket_router)

@app.get("/")
async def root():
    return {"message": "Welcome to the FastAPI Chat Server"}
