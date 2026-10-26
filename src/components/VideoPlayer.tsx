"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useObjectUrl } from "@/lib/object-url";
import { SubtitleOverlay } from "./SubtitleOverlay";

interface VideoPlayerProps {
  videoId: string;
  topic?: string;
  aspectRatio?: string;
  className?: string;
  showDownloadButton?: boolean;
  isReady?: boolean;
  isRendering?: boolean;
}

export function VideoPlayer({
  videoId,
  topic,
  aspectRatio = "aspect-[9/16]",
  className = "",
  showDownloadButton = true,
  isReady = true,
  isRendering = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadingType, setDownloadingType] = useState<"captioned" | "original" | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(true);

  const shouldFetch = Boolean(videoId && isReady && !isRendering);

  const {
    data: blob,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["video-blob", videoId],
    queryFn: () => api.videos.getVideoBlob(videoId, false),
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 15, // 15 mins cache
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  const { data: subtitlesData } = useQuery({
    queryKey: ["video-subtitles", videoId],
    queryFn: () => api.videos.getSubtitles(videoId),
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
    retry: false, // Don't retry if subtitles step is pending or 404
  });

  const hasSubtitles = Boolean(
    subtitlesData?.segments && subtitlesData.segments.length > 0
  );

  const videoUrl = useObjectUrl(blob);

  // Clean pause on unmount
  useEffect(() => {
    const el = videoRef.current;
    return () => {
      if (el) {
        el.pause();
      }
    };
  }, []);

  const handlePlayToggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleDownload = async (captioned: boolean = true) => {
    setDownloadingType(captioned ? "captioned" : "original");
    try {
      const result = await api.videos.downloadBlob(videoId, captioned);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      const filename =
        result.filename ||
        `${(topic || "video").toLowerCase().replace(/[^a-z0-9]+/g, "-")}${captioned ? "-captioned" : ""}.mp4`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } finally {
      setDownloadingType(null);
    }
  };

  const isNotAvailableYet =
    error instanceof Error &&
    error.message.toLowerCase().includes("not available yet");

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* 9:16 Vertical Video Frame */}
      <div
        className={`relative w-full max-w-[320px] sm:max-w-[360px] ${aspectRatio} rounded-2xl bg-black border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center`}
      >
        {/* 1. Rendering In-Progress Placeholder */}
        {isRendering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
            <div className="relative mb-3">
              <div className="h-12 w-12 animate-spin rounded-full border-3 border-indigo-500/30 border-t-indigo-500" />
              <div className="absolute inset-0 flex items-center justify-center text-base">
                🎬
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-100">Rendering Video...</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              FFmpeg is assembling scenes and voiceover into vertical 1080x1920 MP4.
            </p>
          </div>
        )}

        {/* 2. Pending / Not Ready Placeholder */}
        {!isReady && !isRendering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
            <span className="text-3xl mb-2 opacity-60">⏳</span>
            <p className="text-sm font-semibold text-slate-300">Video not rendered yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
              Complete previous steps and run the Render step to generate the final video.
            </p>
          </div>
        )}

        {/* 3. Loading Blob State */}
        {shouldFetch && isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent mb-3" />
            <p className="text-sm font-semibold text-slate-200">Loading Video Render...</p>
            <p className="text-xs text-slate-500 mt-1">Retrieving 1080x1920 MP4 stream</p>
          </div>
        )}

        {/* 4. Error State */}
        {shouldFetch && isError && (
          isNotAvailableYet ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-400 border-t-transparent mb-3" />
              <p className="text-sm font-semibold text-slate-200">Final video being generated...</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                The final output is still being finalized. It will appear automatically once ready.
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 border border-red-900/50 text-red-200">
              <span className="text-3xl mb-2">⚠️</span>
              <p className="text-sm font-bold text-red-300">Unable to load video</p>
              <p className="text-xs text-red-400 mt-1 max-w-[240px]">
                {error instanceof Error ? error.message : "Video stream failed to load."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          )
        )}

        {/* 5. HTML5 Video Player */}
        {shouldFetch && videoUrl && (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-cover"
            />

            {/* Synchronized Animated Subtitles Overlay */}
            <SubtitleOverlay
              videoRef={videoRef}
              subtitles={subtitlesData}
              visible={showSubtitles}
            />

            {/* Quick Play/Pause Big Center Overlay (only when paused) */}
            {!isPlaying && (
              <button
                type="button"
                onClick={handlePlayToggle}
                aria-label="Play video"
                className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition shadow-lg cursor-pointer hover:scale-105 active:scale-95 z-20"
              >
                <span className="text-2xl ml-1">▶</span>
              </button>
            )}

            {/* Subtitles CC Toggle Badge */}
            {hasSubtitles && (
              <button
                type="button"
                onClick={() => setShowSubtitles((prev) => !prev)}
                title={showSubtitles ? "Disable interactive subtitles" : "Enable interactive subtitles"}
                aria-label={showSubtitles ? "Disable interactive subtitles" : "Enable interactive subtitles"}
                className={`absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide transition-all shadow-md cursor-pointer flex items-center gap-1.5 ${
                  showSubtitles
                    ? "bg-black/70 text-amber-300 border border-amber-300/40 backdrop-blur-xs hover:bg-black/85"
                    : "bg-black/50 text-white/50 border border-white/10 hover:text-white/80 backdrop-blur-xs line-through"
                }`}
              >
                <span className="text-[10px] bg-amber-400/20 px-1 py-0.5 rounded font-mono font-bold">
                  CC
                </span>
                <span>{showSubtitles ? "ON" : "OFF"}</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Download Action Buttons below player (only shown when ready and not rendering) */}
      {showDownloadButton && isReady && !isRendering && (
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          {/* Primary Action: Download Captioned MP4 with burned-in subtitles */}
          <button
            type="button"
            onClick={() => handleDownload(true)}
            disabled={downloadingType !== null || isLoading || isError}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Download full video with permanent animated word-highlighted subtitles"
          >
            <span>📥</span>
            <span>
              {downloadingType === "captioned"
                ? "Preparing captioned video..."
                : hasSubtitles
                ? "Download Captioned Video (MP4)"
                : "Download Video (MP4)"}
            </span>
          </button>

          {/* Secondary Action: Download Clean Original (no subtitles) */}
          {hasSubtitles && (
            <button
              type="button"
              onClick={() => handleDownload(false)}
              disabled={downloadingType !== null || isLoading || isError}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition disabled:opacity-50 cursor-pointer"
              title="Download clean original video without burned-in subtitles"
            >
              <span>{downloadingType === "original" ? "Preparing clean..." : "Clean (No Subs)"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
