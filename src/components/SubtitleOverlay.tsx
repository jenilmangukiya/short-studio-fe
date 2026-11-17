"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SubtitleData, SubtitleStyleId } from "@/lib/types";
import {
  buildAllChunks,
  findActiveSubtitle,
  resolveSubtitleStyleId,
  type ActiveSubtitleState,
} from "@/lib/subtitles";

interface SubtitleOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  subtitles?: SubtitleData | null;
  visible?: boolean;
  styleId?: SubtitleStyleId | null;
}

export function SubtitleOverlay({
  videoRef,
  subtitles,
  visible = true,
  styleId,
}: SubtitleOverlayProps) {
  const [activeState, setActiveState] = useState<ActiveSubtitleState>({
    chunk: null,
    activeWordIndex: -1,
  });

  const resolvedStyleId = resolveSubtitleStyleId(styleId ?? subtitles?.style);

  // Pre-calculate chunks of 3-5 words across all segments
  const chunks = useMemo(() => buildAllChunks(subtitles), [subtitles]);

  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || chunks.length === 0) {
      setActiveState({ chunk: null, activeWordIndex: -1 });
      return;
    }

    const syncTime = () => {
      const currentTime = video.currentTime;
      const nextState = findActiveSubtitle(chunks, currentTime);

      setActiveState((prev) => {
        if (
          prev.chunk?.id === nextState.chunk?.id &&
          prev.activeWordIndex === nextState.activeWordIndex
        ) {
          return prev; // Same state: bail out to avoid React re-renders
        }
        return nextState;
      });
    };

    const startRaf = () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      const tick = () => {
        syncTime();
        if (video && !video.paused && !video.ended) {
          rafIdRef.current = requestAnimationFrame(tick);
        }
      };
      rafIdRef.current = requestAnimationFrame(tick);
    };

    const stopRaf = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      syncTime();
    };

    // Attach high-fidelity playback and seek listeners
    video.addEventListener("play", startRaf);
    video.addEventListener("playing", startRaf);
    video.addEventListener("pause", stopRaf);
    video.addEventListener("ended", stopRaf);
    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("seeking", syncTime);
    video.addEventListener("seeked", syncTime);
    video.addEventListener("ratechange", syncTime);

    // Initial sync
    if (!video.paused && !video.ended) {
      startRaf();
    } else {
      syncTime();
    }

    return () => {
      video.removeEventListener("play", startRaf);
      video.removeEventListener("playing", startRaf);
      video.removeEventListener("pause", stopRaf);
      video.removeEventListener("ended", stopRaf);
      video.removeEventListener("timeupdate", syncTime);
      video.removeEventListener("seeking", syncTime);
      video.removeEventListener("seeked", syncTime);
      video.removeEventListener("ratechange", syncTime);

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [videoRef, chunks]);

  if (!visible || chunks.length === 0 || !activeState.chunk) {
    return null;
  }

  const { chunk, activeWordIndex } = activeState;

  // 1. Remotion Neon: Bold white text with electric cyan active word pop and glow inside translucent capsule
  if (resolvedStyleId === "remotion_neon") {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[18%] z-10 flex items-center justify-center px-4 select-none"
        aria-live="polite"
        aria-atomic="true"
        data-testid="subtitle-overlay"
        data-style="remotion_neon"
      >
        <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-4 py-2 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.7)] max-w-[90%] text-center">
          {chunk.words.map((word, idx) => {
            const isActive = idx === activeWordIndex;
            return (
              <span
                key={`${chunk.id}-w-${idx}`}
                data-testid={`subtitle-word-${idx}`}
                data-active={isActive ? "true" : "false"}
                style={{
                  fontFamily:
                    'Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
                  color: isActive ? "#28F5FC" : "#FFFFFF",
                  WebkitTextStroke: "1px #000000",
                  paintOrder: "stroke fill",
                  textShadow: isActive
                    ? "0 0 16px rgba(40, 245, 252, 0.9), 0 2px 4px rgba(0, 0, 0, 0.9)"
                    : "0 2px 4px rgba(0, 0, 0, 0.8)",
                  transform: isActive ? "scale(1.06)" : "scale(1)",
                  display: "inline-block",
                  transition: "transform 150ms ease-out, color 150ms ease-out",
                }}
                className="text-base sm:text-lg leading-tight"
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Dynamic Highlight: High-impact bold uppercase text with vibrant yellow active word punch inside translucent capsule
  if (resolvedStyleId === "dynamic_highlight") {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[18%] z-10 flex items-center justify-center px-4 select-none"
        aria-live="polite"
        aria-atomic="true"
        data-testid="subtitle-overlay"
        data-style="dynamic_highlight"
      >
        <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-4 py-2 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.7)] max-w-[90%] text-center">
          {chunk.words.map((word, idx) => {
            const isActive = idx === activeWordIndex;
            return (
              <span
                key={`${chunk.id}-w-${idx}`}
                data-testid={`subtitle-word-${idx}`}
                data-active={isActive ? "true" : "false"}
                style={{
                  fontFamily:
                    'Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontWeight: 900,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  color: isActive ? "#FFE600" : "#FFFFFF",
                  WebkitTextStroke: "1px #000000",
                  paintOrder: "stroke fill",
                  textShadow: isActive
                    ? "0 0 16px rgba(255, 230, 0, 0.85), 0 2px 4px rgba(0, 0, 0, 0.9)"
                    : "0 2px 4px rgba(0, 0, 0, 0.8)",
                  transform: isActive ? "scale(1.10)" : "scale(1)",
                  display: "inline-block",
                  transition: "transform 150ms ease-out, color 150ms ease-out",
                }}
                className="text-base sm:text-lg leading-tight uppercase"
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. Clean Cinematic (Default): Preserves existing frontend subtitle appearance exactly
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[18%] z-10 flex items-center justify-center px-4 select-none"
      aria-live="polite"
      aria-atomic="true"
      data-testid="subtitle-overlay"
      data-style="clean_cinematic"
    >
      <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-4 py-2 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.7)] max-w-[90%] text-center">
        {chunk.words.map((word, idx) => {
          const isActive = idx === activeWordIndex;
          return (
            <span
              key={`${chunk.id}-w-${idx}`}
              data-testid={`subtitle-word-${idx}`}
              data-active={isActive ? "true" : "false"}
              className={`inline-block transition-all duration-150 ease-out text-sm sm:text-base tracking-wide ${
                isActive
                  ? "font-black text-amber-300 scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.85)]"
                  : "font-bold text-white/85 scale-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
              }`}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
