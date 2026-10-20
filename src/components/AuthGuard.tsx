"use client";

import React, { useSyncExternalStore, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, subscribeAuth } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Safe subscription using useSyncExternalStore - prevents hydration mismatch
  const token = useSyncExternalStore(subscribeAuth, getToken, () => null);

  useEffect(() => {
    // Check in browser after mount
    if (typeof window !== "undefined" && !getToken()) {
      router.replace("/login");
    }
  }, [router]);

  // Neutral loading state first to prevent hydration mismatch or page flash
  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Authenticating...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
