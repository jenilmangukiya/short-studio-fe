"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, formatErrorMessage } from "@/lib/api";
import { getChannelVisualStyle } from "@/lib/types";

interface ChannelVisualStyleEditorProps {
  channelId: string;
  savedSettings: unknown;
}

export function ChannelVisualStyleEditor({
  channelId,
  savedSettings,
}: ChannelVisualStyleEditorProps) {
  const queryClient = useQueryClient();
  const savedStyle = getChannelVisualStyle(savedSettings) ?? "";

  // Draft-vs-saved pattern without useEffect:
  // draft is null until user edits; shown value = draft ?? savedStyle
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentValue = draft !== null ? draft : savedStyle;
  const isDirty = draft !== null && draft.trim() !== savedStyle.trim();
  const isDefault = savedStyle.trim().length === 0;
  const isBusy = isSaving || isResetting;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || isBusy) return;

    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      // 1. Freshly fetch the channel immediately before saving to prevent overwriting concurrent changes
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
        // If saved text is empty, remove the visual_style key instead of sending empty string
        delete freshSettings.visual_style;
      }

      // 2. PATCH channel with merged settings
      await api.channels.update(channelId, { settings: freshSettings });

      // 3. Clear draft and set success
      setDraft(null);
      setSuccessMessage("Visual style saved successfully.");

      // 4. Invalidate every channel-related query key used in the app
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
      // 1. Freshly fetch the channel immediately before resetting
      const freshChannel = await api.channels.get(channelId);
      const freshSettings =
        freshChannel.settings &&
        typeof freshChannel.settings === "object" &&
        !Array.isArray(freshChannel.settings)
          ? { ...freshChannel.settings }
          : {};

      delete freshSettings.visual_style;

      // 2. PATCH channel with merged settings
      await api.channels.update(channelId, { settings: freshSettings });

      // 3. Clear draft and set success
      setDraft(null);
      setSuccessMessage("Visual style reset to default clean 3D render style.");

      // 4. Invalidate every channel-related query key used in the app
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
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Visual Style</h2>
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
            Set the default visual look and camera rendering style for all video storyboards in this channel.
          </p>
        </div>

        {/* Unsaved changes indicator */}
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold self-start sm:self-center">
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

      {/* Textarea Form */}
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1 text-xs">
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
            rows={4}
            maxLength={600}
            value={currentValue}
            onChange={(e) => {
              setDraft(e.target.value);
              if (successMessage) setSuccessMessage(null);
            }}
            placeholder="e.g. Crisp 3D render, Pixar style, vivid saturated colors, soft cinematic studio lighting..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 leading-relaxed font-sans placeholder:text-slate-400"
          />

          {/* Helper text when empty */}
          {isDefault && currentValue.trim().length === 0 && (
            <p className="mt-1.5 text-xs text-slate-500 italic">
              Using the default clean 3D render style. Write your own to override it for this channel.
            </p>
          )}
        </div>

        {/* Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleReset}
            disabled={isDefault || isBusy}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isResetting ? "Resetting..." : "Reset to default"}
          </button>

          <div className="flex items-center gap-2">
            {isDirty && (
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
              type="submit"
              disabled={!isDirty || isBusy}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Style"}
            </button>
          </div>
        </div>
      </form>

      {/* Note under the card */}
      <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
        Note: Changes apply to storyboards generated or regenerated after saving. Existing storyboards are not changed.
      </p>
    </div>
  );
}
