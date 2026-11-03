"use client";

import { useMemo } from "react";
import type {
  RenderData,
  RenderMeta,
  StepOut,
  StepStatus,
  StoryboardScene,
  VoiceoverItem,
} from "@/lib/types";
import {
  correlateBeatsWithTelemetry,
  parseStepTimestamp,
  type BeatCorrelationResult,
} from "@/lib/storyboard";
import { VideoPlayer } from "./VideoPlayer";
import { CollapsibleJson } from "./CollapsibleJson";
import { StoryboardTimeline } from "./StoryboardTimeline";

interface RenderOutputViewProps {
  videoId: string;
  topic?: string;
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  isRunning?: boolean;
  stepStatus?: StepStatus | string;
  renderStep?: { finished_at?: string | null } | StepOut | null;
  finishedAt?: string | null;
  storyboardScenes?: StoryboardScene[];
  voiceoverItems?: VoiceoverItem[];
  correlation?: BeatCorrelationResult | null;
}

interface ValidatedRenderOutput {
  data: RenderData;
  meta?: RenderMeta;
  video_path?: string;
  duration_seconds?: number;
  warnings?: string[];
}

function parseAndValidateRender(output: unknown): ValidatedRenderOutput | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  const o = output as Record<string, unknown>;

  let renderData: RenderData = {};

  if (o.render && typeof o.render === "object" && !Array.isArray(o.render)) {
    renderData = o.render as RenderData;
  } else {
    renderData = {
      video_path: typeof o.video_path === "string" ? o.video_path : undefined,
      duration_seconds:
        typeof o.duration_seconds === "number" ? o.duration_seconds : undefined,
    };
  }

  const meta =
    o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as RenderMeta)
      : undefined;

  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === "string")
    : [];

  return {
    data: renderData,
    meta,
    video_path: renderData.video_path || (typeof o.video_path === "string" ? o.video_path : undefined),
    duration_seconds:
      renderData.duration_seconds ||
      (typeof o.duration_seconds === "number" ? o.duration_seconds : undefined),
    warnings,
  };
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function RenderOutputView({
  videoId,
  topic,
  output,
  isMock,
  isStale = false,
  isRunning = false,
  stepStatus,
  renderStep,
  finishedAt: propFinishedAt,
  storyboardScenes,
  voiceoverItems,
  correlation: propCorrelation,
}: RenderOutputViewProps) {
  const parsed = useMemo(() => parseAndValidateRender(output), [output]);
  const renderData = parsed?.data ?? null;

  const correlation = useMemo(() => {
    if (propCorrelation) return propCorrelation;
    if (!storyboardScenes || storyboardScenes.length === 0) return null;
    return correlateBeatsWithTelemetry({
      scenes: storyboardScenes,
      voiceoverItems,
      renderData,
      isRenderStale: isStale,
    });
  }, [propCorrelation, storyboardScenes, voiceoverItems, renderData, isStale]);

  const hasVideoPath = Boolean(parsed?.video_path || parsed?.data?.video_path);
  const isReady =
    (stepStatus === "done" ||
      stepStatus === "awaiting_approval" ||
      (!stepStatus && hasVideoPath)) &&
    !isRunning &&
    !isStale &&
    hasVideoPath;

  const rawFinishedAt =
    renderStep?.finished_at !== undefined
      ? renderStep.finished_at
      : propFinishedAt !== undefined
      ? propFinishedAt
      : (parsed?.meta as Record<string, unknown> | undefined)?.finished_at ??
        (output && typeof output === "object"
          ? ((output as Record<string, unknown>).finished_at as string | undefined) ??
            ((output as Record<string, unknown>).render as Record<string, unknown> | undefined)?.finished_at as string | undefined
          : undefined);

  const isTimestampVerified = parseStepTimestamp(rawFinishedAt) !== null;

  if (!parsed && !isRunning) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500 italic">No render data available yet.</p>
        <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw render payload" />
      </div>
    );
  }

  const render = parsed?.data || {};
  const meta = parsed?.meta;
  const resolution = render.resolution || meta?.resolution || "1080x1920";
  const fps = render.fps || meta?.fps || 30;
  const duration = render.duration_seconds || parsed?.duration_seconds || 0;
  const fileSize = render.file_size_bytes || meta?.file_size_bytes;
  const scenesCount = render.scenes_rendered || meta?.scenes_count;
  const codec = render.codec ? `${render.codec} / ${render.audio_codec || "aac"}` : "h264 / aac";

  return (
    <div className="space-y-6">
      {/* Stale Warning Banner */}
      {isStale && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 flex items-start gap-3">
          <span className="text-lg">⏳</span>
          <div>
            <p className="font-bold text-amber-950">Render Output Outdated</p>
            <p className="mt-0.5 text-amber-900">
              An earlier step was modified. This final video will be regenerated when you advance the pipeline.
            </p>
          </div>
        </div>
      )}

      {/* Telemetry Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <div>
              <h3 className="text-base font-bold text-slate-900">FFmpeg Video Render Output</h3>
              <p className="text-xs text-slate-500">
                Stitched 9:16 vertical short video with synchronized audio and faststart MP4 flags.
              </p>
            </div>
          </div>

          {isReady ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-center">
              ✓ 1080x1920 {isTimestampVerified ? "Ready" : "Ready (Unverified)"}
            </span>
          ) : isRunning ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse self-start sm:self-center">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
              Rendering in progress...
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300 self-start sm:self-center">
              Pending Render
            </span>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-100">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Duration
            </span>
            <span className="text-sm font-bold text-indigo-600">
              {duration > 0 ? `${duration.toFixed(1)}s` : "—"}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Resolution & FPS
            </span>
            <span className="font-semibold text-slate-800 truncate block">
              {resolution} @ {fps}fps
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              File Size
            </span>
            <span className="font-semibold text-slate-800 truncate block">
              {formatBytes(fileSize)}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Codec & Scenes
            </span>
            <span className="font-semibold text-slate-800 truncate block">
              {codec} {scenesCount ? `(${scenesCount} scenes)` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings if any */}
      {parsed?.warnings && parsed.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-amber-950">
            <span>⚠️</span> Render Warnings:
          </span>
          <ul className="list-disc pl-5 space-y-0.5">
            {parsed.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Storyboard & Render Execution Timeline */}
      {correlation ? (
        <StoryboardTimeline
          correlation={correlation}
          totalDurationSeconds={duration > 0 ? duration : undefined}
          title="Render Execution & Beat Timeline"
        />
      ) : renderData?.animations && renderData.animations.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-2 border-b border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span>🎬</span> Rendered Animations Telemetry ({renderData.animations.length})
            </h4>
            <span className="text-[11px] text-slate-400 italic">
              Storyboard structure unavailable; showing renderer records directly
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
            {renderData.animations.map((anim, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  Scene {anim.scene_index}
                  {anim.beat_order ? ` • Beat #${anim.beat_order}` : ""}
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                    {anim.animation_type}
                  </span>
                  {anim.frames && (
                    <span className="text-slate-500 font-mono text-[10px]">
                      {anim.frames}f
                    </span>
                  )}
                  {anim.beat_fallback_reason && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px]">
                      ⚠️ Fallback: {anim.beat_fallback_reason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Video Preview Card */}
      <div className="rounded-2xl border border-slate-200 bg-slate-900/5 p-6 flex flex-col items-center">
        <div className="w-full max-w-md text-center mb-4">
          <h4 className="text-sm font-bold text-slate-800">
            {isRunning ? "Render in Progress" : isReady ? "In-Browser Video Preview" : "Video Preview Pending"}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {isRunning
              ? "FFmpeg is processing video frames and voiceover in the background."
              : isReady
              ? "Full quality vertical short preview with audio synchronization."
              : "The video preview will appear here once the Render step completes."}
          </p>
        </div>

        <VideoPlayer
          videoId={videoId}
          topic={topic}
          showDownloadButton={true}
          isReady={isReady}
          isRendering={isRunning}
          isStale={isStale}
        />
      </div>

      {/* Raw Payload Inspector */}
      <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw render payload" />
    </div>
  );
}
