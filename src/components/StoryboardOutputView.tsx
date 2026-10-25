"use client";

import { useState } from "react";
import type { StoryboardMeta } from "@/lib/types";
import { CollapsibleJson } from "./CollapsibleJson";

interface StoryboardOutputViewProps {
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
}

interface ValidatedScene {
  index: number;
  narration: string;
  image_prompt: string;
  shot_type: string;
  est_seconds: number;
}

interface ValidatedStoryboard {
  visual_style: string;
  style_source: "channel" | "default";
  scenes: ValidatedScene[];
  total_seconds: number;
  warnings: string[];
  meta?: StoryboardMeta;
}

/**
 * Validates the storyboard output defensively.
 * Validates that each scene has narration, image_prompt, shot_type strings,
 * and a finite non-negative est_seconds number.
 * If total_seconds is missing or <= 0, recomputes it from the valid scenes.
 * Returns null if the shape is unrecognized or if no valid scenes remain.
 */
function parseAndValidateStoryboard(output: unknown): ValidatedStoryboard | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  const o = output as Record<string, unknown>;
  if (!o.storyboard || typeof o.storyboard !== "object" || Array.isArray(o.storyboard)) {
    return null;
  }

  const sb = o.storyboard as Record<string, unknown>;
  if (!Array.isArray(sb.scenes)) {
    return null;
  }

  const validScenes: ValidatedScene[] = [];
  for (let i = 0; i < sb.scenes.length; i++) {
    const raw = sb.scenes[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;

    const narration = typeof item.narration === "string" ? item.narration : null;
    const image_prompt = typeof item.image_prompt === "string" ? item.image_prompt : null;
    const shot_type = typeof item.shot_type === "string" ? item.shot_type : null;

    const estSec =
      typeof item.est_seconds === "number" && Number.isFinite(item.est_seconds) && item.est_seconds >= 0
        ? item.est_seconds
        : null;

    let idx = i + 1;
    if (typeof item.index === "number" && Number.isFinite(item.index)) {
      idx = item.index;
    } else if (typeof item.index === "string" && !isNaN(Number(item.index))) {
      idx = Number(item.index);
    }

    // Skip scenes with missing or invalid required fields
    if (narration === null || image_prompt === null || shot_type === null || estSec === null) {
      continue;
    }

    validScenes.push({
      index: idx,
      narration,
      image_prompt,
      shot_type,
      est_seconds: estSec,
    });
  }

  if (validScenes.length === 0) {
    return null;
  }

  // Compute total seconds if missing, zero, or invalid
  const rawTotal = sb.total_seconds;
  let totalSeconds =
    typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;

  if (totalSeconds <= 0) {
    totalSeconds = validScenes.reduce((sum, s) => sum + s.est_seconds, 0);
  }

  if (totalSeconds <= 0) {
    totalSeconds = 1; // Prevent zero-division edge cases
  }

  const visual_style = typeof sb.visual_style === "string" ? sb.visual_style : "";
  const style_source = sb.style_source === "channel" ? "channel" : "default";

  const warnings = Array.isArray(o.warnings)
    ? (o.warnings.filter((w) => typeof w === "string") as string[])
    : [];

  const meta =
    o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as StoryboardMeta)
      : undefined;

  return {
    visual_style,
    style_source,
    scenes: validScenes,
    total_seconds: totalSeconds,
    warnings,
    meta,
  };
}

export function StoryboardOutputView({
  output,
  isMock = false,
  isStale = false,
}: StoryboardOutputViewProps) {
  const [copyStatus, setCopyStatus] = useState<Record<string, "copied" | "failed">>({});
  const [showRaw, setShowRaw] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const parsed = parseAndValidateStoryboard(output);

  // If payload shape is not recognized or has no valid scenes, defensively fallback to CollapsibleJson
  if (!parsed) {
    return (
      <CollapsibleJson
        data={output}
        mock={isMock}
        defaultOpen={true}
        label="Storyboard payload (unrecognized shape)"
      />
    );
  }

  const { visual_style, style_source, scenes, total_seconds, warnings, meta } = parsed;

  const isOutsideRecommended = total_seconds < 45 || total_seconds > 60;

  const handleCopy = async (key: string, textToCopy: string) => {
    if (isStale) return;

    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus((prev) => ({ ...prev, [key]: "copied" }));
      setTimeout(() => {
        setCopyStatus((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 2000);
    } catch {
      setCopyStatus((prev) => ({ ...prev, [key]: "failed" }));
      setTimeout(() => {
        setCopyStatus((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 2500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Warnings Box (same appearance as in ScriptOutputView) */}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 p-3.5 text-xs text-amber-900">
          <div className="font-bold flex items-center gap-1.5 mb-1.5 text-amber-800">
            <span>⚠️</span> Generation Warnings ({warnings.length}):
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-800">
            {warnings.map((warning, idx) => (
              <li key={idx}>{String(warning)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-bold text-sm text-slate-900">
              {scenes.length} {scenes.length === 1 ? "Scene" : "Scenes"}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-sm text-indigo-700">
              {total_seconds.toFixed(1)} s
            </span>

            {/* Informational note when outside 45-60s recommended range */}
            {isOutsideRecommended && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <span>ℹ️</span> {total_seconds < 45 ? "Under recommended 45–60s" : "Over recommended 45–60s"}
              </span>
            )}
          </div>

          {/* Style Source Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">Style:</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                style_source === "channel"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {style_source === "channel" ? "Channel style" : "Default style"}
            </span>
          </div>
        </div>

        {/* Visual Style Text */}
        {visual_style && (
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Visual Direction
            </span>
            <p className="text-slate-700 leading-relaxed font-sans italic">&ldquo;{visual_style}&rdquo;</p>
          </div>
        )}

        {/* Segmented Timeline Bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 px-0.5">
            <span>Scene timeline share</span>
            <span>Hover or focus segment for duration</span>
          </div>

          <div
            role="progressbar"
            aria-label="Scene duration distribution"
            aria-valuemin={0}
            aria-valuemax={total_seconds}
            aria-valuenow={total_seconds}
            className="h-6 rounded-lg overflow-hidden flex w-full border border-slate-200 bg-slate-100 shadow-inner"
          >
            {scenes.map((scene, idx) => {
              const sharePercent = total_seconds > 0 ? (scene.est_seconds / total_seconds) * 100 : 0;
              // Hide segment label if too narrow to fit comfortably without clipping
              const showLabel = sharePercent >= 8;

              // Alternating indigo shades for clear visual boundary
              const segmentBg =
                idx % 2 === 0
                  ? "bg-indigo-600 hover:bg-indigo-500 focus:bg-indigo-500 text-white"
                  : "bg-indigo-500 hover:bg-indigo-400 focus:bg-indigo-400 text-white";

              return (
                <div
                  key={scene.index}
                  tabIndex={0}
                  style={{ width: `${sharePercent}%` }}
                  title={`Scene ${scene.index}: ${scene.est_seconds.toFixed(1)}s (${sharePercent.toFixed(1)}%)`}
                  className={`${segmentBg} h-full border-r border-indigo-700/30 last:border-r-0 flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-indigo-700 select-none overflow-hidden shrink-0`}
                >
                  {showLabel && <span>#{scene.index}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scene Cards in Sequential Order */}
      <div className="space-y-3.5">
        {scenes.map((scene) => (
          <div
            key={scene.index}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 transition hover:border-slate-300"
          >
            {/* Scene Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
                  {scene.index}
                </span>
                <span className="font-bold text-sm text-slate-800">Scene {scene.index}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {scene.shot_type}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ~{scene.est_seconds.toFixed(1)}s
                </span>
              </div>

              {/* Copy Action Buttons (Disabled when step is stale) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isStale}
                  onClick={() => handleCopy(`prompt-${scene.index}`, scene.image_prompt)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                >
                  {copyStatus[`prompt-${scene.index}`] === "copied" ? (
                    <span className="text-emerald-600 font-semibold">✓ Copied</span>
                  ) : copyStatus[`prompt-${scene.index}`] === "failed" ? (
                    <span className="text-red-600 font-semibold">✕ Copy failed</span>
                  ) : (
                    "Copy prompt"
                  )}
                </button>

                <button
                  type="button"
                  disabled={isStale}
                  onClick={() => {
                    const combined = visual_style
                      ? `${visual_style}, ${scene.image_prompt}`
                      : scene.image_prompt;
                    handleCopy(`style-${scene.index}`, combined);
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                >
                  {copyStatus[`style-${scene.index}`] === "copied" ? (
                    <span className="text-emerald-600 font-semibold">✓ Copied</span>
                  ) : copyStatus[`style-${scene.index}`] === "failed" ? (
                    <span className="text-red-600 font-semibold">✕ Copy failed</span>
                  ) : (
                    "Copy with style"
                  )}
                </button>
              </div>
            </div>

            {/* Narration */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Narration
              </span>
              <p className="text-xs text-slate-800 leading-relaxed font-serif whitespace-pre-wrap">
                {scene.narration}
              </p>
            </div>

            {/* Image Prompt in distinct container */}
            <div className="rounded-lg bg-slate-900 text-slate-100 p-3 text-xs font-mono border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">
                Image Prompt
              </span>
              <p className="leading-relaxed text-slate-200 whitespace-pre-wrap select-all">
                {scene.image_prompt}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Compact Collapsible Details Section with Meta */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer transition select-none text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Details & Metadata</span>
            {meta?.provider && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                {meta.provider} : {meta.model || "default"}
              </span>
            )}
          </div>
          <span className="text-slate-500 font-mono text-xs">
            {detailsOpen ? "▲ Hide details" : "▼ Show details"}
          </span>
        </button>

        {detailsOpen && (
          <div className="p-3.5 space-y-3 bg-white border-t border-slate-200">
            {meta ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Latency:</span>
                  <span className="font-medium text-slate-800">
                    {meta.latency_seconds !== undefined
                      ? `${meta.latency_seconds.toFixed(2)}s`
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tokens (In / Out):</span>
                  <span className="font-medium text-slate-800">
                    {meta.input_tokens ?? 0} / {meta.output_tokens ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Reasoning Tokens:</span>
                  <span className="font-medium text-slate-800">{meta.reasoning_tokens ?? 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Attempts:</span>
                  <span className="font-medium text-slate-800">{meta.attempts ?? 1}</span>
                </div>
                {meta.prompt_version && (
                  <div>
                    <span className="text-slate-400 block">Prompt Version:</span>
                    <span className="font-medium text-slate-800">{meta.prompt_version}</span>
                  </div>
                )}
                {meta.task && (
                  <div>
                    <span className="text-slate-400 block">Task:</span>
                    <span className="font-medium text-slate-800">{meta.task}</span>
                  </div>
                )}
                {meta.revision !== undefined && meta.revision !== null && (
                  <div>
                    <span className="text-slate-400 block">Revision:</span>
                    <span className="font-medium text-slate-800">
                      {meta.revision ? "true" : "false"}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 italic text-xs">No generation metadata available.</p>
            )}

            {/* Raw JSON toggle */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="text-[11px] font-mono text-slate-500 hover:text-slate-700 underline cursor-pointer"
              >
                {showRaw ? "Hide raw JSON" : "View raw output payload"}
              </button>
              {showRaw && (
                <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-60">
                  <pre>{JSON.stringify(output, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
