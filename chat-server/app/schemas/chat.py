from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional
from app.models.chat import ChatType, MessageStatusType

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ChatCreate(BaseModel):
    type: ChatType
    participant_ids: List[int]
    name: Optional[str] = None   # required for group chats, ignored for direct

class ChatResponse(BaseModel):
    id: int
    type: ChatType
    name: Optional[str] = None
    created_at: datetime
    participants: List[UserResponse] = []

    model_config = ConfigDict(from_attributes=True)

class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: Optional[int]
    sender_username: Optional[str] = None
    content: str
    created_at: datetime
    status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
