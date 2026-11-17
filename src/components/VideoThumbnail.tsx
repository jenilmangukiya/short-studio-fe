"use client";

import { useState } from "react";
import { useAuthenticatedImage } from "@/components/AuthenticatedImage";

interface VideoThumbnailProps {
  videoId: string;
  topic: string;
  status: string;
  variant?: "card" | "row";
  className?: string;
}

export function VideoThumbnail({
  videoId,
  topic,
  status,
  variant = "card",
  className = "",
}: VideoThumbnailProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Attempt to load Scene 1 image if video is not in draft mode
  const isEligible = status !== "draft";
  const { imageUrl, isError } = useAuthenticatedImage({
    videoId,
    sceneIndex: 1,
    enabled: isEligible,
    retry: 0,
  });

  const hasImage = Boolean(imageUrl && !isError);

  // --- Variant 1: Row (Compact Mini 9:16 Thumbnail) ---
  if (variant === "row") {
    return (
      <div
        className={`relative w-12 h-16 rounded-lg bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 shrink-0 border border-slate-300 overflow-hidden flex items-center justify-center group-hover:scale-102 transition-transform shadow-2xs ${className}`}
      >
        {hasImage && imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={topic}
              onLoad={() => setImageLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
            {/* Scrim overlay for small badge */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </>
        ) : (
          <span className="text-base">🎬</span>
        )}

        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded-xs bg-black/70 text-[8px] font-mono text-white/90 z-10">
          9:16
        </span>
      </div>
    );
  }

  // --- Variant 2: Card (Full 9:16 / 16:10 Aspect Header) ---
  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center ${className}`}>
      {hasImage && imageUrl ? (
        <>
          {/* Generated AI Scene Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={topic}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Vignette & Contrast Scrim Overlay for Badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-950/60 pointer-events-none" />

          {/* AI Generated Indicator Pill */}
          <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/60 text-[10px] font-medium text-slate-200 border border-white/10 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Scene 1 Preview</span>
          </div>
        </>
      ) : (
        /* Fallback Default Studio Gradient & Phone Silhouette */
        <>
          {/* Dynamic Studio Gradient */}
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 opacity-95 group-hover:scale-105 transition-transform duration-500" />

          {/* Subtle grid pattern background */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: "radial-gradient(#818cf8 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />

          {/* 9:16 Vertical Phone Outline Silhouette */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-22 rounded-lg border border-indigo-400/30 bg-indigo-500/10 backdrop-blur-2xs flex flex-col items-center justify-center shadow-inner group-hover:border-indigo-400/60 group-hover:scale-110 transition-all duration-300">
              <span className="text-xl opacity-80 group-hover:scale-110 transition-transform">🎬</span>
              <span className="text-[9px] font-mono text-indigo-200/80 font-bold tracking-wider mt-1">9:16</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
