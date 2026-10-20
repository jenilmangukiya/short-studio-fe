"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getToken, removeToken, subscribeAuth } from "@/lib/auth";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const token = useSyncExternalStore(subscribeAuth, getToken, () => null);
  const hasToken = Boolean(token);

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
    enabled: hasToken,
    staleTime: 60 * 1000,
    retry: false,
  });

  const handleLogout = () => {
    removeToken();
    queryClient.clear();
    router.replace("/login");
  };

  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            href={hasToken ? "/channels" : "/login"}
            className="flex items-center gap-2 font-bold text-lg text-slate-900 hover:text-indigo-600 transition"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-sm">
              SS
            </span>
            <span>Shorts Studio</span>
          </Link>

          {hasToken && (
            <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
              <Link
                href="/channels"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname.startsWith("/channels")
                    ? "bg-slate-100 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Channels
              </Link>
            </nav>
          )}
        </div>

        {/* User state / Auth actions */}
        <div className="flex items-center gap-3">
          {hasToken ? (
            <div className="flex items-center gap-3">
              {user && (
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800">{user.email}</div>
                  {user.full_name && (
                    <div className="text-[11px] text-slate-500">{user.full_name}</div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
              >
                Log out
              </button>
            </div>
          ) : !isAuthPage ? (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-sm font-medium px-3 py-1.5 text-slate-700 hover:text-slate-900 transition"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                Sign up
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
