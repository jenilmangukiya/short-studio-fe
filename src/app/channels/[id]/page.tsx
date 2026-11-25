"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { api, formatErrorMessage } from "@/lib/api";
import { getChannelVisualStyle } from "@/lib/types";
import type { VideoCreate, VideoSummary, VisualStyleId } from "@/lib/types";
import {
  computeVideoMetrics,
  filterAndSortVideos,
  type VideoSortOption,
  type VideoViewMode,
} from "@/lib/video-ui";
import { ChannelMetricsRibbon } from "@/components/ChannelMetricsRibbon";
import { VideoToolbar } from "@/components/VideoToolbar";
import { VideoGridCard } from "@/components/VideoGridCard";
import { VideoListRow } from "@/components/VideoListRow";
import { VisualStyleSelector } from "@/components/VisualStyleSelector";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChannelDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      }
    >
      <ChannelDetailPageInner params={params} />
    </Suspense>
  );
}

function ChannelDetailPageInner({ params }: PageProps) {
  const resolvedParams = use(params);

  return (
    <AuthGuard>
      <ChannelVideosContent channelId={resolvedParams.id} />
    </AuthGuard>
  );
}

function ChannelVideosContent({ channelId }: { channelId: string }) {
  const queryClient = useQueryClient();

  // Create Video modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<VisualStyleId | null>(null);

  // Delete Video modal state
  const [videoToDelete, setVideoToDelete] = useState<VideoSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Search, Filter, Sort & View Mode state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<VideoSortOption>("newest");
  const [viewMode, setViewMode] = useState<VideoViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    try {
      const savedMode = localStorage.getItem("shorts_studio_view_mode") as VideoViewMode | null;
      if (savedMode === "grid" || savedMode === "list") {
        return savedMode;
      }
    } catch {
      // Ignore storage errors
    }
    return "grid";
  });

  const handleViewModeChange = (mode: VideoViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("shorts_studio_view_mode", mode);
    } catch {
      // Ignore storage errors
    }
  };

  // Queries
  const {
    data: channel,
    isLoading: isLoadingChannel,
    error: channelError,
  } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => api.channels.get(channelId),
  });

  const {
    data: videos,
    isLoading: isLoadingVideos,
    error: videosError,
  } = useQuery({
    queryKey: ["channel", channelId, "videos"],
    queryFn: () => api.videos.listByChannel(channelId),
  });

  // Create Video Mutation
  const createVideoMutation = useMutation({
    mutationFn: (newVideo: VideoCreate) => api.videos.create(channelId, newVideo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel", channelId, "videos"] });
      setIsModalOpen(false);
      setTopic("");
      setDescription("");
      setSelectedStyleId(null);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(formatErrorMessage(err));
    },
  });

  // Delete Video Mutation
  const deleteVideoMutation = useMutation({
    mutationFn: (vidId: string) => api.videos.delete(vidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel", channelId, "videos"] });
      setVideoToDelete(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(formatErrorMessage(err));
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTopic = topic.trim();
    if (trimmedTopic.length < 3) {
      setFormError("Topic must be at least 3 characters long.");
      return;
    }
    if (trimmedTopic.length > 300) {
      setFormError("Topic cannot exceed 300 characters.");
      return;
    }

    createVideoMutation.mutate({
      topic: trimmedTopic,
      description: description.trim() || null,
      ...(selectedStyleId ? { visual_style_id: selectedStyleId } : {}),
    });
  };

  const isLoading = isLoadingChannel || isLoadingVideos;
  const metrics = computeVideoMetrics(videos || []);
  const filteredVideos = filterAndSortVideos(videos || [], searchQuery, statusFilter, sortBy);
  const activeStyle = channel ? getChannelVisualStyle(channel.settings) : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/channels" className="hover:text-indigo-600 transition flex items-center gap-1">
          <span>&larr;</span>
          <span>Channels</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold truncate max-w-sm">
          {channel?.name || "Channel"}
        </span>
      </div>

      {/* Channel Hero Banner */}
      {channel && (
        <div className="relative bg-white rounded-2xl border border-slate-200/90 p-6 md:p-7 shadow-xs overflow-hidden">
          {/* Subtle gradient background accent */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-radial from-indigo-50/70 via-slate-50/20 to-transparent pointer-events-none -mr-20 -mt-20" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                  {channel.name}
                </h1>

                {/* Platform Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    channel.platform === "youtube"
                      ? "bg-red-50 text-red-700 border border-red-200/80 shadow-2xs"
                      : "bg-pink-50 text-pink-700 border border-pink-200/80 shadow-2xs"
                  }`}
                >
                  {channel.platform === "youtube" ? (
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  )}
                  <span>{channel.platform}</span>
                </span>

                {/* Visual Style Indicator Chip */}
                <Link
                  href={`/channels/${channelId}/settings`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition"
                  title="Click to customize visual style"
                >
                  <span>🎨</span>
                  <span className="truncate max-w-[200px]">
                    {activeStyle ? activeStyle : "Default 3D Style"}
                  </span>
                </Link>
              </div>

              {/* Subtitle details */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {channel.handle && (
                  <span className="font-semibold text-slate-700">{channel.handle}</span>
                )}
                {channel.niche && (
                  <span>
                    <strong className="font-medium text-slate-600">Niche:</strong> {channel.niche}
                  </span>
                )}
                <span>
                  Created {new Date(channel.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href={`/channels/${channelId}/settings`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition shadow-2xs hover:border-slate-400"
              >
                <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Channel Settings</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setTopic("");
                  setDescription("");
                  setSelectedStyleId(null);
                  setFormError(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">+</span>
                <span>Create New Short</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Metrics Ribbon */}
      {!isLoading && <ChannelMetricsRibbon metrics={metrics} />}

      {/* Errors Banner */}
      {(channelError || videosError) && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          Error loading channel data: {formatErrorMessage(channelError || videosError)}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-10 bg-slate-200/60 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-white rounded-2xl border border-slate-200 p-4 animate-pulse space-y-3">
                <div className="aspect-[16/10] bg-slate-200 rounded-xl" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Section: Toolbar & Video Cards */}
      {!isLoading && videos && (
        <div className="space-y-4">
          {/* Creator Toolbar */}
          <VideoToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            metrics={metrics}
            filteredCount={filteredVideos.length}
          />

          {/* Empty State when channel has 0 videos */}
          {videos.length === 0 && (
            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300 space-y-4 shadow-2xs">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-2xl shadow-inner">
                🎬
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">No Shorts in this Channel yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Start your automated production workflow by creating your first short video topic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTopic("");
                  setDescription("");
                  setSelectedStyleId(null);
                  setFormError(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
              >
                <span>+ Create Your First Short</span>
              </button>
            </div>
          )}

          {/* Empty State when search/filter has no match */}
          {videos.length > 0 && filteredVideos.length === 0 && (
            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
              <span className="text-2xl">🔍</span>
              <h3 className="text-sm font-bold text-slate-800">No matching shorts found</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No videos match your current search query or status filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Video List Output: Grid Mode */}
          {filteredVideos.length > 0 && viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
              {filteredVideos.map((vid) => (
                <VideoGridCard
                  key={vid.id}
                  video={vid}
                  onDelete={(v) => {
                    setDeleteError(null);
                    setVideoToDelete(v);
                  }}
                />
              ))}
            </div>
          )}

          {/* Video List Output: List Mode */}
          {filteredVideos.length > 0 && viewMode === "list" && (
            <div className="space-y-2.5">
              {filteredVideos.map((vid) => (
                <VideoListRow
                  key={vid.id}
                  video={vid}
                  onDelete={(v) => {
                    setDeleteError(null);
                    setVideoToDelete(v);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {videoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Short Video</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900 font-semibold">&ldquo;{videoToDelete.topic}&rdquo;</strong>?
              All generated scripts, scenes, voiceover audio, and rendered files will be removed.
            </p>

            {deleteError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setVideoToDelete(null);
                  setDeleteError(null);
                }}
                disabled={deleteVideoMutation.isPending}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteVideoMutation.mutate(videoToDelete.id)}
                disabled={deleteVideoMutation.isPending}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {deleteVideoMutation.isPending ? "Deleting..." : "Delete Video"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Video Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎬</span>
                <h3 className="text-base font-bold text-slate-900">Create New Short</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedStyleId(null);
                  setFormError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer leading-none p-1"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Short Video Topic <span className="text-rose-500">*</span>
                  </label>
                  <span className="font-mono text-[11px] text-slate-400">
                    {topic.length} / 300
                  </span>
                </div>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={300}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Why Do We Get Goosebumps Even When We're Not Cold?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium placeholder:text-slate-400"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Write a curiosity-gap question or hook topic for a 30–60s vertical short.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Additional Creative Notes / Directions <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Target 40 seconds. Focus on the fight-or-flight evolutionary response with goosebumps in animals."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400 leading-relaxed"
                />
              </div>

              {/* Visual Style Selector */}
              <div className="pt-1">
                <VisualStyleSelector
                  value={selectedStyleId}
                  onChange={setSelectedStyleId}
                  channelDefaultStyleId={channel?.default_visual_style_id}
                  disabled={createVideoMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedStyleId(null);
                    setFormError(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createVideoMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {createVideoMutation.isPending ? "Creating..." : "Create Short"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
