"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { api, formatErrorMessage } from "@/lib/api";
import type { ChannelCreate } from "@/lib/types";

export default function ChannelsPage() {
  return (
    <AuthGuard>
      <ChannelsContent />
    </AuthGuard>
  );
}

function ChannelsContent() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"youtube" | "instagram">("youtube");
  const [niche, setNiche] = useState("");
  const [handle, setHandle] = useState("");

  const {
    data: channels,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["channels"],
    queryFn: () => api.channels.list(),
  });

  const createMutation = useMutation({
    mutationFn: (newChannel: ChannelCreate) => api.channels.create(newChannel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      setFormError(formatErrorMessage(err));
    },
  });

  const resetForm = () => {
    setName("");
    setPlatform("youtube");
    setNiche("");
    setHandle("");
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Channel name is required.");
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      platform,
      niche: niche.trim() || null,
      handle: handle.trim() ? (handle.startsWith("@") ? handle.trim() : `@${handle.trim()}`) : null,
      settings: {},
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Channels</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your YouTube and Instagram video automation channels
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-xs cursor-pointer"
        >
          + Add Channel
        </button>
      </div>

      {/* Error fetching channels */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Failed to load channels: {formatErrorMessage(error)}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-1/3 mb-6" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && channels?.length === 0 && (
        <div className="text-center py-16 px-4 bg-white rounded-xl border border-dashed border-slate-300">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl mb-4">
            📺
          </div>
          <h3 className="text-base font-semibold text-slate-900">No channels yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            Create your first channel to start drafting and generating shorts videos with AI.
          </p>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition cursor-pointer"
          >
            Create Channel
          </button>
        </div>
      )}

      {/* Channels Grid */}
      {!isLoading && channels && channels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/channels/${ch.id}`}
              className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition duration-150"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    ch.platform === "youtube"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-pink-50 text-pink-700 border border-pink-200"
                  }`}
                >
                  {ch.platform}
                </span>
                <span className="text-[11px] text-slate-400">
                  {new Date(ch.created_at).toLocaleDateString()}
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                {ch.name}
              </h2>

              {ch.handle && (
                <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{ch.handle}</p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{ch.niche ? `Niche: ${ch.niche}` : "General"}</span>
                <span className="font-medium text-indigo-600 group-hover:translate-x-0.5 transition">
                  View Videos &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Channel Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Add New Channel</h3>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Channel Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Daily Tech Bytes"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Platform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlatform("youtube")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border cursor-pointer transition ${
                      platform === "youtube"
                        ? "bg-red-50 text-red-700 border-red-300 ring-2 ring-red-400"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform("instagram")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border cursor-pointer transition ${
                      platform === "instagram"
                        ? "bg-pink-50 text-pink-700 border-pink-300 ring-2 ring-pink-400"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Instagram
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Handle (Optional)
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@dailytech"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Niche / Topic Area (Optional)
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Technology, AI, Finance..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {createMutation.isPending ? "Creating..." : "Save Channel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
