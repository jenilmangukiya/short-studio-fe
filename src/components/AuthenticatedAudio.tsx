"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useObjectUrl } from "@/lib/object-url";

interface UseAuthenticatedAudioOptions {
  videoId: string;
  sceneIndex: number;
  audioHash?: string;
  enabled?: boolean;
}

/**
 * Hook to fetch a bearer-authenticated scene audio WAV file as a Blob,
 * create a local Object URL, and clean it up automatically upon unmount.
 */
export function useAuthenticatedAudio({
  videoId,
  sceneIndex,
  audioHash,
  enabled = true,
}: UseAuthenticatedAudioOptions) {
  const query = useQuery({
    queryKey: ["scene-audio", videoId, sceneIndex, audioHash],
    queryFn: () => api.videos.getSceneAudioBlob(videoId, sceneIndex),
    enabled: Boolean(videoId && sceneIndex !== undefined && enabled),
    staleTime: 1000 * 60 * 60, // 1 hour (same hash is immutable)
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
  });

  const blob = query.data;
  const audioUrl = useObjectUrl(blob);

  return {
    ...query,
    audioUrl,
    blob,
  };
}

interface SceneAudioPlayerProps {
  videoId: string;
  sceneIndex: number;
  audioHash?: string;
  durationSeconds?: number;
  isPlaying?: boolean;
  onPlayToggle?: (play: boolean) => void;
  onEnded?: () => void;
  onError?: (err: unknown) => void;
  status?: string;
  hasFile?: boolean;
  className?: string;
}

export function SceneAudioPlayer({
  videoId,
  sceneIndex,
  audioHash,
  durationSeconds = 0,
  isPlaying = false,
  onPlayToggle,
  onEnded,
  onError,
  status = "ok",
  hasFile = true,
  className = "",
}: SceneAudioPlayerProps) {
  const isAvailable = status === "ok" && hasFile;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [localPlaying, setLocalPlaying] = useState(false);

  const { audioUrl, isLoading, isError, refetch } = useAuthenticatedAudio({
    videoId,
    sceneIndex,
    audioHash,
    enabled: isAvailable,
  });

  const effectivePlaying = onPlayToggle ? isPlaying : localPlaying;

  // Sync effectivePlaying with HTMLAudioElement
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;

    if (effectivePlaying) {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Playback failed or was interrupted
          if (onError) onError(err);
          if (onPlayToggle) onPlayToggle(false);
          setLocalPlaying(false);
        });
      }
    } else {
      el.pause();
    }
  }, [effectivePlaying, audioUrl, onError, onPlayToggle]);

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
    if (!audioUrl) return;
    const nextState = !effectivePlaying;
    if (onPlayToggle) {
      onPlayToggle(nextState);
    } else {
      setLocalPlaying(nextState);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setCurrentTime(0);
    if (onPlayToggle) {
      onPlayToggle(false);
    } else {
      setLocalPlaying(false);
    }
    if (onEnded) {
      onEnded();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const formatSec = (sec: number) => {
    const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
    return safe.toFixed(1) + "s";
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  if (!isAvailable) {
    return (
      <div className={`flex items-center gap-2 text-xs text-slate-400 italic ${className}`}>
        <span>🔇</span>
        <span>Audio not available for scene {sceneIndex}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 ${className}`}
    >
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleAudioEnded}
          onError={(e) => {
            if (onError) onError(e);
          }}
        />
      )}

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading || isError || !audioUrl}
        aria-label={effectivePlaying ? `Pause scene ${sceneIndex} audio` : `Play scene ${sceneIndex} audio`}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white font-bold transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          effectivePlaying
            ? "bg-amber-600 hover:bg-amber-700"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
      >
        {isLoading ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : effectivePlaying ? (
          <span className="text-xs">❚❚</span>
        ) : (
          <span className="text-xs ml-0.5">▶</span>
        )}
      </button>

      {/* Progress & Scrubber */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
          <span className={effectivePlaying ? "text-indigo-600 font-bold" : ""}>
            {formatSec(currentTime)}
          </span>
          <span>{formatSec(duration || durationSeconds)}</span>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || durationSeconds || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioUrl || isLoading}
            aria-label={`Seek audio for scene ${sceneIndex}`}
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
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <span>Failed</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-[10px] font-semibold underline hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
