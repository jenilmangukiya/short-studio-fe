"use client";

import { useState } from "react";
import type { CreativeDirectionOutput, CreativeDirectionStepOutput } from "@/lib/types";
import { getHumanPresenceLabel } from "@/lib/types";

interface CreativeDirectionOutputViewProps {
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  visualStyleSnapshot?: Record<string, unknown> | null;
}

export function CreativeDirectionOutputView({
  output,
  isMock = false,
  isStale = false,
  visualStyleSnapshot,
}: CreativeDirectionOutputViewProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!output || typeof output !== "object") {
    return (
      <div className="text-xs text-slate-400 italic py-2">
        No creative direction data available.
      </div>
    );
  }

  const typedOutput = output as CreativeDirectionStepOutput;
  const cd = (typedOutput.creative_direction || typedOutput) as CreativeDirectionOutput;
  const warnings = Array.isArray(typedOutput.warnings) ? (typedOutput.warnings as string[]) : [];
  const meta = typedOutput.meta;

  const styleSnapshot =
    visualStyleSnapshot ||
    ((typedOutput as Record<string, unknown>)?.visual_style_snapshot as Record<string, unknown> | null | undefined);

  const styleDisplayName =
    typeof styleSnapshot?.display_name === "string" && styleSnapshot.display_name.trim()
      ? styleSnapshot.display_name.trim()
      : typeof styleSnapshot?.name === "string" && styleSnapshot.name.trim()
      ? styleSnapshot.name.trim()
      : typeof styleSnapshot?.id === "string" && styleSnapshot.id.trim()
      ? styleSnapshot.id.trim()
      : null;

  const protagonist = cd.protagonist_config || { human_presence: "none" };
  const humanPresenceLabel = getHumanPresenceLabel(protagonist.human_presence);

  const humanPresenceBadgeStyle =
    protagonist.human_presence === "none"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : protagonist.human_presence === "contextual"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : protagonist.human_presence === "single"
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : "bg-purple-50 text-purple-700 border-purple-200";

  return (
    <div className={`space-y-4 ${isStale ? "opacity-60" : ""}`}>
      {/* Warnings Box */}
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

      {/* Main Content Card */}
      <div className="space-y-4 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        {/* Top Badges: Format Archetype, Visual Style, Human Presence */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm text-slate-900">Creative Brief</span>
            {cd.format_archetype && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {cd.format_archetype.replace(/_/g, " ")}
              </span>
            )}
            {styleDisplayName && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100"
                title={
                  typeof styleSnapshot?.description === "string"
                    ? styleSnapshot.description
                    : `Visual Style: ${styleDisplayName}`
                }
              >
                <span>🎨</span>
                <span>{styleDisplayName}</span>
              </span>
            )}
          </div>

          {/* Human Presence Badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Human Presence:</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${humanPresenceBadgeStyle}`}
            >
              {humanPresenceLabel}
            </span>
          </div>
        </div>

        {/* Frozen Visual Style Snapshot (Single Source of Truth) */}
        {styleSnapshot && (
          <div className="rounded-lg bg-indigo-50/40 border border-indigo-100/80 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Visual Style (Frozen Snapshot)
              </span>
              {Boolean(styleSnapshot.category) && (
                <span className="text-[10px] font-medium text-indigo-600 capitalize">
                  {String(styleSnapshot.category).replace(/_/g, " ")}
                </span>
              )}
            </div>
            {styleDisplayName && (
              <p className="font-semibold text-slate-800 text-xs">{styleDisplayName}</p>
            )}
            {typeof styleSnapshot.description === "string" && styleSnapshot.description && (
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {styleSnapshot.description}
              </p>
            )}
          </div>
        )}

        {/* Narrative Core: Central Thesis & Storytelling Angle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {cd.central_thesis && (
            <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Central Thesis
              </span>
              <p className="text-slate-800 font-medium leading-relaxed">{cd.central_thesis}</p>
            </div>
          )}

          {cd.storytelling_angle && (
            <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-3 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block mb-1">
                Storytelling Angle
              </span>
              <p className="text-indigo-950 font-medium leading-relaxed">{cd.storytelling_angle}</p>
            </div>
          )}
        </div>

        {/* Tone & Protagonist Config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {cd.tone && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Tone
              </span>
              <p className="text-xs text-slate-700 leading-relaxed capitalize">{cd.tone}</p>
            </div>
          )}

          {protagonist.archetype_summary && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Character / Subject Archetype
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">{protagonist.archetype_summary}</p>
            </div>
          )}
        </div>

        {/* Emotional Progression Arc */}
        {cd.emotional_progression && cd.emotional_progression.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Emotional Progression Arc ({cd.emotional_progression.length} Beats)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {cd.emotional_progression.map((beat, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-slate-50 border border-slate-200/70 p-2 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      #{idx + 1} {beat.phase}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 text-[11px] truncate" title={beat.target_emotion}>
                    {beat.target_emotion}
                  </p>
                  {beat.visual_intent && (
                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-2" title={beat.visual_intent}>
                      {beat.visual_intent}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creative Constraints */}
        {cd.creative_constraints && cd.creative_constraints.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Creative Constraints ({cd.creative_constraints.length})
            </span>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
              {cd.creative_constraints.map((constraint, idx) => (
                <li key={idx} className="leading-relaxed">
                  {constraint}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Details & Metadata Accordion */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer transition select-none text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Details & Metadata</span>
            {isMock && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                Mock
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
                {typeof meta.latency_seconds === "number" && (
                  <div>
                    <span className="text-slate-400 block">Latency:</span>
                    <span className="font-medium text-slate-800">{meta.latency_seconds.toFixed(2)}s</span>
                  </div>
                )}
                {typeof meta.provider === "string" && (
                  <div>
                    <span className="text-slate-400 block">Provider:</span>
                    <span className="font-medium text-slate-800">{meta.provider}</span>
                  </div>
                )}
                {typeof meta.model === "string" && (
                  <div>
                    <span className="text-slate-400 block">Model:</span>
                    <span className="font-medium text-slate-800">{meta.model}</span>
                  </div>
                )}
                {typeof meta.prompt_version === "string" && (
                  <div>
                    <span className="text-slate-400 block">Prompt Version:</span>
                    <span className="font-medium text-slate-800">{meta.prompt_version}</span>
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
