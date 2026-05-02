"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";

interface User {
  id: number;
  username: string;
  email: string;
}

interface NewChatModalProps {
  onClose: () => void;
  onCreate: (participants: { id: number; username: string }[], isGroup: boolean, groupName?: string) => Promise<void> | void;
}

export function NewChatModal({ onClose, onCreate }: NewChatModalProps) {
  const { token } = useAuth();
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || "http://localhost:8002/api";
        const baseUrl = CHAT_API_URL.replace(/\/api\/?$/, "");
        const res = await fetch(`${baseUrl}/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setResults(await res.json());
      } finally { setIsSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, token]);

  const isAlreadySelected = (u: User) => selectedUsers.some(s => s.id === u.id);

  const handleSelect = (u: User) => {
    if (mode === "direct") {
      setSelectedUsers([u]);
      setQuery(u.username);
      setResults([]);
    } else {
      if (!isAlreadySelected(u)) setSelectedUsers(prev => [...prev, u]);
      setQuery("");
      setResults([]);
    }
  };

  const removeUser = (id: number) => setSelectedUsers(prev => prev.filter(u => u.id !== id));

  const handleStart = async () => {
    if (selectedUsers.length === 0) return;
    if (mode === "group" && !groupName.trim()) return;
    setIsCreating(true);
    await onCreate(selectedUsers, mode === "group", mode === "group" ? groupName : undefined);
    setIsCreating(false);
  };

  const canStart = selectedUsers.length > 0 && (mode === "direct" || groupName.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="w-full max-w-sm" style={{ backgroundColor: "var(--background)" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">New Chat</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">✕</button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-4">
          {(["direct", "group"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelectedUsers([]); setQuery(""); setResults([]); }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === m ? "bg-primary text-white shadow" : "text-white/50 hover:text-white/80"
              }`}
            >
              {m === "direct" ? "💬 Direct" : "👥 Group"}
            </button>
          ))}
        </div>

        {/* Group name (shown only in group mode) */}
        {mode === "group" && (
          <input
            type="text"
            placeholder="Group name..."
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-xl border border-white/20 bg-white/5 text-sm outline-none focus:border-primary/60 placeholder:text-white/30"
          />
        )}

        {/* Selected users chips */}
        {selectedUsers.length > 0 && mode === "group" && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedUsers.map(u => (
              <span key={u.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-xs">
                {u.username}
                <button onClick={() => removeUser(u.id)} className="text-white/40 hover:text-white ml-0.5">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
            mode === "direct" && selectedUsers.length > 0
              ? "border-green-500/60 bg-green-500/10"
              : "border-white/20 bg-white/5 focus-within:border-primary/60"
          }`}>
            <span className="text-white/40 text-sm">{isSearching ? "⟳" : "🔍"}</span>
            <input
              ref={inputRef}
              type="text"
              placeholder={mode === "direct" ? "Search by username..." : "Add people..."}
              value={query}
              onChange={e => { setQuery(e.target.value); if (mode === "direct") setSelectedUsers([]); }}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
            />
            {query && (
              <button onClick={() => { setQuery(""); if (mode === "direct") setSelectedUsers([]); }} className="text-white/30 hover:text-white/70 text-xs">✕</button>
            )}
          </div>

          {/* Dropdown */}
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[var(--background)] shadow-2xl overflow-hidden z-10">
              {results.filter(u => !isAlreadySelected(u)).map(u => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-sm font-semibold shrink-0">
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.username}</p>
                    <p className="text-xs text-white/40">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isSearching && query.length > 0 && results.filter(u => !isAlreadySelected(u)).length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[var(--background)] px-4 py-3 text-sm text-white/40">
              No users found for &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Confirmation for direct */}
        {mode === "direct" && selectedUsers.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            Starting chat with <strong>{selectedUsers[0].username}</strong>
          </div>
        )}

        {/* Group summary */}
        {mode === "group" && selectedUsers.length > 0 && (
          <p className="mt-2 text-xs text-white/40">{selectedUsers.length} participant{selectedUsers.length > 1 ? "s" : ""} added</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            onClick={handleStart}
            isLoading={isCreating}
            className={!canStart ? "opacity-40 cursor-not-allowed" : ""}
          >
            {mode === "group" ? "Create Group" : "Start Chat"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
