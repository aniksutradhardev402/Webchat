import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { NewChatModal } from "./NewChatModal";
import { isMuted, toggleMute } from "@/services/sound";

export function Sidebar() {
  const { user, logout, token } = useAuth();
  const { activeChatId, setActiveChatId, chats, fetchChats, presenceMap, unreadCounts } = useChat();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isMuted());
  }, []);

  const handleToggleMute = () => {
    setMuted(toggleMute());
  };

  const handleCreateChat = async (
    participants: { id: number; username: string }[],
    isGroup: boolean,
    groupName?: string
  ) => {
    try {
      const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:8002/api';
      const baseUrl = CHAT_API_URL.replace(/\/api\/?$/, '');

      if (!user?.id) return;

      const participantIds = [user.id, ...participants.map(p => p.id)];

      const chatRes = await fetch(`${baseUrl}/api/chats/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          participant_ids: participantIds,
          type: isGroup ? "group" : "direct",
          ...(isGroup && groupName ? { name: groupName } : {})
        })
      });

      if (chatRes.ok) {
        const newChat = await chatRes.json();
        await fetchChats();
        setIsModalOpen(false);
        setActiveChatId(newChat.id);
      }
    } catch (e) {
      console.error("Error creating chat:", e);
    }
  };

  return (
    <div className="w-80 h-full glass-panel flex flex-col border-r border-white/20 relative">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg">Chats</h2>
            <button onClick={handleToggleMute} className="opacity-60 hover:opacity-100 text-sm" aria-label="Toggle sound">
              {muted ? "🔕" : "🔔"}
            </button>
          </div>
          <span className="text-xs opacity-70">Logged in as {user?.username || "Guest"}</span>
        </div>
        <Button variant="ghost" onClick={logout} className="text-sm px-3 py-1">Logout</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chats.map(chat => {
          // get presence of the OTHER participant in direct chats
          const other = chat.type === 'direct'
            ? chat.participants?.find((p: any) => p.id !== user?.id)
            : null;
          const status = other ? presenceMap[String(other.id)] ?? 'offline' : null;
          const dotColor =
            status === 'online' ? 'bg-green-400' :
            status === 'idle'   ? 'bg-yellow-400' :
            'bg-gray-500';

          return (
            <div
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`p-3 rounded-xl cursor-pointer transition-colors border flex items-center gap-3 ${
                activeChatId === chat.id ? 'bg-white/20 border-white/30 shadow-md' : 'border-transparent hover:bg-white/10 hover:border-white/10'
              }`}
            >
              {/* Avatar / group icon */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-primary/30 flex items-center justify-center text-sm font-semibold">
                  {chat.type === 'group' ? '👥' : (chat.name?.[0]?.toUpperCase() ?? '?')}
                </div>
                {status && (
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${dotColor}`} />
                )}
                {unreadCounts[chat.id] > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm border border-black/20">
                    {unreadCounts[chat.id] > 99 ? '99+' : unreadCounts[chat.id]}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-medium truncate">{chat.name}</h3>
                <p className="text-xs opacity-60 truncate">{chat.snippet}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/10 text-center">
        <Button className="w-full shadow-md bg-opacity-90" onClick={() => setIsModalOpen(true)}>
          + New Chat
        </Button>
      </div>

      {isModalOpen && (
        <NewChatModal 
          onClose={() => setIsModalOpen(false)} 
          onCreate={handleCreateChat} 
        />
      )}
    </div>
  );
}
