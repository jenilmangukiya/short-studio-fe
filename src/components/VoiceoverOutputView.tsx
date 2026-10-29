"use client";

import { useState } from "react";
import type { StepStatus, StoryboardScene, VoiceoverItem, VoiceoverMeta } from "@/lib/types";
import { NarrationAudioPlayer, type NarrationSeekRequest } from "./AuthenticatedAudio";
import { CollapsibleJson } from "./CollapsibleJson";

interface VoiceoverOutputViewProps {
  videoId: string;
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  isRunning?: boolean;
  stepStatus?: StepStatus | string;
  finishedAt?: string | null;
  storyboardScenes?: StoryboardScene[];
}

interface ValidatedVoiceoverOutput {
  continuous: boolean;
  audio_file: string | null;
  narration_script: string;
  audio_hash: string;
  items: VoiceoverItem[];
  complete: boolean;
  total_duration_seconds: number;
  warnings: string[];
  meta?: VoiceoverMeta;
  mock?: boolean;
  error?: string | null;
}

/**
 * Defensively parses and validates the output from the continuous voiceover step.
 * Supports wrapped { voiceover: { continuous: true, audio_file, items, ... } }
 * as well as top-level fields.
 */
function parseAndValidateVoiceover(output: unknown): ValidatedVoiceoverOutput | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  const o = output as Record<string, unknown>;

  let rawItems: unknown[] | null = null;
  let complete = false;
  let total_duration_seconds = 0;
  let audio_file: string | null = null;
  let narration_script = "";
  let audio_hash = "";
  let continuous = true;
  let error: string | null = typeof o.error === "string" ? o.error : null;

  if (o.voiceover && typeof o.voiceover === "object" && !Array.isArray(o.voiceover)) {
    const voObj = o.voiceover as Record<string, unknown>;
    if (Array.isArray(voObj.items)) {
      rawItems = voObj.items;
    }
    complete = Boolean(voObj.complete);
    if (typeof voObj.continuous === "boolean") {
      continuous = voObj.continuous;
    }
    if (
      typeof voObj.total_duration_seconds === "number" &&
      Number.isFinite(voObj.total_duration_seconds)
    ) {
      total_duration_seconds = voObj.total_duration_seconds;
    }
    if (typeof voObj.audio_file === "string" && voObj.audio_file.trim()) {
      audio_file = voObj.audio_file.trim();
    }
    if (typeof voObj.narration_script === "string") {
      narration_script = voObj.narration_script;
    }
    if (typeof voObj.audio_hash === "string") {
      audio_hash = voObj.audio_hash;
    }
    if (!error && typeof voObj.error === "string") {
      error = voObj.error;
    }
  } else if (Array.isArray(o.voiceover)) {
    rawItems = o.voiceover;
  } else if (Array.isArray(o.items)) {
    rawItems = o.items;
  }

  if (typeof o.duration_seconds === "number" && Number.isFinite(o.duration_seconds)) {
    total_duration_seconds = o.duration_seconds;
  }
  if (!audio_file && typeof o.audio_file === "string" && o.audio_file.trim()) {
    audio_file = o.audio_file.trim();
  }
  if (!audio_file && typeof o.file === "string" && o.file.trim()) {
    audio_file = o.file.trim();
  }
  if (!narration_script && typeof o.narration_script === "string") {
    narration_script = o.narration_script;
  }
  if (!audio_hash && typeof o.audio_hash === "string") {
    audio_hash = o.audio_hash;
  }

  const meta =
    o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as VoiceoverMeta)
      : undefined;

  if (!audio_file && typeof meta?.audio_file === "string" && meta.audio_file.trim()) {
    audio_file = meta.audio_file.trim();
  }
  if (!audio_hash && typeof meta?.audio_hash === "string") {
    audio_hash = meta.audio_hash;
  }

  if (!rawItems) {
    return null;
  }

  const validItems: VoiceoverItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const it = raw as Record<string, unknown>;

    let idx = i + 1;
    if (typeof it.index === "number" && Number.isFinite(it.index)) {
      idx = it.index;
    } else if (typeof it.index === "string" && !isNaN(Number(it.index))) {
      idx = Number(it.index);
    }

    const narration = typeof it.narration === "string" ? it.narration : "";
    const start_time =
      typeof it.start_time === "number" && Number.isFinite(it.start_time)
        ? it.start_time
        : undefined;
    const end_time =
      typeof it.end_time === "number" && Number.isFinite(it.end_time)
        ? it.end_time
        : undefined;
    const duration_seconds =
      typeof it.duration_seconds === "number" && Number.isFinite(it.duration_seconds)
        ? it.duration_seconds
        : start_time !== undefined && end_time !== undefined && end_time > start_time
        ? Number((end_time - start_time).toFixed(3))
        : 0;
    const timing_type = typeof it.timing_type === "string" ? it.timing_type : "estimated";
    const latency_seconds =
      typeof it.latency_seconds === "number" && Number.isFinite(it.latency_seconds)
        ? it.latency_seconds
        : 0;
    const status = typeof it.status === "string" ? it.status : "ok";
    const reused = Boolean(it.reused);
    const itemHash = typeof it.audio_hash === "string" ? it.audio_hash : audio_hash;
    const itemError = typeof it.error === "string" ? it.error : null;

    validItems.push({
      index: idx,
      narration,
      start_time,
      end_time,
      duration_seconds,
      timing_type,
      latency_seconds,
      status,
      reused,
      audio_hash: itemHash,
      error: itemError,
    });
  }

  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === "string")
    : [];

  const mock = Boolean(o.mock || meta?.mock);

  return {
    continuous,
    audio_file,
    narration_script,
    audio_hash,
    items: validItems,
    complete,
    total_duration_seconds,
    warnings,
    meta,
    mock,
    error,
  };
}

export function VoiceoverOutputView({
  videoId,
  output,
  isMock,
  isStale = false,
  isRunning = false,
  stepStatus,
  finishedAt,
  storyboardScenes = [],
}: VoiceoverOutputViewProps) {
  const parsed = parseAndValidateVoiceover(output);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [seekRequest, setSeekRequest] = useState<NarrationSeekRequest | null>(null);

  if (!parsed || (parsed.items.length === 0 && !parsed.audio_file && !isRunning)) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500 italic">No continuous narration audio available yet.</p>
        <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw voiceover payload" />
      </div>
    );
  }

  const items = parsed.items;
  const scenesCount = Math.max(items.length, storyboardScenes.length);

  // Merge storyboard scenes with voiceover timing metadata purely
  interface DisplaySceneItem {
    index: number;
    narration: string;
    start_time: number;
    end_time: number;
    duration_seconds: number;
    timing_type: string;
    status: string;
    reused: boolean;
  }

  const displayScenes = Array.from({ length: scenesCount }, (_, i) => i + 1).reduce<
    DisplaySceneItem[]
  >((acc, sceneIndex) => {
    const prevEnd = acc.length > 0 ? acc[acc.length - 1].end_time : 0;
    const voItem = items.find((it) => it.index === sceneIndex);
    const sbScene = storyboardScenes.find((s) => s.index === sceneIndex);
    const dur = voItem?.duration_seconds || sbScene?.est_seconds || 0;
    const startTime =
      typeof voItem?.start_time === "number" ? voItem.start_time : prevEnd;
    const endTime =
      typeof voItem?.end_time === "number" ? voItem.end_time : startTime + dur;

    acc.push({
      index: sceneIndex,
      narration: voItem?.narration || sbScene?.narration || `Scene ${sceneIndex}`,
      start_time: startTime,
      end_time: endTime,
      duration_seconds: dur,
      timing_type: voItem?.timing_type || "estimated",
      status: voItem?.status || (isRunning ? "pending" : "ok"),
      reused: voItem?.reused || false,
    });
    return acc;
  }, []);

  const okItems = items.filter((it) => it.status === "ok");
  const totalDuration =
    parsed.total_duration_seconds ||
    okItems.reduce((acc, it) => acc + (it.duration_seconds || 0), 0);

  const hasAudioFile =
    Boolean(parsed.audio_file) &&
    parsed.complete &&
    stepStatus !== "pending" &&
    stepStatus !== "failed";

  const isReused =
    Boolean(parsed.meta?.scenes_reused && parsed.meta.scenes_reused > 0) ||
    (okItems.length > 0 && okItems.every((it) => it.reused));

  const voiceName = parsed.meta?.voice || "af_heart";
  const speed = parsed.meta?.speed ? `${parsed.meta.speed}x` : "1.0x";
  const provider = parsed.meta?.provider || (isMock ? "mock" : "kokoro");
  const model = parsed.meta?.model || (isMock ? "Mock TTS" : "kokoro-82m");
  const versionKey = `${finishedAt || "v0"}:${parsed.total_duration_seconds}`;

  const handleJumpToScene = (startTime: number, endTime: number) => {
    if (!hasAudioFile || isRunning || isStale) return;
    setSeekRequest((prev) => ({
      time: startTime,
      endTime,
      autoPlay: true,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Stale Warning Banner */}
      {isStale && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 flex items-start gap-3">
          <span className="text-lg">⏳</span>
          <div>
            <p className="font-bold text-amber-950">Voiceover Output Outdated</p>
            <p className="mt-0.5 text-amber-900">
              An earlier step was modified. Continuous narration audio will be regenerated when you advance the pipeline.
            </p>
          </div>
        </div>
      )}

      {/* Telemetry & Continuous Narration Player Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xl">🎙️</span>
              <h3 className="text-base font-bold text-slate-900">
                Continuous Voiceover Narration
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                Single Track WAV
              </span>
              {isReused && !isRunning && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  Cached
                </span>
              )}
              {parsed.mock && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                  Mock Audio
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Synthesized as one seamless continuous narration track with scene timing mapping for video rendering and forced-aligned subtitles.
            </p>
          </div>
        </div>

        {/* Canonical Continuous Narration Player */}
        <NarrationAudioPlayer
          videoId={videoId}
          audioHash={parsed.audio_hash}
          versionKey={versionKey}
          durationSeconds={totalDuration}
          hasAudioFile={hasAudioFile}
          isRunning={isRunning}
          isStale={isStale}
          seekRequest={seekRequest}
          onTimeUpdate={(time, playing) => {
            setPlaybackTime(time);
            setIsAudioPlaying(playing);
          }}
          onEnded={() => {
            setPlaybackTime(0);
            setIsAudioPlaying(false);
          }}
        />

        {/* Telemetry Chips */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Total Duration
            </span>
            <span className="text-sm font-bold text-indigo-600">
              {totalDuration > 0 ? `${totalDuration.toFixed(1)}s` : "—"}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Voice & Speed
            </span>
            <span className="font-semibold text-slate-800 truncate block">
              {voiceName} ({speed})
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Provider / Model
            </span>
            <span className="font-semibold text-slate-800 truncate block capitalize">
              {provider} ({model})
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Scenes Mapped
            </span>
            <span className="font-semibold text-emerald-600">
              {okItems.length} of {scenesCount}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings Banner if any */}
      {parsed.warnings && parsed.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-amber-950">
            <span>⚠️</span> Soft-Check Warnings:
          </span>
          <ul className="list-disc pl-5 space-y-0.5">
            {parsed.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Scene-by-Scene Narration & Timing Windows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
          <span>Scene Narration & Timing Map ({displayScenes.length})</span>
          <span>Continuous Track Window</span>
        </div>

        {displayScenes.map((scene) => {
          const isCurrentSceneActive =
            isAudioPlaying &&
            playbackTime >= scene.start_time &&
            playbackTime < scene.end_time;

          return (
            <div
              key={scene.index}
              className={`rounded-xl border p-4 bg-white shadow-2xs transition duration-150 ${
                isCurrentSceneActive
                  ? "border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/20"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Scene Info & Narration */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                      {scene.index}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      Scene {scene.index}
                    </span>
                    {scene.duration_seconds > 0 && (
                      <span className="text-[11px] font-mono font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {scene.start_time.toFixed(1)}s &rarr; {scene.end_time.toFixed(1)}s ({scene.duration_seconds.toFixed(1)}s)
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        scene.timing_type === "aligned"
                          ? "text-indigo-700 bg-indigo-50 border-indigo-200"
                          : "text-slate-600 bg-slate-50 border-slate-200"
                      }`}
                    >
                      {scene.timing_type === "aligned" ? "Aligned" : "Est. Window"}
                    </span>
                    {scene.reused && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Cached
                      </span>
                    )}
                    {scene.status === "failed" && (
                      <span className="text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                        Failed
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-800 font-medium leading-relaxed italic">
                    &ldquo;{scene.narration}&rdquo;
                  </p>
                </div>

                {/* Jump to Scene Timestamp in Continuous Narration */}
                {hasAudioFile && !isRunning && !isStale && scene.duration_seconds > 0 && (
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleJumpToScene(scene.start_time, scene.end_time)}
                      aria-label={`Jump to Scene ${scene.index} in continuous narration (${scene.start_time.toFixed(1)}s)`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        isCurrentSceneActive
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200 hover:border-indigo-200"
                      }`}
                    >
                      <span>▶</span>
                      <span className="font-mono">{scene.start_time.toFixed(1)}s</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw Payload Inspector */}
      <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw voiceover payload" />
    </div>
  );
}
