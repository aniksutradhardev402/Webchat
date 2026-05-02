from sqlalchemy import String, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from typing import Optional

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Email verification — False until user clicks the link in their inbox
    # Google SSO users are always True (Google has already verified the email)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # OAuth fields — null for email/password users
    oauth_provider: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    oauth_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    public_key: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
