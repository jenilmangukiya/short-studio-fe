"use client";

import type { SubtitleData, SubtitleMeta, StepStatus } from "@/lib/types";
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
}: SubtitlesOutputViewProps) {
  const parsed = parseAndValidateSubtitles(output);

  const hasSegments = Boolean(parsed?.data?.segments && parsed.data.segments.length > 0);
  const isReady =
    (stepStatus === "done" || (!stepStatus && hasSegments)) &&
    !isRunning &&
    hasSegments;

  if (!parsed && !isRunning) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500 italic">No subtitle data available yet.</p>
        <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw subtitles payload" />
      </div>
    );
  }

  const subtitles = parsed?.data || { segments: [] };
  const meta = parsed?.meta;
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
              {timingSource === "scene_waveform" && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                  🔊 Scene Waveform
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

      {/* In-Browser Video Player with Subtitles */}
      <div className="rounded-2xl border border-slate-200 bg-slate-900/5 p-6 flex flex-col items-center">
        <div className="w-full max-w-md text-center mb-4">
          <h4 className="text-sm font-bold text-slate-800">
            {isRunning ? "Aligning Subtitles..." : isReady ? "Live Subtitle Playback Preview" : "Subtitle Preview Pending"}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Watch the video below to test real-time synchronized animated subtitles. Click the CC button to toggle.
          </p>
        </div>

        <VideoPlayer
          videoId={videoId}
          topic={topic}
          showDownloadButton={true}
          isReady={isReady}
          isRendering={isRunning}
          subtitlesVersion={alignmentHash}
          initialSubtitles={hasSegments ? subtitles : null}
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
