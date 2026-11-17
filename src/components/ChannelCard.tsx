"use client";

import Link from "next/link";
import type { Channel } from "@/lib/types";
import { getChannelVisualStyle } from "@/lib/types";

interface ChannelCardProps {
  channel: Channel;
}

export function ChannelCard({ channel }: ChannelCardProps) {
  const isYouTube = channel.platform === "youtube";
  const visualStyle = getChannelVisualStyle(channel.settings);
  const initials = channel.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CH";

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-400 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col overflow-hidden">
      {/* Decorative Top Banner */}
      <div
        className={`h-24 relative overflow-hidden p-3.5 flex items-start justify-between ${
          isYouTube
            ? "bg-gradient-to-r from-red-600 via-rose-600 to-amber-600"
            : "bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500"
        }`}
      >
        {/* Subtle geometric dot overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />

        {/* Platform Badge */}
        <span className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-black/35 text-white border border-white/20 backdrop-blur-md shadow-xs">
          {isYouTube ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          )}
          <span>{channel.platform}</span>
        </span>

        {/* Quick Settings Icon Button */}
        <Link
          href={`/channels/${channel.id}/settings`}
          className="relative z-10 p-1.5 rounded-lg bg-black/35 hover:bg-black/50 text-white/90 hover:text-white border border-white/20 backdrop-blur-md transition shadow-xs"
          title="Channel Settings & Visual Style"
          aria-label="Channel Settings"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
      </div>

      {/* Floating Monogram Avatar Overlapping Banner */}
      <div className="relative px-5 pt-0">
        <div className="-mt-7 mb-3 inline-flex">
          <div className="w-14 h-14 rounded-2xl bg-white border-2 border-white shadow-md flex items-center justify-center text-slate-800 font-extrabold text-base tracking-wider ring-1 ring-slate-100">
            {initials}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 pb-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Channel Name */}
          <Link href={`/channels/${channel.id}`} className="block">
            <h2
              className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate"
              title={channel.name}
            >
              {channel.name}
            </h2>
          </Link>

          {/* Handle */}
          {channel.handle ? (
            <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              {channel.handle}
            </p>
          ) : (
            <p className="text-xs text-slate-400 italic mt-0.5">No handle configured</p>
          )}

          {/* Badges: Niche & Visual Style */}
          <div className="mt-3.5 space-y-2">
            {/* Niche Tag */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-4 h-4 rounded-md bg-slate-100 flex items-center justify-center text-[10px] shrink-0">
                🏷️
              </span>
              <span className="truncate">
                {channel.niche ? channel.niche : "General Shorts"}
              </span>
            </div>

            {/* Visual Style Tag */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-4 h-4 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] shrink-0">
                🎨
              </span>
              <span className="truncate text-slate-500" title={visualStyle || "Default clean 3D render style"}>
                {visualStyle ? visualStyle : "Default 3D Style"}
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer: Date & Studio CTA */}
        <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400">
            {new Date(channel.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          <Link
            href={`/channels/${channel.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs bg-slate-100 group-hover:bg-indigo-600 text-slate-700 group-hover:text-white transition-all shadow-2xs cursor-pointer"
          >
            <span>Open Studio</span>
            <span className="text-xs group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
