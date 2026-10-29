"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useObjectUrl } from "@/lib/object-url";

export interface UseAuthenticatedAudioOptions {
  videoId: string;
  audioHash?: string | null;
  versionKey?: string | null;
  enabled?: boolean;
}

/**
 * Hook to fetch the bearer-authenticated continuous narration WAV file (`GET /api/videos/{id}/audio`)
 * as a Blob, create a local Object URL, and clean it up automatically upon unmount.
 */
export function useAuthenticatedAudio({
  videoId,
  audioHash,
  versionKey,
  enabled = true,
}: UseAuthenticatedAudioOptions) {
  const shouldFetch = Boolean(videoId && enabled);

  const query = useQuery({
    queryKey: ["video-audio", videoId, audioHash || "default", versionKey || "v0"],
    queryFn: () => api.videos.getNarrationAudioBlob(videoId),
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 60, // 1 hour (keyed by content-addressable audioHash + versionKey)
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
  });

  const blob = shouldFetch ? query.data : undefined;
  const audioUrl = useObjectUrl(blob);

  return {
    ...query,
    audioUrl,
    blob,
  };
}

export interface NarrationSeekRequest {
  time: number;
  endTime?: number | null;
  autoPlay?: boolean;
  nonce: number;
}

export interface NarrationAudioPlayerProps {
  videoId: string;
  audioHash?: string | null;
  versionKey?: string | null;
  durationSeconds?: number;
  hasAudioFile?: boolean;
  isRunning?: boolean;
  isStale?: boolean;
  seekRequest?: NarrationSeekRequest | null;
  onTimeUpdate?: (currentTime: number, isPlaying: boolean) => void;
  onEnded?: () => void;
  onError?: (err: unknown) => void;
  className?: string;
}

export function NarrationAudioPlayer({
  videoId,
  audioHash,
  versionKey,
  durationSeconds = 0,
  hasAudioFile = true,
  isRunning = false,
  isStale = false,
  seekRequest = null,
  onTimeUpdate,
  onEnded,
  onError,
  className = "",
}: NarrationAudioPlayerProps) {
  const isAvailable = hasAudioFile && !isRunning && !isStale;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtTimeRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [isPlaying, setIsPlaying] = useState(false);

  const { audioUrl, isLoading, isError, refetch } = useAuthenticatedAudio({
    videoId,
    audioHash,
    versionKey,
    enabled: isAvailable,
  });

  // Pause and reset underlying DOM <audio> element when audio becomes unavailable
  useEffect(() => {
    const el = audioRef.current;
    if (!isAvailable || !audioUrl) {
      stopAtTimeRef.current = null;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    }
  }, [isAvailable, audioUrl]);

  // Synchronize external seek requests with the DOM <audio> element
  useEffect(() => {
    if (!seekRequest || !audioUrl || !audioRef.current) return;
    const el = audioRef.current;
    const targetTime = Math.max(0, seekRequest.time);
    stopAtTimeRef.current =
      typeof seekRequest.endTime === "number" && seekRequest.endTime > targetTime
        ? seekRequest.endTime
        : null;
    el.currentTime = targetTime;

    if (seekRequest.autoPlay !== false) {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          onError?.(err);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekRequest?.nonce, audioUrl]);

  // Clean stop on unmount
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    };
  }, []);

  const handleToggle = () => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;

    stopAtTimeRef.current = null;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      onTimeUpdate?.(el.currentTime, false);
    } else {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            onTimeUpdate?.(el.currentTime, true);
          })
          .catch((err) => {
            setIsPlaying(false);
            onError?.(err);
          });
      }
    }
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    const now = el.currentTime;
    const stopTarget = stopAtTimeRef.current;

    if (stopTarget !== null && now >= stopTarget) {
      stopAtTimeRef.current = null;
      el.pause();
      setIsPlaying(false);
      setCurrentTime(stopTarget);
      onTimeUpdate?.(stopTarget, false);
      return;
    }

    setCurrentTime(now);
    onTimeUpdate?.(now, !el.paused);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    stopAtTimeRef.current = null;
    setCurrentTime(0);
    setIsPlaying(false);
    onTimeUpdate?.(0, false);
    onEnded?.();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    stopAtTimeRef.current = null;
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      onTimeUpdate?.(seekTime, !audioRef.current.paused);
    }
  };

  const formatSec = (sec: number) => {
    const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
    return safe.toFixed(1) + "s";
  };

  const effectiveDuration = duration > 0 ? duration : durationSeconds;
  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  if (isRunning) {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-800 ${className}`}
      >
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent shrink-0" />
        <span>Synthesizing continuous narration audio...</span>
      </div>
    );
  }

  if (isStale) {
    return (
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 ${className}`}
      >
        <span>⏳</span>
        <span>Continuous narration audio is outdated and will regenerate on the next pipeline run.</span>
      </div>
    );
  }

  if (!hasAudioFile) {
    return (
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic ${className}`}
      >
        <span>🔇</span>
        <span>Continuous narration audio file is not available yet.</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 ${className}`}
    >
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleAudioEnded}
          onPause={() => {
            setIsPlaying(false);
            if (audioRef.current) {
              onTimeUpdate?.(audioRef.current.currentTime, false);
            }
          }}
          onPlay={() => {
            setIsPlaying(true);
            if (audioRef.current) {
              onTimeUpdate?.(audioRef.current.currentTime, true);
            }
          }}
          onError={(e) => {
            setIsPlaying(false);
            onError?.(e);
          }}
        />
      )}

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading || isError || !audioUrl}
        aria-label={isPlaying ? "Pause continuous narration audio" : "Play continuous narration audio"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isPlaying
            ? "bg-amber-600 hover:bg-amber-700"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : isPlaying ? (
          <span className="text-xs">❚❚</span>
        ) : (
          <span className="text-xs ml-0.5">▶</span>
        )}
      </button>

      {/* Progress & Scrubber */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-1">
          <div className="flex items-center gap-2">
            <span className="font-sans font-semibold text-slate-700 text-xs">
              Full Narration Track
            </span>
          </div>
          <div>
            <span className={isPlaying ? "text-indigo-600 font-bold" : ""}>
              {formatSec(currentTime)}
            </span>
            <span className="text-slate-400"> / </span>
            <span>{formatSec(effectiveDuration)}</span>
          </div>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={effectiveDuration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioUrl || isLoading}
            aria-label="Seek continuous narration audio"
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div
            className="absolute left-0 top-0 bottom-0 pointer-events-none rounded-lg bg-indigo-500/20"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Retry if error */}
      {isError && (
        <div className="flex items-center gap-2 text-xs text-red-600 shrink-0">
          <span>Audio unavailable</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-[11px] font-semibold underline hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
