"use client";

import { useEffect, useState } from "react";
import type { StoryboardScene, VoiceoverItem, VoiceoverMeta } from "@/lib/types";
import { SceneAudioPlayer } from "./AuthenticatedAudio";
import { CollapsibleJson } from "./CollapsibleJson";

interface VoiceoverOutputViewProps {
  videoId: string;
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  isRunning?: boolean;
  storyboardScenes?: StoryboardScene[];
}

interface ValidatedVoiceoverOutput {
  items: VoiceoverItem[];
  complete: boolean;
  total_duration_seconds: number;
  warnings: string[];
  meta?: VoiceoverMeta;
  mock?: boolean;
}

/**
 * Defensively parses and validates the output from the voiceover step.
 * Supports standard wrapped { voiceover: { items: [...], complete: ... } }
 * as well as direct items array or flat shapes.
 */
function parseAndValidateVoiceover(output: unknown): ValidatedVoiceoverOutput | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  const o = output as Record<string, unknown>;

  let rawItems: unknown[] | null = null;
  let complete = false;
  let total_duration_seconds = 0;

  if (o.voiceover && typeof o.voiceover === "object" && !Array.isArray(o.voiceover)) {
    const voObj = o.voiceover as Record<string, unknown>;
    if (Array.isArray(voObj.items)) {
      rawItems = voObj.items;
    }
    complete = Boolean(voObj.complete);
    if (typeof voObj.total_duration_seconds === "number" && Number.isFinite(voObj.total_duration_seconds)) {
      total_duration_seconds = voObj.total_duration_seconds;
    }
  } else if (Array.isArray(o.voiceover)) {
    rawItems = o.voiceover;
  } else if (Array.isArray(o.items)) {
    rawItems = o.items;
  }

  if (typeof o.duration_seconds === "number" && Number.isFinite(o.duration_seconds)) {
    total_duration_seconds = o.duration_seconds;
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
    const file = typeof it.file === "string" ? it.file : null;
    const duration_seconds =
      typeof it.duration_seconds === "number" && Number.isFinite(it.duration_seconds)
        ? it.duration_seconds
        : 0;
    const latency_seconds =
      typeof it.latency_seconds === "number" && Number.isFinite(it.latency_seconds)
        ? it.latency_seconds
        : 0;
    const status = typeof it.status === "string" ? it.status : "ok";
    const reused = Boolean(it.reused);
    const audio_hash = typeof it.audio_hash === "string" ? it.audio_hash : "";

    validItems.push({
      index: idx,
      narration,
      file,
      duration_seconds,
      latency_seconds,
      status,
      reused,
      audio_hash,
    });
  }

  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === "string")
    : [];

  const meta =
    o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as VoiceoverMeta)
      : undefined;

  const mock = Boolean(o.mock || meta?.mock);

  return {
    items: validItems,
    complete,
    total_duration_seconds,
    warnings,
    meta,
    mock,
  };
}

export function VoiceoverOutputView({
  videoId,
  output,
  isMock,
  isStale = false,
  isRunning = false,
  storyboardScenes = [],
}: VoiceoverOutputViewProps) {
  const parsed = parseAndValidateVoiceover(output);
  const [activePlayingIndex, setActivePlayingIndex] = useState<number | null>(null);
  const [isPlayAllActive, setIsPlayAllActive] = useState(false);

  // Stop playback when component unmounts
  useEffect(() => {
    return () => {
      setActivePlayingIndex(null);
      setIsPlayAllActive(false);
    };
  }, []);

  if (!parsed || (parsed.items.length === 0 && !isRunning)) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500 italic">No audio scenes available yet.</p>
        <CollapsibleJson data={output} mock={isMock} defaultOpen={false} label="Raw voiceover payload" />
      </div>
    );
  }

  const items = parsed.items;
  const scenesCount = Math.max(items.length, storyboardScenes.length);

  // Merge storyboard scenes with voiceover items for rich narration display
  const displayScenes = Array.from({ length: scenesCount }, (_, i) => {
    const sceneIndex = i + 1;
    const voItem = items.find((it) => it.index === sceneIndex);
    const sbScene = storyboardScenes.find((s) => s.index === sceneIndex);
    return {
      index: sceneIndex,
      narration: voItem?.narration || sbScene?.narration || `Scene ${sceneIndex}`,
      duration_seconds: voItem?.duration_seconds || sbScene?.est_seconds || 0,
      status: voItem?.status || (isRunning ? "pending" : "ok"),
      reused: voItem?.reused || false,
      audio_hash: voItem?.audio_hash,
      hasFile: Boolean(voItem?.file),
    };
  });

  const okItems = items.filter((it) => it.status === "ok" && it.file);
  const totalDuration =
    parsed.total_duration_seconds ||
    okItems.reduce((acc, it) => acc + (it.duration_seconds || 0), 0);

  // Play All sequence handler: when a scene finishes, advance to the next playable scene
  const handleSceneEnded = (currentIndex: number) => {
    if (!isPlayAllActive) {
      setActivePlayingIndex(null);
      return;
    }

    // Find next available scene that has generated audio
    const nextPlayable = displayScenes.find(
      (s) => s.index > currentIndex && s.status === "ok" && s.hasFile
    );

    if (nextPlayable) {
      setActivePlayingIndex(nextPlayable.index);
    } else {
      // Completed all scenes
      setActivePlayingIndex(null);
      setIsPlayAllActive(false);
    }
  };

  const handleTogglePlayAll = () => {
    if (isPlayAllActive) {
      // Stop Play All
      setIsPlayAllActive(false);
      setActivePlayingIndex(null);
    } else {
      // Start Play All from first playable scene
      const firstPlayable = displayScenes.find((s) => s.status === "ok" && s.hasFile);
      if (firstPlayable) {
        setIsPlayAllActive(true);
        setActivePlayingIndex(firstPlayable.index);
      }
    }
  };

  const voiceName = parsed.meta?.voice || "af_heart";
  const speed = parsed.meta?.speed ? `${parsed.meta.speed}x` : "1.0x";
  const provider = parsed.meta?.provider || (isMock ? "mock" : "kokoro");
  const model = parsed.meta?.model || (isMock ? "Mock TTS" : "kokoro-82m");

  return (
    <div className="space-y-6">
      {/* Stale Warning Banner */}
      {isStale && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 flex items-start gap-3">
          <span className="text-lg">⏳</span>
          <div>
            <p className="font-bold text-amber-950">Voiceover Output Outdated</p>
            <p className="mt-0.5 text-amber-900">
              An earlier step was modified. These audio tracks will be regenerated when you advance the pipeline.
            </p>
          </div>
        </div>
      )}

      {/* Telemetry Summary Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎙️</span>
              <h3 className="text-base font-bold text-slate-900">Kokoro Voiceover Narration</h3>
              {parsed.mock && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                  Mock Audio
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Natural speech synthesis synced scene-by-scene for 9:16 short video timing.
            </p>
          </div>

          {/* Sequential Play All Button */}
          {okItems.length > 0 && (
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlayAll}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer ${
                  isPlayAllActive
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                <span>{isPlayAllActive ? "❚❚" : "▶"}</span>
                <span>{isPlayAllActive ? "Pause Sequential Audio" : "Play All Scenes"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Telemetry Chips */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Total Duration
            </span>
            <span className="text-sm font-bold text-indigo-600">
              {totalDuration.toFixed(1)}s
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
              Scenes Ready
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

      {/* Scene by Scene Narration & Audio Players */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
          <span>Scene Narrations ({displayScenes.length})</span>
          <span>Audio Playback</span>
        </div>

        {displayScenes.map((scene) => {
          const isCurrentActive = activePlayingIndex === scene.index;

          return (
            <div
              key={scene.index}
              className={`rounded-xl border p-4 bg-white shadow-2xs transition duration-150 ${
                isCurrentActive
                  ? "border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/20"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Scene Info & Narration */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                      {scene.index}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      Scene {scene.index}
                    </span>
                    {scene.duration_seconds > 0 && (
                      <span className="text-[11px] font-mono font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {scene.duration_seconds.toFixed(1)}s
                      </span>
                    )}
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

                {/* Inline Audio Player for this scene */}
                <div className="w-full md:w-80 shrink-0">
                  <SceneAudioPlayer
                    videoId={videoId}
                    sceneIndex={scene.index}
                    audioHash={scene.audio_hash}
                    durationSeconds={scene.duration_seconds}
                    isPlaying={isCurrentActive}
                    status={scene.status}
                    hasFile={scene.hasFile}
                    onPlayToggle={(shouldPlay) => {
                      if (shouldPlay) {
                        setIsPlayAllActive(false);
                        setActivePlayingIndex(scene.index);
                      } else {
                        if (activePlayingIndex === scene.index) {
                          setActivePlayingIndex(null);
                        }
                      }
                    }}
                    onEnded={() => handleSceneEnded(scene.index)}
                    onError={() => {
                      if (isPlayAllActive) {
                        handleSceneEnded(scene.index);
                      }
                    }}
                  />
                </div>
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
