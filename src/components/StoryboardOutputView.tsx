"use client";

import { useMemo, useState } from "react";
import type {
  ImageItem,
  RenderData,
  StoryboardScene,
  VoiceoverItem,
} from "@/lib/types";
import {
  correlateBeatsWithTelemetry,
  hasVisualBeats,
  isSceneAccordionExpanded,
  parseAndValidateStoryboard,
  resolveCorrelatedBeatTiming,
  resolveStoryboardBeatImages,
  toggleSceneAccordion,
  updateSceneInList,
  type BeatCorrelationResult,
  type ValidatedScene,
  type ValidatedStoryboard,
} from "@/lib/storyboard";
import { CollapsibleJson } from "./CollapsibleJson";
import { VisualBeatCard } from "./VisualBeatCard";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { StoryboardTimeline } from "./StoryboardTimeline";

export type { ValidatedScene, ValidatedStoryboard };

interface StoryboardOutputViewProps {
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  onSave?: (updatedScenes: StoryboardScene[]) => Promise<void>;
  isSaving?: boolean;
  videoId?: string;
  imageItems?: ImageItem[];
  voiceoverItems?: VoiceoverItem[];
  renderData?: RenderData | null;
  isRenderStale?: boolean;
  correlation?: BeatCorrelationResult | null;
}

export function StoryboardOutputView({
  output,
  isMock = false,
  isStale = false,
  onSave,
  isSaving = false,
  videoId,
  imageItems,
  voiceoverItems,
  renderData,
  isRenderStale = false,
  correlation: propCorrelation,
}: StoryboardOutputViewProps) {
  const [copyStatus, setCopyStatus] = useState<Record<string, "copied" | "failed">>({});
  const [showRaw, setShowRaw] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedBeats, setExpandedBeats] = useState<Record<number, boolean>>({});
  const [previewModalSceneIndex, setPreviewModalSceneIndex] = useState<number | null>(null);

  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editNarration, setEditNarration] = useState("");
  const [editShotType, setEditShotType] = useState("");

  const handleToggleBeats = (sceneIndex: number) => {
    setExpandedBeats((prev) => toggleSceneAccordion(prev, sceneIndex));
  };

  const startEditing = (scene: ValidatedScene) => {
    setEditingSceneIndex(scene.index);
    setEditPrompt(scene.image_prompt);
    setEditNarration(scene.narration);
    setEditShotType(scene.shot_type);
  };

  const cancelEditing = () => {
    setEditingSceneIndex(null);
  };

  const parsed = useMemo(() => parseAndValidateStoryboard(output), [output]);
  const scenes = useMemo(() => parsed?.scenes ?? [], [parsed]);

  const availableImageIndices = useMemo(() => {
    if (!imageItems || imageItems.length === 0) return undefined;
    return new Set(
      imageItems
        .filter((it) => it.status === "ok" && Boolean(it.file))
        .map((it) => it.index)
    );
  }, [imageItems]);

  const beatImageSources = useMemo(() => {
    return resolveStoryboardBeatImages(scenes, { availableImageIndices });
  }, [scenes, availableImageIndices]);

  const correlation = useMemo(() => {
    if (propCorrelation) return propCorrelation;
    if (!scenes || scenes.length === 0) return null;
    return correlateBeatsWithTelemetry({
      scenes,
      voiceoverItems,
      renderData,
      isRenderStale,
    });
  }, [propCorrelation, scenes, voiceoverItems, renderData, isRenderStale]);

  const handleSelectSceneFromTimeline = (sceneIndex: number) => {
    setExpandedBeats((prev) => ({ ...prev, [sceneIndex]: true }));
    if (typeof document !== "undefined") {
      const el = document.getElementById(`scene-card-${sceneIndex}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSelectBeatFromTimeline = (sceneIndex: number) => {
    setExpandedBeats((prev) => ({ ...prev, [sceneIndex]: true }));
    if (typeof document !== "undefined") {
      const el = document.getElementById(`scene-card-${sceneIndex}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const modalItem: ImageItem | undefined = useMemo(() => {
    if (previewModalSceneIndex === null) return undefined;
    if (imageItems && imageItems.length > 0) {
      const found = imageItems.find((it) => it.index === previewModalSceneIndex);
      if (found) return found;
    }
    const scene = scenes.find((s) => s.index === previewModalSceneIndex);
    return {
      index: previewModalSceneIndex,
      prompt: scene?.image_prompt || "",
      prompt_hash: "",
      file: `scene_${previewModalSceneIndex}.png`,
      status: "ok",
      reused: false,
      model: "",
      size: "",
      quality: "",
      latency_seconds: 0,
    };
  }, [previewModalSceneIndex, imageItems, scenes]);

  const modalAllItems: ImageItem[] = useMemo(() => {
    if (imageItems && imageItems.length > 0) return imageItems;
    return scenes.map((s) => ({
      index: s.index,
      prompt: s.image_prompt,
      prompt_hash: "",
      file: `scene_${s.index}.png`,
      status: "ok",
      reused: false,
      model: "",
      size: "",
      quality: "",
      latency_seconds: 0,
    }));
  }, [imageItems, scenes]);

  const activeModalScene = useMemo(() => {
    if (previewModalSceneIndex === null) return undefined;
    return scenes.find((s) => s.index === previewModalSceneIndex);
  }, [previewModalSceneIndex, scenes]);

  // If payload shape is not recognized or has no valid scenes, defensively fallback to CollapsibleJson
  if (!parsed) {
    return (
      <CollapsibleJson
        data={output}
        mock={isMock}
        defaultOpen={true}
        label="Storyboard payload (unrecognized shape)"
      />
    );
  }

  const { visual_style, style_source, total_seconds, warnings, meta } = parsed;

  const isOutsideRecommended = total_seconds < 45 || total_seconds > 60;

  const handleSaveScene = async (sceneIndex: number) => {
    if (!onSave) return;
    const updatedScenes = updateSceneInList(scenes, sceneIndex, {
      image_prompt: editPrompt,
      narration: editNarration,
      shot_type: editShotType,
    });
    await onSave(updatedScenes);
    setEditingSceneIndex(null);
  };

  const handleCopy = async (key: string, textToCopy: string) => {
    if (isStale) return;

    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus((prev) => ({ ...prev, [key]: "copied" }));
      setTimeout(() => {
        setCopyStatus((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 2000);
    } catch {
      setCopyStatus((prev) => ({ ...prev, [key]: "failed" }));
      setTimeout(() => {
        setCopyStatus((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 2500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Warnings Box (same appearance as in ScriptOutputView) */}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 p-3.5 text-xs text-amber-900">
          <div className="font-bold flex items-center gap-1.5 mb-1.5 text-amber-800">
            <span>⚠️</span> Generation Warnings ({warnings.length}):
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-800">
            {warnings.map((warning, idx) => (
              <li key={idx}>{String(warning)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-bold text-sm text-slate-900">
              {scenes.length} {scenes.length === 1 ? "Scene" : "Scenes"}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-sm text-indigo-700">
              {total_seconds.toFixed(1)} s
            </span>

            {/* Informational note when outside 45-60s recommended range */}
            {isOutsideRecommended && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <span>ℹ️</span> {total_seconds < 45 ? "Under recommended 45–60s" : "Over recommended 45–60s"}
              </span>
            )}

            {/* Render Telemetry Summary Badges */}
            {correlation && (
              <>
                <span className="text-slate-300">•</span>
                {correlation.renderedBeatsCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span>🎬</span> {correlation.renderedBeatsCount}/{correlation.totalBeatsCount} Beats Rendered
                  </span>
                )}
                {correlation.sceneFallbacks.size > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                    title={`Scenes ${Array.from(correlation.sceneFallbacks.keys()).join(", ")} reverted to scene-level Ken Burns`}
                  >
                    <span>⚠️</span> {correlation.sceneFallbacks.size}{" "}
                    {correlation.sceneFallbacks.size === 1 ? "Scene" : "Scenes"} Fallback
                  </span>
                )}
                {correlation.isRenderStale && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                    <span>🔄</span> Telemetry Stale
                  </span>
                )}
              </>
            )}
          </div>

          {/* Style Source Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">Style:</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                style_source === "channel"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {style_source === "channel" ? "Channel style" : "Default style"}
            </span>
          </div>
        </div>

        {/* Visual Style Text */}
        {visual_style && (
          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Visual Direction
            </span>
            <p className="text-slate-700 leading-relaxed font-sans italic">&ldquo;{visual_style}&rdquo;</p>
          </div>
        )}

        {/* Segmented Timeline Bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 px-0.5">
            <span>Scene timeline share</span>
            <span>Hover or focus segment for duration</span>
          </div>

          <div
            role="progressbar"
            aria-label="Scene duration distribution"
            aria-valuemin={0}
            aria-valuemax={total_seconds}
            aria-valuenow={total_seconds}
            className="h-6 rounded-lg overflow-hidden flex w-full border border-slate-200 bg-slate-100 shadow-inner"
          >
            {scenes.map((scene, idx) => {
              const sharePercent = total_seconds > 0 ? (scene.est_seconds / total_seconds) * 100 : 0;
              // Hide segment label if too narrow to fit comfortably without clipping
              const showLabel = sharePercent >= 8;

              // Alternating indigo shades for clear visual boundary
              const segmentBg =
                idx % 2 === 0
                  ? "bg-indigo-600 hover:bg-indigo-500 focus:bg-indigo-500 text-white"
                  : "bg-indigo-500 hover:bg-indigo-400 focus:bg-indigo-400 text-white";

              return (
                <div
                  key={scene.index}
                  tabIndex={0}
                  style={{ width: `${sharePercent}%` }}
                  title={`Scene ${scene.index}: ${scene.est_seconds.toFixed(1)}s (${sharePercent.toFixed(1)}%)`}
                  className={`${segmentBg} h-full border-r border-indigo-700/30 last:border-r-0 flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-indigo-700 select-none overflow-hidden shrink-0`}
                >
                  {showLabel && <span>#{scene.index}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Storyboard Visual Beat Timeline */}
      {correlation && (
        <StoryboardTimeline
          correlation={correlation}
          totalDurationSeconds={total_seconds}
          title="Storyboard Visual Beat Timeline"
          onSelectScene={handleSelectSceneFromTimeline}
          onSelectBeat={handleSelectBeatFromTimeline}
        />
      )}

      {/* Scene Cards in Sequential Order */}
      <div className="space-y-3.5">
        {scenes.map((scene) => {
          const sceneFallbackReason = correlation?.sceneFallbacks.get(scene.index);
          const beatsInScene = scene.visual_beats ?? [];
          const renderedBeatsInScene = beatsInScene.filter((b) => {
            const beatKey = b.id || `${scene.index}_${b.order}`;
            return correlation?.beatTelemetry.get(beatKey)?.status === "rendered";
          }).length;

          return (
            <div
              key={scene.index}
              id={`scene-card-${scene.index}`}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 transition hover:border-slate-300 scroll-mt-6"
            >
              {/* Scene Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
                    {scene.index}
                  </span>
                  <span className="font-bold text-sm text-slate-800">Scene {scene.index}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    {scene.shot_type}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    ~{scene.est_seconds.toFixed(1)}s
                  </span>

                  {/* Scene Telemetry Status Badges */}
                  {sceneFallbackReason ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                      title={`Scene reverted to scene-level Ken Burns: ${sceneFallbackReason}`}
                    >
                      <span>⚠️</span> Ken Burns Fallback
                    </span>
                  ) : renderedBeatsInScene > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                      title={`${renderedBeatsInScene} of ${beatsInScene.length} visual beats rendered`}
                    >
                      <span>✓</span>{" "}
                      {renderedBeatsInScene === beatsInScene.length
                        ? "All Beats Rendered"
                        : `${renderedBeatsInScene}/${beatsInScene.length} Beats Rendered`}
                    </span>
                  ) : null}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {onSave && !isStale && (
                    editingSceneIndex === scene.index ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={cancelEditing}
                          className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveScene(scene.index)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {isSaving ? "Saving..." : "Save Scene"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditing(scene)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 cursor-pointer shadow-2xs"
                      >
                        ✎ Edit Scene
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={isStale}
                    onClick={() => handleCopy(`prompt-${scene.index}`, scene.image_prompt)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                  >
                    {copyStatus[`prompt-${scene.index}`] === "copied" ? (
                      <span className="text-emerald-600 font-semibold">✓ Copied</span>
                    ) : copyStatus[`prompt-${scene.index}`] === "failed" ? (
                      <span className="text-red-600 font-semibold">✕ Copy failed</span>
                    ) : (
                      "Copy prompt"
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isStale}
                    onClick={() => {
                      const combined = visual_style
                        ? `${visual_style}, ${scene.image_prompt}`
                        : scene.image_prompt;
                      handleCopy(`style-${scene.index}`, combined);
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                  >
                    {copyStatus[`style-${scene.index}`] === "copied" ? (
                      <span className="text-emerald-600 font-semibold">✓ Copied</span>
                    ) : copyStatus[`style-${scene.index}`] === "failed" ? (
                      <span className="text-red-600 font-semibold">✕ Copy failed</span>
                    ) : (
                      "Copy with style"
                    )}
                  </button>
                </div>
              </div>

              {/* Scene-Level Fallback Banner */}
              {sceneFallbackReason && (
                <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
                  <span className="text-sm shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <span className="font-bold">Scene-Level Ken Burns Fallback: </span>
                    <span className="text-amber-800">
                      Individual visual beat animations were not rendered ({sceneFallbackReason}). The renderer executed a whole-scene Ken Burns motion instead.
                    </span>
                  </div>
                </div>
              )}

              {editingSceneIndex === scene.index ? (
                /* Inline Edit Mode for Scene */
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Shot Type
                    </label>
                    <input
                      type="text"
                      value={editShotType}
                      onChange={(e) => setEditShotType(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Narration Text
                    </label>
                    <textarea
                      rows={2}
                      value={editNarration}
                      onChange={(e) => setEditNarration(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-serif leading-relaxed rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                      Image Prompt (AI Direction)
                    </label>
                    <textarea
                      rows={3}
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono leading-relaxed rounded-lg border border-slate-300 bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Narration */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Narration
                    </span>
                    <p className="text-xs text-slate-800 leading-relaxed font-serif whitespace-pre-wrap">
                      {scene.narration}
                    </p>
                  </div>

                  {/* Image Prompt in distinct container */}
                  <div className="rounded-lg bg-slate-900 text-slate-100 p-3 text-xs font-mono border border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">
                      Image Prompt
                    </span>
                    <p className="leading-relaxed text-slate-200 whitespace-pre-wrap select-all">
                      {scene.image_prompt}
                    </p>
                  </div>
                </>
              )}

              {/* Visual Beats Accordion Section (rendered only when scene has visual beats) */}
              {hasVisualBeats(scene) && scene.visual_beats && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleToggleBeats(scene.index)}
                    aria-expanded={isSceneAccordionExpanded(expandedBeats, scene.index)}
                    aria-controls={`scene-${scene.index}-beats-panel`}
                    className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-xs text-slate-700 transition cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>🎬</span> Visual Beats
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {scene.visual_beats.length}
                      </span>
                      {renderedBeatsInScene > 0 && !sceneFallbackReason && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {renderedBeatsInScene} rendered
                        </span>
                      )}
                      {sceneFallbackReason && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          fallback
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 group-hover:text-slate-800 flex items-center gap-1">
                      {isSceneAccordionExpanded(expandedBeats, scene.index) ? "▲ Hide beats" : "▼ Show beats"}
                    </span>
                  </button>

                  {isSceneAccordionExpanded(expandedBeats, scene.index) && (
                    <div
                      id={`scene-${scene.index}-beats-panel`}
                      className="mt-2.5 space-y-2 pl-2 sm:pl-3 border-l-2 border-indigo-100"
                    >
                      {scene.visual_beats.map((beat) => {
                        const beatKey = beat.id || `${scene.index}_${beat.order}`;
                        return (
                          <VisualBeatCard
                            key={beatKey}
                            beat={beat}
                            sceneIndex={scene.index}
                            videoId={videoId}
                            imageSource={beatImageSources.get(beatKey)}
                            onPreviewImage={(scIdx) => setPreviewModalSceneIndex(scIdx)}
                            telemetry={correlation?.beatTelemetry.get(beatKey)}
                            resolvedTiming={
                              correlation
                                ? resolveCorrelatedBeatTiming(beat, scene.index, correlation)
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Compact Collapsible Details Section with Meta */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200/80 cursor-pointer transition select-none text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Details & Metadata</span>
            {meta?.provider && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                {meta.provider} : {meta.model || "default"}
              </span>
            )}
          </div>
          <span className="text-slate-500 font-mono text-xs">
            {detailsOpen ? "▲ Hide details" : "▼ Show details"}
          </span>
        </button>

        {detailsOpen && (
          <div className="p-3.5 space-y-3 bg-white border-t border-slate-200">
            {meta ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Latency:</span>
                  <span className="font-medium text-slate-800">
                    {meta.latency_seconds !== undefined
                      ? `${meta.latency_seconds.toFixed(2)}s`
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tokens (In / Out):</span>
                  <span className="font-medium text-slate-800">
                    {meta.input_tokens ?? 0} / {meta.output_tokens ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Reasoning Tokens:</span>
                  <span className="font-medium text-slate-800">{meta.reasoning_tokens ?? 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Attempts:</span>
                  <span className="font-medium text-slate-800">{meta.attempts ?? 1}</span>
                </div>
                {meta.prompt_version && (
                  <div>
                    <span className="text-slate-400 block">Prompt Version:</span>
                    <span className="font-medium text-slate-800">{meta.prompt_version}</span>
                  </div>
                )}
                {meta.task && (
                  <div>
                    <span className="text-slate-400 block">Task:</span>
                    <span className="font-medium text-slate-800">{meta.task}</span>
                  </div>
                )}
                {meta.revision !== undefined && meta.revision !== null && (
                  <div>
                    <span className="text-slate-400 block">Revision:</span>
                    <span className="font-medium text-slate-800">
                      {meta.revision ? "true" : "false"}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 italic text-xs">No generation metadata available.</p>
            )}

            {/* Raw JSON toggle */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="text-[11px] font-mono text-slate-500 hover:text-slate-700 underline cursor-pointer"
              >
                {showRaw ? "Hide raw JSON" : "View raw output payload"}
              </button>
              {showRaw && (
                <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-60">
                  <pre>{JSON.stringify(output, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Beat Thumbnail Preview Modal */}
      {videoId && previewModalSceneIndex !== null && modalItem && (
        <ImagePreviewModal
          videoId={videoId}
          isOpen={previewModalSceneIndex !== null}
          item={modalItem}
          allItems={modalAllItems}
          narrationSnippet={activeModalScene?.narration}
          shotType={activeModalScene?.shot_type}
          onClose={() => setPreviewModalSceneIndex(null)}
          onSelectScene={(it) => setPreviewModalSceneIndex(it.index)}
        />
      )}
    </div>
  );
}
