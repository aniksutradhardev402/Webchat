from typing import Dict, List
from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_chat(self, message: dict, participants: List[int]):
        """
        Sends a WebSocket payload to all currently active participants in a chat.
        Note: This handles local node routing. Redis Pub/Sub will be used 
        later to route across multiple server instances.
        """
        message_json = json.dumps(message)
        for user_id in participants:
            if user_id in self.active_connections:
                for connection in self.active_connections[user_id]:
                    try:
                        await connection.send_text(message_json)
                    except Exception:
                        pass

    async def send_personal_message(self, message: dict, user_id: int):
        """
        Sends a WebSocket payload to a single specific user across all their active devices.
        Useful for targeted events like read receipts notifications.
        """
        if user_id in self.active_connections:
            message_json = json.dumps(message)
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(message_json)
                except Exception:
                    pass

    async def broadcast_presence(self, message: dict):
        """
        Sends a presence/status event to ALL currently connected users.
        Used when a user comes online or goes offline.
        """
        import json
        message_json = json.dumps(message)
        for connections in self.active_connections.values():
            for connection in connections:
                try:
                    await connection.send_text(message_json)
                except Exception:
                    pass

manager = ConnectionManager()
