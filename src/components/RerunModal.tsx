"use client";

import { useState } from "react";

interface RerunModalProps {
  stepName: string;
  laterDoneCount: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (prompt?: string) => Promise<void>;
}

export function RerunModal({
  stepName,
  laterDoneCount,
  isOpen,
  onClose,
  onConfirm,
}: RerunModalProps) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(prompt.trim() || undefined);
      setPrompt("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rerun step.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-900">
            Rerun Step: <span className="capitalize text-indigo-600">{stepName}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Stale Warning Banner */}
        <div
          className={`mb-4 p-3 rounded-lg border text-xs ${
            laterDoneCount > 0
              ? "bg-amber-50 border-amber-300 text-amber-900"
              : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          {laterDoneCount > 0 ? (
            <div className="flex items-start gap-2">
              <span className="text-amber-600 font-bold text-sm">⚠️</span>
              <div>
                <p className="font-semibold text-amber-800">Pipeline Impact Notice</p>
                <p className="mt-0.5">
                  This will mark <span className="font-bold underline">{laterDoneCount}</span> later completed step{laterDoneCount > 1 ? "s" : ""} as stale.
                </p>
              </div>
            </div>
          ) : (
            <p>No later completed steps will be affected.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Revision Instruction / Prompt (Optional)
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Make the hook more suspenseful, or focus more on the scientific explanation..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Starting rerun..." : "Confirm & Rerun"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
