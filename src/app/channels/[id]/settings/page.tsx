"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/AuthGuard";
import { api, formatErrorMessage } from "@/lib/api";
import {
  getChannelVisualStyle,
  MAX_VISUAL_STYLE_LENGTH,
  VISUAL_STYLE_WARNING_THRESHOLD,
  validateVisualStyleLength,
} from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabKey = "visual-style" | "general" | "voice-audio" | "subtitles";

const STYLE_PRESETS = [
  {
    name: "Pixar 3D Animation",
    prompt:
      "Crisp 3D digital animation, Pixar and DreamWorks style, vivid saturated colors, soft cinematic studio lighting, detailed character design, clean background",
  },
  {
    name: "Photorealistic Cinematic",
    prompt:
      "Hyper-realistic 8K cinematic shot, 35mm film lens, natural depth of field, atmospheric volumetric lighting, dramatic shadow contrast, authentic texture",
  },
  {
    name: "Modern Flat Vector",
    prompt:
      "Clean modern minimalist vector illustration, geometric shapes, bold flat color palette, sleek editorial tech aesthetic, high contrast",
  },
  {
    name: "Cyberpunk Neon",
    prompt:
      "Moody cyberpunk aesthetic, neon cyan and magenta rim lighting, rainy reflective surfaces, high tech futuristic cityscape, cinematic bloom",
  },
  {
    name: "Vintage 1970s Film",
    prompt:
      "1970s vintage 16mm film stock, warm muted tones, subtle film grain, soft vignette, nostalgic retro documentary aesthetic",
  },
];

export default function ChannelSettingsPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      }
    >
      <ChannelSettingsPageInner params={params} />
    </Suspense>
  );
}

function ChannelSettingsPageInner({ params }: PageProps) {
  const resolvedParams = use(params);

  return (
    <AuthGuard>
      <ChannelSettingsContent channelId={resolvedParams.id} />
    </AuthGuard>
  );
}

function ChannelSettingsContent({ channelId }: { channelId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("visual-style");

  const {
    data: channel,
    isLoading,
    error: channelError,
  } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => api.channels.get(channelId),
  });

  // --- Visual Style Tab State ---
  const savedStyle = getChannelVisualStyle(channel?.settings) ?? "";
  const [visualDraft, setVisualDraft] = useState<string | null>(null);
  const [isSavingVisual, setIsSavingVisual] = useState(false);
  const [isResettingVisual, setIsResettingVisual] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [visualSuccess, setVisualSuccess] = useState<string | null>(null);

  const currentVisualValue = visualDraft !== null ? visualDraft : savedStyle;
  const isVisualDirty = visualDraft !== null && (visualDraft.trim() !== savedStyle.trim() || visualDraft !== savedStyle);
  const isVisualDefault = savedStyle.trim().length === 0;
  const isVisualBusy = isSavingVisual || isResettingVisual;

  const handleSaveVisual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVisualDirty || isVisualBusy) return;

    const validationError = validateVisualStyleLength(currentVisualValue);
    if (validationError) {
      setVisualError(validationError);
      return;
    }

    setVisualError(null);
    setVisualSuccess(null);
    setIsSavingVisual(true);

    try {
      const freshChannel = await api.channels.get(channelId);
      const freshSettings =
        freshChannel.settings &&
        typeof freshChannel.settings === "object" &&
        !Array.isArray(freshChannel.settings)
          ? { ...freshChannel.settings }
          : {};

      const trimmed = currentVisualValue.trim();
      if (trimmed.length > 0) {
        freshSettings.visual_style = currentVisualValue;
      } else {
        delete freshSettings.visual_style;
      }

      await api.channels.update(channelId, { settings: freshSettings });
      setVisualDraft(null);
      setVisualSuccess("Visual style saved successfully.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["channel", channelId] }),
        queryClient.invalidateQueries({ queryKey: ["channels"] }),
      ]);
    } catch (err) {
      setVisualError(formatErrorMessage(err));
    } finally {
      setIsSavingVisual(false);
    }
  };

  const handleResetVisual = async () => {
    if (isVisualBusy) return;

    const confirmed = window.confirm(
      "Reset visual style to default? This will remove custom visual styling for this channel."
    );
    if (!confirmed) return;

    setVisualError(null);
    setVisualSuccess(null);
    setIsResettingVisual(true);

    try {
      const freshChannel = await api.channels.get(channelId);
      const freshSettings =
        freshChannel.settings &&
        typeof freshChannel.settings === "object" &&
        !Array.isArray(freshChannel.settings)
          ? { ...freshChannel.settings }
          : {};

      delete freshSettings.visual_style;

      await api.channels.update(channelId, { settings: freshSettings });
      setVisualDraft(null);
      setVisualSuccess("Visual style reset to default clean 3D render style.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["channel", channelId] }),
        queryClient.invalidateQueries({ queryKey: ["channels"] }),
      ]);
    } catch (err) {
      setVisualError(formatErrorMessage(err));
    } finally {
      setIsResettingVisual(false);
    }
  };

  // --- General Tab State ---
  const [generalNameDraft, setGeneralNameDraft] = useState<string | null>(null);
  const [generalHandleDraft, setGeneralHandleDraft] = useState<string | null>(null);
  const [generalNicheDraft, setGeneralNicheDraft] = useState<string | null>(null);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);

  const currentName = generalNameDraft !== null ? generalNameDraft : channel?.name ?? "";
  const currentHandle =
    generalHandleDraft !== null ? generalHandleDraft : channel?.handle ?? "";
  const currentNiche = generalNicheDraft !== null ? generalNicheDraft : channel?.niche ?? "";

  const isGeneralDirty =
    (generalNameDraft !== null && generalNameDraft.trim() !== (channel?.name ?? "").trim()) ||
    (generalHandleDraft !== null && generalHandleDraft.trim() !== (channel?.handle ?? "").trim()) ||
    (generalNicheDraft !== null && generalNicheDraft.trim() !== (channel?.niche ?? "").trim());

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGeneralDirty || isSavingGeneral) return;

    if (!currentName.trim()) {
      setGeneralError("Channel name is required.");
      return;
    }

    setGeneralError(null);
    setGeneralSuccess(null);
    setIsSavingGeneral(true);

    try {
      const trimmedHandle = currentHandle.trim();
      const formattedHandle = trimmedHandle
        ? trimmedHandle.startsWith("@")
          ? trimmedHandle
          : `@${trimmedHandle}`
        : null;

      await api.channels.update(channelId, {
        name: currentName.trim(),
        handle: formattedHandle,
        niche: currentNiche.trim() || null,
      });

      setGeneralNameDraft(null);
      setGeneralHandleDraft(null);
      setGeneralNicheDraft(null);
      setGeneralSuccess("Channel details updated successfully.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["channel", channelId] }),
        queryClient.invalidateQueries({ queryKey: ["channels"] }),
      ]);
    } catch (err) {
      setGeneralError(formatErrorMessage(err));
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // --- Voice & Audio State ---
  const [pacing, setPacing] = useState("1.0x");
  const [voiceTone, setVoiceTone] = useState("engaging");
  const [audioSuccess, setAudioSuccess] = useState<string | null>(null);

  // --- Subtitles State ---
  const [defaultSubtitleStyle, setDefaultSubtitleStyle] = useState("clean_cinematic");
  const [subtitlesSuccess, setSubtitlesSuccess] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  if (channelError || !channel) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-slate-500">
          <Link href="/channels" className="hover:text-indigo-600">
            &larr; All Channels
          </Link>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-sm text-red-700">
          Error loading channel: {formatErrorMessage(channelError || "Channel not found")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/channels" className="hover:text-indigo-600 transition">
            All Channels
          </Link>
          <span>/</span>
          <Link href={`/channels/${channelId}`} className="hover:text-indigo-600 transition truncate max-w-xs">
            {channel.name}
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold">Settings</span>
        </div>

        <Link
          href={`/channels/${channelId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition"
        >
          &larr; Back to Videos
        </Link>
      </div>

      {/* Channel Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
              channel.platform === "youtube"
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-pink-50 text-pink-600 border border-pink-200"
            }`}
          >
            {channel.platform === "youtube" ? "YT" : "IG"}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
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
            <p className="text-xs text-slate-500">
              Manage channel settings, default visual styling, audio pacing, and video generation defaults.
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-400 hidden sm:block">
          <div>ID: <span className="font-mono text-slate-500">{channelId.slice(0, 8)}...</span></div>
          <div>Created: {new Date(channel.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="space-y-6">
        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("visual-style")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shrink-0 ${
              activeTab === "visual-style"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>🎨</span>
            <span>Visual Style</span>
            {!isVisualDefault && (
              <span className="w-2 h-2 rounded-full bg-indigo-600" title="Custom style active" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shrink-0 ${
              activeTab === "general"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>⚙️</span>
            <span>General Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("voice-audio")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shrink-0 ${
              activeTab === "voice-audio"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>🎙️</span>
            <span>Voice & Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("subtitles")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shrink-0 ${
              activeTab === "subtitles"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>📝</span>
            <span>Subtitles & Captions</span>
          </button>
        </div>

        {/* --- Tab 1: Visual Style --- */}
        {activeTab === "visual-style" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Visual Style & Art Direction</h2>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      !isVisualDefault
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {!isVisualDefault ? "Custom style active" : "Using default style"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Configure the visual look, art style, lighting, and camera direction applied to all image prompts
                  generated for this channel&apos;s video storyboards.
                </p>
              </div>

              {isVisualDirty && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold self-start sm:self-center shrink-0">
                  <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
                  Unsaved changes
                </span>
              )}
            </div>

            {/* Alerts */}
            {visualError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex items-start justify-between gap-2">
                <span>{visualError}</span>
                <button
                  type="button"
                  onClick={() => setVisualError(null)}
                  className="text-red-400 hover:text-red-600 font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            {visualSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start justify-between gap-2">
                <span>✓ {visualSuccess}</span>
                <button
                  type="button"
                  onClick={() => setVisualSuccess(null)}
                  className="text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Quick Inspiration Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Quick Style Presets (Click to apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setVisualDraft(preset.prompt);
                      if (visualSuccess) setVisualSuccess(null);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 text-xs font-medium text-slate-700 transition cursor-pointer"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveVisual} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <label
                    htmlFor="channel-visual-style"
                    className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]"
                  >
                    Style Prompt / Visual Direction
                  </label>
                  <span
                    className={`font-mono text-xs ${
                      currentVisualValue.length > MAX_VISUAL_STYLE_LENGTH
                        ? "text-red-600 font-bold"
                        : currentVisualValue.length >= VISUAL_STYLE_WARNING_THRESHOLD
                        ? "text-amber-600 font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    {currentVisualValue.length} / 2,000 characters
                  </span>
                </div>

                <textarea
                  id="channel-visual-style"
                  rows={5}
                  maxLength={MAX_VISUAL_STYLE_LENGTH}
                  value={currentVisualValue}
                  onChange={(e) => {
                    setVisualDraft(e.target.value);
                    if (visualSuccess) setVisualSuccess(null);
                  }}
                  placeholder="e.g. Crisp 3D render, Pixar style, vivid saturated colors, soft cinematic studio lighting..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 leading-relaxed font-sans placeholder:text-slate-400"
                />

                {isVisualDefault && currentVisualValue.trim().length === 0 && (
                  <p className="mt-2 text-xs text-slate-500 italic">
                    Using the default clean 3D render style. Write your own custom prompt or select a preset above to override it.
                  </p>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetVisual}
                  disabled={isVisualDefault || isVisualBusy}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isResettingVisual ? "Resetting..." : "Reset to default style"}
                </button>

                <div className="flex items-center gap-3">
                  {isVisualDirty && (
                    <button
                      type="button"
                      onClick={() => setVisualDraft(null)}
                      disabled={isVisualBusy}
                      className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Discard changes
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!isVisualDirty || isVisualBusy}
                    className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                  >
                    {isSavingVisual ? "Saving..." : "Save Visual Style"}
                  </button>
                </div>
              </div>
            </form>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">How Visual Style works:</p>
              <p>
                When generating or regenerating storyboards for this channel, this prompt prefix is automatically injected
                into every image generation request to maintain consistent branding and art direction.
              </p>
              <p className="text-[11px] text-slate-400 pt-1">
                Note: Changes apply to storyboards created or regenerated after saving. Existing storyboards are not altered.
              </p>
            </div>
          </div>
        )}

        {/* --- Tab 2: General Info --- */}
        {activeTab === "general" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">General Information</h2>
              <p className="text-xs text-slate-500 mt-1">
                Update the channel name, handle, and target niche.
              </p>
            </div>

            {/* Alerts */}
            {generalError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex items-start justify-between gap-2">
                <span>{generalError}</span>
                <button
                  type="button"
                  onClick={() => setGeneralError(null)}
                  className="text-red-400 hover:text-red-600 font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            {generalSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start justify-between gap-2">
                <span>✓ {generalSuccess}</span>
                <button
                  type="button"
                  onClick={() => setGeneralSuccess(null)}
                  className="text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            <form onSubmit={handleSaveGeneral} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Channel Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={currentName}
                  onChange={(e) => {
                    setGeneralNameDraft(e.target.value);
                    if (generalSuccess) setGeneralSuccess(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Channel Handle
                </label>
                <input
                  type="text"
                  value={currentHandle}
                  onChange={(e) => {
                    setGeneralHandleDraft(e.target.value);
                    if (generalSuccess) setGeneralSuccess(null);
                  }}
                  placeholder="@yourhandle"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Target Niche / Category
                </label>
                <input
                  type="text"
                  value={currentNiche}
                  onChange={(e) => {
                    setGeneralNicheDraft(e.target.value);
                    if (generalSuccess) setGeneralSuccess(null);
                  }}
                  placeholder="e.g. Science Facts, Luxury & Wealth, True Crime"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Platform
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                      channel.platform === "youtube"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-pink-50 text-pink-700 border border-pink-200"
                    }`}
                  >
                    {channel.platform}
                  </span>
                  <span className="text-xs text-slate-400">Platform is set upon channel creation.</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                {isGeneralDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setGeneralNameDraft(null);
                      setGeneralHandleDraft(null);
                      setGeneralNicheDraft(null);
                    }}
                    className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Discard
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!isGeneralDirty || isSavingGeneral}
                  className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  {isSavingGeneral ? "Saving..." : "Save Channel Details"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- Tab 3: Voice & Audio --- */}
        {activeTab === "voice-audio" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Voice & Audio Settings</h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure default voiceover pacing, tone, and sound mastering for videos in this channel.
              </p>
            </div>

            {audioSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start justify-between gap-2">
                <span>✓ {audioSuccess}</span>
                <button
                  type="button"
                  onClick={() => setAudioSuccess(null)}
                  className="text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            <div className="space-y-5 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Default Speech Pacing
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "1.0x", label: "Normal (1.0x)", desc: "Clear & balanced" },
                    { id: "1.1x", label: "Dynamic (1.1x)", desc: "Engaging & lively" },
                    { id: "1.2x", label: "Fast (1.2x)", desc: "High retention shorts" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPacing(opt.id)}
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        pacing === opt.id
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-600"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Voice Tone Profile
                </label>
                <select
                  value={voiceTone}
                  onChange={(e) => setVoiceTone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                >
                  <option value="engaging">Conversational & Engaging (General audience)</option>
                  <option value="authoritative">Authoritative & Educational (Documentaries, Science)</option>
                  <option value="dramatic">Dramatic & Suspenseful (Stories, Mysteries)</option>
                  <option value="enthusiastic">Enthusiastic & High-Energy (Hype, Gaming)</option>
                </select>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Automated Audio Normalization:</p>
                <p>
                  Audio voiceovers for this channel are automatically normalized to YouTube/Instagram target loudness
                  (-14 LUFS) with gentle dynamic compression applied during rendering.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setAudioSuccess("Voice & audio preferences saved.")}
                  className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer"
                >
                  Save Audio Preferences
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- Tab 4: Subtitles & Captions --- */}
        {activeTab === "subtitles" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Subtitles & Captions Defaults</h2>
              <p className="text-xs text-slate-500 mt-1">
                Set default subtitle styles, formatting, and positioning for this channel&apos;s short videos.
              </p>
            </div>

            {subtitlesSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start justify-between gap-2">
                <span>✓ {subtitlesSuccess}</span>
                <button
                  type="button"
                  onClick={() => setSubtitlesSuccess(null)}
                  className="text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            <div className="space-y-5 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Default Subtitle Style Preset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "clean_cinematic",
                      name: "Clean Cinematic",
                      desc: "Classic white text with subtle drop shadow",
                    },
                    {
                      id: "remotion_neon",
                      name: "Remotion Neon",
                      desc: "Bold font with electric cyan active highlight",
                    },
                    {
                      id: "dynamic_highlight",
                      name: "Dynamic Highlight",
                      desc: "Uppercase punchy text with yellow active word scale",
                    },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setDefaultSubtitleStyle(style.id)}
                      className={`p-3.5 rounded-lg border text-left transition cursor-pointer ${
                        defaultSubtitleStyle === style.id
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-600"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="text-xs font-semibold">{style.name}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Default Chunking Strategy
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-700">3-5 words per chunk</span>
                  <span className="text-[11px] text-slate-400">
                    (Optimized for rapid mobile short-form readability)
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Video-level overrides:</p>
                <p>
                  You can also preview and change subtitle styles dynamically on any individual video&apos;s detail page
                  before or after rendering.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSubtitlesSuccess("Subtitle style preferences saved.")}
                  className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs cursor-pointer"
                >
                  Save Subtitle Preferences
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
