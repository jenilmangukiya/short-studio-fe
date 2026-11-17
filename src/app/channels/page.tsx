"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { api, formatErrorMessage } from "@/lib/api";
import type { ChannelCreate, Channel } from "@/lib/types";
import { ChannelCard } from "@/components/ChannelCard";

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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "youtube" | "instagram">("all");

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

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Channel name is required.");
      return;
    }
    if (trimmedName.length > 120) {
      setFormError("Channel name cannot exceed 120 characters.");
      return;
    }

    const trimmedHandle = handle.trim();
    const formattedHandle = trimmedHandle
      ? trimmedHandle.startsWith("@")
        ? trimmedHandle
        : `@${trimmedHandle}`
      : null;

    createMutation.mutate({
      name: trimmedName,
      platform,
      niche: niche.trim() || null,
      handle: formattedHandle,
      settings: {},
    });
  };

  // Filter channels
  const allChannels = channels || [];
  const youtubeCount = allChannels.filter((c) => c.platform === "youtube").length;
  const instagramCount = allChannels.filter((c) => c.platform === "instagram").length;

  const filteredChannels = allChannels.filter((c) => {
    if (platformFilter !== "all" && c.platform !== platformFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(q);
      const matchHandle = c.handle ? c.handle.toLowerCase().includes(q) : false;
      const matchNiche = c.niche ? c.niche.toLowerCase().includes(q) : false;
      return matchName || matchHandle || matchNiche;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="relative bg-white rounded-2xl border border-slate-200/90 p-6 md:p-7 shadow-xs overflow-hidden">
        {/* Ambient background decoration */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-indigo-50/70 via-slate-50/20 to-transparent pointer-events-none -mr-16 -mt-16" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xs">
                📺
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Channel Workstation
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Your Video Channels
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-xl">
              Automate vertical 9:16 short-form video generation for YouTube Shorts & Instagram Reels with custom visual styles.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>Add Channel</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      {!isLoading && allChannels.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Channels */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span className="font-medium">Total Channels</span>
              <span className="text-base">📺</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {allChannels.length}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {allChannels.length === 1 ? "1 active workspace" : `${allChannels.length} active workspaces`}
            </div>
          </div>

          {/* YouTube Channels */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span className="font-medium">YouTube Shorts</span>
              <span className="w-4 h-4 text-red-600">
                <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {youtubeCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Optimized for YouTube Shorts
            </div>
          </div>

          {/* Instagram Channels */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span className="font-medium">Instagram Reels</span>
              <span className="w-4 h-4 text-pink-600">
                <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </span>
            </div>
            <div className="text-2xl font-bold text-pink-600">
              {instagramCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Optimized for Instagram Reels
            </div>
          </div>

          {/* AI Production Pipeline Status */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span className="font-medium">Audio & Video Engine</span>
              <span className="text-emerald-500 text-sm font-bold">●</span>
            </div>
            <div className="text-sm font-bold text-slate-900 truncate">
              Kokoro TTS + Vosk
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 font-medium">
              Synchronized Subtitles Active
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          Failed to load channels: {formatErrorMessage(error)}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      {!isLoading && allChannels.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, handle, or niche..."
              className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-300 bg-white text-xs placeholder:text-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Platform Filter Tabs */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setPlatformFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                platformFilter === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              All ({allChannels.length})
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter("youtube")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                platformFilter === "youtube"
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>YouTube</span>
              <span className="text-[10px] opacity-80">({youtubeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter("instagram")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                platformFilter === "instagram"
                  ? "bg-pink-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>Instagram</span>
              <span className="text-[10px] opacity-80">({instagramCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl border border-slate-200 bg-white p-5 animate-pulse space-y-4">
              <div className="h-20 bg-slate-200/80 rounded-xl" />
              <div className="h-5 bg-slate-200 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-1/2 pt-4" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state: 0 channels in account */}
      {!isLoading && !error && allChannels.length === 0 && (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300 space-y-4 shadow-2xs">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-inner">
            📺
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No channels created yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Create your first YouTube or Instagram channel to start drafting and rendering vertical shorts with AI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
          >
            <span>+ Create Your First Channel</span>
          </button>
        </div>
      )}

      {/* Empty state: Search/filter returned 0 */}
      {!isLoading && allChannels.length > 0 && filteredChannels.length === 0 && (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
          <span className="text-2xl">🔍</span>
          <h3 className="text-sm font-bold text-slate-800">No channels match your criteria</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Try adjusting your search query or platform filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setPlatformFilter("all");
            }}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Channels Grid */}
      {!isLoading && filteredChannels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredChannels.map((ch: Channel) => (
            <ChannelCard key={ch.id} channel={ch} />
          ))}
        </div>
      )}

      {/* Create Channel Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">📺</span>
                <h3 className="text-base font-bold text-slate-900">Add New Channel</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer leading-none p-1"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Channel Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Channel Name <span className="text-rose-500">*</span>
                  </label>
                  <span className="font-mono text-[11px] text-slate-400">
                    {name.length} / 120
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Daily Mysteries, Tech In 60 Seconds"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Platform Selector Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                  Target Platform <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPlatform("youtube")}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-semibold text-xs cursor-pointer transition ${
                      platform === "youtube"
                        ? "bg-red-50 border-red-300 text-red-700 ring-2 ring-red-400/40 shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="w-4 h-4 fill-current text-red-600" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>YouTube Shorts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlatform("instagram")}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-semibold text-xs cursor-pointer transition ${
                      platform === "instagram"
                        ? "bg-pink-50 border-pink-300 text-pink-700 ring-2 ring-pink-400/40 shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="w-4 h-4 fill-current text-pink-600" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <span>Instagram Reels</span>
                  </button>
                </div>
              </div>

              {/* Handle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Channel Handle <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-xs font-mono">
                    @
                  </span>
                  <input
                    type="text"
                    value={handle.startsWith("@") ? handle.slice(1) : handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="mychannel"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Niche */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Niche / Content Focus <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="e.g. Science Facts, History Origins, Engineering Curiosities"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
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
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
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
