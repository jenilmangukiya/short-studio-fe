"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatErrorMessage } from "@/lib/api";
import {
  type VideoDetail,
  type VisualStyleId,
} from "@/lib/types";
import { useVisualStyles } from "@/lib/useVisualStyles";
import {
  getVideoEffectiveStyleId,
  getVideoStyleDisplayName,
  getStyleVisualMeta,
  invalidateVideoStyleQueries,
  isLegacyVideo,
} from "@/lib/visual-style-ui";
import { VisualStyleSelector, StyleMotifIcon } from "@/components/VisualStyleSelector";

export interface ChangeVisualStyleModalProps {
  video: VideoDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedVideo: VideoDetail) => void;
}

export function ChangeVisualStyleModal(props: ChangeVisualStyleModalProps) {
  if (!props.isOpen) return null;
  return (
    <ChangeVisualStyleModalDialog
      key={`${props.video.id}-${props.video.visual_style_id || "legacy"}`}
      {...props}
    />
  );
}

function ChangeVisualStyleModalDialog({
  video,
  onClose,
  onSuccess,
}: ChangeVisualStyleModalProps) {
  const queryClient = useQueryClient();
  const { data: catalogData } = useVisualStyles();
  const styles = catalogData?.styles || [];

  const currentEffectiveStyleId = getVideoEffectiveStyleId(video);
  const isLegacy = isLegacyVideo(video);
  const currentDisplayName = getVideoStyleDisplayName(video, styles);

  const [selectedStyleId, setSelectedStyleId] = useState<VisualStyleId>(currentEffectiveStyleId);
  const [modalError, setModalError] = useState<string | null>(null);

  const updateStyleMutation = useMutation({
    mutationFn: (newStyleId: VisualStyleId) =>
      api.videos.updateVisualStyle(video.id, newStyleId),
    onSuccess: async (updatedVideo) => {
      // Immediately update video cache with updatedVideo so UI steps synchronously update
      queryClient.setQueryData(["video", video.id], updatedVideo);

      // Cleanly cancel, evict stale image queries, and invalidate video/channel queries
      await invalidateVideoStyleQueries(queryClient, video.id, video.channel_id);
      onSuccess?.(updatedVideo);
      onClose();
    },
    onError: (err) => {
      setModalError(formatErrorMessage(err));
    },
  });

  const isCurrentSelection = selectedStyleId === currentEffectiveStyleId;
  const currentMeta = getStyleVisualMeta(currentEffectiveStyleId);
  const selectedMeta = getStyleVisualMeta(selectedStyleId);
  const selectedDisplayName =
    styles.find((s) => s.id === selectedStyleId)?.name || selectedStyleId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCurrentSelection || updateStyleMutation.isPending) {
      return;
    }
    setModalError(null);
    updateStyleMutation.mutate(selectedStyleId);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-visual-style-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-2xs"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎨</span>
            <div>
              <h3
                id="change-visual-style-title"
                className="text-base font-bold text-slate-900"
              >
                Change Visual Style
              </h3>
              <p className="text-xs text-slate-500">
                Override the visual direction and aesthetic preset for this video
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updateStyleMutation.isPending}
            className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer leading-none p-1 disabled:opacity-50"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Action Error Alert */}
        {modalError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Failed to update visual style</span>
            </p>
            <p className="text-red-600">{modalError}</p>
          </div>
        )}

        {/* Warning Callout: Invalidation Impact */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-1 shadow-2xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-950">
            <span>⚠️</span>
            <span>Regeneration & Asset Invalidation Notice</span>
          </div>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            Changing visual style recomposes visual prompts for all storyboard scenes and
            invalidates existing scene images, render animations, and captioned video.
            Creative brief, script, Video Bible, and voiceover audio are safely preserved.
          </p>
        </div>

        {/* Current vs Target Comparison Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          {/* Currently Applied */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Current Visual Style
            </span>
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-md bg-gradient-to-br ${currentMeta.gradientClass} border ${currentMeta.accentBorderClass} flex items-center justify-center shrink-0`}
              >
                <StyleMotifIcon iconName={currentMeta.iconName} className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 truncate block">
                  {currentDisplayName}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {isLegacy ? "Historical Legacy Baseline" : `Preset: ${currentEffectiveStyleId}`}
                </span>
              </div>
            </div>
          </div>

          {/* Target Selected */}
          <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              New Target Preset
            </span>
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-md bg-gradient-to-br ${selectedMeta.gradientClass} border ${selectedMeta.accentBorderClass} flex items-center justify-center shrink-0`}
              >
                <StyleMotifIcon iconName={selectedMeta.iconName} className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate block">
                  {selectedDisplayName}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    isCurrentSelection ? "text-slate-400" : "text-indigo-600"
                  }`}
                >
                  {isCurrentSelection ? "No change selected" : "Ready to apply"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Style Preset Selector */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <VisualStyleSelector
            value={selectedStyleId}
            onChange={(styleId) => {
              if (styleId) {
                setSelectedStyleId(styleId);
              }
            }}
            allowDeselect={false}
            hideResetButton={true}
            hideStatusBanner={true}
            label="Select New Visual Style Preset"
            disabled={updateStyleMutation.isPending}
          />

          {/* Submission Guidance Note */}
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            {isCurrentSelection ? (
              <span className="text-slate-400 italic">
                ℹ️ The video already uses &ldquo;{currentDisplayName}&rdquo;. Select a different preset to enable updates.
              </span>
            ) : (
              <span className="text-indigo-600 font-medium">
                ✓ Ready to switch from &ldquo;{currentDisplayName}&rdquo; to &ldquo;{selectedDisplayName}&rdquo;.
              </span>
            )}
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={updateStyleMutation.isPending}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isCurrentSelection || updateStyleMutation.isPending}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs flex items-center gap-2"
            >
              {updateStyleMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Updating Style...</span>
                </>
              ) : (
                <span>Confirm & Apply Style</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
