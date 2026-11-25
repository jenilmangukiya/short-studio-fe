import {
  DEFAULT_VISUAL_STYLE_ID,
  type VisualStyleId,
  type VisualStyleSummaryOut,
} from "./types.ts";

export interface StyleVisualMeta {
  gradientClass: string;
  badgeLabel: string;
  badgeClass: string;
  swatches: string[];
  accentBorderClass: string;
  iconName: "cube" | "stickman" | "drama";
}

export const STYLE_VISUAL_METADATA: Record<VisualStyleId, StyleVisualMeta> = {
  legacy_default: {
    gradientClass: "from-slate-100 via-sky-50 to-amber-50/60",
    badgeLabel: "3D Render",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    swatches: ["#FFFFFF", "#E0E0E0", "#B0BEC5", "#90CAF9", "#FFE082"],
    accentBorderClass: "border-sky-300",
    iconName: "cube",
  },
  stickman_tactical_explainer: {
    gradientClass: "from-slate-900 via-slate-800 to-amber-950/40",
    badgeLabel: "2D Illustrated",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    swatches: ["#FFFFFF", "#1A1A1A", "#F4A92E", "#9EA6AC", "#151C28"],
    accentBorderClass: "border-amber-400",
    iconName: "stickman",
  },
  stylized_2d_narrative: {
    gradientClass: "from-slate-950 via-purple-950/60 to-rose-950/40",
    badgeLabel: "2D Drama",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    swatches: ["#FFFFFF", "#212529", "#5C3A21", "#E91E63", "#FF8DA1"],
    accentBorderClass: "border-purple-400",
    iconName: "drama",
  },
};

/**
 * Returns visual representation metadata for a visual style preset.
 * Falls back to legacy_default styling if styleId is unrecognized.
 */
export function getStyleVisualMeta(styleId: string): StyleVisualMeta {
  if (styleId in STYLE_VISUAL_METADATA) {
    return STYLE_VISUAL_METADATA[styleId as VisualStyleId];
  }
  return STYLE_VISUAL_METADATA.legacy_default;
}

/**
 * Resolves the effective style that will be applied to a video:
 * - If an explicit style is selected, returns that style.
 * - Otherwise, returns the channel's default visual style if present.
 * - Otherwise, falls back to legacy_default.
 */
export function resolveEffectiveStyle(
  selectedStyleId: VisualStyleId | null | undefined,
  channelDefaultStyleId?: VisualStyleId | null
): VisualStyleId {
  if (selectedStyleId) {
    return selectedStyleId;
  }
  if (channelDefaultStyleId) {
    return channelDefaultStyleId;
  }
  return DEFAULT_VISUAL_STYLE_ID;
}

/**
 * Returns true if the user has made an explicit style choice (overriding default inheritance).
 */
export function isExplicitSelection(
  selectedStyleId: VisualStyleId | null | undefined
): boolean {
  return selectedStyleId !== null && selectedStyleId !== undefined;
}

/**
 * Formats a user-facing explanation of how the visual style will be resolved.
 */
export function getStyleSelectionDescription(
  selectedStyleId: VisualStyleId | null | undefined,
  channelDefaultStyleId: VisualStyleId | null | undefined,
  styles?: VisualStyleSummaryOut[]
): {
  isOverridden: boolean;
  effectiveId: VisualStyleId;
  summaryText: string;
} {
  const isOverridden = isExplicitSelection(selectedStyleId);
  const effectiveId = resolveEffectiveStyle(selectedStyleId, channelDefaultStyleId);
  const matched = styles?.find((s) => s.id === effectiveId);
  const name =
    matched?.name ||
    (effectiveId === "legacy_default" ? "Clean 3D Studio (Default)" : effectiveId);

  if (isOverridden) {
    return {
      isOverridden: true,
      effectiveId,
      summaryText: `Custom override active: "${name}" will be applied to this short.`,
    };
  }

  if (channelDefaultStyleId) {
    return {
      isOverridden: false,
      effectiveId,
      summaryText: `Inheriting channel default: "${name}". Click any style below to override.`,
    };
  }

  return {
    isOverridden: false,
    effectiveId,
    summaryText: `Using system default: "${name}". Click any style below to override.`,
  };
}

/**
 * Returns the effective visual style ID of an existing video.
 * For legacy videos with visual_style_id == null/undefined, returns legacy_default.
 */
export function getVideoEffectiveStyleId(video?: {
  visual_style_id?: VisualStyleId | null;
}): VisualStyleId {
  return video?.visual_style_id || DEFAULT_VISUAL_STYLE_ID;
}

/**
 * Returns true if the video is a legacy video (has no visual_style_id set).
 */
export function isLegacyVideo(video?: {
  visual_style_id?: VisualStyleId | null;
}): boolean {
  return !video?.visual_style_id;
}

/**
 * Computes the human-readable display name for an existing video's visual style.
 * Respects frozen snapshots where available; for legacy videos with null style fields,
 * returns "Legacy Default — Clean 3D Studio".
 */
export function getVideoStyleDisplayName(
  video?: {
    visual_style_id?: VisualStyleId | null;
    visual_style_snapshot?: Record<string, unknown> | null;
  },
  styles?: VisualStyleSummaryOut[]
): string {
  // Legacy video compatibility: null/undefined style fields display as Legacy Default
  if (!video?.visual_style_id) {
    return "Legacy Default — Clean 3D Studio";
  }

  // Treat frozen snapshot as authoritative historical configuration
  if (
    video.visual_style_snapshot &&
    typeof video.visual_style_snapshot.name === "string" &&
    video.visual_style_snapshot.name.trim()
  ) {
    return video.visual_style_snapshot.name.trim();
  }

  // Check catalog metadata
  const matched = styles?.find((s) => s.id === video.visual_style_id);
  if (matched?.name) {
    return matched.name;
  }

  // Preset fallback names
  if (video.visual_style_id === "legacy_default") {
    return "Clean 3D Studio (Default)";
  }
  if (video.visual_style_id === "stickman_tactical_explainer") {
    return "Stickman Tactical Explainer";
  }
  if (video.visual_style_id === "stylized_2d_narrative") {
    return "Stylized 2D Narrative";
  }

  return video.visual_style_id;
}

/**
 * Returns a short description for an existing video's visual style.
 * Prioritizes frozen snapshot description if available, then catalog, then preset defaults.
 */
export function getVideoStyleDescription(
  video?: {
    visual_style_id?: VisualStyleId | null;
    visual_style_snapshot?: Record<string, unknown> | null;
  },
  styles?: VisualStyleSummaryOut[]
): string {
  if (
    video?.visual_style_snapshot &&
    typeof video.visual_style_snapshot.description === "string" &&
    video.visual_style_snapshot.description.trim()
  ) {
    return video.visual_style_snapshot.description.trim();
  }

  const effectiveId = getVideoEffectiveStyleId(video);
  const matched = styles?.find((s) => s.id === effectiveId);
  if (matched?.description) {
    return matched.description;
  }

  if (effectiveId === "legacy_default") {
    return "Smooth stylized 3D matte characters and objects with clean studio lighting.";
  }
  if (effectiveId === "stickman_tactical_explainer") {
    return "Minimalist white circular-head stick figures with technical diagram aesthetics.";
  }
  if (effectiveId === "stylized_2d_narrative") {
    return "High-contrast 2D illustrated storybook aesthetics with expressive dramatic lighting.";
  }

  return "Visual style configuration for image and animation generation.";
}

/**
 * Registry to track video image invalidation state and versions.
 * Allows components to reactively detect when a video's images have been invalidated
 * by a visual style change, immediately release old blobs/URLs, and prevent premature fetches.
 */
class ImageInvalidationRegistry {
  private versions = new Map<string, number>();
  private staleVideos = new Set<string>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Mark images for videoId as invalidated / stale. Increments its version.
   */
  invalidateVideoImages(videoId: string) {
    const current = this.versions.get(videoId) ?? 0;
    this.versions.set(videoId, current + 1);
    this.staleVideos.add(videoId);
    this.notify();
  }

  /**
   * Clear invalidation status when images have completed regeneration.
   */
  clearVideoImageInvalidation(videoId: string) {
    if (this.staleVideos.delete(videoId)) {
      this.notify();
    }
  }

  getVersion(videoId: string): number {
    return this.versions.get(videoId) ?? 0;
  }

  isStale(videoId: string): boolean {
    return this.staleVideos.has(videoId);
  }

  /**
   * For testing / cleanup: reset all tracked invalidations.
   */
  reset() {
    this.versions.clear();
    this.staleVideos.clear();
    this.notify();
  }
}

export const imageInvalidationRegistry = new ImageInvalidationRegistry();

/**
 * Centralized cache invalidation after an existing video's visual style is updated.
 *
 * Requirements:
 * - Marks video images in imageInvalidationRegistry as stale/invalidated
 * - Refreshes ["video", videoId]
 * - Invalidates ["video-blob", videoId] (clears old rendered video)
 * - Invalidates ["video-subtitles", videoId] (clears old subtitles)
 * - Cancels existing ["scene-image", videoId] queries and awaits completion
 * - Actively clears data on all matching scene image queries to notify active observers
 * - Evicts (removes) all ["scene-image", videoId] queries from cache without invalidating/refetching
 * - Refreshes ["channel", channelId, "videos"] if channelId is provided
 * - PRESERVES ["video-audio", videoId] (audio is preserved by backend)
 * - PRESERVES ["visual-styles"] (catalog is unchanged)
 */
export async function invalidateVideoStyleQueries(
  queryClient: {
    invalidateQueries: (options: { queryKey: unknown[] }) => Promise<unknown> | void;
    cancelQueries?: (options: { queryKey: unknown[] }) => Promise<unknown> | void;
    removeQueries?: (options: { queryKey: unknown[] }) => void;
    setQueriesData?: (options: { queryKey: unknown[] }, updater: unknown) => void;
  },
  videoId: string,
  channelId?: string | null
): Promise<void> {
  // 1. Immediately mark video images as invalidated in registry
  imageInvalidationRegistry.invalidateVideoImages(videoId);

  // 2. Invalidate video detail query
  const pVideo = queryClient.invalidateQueries({ queryKey: ["video", videoId] });

  // 3. Invalidate rendered video blob query
  const pBlob = queryClient.invalidateQueries({ queryKey: ["video-blob", videoId] });

  // 4. Invalidate video subtitles query
  const pSubtitles = queryClient.invalidateQueries({ queryKey: ["video-subtitles", videoId] });

  // 5. Cancel active in-flight scene image / thumbnail queries and await completion
  if (typeof queryClient.cancelQueries === "function") {
    await queryClient.cancelQueries({ queryKey: ["scene-image", videoId] });
  }

  // 6. Actively set data to null on all matching scene image queries so active observers clear their Blob immediately
  if (typeof queryClient.setQueriesData === "function") {
    queryClient.setQueriesData({ queryKey: ["scene-image", videoId] }, null);
  }

  // 7. Remove all matching cached scene image and thumbnail queries (both active and inactive)
  // Note: We DO NOT call invalidateQueries on scene-image to prevent premature 404 refetches
  // before the images pipeline regenerates replacements.
  if (typeof queryClient.removeQueries === "function") {
    queryClient.removeQueries({ queryKey: ["scene-image", videoId] });
  }

  // 8. Invalidate parent channel's video list so thumbnails and status update
  let pChannel: unknown = undefined;
  if (channelId) {
    pChannel = queryClient.invalidateQueries({ queryKey: ["channel", channelId, "videos"] });
  }

  await Promise.all([pVideo, pBlob, pSubtitles, pChannel]);
}

