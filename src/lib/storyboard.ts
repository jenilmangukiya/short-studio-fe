import type {
  BeatTelemetryInfo,
  ImageStrategy,
  RenderAnimationItem,
  RenderData,
  StepOut,
  StoryboardMeta,
  StoryboardScene,
  StoryboardStyleSource,
  VisualBeat,
  VoiceoverItem,
} from "./types";

export type ValidatedScene = StoryboardScene;

export interface ValidatedStoryboard {
  visual_style: string;
  style_source: StoryboardStyleSource | string;
  scenes: StoryboardScene[];
  total_seconds: number;
  warnings: string[];
  meta?: StoryboardMeta;
  subject_anchor?: string;
  environment_anchor?: string;
  total_visual_beats?: number;
  [key: string]: unknown;
}

const KNOWN_BEAT_KEYS = new Set([
  "id",
  "scene_id",
  "order",
  "narration_text",
  "start_time",
  "end_time",
  "duration_seconds",
  "start_word_index",
  "end_word_index",
  "timing_type",
  "visual_description",
  "visual_purpose",
  "shot_type",
  "camera_angle",
  "focal_point",
  "visual_technique",
  "image_strategy",
  "source_image_id",
]);

/**
 * Defensively parses and sanitizes an individual VisualBeat object.
 * Preserves all known and unknown properties while safeguarding against malformed values.
 * Returns null if the item is not a valid object.
 */
export function parseVisualBeat(raw: unknown, defaultOrder: number = 1): VisualBeat | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const b = raw as Record<string, unknown>;

  const extraBeatFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(b)) {
    if (!KNOWN_BEAT_KEYS.has(key)) {
      extraBeatFields[key] = val;
    }
  }

  let order = defaultOrder;
  if (typeof b.order === "number" && Number.isFinite(b.order)) {
    order = b.order;
  } else if (typeof b.order === "string" && !isNaN(Number(b.order))) {
    order = Number(b.order);
  }

  const id = typeof b.id === "string" && b.id.trim() ? b.id.trim() : `beat_${order}`;
  const scene_id =
    typeof b.scene_id === "string"
      ? b.scene_id
      : b.scene_id !== undefined && b.scene_id !== null
      ? String(b.scene_id)
      : undefined;

  const narration_text = typeof b.narration_text === "string" ? b.narration_text : "";
  const visual_description = typeof b.visual_description === "string" ? b.visual_description : "";

  const start_time =
    typeof b.start_time === "number" && Number.isFinite(b.start_time)
      ? b.start_time
      : b.start_time === null
      ? null
      : undefined;

  const end_time =
    typeof b.end_time === "number" && Number.isFinite(b.end_time)
      ? b.end_time
      : b.end_time === null
      ? null
      : undefined;

  const duration_seconds =
    typeof b.duration_seconds === "number" && Number.isFinite(b.duration_seconds)
      ? b.duration_seconds
      : b.duration_seconds === null
      ? null
      : undefined;

  const start_word_index =
    typeof b.start_word_index === "number" && Number.isFinite(b.start_word_index)
      ? b.start_word_index
      : b.start_word_index === null
      ? null
      : undefined;

  const end_word_index =
    typeof b.end_word_index === "number" && Number.isFinite(b.end_word_index)
      ? b.end_word_index
      : b.end_word_index === null
      ? null
      : undefined;

  const timing_type = typeof b.timing_type === "string" ? b.timing_type : undefined;
  const visual_purpose = typeof b.visual_purpose === "string" ? b.visual_purpose : undefined;
  const shot_type = typeof b.shot_type === "string" ? b.shot_type : undefined;
  const camera_angle = typeof b.camera_angle === "string" ? b.camera_angle : undefined;
  const focal_point = typeof b.focal_point === "string" ? b.focal_point : undefined;
  const visual_technique = typeof b.visual_technique === "string" ? b.visual_technique : undefined;
  const image_strategy =
    typeof b.image_strategy === "string" ? (b.image_strategy as ImageStrategy) : undefined;
  const source_image_id =
    typeof b.source_image_id === "string" ? b.source_image_id : b.source_image_id === null ? null : undefined;

  return {
    ...extraBeatFields,
    id,
    ...(scene_id !== undefined && { scene_id }),
    order,
    narration_text,
    visual_description,
    ...(start_time !== undefined && { start_time }),
    ...(end_time !== undefined && { end_time }),
    ...(duration_seconds !== undefined && { duration_seconds }),
    ...(start_word_index !== undefined && { start_word_index }),
    ...(end_word_index !== undefined && { end_word_index }),
    ...(timing_type !== undefined && { timing_type }),
    ...(visual_purpose !== undefined && { visual_purpose }),
    ...(shot_type !== undefined && { shot_type }),
    ...(camera_angle !== undefined && { camera_angle }),
    ...(focal_point !== undefined && { focal_point }),
    ...(visual_technique !== undefined && { visual_technique }),
    ...(image_strategy !== undefined && { image_strategy }),
    ...(source_image_id !== undefined && { source_image_id }),
  };
}

/**
 * Parses an array of raw visual beats, filtering out malformed non-object entries.
 * Returns undefined if rawBeats is null/undefined or not an array.
 */
export function parseVisualBeats(rawBeats: unknown): VisualBeat[] | undefined {
  if (!Array.isArray(rawBeats)) {
    return undefined;
  }

  const validBeats: VisualBeat[] = [];
  for (let i = 0; i < rawBeats.length; i++) {
    const parsed = parseVisualBeat(rawBeats[i], i + 1);
    if (parsed) {
      validBeats.push(parsed);
    }
  }

  return validBeats;
}

/**
 * Validates the storyboard output defensively.
 * Validates required scene fields (narration, image_prompt, shot_type, est_seconds).
 * Preserves all other scene metadata (visual_beats, animation, final_prompt, camera metadata, unknown properties).
 * If total_seconds is missing or <= 0, recomputes it from valid scenes.
 * Returns null if the shape is unrecognized or if no valid scenes remain.
 */
export function parseAndValidateStoryboard(output: unknown): ValidatedStoryboard | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  const o = output as Record<string, unknown>;
  if (!o.storyboard || typeof o.storyboard !== "object" || Array.isArray(o.storyboard)) {
    return null;
  }

  const sb = o.storyboard as Record<string, unknown>;
  if (!Array.isArray(sb.scenes)) {
    return null;
  }

  const validScenes: StoryboardScene[] = [];
  for (let i = 0; i < sb.scenes.length; i++) {
    const raw = sb.scenes[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;

    const narration = typeof item.narration === "string" ? item.narration : null;
    const image_prompt = typeof item.image_prompt === "string" ? item.image_prompt : null;
    const shot_type = typeof item.shot_type === "string" ? item.shot_type : null;

    const estSec =
      typeof item.est_seconds === "number" && Number.isFinite(item.est_seconds) && item.est_seconds >= 0
        ? item.est_seconds
        : null;

    let idx = i + 1;
    if (typeof item.index === "number" && Number.isFinite(item.index)) {
      idx = item.index;
    } else if (typeof item.index === "string" && !isNaN(Number(item.index))) {
      idx = Number(item.index);
    }

    // Skip scenes with missing or invalid required fields
    if (narration === null || image_prompt === null || shot_type === null || estSec === null) {
      continue;
    }

    // Preserve all existing scene properties, only overriding validated/normalized fields
    const extraFields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(item)) {
      if (
        key !== "index" &&
        key !== "narration" &&
        key !== "image_prompt" &&
        key !== "shot_type" &&
        key !== "est_seconds" &&
        key !== "visual_beats"
      ) {
        extraFields[key] = val;
      }
    }

    const scene: StoryboardScene = {
      ...extraFields,
      index: idx,
      narration,
      image_prompt,
      shot_type,
      est_seconds: estSec,
    };

    const parsedBeats = parseVisualBeats(item.visual_beats);
    if (parsedBeats !== undefined) {
      scene.visual_beats = parsedBeats;
    }

    validScenes.push(scene);
  }

  if (validScenes.length === 0) {
    return null;
  }

  // Compute total seconds if missing, zero, or invalid
  const rawTotal = sb.total_seconds;
  let totalSeconds =
    typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;

  if (totalSeconds <= 0) {
    totalSeconds = validScenes.reduce((sum, s) => sum + s.est_seconds, 0);
  }

  if (totalSeconds <= 0) {
    totalSeconds = 1; // Prevent zero-division edge cases
  }

  const visual_style = typeof sb.visual_style === "string" ? sb.visual_style : "";
  const style_source = sb.style_source === "channel" ? "channel" : "default";

  const warnings = Array.isArray(o.warnings)
    ? (o.warnings.filter((w) => typeof w === "string") as string[])
    : [];

  const meta =
    o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as StoryboardMeta)
      : undefined;

  const extraSbFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(sb)) {
    if (
      key !== "visual_style" &&
      key !== "style_source" &&
      key !== "scenes" &&
      key !== "total_seconds" &&
      key !== "subject_anchor" &&
      key !== "environment_anchor" &&
      key !== "total_visual_beats"
    ) {
      extraSbFields[key] = val;
    }
  }

  const subject_anchor = typeof sb.subject_anchor === "string" ? sb.subject_anchor : undefined;
  const environment_anchor =
    typeof sb.environment_anchor === "string" ? sb.environment_anchor : undefined;
  const total_visual_beats =
    typeof sb.total_visual_beats === "number" && Number.isFinite(sb.total_visual_beats)
      ? sb.total_visual_beats
      : undefined;

  return {
    ...extraSbFields,
    visual_style,
    style_source,
    scenes: validScenes,
    total_seconds: totalSeconds,
    warnings,
    meta,
    ...(subject_anchor !== undefined && { subject_anchor }),
    ...(environment_anchor !== undefined && { environment_anchor }),
    ...(total_visual_beats !== undefined && { total_visual_beats }),
  };
}

/**
 * Immutably updates a specific scene in a scene list, modifying only the intended fields
 * and preserving all other scene properties (visual_beats, animation, framing, anchors, etc.).
 */
export function updateSceneInList(
  scenes: StoryboardScene[],
  sceneIndex: number,
  updates: {
    narration?: string;
    image_prompt?: string;
    shot_type?: string;
  }
): StoryboardScene[] {
  return scenes.map((s) => {
    if (s.index === sceneIndex) {
      return {
        ...s,
        ...(updates.narration !== undefined && { narration: updates.narration.trim() }),
        ...(updates.image_prompt !== undefined && { image_prompt: updates.image_prompt.trim() }),
        ...(updates.shot_type !== undefined && {
          shot_type: updates.shot_type.trim() || s.shot_type,
        }),
      };
    }
    return s;
  });
}

/**
 * Returns true if a scene has one or more valid visual beats to display.
 */
export function hasVisualBeats(scene?: StoryboardScene | null): boolean {
  return Boolean(scene && Array.isArray(scene.visual_beats) && scene.visual_beats.length > 0);
}

/**
 * Returns the count of visual beats in a scene (0 if missing or empty).
 */
export function getVisualBeatsCount(scene?: StoryboardScene | null): number {
  return hasVisualBeats(scene) && scene?.visual_beats ? scene.visual_beats.length : 0;
}

/**
 * Toggles the expanded accordion state for a specific scene index independently.
 * Does not mutate or affect other scene indices.
 */
export function toggleSceneAccordion(
  currentState: Record<number, boolean>,
  sceneIndex: number
): Record<number, boolean> {
  return {
    ...currentState,
    [sceneIndex]: !currentState[sceneIndex],
  };
}

/**
 * Checks whether the accordion for a given scene index is currently expanded.
 * Defaults to false (collapsed).
 */
export function isSceneAccordionExpanded(
  currentState: Record<number, boolean>,
  sceneIndex: number
): boolean {
  return Boolean(currentState[sceneIndex]);
}

/**
 * Formats a duration in seconds to MM:SS.SS (e.g. 2.4 -> "00:02.40").
 */
export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00.00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minsStr = String(mins).padStart(2, "0");
  const secsStr = secs.toFixed(2).padStart(5, "0");
  return `${minsStr}:${secsStr}`;
}

export type BeatTimingStatus = "aligned" | "fallback" | "unassigned";

export interface BeatTimingDisplay {
  text: string;
  status: BeatTimingStatus;
  badgeStyle: string;
}

/**
 * Returns formatted timing text and styling for a visual beat.
 * Handles aligned, fallback/proportional, and unassigned timing lifecycles.
 * Guarantees that invalid or missing timestamps never display NaN or undefined.
 */
export function getBeatTimingDisplay(beat?: {
  start_time?: number | null;
  end_time?: number | null;
  duration_seconds?: number | null;
  timing_type?: string;
}): BeatTimingDisplay {
  if (!beat) {
    return {
      text: "Pending voiceover",
      status: "unassigned",
      badgeStyle: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }

  const { start_time, end_time, timing_type } = beat;

  const hasValidStart = typeof start_time === "number" && Number.isFinite(start_time) && start_time >= 0;
  const hasValidEnd = typeof end_time === "number" && Number.isFinite(end_time) && end_time >= 0;
  const hasValidInterval = hasValidStart && hasValidEnd && (end_time as number) >= (start_time as number);

  // If timestamps are missing, null, or invalid
  if (!hasValidInterval) {
    return {
      text: "Pending voiceover",
      status: "unassigned",
      badgeStyle: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }

  const startFormatted = formatTimestamp(start_time as number);
  const endFormatted = formatTimestamp(end_time as number);
  const tType = String(timing_type || "").toLowerCase().trim();

  if (tType === "aligned") {
    return {
      text: `${startFormatted} – ${endFormatted}`,
      status: "aligned",
      badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (tType.includes("proportional")) {
    return {
      text: `~${startFormatted} – ${endFormatted} (proportional)`,
      status: "fallback",
      badgeStyle: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }

  if (tType.includes("fallback") || tType.includes("estimated")) {
    return {
      text: `~${startFormatted} – ${endFormatted} (est)`,
      status: "fallback",
      badgeStyle: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }

  if (tType === "unassigned") {
    return {
      text: "Pending voiceover",
      status: "unassigned",
      badgeStyle: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }

  // Default with valid interval
  return {
    text: `${startFormatted} – ${endFormatted}`,
    status: "aligned",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

export interface BeatImageStrategyDisplay {
  label: string;
  badgeStyle: string;
}

/**
 * Returns human-readable label and subtle styling for visual beat image sourcing strategy.
 */
export function getBeatImageStrategyDisplay(strategy?: string | null): BeatImageStrategyDisplay {
  const norm = String(strategy || "").toLowerCase().trim();

  switch (norm) {
    case "reuse_scene_image":
      return {
        label: "Reuse Scene Image",
        badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "reuse_previous_image":
      return {
        label: "Reuse Previous Image",
        badgeStyle: "bg-purple-50 text-purple-700 border-purple-200",
      };
    case "new_image":
      return {
        label: "New Image",
        badgeStyle: "bg-amber-50 text-amber-800 border-amber-200",
      };
    default:
      if (!norm) {
        return {
          label: "Reuse Scene Image",
          badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
        };
      }
      const formatted = norm
        .split(/[_\-\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return {
        label: formatted,
        badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export type BeatImageSourceStatus =
  | "scene_image"
  | "previous_image"
  | "new_image_available"
  | "new_image_required"
  | "unavailable";

export interface BeatImageSourceResult {
  status: BeatImageSourceStatus;
  /** Resolved scene index (1-based) to fetch from /api/videos/{videoId}/images/{sceneIndex}, or null if not applicable */
  resolvedSceneIndex: number | null;
  /** Human-readable label for the image source (e.g. "Scene Image", "Previous Beat Image", "New Image") */
  sourceLabel: string;
  /** Whether the underlying image asset is actually available/ready */
  isAvailable: boolean;
  /** Descriptive message for placeholders, fallbacks, or tooltips */
  description?: string;
}

export interface ResolveBeatImageSourceParams {
  beat: VisualBeat;
  sceneIndex: number;
  /**
   * The resolved image index from the immediately preceding beat in the storyboard sequence.
   * Null or undefined if this is the first beat or the previous beat had no image.
   */
  previousBeatImageIndex?: number | null;
  /**
   * Optional set or list of scene indices that actually have generated images ready.
   * If provided, availability checks verify membership in this set.
   * If omitted, any valid positive resolvedSceneIndex is considered available.
   */
  availableImageIndices?: Set<number> | number[];
  /**
   * Optional mapping of distinct beat image assets (if backend provides per-beat images).
   */
  beatImageMap?: Record<string, string | number>;
}

/**
 * Resolves the image source for an individual visual beat according to the backend contract.
 *
 * Rules:
 * - reuse_scene_image (or default): uses parent scene index, labeled "Scene Image".
 * - reuse_previous_image: uses previous beat's image index (or explicit numeric source_image_id).
 *   If unresolvable (e.g. first beat), marks as unavailable. Labeled "Previous Beat Image".
 * - new_image: only available if a distinct beat asset exists in beatImageMap.
 *   Otherwise, returns "new_image_required" placeholder. Never displays parent scene image as a new image!
 */
export function resolveBeatImageSource({
  beat,
  sceneIndex,
  previousBeatImageIndex,
  availableImageIndices,
  beatImageMap,
}: ResolveBeatImageSourceParams): BeatImageSourceResult {
  const normStrategy = String(beat.image_strategy || "reuse_scene_image").toLowerCase().trim();
  const availableSet = availableImageIndices
    ? availableImageIndices instanceof Set
      ? availableImageIndices
      : new Set(availableImageIndices)
    : null;

  // 1. Explicit distinct beat asset in beatImageMap (if backend provides per-beat image)
  if (beat.id && beatImageMap && beatImageMap[beat.id]) {
    const mapped = beatImageMap[beat.id];
    const mappedIdx = typeof mapped === "number" ? mapped : parseInt(String(mapped), 10);
    const resolvedIdx = Number.isFinite(mappedIdx) ? mappedIdx : null;
    return {
      status: "new_image_available",
      resolvedSceneIndex: resolvedIdx,
      sourceLabel: "New Image",
      isAvailable: true,
      description: "Beat-specific image",
    };
  }

  // 2. Strategy: new_image
  if (normStrategy === "new_image") {
    // Current backend only generates scene-level images. A new image has not been generated for this beat.
    // Never display the parent scene image as a new image!
    return {
      status: "new_image_required",
      resolvedSceneIndex: null,
      sourceLabel: "New Image",
      isAvailable: false,
      description: "New image required",
    };
  }

  // 3. Strategy: reuse_previous_image
  if (normStrategy === "reuse_previous_image") {
    let candidateIndex: number | null = null;
    if (
      typeof previousBeatImageIndex === "number" &&
      Number.isFinite(previousBeatImageIndex) &&
      previousBeatImageIndex > 0
    ) {
      candidateIndex = previousBeatImageIndex;
    } else if (beat.source_image_id && String(beat.source_image_id).trim()) {
      const parsed = parseInt(String(beat.source_image_id).trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        candidateIndex = parsed;
      }
    }

    if (candidateIndex === null) {
      return {
        status: "unavailable",
        resolvedSceneIndex: null,
        sourceLabel: "Previous Beat Image",
        isAvailable: false,
        description: "Previous beat image unavailable",
      };
    }

    const isAvailable = availableSet ? availableSet.has(candidateIndex) : true;
    return {
      status: "previous_image",
      resolvedSceneIndex: candidateIndex,
      sourceLabel: "Previous Beat Image",
      isAvailable,
      description: isAvailable
        ? `Reused from Scene ${candidateIndex}`
        : `Previous image (Scene ${candidateIndex}) not ready`,
    };
  }

  // 4. Strategy: reuse_scene_image (or default/legacy)
  const isAvailable = availableSet ? availableSet.has(sceneIndex) : true;
  return {
    status: "scene_image",
    resolvedSceneIndex: sceneIndex,
    sourceLabel: "Scene Image",
    isAvailable,
    description: isAvailable
      ? `Scene ${sceneIndex} image`
      : `Scene ${sceneIndex} image not ready`,
  };
}

/**
 * Sequentially resolves the image source for every visual beat across an entire storyboard.
 * Correctly threads sequential beat ordering across scene boundaries.
 * Returns a map keyed by beat unique key (beat.id or `${scene.index}_${beat.order}`).
 */
export function resolveStoryboardBeatImages(
  scenes: StoryboardScene[],
  options?: {
    availableImageIndices?: Set<number> | number[];
    beatImageMap?: Record<string, string | number>;
  }
): Map<string, BeatImageSourceResult> {
  const result = new Map<string, BeatImageSourceResult>();
  let lastResolvedImageIndex: number | null = null;

  for (const scene of scenes) {
    const beats = Array.isArray(scene.visual_beats) ? scene.visual_beats : [];
    for (const beat of beats) {
      const beatKey = beat.id || `${scene.index}_${beat.order}`;
      const resolved = resolveBeatImageSource({
        beat,
        sceneIndex: scene.index,
        previousBeatImageIndex: lastResolvedImageIndex,
        availableImageIndices: options?.availableImageIndices,
        beatImageMap: options?.beatImageMap,
      });

      result.set(beatKey, resolved);

      // Update lastResolvedImageIndex for subsequent beats
      if (
        resolved.status === "scene_image" ||
        resolved.status === "previous_image" ||
        resolved.status === "new_image_available"
      ) {
        if (resolved.resolvedSceneIndex !== null) {
          lastResolvedImageIndex = resolved.resolvedSceneIndex;
        }
      } else {
        // If this beat required a new image or was unavailable, the immediate previous beat did not resolve to an image
        lastResolvedImageIndex = null;
      }
    }
  }

  return result;
}

export type ResolvedTimingSource = "render" | "voiceover" | "storyboard" | "pending";

export interface ResolvedBeatTiming {
  source: ResolvedTimingSource;
  /** Effective start timestamp on continuous timeline, or null if pending/invalid */
  startTime: number | null;
  /** Effective end timestamp on continuous timeline, or null if pending/invalid */
  endTime: number | null;
  /** Effective duration in seconds, or null if pending/invalid */
  durationSeconds: number | null;
  /** Preserved timing type string from authoritative source */
  timingType: string;
  /** Formatted interval string, e.g. "00:02.40 – 00:04.15" or "Pending voiceover" */
  formattedInterval: string;
  /** Exact integer video frames rendered if source is render */
  frames?: number;
  /** Whether this timing represents actual executed frames */
  isExecuted: boolean;
  /** Whether timing is pending voiceover alignment */
  isPending: boolean;
  /** Whether timing is fallback or proportional */
  isFallback: boolean;
}

export interface ResolveBeatTimingSourceParams {
  beat?: VisualBeat | null;
  storyboardBeat?: VisualBeat | null;
  voiceoverBeat?: VisualBeat | null;
  telemetry?: BeatTelemetryInfo | null;
  renderAnimation?: RenderAnimationItem | null;
  isRenderStale?: boolean;
}

/**
 * Validates whether two numbers represent a finite, ordered, non-negative timing interval.
 */
function isFiniteNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val);
}

/**
 * Selects the authoritative timing source for an individual visual beat according to the priority:
 * 1. Executed render animation record (if render step completed and is not stale).
 * 2. Voiceover visual beat (with continuous narration timestamps).
 * 3. Storyboard visual beat (if already carries valid, assigned timing).
 * 4. Pending / unassigned state.
 *
 * Rules:
 * - Render timestamps must come from actual executed records.
 * - Voiceover timestamps must remain continuous narration timestamps.
 * - Preserve timing_type distinctions such as aligned and fallback_proportional.
 * - Never silently convert an unknown timing type into aligned.
 * - Never treat missing timestamps as zero.
 * - Never invent timestamps or claim estimated timing is actual timing.
 * - When voiceover is pending, returns pending state.
 */
export function resolveBeatTimingSource({
  beat,
  storyboardBeat,
  voiceoverBeat,
  telemetry,
  renderAnimation,
  isRenderStale = false,
}: ResolveBeatTimingSourceParams): ResolvedBeatTiming {
  const targetBeat = beat || storyboardBeat;

  // 1. Render Executed Timing (highest priority, only if not stale and rendered)
  let anim: RenderAnimationItem | null = null;
  if (!isRenderStale) {
    if (telemetry && telemetry.status === "rendered") {
      anim = telemetry.animation;
    } else if (renderAnimation) {
      anim = renderAnimation;
    }
  }

  if (
    anim &&
    isFiniteNumber(anim.start_time) &&
    isFiniteNumber(anim.end_time) &&
    anim.start_time >= 0 &&
    anim.end_time > anim.start_time
  ) {
    const s = anim.start_time;
    const e = anim.end_time;
    const dur =
      typeof anim.duration_seconds === "number" && anim.duration_seconds > 0
        ? anim.duration_seconds
        : Math.round((e - s) * 1000) / 1000;
    return {
      source: "render",
      startTime: s,
      endTime: e,
      durationSeconds: dur,
      timingType: "executed",
      formattedInterval: `${formatTimestamp(s)} – ${formatTimestamp(e)}`,
      frames: anim.frames,
      isExecuted: true,
      isPending: false,
      isFallback: false,
    };
  }

  // 2. Voiceover Aligned Timing (continuous narration timestamps)
  if (
    voiceoverBeat &&
    isFiniteNumber(voiceoverBeat.start_time) &&
    isFiniteNumber(voiceoverBeat.end_time) &&
    voiceoverBeat.start_time >= 0 &&
    voiceoverBeat.end_time > voiceoverBeat.start_time
  ) {
    const s = voiceoverBeat.start_time;
    const e = voiceoverBeat.end_time;
    const dur =
      typeof voiceoverBeat.duration_seconds === "number" && voiceoverBeat.duration_seconds > 0
        ? voiceoverBeat.duration_seconds
        : Math.round((e - s) * 1000) / 1000;
    const rawType = String(voiceoverBeat.timing_type || "aligned").toLowerCase().trim();
    let formatted: string;
    let isFallback = false;
    if (rawType.includes("proportional")) {
      formatted = `~${formatTimestamp(s)} – ${formatTimestamp(e)} (proportional)`;
      isFallback = true;
    } else if (rawType.includes("fallback") || rawType.includes("estimated")) {
      formatted = `~${formatTimestamp(s)} – ${formatTimestamp(e)} (est)`;
      isFallback = true;
    } else if (rawType === "aligned") {
      formatted = `${formatTimestamp(s)} – ${formatTimestamp(e)}`;
    } else {
      formatted = `${formatTimestamp(s)} – ${formatTimestamp(e)} (${rawType})`;
    }

    return {
      source: "voiceover",
      startTime: s,
      endTime: e,
      durationSeconds: dur,
      timingType: voiceoverBeat.timing_type || "aligned",
      formattedInterval: formatted,
      isExecuted: false,
      isPending: false,
      isFallback,
    };
  }

  // 3. Storyboard Planned Timing (only if present, valid, and not unassigned)
  if (targetBeat) {
    const sbType = String(targetBeat.timing_type || "").toLowerCase().trim();
    if (
      sbType !== "unassigned" &&
      isFiniteNumber(targetBeat.start_time) &&
      isFiniteNumber(targetBeat.end_time) &&
      targetBeat.start_time >= 0 &&
      targetBeat.end_time > targetBeat.start_time
    ) {
      const s = targetBeat.start_time;
      const e = targetBeat.end_time;
      const dur =
        typeof targetBeat.duration_seconds === "number" && targetBeat.duration_seconds > 0
          ? targetBeat.duration_seconds
          : Math.round((e - s) * 1000) / 1000;
      const isFallback =
        sbType.includes("proportional") ||
        sbType.includes("fallback") ||
        sbType.includes("estimated");
      let formatted = `${formatTimestamp(s)} – ${formatTimestamp(e)}`;
      if (sbType.includes("proportional")) {
        formatted = `~${formatTimestamp(s)} – ${formatTimestamp(e)} (proportional)`;
      } else if (sbType.includes("fallback") || sbType.includes("estimated")) {
        formatted = `~${formatTimestamp(s)} – ${formatTimestamp(e)} (est)`;
      }
      return {
        source: "storyboard",
        startTime: s,
        endTime: e,
        durationSeconds: dur,
        timingType: targetBeat.timing_type || "estimated",
        formattedInterval: formatted,
        isExecuted: false,
        isPending: false,
        isFallback,
      };
    }
  }

  // 4. Pending / Unassigned
  return {
    source: "pending",
    startTime: null,
    endTime: null,
    durationSeconds: null,
    timingType: "unassigned",
    formattedInterval: "Pending voiceover",
    isExecuted: false,
    isPending: true,
    isFallback: false,
  };
}

export interface CorrelatedBeatItem {
  beat: VisualBeat;
  sceneIndex: number;
  telemetry: BeatTelemetryInfo;
  voiceoverBeat?: VisualBeat | null;
  resolvedTiming: ResolvedBeatTiming;
}

export interface CorrelatedSceneItem {
  scene: StoryboardScene;
  index: number;
  beats: CorrelatedBeatItem[];
  sceneTelemetry?: RenderAnimationItem | null;
  sceneFallbackReason?: string | null;
}

export interface CorrelateBeatsWithTelemetryParams {
  scenes: StoryboardScene[];
  voiceoverItems?: VoiceoverItem[] | null;
  renderData?: RenderData | null;
  isRenderStale?: boolean;
}

export interface BeatCorrelationResult {
  /** Hierarchical scenes and their correlated visual beats */
  scenes: CorrelatedSceneItem[];
  /** Map of unique beat key (beat.id or `${scene.index}_${beat.order}`) to BeatTelemetryInfo */
  beatTelemetry: Map<string, BeatTelemetryInfo>;
  /** Map of unique beat key to voiceover VisualBeat if available */
  voiceoverBeats: Map<string, VisualBeat>;
  /** Map of scene index to scene-level fallback reason (if scene reverted to scene-level render) */
  sceneFallbacks: Map<number, string>;
  /** Total number of visual beats across all scenes */
  totalBeatsCount: number;
  /** Number of visual beats that successfully rendered */
  renderedBeatsCount: number;
  /** Number of visual beats that fell back or could not be rendered */
  fallbackBeatsCount: number;
  /** Overall render mode reported by renderData ("visual_beats", "scene", or "none") */
  renderMode: string;
  /** Whether the render data was marked as stale */
  isRenderStale: boolean;
}

/**
 * Correlates storyboard scenes and planned visual beats with actual executed render telemetry
 * and voiceover timing items.
 *
 * Requirements:
 * - Match beat execution records using verified identifiers (scene_index + beat_id, falling back to scene_index + beat_order).
 * - Never correlate purely by array index.
 * - Match scene-level fallback records by scene_index.
 * - Never represent a scene-level fallback as a successfully rendered beat.
 * - Preserve distinction between missing telemetry (unavailable) and explicit fallback.
 * - Defensively handles missing or malformed inputs without mutating data or throwing errors.
 */
export function correlateBeatsWithTelemetry({
  scenes,
  voiceoverItems,
  renderData,
  isRenderStale = false,
}: CorrelateBeatsWithTelemetryParams): BeatCorrelationResult {
  const beatTelemetry = new Map<string, BeatTelemetryInfo>();
  const voiceoverBeats = new Map<string, VisualBeat>();
  const sceneFallbacks = new Map<number, string>();
  const sceneItems: CorrelatedSceneItem[] = [];

  let totalBeatsCount = 0;
  let renderedBeatsCount = 0;
  let fallbackBeatsCount = 0;

  // 1. Index render animations
  const beatAnimByPrimaryKey = new Map<string, RenderAnimationItem>();
  const beatAnimBySecondaryKey = new Map<string, RenderAnimationItem>();
  const sceneAnimMap = new Map<number, RenderAnimationItem>();
  const sceneFallbackReasonsMap = new Map<number, string>();

  const isGlobalSceneMode =
    String(renderData?.render_mode || "").toLowerCase().trim() === "scene";

  if (renderData && Array.isArray(renderData.animations)) {
    for (const anim of renderData.animations) {
      if (!anim || typeof anim !== "object") continue;
      const scIdx = Number(anim.scene_index ?? (anim as Record<string, unknown>).index);
      if (!Number.isFinite(scIdx)) continue;

      const isBeat =
        anim.render_mode === "visual_beat" ||
        anim.render_mode === "beat" ||
        (anim.render_mode !== "scene" &&
          (anim.beat_id != null || typeof anim.beat_order === "number"));

      if (isBeat) {
        if (anim.beat_id && String(anim.beat_id).trim()) {
          beatAnimByPrimaryKey.set(`${scIdx}:${String(anim.beat_id).trim()}`, anim);
        }
        if (typeof anim.beat_order === "number" && Number.isFinite(anim.beat_order)) {
          beatAnimBySecondaryKey.set(`${scIdx}:${anim.beat_order}`, anim);
        }
      } else {
        sceneAnimMap.set(scIdx, anim);
        if (anim.beat_fallback_reason || anim.fallback_reason) {
          sceneFallbackReasonsMap.set(
            scIdx,
            String(anim.beat_fallback_reason || anim.fallback_reason)
          );
        }
      }
    }
  }

  // 2. Index top-level beat_fallback_reasons or scene_fallbacks
  const rawFallbackReasons =
    renderData?.beat_fallback_reasons ||
    (renderData as Record<string, unknown> | undefined)?.scene_fallbacks;
  if (rawFallbackReasons && typeof rawFallbackReasons === "object") {
    for (const [key, val] of Object.entries(rawFallbackReasons)) {
      const parsedIdx = parseInt(key, 10);
      if (Number.isFinite(parsedIdx) && val) {
        sceneFallbackReasonsMap.set(parsedIdx, String(val));
      }
    }
  }

  // 3. Index voiceover items & their visual beats
  const voBeatByPrimaryKey = new Map<string, VisualBeat>();
  const voBeatBySecondaryKey = new Map<string, VisualBeat>();

  if (Array.isArray(voiceoverItems)) {
    for (const voItem of voiceoverItems) {
      if (!voItem || typeof voItem !== "object") continue;
      const scIdx = Number(
        (voItem as Record<string, unknown>).scene_index ??
          voItem.scene_id ??
          voItem.index
      );
      if (!Number.isFinite(scIdx)) continue;

      if (Array.isArray(voItem.visual_beats)) {
        for (const vb of voItem.visual_beats) {
          if (!vb || typeof vb !== "object") continue;
          if (vb.id && String(vb.id).trim()) {
            voBeatByPrimaryKey.set(`${scIdx}:${String(vb.id).trim()}`, vb);
          }
          if (typeof vb.order === "number" && Number.isFinite(vb.order)) {
            voBeatBySecondaryKey.set(`${scIdx}:${vb.order}`, vb);
          }
        }
      }
    }
  }

  // 4. Deterministically correlate each storyboard scene and beat
  const safeScenes = Array.isArray(scenes) ? scenes : [];

  for (const scene of safeScenes) {
    if (!scene || typeof scene !== "object") continue;
    const scIdx = Number(scene.index);
    if (!Number.isFinite(scIdx)) continue;

    // Check if the whole scene had a scene-level fallback
    const sceneFallbackReason =
      sceneFallbackReasonsMap.get(scIdx) ||
      sceneAnimMap.get(scIdx)?.beat_fallback_reason ||
      sceneAnimMap.get(scIdx)?.fallback_reason ||
      (isGlobalSceneMode ? "Rendered at scene level" : null);
    const sceneFallbackAnim = sceneAnimMap.get(scIdx);

    if (sceneFallbackReason) {
      sceneFallbacks.set(scIdx, sceneFallbackReason);
    }

    const beats = Array.isArray(scene.visual_beats) ? scene.visual_beats : [];
    const beatItems: CorrelatedBeatItem[] = [];

    for (const beat of beats) {
      if (!beat || typeof beat !== "object") continue;
      totalBeatsCount++;

      const beatKey = beat.id || `${scIdx}_${beat.order}`;
      const primaryLookup = beat.id ? `${scIdx}:${beat.id}` : null;
      const secondaryLookup = `${scIdx}:${beat.order}`;

      // Voiceover beat correlation
      const voBeat =
        (primaryLookup ? voBeatByPrimaryKey.get(primaryLookup) : undefined) ||
        voBeatBySecondaryKey.get(secondaryLookup);
      if (voBeat) {
        voiceoverBeats.set(beatKey, voBeat);
      }

      // Render animation correlation
      const anim =
        (primaryLookup ? beatAnimByPrimaryKey.get(primaryLookup) : undefined) ||
        beatAnimBySecondaryKey.get(secondaryLookup);

      const beatId = beat.id || `beat_${scIdx}_${beat.order}`;
      const beatOrder = typeof beat.order === "number" ? beat.order : 1;

      let telInfo: BeatTelemetryInfo;

      if (anim) {
        if (isRenderStale) {
          telInfo = {
            status: "stale",
            sceneIndex: scIdx,
            beatId,
            beatOrder,
            previousStatus: "rendered",
            previousAnimation: anim,
            isStale: true,
          };
        } else {
          renderedBeatsCount++;
          const dur =
            typeof anim.duration_seconds === "number" && anim.duration_seconds > 0
              ? anim.duration_seconds
              : isFiniteNumber(anim.start_time) && isFiniteNumber(anim.end_time)
              ? Math.round((anim.end_time - anim.start_time) * 1000) / 1000
              : 0;

          telInfo = {
            status: "rendered",
            sceneIndex: scIdx,
            beatId,
            beatOrder,
            animation: anim,
            frames: anim.frames,
            durationSeconds: dur,
            startTime: anim.start_time,
            endTime: anim.end_time,
            feasibilityStatus: anim.feasibility_status,
            fallbackApplied: anim.fallback_applied,
            fallbackReason: anim.fallback_reason,
            isStale: false,
          };
        }
      } else if (sceneFallbackReason || sceneFallbackAnim) {
        const reasonStr =
          sceneFallbackReason ||
          String(
            sceneFallbackAnim?.beat_fallback_reason ||
              sceneFallbackAnim?.fallback_reason ||
              "scene_fallback"
          );
        if (isRenderStale) {
          telInfo = {
            status: "stale",
            sceneIndex: scIdx,
            beatId,
            beatOrder,
            previousStatus: "scene_fallback",
            previousAnimation: sceneFallbackAnim,
            isStale: true,
          };
        } else {
          fallbackBeatsCount++;
          telInfo = {
            status: "scene_fallback",
            sceneIndex: scIdx,
            beatId,
            beatOrder,
            fallbackReason: reasonStr,
            beatFallbackReason: reasonStr,
            animation: sceneFallbackAnim,
            sceneAnimation: sceneFallbackAnim,
            isStale: false,
          };
        }
      } else {
        telInfo = {
          status: "unavailable",
          sceneIndex: scIdx,
          beatId,
          beatOrder,
          reason: "No render record found",
          isStale: false,
        };
      }

      beatTelemetry.set(beatKey, telInfo);

      const resolvedTiming = resolveBeatTimingSource({
        beat,
        voiceoverBeat: voBeat,
        telemetry: telInfo,
        isRenderStale,
      });

      beatItems.push({
        beat,
        sceneIndex: scIdx,
        telemetry: telInfo,
        voiceoverBeat: voBeat,
        resolvedTiming,
      });
    }

    sceneItems.push({
      scene,
      index: scIdx,
      beats: beatItems,
      sceneTelemetry: sceneAnimMap.get(scIdx) || null,
      sceneFallbackReason: sceneFallbackReason || null,
    });
  }

  const rawRenderMode = String(renderData?.render_mode || "").toLowerCase().trim();
  const overallRenderMode =
    rawRenderMode ||
    (renderedBeatsCount > 0 ? "visual_beats" : renderData ? "scene" : "none");

  return {
    scenes: sceneItems,
    beatTelemetry,
    voiceoverBeats,
    sceneFallbacks,
    totalBeatsCount,
    renderedBeatsCount,
    fallbackBeatsCount,
    renderMode: overallRenderMode,
    isRenderStale,
  };
}

/**
 * Resolves the authoritative timing for a visual beat using correlated pipeline telemetry.
 */
export function resolveCorrelatedBeatTiming(
  beatOrItem: VisualBeat | CorrelatedBeatItem,
  sceneIndexOrCorrelation?: number | BeatCorrelationResult,
  correlationMaybe?: BeatCorrelationResult
): ResolvedBeatTiming {
  if (
    typeof beatOrItem === "object" &&
    beatOrItem !== null &&
    "resolvedTiming" in beatOrItem &&
    "sceneIndex" in beatOrItem
  ) {
    return (beatOrItem as CorrelatedBeatItem).resolvedTiming;
  }
  const beat = beatOrItem as VisualBeat;
  const sceneIndex = typeof sceneIndexOrCorrelation === "number" ? sceneIndexOrCorrelation : 1;
  const correlation = (typeof sceneIndexOrCorrelation === "object"
    ? sceneIndexOrCorrelation
    : correlationMaybe) as BeatCorrelationResult | undefined;
  if (!correlation) {
    return resolveBeatTimingSource({ beat });
  }
  const beatKey = beat.id || `${sceneIndex}_${beat.order}`;
  return resolveBeatTimingSource({
    beat,
    voiceoverBeat: correlation.voiceoverBeats?.get(beatKey),
    telemetry: correlation.beatTelemetry?.get(beatKey),
    isRenderStale: correlation.isRenderStale,
  });
}

export interface TimelineMetrics {
  effectiveTotalDuration: number | null;
  totalBeatsCount: number;
  timedBeatsCount: number;
  pendingBeatsCount: number;
  hasContinuousTiming: boolean;
  renderedCount: number;
  fallbackCount: number;
  rulerTicks: Array<{ ratio: number; timestamp: string; percent: number }>;
}

/**
 * Computes top-level duration bounds, metric counts, and ruler ticks across scenes and beats.
 */
export function computeTimelineMetrics(
  scenes: CorrelatedSceneItem[],
  totalDurationSeconds?: number | null
): TimelineMetrics {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return {
      effectiveTotalDuration: null,
      totalBeatsCount: 0,
      timedBeatsCount: 0,
      pendingBeatsCount: 0,
      hasContinuousTiming: false,
      renderedCount: 0,
      fallbackCount: 0,
      rulerTicks: [],
    };
  }

  let maxEndTime = 0;
  let totalBeatsCount = 0;
  let timedBeatsCount = 0;
  let pendingBeatsCount = 0;
  let renderedCount = 0;
  let fallbackCount = 0;

  for (const sceneItem of scenes) {
    if (Array.isArray(sceneItem.beats) && sceneItem.beats.length > 0) {
      for (const beatItem of sceneItem.beats) {
        totalBeatsCount++;
        if (beatItem.telemetry.status === "rendered") renderedCount++;
        if (beatItem.telemetry.status === "scene_fallback") fallbackCount++;

        const s = beatItem.resolvedTiming.startTime;
        const e = beatItem.resolvedTiming.endTime;
        if (
          typeof s === "number" &&
          typeof e === "number" &&
          Number.isFinite(s) &&
          Number.isFinite(e) &&
          e > s
        ) {
          timedBeatsCount++;
          if (e > maxEndTime) maxEndTime = e;
        } else {
          pendingBeatsCount++;
        }
      }
    } else {
      // Legacy scene without beats
      const s = sceneItem.scene.start_time;
      const e = sceneItem.scene.end_time;
      if (
        typeof s === "number" &&
        typeof e === "number" &&
        Number.isFinite(s) &&
        Number.isFinite(e) &&
        e > s
      ) {
        if (e > maxEndTime) maxEndTime = e;
      } else if (
        typeof sceneItem.scene.est_seconds === "number" &&
        sceneItem.scene.est_seconds > 0
      ) {
        maxEndTime += sceneItem.scene.est_seconds;
      }
    }
  }

  const effectiveTotalDuration =
    typeof totalDurationSeconds === "number" && totalDurationSeconds > 0
      ? totalDurationSeconds
      : maxEndTime > 0
      ? maxEndTime
      : null;

  const hasContinuousTiming = Boolean(
    effectiveTotalDuration && effectiveTotalDuration > 0 && (timedBeatsCount > 0 || maxEndTime > 0)
  );

  const rulerTicks =
    hasContinuousTiming && effectiveTotalDuration
      ? [0, 0.25, 0.5, 0.75, 1.0].map((ratio) => ({
          ratio,
          timestamp: formatTimestamp(effectiveTotalDuration * ratio),
          percent: ratio * 100,
        }))
      : [];

  return {
    effectiveTotalDuration,
    totalBeatsCount,
    timedBeatsCount,
    pendingBeatsCount,
    hasContinuousTiming,
    renderedCount,
    fallbackCount,
    rulerTicks,
  };
}

export interface SceneTrackGeometry {
  sceneIndex: number;
  startTime: number | null;
  endTime: number | null;
  durationSeconds: number | null;
  leftPercent: number | null;
  widthPercent: number | null;
  hasFallback: boolean;
  fallbackReason: string | null;
}

/**
 * Computes exact continuous start/end bounds and linear percentages for a scene track.
 * Never invents proportional widths if continuous timestamps are unavailable.
 */
export function computeSceneTrackGeometry(
  sceneItem: CorrelatedSceneItem,
  effectiveTotalDuration: number | null
): SceneTrackGeometry {
  let scStart: number | null = null;
  let scEnd: number | null = null;

  if (Array.isArray(sceneItem.beats) && sceneItem.beats.length > 0) {
    for (const b of sceneItem.beats) {
      const bs = b.resolvedTiming.startTime;
      const be = b.resolvedTiming.endTime;
      if (typeof bs === "number" && typeof be === "number" && be > bs) {
        if (scStart === null || bs < scStart) scStart = bs;
        if (scEnd === null || be > scEnd) scEnd = be;
      }
    }
  } else if (
    typeof sceneItem.scene.start_time === "number" &&
    typeof sceneItem.scene.end_time === "number" &&
    sceneItem.scene.end_time > sceneItem.scene.start_time
  ) {
    scStart = sceneItem.scene.start_time;
    scEnd = sceneItem.scene.end_time;
  }

  const hasValidBounds =
    scStart !== null &&
    scEnd !== null &&
    scEnd > scStart &&
    effectiveTotalDuration !== null &&
    effectiveTotalDuration > 0;

  const dur = scStart !== null && scEnd !== null ? Math.round((scEnd - scStart) * 1000) / 1000 : null;
  const leftPct =
    hasValidBounds && scStart !== null
      ? Math.round(((scStart / effectiveTotalDuration) * 100) * 10000) / 10000
      : null;
  const widthPct = hasValidBounds && dur !== null ? Math.round(((dur / effectiveTotalDuration) * 100) * 10000) / 10000 : null;

  return {
    sceneIndex: sceneItem.index,
    startTime: scStart,
    endTime: scEnd,
    durationSeconds: dur,
    leftPercent: leftPct,
    widthPercent: widthPct,
    hasFallback: Boolean(sceneItem.sceneFallbackReason),
    fallbackReason: sceneItem.sceneFallbackReason || null,
  };
}

export interface BeatSegmentGeometry {
  beatKey: string;
  sceneIndex: number;
  beatOrder: number;
  startTime: number | null;
  endTime: number | null;
  durationSeconds: number | null;
  leftPercent: number | null;
  widthPercent: number | null;
  isPending: boolean;
  formattedInterval: string;
  telemetryDisplay: {
    status: string;
    label: string;
    icon: string;
    barBg: string;
    barBorder: string;
    badgeStyle: string;
    accessibleText: string;
  };
  timingBadge: {
    label: string;
    icon: string;
    badgeStyle: string;
    accessibleText: string;
  };
}

/**
 * Returns visual styling, accessible description, and text badge for a beat's render telemetry.
 */
export function getTimelineTelemetryDisplay(telemetry: BeatTelemetryInfo) {
  switch (telemetry.status) {
    case "rendered":
      return {
        status: "rendered" as const,
        label: "Rendered",
        icon: "✓",
        barBg: "bg-emerald-600 text-white hover:bg-emerald-700",
        barBorder: "border-emerald-700",
        badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-300",
        accessibleText: `Rendered: executed by video renderer${
          telemetry.frames ? ` (${telemetry.frames} frames)` : ""
        }`,
      };
    case "scene_fallback":
      return {
        status: "scene_fallback" as const,
        label: "Scene Fallback",
        icon: "⚠️",
        barBg: "bg-amber-500 text-white hover:bg-amber-600",
        barBorder: "border-amber-700 border-dashed",
        badgeStyle: "bg-amber-50 text-amber-800 border-amber-300",
        accessibleText: `Scene Fallback: individual beat animation skipped, executed as scene animation (${
          telemetry.beatFallbackReason || telemetry.fallbackReason || "scene-level render"
        })`,
      };
    case "stale":
      return {
        status: "stale" as const,
        label: "Stale Render",
        icon: "🔄",
        barBg: "bg-purple-600 text-white hover:bg-purple-700",
        barBorder: "border-purple-800 border-dashed",
        badgeStyle: "bg-purple-50 text-purple-800 border-purple-300",
        accessibleText: "Stale: render output is outdated due to upstream pipeline changes",
      };
    case "unavailable":
    default:
      return {
        status: "unavailable" as const,
        label: "Not Rendered",
        icon: "⏳",
        barBg: "bg-slate-400 text-slate-900 hover:bg-slate-500",
        barBorder: "border-slate-500",
        badgeStyle: "bg-slate-100 text-slate-700 border-slate-300",
        accessibleText: "Unavailable: render telemetry not yet completed or recorded",
      };
  }
}

/**
 * Returns timing badge styling and accessible text for a beat's authoritative timing source.
 */
export function getTimelineTimingBadge(timing: ResolvedBeatTiming) {
  if (timing.isPending) {
    return {
      label: "Pending voiceover",
      icon: "⏱️",
      badgeStyle: "bg-slate-100 text-slate-600 border-slate-200",
      accessibleText: "Timing pending voiceover alignment",
    };
  }
  if (timing.isExecuted) {
    return {
      label: `Executed (${timing.frames ?? 0}f)`,
      icon: "🎬",
      badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
      accessibleText: `Executed render timing: ${timing.formattedInterval} (${timing.frames ?? 0} frames)`,
    };
  }
  if (timing.timingType.includes("proportional")) {
    return {
      label: "Proportional (est)",
      icon: "~",
      badgeStyle: "bg-blue-50 text-blue-700 border-blue-200",
      accessibleText: `Proportional voiceover estimate: ${timing.formattedInterval}`,
    };
  }
  if (timing.timingType === "aligned") {
    return {
      label: "Word-Aligned",
      icon: "🎯",
      badgeStyle: "bg-teal-50 text-teal-700 border-teal-200",
      accessibleText: `Word-aligned continuous narration: ${timing.formattedInterval}`,
    };
  }
  return {
    label: timing.timingType || "Planned",
    icon: "⏱️",
    badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
    accessibleText: `Storyboard planned timing: ${timing.formattedInterval}`,
  };
}

/**
 * Computes exact continuous start/end bounds, linear percentages, and display models
 * for an individual visual beat segment.
 * Pending beats return null percentages and are never plotted with fabricated widths.
 */
export function computeBeatSegmentGeometry(
  beatItem: CorrelatedBeatItem,
  effectiveTotalDuration: number | null
): BeatSegmentGeometry {
  const beat = beatItem.beat;
  const beatKey = beat.id || `${beatItem.sceneIndex}_${beat.order}`;
  const timing = beatItem.resolvedTiming;
  const bs = timing.startTime;
  const be = timing.endTime;

  const hasValidTiming =
    typeof bs === "number" &&
    typeof be === "number" &&
    be > bs &&
    effectiveTotalDuration !== null &&
    effectiveTotalDuration > 0;

  const dur = hasValidTiming ? Math.round((be - bs) * 1000) / 1000 : null;
  const leftPct = hasValidTiming ? Math.round(((bs / effectiveTotalDuration) * 100) * 10000) / 10000 : null;
  const widthPct = hasValidTiming && dur !== null ? Math.round(((dur / effectiveTotalDuration) * 100) * 10000) / 10000 : null;

  return {
    beatKey,
    sceneIndex: beatItem.sceneIndex,
    beatOrder: beat.order,
    startTime: bs,
    endTime: be,
    durationSeconds: dur,
    leftPercent: leftPct,
    widthPercent: widthPct,
    isPending: timing.isPending || !hasValidTiming,
    formattedInterval: timing.formattedInterval,
    telemetryDisplay: getTimelineTelemetryDisplay(beatItem.telemetry),
    timingBadge: getTimelineTimingBadge(timing),
  };
}

/**
 * Safely parses an ISO date-time string or timestamp value into epoch milliseconds.
 * Returns null if the value is missing, empty, or cannot be parsed into a valid finite timestamp.
 */
export function parseStepTimestamp(timestamp: unknown): number | null {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return timestamp > 0 ? timestamp : null;
  }
  if (typeof timestamp !== "string") {
    return null;
  }
  const trimmed = timestamp.trim();
  if (!trimmed) {
    return null;
  }
  // Must start with YYYY-MM-DD or be a numeric timestamp string
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed) && !/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = new Date(trimmed).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export interface EvaluateRenderStalenessParams {
  renderStep?: StepOut | null;
  storyboardStep?: StepOut | null;
  imagesStep?: StepOut | null;
  voiceoverStep?: StepOut | null;
  allSteps?: StepOut[] | null;
  isRender?: boolean;
  isStale?: boolean;
}

/**
 * Evaluates whether a video's render output is outdated based on explicit backend
 * step status or upstream dependency completion timestamps.
 *
 * Rules:
 * 1. If renderStep.status === "stale", returns true.
 * 2. If isRender && isStale (active panel viewing the render step with stale status), returns true.
 * 3. Upstream dependency check:
 *    - Upstream steps checked: Storyboard, Images, Voiceover.
 *    - Subtitles step is DOWNSTREAM of rendering and is strictly excluded.
 *    - If an upstream step finished strictly after the render step (upstreamFinish > renderFinish),
 *      returns true.
 *    - Equal timestamps (upstreamFinish === renderFinish) do not indicate staleness.
 *    - Missing or invalid timestamps are safely ignored (skipped) and never crash.
 *    - If renderStep.finished_at is missing or invalid, timestamp comparison cannot be performed;
 *      returns false unless explicit status marked it stale.
 */
export function evaluateRenderStaleness({
  renderStep,
  storyboardStep,
  imagesStep,
  voiceoverStep,
  allSteps,
  isRender = false,
  isStale = false,
}: EvaluateRenderStalenessParams): boolean {
  const stepsList = Array.isArray(allSteps) ? allSteps : [];

  const resolvedRender =
    renderStep ??
    stepsList.find((s) => s.name?.toLowerCase() === "render") ??
    null;

  // 1. Explicit backend stale status on render step
  if (resolvedRender?.status === "stale") {
    return true;
  }

  // 2. Active panel viewing render step with stale status
  if (isRender && isStale) {
    return true;
  }

  // 3. Upstream dependency completion timestamp comparison
  const renderFinish = parseStepTimestamp(resolvedRender?.finished_at);
  if (renderFinish === null) {
    return false;
  }

  const resolvedStoryboard =
    storyboardStep ??
    stepsList.find((s) => s.name?.toLowerCase() === "storyboard") ??
    null;
  const sbFinish = parseStepTimestamp(resolvedStoryboard?.finished_at);
  if (sbFinish !== null && sbFinish > renderFinish) {
    return true;
  }

  const resolvedImages =
    imagesStep ??
    stepsList.find((s) => s.name?.toLowerCase() === "images") ??
    null;
  const imgFinish = parseStepTimestamp(resolvedImages?.finished_at);
  if (imgFinish !== null && imgFinish > renderFinish) {
    return true;
  }

  const resolvedVoiceover =
    voiceoverStep ??
    stepsList.find((s) => s.name?.toLowerCase() === "voiceover") ??
    null;
  const voFinish = parseStepTimestamp(resolvedVoiceover?.finished_at);
  if (voFinish !== null && voFinish > renderFinish) {
    return true;
  }

  return false;
}

