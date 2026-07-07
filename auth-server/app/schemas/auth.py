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


class UserLogin(BaseModel):
    email: EmailStr
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
