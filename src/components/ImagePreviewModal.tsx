"use client";

import { useEffect, useState, useCallback } from "react";
import type { ImageItem } from "@/lib/types";
import { AuthenticatedImage, useAuthenticatedImage } from "./AuthenticatedImage";

interface ImagePreviewModalProps {
  videoId: string;
  item: ImageItem;
  allItems: ImageItem[];
  narrationSnippet?: string;
  shotType?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectScene?: (item: ImageItem) => void;
}

export function ImagePreviewModal({
  videoId,
  item,
  allItems,
  narrationSnippet,
  shotType,
  isOpen,
  onClose,
  onSelectScene,
}: ImagePreviewModalProps) {
  const [copyPromptStatus, setCopyPromptStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [copyHashStatus, setCopyHashStatus] = useState<"idle" | "copied" | "failed">("idle");

  const currentIndex = allItems.findIndex((it) => it.index === item.index);
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem = currentIndex >= 0 && currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

  const handlePrev = useCallback(() => {
    if (prevItem && onSelectScene) {
      onSelectScene(prevItem);
    }
  }, [prevItem, onSelectScene]);

  const handleNext = useCallback(() => {
    if (nextItem && onSelectScene) {
      onSelectScene(nextItem);
    }
  }, [nextItem, onSelectScene]);

  // Keyboard navigation: Escape to close, ArrowLeft / ArrowRight to navigate scenes
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const { blob } = useAuthenticatedImage({
    videoId,
    sceneIndex: item.index,
    promptHash: item.prompt_hash,
    enabled: isOpen && item.status === "ok" && Boolean(item.file),
  });

  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${videoId}-scene-${item.index.toString().padStart(2, "0")}.png`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleCopyPrompt = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(item.prompt);
      setCopyPromptStatus("copied");
      setTimeout(() => setCopyPromptStatus("idle"), 2000);
    } catch {
      setCopyPromptStatus("failed");
      setTimeout(() => setCopyPromptStatus("idle"), 2500);
    }
  };

  const handleCopyHash = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(item.prompt_hash);
      setCopyHashStatus("copied");
      setTimeout(() => setCopyHashStatus("idle"), 2000);
    } catch {
      setCopyHashStatus("failed");
      setTimeout(() => setCopyHashStatus("idle"), 2500);
    }
  };

  if (!isOpen) return null;

  const shortHash = item.prompt_hash ? item.prompt_hash.slice(0, 8) : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Image preview for Scene ${item.index}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col md:flex-row bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image preview"
          className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow-lg cursor-pointer"
        >
          <span className="text-xl leading-none">&times;</span>
        </button>

        {/* Left Column: Portrait Image Viewer with Navigation Arrows */}
        <div className="relative flex-1 bg-black flex items-center justify-center p-4 min-h-[360px] md:min-h-[560px]">
          <div className="w-full max-w-[340px] max-h-[75vh] flex items-center justify-center">
            <AuthenticatedImage
              videoId={videoId}
              sceneIndex={item.index}
              promptHash={item.prompt_hash}
              status={item.status}
              hasFile={Boolean(item.file)}
              alt={`Scene ${item.index} generated image`}
              aspectRatio="aspect-[9/16]"
              className="rounded-xl shadow-2xl border border-slate-800/80 w-full"
              imgClassName="w-full h-full object-contain"
              errorMessage={item.error}
            />
          </div>

          {/* Previous Scene Button */}
          {prevItem && onSelectScene && (
            <button
              type="button"
              onClick={handlePrev}
              title={`Previous: Scene ${prevItem.index}`}
              aria-label="Previous scene"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition shadow-lg cursor-pointer border border-slate-700/60"
            >
              &#8592;
            </button>
          )}

          {/* Next Scene Button */}
          {nextItem && onSelectScene && (
            <button
              type="button"
              onClick={handleNext}
              title={`Next: Scene ${nextItem.index}`}
              aria-label="Next scene"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition shadow-lg cursor-pointer border border-slate-700/60"
            >
              &#8594;
            </button>
          )}
        </div>

        {/* Right Column: Scene Information & Generation Metadata */}
        <div className="w-full md:w-[380px] flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800 bg-slate-900/95 p-5 overflow-y-auto">
          <div className="space-y-4">
            {/* Header: Scene # & Status Badges */}
            <div className="pr-6">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="flex h-6 px-2 items-center justify-center rounded-md bg-indigo-600/30 text-indigo-300 font-bold text-xs border border-indigo-500/30">
                  Scene {item.index}
                </span>

                {shotType && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                    {shotType}
                  </span>
                )}

                {item.reused ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                    <span>⚡</span> Reused (cached)
                  </span>
                ) : item.status === "ok" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                    <span>✨</span> Generated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/80 text-red-300 border border-red-700/50">
                    <span>✕</span> Failed
                  </span>
                )}
              </div>

              {narrationSnippet && (
                <p className="text-xs text-slate-300 italic font-serif leading-relaxed line-clamp-3 mt-2">
                  &ldquo;{narrationSnippet}&rdquo;
                </p>
              )}
            </div>

            {/* Prompt Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold uppercase tracking-wider text-indigo-300">
                  Composed Prompt
                </span>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="text-[11px] font-medium text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {copyPromptStatus === "copied" ? (
                    <span className="text-emerald-400 font-semibold">✓ Copied</span>
                  ) : copyPromptStatus === "failed" ? (
                    <span className="text-red-400">✕ Failed</span>
                  ) : (
                    "Copy prompt"
                  )}
                </button>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-slate-200 max-h-36 overflow-y-auto leading-relaxed select-all">
                {item.prompt}
              </div>
            </div>

            {/* Prompt Hash Section */}
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-400">Content Hash (SHA-256)</span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="text-[10px] font-medium text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {copyHashStatus === "copied" ? (
                    <span className="text-emerald-400 font-semibold">✓ Copied</span>
                  ) : (
                    "Copy full hash"
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/40">
                  {shortHash}
                </span>
                <span className="font-mono text-[10px] text-slate-500 truncate" title={item.prompt_hash}>
                  {item.prompt_hash}
                </span>
              </div>
            </div>

            {/* Technical Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-3">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Model</span>
                <span className="font-medium text-slate-200">{item.model || "default"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Resolution</span>
                <span className="font-medium text-slate-200">
                  {item.size || "1024x1536"} ({item.quality || "standard"})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Latency</span>
                <span className="font-medium text-slate-200">
                  {item.latency_seconds !== undefined ? `${item.latency_seconds.toFixed(2)}s` : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Est. Cost</span>
                <span className="font-medium text-slate-200">
                  {item.est_cost_usd !== null && item.est_cost_usd !== undefined
                    ? `$${item.est_cost_usd.toFixed(4)}`
                    : "Zero ($0.00)"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              {currentIndex + 1} of {allItems.length} scenes
            </span>

            <div className="flex items-center gap-2">
              {blob && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
                >
                  Download PNG
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
