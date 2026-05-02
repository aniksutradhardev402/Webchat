"use client";

import React, { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { useChat } from "@/context/ChatContext";

// Lazy-load the emoji picker — it's heavy (350KB), only load when opened
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  loading: () => <div className="p-4 text-sm text-white/40">Loading…</div>,
  ssr: false,
});

export function ChatInput() {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const { sendMessage, sendTyping, isConnected, activeChatId } = useChat();
  const typingRef = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const resetTyping = () => {
    typingRef.current = false;
    sendTyping(false);
    if (stopTimer.current) clearTimeout(stopTimer.current);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);

    if (val.trim() && !typingRef.current) {
      typingRef.current = true;
      sendTyping(true);
    }
    if (!val.trim() && typingRef.current) resetTyping();

    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (val.trim()) {
      stopTimer.current = setTimeout(resetTyping, 3000);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeChatId) return;
    sendMessage(text);
    setText("");
    resetTyping();
    setShowEmoji(false);
  };

  const handleBlur = () => { if (typingRef.current) resetTyping(); };

  return (
    <div className="relative">
      {/* Emoji picker popover */}
      {showEmoji && (
        <div
          ref={pickerRef}
          className="absolute bottom-full right-4 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden"
        >
          <EmojiPicker
            onEmojiClick={({ emoji }) => {
              setText(prev => prev + emoji);
              setShowEmoji(false);
            }}
            theme={"dark" as any}
            height={380}
            width={320}
            searchPlaceholder="Search emoji…"
          />
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="p-4 border-t border-white/10 bg-black/5 flex items-center gap-2"
      >
        {/* Emoji trigger */}
        <button
          type="button"
          onClick={() => setShowEmoji(v => !v)}
          className="text-xl opacity-50 hover:opacity-90 transition-opacity shrink-0 select-none"
          aria-label="Open emoji picker"
        >
          😊
        </button>

        <input
          type="text"
          placeholder={activeChatId ? "Type a message…" : "Select a chat to start messaging"}
          disabled={!activeChatId || !isConnected}
          className="flex-1 bg-white/10 border border-white/20 px-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm disabled:opacity-50"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <Button
          type="submit"
          disabled={!activeChatId || !isConnected || !text.trim()}
          className="rounded-full px-6 py-3 shrink-0"
        >
          Send
        </Button>
      </form>
    </div>
  );
}
