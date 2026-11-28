"use client";

import { useState } from "react";
import type {
  CreativeDirectionOutput,
  CreativeDirectionStepOutput,
  NarrativeStage,
} from "@/lib/types";
import { getHumanPresenceLabel, getFormatArchetypeLabel } from "@/lib/types";

interface CreativeDirectionOutputViewProps {
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  visualStyleSnapshot?: Record<string, unknown> | null;
  durationMode?: "auto" | "manual";
  requestedDuration?: number | null;
}

export function CreativeDirectionOutputView({
  output,
  isMock = false,
  isStale = false,
  visualStyleSnapshot,
  durationMode,
  requestedDuration,
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

  const resolvedDuration = cd.resolved_target_duration ?? cd.recommended_duration_seconds;
  const recommendedDuration = cd.recommended_duration_seconds;
  const durationRationale = cd.duration_rationale;
  const narrativePlan = cd.narrative_plan;
  const stages = narrativePlan?.story_progression || narrativePlan?.stages || [];

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
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200"
                title={`Format Archetype: ${cd.format_archetype}`}
              >
                {getFormatArchetypeLabel(cd.format_archetype)}
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

        {/* Adaptive Duration Strategy Card */}
        {(resolvedDuration !== undefined || durationRationale) && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">⏱</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                  Adaptive Duration Strategy
                </span>
                {isStale && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Stale / Pending Rerun
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {typeof resolvedDuration === "number" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <span>Resolved Target:</span>
                    <span className="font-mono">{resolvedDuration}s</span>
                  </span>
                )}
                {typeof recommendedDuration === "number" &&
                  recommendedDuration !== resolvedDuration && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                      title="AI recommended duration before manual override"
                    >
                      <span>AI Rec:</span>
                      <span className="font-mono">{recommendedDuration}s</span>
                    </span>
                  )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
              {durationMode && (
                <span>
                  <strong>Requested:</strong>{" "}
                  {durationMode === "auto"
                    ? "Automatic (AI-determined)"
                    : `Manual (${requestedDuration ?? resolvedDuration}s)`}
                </span>
              )}
              {typeof resolvedDuration === "number" && (
                <span className="text-slate-400">
                  Approximate storytelling target for pacing and script structure, not an exact final video length.
                </span>
              )}
            </div>

            {durationRationale && (
              <div className="pt-1.5 border-t border-slate-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Duration Rationale
                </span>
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  &ldquo;{durationRationale}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

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

        {/* Storytelling Narrative Plan & Ordered Stages */}
        {narrativePlan && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">📖</span>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Storytelling Narrative Plan
                </span>
                {stages.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {stages.length} Stages
                  </span>
                )}
              </div>

              {/* Perspective and Strategy Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {narrativePlan.narrative_perspective && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                    title="Narrative perspective / vantage point"
                  >
                    <span>Vantage: </span>
                    <span className="font-semibold ml-1 capitalize">
                      {narrativePlan.narrative_perspective.replace(/_/g, " ")}
                    </span>
                  </span>
                )}
                {narrativePlan.information_revelation_strategy && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
                    title="Information revelation strategy"
                  >
                    <span>Revelation: </span>
                    <span className="font-semibold ml-1 capitalize">
                      {narrativePlan.information_revelation_strategy.replace(/_/g, " ")}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Opening Situation / Approach */}
            {(narrativePlan.opening_situation || narrativePlan.opening_approach) && (
              <div className="rounded-lg bg-amber-50/60 border border-amber-200/80 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[10px] uppercase tracking-wider">
                  <span>🎣</span> Opening Situation / Cold Open Hook
                </div>
                <p className="text-amber-950 font-medium leading-relaxed">
                  {narrativePlan.opening_situation || narrativePlan.opening_approach}
                </p>
              </div>
            )}

            {/* Ordered Narrative Stages Timeline */}
            {stages.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Narrative Progression Stages
                  </span>
                  <span className="text-[10px] text-slate-400 italic">
                    Storytelling guidance &middot; Not exact timestamps
                  </span>
                </div>

                <div className="space-y-2">
                  {stages.map((stage: NarrativeStage, idx: number) => {
                    const allocation =
                      stage.target_beat_percentage ?? stage.percentage_allocation;
                    const goal = stage.stage_goal || stage.story_beat_goal;
                    const emotionalTarget =
                      stage.emotional_target || stage.intellectual_target;

                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs space-y-2 transition hover:border-slate-300"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {stage.stage_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {stage.pacing && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
                                🏃 {stage.pacing}
                              </span>
                            )}
                            {typeof allocation === "number" && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"
                                title="Percentage allocation of storytelling focus (guidance, not timestamp)"
                              >
                                ~{allocation}% narrative share
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stage Description */}
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {stage.description}
                        </p>

                        {/* Stage Goals and Emotional/Intellectual Targets */}
                        {(goal || emotionalTarget) && (
                          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            {goal && (
                              <div className="rounded bg-slate-50 p-2 text-slate-700">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Stage Goal:
                                </span>
                                <span>{goal}</span>
                              </div>
                            )}
                            {emotionalTarget && (
                              <div className="rounded bg-purple-50/60 p-2 text-purple-900">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block mb-0.5">
                                  Emotional / Mindset Target:
                                </span>
                                <span>{emotionalTarget}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audience Takeaway and Resolution Payoff */}
            {(narrativePlan.audience_takeaway || narrativePlan.resolution_payoff) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {narrativePlan.audience_takeaway && (
                  <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/80 p-3 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                      💡 Audience Takeaway
                    </span>
                    <p className="text-emerald-950 font-medium leading-relaxed">
                      {narrativePlan.audience_takeaway}
                    </p>
                  </div>
                )}
                {narrativePlan.resolution_payoff && (
                  <div className="rounded-lg bg-indigo-50/60 border border-indigo-200/80 p-3 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">
                      🎯 Resolution Payoff
                    </span>
                    <p className="text-indigo-950 font-medium leading-relaxed">
                      {narrativePlan.resolution_payoff}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Creative Constraints */}
        {Array.isArray(cd.creative_constraints) && cd.creative_constraints.length > 0 && (
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
