"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { WebSocketService } from "@/services/websocket";
import { useAuth } from "@/context/AuthContext";
import { CHAT_API_URL, getAuthHeaders } from "@/services/api";

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  sender_username?: string;
  content: string;
  created_at: string;
  status?: string;
}

export interface ChatRoom {
  id: number;
  name?: string;
  type?: string;
  participants?: any[];
  snippet?: string;
}

export type TypingMap = Record<number, string[]>;
export type PresenceMap = Record<string, "online" | "idle" | "offline">;

interface ChatContextType {
  activeChatId: number | null;
  activeChatName: string | null;
  setActiveChatId: (id: number) => void;
  messages: Message[];
  chats: ChatRoom[];
  sendMessage: (content: string) => void;
  markRead: (messageId: number) => void;
  sendTyping: (isTyping: boolean) => void;
  isConnected: boolean;
  fetchChats: () => Promise<void>;
  typingMap: TypingMap;
  presenceMap: PresenceMap;
  unreadCounts: Record<number, number>;
}

const ChatContext = createContext<ChatContextType>({
  activeChatId: null,
  activeChatName: null,
  setActiveChatId: () => {},
  messages: [],
  chats: [],
  sendMessage: () => {},
  markRead: () => {},
  sendTyping: () => {},
  isConnected: false,
  fetchChats: async () => {},
  typingMap: {},
  presenceMap: {},
  unreadCounts: {},
});

// Use sessionStorage (tab-isolated) so active chat persists per-tab on refresh
// but doesn't bleed between tabs with different logged-in users
const ACTIVE_CHAT_KEY = "active_chat";
const ss = () => (typeof window !== "undefined" ? window.sessionStorage : null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [activeChatId, setActiveChatIdState] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingMap, setTypingMap] = useState<TypingMap>({});
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const wsRef = useRef<WebSocketService | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeChatIdRef = useRef<number | null>(null);

  // Restore active chat from sessionStorage on mount
  useEffect(() => {
    const saved = ss()?.getItem(ACTIVE_CHAT_KEY);
    if (saved) setActiveChatIdState(parseInt(saved, 10));
  }, []);

  const setActiveChatId = (id: number) => {
    setActiveChatIdState(id);
    activeChatIdRef.current = id;
    ss()?.setItem(ACTIVE_CHAT_KEY, id.toString());
    // Reset unread count when opening a chat
    setUnreadCounts(prev => ({ ...prev, [id]: 0 }));
  };

  const fetchChats = useCallback(async () => {
    if (!token) return;
    try {
      const baseUrl = CHAT_API_URL.replace(/\/api\/?$/, '');
      const res = await fetch(`${baseUrl}/api/chats/`, { headers: getAuthHeaders(token) });
      if (res.ok) {
        let data = await res.json();
        data = data.map((c: any) => ({
          ...c,
          name: c.type === 'direct'
            ? c.participants?.find((p: any) => p.id !== user?.id)?.username ?? `Chat ${c.id}`
            : (c.name || `Group #${c.id}`),
          snippet: "Click to view",
        }));
        setChats(data);
      }
    } catch (err) { console.error("Failed to load chats", err); }
  }, [token, user]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  // Fetch message history when active chat changes
  useEffect(() => {
    if (!activeChatId || !token) return;
    (async () => {
      try {
        const baseUrl = CHAT_API_URL.replace(/\/api\/?$/, '');
        const res = await fetch(`${baseUrl}/api/chats/${activeChatId}/messages`, { headers: getAuthHeaders(token) });
        if (res.ok) setMessages(await res.json());
      } catch (err) { console.error("Failed to load history", err); }
    })();
  }, [activeChatId, token]);

  // Poll presence every 15s
  useEffect(() => {
    if (!token || chats.length === 0) return;
    const fetchPresence = async () => {
      try {
        const ids = new Set<string>();
        chats.forEach(c => c.participants?.forEach((p: any) => {
          if (p.id !== user?.id) ids.add(String(p.id));
        }));
        if (!ids.size) return;
        const baseUrl = CHAT_API_URL.replace(/\/api\/?$/, '');
        const res = await fetch(`${baseUrl}/api/users/presence?ids=${[...ids].join(",")}`, { headers: getAuthHeaders(token) });
        if (res.ok) setPresenceMap(await res.json());
      } catch { /* ignore */ }
    };
    fetchPresence();
    const t = setInterval(fetchPresence, 15000);
    return () => clearInterval(t);
  }, [token, chats, user]);

  // ── Idle detection ────────────────────────────────────────────────────────
  // How it works:
  //   • Idle = user has had NO mouse/keyboard/touch interaction for 30s
  //   • On any interaction we send "online" via WS and reset the 30s timer
  //   • When the timer fires we send "idle" via WS
  //   • The server stores this in Redis so other users see it immediately
  useEffect(() => {
    if (!wsRef.current || !token) return;
    const ws = wsRef.current;

    const goOnline = () => {
      ws.send("set_presence", { status: "online" });
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        ws.send("set_presence", { status: "idle" });
      }, 30_000);
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, goOnline, { passive: true }));
    goOnline(); // set online immediately on mount

    return () => {
      events.forEach(e => window.removeEventListener(e, goOnline));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, token]);

  // Global WebSocket connection
  useEffect(() => {
    if (!token) {
      wsRef.current?.disconnect(); wsRef.current = null; setIsConnected(false);
      return;
    }
    if (!wsRef.current) {
      const ws = new WebSocketService(token);
      wsRef.current = ws;
      ws.connect();
      setIsConnected(true);
    }
    const ws = wsRef.current!;

    const handleNewMessage = (msg: any) => {
      // Always add to messages if it's for the active chat
      if (activeChatIdRef.current === msg.chat_id) {
        setMessages(prev => [...prev, msg]);
      }
      setChats(prev => {
        if (!prev.some(c => c.id === msg.chat_id)) fetchChats();
        return prev;
      });
      if (user && msg.sender_id !== user.id) {
        ws.send("mark_delivered", { message_id: msg.id });
        // Play sound + increment unread for messages in inactive rooms
        if (activeChatIdRef.current !== msg.chat_id) {
          setUnreadCounts(prev => ({ ...prev, [msg.chat_id]: (prev[msg.chat_id] ?? 0) + 1 }));
          import("@/services/sound").then(m => m.playMessageSound());
        }
      }
    };

    const handleStatusUpdate = (update: any) => {
      setMessages(prev => prev.map(m => m.id === update.message_id ? { ...m, status: update.status } : m));
    };

    const handleTyping = (data: any) => {
      const { chat_id, username, is_typing } = data;
      if (!chat_id || !username) return;
      const key = `${chat_id}:${username}`;
      setTypingMap(prev => {
        const existing = prev[chat_id] || [];
        return {
          ...prev,
          [chat_id]: is_typing ? [...new Set([...existing, username])] : existing.filter(u => u !== username),
        };
      });
      if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
      if (is_typing) {
        typingTimers.current[key] = setTimeout(() => {
          setTypingMap(prev => ({ ...prev, [chat_id]: (prev[chat_id] || []).filter(u => u !== username) }));
        }, 5000);
      }
    };

    const handlePresence = (data: any) => {
      if (data.user_id && data.status) {
        setPresenceMap(prev => ({ ...prev, [String(data.user_id)]: data.status }));
      }
    };

    ws.on("new_message", handleNewMessage);
    ws.on("status_update", handleStatusUpdate);
    ws.on("typing", handleTyping);
    ws.on("presence", handlePresence);

    return () => {
      ws.off("new_message", handleNewMessage);
      ws.off("status_update", handleStatusUpdate);
      ws.off("typing", handleTyping);
      ws.off("presence", handlePresence);
    };
  }, [activeChatId, token, user, fetchChats]);

  // Disconnect WS on unmount
  useEffect(() => () => { wsRef.current?.disconnect(); wsRef.current = null; }, []);

  const sendMessage = (content: string) => {
    if (wsRef.current && activeChatId) wsRef.current.send("send_message", { content, chat_id: activeChatId });
  };
  const markRead = (messageId: number) => wsRef.current?.send("mark_read", { message_id: messageId });
  const sendTyping = (isTyping: boolean) => {
    if (wsRef.current && activeChatId) wsRef.current.send("typing", { chat_id: activeChatId, is_typing: isTyping });
  };

  const activeChatName = activeChatId ? chats.find(c => c.id === activeChatId)?.name ?? null : null;

  return (
    <ChatContext.Provider value={{
      activeChatId, activeChatName, setActiveChatId,
      messages, chats, sendMessage, markRead, sendTyping,
      isConnected, fetchChats, typingMap, presenceMap, unreadCounts,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
