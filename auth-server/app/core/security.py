import os
from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt, JWTError
from fastapi import HTTPException, status
from passlib.context import CryptContext

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key-for-development")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7      # 7 days
VERIFY_TOKEN_EXPIRE_MINUTES = 60 * 24           # 24 hours

# Rounds=13 for better brute-force resistance (vs default 12)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=13)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: Union[str, Any], extra: dict = None) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"exp": expire, "sub": str(subject)}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


def create_verification_token(user_id: int) -> str:
    """Create a short-lived JWT used only for email verification."""
    expire = datetime.utcnow() + timedelta(minutes=VERIFY_TOKEN_EXPIRE_MINUTES)
    payload = {
        "exp": expire,
        "sub": str(user_id),
        "purpose": "email_verify",
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


def decode_verification_token(token: str) -> int:
    """Decode and validate an email verification token.
    Returns the user_id on success, raises HTTPException on failure.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "email_verify":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token.",
            )
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link is invalid or has expired. Please request a new one.",
        )
