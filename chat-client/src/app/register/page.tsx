"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AUTH_API_URL } from "@/services/api";
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

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "support",
  "moderator", "mod", "staff", "superuser", "null", "undefined",
  "api", "ws", "chat", "auth", "login", "logout", "register",
  "me", "user", "users", "bot", "guest", "anonymous",
]);

function validateUsername(v: string): string | null {
  if (!v) return null; // no error while field is empty
  if (v.length < 3) return "Username must be at least 3 characters.";
  if (v.length > 30) return "Username must be 30 characters or fewer.";
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return "Only letters, numbers, and underscores are allowed.";
  if (v.startsWith("_") || v.endsWith("_")) return "Username cannot start or end with an underscore.";
  if (v.includes("__")) return "Username cannot contain consecutive underscores.";
  if (RESERVED_USERNAMES.has(v.toLowerCase())) return `'${v}' is a reserved name. Please choose another.`;
  return null;
}

function GoogleButton() {
  return (
    <a
      href={`${AUTH_BASE}/api/auth/oauth/google`}
      className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium"
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.1 0 5.9 1.1 8.1 2.9l6-6C34.5 3.1 29.5 1 24 1 14.7 1 6.8 6.7 3.3 14.8l7 5.4C12 13.6 17.5 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.3 5.7c4.3-4 6.3-9.9 6.3-16.9z"/>
        <path fill="#FBBC05" d="M10.3 28.8A14.8 14.8 0 0 1 9.5 24c0-1.7.3-3.3.8-4.8L3.3 13.8A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.5l7.8-5.7z"/>
        <path fill="#34A853" d="M24 47c5.7 0 10.5-1.9 14-5.1l-7.3-5.7c-1.9 1.3-4.4 2-6.7 2-6.5 0-12-4.1-13.9-9.8l-7.8 5.7C6.7 41.3 14.7 47 24 47z"/>
      </svg>
      Continue with Google
    </a>
  );
}

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registered, setRegistered] = useState(false);   // show inbox UI
  const [resendCooldown, setResendCooldown] = useState(0); // seconds
  const [resendMsg, setResendMsg] = useState("");
  const strength = strengthLabel(password);

  const usernameError = validateUsername(username);

  // Detect Gmail — these must use Google SSO
  const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
  const isGmailAddress = ["gmail.com", "googlemail.com"].includes(emailDomain);

  const isFormValid =
    username.length > 0 && !usernameError &&
    email.length > 0 && !isGmailAddress &&
    password.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (res.ok) {
        setRegistered(true);   // show "check your inbox" UI
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

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendMsg("");
    try {
      await fetch(`${AUTH_BASE}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendMsg("A new verification link has been sent!");
      // 60-second cooldown so they can't spam it
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

        {/* ── Success: Check your inbox ──────────────────────────────── */}
        {registered ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">📬</div>
            <h1 className="text-2xl font-bold mb-2">Check your inbox!</h1>
            <p className="text-white/60 text-sm mb-1">
              We sent a verification link to:
            </p>
            <p className="font-semibold text-primary mb-6 break-all">{email}</p>
            <p className="text-white/50 text-xs mb-6">
              Click the link in the email to activate your account.
              The link expires in 24 hours.
            </p>
            {resendMsg && (
              <p className="text-green-400 text-xs mb-3">{resendMsg}</p>
            )}
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className={`text-sm underline transition-colors ${
                resendCooldown > 0 ? "text-white/30 cursor-not-allowed no-underline" : "text-primary hover:text-primary/80"
              }`}
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Didn't receive it? Resend"}
            </button>
            <div className="mt-8 pt-6 border-t border-white/10">
              <Link href="/login" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <>
        <h1 className="text-2xl font-bold mb-6 text-center">Create Account</h1>

        <GoogleButton />

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/60 text-red-100 rounded-xl text-sm">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">

          {/* Username with real-time inline validation */}
          <div>
            <Input
              label="Username"
              placeholder="john_doe"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              minLength={3}
            />
            {/* Character counter */}
            {username.length > 0 && (
              <p className={`text-[11px] mt-0.5 text-right ${username.length > 30 ? "text-red-400" : "text-white/30"}`}>
                {username.length}/30
              </p>
            )}
            {/* Inline error message */}
            {usernameError && username.length > 0 && (
              <p className="text-[11px] mt-1 text-red-400 flex items-center gap-1">
                <span>✕</span> {usernameError}
              </p>
            )}
            {/* Inline success message */}
            {!usernameError && username.length >= 3 && (
              <p className="text-[11px] mt-1 text-green-400 flex items-center gap-1">
                <span>✓</span> Username looks good
              </p>
            )}
          </div>

          {/* Email with Gmail detection */}
          <div>
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            {isGmailAddress && (
              <div className="mt-2 p-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-xs flex flex-col gap-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <span>⚠️</span> Gmail detected
                </p>
                <p className="opacity-80">
                  Gmail addresses must sign in with Google. Password registration is not available.
                </p>
                <a
                  href={`${AUTH_BASE}/api/auth/oauth/google`}
                  className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 transition-colors font-medium text-yellow-100 self-start"
                >
                  <svg width="13" height="13" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.1 0 5.9 1.1 8.1 2.9l6-6C34.5 3.1 29.5 1 24 1 14.7 1 6.8 6.7 3.3 14.8l7 5.4C12 13.6 17.5 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.3 5.7c4.3-4 6.3-9.9 6.3-16.9z"/>
                    <path fill="#FBBC05" d="M10.3 28.8A14.8 14.8 0 0 1 9.5 24c0-1.7.3-3.3.8-4.8L3.3 13.8A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.5l7.8-5.7z"/>
                    <path fill="#34A853" d="M24 47c5.7 0 10.5-1.9 14-5.1l-7.3-5.7c-1.9 1.3-4.4 2-6.7 2-6.5 0-12-4.1-13.9-9.8l-7.8 5.7C6.7 41.3 14.7 47 24 47z"/>
                  </svg>
                  Continue with Google instead
                </a>
              </div>
            )}
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
          </>
        )}
      </Card>
    </div>
  );
}
