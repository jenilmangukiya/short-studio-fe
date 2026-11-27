"use client";

import { useState } from "react";
import type { VideoBibleOutput, VideoBibleStepOutput } from "@/lib/types";
import { getEnvironmentTypeLabel } from "@/lib/types";

interface VideoBibleOutputViewProps {
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
}

export function VideoBibleOutputView({
  output,
  isMock = false,
  isStale = false,
}: VideoBibleOutputViewProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!output || typeof output !== "object") {
    return (
      <div className="text-xs text-slate-400 italic py-2">
        No Video Bible output data available.
      </div>
    );
  }

  const typedOutput = output as VideoBibleStepOutput;
  const vb = (typedOutput.video_bible || typedOutput) as VideoBibleOutput;
  const warnings = Array.isArray(typedOutput.warnings) ? (typedOutput.warnings as string[]) : [];
  const meta = typedOutput.meta;

  const entities = vb.entities || {};
  const environments = entities.environments || [];
  const characters = entities.characters || [];
  const objects = entities.objects || [];
  const concepts = entities.concepts || [];
  const artDirection = vb.art_direction;

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

      {/* Main Video Bible Card */}
      <div className="space-y-4 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm text-slate-900">Video Bible (Production Blueprint)</span>
            {vb.bible_id && (
              <span className="font-mono text-[10px] text-slate-400">ID: {vb.bible_id}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>{environments.length} {environments.length === 1 ? "Env" : "Envs"}</span>
            <span>•</span>
            <span>{characters.length} {characters.length === 1 ? "Character" : "Characters"}</span>
            <span>•</span>
            <span>{objects.length} {objects.length === 1 ? "Object" : "Objects"}</span>
          </div>
        </div>

        {/* Topic Summary */}
        {vb.topic_summary && (
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Production Scope & Summary
            </span>
            <p className="text-slate-800 leading-relaxed">{vb.topic_summary}</p>
          </div>
        )}

        {/* Environments Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Environments & Settings ({environments.length})
            </span>
          </div>

          {environments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No environments defined.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {environments.map((env) => (
                <div
                  key={env.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{env.name}</h4>
                      <span className="font-mono text-[10px] text-slate-400">{env.id}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {env.environment_type && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {getEnvironmentTypeLabel(env.environment_type)}
                        </span>
                      )}
                      {env.time_of_day && env.time_of_day !== "unspecified" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                          {env.time_of_day.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {env.spatial_layout && (
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider">
                        Spatial Layout:
                      </span>
                      <p className="text-slate-700">{env.spatial_layout}</p>
                    </div>
                  )}

                  {env.lighting_setup && (
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider">
                        Lighting Setup:
                      </span>
                      <p className="text-slate-700">{env.lighting_setup}</p>
                    </div>
                  )}

                  {env.persistent_props && env.persistent_props.length > 0 && (
                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-1">
                        Persistent World Props:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {env.persistent_props.map((prop, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10px]"
                          >
                            {prop}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Characters Section (if any) */}
        {characters.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Characters & Protagonists ({characters.length})
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{char.name}</h4>
                      <span className="text-[10px] text-indigo-700 font-medium">{char.role}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">{char.id}</span>
                  </div>

                  {char.visual_anchor && (
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider">
                        Visual Anchor:
                      </span>
                      <p className="text-slate-700">{char.visual_anchor}</p>
                    </div>
                  )}

                  {char.apparel_anchor && (
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider">
                        Apparel & Clothing:
                      </span>
                      <p className="text-slate-700">{char.apparel_anchor}</p>
                    </div>
                  )}

                  {char.forbidden_mutations && char.forbidden_mutations.length > 0 && (
                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="font-semibold text-rose-600 block text-[10px] uppercase tracking-wider mb-1">
                        Forbidden Mutations:
                      </span>
                      <ul className="list-disc list-inside text-[10px] text-slate-600 space-y-0.5">
                        {char.forbidden_mutations.map((mut, mIdx) => (
                          <li key={mIdx}>{mut}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Objects and Concepts (if any) */}
        {(objects.length > 0 || concepts.length > 0) && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Objects & Props */}
            {objects.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Objects & Key Props ({objects.length})
                </span>
                <div className="space-y-1.5">
                  {objects.map((obj) => (
                    <div
                      key={obj.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{obj.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{obj.id}</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{obj.visual_description}</p>
                      {obj.material_and_finish && (
                        <p className="text-[10px] text-slate-400">
                          <span className="font-semibold">Finish:</span> {obj.material_and_finish}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concepts & Diagrams */}
            {concepts.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Concepts & Diagrams ({concepts.length})
                </span>
                <div className="space-y-1.5">
                  {concepts.map((cp) => (
                    <div
                      key={cp.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{cp.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{cp.id}</span>
                      </div>
                      <p className="text-slate-700 text-[11px] font-medium">{cp.concept_explained}</p>
                      {cp.visual_analogy && (
                        <p className="text-[10px] text-indigo-700 italic">
                          <span className="font-semibold">Analogy:</span> {cp.visual_analogy}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Art Direction Section */}
        {artDirection && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Art Direction & Aesthetic Constraints
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
              {artDirection.style_family && (
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Family:</span>
                  <span className="font-bold text-slate-800">{artDirection.style_family}</span>
                </div>
              )}
              {artDirection.visual_genre && (
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Genre:</span>
                  <span className="font-bold text-slate-800">{artDirection.visual_genre}</span>
                </div>
              )}
              {artDirection.rendering_texture && (
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Texture:</span>
                  <span className="font-medium text-slate-800">{artDirection.rendering_texture}</span>
                </div>
              )}
              {artDirection.lighting_philosophy && (
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Lighting:</span>
                  <span className="font-medium text-slate-800">{artDirection.lighting_philosophy}</span>
                </div>
              )}
            </div>

            {/* Primary Palette */}
            {artDirection.primary_palette_hex && artDirection.primary_palette_hex.length > 0 && (
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Palette:</span>
                <div className="flex items-center gap-1.5">
                  {artDirection.primary_palette_hex.map((hex, hIdx) => (
                    <span
                      key={hIdx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-mono text-slate-700 bg-white shadow-2xs"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <span>{hex}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
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
