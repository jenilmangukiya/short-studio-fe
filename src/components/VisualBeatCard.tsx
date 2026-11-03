"use client";

import { useMemo } from "react";
import type { BeatTelemetryInfo, VisualBeat } from "@/lib/types";
import {
  type BeatImageSourceResult,
  getBeatImageStrategyDisplay,
  getBeatTimingDisplay,
  getTimelineTelemetryDisplay,
  resolveBeatImageSource,
  type ResolvedBeatTiming,
} from "@/lib/storyboard";
import { AuthenticatedImage } from "./AuthenticatedImage";

export interface VisualBeatCardProps {
  beat: VisualBeat;
  sceneIndex?: number;
  className?: string;
  videoId?: string;
  imageSource?: BeatImageSourceResult;
  onPreviewImage?: (sceneIndex: number) => void;
  /** Correlated render telemetry record for this beat */
  telemetry?: BeatTelemetryInfo | null;
  /** Authoritative timing resolution from continuous narration / render execution */
  resolvedTiming?: ResolvedBeatTiming | null;
}

/**
 * Compact, standalone presentation card for an individual VisualBeat.
 * Displays beat ordering, shot type, spoken narration, visual description,
 * camera framing metadata, image sourcing strategy, beat thumbnail, timing lifecycle,
 * and executed render telemetry (rendered vs scene-level fallback vs stale).
 */
export function VisualBeatCard({
  beat,
  sceneIndex,
  className = "",
  videoId,
  imageSource,
  onPreviewImage,
  telemetry,
  resolvedTiming,
}: VisualBeatCardProps) {
  // Use authoritative resolvedTiming if provided; otherwise fall back to beat's own timing
  const timing = useMemo(() => {
    if (resolvedTiming) {
      if (resolvedTiming.isExecuted) {
        return {
          text: `${resolvedTiming.formattedInterval}${
            resolvedTiming.frames ? ` (${resolvedTiming.frames}f)` : ""
          }`,
          status: "executed",
          badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold",
        };
      }
      if (resolvedTiming.timingType.includes("proportional")) {
        return {
          text: resolvedTiming.formattedInterval,
          status: "fallback",
          badgeStyle: "bg-blue-50 text-blue-700 border-blue-200",
        };
      }
      if (resolvedTiming.timingType === "aligned") {
        return {
          text: resolvedTiming.formattedInterval,
          status: "aligned",
          badgeStyle: "bg-teal-50 text-teal-700 border-teal-200",
        };
      }
      if (resolvedTiming.isPending) {
        return {
          text: "Pending voiceover",
          status: "unassigned",
          badgeStyle: "bg-slate-100 text-slate-600 border-slate-200",
        };
      }
      return {
        text: resolvedTiming.formattedInterval,
        status: "planned",
        badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
      };
    }
    return getBeatTimingDisplay(beat);
  }, [resolvedTiming, beat]);

  const strategy = getBeatImageStrategyDisplay(beat.image_strategy);
  const resolvedImage =
    imageSource ??
    resolveBeatImageSource({
      beat,
      sceneIndex: sceneIndex ?? 1,
    });

  const telemetryDisplay = telemetry ? getTimelineTelemetryDisplay(telemetry) : null;

  const beatLabel =
    typeof sceneIndex === "number" && Number.isFinite(sceneIndex)
      ? `#${sceneIndex}.${beat.order}`
      : `Beat #${beat.order}`;

  const hasNarration = Boolean(beat.narration_text && beat.narration_text.trim());
  const hasDescription = Boolean(beat.visual_description && beat.visual_description.trim());
  const hasPurpose = Boolean(beat.visual_purpose && beat.visual_purpose.trim());

  const hasFramingMeta = Boolean(
    (beat.camera_angle && beat.camera_angle.trim()) ||
    (beat.visual_technique && beat.visual_technique.trim()) ||
    (beat.focal_point && beat.focal_point.trim())
  );

  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-2.5 transition shadow-2xs hover:border-slate-300 ${className}`}
    >
      {/* Top Header: Identifier, Shot Type, Strategy, Telemetry, and Timing Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex h-5 items-center justify-center rounded px-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
            {beatLabel}
          </span>

          {beat.shot_type && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              {beat.shot_type}
            </span>
          )}

          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${strategy.badgeStyle}`}
          >
            {strategy.label}
          </span>

          {/* Telemetry Status Badge */}
          {telemetryDisplay && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${telemetryDisplay.badgeStyle}`}
              title={telemetryDisplay.accessibleText}
            >
              <span>{telemetryDisplay.icon}</span>
              <span>{telemetryDisplay.label}</span>
              {telemetry?.status === "rendered" && telemetry.frames ? (
                <span className="font-mono opacity-80 text-[9px]">{telemetry.frames}f</span>
              ) : null}
            </span>
          )}
        </div>

        {/* Timing Lifecycle Pill */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-medium border ${timing.badgeStyle}`}
        >
          <span>⏱️</span>
          <span>{timing.text}</span>
        </span>
      </div>

      {/* Body: Side-by-side Thumbnail and Beat Content */}
      <div className="flex items-start gap-3 pt-0.5">
        {/* Compact 9:16 Beat Thumbnail & Image Strategy Column */}
        <div className="flex flex-col items-center shrink-0 w-14 sm:w-16">
          {resolvedImage.status === "new_image_required" ? (
            <div
              className="w-14 sm:w-16 aspect-[9/16] rounded-lg border border-dashed border-amber-300 bg-amber-50/60 flex flex-col items-center justify-center p-1 text-center shadow-2xs select-none"
              title="New image required for this beat"
            >
              <span className="text-base">✨</span>
              <span className="text-[8px] font-bold text-amber-800 leading-tight mt-1">
                New image required
              </span>
            </div>
          ) : resolvedImage.status === "unavailable" ? (
            <div
              className="w-14 sm:w-16 aspect-[9/16] rounded-lg border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-1 text-center select-none"
              title={resolvedImage.description || "Previous beat image unavailable"}
            >
              <span className="text-sm opacity-50">🖼️</span>
              <span className="text-[8px] font-medium text-slate-400 mt-1">
                Unavailable
              </span>
            </div>
          ) : resolvedImage.isAvailable && resolvedImage.resolvedSceneIndex !== null && videoId ? (
            <div className="relative group w-14 sm:w-16 aspect-[9/16]">
              <AuthenticatedImage
                videoId={videoId}
                sceneIndex={resolvedImage.resolvedSceneIndex}
                alt={`${resolvedImage.sourceLabel} for ${beatLabel}`}
                className="w-14 sm:w-16 aspect-[9/16] rounded-lg cursor-pointer ring-1 ring-slate-200 hover:ring-indigo-400 transition shadow-2xs overflow-hidden"
                onClick={() => {
                  if (resolvedImage.resolvedSceneIndex !== null) {
                    onPreviewImage?.(resolvedImage.resolvedSceneIndex);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (resolvedImage.resolvedSceneIndex !== null) {
                    onPreviewImage?.(resolvedImage.resolvedSceneIndex);
                  }
                }}
                aria-label={`Preview ${resolvedImage.sourceLabel}`}
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition rounded-lg cursor-pointer text-white text-[11px] font-semibold"
              >
                🔍
              </button>
            </div>
          ) : (
            <div
              className="w-14 sm:w-16 aspect-[9/16] rounded-lg border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-1 text-center select-none"
              title={resolvedImage.description || "Image not ready"}
            >
              <span className="text-sm opacity-50">🖼️</span>
              <span className="text-[8px] font-medium text-slate-500 mt-1 leading-tight">
                Not ready
              </span>
              {resolvedImage.resolvedSceneIndex !== null && (
                <span className="text-[7px] text-slate-400">
                  Sc {resolvedImage.resolvedSceneIndex}
                </span>
              )}
            </div>
          )}

          {/* Source Subtitle Label under thumbnail */}
          <span
            className={`mt-1 text-[8px] sm:text-[9px] font-semibold tracking-wider uppercase text-center leading-tight line-clamp-2 ${
              resolvedImage.status === "scene_image"
                ? "text-indigo-600"
                : resolvedImage.status === "previous_image"
                ? "text-purple-600"
                : resolvedImage.status === "new_image_required"
                ? "text-amber-700"
                : "text-slate-400"
            }`}
          >
            {resolvedImage.sourceLabel}
          </span>
        </div>

        {/* Text Details Column */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Spoken Narration Text */}
          {hasNarration && (
            <div className="rounded-lg bg-slate-50/70 border border-slate-200/70 p-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Narration
              </span>
              <p className="text-slate-800 font-serif leading-relaxed italic">
                &ldquo;{beat.narration_text}&rdquo;
              </p>
            </div>
          )}

          {/* Visual Moment Description */}
          {hasDescription && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Visual Moment
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {beat.visual_description}
              </p>
            </div>
          )}

          {/* Visual Purpose */}
          {hasPurpose && (
            <div className="text-[11px] text-slate-600 flex items-baseline gap-1.5">
              <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider shrink-0">
                Purpose:
              </span>
              <span className="text-slate-700">{beat.visual_purpose}</span>
            </div>
          )}

          {/* Render Execution Metadata (when rendered) */}
          {telemetry?.status === "rendered" && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px]">
                <span className="text-emerald-600 font-bold">🎬 Motion:</span>{" "}
                {telemetry.animation?.animation_type || "zoom-in"}
              </span>
              {telemetry.frames ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono">
                  <span className="text-emerald-600 font-bold">Frames:</span> {telemetry.frames}
                  {telemetry.durationSeconds ? ` (${telemetry.durationSeconds.toFixed(2)}s)` : ""}
                </span>
              ) : null}
              {telemetry.feasibilityStatus && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 text-[10px]">
                  <span className="text-slate-400">Feasibility:</span> {telemetry.feasibilityStatus}
                </span>
              )}
            </div>
          )}

          {/* Scene Fallback Alert Banner (when beat was skipped due to scene fallback) */}
          {telemetry?.status === "scene_fallback" && (
            <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-2 text-xs text-amber-900 flex items-start gap-1.5 shadow-2xs">
              <span className="text-xs shrink-0 mt-0.5">⚠️</span>
              <div>
                <span className="font-bold">Scene-Level Fallback: </span>
                <span>
                  Individual beat animation skipped ({telemetry.beatFallbackReason || telemetry.fallbackReason || "Reverted to scene-level animation"}).
                </span>
              </div>
            </div>
          )}

          {/* Stale Render Alert Banner */}
          {telemetry?.status === "stale" && (
            <div className="rounded-lg bg-purple-50/80 border border-purple-200 p-2 text-xs text-purple-900 flex items-start gap-1.5 shadow-2xs">
              <span className="text-xs shrink-0 mt-0.5">🔄</span>
              <div>
                <span className="font-bold">Stale Render: </span>
                <span>Render telemetry is outdated because an upstream step was revised.</span>
              </div>
            </div>
          )}

          {/* Camera Angle, Technique, and Focal Point */}
          {hasFramingMeta && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              {beat.camera_angle && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                  <span className="text-slate-400">Angle:</span> {beat.camera_angle}
                </span>
              )}
              {beat.visual_technique && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                  <span className="text-slate-400">Technique:</span> {beat.visual_technique}
                </span>
              )}
              {beat.focal_point && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                  <span className="text-slate-400">Focal:</span> {beat.focal_point}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
