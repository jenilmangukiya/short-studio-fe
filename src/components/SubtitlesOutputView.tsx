"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SubtitleData, SubtitleMeta, StepStatus, SubtitleStyleId } from "@/lib/types";
import { resolveSubtitleStyleId } from "@/lib/subtitles";
import { useSubtitleStyles } from "@/lib/useSubtitleStyles";
import { api, formatErrorMessage } from "@/lib/api";
import { VideoPlayer } from "./VideoPlayer";
import { CollapsibleJson } from "./CollapsibleJson";

interface SubtitlesOutputViewProps {
  videoId: string;
  topic?: string;
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  isRunning?: boolean;
  stepStatus?: StepStatus | string;
  previewStyleId?: SubtitleStyleId | null;
  onPreviewStyleChange?: (styleId: SubtitleStyleId) => void;
  onApplyStyle?: (styleId: SubtitleStyleId) => Promise<void>;
}

function StylePreviewSample({ styleId }: { styleId: string }) {
  const norm = resolveSubtitleStyleId(styleId);

  if (norm === "remotion_neon") {
    return (
      <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 flex items-center justify-center gap-1.5 shadow-2xs">
        <span
          style={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 900,
            color: "#FFFFFF",
            WebkitTextStroke: "1.5px #000000",
            paintOrder: "stroke fill",
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.95)",
          }}
          className="text-xs"
        >
          Neon
        </span>
        <span
          style={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 900,
            color: "#28F5FC",
            WebkitTextStroke: "1.5px #000000",
            paintOrder: "stroke fill",
            textShadow: "0 0 10px rgba(40, 245, 252, 0.9), 0 2px 4px rgba(0, 0, 0, 0.9)",
            transform: "scale(1.06)",
            display: "inline-block",
          }}
          className="text-xs"
        >
          Active
        </span>
      </div>
    );
  }

  if (norm === "dynamic_highlight") {
    return (
      <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 flex items-center justify-center gap-1.5 shadow-2xs">
        <span
          style={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 900,
            color: "#FFFFFF",
            WebkitTextStroke: "1.5px #000000",
            paintOrder: "stroke fill",
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.95)",
            textTransform: "uppercase",
          }}
          className="text-xs uppercase"
        >
          BOLD
        </span>
        <span
          style={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 900,
            color: "#FFE600",
            WebkitTextStroke: "1.5px #000000",
            paintOrder: "stroke fill",
            textShadow: "0 0 10px rgba(255, 230, 0, 0.85), 0 2px 4px rgba(0, 0, 0, 0.9)",
            transform: "scale(1.10)",
            textTransform: "uppercase",
            display: "inline-block",
          }}
          className="text-xs uppercase"
        >
          PUNCH
        </span>
      </div>
    );
  }

  // clean_cinematic (Default)
  return (
    <div className="bg-black/85 rounded-lg p-2 border border-white/10 flex items-center justify-center gap-1.5 shadow-2xs">
      <span className="text-white/85 font-bold text-xs">
        Clean
      </span>
      <span className="text-amber-300 font-black text-xs scale-105 drop-shadow-[0_0_8px_rgba(251,191,36,0.85)] inline-block">
        Caption
      </span>
    </div>
  );
}

interface ValidatedSubtitlesOutput {
  data: SubtitleData;
  meta?: SubtitleMeta;
  warnings?: string[];
}

function parseAndValidateSubtitles(output: unknown): ValidatedSubtitlesOutput | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  const o = output as Record<string, unknown>;

  let subtitleData: SubtitleData = { segments: [] };

  if (o.subtitles && typeof o.subtitles === "object" && !Array.isArray(o.subtitles)) {
    subtitleData = o.subtitles as SubtitleData;
  } else if (Array.isArray(o.segments)) {
    subtitleData = o as unknown as SubtitleData;
  }

  const meta =
    o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as SubtitleMeta)
      : undefined;

  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === "string")
    : [];

  return {
    data: subtitleData,
    meta,
    warnings,
  };
}

export function SubtitlesOutputView({
  videoId,
  topic,
  output,
  isMock,
  isStale = false,
  isRunning = false,
  stepStatus,
  previewStyleId: propPreviewStyleId,
  onPreviewStyleChange,
  onApplyStyle,
}: SubtitlesOutputViewProps) {
  const queryClient = useQueryClient();
  const {
    data: stylesData,
    isLoading: isStylesLoading,
    isError: isStylesError,
    error: stylesError,
    refetch: refetchStyles,
  } = useSubtitleStyles();

  const parsed = parseAndValidateSubtitles(output);

  const subtitles = parsed?.data || { segments: [] };
  const meta = parsed?.meta;

  const appliedStyleId = resolveSubtitleStyleId(subtitles.style ?? meta?.style);
  const [userPreviewStyle, setUserPreviewStyle] = useState<SubtitleStyleId | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const effectivePreviewStyle =
    propPreviewStyleId ??
    (userPreviewStyle && userPreviewStyle !== appliedStyleId ? userPreviewStyle : null) ??
    appliedStyleId;

  const previewDiffersFromApplied = effectivePreviewStyle !== appliedStyleId;

  const handleSelectPreviewStyle = (styleId: SubtitleStyleId) => {
    setUserPreviewStyle(styleId);
    onPreviewStyleChange?.(styleId);
  };

  const handleResetToApplied = () => {
    setUserPreviewStyle(null);
    onPreviewStyleChange?.(appliedStyleId);
  };

  const isRerunInProgress = isApplying || isRunning;

  const handleApplyStyle = async (styleId: SubtitleStyleId) => {
    if (isRerunInProgress || styleId === appliedStyleId) return;
    setIsApplying(true);
    setRegenError(null);
    try {
      if (onApplyStyle) {
        await onApplyStyle(styleId);
      } else {
        await api.videos.rerunStep(videoId, "subtitles", undefined, styleId);
        try {
          await api.videos.next(videoId);
        } catch {
          // May already be queued/running
        }
      }
      queryClient.invalidateQueries({ queryKey: ["video", videoId] });
      queryClient.invalidateQueries({ queryKey: ["video-blob", videoId] });
      queryClient.invalidateQueries({ queryKey: ["video-subtitles", videoId] });
    } catch (err) {
      setRegenError(formatErrorMessage(err));
    } finally {
      setIsApplying(false);
    }
  };

  const getStyleDisplayName = (styleId: string): string => {
    const found = stylesData?.find((s) => s.id === styleId);
    if (found) return found.name;
    if (styleId === "remotion_neon") return "Remotion Neon";
    if (styleId === "dynamic_highlight") return "Dynamic Highlight";
    return "Clean Cinematic";
  };

  const appliedStyleName = getStyleDisplayName(appliedStyleId);
  const previewStyleName = getStyleDisplayName(effectivePreviewStyle);

  const hasSegments = Boolean(parsed?.data?.segments && parsed.data.segments.length > 0);
  const isCaptionedBurned = parsed?.meta?.captioned_burned !== false;
  const isReady =
    (stepStatus === "done" ||
      stepStatus === "awaiting_approval" ||
      (!stepStatus && hasSegments)) &&
    !isRunning &&
    !isStale &&
    hasSegments &&
    isCaptionedBurned;

  if (!parsed && !isRunning) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500 italic">No subtitle data available yet.</p>
        <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw subtitles payload" />
      </div>
    );
  }

  const segments = subtitles.segments || [];
  const totalWords = subtitles.total_words ?? meta?.words_count ?? segments.reduce((sum, s) => sum + (s.words?.length || 0), 0);
  const totalDuration = subtitles.total_duration_seconds ?? meta?.duration_seconds ?? 0;
  const provider = meta?.provider || "acoustic";
  const model = meta?.model || "vosk-forced-aligner";
  const timingSource =
    meta?.timing_source ??
    subtitles.timing_source ??
    segments[0]?.timing_source ??
    (isMock ? "estimated" : undefined);
  const alignmentHash = meta?.alignment_hash ?? subtitles.alignment_hash ?? null;
  const isReused = Boolean(meta?.reused);

  return (
    <div className="space-y-6">
      {/* Stale Warning Banner */}
      {isStale && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 flex items-start gap-3">
          <span className="text-lg">⏳</span>
          <div>
            <p className="font-bold text-amber-950">Subtitles Output Outdated</p>
            <p className="mt-0.5 text-amber-900">
              An earlier step was modified. Subtitle timestamps will be regenerated when you advance the pipeline.
            </p>
          </div>
        </div>
      )}

      {/* Telemetry Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Acoustic Word-Level Subtitles Output
              </h3>
              <p className="text-xs text-slate-500">
                Ground-truth speech alignment with synchronized word-level timestamps and multi-format exports (.json, .vtt, .srt).
              </p>
            </div>
          </div>

          {isReady ? (
            <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
              {timingSource === "forced_alignment" && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  🎯 Forced Alignment
                </span>
              )}
              {timingSource === "estimated" && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  ≈ Estimated Timing
                </span>
              )}
              {isReused && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Cached
                </span>
              )}
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200"
                data-testid="applied-style-badge"
              >
                🎨 {appliedStyleId === "remotion_neon"
                  ? "Remotion Neon"
                  : appliedStyleId === "dynamic_highlight"
                  ? "Dynamic Highlight"
                  : "Clean Cinematic"}
              </span>
              {effectivePreviewStyle !== appliedStyleId && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                  data-testid="preview-style-badge"
                >
                  Previewing: {effectivePreviewStyle}
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ Synchronized
              </span>
            </div>
          ) : isRunning ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse self-start sm:self-center">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
              Aligning audio & words...
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300 self-start sm:self-center">
              Pending Subtitles
            </span>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-100">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Total Words
            </span>
            <span className="text-sm font-bold text-indigo-600">
              {totalWords > 0 ? `${totalWords} words` : "—"}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Voiceover Duration
            </span>
            <span className="font-semibold text-slate-800 truncate block">
              {totalDuration > 0 ? `${totalDuration.toFixed(1)}s` : "—"}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Scenes / Segments
            </span>
            <span className="font-semibold text-slate-800 truncate block">
              {segments.length > 0 ? `${segments.length} scenes` : "—"}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Provider & Model
            </span>
            <span className="font-semibold text-slate-800 truncate block">
              {provider} / {model}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings if any */}
      {parsed?.warnings && parsed.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-amber-950">
            <span>⚠️</span> Subtitle Warnings:
          </span>
          <ul className="list-disc pl-5 space-y-0.5">
            {parsed.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Subtitle Style Selector & Apply Workflow (Phase 3B) */}
      <div
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
        data-testid="subtitle-style-selector-section"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>🎨</span> Subtitle Visual Style
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a style to preview live on the video player below. Apply to burn it into the final MP4.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Applied:</span>
            <span
              className="font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200"
              data-testid="selector-applied-label"
            >
              {appliedStyleName}
            </span>
            {previewDiffersFromApplied && (
              <>
                <span className="text-slate-400">→</span>
                <span className="text-slate-500">Previewing:</span>
                <span
                  className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
                  data-testid="selector-preview-label"
                >
                  {previewStyleName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {isStylesLoading && (
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
            data-testid="styles-loading-skeleton"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 animate-pulse"
              >
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
                <div className="h-10 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {isStylesError && (
          <div
            className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 flex items-center justify-between gap-3"
            data-testid="styles-error-state"
          >
            <div>
              <p className="font-bold text-rose-950">Failed to load subtitle styles</p>
              <p className="text-rose-800 mt-0.5">
                {formatErrorMessage(stylesError)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetchStyles()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-rose-300 text-rose-900 hover:bg-rose-100 transition-colors shrink-0 shadow-2xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isStylesLoading && !isStylesError && (!stylesData || stylesData.length === 0) && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 text-center">
            No subtitle styles available.
          </div>
        )}

        {/* Styles Grid */}
        {!isStylesLoading && !isStylesError && stylesData && stylesData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="styles-grid">
            {stylesData.map((style) => {
              const styleId = style.id as SubtitleStyleId;
              const isApplied = styleId === appliedStyleId;
              const isPreviewing = styleId === effectivePreviewStyle;

              return (
                <button
                  key={style.id}
                  type="button"
                  data-testid={`style-option-${style.id}`}
                  data-selected={isPreviewing}
                  data-applied={isApplied}
                  onClick={() => handleSelectPreviewStyle(styleId)}
                  disabled={isRerunInProgress}
                  className={`text-left rounded-xl p-3.5 border transition-all duration-150 flex flex-col justify-between gap-3 relative focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60 disabled:cursor-not-allowed ${
                    isPreviewing
                      ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-xs"
                      : isApplied
                      ? "border-violet-300 bg-violet-50/10 hover:border-violet-400"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {style.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isApplied && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200"
                            title="Currently burned into generated video"
                          >
                            ✓ Applied
                          </span>
                        )}
                        {isPreviewing && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200"
                            title="Currently previewing in player overlay"
                          >
                            👁 Previewing
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                      {style.description}
                    </p>
                  </div>

                  {/* Visual Preview Sample */}
                  <div className="w-full mt-1">
                    <StylePreviewSample styleId={styleId} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Action Bar (Reset / Apply & Regenerate) */}
        {previewDiffersFromApplied && (
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100"
            data-testid="preview-action-bar"
          >
            <div className="text-xs text-slate-600 flex items-center gap-1.5">
              <span>💡</span>
              <span>
                Previewing <strong className="text-slate-900">{previewStyleName}</strong>. Ready to burn it into the final MP4?
              </span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={handleResetToApplied}
                disabled={isRerunInProgress}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                data-testid="reset-style-button"
              >
                Reset to Current
              </button>
              <button
                type="button"
                onClick={() => handleApplyStyle(effectivePreviewStyle)}
                disabled={isRerunInProgress || !previewDiffersFromApplied}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                data-testid="apply-style-button"
              >
                {isRerunInProgress ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Regenerating Subtitles...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Apply &amp; Regenerate Subtitles</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Regeneration Error Banner */}
        {regenError && (
          <div
            className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 flex items-start justify-between gap-3"
            data-testid="regen-error-banner"
          >
            <div className="space-y-0.5">
              <p className="font-bold text-rose-950 flex items-center gap-1.5">
                <span>⚠️</span> Subtitle Regeneration Failed
              </p>
              <p className="text-rose-800">{regenError}</p>
              <p className="text-[11px] text-rose-700/80 mt-1">
                Your preview selection is preserved. You can retry applying or reset to current.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRegenError(null)}
              className="text-rose-600 hover:text-rose-900 font-semibold text-xs px-2 py-1 rounded hover:bg-rose-100 transition-colors shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* In-Browser Video Player with Subtitle Style Overlay */}
      <div className="rounded-2xl border border-slate-200 bg-slate-900/5 p-6 flex flex-col items-center">
        <div className="w-full max-w-md text-center mb-4">
          <h4 className="text-sm font-bold text-slate-800">
            {isRunning
              ? "Aligning & Burning Subtitles..."
              : isStale || !isCaptionedBurned
              ? "Captioned Video Outdated"
              : isReady
              ? "Synchronized Subtitle Style Preview"
              : "Subtitle Preview Pending"}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Plays uncaptioned base video with live in-browser subtitle overlay using{" "}
            <span className="font-semibold text-slate-700">
              {effectivePreviewStyle === "remotion_neon"
                ? "Remotion Neon"
                : effectivePreviewStyle === "dynamic_highlight"
                ? "Dynamic Highlight"
                : "Clean Cinematic"}
            </span>
            {effectivePreviewStyle !== appliedStyleId && " (Preview)"}.
          </p>
        </div>

        <VideoPlayer
          videoId={videoId}
          topic={topic}
          showDownloadButton={true}
          isReady={isReady}
          isRendering={isRunning}
          isStale={isStale || !isCaptionedBurned}
          subtitlesVersion={alignmentHash}
          initialSubtitles={hasSegments ? subtitles : null}
          useSubtitleOverlay={true}
          previewStyleId={effectivePreviewStyle}
          appliedStyleId={appliedStyleId}
        />
      </div>

      {/* Scene-by-Scene Word Timestamps Breakdown */}
      {segments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Scene Narration & Word-Level Timestamps
            </h4>
            <span className="text-xs text-slate-500">
              {segments.length} scenes synchronized
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {segments.map((seg) => (
              <div key={seg.index} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    Scene {seg.index}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {seg.start.toFixed(2)}s &rarr; {seg.end.toFixed(2)}s ({((seg.end - seg.start)).toFixed(2)}s)
                  </span>
                </div>
                <p className="text-xs text-slate-700 italic bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                  &ldquo;{seg.text}&rdquo;
                </p>
                {seg.words && seg.words.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {seg.words.map((w, wIdx) => (
                      <span
                        key={wIdx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900"
                        title={`Spoken: ${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s`}
                      >
                        <span className="font-semibold">{w.text}</span>
                        <span className="text-[9px] text-indigo-500 font-mono">
                          {w.start.toFixed(1)}s
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Artifacts Card */}
      {isReady && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Generated Subtitle & Video Artifacts
            </h4>
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Burned & Synchronized
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700">Captioned Video (Burned MP4)</span>
              <span className="font-mono text-[11px] text-indigo-600 font-semibold">final_video_captioned.mp4</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700">Advanced SubStation Alpha</span>
              <span className="font-mono text-[11px] text-slate-500">subtitles.ass</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700">SubRip Captions</span>
              <span className="font-mono text-[11px] text-slate-500">subtitles.srt</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-700">WebVTT Captions</span>
              <span className="font-mono text-[11px] text-slate-500">subtitles.vtt</span>
            </div>
          </div>
        </div>
      )}

      {/* Raw Payload Inspector */}
      <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw subtitles payload" />
    </div>
  );
}
