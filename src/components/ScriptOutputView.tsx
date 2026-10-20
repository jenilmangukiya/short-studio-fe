"use client";

import { useState } from "react";
import type { ScriptStepOutput } from "@/lib/types";

interface ScriptOutputViewProps {
  output: unknown;
}

export function ScriptOutputView({ output }: ScriptOutputViewProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!output || typeof output !== "object") {
    return (
      <div className="text-xs text-slate-400 italic py-2">
        No script output data available.
      </div>
    );
  }

  const typedOutput = output as ScriptStepOutput;
  // Handle both standard nested { script: { ... } } and potential flat shapes { title, hook, ... }
  const script = typedOutput.script || (typedOutput as Record<string, unknown>);
  const title = typeof script.title === "string" ? script.title : null;
  const hook = typeof script.hook === "string" ? script.hook : null;
  const narration = typeof script.narration === "string" ? script.narration : null;
  const angle = typeof script.angle === "string" ? script.angle : null;
  const hashtags = Array.isArray(script.hashtags) ? (script.hashtags as string[]) : [];
  const claims = Array.isArray(script.claims_to_verify) ? (script.claims_to_verify as string[]) : [];
  const warnings = Array.isArray(typedOutput.warnings) ? (typedOutput.warnings as string[]) : [];
  const meta = typedOutput.meta;

  const narrationWordCount = narration
    ? narration.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Warnings Box if non-empty */}
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

      {/* Script Main Content */}
      <div className="space-y-3.5 bg-white rounded-lg border border-slate-200 p-4">
        {/* Title & Angle */}
        <div>
          {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
          {angle && (
            <p className="text-xs text-indigo-700 font-medium mt-1">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                Angle:{" "}
              </span>
              {angle}
            </p>
          )}
        </div>

        {/* Hook */}
        {hook && (
          <div className="rounded-md bg-indigo-50/70 border border-indigo-100 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">
              Hook (Opening 3 Seconds)
            </span>
            <p className="text-sm font-medium text-indigo-950 italic">&ldquo;{hook}&rdquo;</p>
          </div>
        )}

        {/* Narration with Live Word Count */}
        {narration && (
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Narration Script
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700">
                {narrationWordCount} words (~{Math.round(narrationWordCount / 2.5)}s speaking time)
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-serif">
              {narration}
            </p>
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Hashtags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Claims to Verify */}
        {claims.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Claims To Verify ({claims.length})
            </span>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {claims.map((claim, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">🔍</span>
                  <span>{claim}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Meta Section */}
      {meta && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-700 mb-2 flex items-center justify-between">
            <span>Model & Generation Metadata</span>
            {meta.provider && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                {meta.provider} : {meta.model || "default"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block">Latency:</span>
              <span className="font-medium text-slate-800">
                {meta.latency_seconds !== undefined ? `${meta.latency_seconds.toFixed(2)}s` : "N/A"}
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
          </div>
        </div>
      )}

      {/* Raw Toggle fallback */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="text-[11px] font-mono text-slate-400 hover:text-slate-600 underline cursor-pointer"
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
  );
}
