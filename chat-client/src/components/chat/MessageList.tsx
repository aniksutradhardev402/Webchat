"use client";

import React, { useEffect, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { MessageContent } from "./MessageContent";

export function MessageList() {
  const { messages, markRead, activeChatId, chats } = useChat();
  const { user } = useAuth();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const isGroup = activeChat?.type === "group";

  // Mark incoming messages as read
  useEffect(() => {
    const unread = messages.filter(
      (m: any) => m.sender_id !== user?.id && m.status !== "read"
    );
    unread.forEach(m => markRead(m.id));
  }, [messages, user?.id, markRead]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-40 text-sm select-none">
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      className="flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      data={messages}
      followOutput="smooth"
      initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
      alignToBottom

      itemContent={(_, msg) => {
        const isMe = msg.sender_id === user?.id;
        return (
          <div className={`flex flex-col px-6 py-1 ${isMe ? "items-end" : "items-start"}`}>
            {/* Sender label for group chats */}
            {isGroup && !isMe && msg.sender_username && (
              <p className="text-[11px] text-white/50 ml-1 mb-0.5 font-medium">
                {msg.sender_username}
              </p>
            )}
            <div
              className={`max-w-[70%] p-3 rounded-2xl ${
                isMe
                  ? "bg-primary text-white rounded-tr-none shadow-primary/20 shadow-lg"
                  : "bg-white/10 backdrop-blur-md border border-white/10 rounded-tl-none shadow-lg"
              }`}
            >
              <MessageContent
                content={msg.content}
                currentUsername={user?.username}
              />
              <div className="text-[10px] opacity-40 text-right mt-1 flex items-center justify-end gap-1">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {isMe && (
                  <span>
                    {msg.status === "read" ? "✓✓" : msg.status === "delivered" ? "✓" : "•"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
