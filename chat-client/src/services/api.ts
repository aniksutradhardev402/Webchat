export const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:8001/api';
export const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:8002/api';

export function getAuthHeaders(token?: string | null): Record<string, string> {
  const t = token;
  if (!t) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${t}`,
  };
}
