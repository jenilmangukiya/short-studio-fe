"use client";

import Link from "next/link";
import type { VideoSummary } from "@/lib/types";
import { formatRelativeTime, getVideoStatusConfig } from "@/lib/video-ui";
import { VideoThumbnail } from "@/components/VideoThumbnail";

interface VideoGridCardProps {
  video: VideoSummary;
  onDelete?: (video: VideoSummary) => void;
}

export function VideoGridCard({ video, onDelete }: VideoGridCardProps) {
  const statusConfig = getVideoStatusConfig(video.status);
  const relativeTime = formatRelativeTime(video.created_at);

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-400 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden">
      {/* 9:16 Aspect Thumbnail Header with Real AI Image or Default Fallback */}
      <Link href={`/videos/${video.id}`} className="block relative aspect-[16/10] bg-slate-900 overflow-hidden">
        <VideoThumbnail
          videoId={video.id}
          topic={video.topic}
          status={video.status}
          variant="card"
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2 z-10">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-black/50 text-slate-200 border border-white/15 backdrop-blur-md shadow-xs">
            Short
          </span>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-full text-[11px] font-semibold border backdrop-blur-md ${statusConfig.badgeClass}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {statusConfig.isAnimated && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusConfig.dotColor} opacity-75`} />
              )}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${statusConfig.dotColor}`} />
            </span>
            {statusConfig.label}
          </span>
        </div>

        {/* Hover "Open Studio" Play Affordance */}
        <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center backdrop-blur-3xs z-20">
          <span className="px-3 py-1.5 rounded-lg bg-white/95 text-indigo-700 text-xs font-semibold shadow-md flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <span>Open Studio</span>
            <span className="text-sm leading-none">&rarr;</span>
          </span>
        </div>
      </Link>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Video Topic */}
          <Link href={`/videos/${video.id}`} className="block">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug" title={video.topic}>
              {video.topic}
            </h3>
          </Link>

          {/* Description */}
          {video.description && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
              {video.description}
            </p>
          )}
        </div>

        {/* Footer Meta & Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <span title={`Created on ${new Date(video.created_at).toLocaleString()}`}>
              {relativeTime}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(video);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="Delete video"
                aria-label="Delete video"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}

            <Link
              href={`/videos/${video.id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium transition cursor-pointer"
            >
              <span>Edit</span>
              <span className="text-xs">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
