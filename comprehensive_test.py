import asyncio
import httpx
import websockets
import json
import uuid
import subprocess
import time

# Configuration for local testing
AUTH_SERVER_URL = "http://localhost:8001"
CHAT_SERVER_URL = "http://localhost:8002"
WS_SERVER_URL = "ws://localhost:8002"

def clean_db():
    print("\n[*] --- STEP 0: CLEANING DATABASE ---")
    tables = ["message_status", "messages", "participants", "chats", "users"]
    truncate_query = f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE;"
    cmd = ["docker", "exec", "-i", "chat-server-db-1", "psql", "-U", "postgres", "-d", "chatdb", "-c", truncate_query]
    subprocess.run(cmd, check=True, capture_output=True)
    print("[+] Database is clean.")

def check_db_counts(expected_users=0, expected_chats=0, expected_messages=0):
    print("\n[*] --- VERIFYING DATABASE DATA ---")
    queries = {
        "users": "SELECT count(*) FROM users;",
        "chats": "SELECT count(*) FROM chats;",
        "messages": "SELECT count(*) FROM messages;"
    }
    results = {}
    for key, query in queries.items():
        cmd = ["docker", "exec", "-i", "chat-server-db-1", "psql", "-U", "postgres", "-d", "chatdb", "-t", "-c", query]
        out = subprocess.run(cmd, check=True, capture_output=True, text=True).stdout.strip()
        results[key] = int(out)
        print(f"    {key.capitalize()} count: {results[key]}")
    
    assert results["users"] == expected_users, f"User count mismatch: expected {expected_users}, got {results['users']}"
    assert results["chats"] == expected_chats, f"Chat count mismatch: expected {expected_chats}, got {results['chats']}"
    assert results["messages"] == expected_messages, f"Message count mismatch: expected {expected_messages}, got {results['messages']}"
    print("[+] Database state matches expectations!")

async def register_user(client, username):
    payload = {"username": username, "email": f"{username}@test.com", "password": "password123"}
    resp = await client.post(f"{AUTH_SERVER_URL}/api/auth/register", json=payload)
    assert resp.status_code == 200, f"Registration failed for {username}: {resp.text}"
    return resp.json()["id"]

async def login_user(client, username):
    payload = {"username": username, "password": "password123"}
    resp = await client.post(f"{AUTH_SERVER_URL}/api/auth/login", json=payload)
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()["access_token"]

async def main():
    clean_db()
    
    users = ["user_1", "user_2", "user_3", "user_4"]
    user_data = {}

    async with httpx.AsyncClient() as client:
        # 1. Register 4 Users
        print(f"\n[*] --- STEP 1: REGISTERING 4 USERS ---")
        for u in users:
            uid = await register_user(client, u)
            print(f"    Registered: {u} (ID: {uid})")
            user_data[u] = {"id": uid}

        # 2. Login 4 Users
        print(f"\n[*] --- STEP 2: LOGGING IN 4 USERS ---")
        for u in users:
            token = await login_user(client, u)
            user_data[u]["token"] = token
            print(f"    Logged in: {u}")

        # 3. Create Direct Chat (User 1 & User 2)
        print(f"\n[*] --- STEP 3: CREATING DIRECT CHAT (User 1 & User 2) ---")
        headers_1 = {"Authorization": f"Bearer {user_data['user_1']['token']}"}
        resp = await client.post(
            f"{CHAT_SERVER_URL}/api/chats/", 
            json={"type": "direct", "participant_ids": [user_data['user_1']['id'], user_data['user_2']['id']]},
            headers=headers_1
        )
        assert resp.status_code == 200, f"Direct chat creation failed: {resp.text}"
        direct_chat_id = resp.json()["id"]
        print(f"    Direct Chat ID: {direct_chat_id}")

        # 4. Create Group Chat (All 4 users)
        print(f"\n[*] --- STEP 4: CREATING GROUP CHAT (Users 1, 2, 3, 4) ---")
        resp = await client.post(
            f"{CHAT_SERVER_URL}/api/chats/", 
            json={"type": "group", "participant_ids": [user_data[u]['id'] for u in users]},
            headers=headers_1
        )
        assert resp.status_code == 200, f"Group chat creation failed: {resp.text}"
        group_chat_id = resp.json()["id"]
        print(f"    Group Chat ID: {group_chat_id}")

        # 5. Connect WebSockets for User 1 and User 2 (Direct Chat)
        print(f"\n[*] --- STEP 5: SENDING MESSAGE IN DIRECT CHAT (User 1 -> User 2) ---")
        ws_url_1 = f"{WS_SERVER_URL}/ws/chat/{direct_chat_id}?token={user_data['user_1']['token']}"
        ws_url_2 = f"{WS_SERVER_URL}/ws/chat/{direct_chat_id}?token={user_data['user_2']['token']}"
        
        async with websockets.connect(ws_url_1) as ws1, websockets.connect(ws_url_2) as ws2:
            msg_payload = {"action": "send_message", "data": {"content": "Hello User 2! This is a private message."}}
            await ws1.send(json.dumps(msg_payload))
            
            # User 1 receives broadcast
            resp1 = json.loads(await ws1.recv())
            # User 2 receives message
            resp2 = json.loads(await ws2.recv())
            print(f"    User 2 received: '{resp2['content']}'")

        # 6. Connect WebSockets for User 3 in Group Chat
        print(f"\n[*] --- STEP 6: SENDING MESSAGE IN GROUP CHAT (User 3 -> All) ---")
        ws_url_3 = f"{WS_SERVER_URL}/ws/chat/{group_chat_id}?token={user_data['user_3']['token']}"
        async with websockets.connect(ws_url_3) as ws3:
            msg_payload = {"action": "send_message", "data": {"content": "Hey everyone! User 3 here in the group chat."}}
            await ws3.send(json.dumps(msg_payload))
            # User 3 receives broadcast
            resp3 = json.loads(await ws3.recv())
            print(f"    User 3 sent group message: '{resp3['content']}'")

    # 7. Check Data in DB
    # Expected: 4 users, 2 chats, 2 messages
    check_db_counts(expected_users=4, expected_chats=2, expected_messages=2)
    
    # 8. Final Clean-up
    clean_db()
    check_db_counts(expected_users=0, expected_chats=0, expected_messages=0)

    print("\n[SUCCESS] ALL INTEGRATION TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(main())
