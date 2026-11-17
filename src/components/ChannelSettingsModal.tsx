"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { api, formatErrorMessage } from "@/lib/api";
import { getChannelVisualStyle } from "@/lib/types";

interface ChannelSettingsModalProps {
  channelId: string;
  channelName?: string;
  savedSettings: unknown;
  isOpen: boolean;
  onClose: () => void;
}

type ModalTabKey = "visual-style" | "general" | "voice-audio" | "subtitles";

const MODAL_STYLE_PRESETS = [
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
];

export function ChannelSettingsModal({
  channelId,
  channelName,
  savedSettings,
  isOpen,
  onClose,
}: ChannelSettingsModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ModalTabKey>("visual-style");

  const savedStyle = getChannelVisualStyle(savedSettings) ?? "";

  // Visual Style Draft state
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentValue = draft !== null ? draft : savedStyle;
  const isDirty = draft !== null && draft.trim() !== savedStyle.trim();
  const isDefault = savedStyle.trim().length === 0;
  const isBusy = isSaving || isResetting;

  // Reset local transient state when modal closes
  const handleClose = () => {
    if (isBusy) return;
    setDraft(null);
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  // Escape key listener to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) {
        setDraft(null);
        setError(null);
        setSuccessMessage(null);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || isBusy) return;

    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const freshChannel = await api.channels.get(channelId);
      const freshSettings =
        freshChannel.settings &&
        typeof freshChannel.settings === "object" &&
        !Array.isArray(freshChannel.settings)
          ? { ...freshChannel.settings }
          : {};

      const trimmed = currentValue.trim();
      if (trimmed.length > 0) {
        freshSettings.visual_style = trimmed;
      } else {
        delete freshSettings.visual_style;
      }

      await api.channels.update(channelId, { settings: freshSettings });

      setDraft(null);
      setSuccessMessage("Visual style saved successfully.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["channel", channelId] }),
        queryClient.invalidateQueries({ queryKey: ["channels"] }),
      ]);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (isBusy) return;

    const confirmed = window.confirm(
      "Reset visual style to default? This will remove custom visual styling for this channel."
    );
    if (!confirmed) return;

    setError(null);
    setSuccessMessage(null);
    setIsResetting(true);

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

      setDraft(null);
      setSuccessMessage("Visual style reset to default clean 3D render style.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["channel", channelId] }),
        queryClient.invalidateQueries({ queryKey: ["channels"] }),
      ]);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Channel Settings</h2>
                <Link
                  href={`/channels/${channelId}/settings`}
                  onClick={handleClose}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline inline-flex items-center gap-0.5"
                >
                  <span>Open full page</span>
                  <span>&rarr;</span>
                </Link>
              </div>
              {channelName && (
                <p className="text-xs text-slate-500 truncate max-w-sm">{channelName}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 text-xl cursor-pointer leading-none transition hover:bg-slate-100"
            aria-label="Close settings"
          >
            &times;
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 overflow-x-auto bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("visual-style")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === "visual-style"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/40"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>🎨</span>
            <span>Visual Style</span>
            {!isDefault && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === "general"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/40"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>⚙️</span>
            <span>General Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("voice-audio")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === "voice-audio"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/40"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>🎙️</span>
            <span>Voice & Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("subtitles")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === "subtitles"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/40"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📝</span>
            <span>Subtitles</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Section: Visual Style */}
          {activeTab === "visual-style" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Visual Style & Art Direction</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        !isDefault
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {!isDefault ? "Custom style active" : "Using default style"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Set the visual look, art style, and camera direction applied to all video storyboards in this channel.
                  </p>
                </div>

                {isDirty && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold self-start sm:self-center shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                    Unsaved changes
                  </span>
                )}
              </div>

              {/* Success & Error alerts */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start justify-between gap-2">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600 font-bold cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              )}

              {successMessage && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start justify-between gap-2">
                  <span>✓ {successMessage}</span>
                  <button
                    type="button"
                    onClick={() => setSuccessMessage(null)}
                    className="text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Quick Inspiration Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Presets (Click to pre-fill)
                </span>
                <div className="flex flex-wrap gap-2">
                  {MODAL_STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setDraft(preset.prompt);
                        if (successMessage) setSuccessMessage(null);
                      }}
                      className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-xs text-slate-700 transition cursor-pointer"
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form */}
              <form id="channel-settings-form" onSubmit={handleSave} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <label
                      htmlFor={`visual-style-${channelId}`}
                      className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]"
                    >
                      Style Prompt / Visual Direction
                    </label>
                    <span
                      className={`font-mono text-[11px] ${
                        currentValue.length >= 580 ? "text-amber-600 font-bold" : "text-slate-400"
                      }`}
                    >
                      {currentValue.length} / 600 characters
                    </span>
                  </div>

                  <textarea
                    id={`visual-style-${channelId}`}
                    rows={5}
                    maxLength={600}
                    value={currentValue}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (successMessage) setSuccessMessage(null);
                    }}
                    placeholder="e.g. Crisp 3D render, Pixar style, vivid saturated colors, soft cinematic studio lighting..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 leading-relaxed font-sans placeholder:text-slate-400"
                  />

                  {isDefault && currentValue.trim().length === 0 && (
                    <p className="mt-1.5 text-xs text-slate-500 italic">
                      Using the default clean 3D render style. Write your own prompt to override it for this channel.
                    </p>
                  )}
                </div>
              </form>

              <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                Note: Changes apply to storyboards generated or regenerated after saving. Existing storyboards are not changed.
              </p>
            </div>
          )}

          {/* Section: General Info */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">General Information</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  View and manage channel identification. To edit name or handle, you can also use the full settings page.
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs space-y-2">
                <div>
                  <span className="font-semibold text-slate-700">Channel Name:</span>{" "}
                  <span className="text-slate-900">{channelName || "Channel"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Channel ID:</span>{" "}
                  <span className="font-mono text-slate-600">{channelId}</span>
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href={`/channels/${channelId}/settings`}
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 transition"
                >
                  <span>Edit in full page view &rarr;</span>
                </Link>
              </div>
            </div>
          )}

          {/* Section: Voice & Audio */}
          {activeTab === "voice-audio" && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Voice & Audio Settings</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure default voice pacing and automatic loudness normalization for this channel.
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">Target Loudness Normalization:</p>
                <p>All voiceovers generated in this channel are normalized to -14 LUFS standard.</p>
              </div>
              <div className="pt-2">
                <Link
                  href={`/channels/${channelId}/settings`}
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 transition"
                >
                  <span>Manage in full page view &rarr;</span>
                </Link>
              </div>
            </div>
          )}

          {/* Section: Subtitles */}
          {activeTab === "subtitles" && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Subtitles & Captions Defaults</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the default subtitle style preset (Clean Cinematic, Remotion Neon, Dynamic Highlight).
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">Available styles:</p>
                <p>Clean Cinematic, Remotion Neon, Dynamic Highlight.</p>
              </div>
              <div className="pt-2">
                <Link
                  href={`/channels/${channelId}/settings`}
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 transition"
                >
                  <span>Manage in full page view &rarr;</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
          {activeTab === "visual-style" ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={isDefault || isBusy}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isResetting ? "Resetting..." : "Reset to default"}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {activeTab === "visual-style" && isDirty && (
              <button
                type="button"
                onClick={() => setDraft(null)}
                disabled={isBusy}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Discard changes
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
            >
              Close
            </button>
            {activeTab === "visual-style" && (
              <button
                type="submit"
                form="channel-settings-form"
                disabled={!isDirty || isBusy}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
