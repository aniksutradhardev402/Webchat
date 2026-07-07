import asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Config
DB_URL = "postgresql+asyncpg://postgres:password@db:5432/chatdb"
AUTH_API = "http://auth_server:8001/api/auth"
CHAT_API = "http://localhost:8000/api"

USERS = [
    {"email": "alice@test.com", "password": "Password123!"},
    {"email": "bob@test.com", "password": "Password123!"},
    {"email": "charlie@test.com", "password": "Password123!"},
    {"email": "david@test.com", "password": "Password123!"},
]

async def reset_db():
    print("[*] Connecting to database to wipe state...")
    engine = create_async_engine(DB_URL)
    async with engine.begin() as conn:
        # Disable triggers to truncate tables with foreign keys
        await conn.execute(text("TRUNCATE TABLE message_status, messages, participants, chats, users CASCADE;"))
    print("[+] Database wiped successfully!")

async def seed_users():
    print("[*] Registering 4 standard users...")
    user_ids = []
    async with httpx.AsyncClient() as client:
        for user in USERS:
            try:
                res = await client.post(f"{AUTH_API}/register", json=user)
                if res.status_code == 201:
                    uid = res.json()["id"]
                    user_ids.append(uid)
                    print(f"    - Registered {user['email']} (ID: {uid})")
            except Exception as e:
                print(f"    - Failed to register {user['email']}: {e}")
    return user_ids

async def seed_chats(user_ids):
    if len(user_ids) < 2: return
    print("[*] Creating initial conversations...")
    async with httpx.AsyncClient() as client:
        # Get Alice's token
        login = await client.post(f"{AUTH_API}/login", json={"email": "alice@test.com", "password": "Password123!"})
        token = login.json()["access_token"]
        
        # Alice starts chat with Bob (ID 0 and 1)
        await client.post(
            f"{CHAT_API}/chats/", 
            json={"type": "direct", "participant_ids": [user_ids[0], user_ids[1]]},
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"    - Created Alice <-> Bob chat")

async def main():
    # await reset_db()
    uids = await seed_users()
    await seed_chats(uids)
    print("\n[SUCCESS] Environment is ready for E2E testing!")

if __name__ == "__main__":
    asyncio.run(main())
