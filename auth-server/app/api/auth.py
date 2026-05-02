import os
import re
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, Token, UserResponse
from app.core.security import (
    get_password_hash, verify_password,
    create_access_token, create_verification_token, decode_verification_token,
)
from app.core.email import send_verification_email
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:6000")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _derive_username(base: str) -> str:
    """Sanitise an email-prefix into a valid username."""
    return re.sub(r'[^a-zA-Z0-9_]', '', base.lower())[:30] or "user"


async def _unique_username(db: AsyncSession, base: str) -> str:
    """Return base if available, otherwise append _2, _3, etc."""
    candidate = _derive_username(base)
    i = 2
    while True:
        stmt = select(User).where(User.username == candidate)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            return candidate
        candidate = f"{_derive_username(base)}_{i}"
        i += 1


# ── Email / Password Registration ─────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register_user(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Check for duplicate username or email
    stmt = select(User).where(
        (User.username == user_in.username) | (User.email == user_in.email)
    )
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already registered.")

    # Create user — unverified until email link clicked
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        is_verified=False,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Generate a 24h verification token and send email in the background
    token = create_verification_token(new_user.id)
    background_tasks.add_task(
        send_verification_email, new_user.email, new_user.username, token
    )

    return {
        "message": "Registration successful! Please check your email to verify your account.",
        "email": new_user.email,
    }


# ── Email Verification ────────────────────────────────────────────────────────

@router.get("/verify")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Called when the user clicks the link in their verification email."""
    user_id = decode_verification_token(token)   # raises 400 if invalid/expired

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_verified:
        # Already verified — just redirect without error
        return RedirectResponse(f"{FRONTEND_URL}/login?verified=already")

    user.is_verified = True
    await db.commit()

    return RedirectResponse(f"{FRONTEND_URL}/login?verified=true")


# ── Resend Verification Email ─────────────────────────────────────────────────

@router.post("/resend-verification", status_code=200)
async def resend_verification(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Body: {"email": "user@example.com"}
    Always returns 200 — never reveal whether the email exists (security).
    """
    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    stmt = select(User).where(User.email == email)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if user and not user.is_verified and user.hashed_password:
        token = create_verification_token(user.id)
        background_tasks.add_task(
            send_verification_email, user.email, user.username, token
        )

    return {"message": "If that email is registered and unverified, a new link has been sent."}


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=Token)
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.username == user_in.username)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Block login for unverified email/password accounts
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="EMAIL_NOT_VERIFIED",
        )

    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


# ── Google SSO ────────────────────────────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _google_redirect_uri() -> str:
    return f"{os.getenv('AUTH_SERVER_URL', 'http://localhost:6001')}/api/auth/oauth/google/callback"


@router.get("/oauth/google")
async def google_login():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google SSO is not configured")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": _google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    url = GOOGLE_AUTH_URL + "?" + "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url)


@router.get("/oauth/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google SSO is not configured")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": _google_redirect_uri(),
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google code")
        token_data = token_res.json()

        info_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        if info_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
        guser = info_res.json()

    google_id = guser["sub"]
    email = guser["email"]
    name = guser.get("name", "")

    stmt = select(User).where(User.oauth_provider == "google", User.oauth_id == google_id)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        stmt2 = select(User).where(User.email == email)
        user = (await db.execute(stmt2)).scalar_one_or_none()
        if user:
            user.oauth_provider = "google"
            user.oauth_id = google_id
            user.is_verified = True  # Upgrade existing account to verified via Google
        else:
            base = name.replace(" ", "") or email.split("@")[0]
            username = await _unique_username(db, base)
            user = User(
                username=username,
                email=email,
                oauth_provider="google",
                oauth_id=google_id,
                is_verified=True,   # Google guarantees email ownership
            )
            db.add(user)

    await db.commit()
    await db.refresh(user)

    jwt_token = create_access_token(user.id)
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?token={jwt_token}")
