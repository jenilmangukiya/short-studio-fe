"use client";

import Link from "next/link";
import type { VideoSummary } from "@/lib/types";
import { formatRelativeTime, formatFullDateTime, getVideoStatusConfig } from "@/lib/video-ui";
import { VideoThumbnail } from "@/components/VideoThumbnail";

interface VideoListRowProps {
  video: VideoSummary;
  onDelete?: (video: VideoSummary) => void;
}

export function VideoListRow({ video, onDelete }: VideoListRowProps) {
  const statusConfig = getVideoStatusConfig(video.status);
  const relativeTime = formatRelativeTime(video.created_at);
  const fullDate = formatFullDateTime(video.created_at);

  return (
    <div className="group bg-white rounded-xl border border-slate-200/90 hover:border-indigo-300 p-3.5 shadow-2xs hover:shadow-md transition-all duration-150 flex items-center justify-between gap-4">
      {/* Left: Thumbnail & Topic Info */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Mini 9:16 Thumbnail */}
        <Link href={`/videos/${video.id}`} className="shrink-0">
          <VideoThumbnail
            videoId={video.id}
            topic={video.topic}
            status={video.status}
            variant="row"
          />
        </Link>

        {/* Text Details */}
        <div className="min-w-0 flex-1">
          <Link href={`/videos/${video.id}`} className="block">
            <h3
              className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate"
              title={video.topic}
            >
              {video.topic}
            </h3>
          </Link>

          {video.description && (
            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
              {video.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
            <span title={`Created at ${fullDate}`}>Created {relativeTime}</span>
          </div>
        </div>
      </div>

      {/* Right: Status Pill & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Status Pill */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.badgeClass}`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {statusConfig.isAnimated && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusConfig.dotColor} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${statusConfig.dotColor}`} />
          </span>
          <span>{statusConfig.label}</span>
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(video)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Delete video"
              aria-label="Delete video"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          <Link
            href={`/videos/${video.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 transition cursor-pointer shadow-2xs"
          >
            <span>Studio</span>
            <span className="text-xs">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
