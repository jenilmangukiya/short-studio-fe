import type { components } from "./api-types";

export type User = components["schemas"]["UserOut"];
export type UserCreate = components["schemas"]["UserCreate"];
export type Token = components["schemas"]["Token"];

export type Channel = components["schemas"]["ChannelOut"];
export type ChannelCreate = components["schemas"]["ChannelCreate"];
export type ChannelUpdate = components["schemas"]["ChannelUpdate"];

export type VideoSummary = components["schemas"]["VideoSummary"];
export type VideoDetail = components["schemas"]["VideoDetail"];
export type VideoCreate = components["schemas"]["VideoCreate"];

export type StepOut = components["schemas"]["StepOut"] & {
  revisions_count?: number;
};
export type StepStatus = "pending" | "running" | "awaiting_approval" | "done" | "failed" | "stale";
export type VideoStatus = "draft" | "in_progress" | "completed" | "failed";

export interface StepRevision {
  id: string;
  step_id: string;
  version: number;
  output: Record<string, unknown> | null;
  user_prompt: string | null;
  change_summary: string | null;
  created_at: string;
}

export const PIPELINE_STEP_NAMES = [
  "creative_direction",
  "script",
  "video_bible",
  "storyboard",
  "images",
  "voiceover",
  "render",
  "subtitles",
] as const;

export type PipelineStepName = (typeof PIPELINE_STEP_NAMES)[number];

export const DEFAULT_SUBTITLE_STYLE_ID = "clean_cinematic" as const;

export type SubtitleStyleId =
  | "clean_cinematic"
  | "remotion_neon"
  | "dynamic_highlight"
  | (string & {});

export interface SubtitleStyleOut {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
}

export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export type SubtitleTimingSource =
  | "forced_alignment"
  | "estimated"
  | string;

export interface SubtitleSegment {
  index: number;
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
  timing_source?: SubtitleTimingSource;
}

export interface SubtitleData {
  segments: SubtitleSegment[];
  style?: SubtitleStyleId | null;
  format?: string;
  total_words?: number;
  total_duration_seconds?: number;
  timing_source?: SubtitleTimingSource;
  alignment_hash?: string | null;
  file?: string;
  vtt_file?: string;
  srt_file?: string;
  ass_file?: string;
  captioned_file?: string;
  captioned_video_path?: string;
}

export interface SubtitleMeta {
  style?: SubtitleStyleId | null;
  task?: string;
  provider?: string;
  model?: string;
  timing_source?: SubtitleTimingSource;
  alignment_hash?: string | null;
  audio_file?: string | null;
  reused?: boolean;
  scenes_count?: number;
  words_count?: number;
  duration_seconds?: number;
  captioned_burned?: boolean;
  latency_seconds?: number;
  mock?: boolean;
  [key: string]: unknown;
}

export interface SubtitlesStepOutput {
  subtitles?: SubtitleData;
  style?: SubtitleStyleId | null;
  subtitles_path?: string;
  vtt_path?: string;
  srt_path?: string;
  ass_path?: string;
  captioned_video_path?: string;
  warnings?: string[];
  meta?: SubtitleMeta;
  mock?: boolean;
  [key: string]: unknown;
}


export interface ScriptContent {
  title?: string;
  hook?: string;
  narration?: string;
  angle?: string;
  claims_to_verify?: string[];
  hashtags?: string[];
}

export interface ScriptMeta {
  prompt_version?: string;
  provider?: string;
  model?: string;
  task?: string;
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  latency_seconds?: number;
  attempts?: number;
  revision?: boolean | null;
}

export interface ScriptStepOutput {
  script?: ScriptContent;
  warnings?: string[];
  meta?: ScriptMeta;
  [key: string]: unknown;
}

export type ImageStrategy =
  | "reuse_scene_image"
  | "reuse_previous_image"
  | "new_image"
  | string;

export type BeatTimingType =
  | "unassigned"
  | "aligned"
  | "fallback"
  | string;

export interface VisualBeat {
  id: string;
  scene_id?: string;
  order: number;
  narration_text: string;
  start_time?: number | null;
  end_time?: number | null;
  duration_seconds?: number | null;
  start_word_index?: number | null;
  end_word_index?: number | null;
  timing_type?: BeatTimingType;
  visual_description?: string;
  visual_purpose?: string;
  shot_type?: string;
  camera_angle?: string;
  focal_point?: string;
  visual_technique?: string;
  image_strategy?: ImageStrategy;
  source_image_id?: string | null;
  [key: string]: unknown;
}

export interface StoryboardScene {
  index: number;
  narration: string;
  image_prompt: string;
  shot_type: string;
  est_seconds: number;
  visual_purpose?: string;
  camera_angle?: string;
  focal_point?: string;
  visual_technique?: string;
  environment?: string;
  uses_anchor?: boolean;
  final_prompt?: string;
  animation?: Record<string, unknown> | null;
  visual_beats?: VisualBeat[];
  start_time?: number | null;
  end_time?: number | null;
  duration_seconds?: number | null;
  [key: string]: unknown;
}

export type StoryboardStyleSource = "channel" | "default";

export interface StoryboardData {
  visual_style: string;
  style_source: StoryboardStyleSource | string;
  scenes: StoryboardScene[];
  total_seconds: number;
  subject_anchor?: string;
  environment_anchor?: string;
  total_visual_beats?: number;
  [key: string]: unknown;
}

export interface StoryboardMeta {
  prompt_version?: string;
  provider?: string;
  model?: string;
  task?: string;
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  latency_seconds?: number;
  attempts?: number;
  revision?: boolean | null;
}

export interface StoryboardStepOutput {
  storyboard?: StoryboardData;
  warnings?: string[];
  meta?: StoryboardMeta;
  [key: string]: unknown;
}

export interface ImageItem {
  index: number;
  status: "ok" | "failed" | string;
  file?: string | null;
  prompt: string;
  prompt_hash: string;
  reused: boolean;
  model: string;
  size: string;
  quality: string;
  latency_seconds: number;
  est_cost_usd?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  error?: string | null;
  [key: string]: unknown;
}

export interface ImagesData {
  items: ImageItem[];
  complete: boolean;
  [key: string]: unknown;
}

export interface ImagesMeta {
  provider?: string;
  model?: string;
  task?: string;
  images_total?: number;
  images_generated?: number;
  images_reused?: number;
  images_failed?: number;
  est_cost_usd?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  latency_seconds?: number;
  mock?: boolean;
  [key: string]: unknown;
}

export interface ImagesStepOutput {
  images?: ImagesData;
  warnings?: string[];
  meta?: ImagesMeta;
  mock?: boolean;
  [key: string]: unknown;
}

export interface VoiceoverItem {
  index: number;
  scene_index?: number;
  scene_id?: number | string;
  narration: string;
  start_time?: number;
  end_time?: number;
  duration_seconds: number;
  timing_type?: "estimated" | "aligned" | string;
  sample_rate?: number;
  voice?: string;
  speed?: number;
  latency_seconds?: number;
  status: "ok" | "failed" | string;
  reused: boolean;
  audio_hash?: string;
  error?: string | null;
  visual_beats?: VisualBeat[];
  [key: string]: unknown;
}

export interface VoiceoverData {
  continuous?: boolean;
  audio_file?: string | null;
  narration_script?: string;
  audio_hash?: string;
  items: VoiceoverItem[];
  complete: boolean;
  total_duration_seconds: number;
  error?: string | null;
  [key: string]: unknown;
}

export interface VoiceoverMeta {
  provider?: string;
  model?: string;
  task?: string;
  scenes_total?: number;
  scenes_generated?: number;
  scenes_reused?: number;
  scenes_failed?: number;
  voice?: string;
  speed?: number;
  latency_seconds?: number;
  continuous?: boolean;
  chunks_count?: number;
  inference_calls?: number;
  audio_file?: string | null;
  audio_hash?: string;
  mock?: boolean;
  [key: string]: unknown;
}

export interface VoiceoverStepOutput {
  voiceover?: VoiceoverData;
  audio_file?: string | null;
  file?: string | null;
  narration_script?: string;
  audio_hash?: string;
  duration_seconds?: number;
  warnings?: string[];
  meta?: VoiceoverMeta;
  mock?: boolean;
  error?: string | null;
  [key: string]: unknown;
}

export interface RenderAnimationItem {
  scene_index?: number;
  render_mode?: "visual_beat" | "beat" | "scene" | string;
  start_time?: number;
  end_time?: number;
  frames?: number;
  // Beat-specific fields (present when render_mode === "visual_beat" or "beat")
  beat_id?: string;
  beat_order?: number;
  beat_fallback_reason?: string | null;
  feasibility_status?: "safe_reuse" | "questionable_reuse" | "new_image_needed" | string;
  image_file?: string;
  fallback_applied?: boolean | string | null;
  fallback_reason?: string | null;
  warnings?: string[];
  // Camera & motion fields
  animation_type?: string;
  focal_point?: string;
  focal_coords?: [number, number];
  start_coords?: [number, number];
  end_coords?: [number, number];
  start_scale?: number;
  end_scale?: number;
  intensity?: string;
  duration_seconds?: number;
  reasoning?: string;
  [key: string]: unknown;
}

export interface RenderData {
  video_path?: string;
  duration_seconds?: number;
  resolution?: string;
  fps?: number;
  codec?: string;
  audio_codec?: string;
  file_size_bytes?: number;
  scenes_rendered?: number;
  beats_rendered?: number;
  render_mode?: "visual_beats" | "beat" | "scene" | string;
  beat_fallback_reasons?: Record<number | string, string>;
  timing_source?: "aligned" | "estimated" | string;
  alignment_hash?: string | null;
  audio_source?: string;
  audio_file?: string | null;
  animations?: RenderAnimationItem[];
  [key: string]: unknown;
}

export type BeatTelemetryStatus =
  | "rendered"
  | "scene_fallback"
  | "unavailable"
  | "stale";

export interface BeatTelemetryRendered {
  status: "rendered";
  sceneIndex: number;
  beatId: string;
  beatOrder: number;
  animation: RenderAnimationItem;
  frames?: number;
  durationSeconds: number;
  startTime?: number;
  endTime?: number;
  feasibilityStatus?: string;
  fallbackApplied?: boolean | string | null;
  fallbackReason?: string | null;
  isStale: false;
}

export interface BeatTelemetrySceneFallback {
  status: "scene_fallback";
  sceneIndex: number;
  beatId: string;
  beatOrder: number;
  fallbackReason: string;
  beatFallbackReason?: string;
  animation?: RenderAnimationItem;
  sceneAnimation?: RenderAnimationItem;
  isStale: false;
}

export interface BeatTelemetryUnavailable {
  status: "unavailable";
  sceneIndex: number;
  beatId: string;
  beatOrder: number;
  reason?: string;
  isStale: false;
}

export interface BeatTelemetryStale {
  status: "stale";
  sceneIndex: number;
  beatId: string;
  beatOrder: number;
  previousStatus: "rendered" | "scene_fallback" | "unavailable";
  previousAnimation?: RenderAnimationItem;
  isStale: true;
}

export type BeatTelemetryInfo =
  | BeatTelemetryRendered
  | BeatTelemetrySceneFallback
  | BeatTelemetryUnavailable
  | BeatTelemetryStale;

export interface RenderMeta {
  task?: string;
  scenes_count?: number;
  resolution?: string;
  fps?: number;
  latency_seconds?: number;
  file_size_bytes?: number;
  [key: string]: unknown;
}

export interface RenderStepOutput {
  render?: RenderData;
  video_path?: string;
  duration_seconds?: number;
  meta?: RenderMeta;
  warnings?: string[];
  [key: string]: unknown;
}


/**
 * Safely extracts the channel's custom visual_style string from its settings object.
 * Returns null if settings is missing, not an object, or visual_style is empty/whitespace.
 */
export function getChannelVisualStyle(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  const val = (settings as Record<string, unknown>).visual_style;
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

export interface ApiValidationError {
  loc: (string | number)[];
  msg: string;
  type?: string;
}

export interface ApiErrorResponse {
  detail?: string | ApiValidationError[];
}

// ============================================================================
// Creative Direction & Video Director Types (Phase 1)
// ============================================================================

export interface EmotionalBeat {
  phase: "hook" | "setup" | "complication" | "reveal" | "resolution";
  target_emotion: string;
  visual_intent: string;
}

export interface ProtagonistConfig {
  character_count: "none" | "single" | "ensemble";
  archetype_summary?: string | null;
}

export interface CreativeDirectionOutput {
  format_archetype: string;
  storytelling_angle: string;
  central_thesis: string;
  tone: string;
  visual_genre: "photorealistic_cinematic" | "styled_3d" | "stickman_illustrated" | "technical_schematic" | "mixed_format";
  protagonist_config: ProtagonistConfig;
  emotional_progression?: EmotionalBeat[];
  creative_constraints?: string[];
}

export interface CharacterEntity {
  id: string;
  name: string;
  role: string;
  visual_anchor: string;
  apparel_anchor: string;
  forbidden_mutations?: string[];
}

export interface EnvironmentEntity {
  id: string;
  name: string;
  spatial_layout: string;
  lighting_setup: string;
  persistent_props?: string[];
  time_of_day?: string;
}

export interface ObjectEntity {
  id: string;
  name: string;
  visual_description: string;
  material_and_finish: string;
}

export interface ConceptEntity {
  id: string;
  name: string;
  concept_explained: string;
  visual_analogy: string;
  graphical_elements?: string[];
}

export interface EntityCatalog {
  characters?: CharacterEntity[];
  environments?: EnvironmentEntity[];
  objects?: ObjectEntity[];
  concepts?: ConceptEntity[];
}

export interface ArtDirection {
  style_family: string;
  rendering_engine_flavor?: string;
  primary_palette_hex?: string[];
  negative_prompt_tokens?: string;
}

export interface CinematographyProfile {
  aspect_ratio: string;
  subject_safe_zone: string;
  caption_safe_zone: string;
}

export interface FoleySound {
  id: string;
  cue_name: string;
  asset_file: string;
}

export interface AudioDirection {
  voice_identifier: string;
  default_speech_speed: number;
  ambient_bed_track?: string | null;
  music_bed_track?: string | null;
  music_duck_db?: number;
  foley_palette?: FoleySound[];
}

export interface SubtitleProfile {
  font_family: string;
  font_size_pt: number;
  primary_color_hex: string;
  highlight_color_hex: string;
  margin_vertical_px: number;
}

export interface VideoBibleOutput {
  bible_id: string;
  topic_summary: string;
  entities?: EntityCatalog;
  art_direction?: ArtDirection;
  cinematography?: CinematographyProfile;
  audio_direction?: AudioDirection;
  subtitle_direction?: SubtitleProfile;
}

export interface EntityBindings {
  character_id?: string | null;
  environment_id: string;
  object_ids?: string[];
  concept_id?: string | null;
}

export interface CameraDirection {
  shot_type: "extreme_close_up" | "close_up" | "medium_close_up" | "medium" | "wide" | "extreme_wide";
  camera_angle: "eye_level" | "low_angle" | "high_angle" | "top_down" | "side_profile" | "dutch_angle";
  focal_point_description?: string;
  movement_type?: "static" | "push_in" | "pull_out" | "pan_left" | "pan_right" | "drift";
}

export interface CharacterState {
  pose_description: string;
  expression_description: string;
  action_in_progress: string;
}

export interface FoleyCue {
  foley_id: string;
  offset_seconds?: number;
  relative_volume?: number;
}

export interface StoryboardBeat {
  beat_id: string;
  scene_index: number;
  order: number;
  narration_slice: string;
  duration_est_seconds: number;
  entity_bindings: EntityBindings;
  transition_from_previous?: "establishing" | "same_scene_reframe" | "action_reaction" | "spatial_cutaway" | "location_change" | "explanatory_cutaway" | "surreal_metaphor" | "resolution_return";
  continuity_intent?: string;
  camera: CameraDirection;
  character_state?: CharacterState | null;
  environment_state_override?: string | null;
  foley_cues?: FoleyCue[];
}

