"use client";

import type { RenderData, RenderMeta, StepStatus } from "@/lib/types";
import { VideoPlayer } from "./VideoPlayer";
import { CollapsibleJson } from "./CollapsibleJson";

interface RenderOutputViewProps {
  videoId: string;
  topic?: string;
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  isRunning?: boolean;
  stepStatus?: StepStatus | string;
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
}: RenderOutputViewProps) {
  const parsed = parseAndValidateRender(output);

  const hasVideoPath = Boolean(parsed?.video_path || parsed?.data?.video_path);
  const isReady =
    (stepStatus === "done" || (!stepStatus && hasVideoPath)) &&
    !isRunning &&
    hasVideoPath;

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
              ✓ 1080x1920 Ready
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
        />
      </div>

      {/* Raw Payload Inspector */}
      <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw render payload" />
    </div>
  );
}
