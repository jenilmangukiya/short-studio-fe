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

export type StepOut = components["schemas"]["StepOut"];
export type StepStatus = "pending" | "running" | "done" | "failed" | "stale";
export type VideoStatus = "draft" | "in_progress" | "completed" | "failed";

export const PIPELINE_STEP_NAMES = [
  "script",
  "storyboard",
  "images",
  "voiceover",
  "render",
  "subtitles",
] as const;

export type PipelineStepName = (typeof PIPELINE_STEP_NAMES)[number];

export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface SubtitleSegment {
  index: number;
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
}

export interface SubtitleData {
  segments: SubtitleSegment[];
  format?: string;
  total_words?: number;
  total_duration_seconds?: number;
  file?: string;
  vtt_file?: string;
  srt_file?: string;
  ass_file?: string;
  captioned_file?: string;
  captioned_video_path?: string;
}

export interface SubtitleMeta {
  task?: string;
  provider?: string;
  model?: string;
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

export interface StoryboardScene {
  index: number;
  narration: string;
  image_prompt: string;
  shot_type: string;
  est_seconds: number;
}

export type StoryboardStyleSource = "channel" | "default";

export interface StoryboardData {
  visual_style: string;
  style_source: StoryboardStyleSource | string;
  scenes: StoryboardScene[];
  total_seconds: number;
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
  narration: string;
  file?: string | null;
  duration_seconds: number;
  latency_seconds?: number;
  status: "ok" | "failed" | string;
  reused: boolean;
  audio_hash?: string;
  [key: string]: unknown;
}

export interface VoiceoverData {
  items: VoiceoverItem[];
  complete: boolean;
  total_duration_seconds: number;
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
  mock?: boolean;
  [key: string]: unknown;
}

export interface VoiceoverStepOutput {
  voiceover?: VoiceoverData;
  duration_seconds?: number;
  warnings?: string[];
  meta?: VoiceoverMeta;
  mock?: boolean;
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
  [key: string]: unknown;
}

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
