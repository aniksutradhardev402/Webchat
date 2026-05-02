"use client";

import { Sidebar } from "@/components/chat/Sidebar";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ChatProvider, useChat } from "@/context/ChatContext";

export default function ChatPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <div className="h-screen w-full flex items-center justify-center">Loading...</div>;
  }

  return (
    <ChatProvider>
      <ChatPageInner />
    </ChatProvider>
  );
}

// Presence dot color helper
function presenceDot(status?: string) {
  if (status === "online") return "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]";
  if (status === "idle")   return "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]";
  return "bg-gray-500";
}

function ChatPageInner() {
  const { activeChatName, activeChatId, presenceMap, chats } = useChat();
  const { user } = useAuth();

  const activeChat = chats.find(c => c.id === activeChatId);
  const isGroup = activeChat?.type === "group";
  const participants = activeChat?.participants ?? [];
  const others = participants.filter((p: any) => p.id !== user?.id);

  // For direct chats — single other participant status
  const otherDirect = !isGroup ? others[0] : null;
  const directStatus = otherDirect ? presenceMap[String(otherDirect.id)] : undefined;

  return (
    <div className="h-screen w-full flex p-4 pb-0 md:p-6 overflow-hidden">
      <div className="w-full h-full glass-panel rounded-2xl md:rounded-t-3xl md:rounded-b-none border-b-0 overflow-hidden flex shadow-2xl">
        <Sidebar />
        <div className="flex-1 flex flex-col relative bg-black/10">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 backdrop-blur-sm shadow-sm z-10 min-h-[64px]">
            {!activeChatId ? (
              <h2 className="font-bold text-white/50">Select a conversation</h2>
            ) : isGroup ? (
              /* Group header — name + participant avatars with presence */
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">👥</span>
                  <h2 className="font-bold truncate">{activeChatName}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {others.map((p: any) => {
                    const status = presenceMap[String(p.id)];
                    return (
                      <div key={p.id} className="flex items-center gap-1 text-[11px] text-white/50">
                        <span className={`w-1.5 h-1.5 rounded-full ${presenceDot(status)}`} />
                        <span>{p.username}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Direct chat header — name + status */
              <div className="flex items-center gap-2 min-w-0">
                {directStatus && (
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${presenceDot(directStatus)}`} />
                )}
                <div className="min-w-0">
                  <h2 className="font-bold leading-tight truncate">{activeChatName}</h2>
                  {directStatus && (
                    <p className="text-xs text-white/40 capitalize">{directStatus}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <MessageList />
          <TypingIndicator />
          <ChatInput />
        </div>
      </div>
    </div>
  );
}
