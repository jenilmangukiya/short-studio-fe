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
] as const;

export type PipelineStepName = (typeof PIPELINE_STEP_NAMES)[number];

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
  revision?: string | number | null;
}

export interface ScriptStepOutput {
  script?: ScriptContent;
  warnings?: string[];
  meta?: ScriptMeta;
  [key: string]: unknown;
}

export interface ApiValidationError {
  loc: (string | number)[];
  msg: string;
  type?: string;
}

export interface ApiErrorResponse {
  detail?: string | ApiValidationError[];
}
