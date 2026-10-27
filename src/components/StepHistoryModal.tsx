"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { StepRevision } from "@/lib/types";

interface StepHistoryModalProps {
  stepName: string;
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
  onRollback: (stepName: string, version: number) => Promise<void>;
}

export function StepHistoryModal({
  stepName,
  videoId,
  isOpen,
  onClose,
  onRollback,
}: StepHistoryModalProps) {
  const [revisions, setRevisions] = useState<StepRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollingBackVer, setRollingBackVer] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const hist = await api.videos.getStepHistory(videoId, stepName);
        if (!isCancelled) {
          setRevisions(hist || []);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Failed to load version history.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchHistory();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, videoId, stepName]);

  if (!isOpen) return null;

  const handleRollback = async (version: number) => {
    const confirmed = window.confirm(
      `Rollback step "${stepName}" to version ${version}? Downstream steps will become stale and will need to be re-run.`
    );
    if (!confirmed) return;

    setError(null);
    setRollingBackVer(version);
    try {
      await onRollback(stepName, version);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed.");
    } finally {
      setRollingBackVer(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900">
              Version History: <span className="capitalize text-indigo-600">{stepName}</span>
            </span>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
              {revisions.length} {revisions.length === 1 ? "version" : "versions"}
            </span>
          </div>
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

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
              <p>Loading revisions...</p>
            </div>
          ) : revisions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No previous revisions recorded for this step yet.
            </div>
          ) : (
            revisions
              .slice()
              .reverse()
              .map((rev, idx) => {
                const isLatest = idx === 0;
                const formattedDate = rev.created_at
                  ? new Date(rev.created_at).toLocaleString()
                  : "N/A";

                return (
                  <div
                    key={rev.id || rev.version}
                    className={`p-3.5 rounded-xl border transition ${
                      isLatest
                        ? "border-indigo-200 bg-indigo-50/30"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          v{rev.version}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-medium">
                          {formattedDate}
                        </span>
                      </div>

                      {!isLatest && (
                        <button
                          type="button"
                          disabled={rollingBackVer !== null}
                          onClick={() => handleRollback(rev.version)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {rollingBackVer === rev.version ? "Restoring..." : "Rollback to this"}
                        </button>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-800">
                      {rev.change_summary || "Revision snapshot"}
                    </p>

                    {rev.user_prompt && (
                      <p className="text-[11px] text-slate-500 italic mt-1">
                        &ldquo;{rev.user_prompt}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
