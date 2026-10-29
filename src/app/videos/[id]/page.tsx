"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { StepStepper } from "@/components/StepStepper";
import { StepDetailPanel } from "@/components/StepDetailPanel";
import { VideoPlayer } from "@/components/VideoPlayer";
import { api, formatErrorMessage } from "@/lib/api";
import { PIPELINE_STEP_NAMES, type PipelineStepName, type VideoStatus } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VideoDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      }
    >
      <VideoDetailPageInner params={params} />
    </Suspense>
  );
}

function VideoDetailPageInner({ params }: PageProps) {
  const resolvedParams = use(params);

  return (
    <AuthGuard>
      <VideoDetailContent videoId={resolvedParams.id} />
    </AuthGuard>
  );
}

function getStatusBadge(status: string) {
  switch (status as VideoStatus) {
    case "draft":
      return "bg-slate-100 text-slate-700 border-slate-300";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-300";
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-300";
    case "failed":
      return "bg-red-50 text-red-700 border-red-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-300";
  }
}

function VideoDetailContent({ videoId }: { videoId: string }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);

  // URL step param initialization:
  // On load: valid ?step= means follow mode is OFF; missing or invalid means follow mode is ON.
  const initialStepParam = searchParams.get("step");
  const isValidInitialStep = Boolean(
    initialStepParam && PIPELINE_STEP_NAMES.includes(initialStepParam as PipelineStepName)
  );

  const [isFollowing, setIsFollowing] = useState<boolean>(() => !isValidInitialStep);
  const [selectedStepName, setSelectedStepName] = useState<string | null>(() =>
    isValidInitialStep ? initialStepParam : null
  );

  // URL query sync helpers
  const setStepInUrl = (stepName: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("step", stepName);
    window.history.replaceState(null, "", url.toString());
  };

  const removeStepFromUrl = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("step");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
  };

  // TanStack Query with dynamic polling: poll every 2s ONLY while any step has status 'running'
  const {
    data: video,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["video", videoId],
    queryFn: () => api.videos.get(videoId),
    refetchInterval: (query) => {
      const steps = query.state.data?.steps || [];
      const isAnyRunning = steps.some((s) => s.status === "running");
      return isAnyRunning ? 2000 : false;
    },
  });

  // Fetch parent channel details for backlink
  const channelId = video?.channel_id;
  const { data: channel } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => api.channels.get(channelId!),
    enabled: Boolean(channelId),
  });

  const invalidateVideoQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["video", videoId] });
    queryClient.invalidateQueries({ queryKey: ["video-blob", videoId] });
    queryClient.invalidateQueries({ queryKey: ["video-subtitles", videoId] });
  };

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => api.videos.start(videoId),
    onSuccess: () => {
      setActionError(null);
      invalidateVideoQueries();
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const nextMutation = useMutation({
    mutationFn: () => api.videos.next(videoId),
    onSuccess: () => {
      setActionError(null);
      invalidateVideoQueries();
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const runAllMutation = useMutation({
    mutationFn: () => api.videos.runAll(videoId),
    onSuccess: () => {
      setActionError(null);
      invalidateVideoQueries();
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const rerunMutation = useMutation({
    mutationFn: ({ stepName, prompt }: { stepName: string; prompt?: string }) =>
      api.videos.rerunStep(videoId, stepName, prompt),
    onSuccess: () => {
      setActionError(null);
      invalidateVideoQueries();
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const approveMutation = useMutation({
    mutationFn: ({ stepName, autoAdvance }: { stepName: string; autoAdvance?: boolean }) =>
      api.videos.approveStep(videoId, stepName, autoAdvance),
    onSuccess: () => {
      setActionError(null);
      invalidateVideoQueries();
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const updateContentMutation = useMutation({
    mutationFn: ({
      stepName,
      output,
      summary,
    }: {
      stepName: string;
      output: Record<string, unknown>;
      summary?: string;
    }) => api.videos.updateStepContent(videoId, stepName, output, summary),
    onSuccess: () => {
      setActionError(null);
      invalidateVideoQueries();
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const rollbackMutation = useMutation({
    mutationFn: ({ stepName, version }: { stepName: string; version: number }) =>
      api.videos.rollbackStep(videoId, stepName, version),
    onSuccess: () => {
      setActionError(null);
      invalidateVideoQueries();
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  // Step calculations
  const steps = video?.steps || [];
  const sortedSteps = [...steps].sort((a, b) => a.position - b.position);
  const isAnyRunning = steps.some((s) => s.status === "running");
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done");
  const hasStarted = steps.length > 0;

  // "Current step" = first step that is not done; if all are done, the last step
  const currentStep = sortedSteps.find((s) => s.status !== "done") || sortedSteps[sortedSteps.length - 1];
  const currentStepName = currentStep?.name || "script";

  // Derive shownStep without useEffect:
  // shownStep = isFollowing ? currentStep.name : selectedStepName
  const shownStepName = isFollowing ? currentStepName : (selectedStepName || currentStepName);
  const selectedStep =
    sortedSteps.find((s) => s.name === shownStepName) || currentStep || sortedSteps[0];

  // Check if any step in pipeline has failed
  const failedStep = sortedSteps.find((s) => s.status === "failed");

  // Determine label for main pipeline button (Next step, Retry step, or Approve & Next)
  const isNextStepFailed = currentStep?.status === "failed";
  const isNextStepAwaitingApproval = currentStep?.status === "awaiting_approval";
  const nextButtonLabel = isNextStepFailed
    ? "Retry step"
    : isNextStepAwaitingApproval
    ? "Approve & Next →"
    : "Next step";

  // Selection handlers
  const handleSelectStep = (stepName: string) => {
    setIsFollowing(false);
    setSelectedStepName(stepName);
    setStepInUrl(stepName);
  };

  const handleGoToCurrent = () => {
    setIsFollowing(true);
    setSelectedStepName(null);
    removeStepFromUrl();
  };

  const handleSelectFailedStep = (failedStepName: string) => {
    setIsFollowing(false);
    setSelectedStepName(failedStepName);
    setStepInUrl(failedStepName);
  };

  // File download handler
  const handleDownload = async () => {
    setActionError(null);
    setDownloading(true);
    try {
      const { blob, filename } = await api.videos.downloadBlob(videoId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setActionError(formatErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const isBusy =
    startMutation.isPending ||
    nextMutation.isPending ||
    runAllMutation.isPending ||
    rerunMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/channels" className="hover:text-indigo-600 transition">
          Channels
        </Link>
        <span>/</span>
        {channel ? (
          <Link
            href={`/channels/${channel.id}`}
            className="hover:text-indigo-600 transition truncate max-w-xs"
          >
            {channel.name}
          </Link>
        ) : (
          <span>Channel</span>
        )}
        <span>/</span>
        <span className="text-slate-800 font-semibold truncate max-w-md">
          {video?.topic || "Video Pipeline"}
        </span>
      </div>

      {/* Main Error Alert */}
      {(error || actionError) && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start justify-between gap-2 shadow-2xs">
          <span>{formatErrorMessage(error || actionError)}</span>
          {actionError && (
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-600 font-bold cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-32 bg-white rounded-xl border border-slate-200 p-6 animate-pulse" />
          <div className="h-64 bg-white rounded-xl border border-slate-200 p-6 animate-pulse" />
        </div>
      )}

      {video && (
        <>
          {/* Header Card with Whole-Pipeline Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getStatusBadge(
                      video.status
                    )}`}
                  >
                    {video.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-400">
                    Created {new Date(video.created_at).toLocaleString()}
                  </span>
                </div>

                <h1 className="text-2xl font-bold text-slate-900 leading-snug">{video.topic}</h1>

                {video.description && (
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{video.description}</p>
                )}
              </div>

              {/* Completed Video Actions */}
              {video.status === "completed" && (
                <div className="shrink-0 pt-2 md:pt-0 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPreviewExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-2xs transition cursor-pointer"
                  >
                    <span>{isPreviewExpanded ? "▲ Hide Video Preview" : "▼ Watch Video Preview"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>📥</span>
                    <span>
                      {downloading ? "Preparing MP4..." : "Download Video (MP4)"}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Pipeline Action Controls */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {isAnyRunning ? (
                  <span className="inline-flex items-center gap-2 font-medium text-blue-600">
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                    Pipeline step is actively executing... (live polling every 2s)
                  </span>
                ) : allDone ? (
                  <span className="text-emerald-600 font-semibold">
                    ✓ All pipeline steps are completed!
                  </span>
                ) : hasStarted ? (
                  <span>
                    Ready for next execution:{" "}
                    <strong className="text-slate-800 capitalize">
                      {currentStep?.name || "None"}
                    </strong>
                  </span>
                ) : (
                  <span>Pipeline not started yet. Press Start below to initialize steps.</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {!hasStarted ? (
                  <button
                    type="button"
                    onClick={() => startMutation.mutate()}
                    disabled={isBusy}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {startMutation.isPending ? "Starting..." : "Start Pipeline"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (isNextStepAwaitingApproval && currentStep) {
                          approveMutation.mutate({ stepName: currentStep.name, autoAdvance: true });
                        } else {
                          nextMutation.mutate();
                        }
                      }}
                      disabled={isAnyRunning || allDone || isBusy}
                      className={`px-4 py-2 rounded-lg font-semibold text-xs transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                        isNextStepFailed
                          ? "bg-amber-600 hover:bg-amber-700 text-white"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      {nextMutation.isPending ? "Running..." : nextButtonLabel}
                    </button>

                    <button
                      type="button"
                      onClick={() => runAllMutation.mutate()}
                      disabled={isAnyRunning || allDone || isBusy}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {runAllMutation.isPending ? "Running all..." : "Run All Steps"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Video Preview Hero when Completed */}
          {video.status === "completed" && isPreviewExpanded && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white p-6 shadow-xs flex flex-col items-center">
              <div className="w-full max-w-xl flex items-center justify-between pb-3 mb-5 border-b border-indigo-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎉</span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Full Short Video Ready
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Stitched 1080x1920 vertical video with Kokoro audio & AI visuals.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewExpanded(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-indigo-100/50 transition cursor-pointer"
                >
                  Hide preview &times;
                </button>
              </div>

              <VideoPlayer
                videoId={videoId}
                topic={video.topic}
                showDownloadButton={true}
              />
            </div>
          )}

          {/* Failed-Step Error Summary Banner (Above Stepper) */}
          {failedStep && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <span className="text-base text-red-600 font-bold">⚠️</span>
                <div>
                  <span className="font-bold text-red-950">Step execution failed: </span>
                  <span>
                    Step <strong className="capitalize">&ldquo;{failedStep.name}&rdquo;</strong> encountered an error
                    {failedStep.error ? `: ${failedStep.error}` : "."}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSelectFailedStep(failedStep.name)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition cursor-pointer self-start sm:self-center"
              >
                View failed step &rarr;
              </button>
            </div>
          )}

          {/* Pipeline Stepper & Single Detail Panel */}
          {!hasStarted ? (
            <div className="text-center py-14 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="text-3xl mb-3">⚙️</div>
              <h3 className="text-base font-semibold text-slate-900">Pipeline not yet initialized</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Click the Start button to create the 6 pipeline steps (Script, Storyboard, Images, Voiceover, Render, Subtitles).
              </p>
              <button
                type="button"
                onClick={() => startMutation.mutate()}
                disabled={isBusy}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                {startMutation.isPending ? "Initializing..." : "Start Pipeline"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stepper Navigation */}
              <StepStepper
                steps={sortedSteps}
                shownStepName={shownStepName}
                currentStepName={currentStepName}
                onSelectStep={handleSelectStep}
                onGoToCurrent={handleGoToCurrent}
              />

              {/* Single Detail Panel for Selected Step */}
              {selectedStep && (
                <StepDetailPanel
                  step={selectedStep}
                  allSteps={sortedSteps}
                  isAnyRunning={isAnyRunning}
                  videoId={videoId}
                  topic={video.topic}
                  onRerun={async (stepName, prompt) => {
                    await rerunMutation.mutateAsync({ stepName, prompt });
                  }}
                  onApprove={async (stepName, autoAdvance) => {
                    await approveMutation.mutateAsync({ stepName, autoAdvance });
                  }}
                  onUpdateContent={async (stepName, output, summary) => {
                    await updateContentMutation.mutateAsync({ stepName, output, summary });
                  }}
                  onRollback={async (stepName, version) => {
                    await rollbackMutation.mutateAsync({ stepName, version });
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
