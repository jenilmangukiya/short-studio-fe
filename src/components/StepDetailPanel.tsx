"use client";

import { useEffect, useState } from "react";
import type { StepOut, StepStatus, StoryboardScene } from "@/lib/types";
import { ScriptOutputView } from "./ScriptOutputView";
import { StoryboardOutputView } from "./StoryboardOutputView";
import { ImagesOutputView } from "./ImagesOutputView";
import { VoiceoverOutputView } from "./VoiceoverOutputView";
import { RenderOutputView } from "./RenderOutputView";
import { SubtitlesOutputView } from "./SubtitlesOutputView";
import { CollapsibleJson } from "./CollapsibleJson";
import { RerunModal } from "./RerunModal";
import { StepHistoryModal } from "./StepHistoryModal";

interface StepDetailPanelProps {
  step: StepOut;
  allSteps: StepOut[];
  isAnyRunning: boolean;
  onRerun: (stepName: string, prompt?: string) => Promise<void>;
  onApprove?: (stepName: string, autoAdvance?: boolean) => Promise<void>;
  onUpdateContent?: (stepName: string, output: Record<string, unknown>, summary?: string) => Promise<void>;
  onRollback?: (stepName: string, version: number) => Promise<void>;
  videoId: string;
  topic?: string;
}

function getBadgeStyle(status: StepStatus | string) {
  switch (status) {
    case "done":
      return "bg-emerald-50 text-emerald-700 border-emerald-300";
    case "awaiting_approval":
      return "bg-purple-50 text-purple-700 border-purple-300 font-bold";
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

export function StepDetailPanel({
  step,
  allSteps,
  isAnyRunning,
  onRerun,
  onApprove,
  onUpdateContent,
  onRollback,
  videoId,
  topic,
}: StepDetailPanelProps) {
  const [isRerunOpen, setIsRerunOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const isRunning = step.status === "running";
  const isStale = step.status === "stale";
  const isFailed = step.status === "failed";
  const isDone = step.status === "done";
  const isPending = step.status === "pending";
  const isAwaitingApproval = step.status === "awaiting_approval";

  // Tick current time while step is running to compute live duration
  useEffect(() => {
    if (!isRunning || !step.started_at) return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning, step.started_at]);

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
  const isStoryboard = step.name.toLowerCase() === "storyboard";
  const isImages = step.name.toLowerCase() === "images";
  const isVoiceover = step.name.toLowerCase() === "voiceover";
  const isRender = step.name.toLowerCase() === "render";
  const isSubtitles =
    step.name.toLowerCase() === "subtitles" || step.name.toLowerCase() === "subtitle";
  const isMock = Boolean(
    step.output &&
      typeof step.output === "object" &&
      (step.output as Record<string, unknown>).mock === true
  );

  // Extract storyboard scenes if available to enrich images view with narration & shot types
  const storyboardStep = allSteps.find((s) => s.name.toLowerCase() === "storyboard");
  const rawStoryboardOutput = storyboardStep?.output as Record<string, unknown> | undefined;
  const rawStoryboardData = (rawStoryboardOutput?.storyboard || rawStoryboardOutput) as Record<string, unknown> | undefined;
  const storyboardScenes = Array.isArray(rawStoryboardData?.scenes)
    ? (rawStoryboardData?.scenes as StoryboardScene[])
    : undefined;

  return (
    <div
      role="tabpanel"
      id={`panel-${step.name}`}
      aria-labelledby={`tab-${step.name}`}
      className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-all duration-150 ${
        isRunning
          ? "border-blue-400 ring-2 ring-blue-100"
          : isFailed
          ? "border-red-300"
          : isStale
          ? "border-amber-200"
          : "border-slate-200"
      }`}
    >
      {/* Panel Header */}
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xs">
            {step.position}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 capitalize">{step.name} Step</h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getBadgeStyle(
                  step.status
                )}`}
              >
                {step.status}
              </span>
            </div>

            {/* Timestamps & Live Duration */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
              {step.started_at && (
                <span>Started: {new Date(step.started_at).toLocaleTimeString()}</span>
              )}
              {step.finished_at && (
                <span>Finished: {new Date(step.finished_at).toLocaleTimeString()}</span>
              )}
              {isRunning && (
                <span className="font-semibold text-blue-600 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                  Running for {formatElapsed(elapsedSeconds)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons: History & Rerun */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-2xs transition cursor-pointer flex items-center gap-1.5"
          >
            <span>📜</span>
            <span>History {step.revisions_count ? `(${step.revisions_count})` : ""}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsRerunOpen(true)}
            disabled={isAnyRunning || isPending}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Rerun Step...
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="p-5 sm:p-6 space-y-5">
        {/* Awaiting Approval Gatekeeping Banner */}
        {isAwaitingApproval && (
          <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 text-xs text-purple-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <span className="text-base text-purple-600 font-bold">✋</span>
              <div>
                <span className="font-bold text-purple-950">Awaiting your approval: </span>
                <span>
                  This step has finished generating and is ready for your review. You can make inline edits below or approve to proceed.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <button
                type="button"
                disabled={approving || isAnyRunning}
                onClick={async () => {
                  setApproving(true);
                  try {
                    await onApprove?.(step.name, false);
                  } finally {
                    setApproving(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-purple-300 hover:bg-purple-100 text-purple-800 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Approve Step
              </button>
              <button
                type="button"
                disabled={approving || isAnyRunning}
                onClick={async () => {
                  setApproving(true);
                  try {
                    await onApprove?.(step.name, true);
                  } finally {
                    setApproving(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {approving ? "Approving..." : "Approve & Next →"}
              </button>
            </div>
          </div>
        )}
        {/* Stuck Warning: running >= 5 minutes (300 seconds) */}
        {isRunning && elapsedSeconds >= 300 && (
          <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-bold text-amber-950">Execution may be stuck</p>
              <p className="mt-0.5 text-amber-900">
                This step has been running for {formatElapsed(elapsedSeconds)}. The server may have restarted.
              </p>
            </div>
          </div>
        )}

        {/* Failure Error Alert */}
        {isFailed && step.error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800">
            <span className="font-bold block mb-1">Execution Failure:</span>
            <p className="font-mono whitespace-pre-wrap">{step.error}</p>
          </div>
        )}

        {/* User Prompt if set */}
        {step.user_prompt && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Revision Instruction Used
            </span>
            <p className="text-slate-800 italic font-medium">&ldquo;{step.user_prompt}&rdquo;</p>
          </div>
        )}

        {/* Pending Empty State */}
        {isPending && !step.output && (
          <div className="py-14 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <div className="text-2xl mb-2 text-slate-400">⏳</div>
            <p className="text-sm font-semibold text-slate-700">Not run yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              This step has not been executed yet. Use the pipeline controls above to advance to this step.
            </p>
          </div>
        )}

        {/* Stale Step Display */}
        {isStale && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 flex items-start gap-3">
              <span className="text-lg">⏳</span>
              <div>
                <p className="font-bold text-amber-950">Step Outdated</p>
                <p className="mt-0.5 text-amber-900">
                  Outdated because an earlier step changed. It will regenerate on the next run.
                </p>
              </div>
            </div>

            {step.output ? (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold">
                  <span>⏳</span> Outdated, will be regenerated
                </div>
                <div className="opacity-50 pointer-events-none filter grayscale-30">
                  {isScript ? (
                    <ScriptOutputView output={step.output} />
                  ) : isStoryboard ? (
                    <StoryboardOutputView output={step.output} isMock={isMock} isStale={true} />
                  ) : isImages ? (
                    <ImagesOutputView
                      videoId={videoId}
                      output={step.output}
                      isMock={isMock}
                      isStale={true}
                      isRunning={isRunning}
                      storyboardScenes={storyboardScenes}
                    />
                  ) : isVoiceover ? (
                    <VoiceoverOutputView
                      videoId={videoId}
                      output={step.output}
                      isMock={isMock}
                      isStale={true}
                      isRunning={isRunning}
                      storyboardScenes={storyboardScenes}
                    />
                  ) : isRender ? (
                    <RenderOutputView
                      videoId={videoId}
                      topic={topic}
                      output={step.output}
                      isMock={isMock}
                      isStale={true}
                      isRunning={isRunning}
                      stepStatus={step.status}
                    />
                  ) : (
                    <CollapsibleJson data={step.output} mock={isMock} defaultOpen={false} />
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-2">
                Previous output was discarded when an earlier step was rerun.
              </div>
            )}
          </div>
        )}

        {/* Standard Output (when not stale and not pending) */}
        {!isStale && !isPending && step.output && (
          <div>
            {isScript ? (
              <ScriptOutputView
                output={step.output}
                isSaving={isUpdating}
                onSave={async (updated) => {
                  setIsUpdating(true);
                  try {
                    await onUpdateContent?.(step.name, { script: updated }, "Inline script revision");
                  } finally {
                    setIsUpdating(false);
                  }
                }}
              />
            ) : isStoryboard ? (
              <StoryboardOutputView
                output={step.output}
                isMock={isMock}
                isStale={false}
                isSaving={isUpdating}
                onSave={async (updatedScenes) => {
                  setIsUpdating(true);
                  try {
                    await onUpdateContent?.(
                      step.name,
                      { storyboard: { scenes: updatedScenes } },
                      "Inline storyboard scenes revision"
                    );
                  } finally {
                    setIsUpdating(false);
                  }
                }}
              />
            ) : isImages ? (
              <ImagesOutputView
                videoId={videoId}
                output={step.output}
                isMock={isMock}
                isStale={false}
                isRunning={isRunning}
                storyboardScenes={storyboardScenes}
              />
            ) : isVoiceover ? (
              <VoiceoverOutputView
                videoId={videoId}
                output={step.output}
                isMock={isMock}
                isStale={false}
                isRunning={isRunning}
                storyboardScenes={storyboardScenes}
              />
            ) : isRender ? (
              <RenderOutputView
                videoId={videoId}
                topic={topic}
                output={step.output}
                isMock={isMock}
                isStale={false}
                isRunning={isRunning}
                stepStatus={step.status}
              />
            ) : isSubtitles ? (
              <SubtitlesOutputView
                videoId={videoId}
                topic={topic}
                output={step.output}
                isMock={isMock}
                isStale={false}
                isRunning={isRunning}
                stepStatus={step.status}
              />
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

        {/* Running without output yet */}
        {isRunning && !step.output && (
          isImages && storyboardScenes && storyboardScenes.length > 0 ? (
            <ImagesOutputView
              videoId={videoId}
              output={{ images: { items: [], complete: false } }}
              isMock={isMock}
              isStale={false}
              isRunning={true}
              storyboardScenes={storyboardScenes}
            />
          ) : isVoiceover && storyboardScenes && storyboardScenes.length > 0 ? (
            <VoiceoverOutputView
              videoId={videoId}
              output={{ voiceover: { items: [], complete: false } }}
              isMock={isMock}
              isStale={false}
              isRunning={true}
              storyboardScenes={storyboardScenes}
            />
          ) : isRender ? (
            <RenderOutputView
              videoId={videoId}
              topic={topic}
              output={{ render: {} }}
              isMock={isMock}
              isStale={false}
              isRunning={true}
              stepStatus={step.status}
            />
          ) : isSubtitles ? (
            <SubtitlesOutputView
              videoId={videoId}
              topic={topic}
              output={{ subtitles: { segments: [] } }}
              isMock={isMock}
              isStale={false}
              isRunning={true}
              stepStatus={step.status}
            />
          ) : (
            <div className="py-12 text-center rounded-xl border border-blue-100 bg-blue-50/30">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600 mb-2" />
              <p className="text-sm font-semibold text-blue-900">Step is running...</p>
              <p className="text-xs text-blue-600 mt-1">Generating output for this step in the background.</p>
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

      {/* History Modal Dialog */}
      <StepHistoryModal
        stepName={step.name}
        videoId={videoId}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRollback={async (stepName, ver) => {
          await onRollback?.(stepName, ver);
        }}
      />
    </div>
  );
}
