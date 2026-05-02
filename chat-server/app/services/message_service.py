from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.models.chat import Message, Chat, MessageStatus, MessageStatusType
from typing import List

class MessageService:
    
    @staticmethod
    async def save_message(db: AsyncSession, chat_id: int, sender_id: int, content: str) -> Message:
        """Persists the new message and automatically provisions MessageStatus tracking for all recipients."""
        message = Message(chat_id=chat_id, sender_id=sender_id, content=content)
        db.add(message)
        await db.commit()
        await db.refresh(message)
        
        stmt = select(Chat).options(selectinload(Chat.participants)).where(Chat.id == chat_id)
        result = await db.execute(stmt)
        chat = result.scalar_one_or_none()
        
        if chat:
            for participant in chat.participants:
                initial_status = MessageStatusType.READ if participant.id == sender_id else MessageStatusType.SENT
                
                status = MessageStatus(
                    message_id=message.id,
                    user_id=participant.id,
                    status=initial_status
                )
                db.add(status)
            await db.commit()
            
        return message

    @staticmethod
    async def get_chat_participants(db: AsyncSession, chat_id: int) -> List[int]:
        """Utility to quickly grab all IDs in a chat for message broadcasting"""
        stmt = select(Chat).options(selectinload(Chat.participants)).where(Chat.id == chat_id)
        result = await db.execute(stmt)
        chat = result.scalar_one_or_none()
        if chat:
            return [p.id for p in chat.participants]
        return []

    @staticmethod
    async def update_message_status(db: AsyncSession, message_id: int, user_id: int, new_status: MessageStatusType) -> int | None:
        """
        Updates the status of a specific message for a specific user.
        Returns the original sender's ID so we know who to notify about the read receipt.
        """
        # Find and update the status row
        stmt = select(MessageStatus).where(
            (MessageStatus.message_id == message_id) & 
            (MessageStatus.user_id == user_id)
        )
        result = await db.execute(stmt)
        status_record = result.scalar_one_or_none()
        
        if status_record:
            status_record.status = new_status
            await db.commit()
            
        # Find the original message to return the sender_id
        msg_stmt = select(Message).where(Message.id == message_id)
        msg_result = await db.execute(msg_stmt)
        msg_record = msg_result.scalar_one_or_none()
        
        if msg_record:
            return msg_record.sender_id
        return None
    @staticmethod
    async def get_chat_history(db: AsyncSession, chat_id: int, current_user_id: int, limit: int = 50) -> list:
        """Fetches the most recent messages for a chat room, with per-user read status and sender username."""
        from sqlalchemy.orm import selectinload
        stmt = (
            select(Message)
            .options(selectinload(Message.statuses), selectinload(Message.sender))
            .where(Message.chat_id == chat_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        messages = result.scalars().all()
        messages = messages[::-1]

        output = []
        for msg in messages:
            user_status = next(
                (s.status.value for s in msg.statuses if s.user_id == current_user_id),
                None
            )
            output.append({
                "id": msg.id,
                "chat_id": msg.chat_id,
                "sender_id": msg.sender_id,
                "sender_username": msg.sender.username if msg.sender else None,
                "content": msg.content,
                "created_at": msg.created_at,
                "status": user_status,
            })
        return output
