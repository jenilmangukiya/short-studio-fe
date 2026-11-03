"use client";

import { useId, useState } from "react";
import type {
  BeatTelemetryInfo,
  VisualBeat,
} from "@/lib/types";
import {
  type BeatCorrelationResult,
  type CorrelatedBeatItem,
  type CorrelatedSceneItem,
  computeBeatSegmentGeometry,
  computeSceneTrackGeometry,
  computeTimelineMetrics,
  formatTimestamp,
  getTimelineTelemetryDisplay,
  getTimelineTimingBadge,
} from "@/lib/storyboard";

export interface StoryboardTimelineProps {
  /**
   * Pre-correlated pipeline data from Stage 3.5.5.1 helper correlateBeatsWithTelemetry.
   * Contains hierarchical scenes, visual beats, and render telemetry.
   */
  correlation?: BeatCorrelationResult | null;
  /**
   * Alternative direct scenes list if not passing full BeatCorrelationResult.
   */
  scenes?: CorrelatedSceneItem[] | null;
  /**
   * Optional override for total timeline duration in seconds.
   */
  totalDurationSeconds?: number | null;
  /**
   * Optional custom title for the timeline header.
   */
  title?: string;
  /**
   * Optional callback when a user clicks/selects a beat.
   */
  onSelectBeat?: (sceneIndex: number, beat: VisualBeat, telemetry: BeatTelemetryInfo) => void;
  /**
   * Optional callback when a user clicks/selects a scene.
   */
  onSelectScene?: (sceneIndex: number) => void;
  /**
   * Optional initially selected or controlled selected beat ID.
   */
  selectedBeatId?: string | null;
  /**
   * Additional container CSS classes.
   */
  className?: string;
}

/**
 * Reusable standalone component visually representing scene and visual-beat timing
 * on a single continuous time scale, distinguished by executed render telemetry,
 * voiceover alignment, and scene fallback states.
 */
export function StoryboardTimeline({
  correlation,
  scenes: directScenes,
  totalDurationSeconds,
  title = "Storyboard & Beat Timeline",
  onSelectBeat,
  onSelectScene,
  selectedBeatId,
  className = "",
}: StoryboardTimelineProps) {
  const componentId = useId();
  const [internalSelectedBeatKey, setInternalSelectedBeatKey] = useState<string | null>(null);
  const [showAccessibleTable, setShowAccessibleTable] = useState(false);

  // 1. Resolve scenes list
  const scenes: CorrelatedSceneItem[] = correlation?.scenes ?? directScenes ?? [];

  // 2. Empty state check
  if (!scenes || scenes.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center ${className}`}
        role="region"
        aria-label={title}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3 text-xl">
          📊
        </div>
        <h3 className="text-sm font-semibold text-slate-800">No Timeline Data</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          No storyboard scenes or visual beats are currently available to display on the timeline.
        </p>
      </div>
    );
  }

  // 3. Compute continuous timeline bounds and metrics
  const metrics = computeTimelineMetrics(scenes, totalDurationSeconds);
  const {
    effectiveTotalDuration,
    hasContinuousTiming,
    totalBeatsCount,
    pendingBeatsCount,
    renderedCount: calculatedRenderedCount,
    fallbackCount: calculatedFallbackCount,
    rulerTicks,
  } = metrics;

  // Active selected beat
  const activeSelectedKey = selectedBeatId ?? internalSelectedBeatKey;

  // Find active selected beat item for inspector
  let activeSelectedBeatItem: CorrelatedBeatItem | null = null;
  if (activeSelectedKey) {
    for (const scene of scenes) {
      for (const b of scene.beats) {
        const beatKey = b.beat.id || `${scene.index}_${b.beat.order}`;
        if (beatKey === activeSelectedKey || b.beat.id === activeSelectedKey) {
          activeSelectedBeatItem = b;
          break;
        }
      }
      if (activeSelectedBeatItem) break;
    }
  }

  const handleBeatClick = (sceneIndex: number, beatItem: CorrelatedBeatItem) => {
    const beatKey = beatItem.beat.id || `${sceneIndex}_${beatItem.beat.order}`;
    setInternalSelectedBeatKey(beatKey);
    onSelectBeat?.(sceneIndex, beatItem.beat, beatItem.telemetry);
  };

  const handleSceneClick = (sceneIndex: number) => {
    onSelectScene?.(sceneIndex);
  };

  // Metrics summary
  const renderedCount = correlation?.renderedBeatsCount ?? calculatedRenderedCount;
  const fallbackCount = correlation?.fallbackBeatsCount ?? calculatedFallbackCount;
  const isStale = Boolean(correlation?.isRenderStale);

  return (
    <section
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 space-y-5 shadow-2xs ${className}`}
      aria-label={title}
      id={`timeline-${componentId}`}
    >
      {/* Top Header: Title, Metric Pills, and Accessibility Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
            {isStale && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-purple-50 text-purple-700 border border-purple-200">
                <span>🔄</span>
                <span>Render Stale</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuous timeline showing scene boundaries, visual beats, and executed renderer telemetry.
          </p>
        </div>

        {/* Metrics Summary & Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {effectiveTotalDuration !== null && (
            <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
              <span>⏱️</span>
              <span>{formatTimestamp(effectiveTotalDuration)}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
            <span>Scenes: {scenes.length}</span>
          </span>

          {totalBeatsCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
              <span>Beats: {totalBeatsCount}</span>
            </span>
          )}

          {renderedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span>Rendered: {renderedCount}</span>
            </span>
          )}

          {fallbackCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <span>Fallback: {fallbackCount}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowAccessibleTable((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            aria-expanded={showAccessibleTable}
            aria-controls={`accessible-table-${componentId}`}
          >
            <span>{showAccessibleTable ? "Hide" : "Show"} Details Table</span>
          </button>
        </div>
      </div>

      {/* Visual Timeline Section */}
      <div className="space-y-3">
        {hasContinuousTiming && effectiveTotalDuration ? (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[720px] space-y-2 select-none">
              {/* 1. Time Ruler / Axis */}
              <div
                className="relative h-5 w-full border-b border-slate-200 text-[10px] font-mono text-slate-400 select-none"
                aria-hidden="true"
              >
                {rulerTicks.map((tick) => (
                  <div
                    key={tick.ratio}
                    className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${tick.percent}%` }}
                  >
                    <span className="leading-none">{tick.timestamp}</span>
                    <div className="h-1.5 w-px bg-slate-300 mt-0.5" />
                  </div>
                ))}
              </div>

              {/* 2. Scene Grouping Track */}
              <div
                className="relative h-7 w-full bg-slate-100/70 rounded-lg overflow-hidden border border-slate-200"
                aria-label="Scene tracks"
              >
                {scenes.map((sceneItem: CorrelatedSceneItem) => {
                  const scGeom = computeSceneTrackGeometry(sceneItem, effectiveTotalDuration);
                  if (scGeom.leftPercent === null || scGeom.widthPercent === null || scGeom.startTime === null || scGeom.endTime === null) {
                    return null;
                  }

                  const scIdx = scGeom.sceneIndex;
                  return (
                    <div
                      key={`scene-track-${scIdx}`}
                      onClick={() => handleSceneClick(scIdx)}
                      className={`absolute top-0 bottom-0 border-r border-slate-300 px-2 flex items-center justify-between text-[11px] font-semibold transition cursor-pointer hover:bg-slate-200/80 ${
                        scGeom.hasFallback ? "bg-amber-100/70 text-amber-900" : "bg-slate-200/50 text-slate-700"
                      }`}
                      style={{ left: `${scGeom.leftPercent}%`, width: `${scGeom.widthPercent}%` }}
                      title={`Scene ${scIdx}: ${formatTimestamp(scGeom.startTime)} – ${formatTimestamp(scGeom.endTime)}${
                        scGeom.hasFallback ? ` (Fallback: ${scGeom.fallbackReason})` : ""
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSceneClick(scIdx);
                        }
                      }}
                      aria-label={`Scene ${scIdx}, timing: ${formatTimestamp(scGeom.startTime)} to ${formatTimestamp(scGeom.endTime)}${
                        scGeom.hasFallback ? `, fallback applied: ${scGeom.fallbackReason}` : ""
                      }`}
                    >
                      <span className="truncate">Scene {scIdx}</span>
                      <span className="font-mono text-[9px] font-normal opacity-75 shrink-0 ml-1">
                        {scGeom.durationSeconds !== null ? `${scGeom.durationSeconds.toFixed(1)}s` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 3. Visual Beat Segments Track */}
              <div
                className="relative h-10 w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200"
                aria-label="Visual beat segments"
              >
                {scenes.map((sceneItem: CorrelatedSceneItem) =>
                  sceneItem.beats.map((beatItem: CorrelatedBeatItem) => {
                    const beatGeom = computeBeatSegmentGeometry(beatItem, effectiveTotalDuration);
                    if (beatGeom.leftPercent === null || beatGeom.widthPercent === null) {
                      return null;
                    }

                    const beat = beatItem.beat;
                    const beatKey = beatGeom.beatKey;
                    const isSelected = activeSelectedKey === beatKey || activeSelectedKey === beat.id;

                    return (
                      <div
                        key={`beat-segment-${beatKey}`}
                        onClick={() => handleBeatClick(sceneItem.index, beatItem)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleBeatClick(sceneItem.index, beatItem);
                          }
                        }}
                        style={{ left: `${beatGeom.leftPercent}%`, width: `${beatGeom.widthPercent}%` }}
                        className={`absolute top-0 bottom-0 border-r flex flex-col justify-center px-1.5 transition cursor-pointer overflow-hidden ${
                          beatGeom.telemetryDisplay.barBg
                        } ${beatGeom.telemetryDisplay.barBorder} ${
                          isSelected
                            ? "ring-2 ring-indigo-500 ring-offset-2 z-10"
                            : "hover:brightness-95 hover:z-5"
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Beat ${sceneItem.index}.${beat.order}: ${beatGeom.telemetryDisplay.accessibleText}. Timing: ${beatGeom.formattedInterval}`}
                        title={`Beat #${sceneItem.index}.${beat.order} [${beat.shot_type || "shot"}] • ${
                          beatGeom.telemetryDisplay.label
                        } • ${beatGeom.formattedInterval}`}
                      >
                        <div className="flex items-center justify-between gap-1 leading-tight">
                          <span className="font-bold text-[10px] truncate">
                            #{sceneItem.index}.${beat.order}
                          </span>
                          <span className="text-[9px] font-bold opacity-90">{beatGeom.telemetryDisplay.icon}</span>
                        </div>
                        <div className="text-[9px] font-mono opacity-85 truncate leading-none">
                          {beatGeom.durationSeconds ? `${beatGeom.durationSeconds.toFixed(1)}s` : ""}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Informative Banner when continuous timestamps are not yet established */
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
              <span>⏱️</span>
              <span>Pending Narration Alignment</span>
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Visual beat timestamps will be plotted on the continuous time ruler once voiceover audio is
              synthesized and word-aligned.
            </p>
          </div>
        )}

        {/* Legend */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-[11px] text-slate-600 border-t border-slate-100"
          aria-label="Timeline legend"
        >
          <span className="font-medium text-slate-800 text-xs">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-emerald-600 inline-block border border-emerald-700" />
            <span>Rendered Beat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-amber-500 inline-block border border-amber-600 border-dashed" />
            <span>Scene Fallback</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-purple-600 inline-block border border-purple-800 border-dashed" />
            <span>Stale Render</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-slate-400 inline-block border border-slate-500" />
            <span>Not Rendered</span>
          </div>
        </div>
      </div>

      {/* Pending Beats Section (if any beats lack continuous timestamps) */}
      {pendingBeatsCount > 0 && (
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Pending Voiceover Alignment ({pendingBeatsCount})
            </span>
            <span className="text-[11px] text-slate-500">Awaiting audio synthesis</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {scenes.flatMap((sc: CorrelatedSceneItem) =>
              sc.beats
                .filter((b: CorrelatedBeatItem) => b.resolvedTiming.isPending)
                .map((b: CorrelatedBeatItem) => {
                  const key = b.beat.id || `${sc.index}_${b.beat.order}`;
                  return (
                    <button
                      key={`pending-beat-${key}`}
                      type="button"
                      onClick={() => handleBeatClick(sc.index, b)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
                      title={b.beat.narration_text}
                    >
                      <span className="font-bold text-slate-900">
                        #{sc.index}.{b.beat.order}
                      </span>
                      {b.beat.shot_type && (
                        <span className="text-[10px] uppercase font-semibold text-slate-500">
                          {b.beat.shot_type}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">⏱️ Pending</span>
                    </button>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Selected Beat Detailed Inspector */}
      {activeSelectedBeatItem && (
        <div
          className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3 transition"
          aria-live="polite"
          aria-label="Selected beat details"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 items-center justify-center rounded px-2 bg-indigo-600 text-white font-bold text-xs">
                #{activeSelectedBeatItem.sceneIndex}.{activeSelectedBeatItem.beat.order}
              </span>
              <h4 className="text-sm font-semibold text-slate-900">
                Scene {activeSelectedBeatItem.sceneIndex}, Beat #{activeSelectedBeatItem.beat.order}
              </h4>
              {activeSelectedBeatItem.beat.shot_type && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-white text-slate-700 border border-slate-200">
                  {activeSelectedBeatItem.beat.shot_type}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Telemetry Status Badge */}
              {(() => {
                const telDisplay = getTimelineTelemetryDisplay(activeSelectedBeatItem.telemetry);
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${telDisplay.badgeStyle}`}
                  >
                    <span>{telDisplay.icon}</span>
                    <span>{telDisplay.label}</span>
                  </span>
                );
              })()}

              {/* Timing Badge */}
              {(() => {
                const tb = getTimelineTimingBadge(activeSelectedBeatItem.resolvedTiming);
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-medium border ${tb.badgeStyle}`}
                  >
                    <span>{tb.icon}</span>
                    <span>{tb.label}</span>
                  </span>
                );
              })()}

              <button
                type="button"
                onClick={() => setInternalSelectedBeatKey(null)}
                className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-200 transition cursor-pointer"
                aria-label="Close inspector"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Spoken Narration */}
          {activeSelectedBeatItem.beat.narration_text && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                Spoken Narration
              </span>
              <p className="text-xs text-slate-800 italic bg-white p-2.5 rounded-lg border border-indigo-100/70">
                &ldquo;{activeSelectedBeatItem.beat.narration_text}&rdquo;
              </p>
            </div>
          )}

          {/* Visual Description & Purpose */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSelectedBeatItem.beat.visual_description && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                  Visual Description
                </span>
                <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-indigo-100/70">
                  {activeSelectedBeatItem.beat.visual_description}
                </p>
              </div>
            )}

            {activeSelectedBeatItem.beat.visual_purpose && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                  Visual Purpose
                </span>
                <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-indigo-100/70">
                  {activeSelectedBeatItem.beat.visual_purpose}
                </p>
              </div>
            )}
          </div>

          {/* Telemetry and Motion Metadata Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white p-2 rounded-lg border border-indigo-100/70">
              <span className="text-[10px] text-slate-500 block">Timing Interval</span>
              <span className="font-mono font-medium text-slate-800">
                {activeSelectedBeatItem.resolvedTiming.formattedInterval}
              </span>
            </div>

            <div className="bg-white p-2 rounded-lg border border-indigo-100/70">
              <span className="text-[10px] text-slate-500 block">Duration / Frames</span>
              <span className="font-mono font-medium text-slate-800">
                {activeSelectedBeatItem.resolvedTiming.durationSeconds
                  ? `${activeSelectedBeatItem.resolvedTiming.durationSeconds.toFixed(2)}s`
                  : "–"}
                {activeSelectedBeatItem.resolvedTiming.frames
                  ? ` (${activeSelectedBeatItem.resolvedTiming.frames} frames)`
                  : ""}
              </span>
            </div>

            <div className="bg-white p-2 rounded-lg border border-indigo-100/70">
              <span className="text-[10px] text-slate-500 block">Timing Source</span>
              <span className="capitalize font-medium text-slate-800">
                {activeSelectedBeatItem.resolvedTiming.source}
              </span>
            </div>

            <div className="bg-white p-2 rounded-lg border border-indigo-100/70">
              <span className="text-[10px] text-slate-500 block">Camera / Motion</span>
              <span className="capitalize font-medium text-slate-800">
                {activeSelectedBeatItem.beat.camera_angle ||
                  (activeSelectedBeatItem.telemetry.status === "rendered"
                    ? activeSelectedBeatItem.telemetry.animation.animation_type
                    : "Default")}
              </span>
            </div>
          </div>

          {/* Fallback Reason (if applicable) */}
          {activeSelectedBeatItem.telemetry.status === "scene_fallback" && (
            <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200">
              <span className="font-semibold">Fallback Reason: </span>
              <span>
                {activeSelectedBeatItem.telemetry.beatFallbackReason ||
                  activeSelectedBeatItem.telemetry.fallbackReason}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Accessible Table / Semantic List View (for screen readers & keyboard inspection) */}
      <div
        id={`accessible-table-${componentId}`}
        className={showAccessibleTable ? "block mt-4" : "sr-only"}
        aria-hidden={!showAccessibleTable}
      >
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th scope="col" className="p-2.5">Scene / Beat</th>
                <th scope="col" className="p-2.5">Status</th>
                <th scope="col" className="p-2.5">Timing Source</th>
                <th scope="col" className="p-2.5">Interval</th>
                <th scope="col" className="p-2.5">Duration</th>
                <th scope="col" className="p-2.5">Frames</th>
                <th scope="col" className="p-2.5">Narration / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-800">
              {scenes.map((sceneItem) => {
                if (sceneItem.beats.length === 0) {
                  // Legacy scene row
                  return (
                    <tr key={`legacy-row-${sceneItem.index}`} className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold">Scene {sceneItem.index} (Legacy)</td>
                      <td className="p-2.5">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          Scene-level
                        </span>
                      </td>
                      <td className="p-2.5">Storyboard</td>
                      <td className="p-2.5 font-mono">
                        {sceneItem.scene.start_time != null && sceneItem.scene.end_time != null
                          ? `${formatTimestamp(sceneItem.scene.start_time)} – ${formatTimestamp(sceneItem.scene.end_time)}`
                          : "–"}
                      </td>
                      <td className="p-2.5 font-mono">
                        {sceneItem.scene.est_seconds ? `${sceneItem.scene.est_seconds}s` : "–"}
                      </td>
                      <td className="p-2.5">–</td>
                      <td className="p-2.5 truncate max-w-xs">{sceneItem.scene.narration}</td>
                    </tr>
                  );
                }

                return sceneItem.beats.map((beatItem: CorrelatedBeatItem) => {
                  const b = beatItem.beat;
                  const key = b.id || `${sceneItem.index}_${b.order}`;
                  const tel = getTimelineTelemetryDisplay(beatItem.telemetry);
                  const tb = getTimelineTimingBadge(beatItem.resolvedTiming);

                  return (
                    <tr
                      key={`accessible-row-${key}`}
                      className={`hover:bg-slate-50/80 cursor-pointer ${
                        activeSelectedKey === key ? "bg-indigo-50/40" : ""
                      }`}
                      onClick={() => handleBeatClick(sceneItem.index, beatItem)}
                    >
                      <td className="p-2.5 font-bold">
                        #{sceneItem.index}.{b.order}
                      </td>
                      <td className="p-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tel.badgeStyle}`}>
                          {tel.label}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${tb.badgeStyle}`}>
                          {tb.label}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono">{beatItem.resolvedTiming.formattedInterval}</td>
                      <td className="p-2.5 font-mono">
                        {beatItem.resolvedTiming.durationSeconds
                          ? `${beatItem.resolvedTiming.durationSeconds.toFixed(2)}s`
                          : "–"}
                      </td>
                      <td className="p-2.5 font-mono">
                        {beatItem.resolvedTiming.frames ? `${beatItem.resolvedTiming.frames}f` : "–"}
                      </td>
                      <td className="p-2.5 max-w-xs">
                        <div className="truncate font-medium">{b.narration_text || "–"}</div>
                        {beatItem.telemetry.status === "scene_fallback" && (
                          <div className="text-[10px] text-amber-700 truncate">
                            Fallback: {beatItem.telemetry.beatFallbackReason || beatItem.telemetry.fallbackReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
