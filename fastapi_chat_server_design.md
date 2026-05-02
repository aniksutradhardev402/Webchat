# Real-Time Chat Server (FastAPI) -- System Design & LLD

## 1. System Design (HLD)

### Functional Requirements

-   1:1 messaging
-   Group chat
-   Real-time delivery (WebSockets)
-   Message persistence
-   Read receipts
-   Typing indicators
-   Presence (online/offline)
-   File/media sharing
-   Notifications

### Non-Functional Requirements

-   Low latency (\<100ms)
-   Horizontal scalability
-   Fault tolerance
-   High concurrency

------------------------------------------------------------------------

## 2. Architecture

Client → API Gateway → FastAPI (WS + REST) → Redis/Kafka → Workers → DB

-   PostgreSQL: metadata
-   Redis: cache + pub/sub + presence
-   S3: media

------------------------------------------------------------------------

## 3. Project Structure

chat-server/ ├── app/ │ ├── main.py │ ├── api/routes/ │ ├── websocket/ │
├── services/ │ ├── models/ │ ├── schemas/ │ ├── db/ │ ├── brokers/ │
├── workers/

------------------------------------------------------------------------

## 4. WebSocket Flow

Client → FastAPI → Save DB → Publish Redis → Broadcast

------------------------------------------------------------------------

## 5. LLD Components

### Connection Manager

Handles active connections and broadcasting

### Message Service

Validates, stores, publishes messages

### Redis Broker

Pub/Sub messaging layer

------------------------------------------------------------------------

## 6. Database Schema

Users(id, username, email) Chats(id, type) Participants(user_id,
chat_id) Messages(id, chat_id, sender_id, content)
MessageStatus(message_id, user_id, status)

------------------------------------------------------------------------

## 7. Features

### Core

-   Messaging
-   Groups
-   WebSockets

### Advanced

-   Read receipts
-   Typing indicators
-   Presence
-   Reactions

### Scaling

-   Redis → Kafka
-   Horizontal scaling

------------------------------------------------------------------------

## 8. Scaling Strategy

-   MVP: FastAPI + Redis
-   Scale: Kafka + multi-instance
-   Enterprise: Multi-region

------------------------------------------------------------------------

## 9. Advanced Enhancements

-   Offline sync
-   CRDT
-   E2EE
-   AI moderation
-   ElasticSearch

------------------------------------------------------------------------

## 10. Interview Focus

-   WebSockets vs polling
-   Scaling fan-out
-   Ordering guarantees
