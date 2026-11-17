"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StepOut, SubtitleData, SubtitleStyleId, VideoDetail } from "@/lib/types";
import { useObjectUrl } from "@/lib/object-url";
import { SubtitleOverlay } from "./SubtitleOverlay";

interface VideoPlayerProps {
  videoId: string;
  topic?: string;
  aspectRatio?: string;
  className?: string;
  showDownloadButton?: boolean;
  isReady?: boolean;
  isRendering?: boolean;
  isStale?: boolean;
  videoVersion?: string | null;
  subtitlesVersion?: string | null;
  initialSubtitles?: SubtitleData | null;
  // Subtitle style preview props
  useSubtitleOverlay?: boolean;
  previewStyleId?: SubtitleStyleId | null;
  appliedStyleId?: SubtitleStyleId | null;
}

export function VideoPlayer({
  videoId,
  topic,
  aspectRatio = "aspect-[9/16]",
  className = "",
  showDownloadButton = true,
  isReady = true,
  isRendering = false,
  isStale = false,
  videoVersion,
  subtitlesVersion,
  initialSubtitles,
  useSubtitleOverlay = false,
  previewStyleId,
  appliedStyleId,
}: VideoPlayerProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadingType, setDownloadingType] = useState<"captioned" | "original" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Subscribe reactively to VideoDetail so step status transitions (script, voiceover, render, subtitles)
  // immediately update player readiness and cache keys without serving stale captioned output.
  const { data: videoDetail } = useQuery<VideoDetail>({
    queryKey: ["video", videoId],
    queryFn: () => api.videos.get(videoId),
    enabled: Boolean(videoId),
    initialData: () => queryClient.getQueryData<VideoDetail>(["video", videoId]),
    staleTime: 1000 * 2,
  });

  const steps: StepOut[] = videoDetail?.steps ?? [];
  const hasSteps = steps.length > 0;

  const scriptStep = steps.find((s) => s.name.toLowerCase() === "script");
  const storyboardStep = steps.find((s) => s.name.toLowerCase() === "storyboard");
  const voiceoverStep = steps.find((s) => s.name.toLowerCase() === "voiceover");
  const renderStep = steps.find((s) => s.name.toLowerCase() === "render");
  const subtitlesStep = steps.find(
    (s) => s.name.toLowerCase() === "subtitles" || s.name.toLowerCase() === "subtitle"
  );

  const upstreamOfSubtitles = steps.filter((s) =>
    subtitlesStep ? s.position < subtitlesStep.position : s.name.toLowerCase() !== "subtitles"
  );
  const upstreamOfRender = steps.filter((s) =>
    renderStep ? s.position < renderStep.position : false
  );

  const isRenderRunning = Boolean(isRendering || renderStep?.status === "running");
  const isSubtitlesRunning = Boolean(subtitlesStep?.status === "running");
  const runningStep = steps.find((s) => s.status === "running");
  const isActivelyProcessing = Boolean(isRenderRunning || isSubtitlesRunning || runningStep);

  const subtitlesStepOutput = subtitlesStep?.output as Record<string, unknown> | undefined;
  const subtitlesMeta = subtitlesStepOutput?.meta as Record<string, unknown> | undefined;
  const subtitlesPayload = (subtitlesStepOutput?.subtitles ?? initialSubtitles) as
    | SubtitleData
    | undefined;

  const captionedBurnedFlag = subtitlesMeta?.captioned_burned;
  const hasCaptionedArtifact = Boolean(
    subtitlesPayload?.captioned_file ||
      subtitlesPayload?.captioned_video_path ||
      subtitlesStepOutput?.captioned_video_path ||
      captionedBurnedFlag === true
  );

  const hasStaleStep = steps.some((s) => s.status === "stale");
  const hasResetWithPreviousSubtitles = Boolean(
    subtitlesStep?.output &&
      (subtitlesStep.status === "pending" ||
        upstreamOfSubtitles.some(
          (s) => s.status === "pending" || s.status === "stale" || s.status === "failed"
        ))
  );
  const isCaptionedNotBurned = captionedBurnedFlag === false;

  const isCaptionedOutdated =
    !isActivelyProcessing &&
    Boolean(isStale || hasStaleStep || hasResetWithPreviousSubtitles || isCaptionedNotBurned);

  const isRenderDone = !hasSteps
    ? isReady
    : Boolean(
        renderStep &&
          (renderStep.status === "done" || renderStep.status === "awaiting_approval") &&
          upstreamOfRender.every(
            (s) => s.status === "done" || s.status === "awaiting_approval"
          )
      );

  const isSubtitlesDone = !hasSteps
    ? isReady
    : Boolean(
        subtitlesStep &&
          (subtitlesStep.status === "done" || subtitlesStep.status === "awaiting_approval") &&
          hasCaptionedArtifact
      );

  const isCaptionedReady = Boolean(
    videoId &&
      isReady &&
      !isActivelyProcessing &&
      !isCaptionedOutdated &&
      isRenderDone &&
      isSubtitlesDone
  );

  const isCleanRenderReady = Boolean(
    videoId && !isActivelyProcessing && isRenderDone && !upstreamOfRender.some((s) => s.status === "stale")
  );

  const resolvedVideoVersion =
    videoVersion ??
    `${renderStep?.finished_at ?? "default"}:${renderStep?.revisions_count ?? 0}`;

  const resolvedSubtitlesVersion =
    subtitlesVersion ??
    (typeof subtitlesMeta?.alignment_hash === "string" ? subtitlesMeta.alignment_hash : undefined) ??
    subtitlesPayload?.alignment_hash ??
    subtitlesStep?.finished_at ??
    "default";

  const resolvedCaptionedVersion = [
    resolvedVideoVersion,
    resolvedSubtitlesVersion,
    subtitlesStep?.finished_at ?? "no-sub-finish",
    subtitlesStep?.revisions_count ?? 0,
    voiceoverStep?.finished_at ?? "no-vo-finish",
    scriptStep?.revisions_count ?? 0,
    storyboardStep?.revisions_count ?? 0,
  ].join("|");

  const isRenderOutdated = Boolean(
    isStale ||
      upstreamOfRender.some((s) => s.status === "stale") ||
      renderStep?.status === "stale"
  );

  const isOverlayPreviewReady = Boolean(
    videoId &&
      isReady &&
      !isActivelyProcessing &&
      isCleanRenderReady &&
      !isRenderOutdated
  );

  const isOutdatedState = useSubtitleOverlay ? isRenderOutdated : isCaptionedOutdated;
  const isReadyState = useSubtitleOverlay ? isOverlayPreviewReady : isCaptionedReady;
  const shouldFetch = isReadyState;

  const queryKey = useSubtitleOverlay
    ? ["video-blob", videoId, "uncaptioned", resolvedVideoVersion]
    : ["video-blob", videoId, "captioned", resolvedCaptionedVersion];

  const {
    data: blob,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => api.videos.getVideoBlob(videoId, !useSubtitleOverlay),
    enabled: shouldFetch,
    staleTime: 1000 * 60 * 15, // 15 mins cache per distinct captioned render version
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  const videoUrl = useObjectUrl(shouldFetch ? blob : undefined);

  // Clean pause on unmount or when source is invalidated
  useEffect(() => {
    const el = videoRef.current;
    if (!shouldFetch && el) {
      el.pause();
      setIsPlaying(false);
    }
    return () => {
      if (el) {
        el.pause();
      }
    };
  }, [shouldFetch]);

  const handlePlayToggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleDownload = async (captioned: boolean = true) => {
    setDownloadError(null);
    setDownloadingType(captioned ? "captioned" : "original");
    try {
      const result = await api.videos.downloadBlob(videoId, captioned);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      const filename =
        result.filename ||
        `${(topic || "video").toLowerCase().replace(/[^a-z0-9]+/g, "-")}${captioned ? "-captioned" : "-original"}.mp4`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloadingType(null);
    }
  };

  const errorMessage = error instanceof Error ? error.message : "Video stream failed to load.";
  const isNotAvailableYet = errorMessage.toLowerCase().includes("not available yet");
  const isErrorOutdated = errorMessage.toLowerCase().includes("outdated");

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* 9:16 Vertical Video Frame */}
      <div
        className={`relative w-full max-w-[320px] sm:max-w-[360px] ${aspectRatio} rounded-2xl bg-black border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center`}
      >
        {/* 1. Rendering / Burning Captions In-Progress Placeholder */}
        {isActivelyProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
            <div className="relative mb-3">
              <div className="h-12 w-12 animate-spin rounded-full border-3 border-indigo-500/30 border-t-indigo-500" />
              <div className="absolute inset-0 flex items-center justify-center text-base">
                {isSubtitlesRunning ? "💬" : "🎬"}
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-100">
              {isSubtitlesRunning
                ? "Burning Synchronized Captions..."
                : isRenderRunning
                ? "Rendering Video..."
                : `Running ${runningStep?.name || "pipeline"} step...`}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-[230px]">
              {isSubtitlesRunning
                ? "Vosk and FFmpeg are aligning narration timestamps and burning subtitles into final_video_captioned.mp4."
                : "FFmpeg is assembling scenes and voiceover into vertical 1080x1920 MP4."}
            </p>
          </div>
        )}

        {/* 2. Outdated / Stale Captioned Output Placeholder */}
        {!isActivelyProcessing && isOutdatedState && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 border border-amber-500/30 text-amber-200">
            <span className="text-3xl mb-2">⏳</span>
            <p className="text-sm font-bold text-amber-300">
              {useSubtitleOverlay ? "Render Output Outdated" : "Captioned Video Outdated"}
            </p>
            <p className="text-xs text-amber-200/80 mt-1.5 max-w-[240px] leading-relaxed">
              {useSubtitleOverlay
                ? "Narration or scene data changed. Advance the pipeline to regenerate final_video.mp4 before preview."
                : "Narration, render, or subtitle data changed. Advance the pipeline to regenerate final_video_captioned.mp4 before playback or export."}
            </p>
          </div>
        )}

        {/* 3. Pending / Not Ready Placeholder */}
        {!isActivelyProcessing && !isOutdatedState && !isReadyState && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
            <span className="text-3xl mb-2 opacity-60">⏳</span>
            <p className="text-sm font-semibold text-slate-200">
              {useSubtitleOverlay
                ? "Base Video Not Rendered Yet"
                : isRenderDone && !isSubtitlesDone
                ? "Captioned Video Pending Subtitles Step"
                : "Captioned Video Not Rendered Yet"}
            </p>
            <p className="text-xs text-slate-400 mt-1.5 max-w-[235px] leading-relaxed">
              {useSubtitleOverlay
                ? "Complete the Render step to generate the base uncaptioned video for style preview."
                : isRenderDone && !isSubtitlesDone
                ? "Base video is rendered. Run the Subtitles step next to burn synchronized captions into final_video_captioned.mp4."
                : "Complete the Render and Subtitles steps to generate the burned-in captioned video."}
            </p>
          </div>
        )}

        {/* 4. Loading Blob State */}
        {shouldFetch && isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent mb-3" />
            <p className="text-sm font-semibold text-slate-200">
              {useSubtitleOverlay ? "Loading Preview Video..." : "Loading Captioned Video..."}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {useSubtitleOverlay
                ? "Retrieving uncaptioned base video (final_video.mp4)"
                : "Retrieving burned-in 1080x1920 MP4 (final_video_captioned.mp4)"}
            </p>
          </div>
        )}

        {/* 5. Error State */}
        {shouldFetch && isError && (
          isNotAvailableYet ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-400">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-400 border-t-transparent mb-3" />
              <p className="text-sm font-semibold text-slate-200">
                {useSubtitleOverlay ? "Preview video being finalized..." : "Captioned video being finalized..."}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                {useSubtitleOverlay
                  ? "The base video is still being finalized. It will appear once ready."
                  : "The burned-in captioned MP4 is still being finalized. It will appear once ready."}
              </p>
            </div>
          ) : isErrorOutdated ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 border border-amber-500/30 text-amber-200">
              <span className="text-3xl mb-2">⏳</span>
              <p className="text-sm font-bold text-amber-300">
                {useSubtitleOverlay ? "Video Output Outdated" : "Captioned Video Outdated"}
              </p>
              <p className="text-xs text-amber-200/80 mt-1 max-w-[240px]">
                {errorMessage}
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 border border-red-900/50 text-red-200">
              <span className="text-3xl mb-2">⚠️</span>
              <p className="text-sm font-bold text-red-300">
                {useSubtitleOverlay ? "Unable to load preview video" : "Unable to load captioned video"}
              </p>
              <p className="text-xs text-red-400 mt-1 max-w-[240px]">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          )
        )}

        {/* 6. HTML5 Video Player */}
        {shouldFetch && videoUrl && !isError && (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-cover"
            />

            {/* Live in-browser subtitle style overlay for uncaptioned preview */}
            {useSubtitleOverlay && (
              <SubtitleOverlay
                videoRef={videoRef}
                subtitles={subtitlesPayload}
                visible={true}
                styleId={previewStyleId ?? appliedStyleId ?? subtitlesPayload?.style}
              />
            )}

            {/* Quick Play/Pause Big Center Overlay (only when paused) */}
            {!isPlaying && (
              <button
                type="button"
                onClick={handlePlayToggle}
                aria-label="Play video"
                className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition shadow-lg cursor-pointer hover:scale-105 active:scale-95 z-20"
              >
                <span className="text-2xl ml-1">▶</span>
              </button>
            )}
          </>
        )}
      </div>

      {downloadError && (
        <p className="mt-2 text-xs text-red-600 font-medium text-center max-w-xs">
          {downloadError}
        </p>
      )}

      {/* Download Action Buttons below player */}
      {showDownloadButton && !isActivelyProcessing && !isCaptionedOutdated && (isCaptionedReady || isCleanRenderReady) && (
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          {/* Primary Action: Download Captioned MP4 with burned-in subtitles */}
          <button
            type="button"
            onClick={() => handleDownload(true)}
            disabled={!isCaptionedReady || downloadingType !== null || isLoading || isError}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title={
              isCaptionedReady
                ? "Download final_video_captioned.mp4 with permanent burned-in subtitles"
                : "Run the Subtitles step to generate the captioned video"
            }
          >
            <span>📥</span>
            <span>
              {downloadingType === "captioned"
                ? "Preparing captioned video..."
                : "Download Captioned Video (MP4)"}
            </span>
          </button>

          {/* Secondary Action: Download Clean Original (no subtitles) */}
          {isCleanRenderReady && (
            <button
              type="button"
              onClick={() => handleDownload(false)}
              disabled={downloadingType !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition disabled:opacity-50 cursor-pointer"
              title="Download clean uncaptioned video (final_video.mp4) without burned-in subtitles"
            >
              <span>{downloadingType === "original" ? "Preparing clean..." : "Clean (No Subs)"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
