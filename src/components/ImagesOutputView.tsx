"use client";

import { useState } from "react";
import type { ImageItem, ImagesMeta, StoryboardScene } from "@/lib/types";
import { CollapsibleJson } from "./CollapsibleJson";
import { AuthenticatedImage } from "./AuthenticatedImage";
import { ImagePreviewModal } from "./ImagePreviewModal";

interface ImagesOutputViewProps {
  videoId: string;
  output: unknown;
  isMock?: boolean;
  isStale?: boolean;
  isRunning?: boolean;
  storyboardScenes?: StoryboardScene[];
}

interface ValidatedImagesOutput {
  items: ImageItem[];
  complete: boolean;
  warnings: string[];
  meta?: ImagesMeta;
  mock?: boolean;
}

/**
 * Defensively parses and validates the output from the image-generation step.
 * Supports standard wrapped { images: { items: [...], complete: ... } }
 * as well as direct items array or flat shapes.
 */
function parseAndValidateImages(output: unknown): ValidatedImagesOutput | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  const o = output as Record<string, unknown>;

  let rawItems: unknown[] | null = null;
  let complete = false;

  if (o.images && typeof o.images === "object" && !Array.isArray(o.images)) {
    const imgObj = o.images as Record<string, unknown>;
    if (Array.isArray(imgObj.items)) {
      rawItems = imgObj.items;
    }
    complete = Boolean(imgObj.complete);
  } else if (Array.isArray(o.images)) {
    rawItems = o.images;
  } else if (Array.isArray(o.items)) {
    rawItems = o.items;
  }

  if (!rawItems) {
    return null;
  }

  const validItems: ImageItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const it = raw as Record<string, unknown>;

    let idx = i + 1;
    if (typeof it.index === "number" && Number.isFinite(it.index)) {
      idx = it.index;
    } else if (typeof it.index === "string" && !isNaN(Number(it.index))) {
      idx = Number(it.index);
    }

    const status = typeof it.status === "string" ? it.status : "ok";
    const file = typeof it.file === "string" ? it.file : null;
    const prompt = typeof it.prompt === "string" ? it.prompt : "";
    const prompt_hash = typeof it.prompt_hash === "string" ? it.prompt_hash : "";
    const reused = Boolean(it.reused);
    const model = typeof it.model === "string" ? it.model : "";
    const size = typeof it.size === "string" ? it.size : "1024x1536";
    const quality = typeof it.quality === "string" ? it.quality : "standard";

    const latency_seconds =
      typeof it.latency_seconds === "number" && Number.isFinite(it.latency_seconds)
        ? it.latency_seconds
        : 0;

    const est_cost_usd =
      typeof it.est_cost_usd === "number" && Number.isFinite(it.est_cost_usd)
        ? it.est_cost_usd
        : null;

    const input_tokens =
      typeof it.input_tokens === "number" && Number.isFinite(it.input_tokens)
        ? it.input_tokens
        : null;

    const output_tokens =
      typeof it.output_tokens === "number" && Number.isFinite(it.output_tokens)
        ? it.output_tokens
        : null;

    const total_tokens =
      typeof it.total_tokens === "number" && Number.isFinite(it.total_tokens)
        ? it.total_tokens
        : null;

    const error = typeof it.error === "string" ? it.error : null;

    validItems.push({
      index: idx,
      status,
      file,
      prompt,
      prompt_hash,
      reused,
      model,
      size,
      quality,
      latency_seconds,
      est_cost_usd,
      input_tokens,
      output_tokens,
      total_tokens,
      error,
    });
  }

  const warnings = Array.isArray(o.warnings)
    ? (o.warnings.filter((w) => typeof w === "string") as string[])
    : [];

  const meta =
    o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as ImagesMeta)
      : undefined;

  const mock = Boolean(o.mock || meta?.mock);

  return {
    items: validItems,
    complete,
    warnings,
    meta,
    mock,
  };
}

export function ImagesOutputView({
  videoId,
  output,
  isMock = false,
  isStale = false,
  isRunning = false,
  storyboardScenes,
}: ImagesOutputViewProps) {
  const [previewScene, setPreviewScene] = useState<ImageItem | null>(null);
  const [copyStatus, setCopyStatus] = useState<Record<string, "copied" | "failed">>({});
  const [showRaw, setShowRaw] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const parsed = parseAndValidateImages(output);

  // Fallback to raw JSON viewer if payload shape is completely unrecognizable
  if (!parsed && !isRunning) {
    return (
      <CollapsibleJson
        data={output}
        mock={isMock}
        defaultOpen={true}
        label="Images payload (unrecognized shape)"
      />
    );
  }

  const items = parsed?.items || [];
  const complete = parsed?.complete ?? (!isRunning && items.length > 0);
  const warnings = parsed?.warnings || [];
  const meta = parsed?.meta;
  const isActuallyMock = isMock || Boolean(parsed?.mock);

  // Map storyboard scenes for quick lookup by scene index
  const storyboardMap = new Map<number, StoryboardScene>();
  if (storyboardScenes) {
    for (const sc of storyboardScenes) {
      storyboardMap.set(sc.index, sc);
    }
  }

  // Determine total scenes count (either from storyboard, metadata, or items length)
  const totalScenesCount =
    storyboardScenes?.length ||
    meta?.images_total ||
    items.length ||
    0;

  const generatedCount =
    meta?.images_generated !== undefined
      ? meta.images_generated
      : items.filter((it) => it.status === "ok" && !it.reused).length;

  const reusedCount =
    meta?.images_reused !== undefined
      ? meta.images_reused
      : items.filter((it) => it.status === "ok" && it.reused).length;

  const failedCount =
    meta?.images_failed !== undefined
      ? meta.images_failed
      : items.filter((it) => it.status === "failed").length;

  const handleCopy = async (key: string, text: string) => {
    if (isStale) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
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

  // Build combined display list:
  // If storyboard scenes are known and step is running or has fewer items,
  // we can display upcoming/in-progress scenes as well!
  interface DisplayScene {
    item?: ImageItem;
    storyboardScene?: StoryboardScene;
    index: number;
    isGenerating?: boolean;
    isPending?: boolean;
  }

  const displayList: DisplayScene[] = [];
  const itemsMap = new Map<number, ImageItem>();
  for (const it of items) {
    itemsMap.set(it.index, it);
  }

  if (storyboardScenes && storyboardScenes.length > 0) {
    let encounteredFirstUnready = false;
    for (const sb of storyboardScenes) {
      const it = itemsMap.get(sb.index);
      if (it) {
        displayList.push({
          item: it,
          storyboardScene: sb,
          index: sb.index,
        });
      } else {
        // Not generated yet
        const isGen = isRunning && !encounteredFirstUnready;
        encounteredFirstUnready = true;
        displayList.push({
          storyboardScene: sb,
          index: sb.index,
          isGenerating: isGen,
          isPending: !isGen,
        });
      }
    }
  } else {
    // No storyboard scenes available: simply render all items in sequential order
    for (const it of items) {
      displayList.push({
        item: it,
        index: it.index,
      });
    }
  }

  const currentPreviewStoryboard = previewScene
    ? storyboardMap.get(previewScene.index)
    : undefined;

  return (
    <div className="space-y-4">
      {/* Warnings Box */}
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
          {/* Left stats: scene counts */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-bold text-sm text-slate-900">
              {totalScenesCount} {totalScenesCount === 1 ? "Scene" : "Scenes"}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              {generatedCount} generated
            </span>
            {reusedCount > 0 && (
              <span className="font-semibold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {reusedCount} reused
              </span>
            )}
            {failedCount > 0 && (
              <span className="font-semibold text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                {failedCount} failed
              </span>
            )}
          </div>

          {/* Right badges: Provider / Model / Mock */}
          <div className="flex flex-wrap items-center gap-2">
            {meta?.provider && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                {meta.provider} : {meta.model || "default"}
              </span>
            )}
            {isActuallyMock && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                <span>⚡</span> Mock Image Mode
              </span>
            )}
          </div>
        </div>

        {/* Live Progress Bar when Running or Incomplete */}
        {(!complete || isRunning) && totalScenesCount > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-blue-700 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                Generating images ({items.length} of {totalScenesCount} scenes ready)
              </span>
              <span className="font-semibold text-blue-900">
                {Math.round((items.length / totalScenesCount) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
              <div
                className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, (items.length / totalScenesCount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Compact Metadata Strip if available */}
        {(meta?.latency_seconds !== undefined || meta?.est_cost_usd !== undefined) && (
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
            {meta?.latency_seconds !== undefined && (
              <div>
                <span className="text-slate-400">Total duration: </span>
                <span className="font-semibold text-slate-800">
                  {meta.latency_seconds.toFixed(2)}s
                </span>
              </div>
            )}
            {meta?.est_cost_usd !== undefined && (
              <div>
                <span className="text-slate-400">Total AI cost: </span>
                <span className="font-semibold text-slate-800">
                  {meta.est_cost_usd !== null ? `$${meta.est_cost_usd.toFixed(4)}` : "$0.00"}
                </span>
              </div>
            )}
            {meta?.total_tokens !== undefined && meta.total_tokens !== null && (
              <div>
                <span className="text-slate-400">Tokens: </span>
                <span className="font-semibold text-slate-800">{meta.total_tokens}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State when no items and not running */}
      {displayList.length === 0 && !isRunning && (
        <div className="py-14 text-center rounded-xl border border-dashed border-slate-200 bg-white p-6">
          <div className="text-3xl mb-2">🖼️</div>
          <h3 className="text-sm font-bold text-slate-800">No images generated yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Execute the images step using the pipeline controls to generate scene visuals.
          </p>
        </div>
      )}

      {/* Gallery Grid of Portrait Scene Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayList.map((entry) => {
          const item = entry.item;
          const sbScene = entry.storyboardScene || (item ? storyboardMap.get(item.index) : undefined);
          const sceneIndex = entry.index;
          const narration = sbScene?.narration || "";
          const shotType = sbScene?.shot_type;
          const shortHash = item?.prompt_hash ? item.prompt_hash.slice(0, 8) : "";

          // 1. Scene currently generating
          if (entry.isGenerating) {
            return (
              <div
                key={`gen-${sceneIndex}`}
                className="bg-white rounded-xl border border-blue-300 ring-2 ring-blue-100 p-3.5 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="flex h-5 px-1.5 items-center justify-center rounded bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                      Scene {sceneIndex}
                    </span>
                    <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      Generating...
                    </span>
                  </div>

                  {/* Shimmering Portrait Placeholder */}
                  <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-slate-900 flex flex-col items-center justify-center text-slate-400 border border-slate-800">
                    <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent mb-2" />
                    <span className="text-xs font-semibold text-indigo-300">Rendering visual...</span>
                    <span className="text-[10px] text-slate-500 mt-1">AI in progress</span>
                  </div>
                </div>

                {narration && (
                  <p className="text-xs text-slate-600 line-clamp-2 italic font-serif mt-2">
                    &ldquo;{narration}&rdquo;
                  </p>
                )}
              </div>
            );
          }

          // 2. Upcoming / Pending scene
          if (entry.isPending) {
            return (
              <div
                key={`pend-${sceneIndex}`}
                className="bg-white/80 rounded-xl border border-dashed border-slate-300 p-3.5 space-y-3 flex flex-col justify-between opacity-70"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="flex h-5 px-1.5 items-center justify-center rounded bg-slate-100 text-slate-600 font-bold text-[11px]">
                      Scene {sceneIndex}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">Queued</span>
                  </div>

                  <div className="aspect-[9/16] rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <span className="text-xl mb-1 opacity-40">⏳</span>
                    <span className="text-xs font-medium text-slate-500">Waiting in queue</span>
                  </div>
                </div>

                {narration && (
                  <p className="text-xs text-slate-500 line-clamp-2 italic font-serif mt-2">
                    &ldquo;{narration}&rdquo;
                  </p>
                )}
              </div>
            );
          }

          // 3. Completed or Failed Scene Card
          if (!item) return null;

          return (
            <div
              key={`scene-${item.index}`}
              className="group bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-150 p-3.5 flex flex-col justify-between space-y-3"
            >
              <div>
                {/* Card Header: Scene number, Shot Type, Duration */}
                <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-100 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 px-1.5 items-center justify-center rounded bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-100">
                      #{item.index}
                    </span>
                    <span className="font-bold text-xs text-slate-800">Scene {item.index}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {shotType && (
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[80px]">
                        {shotType}
                      </span>
                    )}
                    {sbScene?.est_seconds !== undefined && (
                      <span className="text-[10px] text-slate-400">
                        ~{sbScene.est_seconds.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Portrait Thumbnail Container with Click-to-Preview */}
                <div
                  onClick={() => {
                    if (item.status === "ok" && item.file) {
                      setPreviewScene(item);
                    }
                  }}
                  className={`group/thumb relative aspect-[9/16] rounded-lg overflow-hidden border border-slate-200 shadow-2xs ${
                    item.status === "ok" && item.file ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <AuthenticatedImage
                    videoId={videoId}
                    sceneIndex={item.index}
                    promptHash={item.prompt_hash}
                    status={item.status}
                    hasFile={Boolean(item.file)}
                    alt={`Scene ${item.index} generated visual`}
                    aspectRatio="aspect-[9/16]"
                    imgClassName="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                    errorMessage={item.error}
                  />

                  {/* Hover Overlay with Preview Icon */}
                  {item.status === "ok" && item.file && (
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-900/90 text-white shadow-lg backdrop-blur-xs flex items-center gap-1">
                        <span>🔍</span> Preview
                      </span>
                    </div>
                  )}

                  {/* Shortened Prompt Hash Badge */}
                  {shortHash && (
                    <div className="absolute bottom-1.5 left-1.5 z-10">
                      <span
                        title={`Prompt SHA256: ${item.prompt_hash}`}
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-900/80 text-amber-300 border border-slate-800/80 backdrop-blur-xs"
                      >
                        #{shortHash}
                      </span>
                    </div>
                  )}

                  {/* Reused vs Generated Badge overlay */}
                  <div className="absolute top-1.5 right-1.5 z-10">
                    {item.reused ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-600/40 backdrop-blur-xs">
                        ⚡ Reused
                      </span>
                    ) : item.status === "ok" ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-950/90 text-indigo-300 border border-indigo-600/40 backdrop-blur-xs">
                        ✨ New
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-950/90 text-red-300 border border-red-600/40 backdrop-blur-xs">
                        ✕ Failed
                      </span>
                    )}
                  </div>
                </div>

                {/* Narration Snippet */}
                {narration && (
                  <p
                    className="text-xs text-slate-700 leading-relaxed font-serif line-clamp-2 mt-2.5"
                    title={narration}
                  >
                    &ldquo;{narration}&rdquo;
                  </p>
                )}
              </div>

              {/* Card Footer: Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleCopy(`prompt-${item.index}`, item.prompt)}
                  disabled={isStale}
                  className="px-2 py-1 text-[11px] font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition cursor-pointer"
                >
                  {copyStatus[`prompt-${item.index}`] === "copied" ? (
                    <span className="text-emerald-600 font-semibold">✓ Copied</span>
                  ) : (
                    "Copy prompt"
                  )}
                </button>

                {item.status === "ok" && item.file && (
                  <button
                    type="button"
                    onClick={() => setPreviewScene(item)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                  >
                    Full View
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Details & Metadata Collapsible Section */}
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
                  <span className="text-slate-400 block">Total Latency:</span>
                  <span className="font-medium text-slate-800">
                    {meta.latency_seconds !== undefined
                      ? `${meta.latency_seconds.toFixed(2)}s`
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total AI Cost:</span>
                  <span className="font-medium text-slate-800">
                    {meta.est_cost_usd !== null && meta.est_cost_usd !== undefined
                      ? `$${meta.est_cost_usd.toFixed(4)}`
                      : "$0.00"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Images Summary:</span>
                  <span className="font-medium text-slate-800">
                    {generatedCount} gen / {reusedCount} reused
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tokens (In / Out):</span>
                  <span className="font-medium text-slate-800">
                    {meta.input_tokens ?? 0} / {meta.output_tokens ?? 0}
                  </span>
                </div>
                {meta.task && (
                  <div>
                    <span className="text-slate-400 block">Task:</span>
                    <span className="font-medium text-slate-800">{meta.task}</span>
                  </div>
                )}
                {isActuallyMock && (
                  <div>
                    <span className="text-slate-400 block">Mode:</span>
                    <span className="font-medium text-amber-700 font-bold">Mock Image</span>
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

      {/* Image Preview Modal */}
      {previewScene && (
        <ImagePreviewModal
          videoId={videoId}
          item={previewScene}
          allItems={items.filter((it) => it.status === "ok" && it.file)}
          narrationSnippet={currentPreviewStoryboard?.narration}
          shotType={currentPreviewStoryboard?.shot_type}
          isOpen={Boolean(previewScene)}
          onClose={() => setPreviewScene(null)}
          onSelectScene={(newItem) => setPreviewScene(newItem)}
        />
      )}
    </div>
  );
}
