import asyncio
import httpx
import websockets
import json
import uuid

# Configuration for local testing
AUTH_SERVER_URL = "http://localhost:8001"
CHAT_SERVER_URL = "http://localhost:8002"
WS_SERVER_URL = "ws://localhost:8002"

async def main():
    suffix = str(uuid.uuid4())[:6]
    alice = {"username": f"alice_{suffix}", "email": f"alice_{suffix}@test.com", "password": "password123"}
    bob = {"username": f"bob_{suffix}", "email": f"bob_{suffix}@test.com", "password": "password123"}

    async with httpx.AsyncClient() as client:
        # 1. Register Users
        print(f"[*] Registering Alice ({alice['username']}) and Bob ({bob['username']})...")
        r_alice = await client.post(f"{AUTH_SERVER_URL}/api/auth/register", json=alice)
        r_bob = await client.post(f"{AUTH_SERVER_URL}/api/auth/register", json=bob)
        
        assert r_alice.status_code == 200, f"Alice registration failed: {r_alice.text}"
        assert r_bob.status_code == 200, f"Bob registration failed: {r_bob.text}"
        
        alice_id = r_alice.json()["id"]
        bob_id = r_bob.json()["id"]

        # 2. Login to get JWT
        print("[*] Logging in to get JWT access tokens...")
        l_alice = await client.post(f"{AUTH_SERVER_URL}/api/auth/login", json={"username": alice["username"], "password": alice["password"]})
        l_bob = await client.post(f"{AUTH_SERVER_URL}/api/auth/login", json={"username": bob["username"], "password": bob["password"]})
        
        alice_token = l_alice.json()["access_token"]
        bob_token = l_bob.json()["access_token"]

        # 3. Create a Direct Chat Room
        print("[*] Creating a direct chat room between Alice and Bob...")
        headers = {"Authorization": f"Bearer {alice_token}"}
        chat_req = await client.post(
            f"{CHAT_SERVER_URL}/api/chats/", 
            json={"type": "direct", "participant_ids": [alice_id, bob_id]},
            headers=headers
        )
        assert chat_req.status_code == 200, f"Chat creation failed: {chat_req.text}"
        chat_id = chat_req.json()["id"]
        print(f"[+] Chat Room #{chat_id} created successfully!")

    # 4. Open WebSockets
    print("[*] Opening WebSockets for both users...")
    
    alice_ws_url = f"{WS_SERVER_URL}/ws/chat/{chat_id}/{alice_id}?token={alice_token}"
    bob_ws_url = f"{WS_SERVER_URL}/ws/chat/{chat_id}/{bob_id}?token={bob_token}"
    
    async with websockets.connect(alice_ws_url) as ws_alice, websockets.connect(bob_ws_url) as ws_bob:
        print("[+] Both WebSockets connected!")
        
        # 5. Alice sends a message
        print("[*] Alice is sending a message...")
        send_payload = {
            "action": "send_message",
            "data": {"content": "Hello Bob! How are you?"}
        }
        await ws_alice.send(json.dumps(send_payload))
        
        # 6. Alice script receives the broadcast of her own message
        alice_response_1 = json.loads(await ws_alice.recv())
        print(f"    <- Alice received her broadcast: {alice_response_1['action']}")
        message_id = alice_response_1["id"]
        
        # 7. Bob receives the message
        bob_incoming = json.loads(await ws_bob.recv())
        print(f"    <- Bob received message from Alice: '{bob_incoming['content']}' (ID: {message_id})")
        
        # 8. Bob explicitly marks the message as read
        print("\n[*] Bob is opening his screen and marking the message as READ...")
        read_payload = {
            "action": "mark_read",
            "data": {"message_id": message_id}
        }
        await ws_bob.send(json.dumps(read_payload))
        
        # 9. Alice receives the read receipt directly
        # Sometimes WebSockets receive multiple packets; we wait for the status_update
        while True:
            response = json.loads(await ws_alice.recv())
            if response.get("action") == "status_update":
                print(f"    <- Alice received Blue Checkmarks! Private push status: {response['status']}")
                break
                
    print("\n[SUCCESS] ALL END-TO-END TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
