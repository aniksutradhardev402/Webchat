from pydantic import BaseModel
from typing import List

class UserPublic(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True

class UserSearchList(BaseModel):
    users: List[UserPublic]
