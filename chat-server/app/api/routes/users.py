from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict
from app.db.database import get_db
from app.models.chat import User
from app.schemas.user import UserPublic
from app.api.dependencies import get_current_user
from app.brokers.redis_client import get_redis

from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, HTTPException

router = APIRouter(prefix="/users", tags=["Users"])

class PublicKeyRequest(BaseModel):
    public_key: str

@router.get("/search", response_model=List[UserPublic])
async def search_users(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(User).where(
        User.username.ilike(f"%{q}%"),
        User.id != current_user.id
    ).limit(10)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users

@router.get("/presence", response_model=Dict[str, str])
async def get_presence(
    ids: str = Query(..., description="Comma-separated user IDs"),
    current_user: User = Depends(get_current_user)
):
    """Returns presence status for a list of user IDs from Redis."""
    redis = await get_redis()
    user_ids = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    result = {}
    for uid in user_ids:
        status = await redis.get(f"user:status:{uid}")
        result[str(uid)] = status or "offline"
    return result
@router.post("/public-key")
async def update_public_key(
    req: PublicKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # This binds to the same DB session to update public_key
    stmt = select(User).where(User.id == current_user.id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user:
        user.public_key = req.public_key
        await db.commit()
    return {"status": "ok"}

@router.get("/{user_id}/public-key")
async def get_public_key(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"public_key": user.public_key}
