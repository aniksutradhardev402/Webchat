import re
from pydantic import BaseModel, EmailStr, field_validator

PASSWORD_PATTERN = re.compile(
    r'^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\':\"\\\|,.<>\/?]).{8,}$'
)

# Usernames that are reserved and cannot be registered
RESERVED_USERNAMES = {
    "admin", "administrator", "root", "system", "support",
    "moderator", "mod", "staff", "superuser", "null", "undefined",
    "api", "ws", "chat", "auth", "login", "logout", "register",
    "me", "user", "users", "bot", "guest", "anonymous",
}




class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not PASSWORD_PATTERN.match(v):
            raise ValueError(
                "Password must be at least 8 characters and include "
                "at least one uppercase letter, one digit, and one special character."
            )
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters.")
        if len(v) > 30:
            raise ValueError("Username must be 30 characters or fewer.")
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError("Username may only contain letters, numbers, and underscores.")
        if v.startswith('_') or v.endswith('_'):
            raise ValueError("Username cannot start or end with an underscore.")
        if '__' in v:
            raise ValueError("Username cannot contain consecutive underscores.")
        if v.lower() in RESERVED_USERNAMES:
            raise ValueError(f"'{v}' is a reserved username. Please choose another.")
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True
