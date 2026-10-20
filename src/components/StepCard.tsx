"use client";

import { useEffect, useState } from "react";
import type { StepOut, StepStatus } from "@/lib/types";
import { ScriptOutputView } from "./ScriptOutputView";
import { CollapsibleJson } from "./CollapsibleJson";
import { RerunModal } from "./RerunModal";

interface StepCardProps {
  step: StepOut;
  allSteps: StepOut[];
  isAnyRunning: boolean;
  onRerun: (stepName: string, prompt?: string) => Promise<void>;
}

function getBadgeStyle(status: StepStatus | string) {
  switch (status) {
    case "done":
      return "bg-emerald-50 text-emerald-700 border-emerald-300";
    case "running":
      return "bg-blue-50 text-blue-700 border-blue-300 animate-pulse";
    case "failed":
      return "bg-red-50 text-red-700 border-red-300";
    case "stale":
      return "bg-amber-50 text-amber-800 border-amber-300";
    case "pending":
    default:
      return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

export function StepCard({ step, allSteps, isAnyRunning, onRerun }: StepCardProps) {
  const [isRerunOpen, setIsRerunOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const isRunning = step.status === "running";
  const isStale = step.status === "stale";
  const isFailed = step.status === "failed";
  const isDone = step.status === "done";

  // Tick current time while step is actively running
  useEffect(() => {
    if (!isRunning || !step.started_at) return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning, step.started_at]);

  // Derived elapsed seconds
  const elapsedSeconds =
    isRunning && step.started_at
      ? Math.max(0, Math.floor((currentTime - new Date(step.started_at).getTime()) / 1000))
      : 0;

  // Compute N = later completed steps
  const laterDoneCount = allSteps.filter(
    (s) => s.position > step.position && s.status === "done"
  ).length;

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    if (mins === 0) return `${sec}s`;
    return `${mins}m ${remainingSec}s`;
  };

  const isScript = step.name.toLowerCase() === "script";
  const isMock = Boolean(
    step.output &&
      typeof step.output === "object" &&
      (step.output as Record<string, unknown>).mock === true
  );

  return (
    <div
      className={`rounded-xl border transition-all duration-150 ${
        isRunning
          ? "border-blue-400 bg-white ring-2 ring-blue-100 shadow-md"
          : isFailed
          ? "border-red-300 bg-white shadow-xs"
          : isStale
          ? "border-amber-200 bg-amber-50/20"
          : "border-slate-200 bg-white shadow-xs"
      }`}
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
            {step.position}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 capitalize">{step.name}</h3>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getBadgeStyle(
                  step.status
                )}`}
              >
                {step.status}
              </span>
            </div>

            {/* Timestamps & Live Duration */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
              {step.started_at && (
                <span>Started: {new Date(step.started_at).toLocaleTimeString()}</span>
              )}
              {step.finished_at && (
                <span>Finished: {new Date(step.finished_at).toLocaleTimeString()}</span>
              )}
              {isRunning && (
                <span className="font-semibold text-blue-600 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                  Running for {formatElapsed(elapsedSeconds)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action: Rerun button */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setIsRerunOpen(true)}
            disabled={isAnyRunning}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Rerun Step...
          </button>
        </div>
      </div>

      {/* Body: Warnings / Stuck alerts / Errors / Prompt / Outputs */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Stuck warning: running >= 5 minutes (300 seconds) */}
        {isRunning && elapsedSeconds >= 300 && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Note:</strong> This step has been running for {formatElapsed(elapsedSeconds)}.
              This may be stuck. The server may have restarted.
            </span>
          </div>
        )}

        {/* Failure Error Alert */}
        {isFailed && step.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3.5 text-xs text-red-800">
            <span className="font-bold block mb-1">Step Execution Failed:</span>
            <p className="font-mono whitespace-pre-wrap">{step.error}</p>
          </div>
        )}

        {/* User Prompt if set */}
        {step.user_prompt && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Revision Instruction Used
            </span>
            <p className="text-slate-800 italic font-medium">&ldquo;{step.user_prompt}&rdquo;</p>
          </div>
        )}

        {/* Output Section */}
        {step.output ? (
          <div>
            {isStale ? (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold">
                  <span>⏳</span> Outdated, will be regenerated
                </div>
                <div className="opacity-50 pointer-events-none filter grayscale-30">
                  {isScript ? (
                    <ScriptOutputView output={step.output} />
                  ) : (
                    <CollapsibleJson data={step.output} mock={isMock} defaultOpen={false} />
                  )}
                </div>
              </div>
            ) : (
              <div>
                {isScript ? (
                  <ScriptOutputView output={step.output} />
                ) : (
                  <CollapsibleJson
                    data={step.output}
                    mock={isMock}
                    defaultOpen={isDone}
                    label={`${step.name} payload`}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          !isRunning && (
            <div className="text-xs text-slate-400 italic py-1">
              {step.status === "pending"
                ? "Waiting to be executed."
                : "No output generated for this step."}
            </div>
          )
        )}
      </div>

      {/* Rerun Modal Dialog */}
      <RerunModal
        stepName={step.name}
        laterDoneCount={laterDoneCount}
        isOpen={isRerunOpen}
        onClose={() => setIsRerunOpen(false)}
        onConfirm={async (prompt) => {
          await onRerun(step.name, prompt);
        }}
      />
    </div>
  );
}
