"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AUTH_API_URL } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const AUTH_BASE = AUTH_API_URL.replace(/\/api\/?$/, '');

function strengthLabel(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0) return { label: "", color: "", width: "0%" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{}]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "25%" };
  if (score === 2) return { label: "Fair", color: "bg-yellow-500", width: "50%" };
  if (score === 3) return { label: "Good", color: "bg-blue-400", width: "75%" };
  return { label: "Strong", color: "bg-green-400", width: "100%" };
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const strength = strengthLabel(password);

  const isFormValid = email.length > 0 && password.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        await login(data.access_token);
      } else {
        const body = await res.json();
        const detail = body.detail;
        if (Array.isArray(detail)) {
          setError(detail.map((d: any) => d.msg).join(" "));
        } else {
          setError(detail || "Registration failed");
        }
      }
    } catch {
      setError("Could not connect to the auth server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Account</h1>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/60 text-red-100 rounded-xl text-sm">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            {password.length > 0 && (
              <div className="mt-1.5">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                </div>
                <p className={`text-[11px] mt-0.5 ${strength.color.replace("bg-", "text-")}`}>{strength.label}</p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className={`w-full mt-2 ${!isFormValid ? "opacity-50 cursor-not-allowed" : ""}`}
            isLoading={isLoading}
            disabled={!isFormValid}
          >
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-sm text-center opacity-80">
          Already have an account? <Link href="/login" className="text-primary hover:underline">Sign In</Link>
        </p>
      </Card>
    </div>
  );
}
