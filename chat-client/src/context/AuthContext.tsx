"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AUTH_API_URL, getAuthHeaders } from "@/services/api";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => { },
  logout: () => { },
  isLoading: true,
});

// Use sessionStorage so each browser tab keeps its own independent session.
// This prevents tab B's login from overwriting tab A's active user.
const TOKEN_KEY = "chat_token";
const getStorage = () => (typeof window !== "undefined" ? window.sessionStorage : null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = getStorage()?.getItem(TOKEN_KEY) ?? null;
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUser = async (t: string) => {
    try {
      const baseUrl = AUTH_API_URL.replace(/\/api\/?$/, '');
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: getAuthHeaders(t),
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        getStorage()?.removeItem(TOKEN_KEY);
        setToken(null);
      }
    } catch (error) {
      console.error("Failed to fetch user", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newToken: string) => {
    getStorage()?.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    await fetchUser(newToken);
    router.push("/chat");
  };

  const logout = () => {
    getStorage()?.removeItem(TOKEN_KEY);
    // Also clear the active chat so a fresh session starts clean
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("active_chat");
    }
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
