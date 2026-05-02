from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.websocket.connection_manager import manager
from app.services.message_service import MessageService
from app.db.database import get_db
from app.models.chat import MessageStatusType
from app.api.dependencies import get_current_user_ws
from app.brokers.redis_client import get_redis

router = APIRouter(tags=["WebSockets"])

# Redis key helpers
def _presence_key(user_id: int) -> str:
    return f"user:status:{user_id}"

def _typing_key(chat_id: int, user_id: int) -> str:
    return f"typing:{chat_id}:{user_id}"

PRESENCE_TTL = 60   # seconds — refreshed on activity; auto-expires to "offline"
IDLE_TTL = 30       # seconds — if no activity for 30s within the presence window, mark idle


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    current_user = await get_current_user_ws(token, db)
    user_id = current_user.id
    username = current_user.username

    redis = await get_redis()
    await manager.connect(user_id, websocket)

    # Mark user online
    await redis.set(_presence_key(user_id), "online", ex=PRESENCE_TTL)
    # Broadcast online status to all connections so sidebars update immediately
    await manager.broadcast_presence({"action": "presence", "user_id": user_id, "status": "online"})

    try:
        while True:
            raw_data = await websocket.receive_json()
            action = raw_data.get("action")
            data = raw_data.get("data", {})

            # Refresh presence TTL on any activity
            await redis.set(_presence_key(user_id), "online", ex=PRESENCE_TTL)

            # ── Send Message ─────────────────────────────────────────────────
            if action == "send_message":
                content = data.get("content")
                chat_id = data.get("chat_id")
                if content and chat_id:
                    new_message = await MessageService.save_message(
                        db=db,
                        chat_id=chat_id,
                        sender_id=user_id,
                        content=content
                    )
                    participants = await MessageService.get_chat_participants(db, chat_id)
                    payload = {
                        "action": "new_message",
                        "id": new_message.id,
                        "chat_id": chat_id,
                        "sender_id": user_id,
                        "sender_username": username,
                        "content": content,
                        "created_at": new_message.created_at.isoformat(),
                    }
                    await manager.broadcast_to_chat(payload, participants)

                    # Clear typing indicator for this user in this chat
                    await redis.delete(_typing_key(chat_id, user_id))

            # ── Typing Indicator ─────────────────────────────────────────────
            elif action == "typing":
                chat_id = data.get("chat_id")
                is_typing = bool(data.get("is_typing", False))
                if chat_id:
                    if is_typing:
                        await redis.set(_typing_key(chat_id, user_id), username, ex=4)
                    else:
                        await redis.delete(_typing_key(chat_id, user_id))

                    participants = await MessageService.get_chat_participants(db, chat_id)
                    typing_payload = {
                        "action": "typing",
                        "chat_id": chat_id,
                        "user_id": user_id,
                        "username": username,
                        "is_typing": is_typing,
                    }
                    # Broadcast to all OTHER participants
                    other_participants = [p for p in participants if p != user_id]
                    await manager.broadcast_to_chat(typing_payload, other_participants)

            # ── Presence override from client (online / idle) ────────────────
            elif action == "set_presence":
                new_status = data.get("status", "online")
                if new_status in ("online", "idle"):
                    ttl = PRESENCE_TTL if new_status == "online" else IDLE_TTL
                    await redis.set(_presence_key(user_id), new_status, ex=ttl)
                    await manager.broadcast_presence({
                        "action": "presence",
                        "user_id": user_id,
                        "status": new_status,
                    })

            # ── Read / Delivered ─────────────────────────────────────────────
            elif action in ["mark_delivered", "mark_read"]:
                message_id = data.get("message_id")
                if message_id:
                    status_enum = MessageStatusType.READ if action == "mark_read" else MessageStatusType.DELIVERED
                    sender_id = await MessageService.update_message_status(
                        db=db,
                        message_id=message_id,
                        user_id=user_id,
                        new_status=status_enum
                    )
                    if sender_id and sender_id != user_id:
                        status_payload = {
                            "action": "status_update",
                            "message_id": message_id,
                            "user_id": user_id,
                            "status": status_enum.value,
                        }
                        await manager.send_personal_message(status_payload, sender_id)

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user {user_id}")
    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
    finally:
        manager.disconnect(user_id, websocket)
        await redis.set(_presence_key(user_id), "offline")
        await manager.broadcast_presence({"action": "presence", "user_id": user_id, "status": "offline"})
