"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { StepTimeline } from "@/components/StepTimeline";
import { api, formatErrorMessage } from "@/lib/api";
import type { VideoStatus } from "@/lib/types";

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => api.videos.start(videoId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["video", videoId] });
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const nextMutation = useMutation({
    mutationFn: () => api.videos.next(videoId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["video", videoId] });
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const runAllMutation = useMutation({
    mutationFn: () => api.videos.runAll(videoId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["video", videoId] });
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  const rerunMutation = useMutation({
    mutationFn: ({ stepName, prompt }: { stepName: string; prompt?: string }) =>
      api.videos.rerunStep(videoId, stepName, prompt),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["video", videoId] });
    },
    onError: (err) => setActionError(formatErrorMessage(err)),
  });

  // Step state calculations
  const steps = video?.steps || [];
  const sortedSteps = [...steps].sort((a, b) => a.position - b.position);
  const isAnyRunning = steps.some((s) => s.status === "running");
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done");
  const hasStarted = steps.length > 0;

  // Find next step to run (first step not 'done')
  const nextStepToRun = sortedSteps.find((s) => s.status !== "done");
  const isNextStepFailed = nextStepToRun?.status === "failed";
  const nextButtonLabel = isNextStepFailed ? "Retry step" : "Next step";

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
          <Link href={`/channels/${channel.id}`} className="hover:text-indigo-600 transition truncate max-w-xs">
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
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>{formatErrorMessage(error || actionError)}</span>
          {actionError && (
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-600 font-bold"
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
          {/* Header Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
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

              {/* Download Action (Available when completed) */}
              {video.status === "completed" && (
                <div className="shrink-0 pt-2 md:pt-0">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>📥</span>
                    <span>
                      {downloading
                        ? "Downloading..."
                        : "Download output (placeholder file)"}
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
                      {nextStepToRun?.name || "None"}
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
                      onClick={() => nextMutation.mutate()}
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

          {/* Timeline Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold text-slate-800">
                Pipeline Steps ({steps.length})
              </h2>
              {hasStarted && (
                <span className="text-xs text-slate-500 font-medium">
                  {steps.filter((s) => s.status === "done").length} of {steps.length} done
                </span>
              )}
            </div>

            {!hasStarted ? (
              <div className="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-slate-300">
                <div className="text-3xl mb-3">⚙️</div>
                <h3 className="text-base font-semibold text-slate-900">Pipeline not yet initialized</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Click the Start button to create the 5 pipeline steps (Script, Storyboard, Images, Voiceover, Render).
                </p>
                <button
                  type="button"
                  onClick={() => startMutation.mutate()}
                  disabled={isBusy}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {startMutation.isPending ? "Initializing..." : "Start"}
                </button>
              </div>
            ) : (
              <StepTimeline
                steps={steps}
                isAnyRunning={isAnyRunning}
                onRerun={async (stepName, prompt) => {
                  await rerunMutation.mutateAsync({ stepName, prompt });
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
