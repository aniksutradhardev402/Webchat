"use client";

import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function CallbackLogic() {
  const params = useSearchParams();
  const { login } = useAuth();
  const router = useRouter();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    const token = params.get("token");
    if (token) {
      processed.current = true;
      login(token).catch(() => router.push("/login"));
    } else {
      router.push("/login");
    }
  }, [params, login, router]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-white/50">Completing sign in…</p>
      </div>
      <Suspense fallback={null}>
        <CallbackLogic />
      </Suspense>
    </div>
  );
}
