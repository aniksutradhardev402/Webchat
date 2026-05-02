from enum import Enum as PyEnum
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import String, ForeignKey, Enum, Column, Table
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

def utc_now():
    return datetime.utcnow()

class Base(DeclarativeBase):
    pass

class ChatType(str, PyEnum):
    DIRECT = "direct"
    GROUP = "group"

class MessageStatusType(str, PyEnum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"

# Association table for Many-to-Many relationship between Users and Chats
from sqlalchemy import String, ForeignKey, Enum, Column, Table, DateTime

participants_table = Table(
    "participants",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("chat_id", ForeignKey("chats.id", ondelete="CASCADE"), primary_key=True),
    Column("joined_at", DateTime, default=utc_now)
)

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    public_key: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    
    # Relationships
    chats: Mapped[List["Chat"]] = relationship(
        secondary=participants_table, back_populates="participants"
    )
    messages: Mapped[List["Message"]] = relationship(back_populates="sender")

class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    type: Mapped[ChatType] = mapped_column(Enum(ChatType))
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    
    # Relationships
    participants: Mapped[List["User"]] = relationship(
        secondary=participants_table, back_populates="chats"
    )
    messages: Mapped[List["Message"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan"
    )

class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    content: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(default=utc_now)

    # Relationships
    chat: Mapped["Chat"] = relationship(back_populates="messages")
    sender: Mapped[Optional["User"]] = relationship(back_populates="messages")
    statuses: Mapped[List["MessageStatus"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )

class MessageStatus(Base):
    __tablename__ = "message_status"

    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[MessageStatusType] = mapped_column(Enum(MessageStatusType), default=MessageStatusType.SENT)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)

    # Relationships
    message: Mapped["Message"] = relationship(back_populates="statuses")
    user: Mapped["User"] = relationship()

class GroupKey(Base):
    __tablename__ = "group_keys"

    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    encrypted_key: Mapped[str] = mapped_column(String(2000))
    iv: Mapped[str] = mapped_column(String(255))

