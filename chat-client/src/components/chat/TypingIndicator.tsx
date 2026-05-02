"use client";

import React from "react";
import { useChat } from "@/context/ChatContext";

export function TypingIndicator() {
  const { typingMap, activeChatId } = useChat();
  const typers = activeChatId ? typingMap[activeChatId] ?? [] : [];

  if (typers.length === 0) return null;

  const label =
    typers.length === 1
      ? `${typers[0]} is typing`
      : typers.length === 2
      ? `${typers[0]} and ${typers[1]} are typing`
      : "Several people are typing";

  return (
    <div className="px-6 pb-1 flex items-center gap-2 text-xs text-white/40 select-none">
      {/* Animated dots */}
      <span className="flex gap-0.5 items-center">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
          />
        ))}
      </span>
      <span>{label}…</span>
    </div>
  );
}
