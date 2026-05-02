from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.future import select
from app.db.database import get_db
from app.models.chat import Chat, User, ChatType
from app.schemas.chat import ChatCreate, ChatResponse, MessageResponse
from app.api.dependencies import get_current_user
from app.services.message_service import MessageService

router = APIRouter(prefix="/chats", tags=["Chats"])

@router.get("/", response_model=List[ChatResponse])
async def get_my_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Chat).join(Chat.participants).where(User.id == current_user.id).options(selectinload(Chat.participants))
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=ChatResponse)
async def create_chat(
    chat_in: ChatCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate participants
    participant_ids = list(set(chat_in.participant_ids))  # deduplicate in case of duplicates
    stmt = select(User).where(User.id.in_(participant_ids))
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    if len(users) != len(participant_ids):
        raise HTTPException(status_code=400, detail="One or more participant users not found")

    # Prevent duplicate DIRECT chats between the same two users
    if chat_in.type == ChatType.DIRECT and len(participant_ids) == 2:
        # Find all direct chats where BOTH users are participants
        user_id_a, user_id_b = participant_ids[0], participant_ids[1]

        # Get all direct chats that user_a is in
        stmt_a = (
            select(Chat.id)
            .join(Chat.participants)
            .where(User.id == user_id_a, Chat.type == ChatType.DIRECT)
        )
        result_a = await db.execute(stmt_a)
        chats_of_a = {row[0] for row in result_a.all()}

        # Get all direct chats that user_b is in
        stmt_b = (
            select(Chat.id)
            .join(Chat.participants)
            .where(User.id == user_id_b, Chat.type == ChatType.DIRECT)
        )
        result_b = await db.execute(stmt_b)
        chats_of_b = {row[0] for row in result_b.all()}

        # Intersection = existing direct chats shared by BOTH users
        shared_chat_ids = chats_of_a & chats_of_b
        if shared_chat_ids:
            # Return the existing chat instead of creating a duplicate
            existing_chat_id = next(iter(shared_chat_ids))
            stmt_existing = select(Chat).options(selectinload(Chat.participants)).where(Chat.id == existing_chat_id)
            existing_chat = (await db.execute(stmt_existing)).scalar_one()
            return existing_chat
        
    # Build chat with Many-to-Many associations
    chat = Chat(
        type=chat_in.type,
        name=chat_in.name if chat_in.type == ChatType.GROUP else None
    )
    chat.participants.extend(users)
    
    db.add(chat)
    await db.commit()
    
    # Reload with participants eager-loaded to satisfy Pydantic response requirements
    stmt_reload = select(Chat).options(selectinload(Chat.participants)).where(Chat.id == chat.id)
    chat_reloaded = (await db.execute(stmt_reload)).scalar_one()
    return chat_reloaded

@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    messages = await MessageService.get_chat_history(db, chat_id, current_user.id)
    return messages
