"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { api, formatErrorMessage } from "@/lib/api";
import type { VideoCreate, VideoStatus } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChannelDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
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

function getStatusBadge(status: string) {
  switch (status as VideoStatus) {
    case "draft":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function ChannelVideosContent({ channelId }: { channelId: string }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");

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

  const createVideoMutation = useMutation({
    mutationFn: (newVideo: VideoCreate) => api.videos.create(channelId, newVideo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel", channelId, "videos"] });
      setIsModalOpen(false);
      setTopic("");
      setDescription("");
      setFormError(null);
    },
    onError: (err) => {
      setFormError(formatErrorMessage(err));
    },
  });

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

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
    });
  };

  const isLoading = isLoadingChannel || isLoadingVideos;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/channels" className="hover:text-indigo-600 transition">
          &larr; All Channels
        </Link>
        <span>/</span>
        <span className="text-slate-800 truncate">{channel?.name || "Channel"}</span>
      </div>

      {/* Channel Header */}
      {channel && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h1 className="text-2xl font-bold text-slate-900">{channel.name}</h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  channel.platform === "youtube"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-pink-50 text-pink-700 border border-pink-200"
                }`}
              >
                {channel.platform}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {channel.handle && <span className="font-medium text-slate-700">{channel.handle}</span>}
              {channel.niche && <span>Niche: {channel.niche}</span>}
              <span>Created: {new Date(channel.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTopic("");
              setDescription("");
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-xs cursor-pointer"
          >
            + Create New Video
          </button>
        </div>
      )}

      {/* Error state */}
      {(channelError || videosError) && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Error: {formatErrorMessage(channelError || videosError)}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && videos && videos.length === 0 && (
        <div className="text-center py-16 px-4 bg-white rounded-xl border border-dashed border-slate-300">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl mb-4">
            🎬
          </div>
          <h3 className="text-base font-semibold text-slate-900">No videos yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            Create a video topic to generate scripts, storyboards, voiceovers, and rendering.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition cursor-pointer"
          >
            Create Video
          </button>
        </div>
      )}

      {/* Videos List */}
      {!isLoading && videos && videos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            <span>Video Topics ({videos.length})</span>
            <span>Status</span>
          </div>

          {videos.map((vid) => (
            <Link
              key={vid.id}
              href={`/videos/${vid.id}`}
              className="group block bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition duration-150"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition truncate">
                    {vid.topic}
                  </h2>
                  {vid.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{vid.description}</p>
                  )}
                  <div className="text-[11px] text-slate-400 mt-2">
                    Created {new Date(vid.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${getStatusBadge(
                      vid.status
                    )}`}
                  >
                    {vid.status.replace("_", " ")}
                  </span>
                  <span className="text-sm text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition">
                    &rarr;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Video Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Create Video Topic</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer leading-none"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateVideo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Video Topic <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={300}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 5 Mind-Blowing Facts About Black Holes"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Between 3 and 300 characters
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Tone Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional context, target audience, tone instructions..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createVideoMutation.isPending}
                  className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {createVideoMutation.isPending ? "Creating..." : "Create Video"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
