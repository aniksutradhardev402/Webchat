"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AUTH_API_URL } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const AUTH_BASE = AUTH_API_URL.replace(/\/api\/?$/, '');

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notVerifiedEmail, setNotVerifiedEmail] = useState(""); // set when 403 EMAIL_NOT_VERIFIED
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const params = useSearchParams();

  // Banner shown when redirected from email verification link or registration
  const verified = params.get("verified");
  const registered = params.get("registered");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setNotVerifiedEmail("");
    try {
      const res = await fetch(`${AUTH_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        await login(data.access_token);
      } else {
        const body = await res.json();
        if (body.detail === "EMAIL_NOT_VERIFIED") {
          // Show the resend prompt — but we don't expose the email from this error
          // The user will have to type their email if they want to resend
          setNotVerifiedEmail("__prompt__");
        } else {
          setError(body.detail || "Login failed");
        }
      }
    } catch {
      setError("Could not connect to the auth server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (emailToResend: string) => {
    if (resendCooldown > 0 || !emailToResend) return;
    setResendMsg("");
    try {
      await fetch(`${AUTH_BASE}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToResend }),
      });
      setResendMsg("Verification email sent! Check your inbox.");
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setResendMsg("Failed to resend. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Welcome Back</h1>

        {/* ── Registered success banner ────────────────────────────────── */}
        {registered === "true" && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 text-green-200 rounded-xl text-sm flex items-start gap-2">
            <span className="text-base">✅</span>
            <span>Registration successful! You can now sign in below.</span>
          </div>
        )}

        {/* ── Verified success banner ──────────────────────────────────── */}
        {(verified === "true" || verified === "already") && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 text-green-200 rounded-xl text-sm flex items-start gap-2">
            <span className="text-base">✅</span>
            <span>
              {verified === "already"
                ? "Your email was already verified. Sign in below."
                : "Email verified! Your account is now active. Sign in below."}
            </span>
          </div>
        )}

        {/* ── Email not verified warning ───────────────────────────────── */}
        {notVerifiedEmail && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 rounded-xl text-sm">
            <p className="font-semibold mb-1">⚠️ Email not verified</p>
            <p className="text-xs opacity-80 mb-3">
              Please check your inbox and click the verification link before signing in.
            </p>
            {resendMsg ? (
              <p className="text-green-400 text-xs">{resendMsg}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs opacity-60">Enter your email to resend the link:</p>
                <ResendInput onResend={handleResend} cooldown={resendCooldown} />
              </div>
            )}
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/60 text-red-100 rounded-xl text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full mt-2" isLoading={isLoading}>Sign In</Button>
        </form>

        <p className="mt-6 text-sm text-center opacity-80">
          Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline">Register</Link>
        </p>
      </Card>
    </div>
  );
}

/** Small inline email input for resending from login page */
function ResendInput({ onResend, cooldown }: { onResend: (e: string) => void; cooldown: number }) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex gap-2">
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
      />
      <button
        onClick={() => onResend(email)}
        disabled={cooldown > 0 || !email}
        className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {cooldown > 0 ? `${cooldown}s` : "Resend"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
