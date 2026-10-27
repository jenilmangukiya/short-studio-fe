"use client";

import { useState } from "react";
import type { ScriptStepOutput } from "@/lib/types";

interface ScriptOutputViewProps {
  output: unknown;
  onSave?: (updated: { title?: string; hook?: string; narration?: string }) => Promise<void>;
  isSaving?: boolean;
}

export function ScriptOutputView({ output, onSave, isSaving }: ScriptOutputViewProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editHook, setEditHook] = useState("");
  const [editNarration, setEditNarration] = useState("");

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
  const title = typeof script.title === "string" ? script.title : "";
  const hook = typeof script.hook === "string" ? script.hook : "";
  const narration = typeof script.narration === "string" ? script.narration : "";
  const angle = typeof script.angle === "string" ? script.angle : null;
  const hashtags = Array.isArray(script.hashtags) ? (script.hashtags as string[]) : [];
  const claims = Array.isArray(script.claims_to_verify) ? (script.claims_to_verify as string[]) : [];
  const warnings = Array.isArray(typedOutput.warnings) ? (typedOutput.warnings as string[]) : [];
  const meta = typedOutput.meta;

  const startEdit = () => {
    setEditTitle(title);
    setEditHook(hook);
    setEditNarration(narration);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!onSave) return;
    await onSave({
      title: editTitle.trim(),
      hook: editHook.trim(),
      narration: editNarration.trim(),
    });
    setIsEditing(false);
  };

  const narrationWordCount = narration
    ? narration.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const editWordCount = editNarration
    ? editNarration.trim().split(/\s+/).filter(Boolean).length
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
        {/* Header Action Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Script Content
          </span>
          {onSave && !isEditing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition cursor-pointer shadow-2xs"
            >
              <span>✎</span>
              <span>Edit Script</span>
            </button>
          )}
        </div>

        {/* View Mode */}
        {!isEditing ? (
          <>
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
          </>
        ) : (
          /* Inline Edit Mode */
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-3 text-xs text-indigo-900 flex items-center justify-between">
              <span>Inline Editing Mode: Modifying script narration or hook will mark downstream steps stale.</span>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Hook Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Hook (Opening 3 Seconds)
              </label>
              <input
                type="text"
                value={editHook}
                onChange={(e) => setEditHook(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Narration Textarea with Live Counter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Narration Script
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  {editWordCount} words (~{Math.round(editWordCount / 2.5)}s)
                </span>
              </div>
              <textarea
                rows={6}
                value={editNarration}
                onChange={(e) => setEditNarration(e.target.value)}
                className="w-full px-3 py-2 text-sm font-serif leading-relaxed rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Edit Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isSaving ? "Saving Revision..." : "Save Revision"}
              </button>
            </div>
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && !isEditing && (
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
        {claims.length > 0 && !isEditing && (
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
