import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRenderStaleness,
  parseStepTimestamp,
} from "../src/lib/storyboard.ts";
import type { StepOut } from "../src/lib/types.ts";

function createMockStep(
  name: string,
  status: string,
  finishedAt: string | null = null,
  position: number = 0
): StepOut {
  return {
    name,
    position,
    status,
    finished_at: finishedAt,
    started_at: finishedAt ? "2026-11-02T10:00:00Z" : null,
    output: null,
    user_prompt: null,
    error: null,
  };
}

// ============================================================================
// 1. Timestamp Parsing Tests
// ============================================================================

test("parseStepTimestamp: valid ISO 8601 strings and numbers parse into milliseconds", () => {
  const ts1 = "2026-11-02T12:00:00.000Z";
  const expected1 = new Date(ts1).getTime();
  assert.equal(parseStepTimestamp(ts1), expected1);

  const ts2 = "2026-11-02T12:00:00+05:30";
  const expected2 = new Date(ts2).getTime();
  assert.equal(parseStepTimestamp(ts2), expected2);

  // Numeric epoch
  assert.equal(parseStepTimestamp(expected1), expected1);
});

test("parseStepTimestamp: invalid or missing timestamps safely return null without throwing", () => {
  assert.equal(parseStepTimestamp(null), null);
  assert.equal(parseStepTimestamp(undefined), null);
  assert.equal(parseStepTimestamp(""), null);
  assert.equal(parseStepTimestamp("   "), null);
  assert.equal(parseStepTimestamp("invalid-date"), null);
  assert.equal(parseStepTimestamp("not-a-timestamp-2026"), null);
  assert.equal(parseStepTimestamp({}), null);
  assert.equal(parseStepTimestamp([]), null);
  assert.equal(parseStepTimestamp(true), null);
});

// ============================================================================
// 2. Stage 3.5.7 Required Test Matrix Cases
// ============================================================================

test("1. Backend explicitly reports render as stale -> Stale", () => {
  const renderStep = createMockStep("render", "stale", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", "2026-11-02T11:00:00Z", 1);
  const imagesStep = createMockStep("images", "done", "2026-11-02T11:15:00Z", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, true);
});

test("2. Storyboard finished after render -> Stale", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", "2026-11-02T12:05:00Z", 1); // 5 min later
  const imagesStep = createMockStep("images", "done", "2026-11-02T11:15:00Z", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, true);
});

test("3. Images finished after render -> Stale (Hardened Audit Finding H-1)", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", "2026-11-02T11:00:00Z", 1);
  const imagesStep = createMockStep("images", "done", "2026-11-02T12:02:30Z", 2); // 2.5 min later
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, true);
});

test("4. Voiceover finished after render -> Stale", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", "2026-11-02T11:00:00Z", 1);
  const imagesStep = createMockStep("images", "done", "2026-11-02T11:15:00Z", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T12:01:00Z", 3); // 1 min later

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, true);
});

test("5. All upstream timestamps are earlier than render -> Not stale", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", "2026-11-02T11:00:00Z", 1);
  const imagesStep = createMockStep("images", "done", "2026-11-02T11:15:00Z", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, false);
});

test("6. Upstream and render timestamps are equal -> Not stale based on timestamp comparison", () => {
  const exactTime = "2026-11-02T12:00:00Z";
  const renderStep = createMockStep("render", "done", exactTime, 4);
  const storyboardStep = createMockStep("storyboard", "done", exactTime, 1);
  const imagesStep = createMockStep("images", "done", exactTime, 2);
  const voiceoverStep = createMockStep("voiceover", "done", exactTime, 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, false);
});

test("7. Subtitle finished after render -> Not stale based on subtitle timestamp", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", "2026-11-02T11:00:00Z", 1);
  const imagesStep = createMockStep("images", "done", "2026-11-02T11:15:00Z", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3);
  const subtitlesStep = createMockStep("subtitles", "done", "2026-11-02T12:10:00Z", 5); // downstream!

  const allSteps = [storyboardStep, imagesStep, voiceoverStep, renderStep, subtitlesStep];

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
    allSteps,
  });

  assert.equal(result, false);
});

test("8. Subtitle-only rerun with render still done -> Not stale", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const subtitlesStep = createMockStep("subtitles", "pending", null, 5); // rerun reset to pending

  const allSteps = [
    createMockStep("storyboard", "done", "2026-11-02T11:00:00Z", 1),
    createMockStep("images", "done", "2026-11-02T11:15:00Z", 2),
    createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3),
    renderStep,
    subtitlesStep,
  ];

  const result = evaluateRenderStaleness({
    allSteps,
    renderStep,
  });

  assert.equal(result, false);
});

test("9. Missing upstream timestamp -> No crash; document freshness limitation", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", null, 1); // missing
  const imagesStep = createMockStep("images", "done", "2026-11-02T11:15:00Z", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  // Missing storyboard timestamp cannot prove staleness; others are earlier -> not stale
  assert.equal(result, false);
});

test("10. Invalid timestamp -> No crash; do not infer staleness from invalid data", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", "invalid-corrupted-iso-string", 1);
  const imagesStep = createMockStep("images", "done", "undefined", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, false);
});

test("11. Missing render timestamp -> No crash; do not claim freshness based on unavailable comparison", () => {
  const renderStep = createMockStep("render", "done", null, 4); // finished_at is null
  const storyboardStep = createMockStep("storyboard", "done", "2026-11-02T12:05:00Z", 1);
  const imagesStep = createMockStep("images", "done", "2026-11-02T12:10:00Z", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T12:15:00Z", 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  // Without a render timestamp, timestamp comparison cannot establish staleness
  assert.equal(result, false);
});

test("12. Explicit backend stale status with missing timestamps -> Stale", () => {
  const renderStep = createMockStep("render", "stale", null, 4); // missing finished_at, but status='stale'
  const storyboardStep = createMockStep("storyboard", "done", null, 1);
  const imagesStep = createMockStep("images", "done", null, 2);
  const voiceoverStep = createMockStep("voiceover", "done", null, 3);

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, true);
});

test("13. Combination: one upstream timestamp is missing, but another valid upstream timestamp proves staleness -> Stale", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", null, 1); // missing
  const imagesStep = createMockStep("images", "done", "2026-11-02T12:05:00Z", 2); // strictly later!
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T11:30:00Z", 3); // earlier

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, true);
});

test("14. Combination: storyboard missing, images invalid date, voiceover finished after render -> Stale", () => {
  const renderStep = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const storyboardStep = createMockStep("storyboard", "done", null, 1);
  const imagesStep = createMockStep("images", "done", "corrupted-date-value", 2);
  const voiceoverStep = createMockStep("voiceover", "done", "2026-11-02T12:03:00Z", 3); // later

  const result = evaluateRenderStaleness({
    renderStep,
    storyboardStep,
    imagesStep,
    voiceoverStep,
  });

  assert.equal(result, true);
});

test("15. Automatic step discovery from allSteps array", () => {
  const allSteps: StepOut[] = [
    createMockStep("script", "done", "2026-11-02T10:00:00Z", 0),
    createMockStep("storyboard", "done", "2026-11-02T10:30:00Z", 1),
    createMockStep("images", "done", "2026-11-02T12:30:00Z", 2), // later than render
    createMockStep("voiceover", "done", "2026-11-02T11:00:00Z", 3),
    createMockStep("render", "done", "2026-11-02T12:00:00Z", 4),
    createMockStep("subtitles", "done", "2026-11-02T13:00:00Z", 5),
  ];

  const result = evaluateRenderStaleness({ allSteps });
  assert.equal(result, true);
});

test("16. Panel-level isRender and isStale flags mark render stale even when renderStep is omitted", () => {
  const result = evaluateRenderStaleness({
    isRender: true,
    isStale: true,
  });
  assert.equal(result, true);
});

// ============================================================================
// 3. Stage 3.5.7.2 Render Readiness Label Logic Tests
// ============================================================================

import fs from "node:fs";
import path from "node:path";

function computeRenderReadinessBadge({
  stepStatus,
  hasVideoPath,
  isRunning = false,
  isStale = false,
  renderFinishedAt,
}: {
  stepStatus?: string | null;
  hasVideoPath: boolean;
  isRunning?: boolean;
  isStale?: boolean;
  renderFinishedAt?: unknown;
}): {
  isReady: boolean;
  badgeLabel: "Ready" | "Ready (Unverified)" | "Rendering in progress..." | "Pending Render";
  isTimestampVerified: boolean;
  fullBadgeText: string;
} {
  const isReady =
    (stepStatus === "done" ||
      stepStatus === "awaiting_approval" ||
      (!stepStatus && hasVideoPath)) &&
    !isRunning &&
    !isStale &&
    hasVideoPath;

  if (isRunning) {
    return {
      isReady: false,
      badgeLabel: "Rendering in progress...",
      isTimestampVerified: false,
      fullBadgeText: "Rendering in progress...",
    };
  }

  if (!isReady) {
    return {
      isReady: false,
      badgeLabel: "Pending Render",
      isTimestampVerified: false,
      fullBadgeText: "Pending Render",
    };
  }

  const isTimestampVerified = parseStepTimestamp(renderFinishedAt) !== null;
  const badgeLabel = isTimestampVerified ? "Ready" : "Ready (Unverified)";
  return {
    isReady: true,
    badgeLabel,
    isTimestampVerified,
    fullBadgeText: `✓ 1080x1920 ${badgeLabel}`,
  };
}

test("17. Valid render timestamp displays 'Ready'", () => {
  // ISO 8601 UTC
  const res1 = computeRenderReadinessBadge({
    stepStatus: "done",
    hasVideoPath: true,
    renderFinishedAt: "2026-11-02T12:00:00Z",
  });
  assert.equal(res1.isReady, true);
  assert.equal(res1.isTimestampVerified, true);
  assert.equal(res1.badgeLabel, "Ready");
  assert.equal(res1.fullBadgeText, "✓ 1080x1920 Ready");

  // ISO 8601 with offset
  const res2 = computeRenderReadinessBadge({
    stepStatus: "done",
    hasVideoPath: true,
    renderFinishedAt: "2026-11-02T12:00:00+05:30",
  });
  assert.equal(res2.isReady, true);
  assert.equal(res2.isTimestampVerified, true);
  assert.equal(res2.badgeLabel, "Ready");
  assert.equal(res2.fullBadgeText, "✓ 1080x1920 Ready");

  // Numeric epoch
  const res3 = computeRenderReadinessBadge({
    stepStatus: "awaiting_approval",
    hasVideoPath: true,
    renderFinishedAt: 1762084800000,
  });
  assert.equal(res3.isReady, true);
  assert.equal(res3.isTimestampVerified, true);
  assert.equal(res3.badgeLabel, "Ready");
});

test("18. Missing render timestamp displays 'Ready (Unverified)'", () => {
  // null timestamp
  const resNull = computeRenderReadinessBadge({
    stepStatus: "done",
    hasVideoPath: true,
    renderFinishedAt: null,
  });
  assert.equal(resNull.isReady, true);
  assert.equal(resNull.isTimestampVerified, false);
  assert.equal(resNull.badgeLabel, "Ready (Unverified)");
  assert.equal(resNull.fullBadgeText, "✓ 1080x1920 Ready (Unverified)");

  // undefined timestamp
  const resUndef = computeRenderReadinessBadge({
    stepStatus: "done",
    hasVideoPath: true,
    renderFinishedAt: undefined,
  });
  assert.equal(resUndef.isReady, true);
  assert.equal(resUndef.isTimestampVerified, false);
  assert.equal(resUndef.badgeLabel, "Ready (Unverified)");

  // empty or whitespace string
  const resEmpty = computeRenderReadinessBadge({
    stepStatus: "done",
    hasVideoPath: true,
    renderFinishedAt: "   ",
  });
  assert.equal(resEmpty.isReady, true);
  assert.equal(resEmpty.isTimestampVerified, false);
  assert.equal(resEmpty.badgeLabel, "Ready (Unverified)");
});

test("19. Invalid render timestamp displays 'Ready (Unverified)'", () => {
  const invalidTimestamps = [
    "invalid-timestamp",
    "not-a-timestamp-2026",
    "abc-def",
    {},
    [],
    true,
  ];

  for (const invalid of invalidTimestamps) {
    const res = computeRenderReadinessBadge({
      stepStatus: "done",
      hasVideoPath: true,
      renderFinishedAt: invalid,
    });
    assert.equal(res.isReady, true);
    assert.equal(res.isTimestampVerified, false, `Expected ${invalid} to be unverified`);
    assert.equal(res.badgeLabel, "Ready (Unverified)");
    assert.equal(res.fullBadgeText, "✓ 1080x1920 Ready (Unverified)");
  }
});

test("20. Stale render displays the existing outdated state, never either Ready label", () => {
  // Explicit stale status from backend
  const renderStep = createMockStep("render", "stale", "2026-11-02T12:00:00Z", 4);
  const isStaleFromBackend = evaluateRenderStaleness({ renderStep });
  assert.equal(isStaleFromBackend, true);

  const resStaleBackend = computeRenderReadinessBadge({
    stepStatus: "stale",
    hasVideoPath: true,
    isStale: isStaleFromBackend,
    renderFinishedAt: "2026-11-02T12:00:00Z",
  });
  assert.equal(resStaleBackend.isReady, false);
  assert.equal(resStaleBackend.badgeLabel, "Pending Render");
  assert.notEqual(resStaleBackend.badgeLabel, "Ready");
  assert.notEqual(resStaleBackend.badgeLabel, "Ready (Unverified)");

  // Stale due to newer upstream image step
  const freshRender = createMockStep("render", "done", "2026-11-02T12:00:00Z", 4);
  const newerImages = createMockStep("images", "done", "2026-11-02T12:05:00Z", 2);
  const isStaleFromImages = evaluateRenderStaleness({
    renderStep: freshRender,
    imagesStep: newerImages,
  });
  assert.equal(isStaleFromImages, true);

  const resStaleImages = computeRenderReadinessBadge({
    stepStatus: "done",
    hasVideoPath: true,
    isStale: isStaleFromImages,
    renderFinishedAt: "2026-11-02T12:00:00Z",
  });
  assert.equal(resStaleImages.isReady, false);
  assert.equal(resStaleImages.badgeLabel, "Pending Render");
  assert.notEqual(resStaleImages.badgeLabel, "Ready");
  assert.notEqual(resStaleImages.badgeLabel, "Ready (Unverified)");
});

test("21. Incomplete render remains Pending or Rendering", () => {
  // Pending status, no video path
  const resPending = computeRenderReadinessBadge({
    stepStatus: "pending",
    hasVideoPath: false,
    renderFinishedAt: null,
  });
  assert.equal(resPending.isReady, false);
  assert.equal(resPending.badgeLabel, "Pending Render");

  // Done status, but video path missing
  const resNoVideo = computeRenderReadinessBadge({
    stepStatus: "done",
    hasVideoPath: false,
    renderFinishedAt: "2026-11-02T12:00:00Z",
  });
  assert.equal(resNoVideo.isReady, false);
  assert.equal(resNoVideo.badgeLabel, "Pending Render");

  // Running status
  const resRunning = computeRenderReadinessBadge({
    stepStatus: "running",
    hasVideoPath: true,
    isRunning: true,
    renderFinishedAt: null,
  });
  assert.equal(resRunning.isReady, false);
  assert.equal(resRunning.badgeLabel, "Rendering in progress...");
});

test("22. RenderOutputView component source integrity verification", () => {
  const componentPath = path.resolve("src/components/RenderOutputView.tsx");
  const source = fs.readFileSync(componentPath, "utf-8");

  // 1. Imports parseStepTimestamp from @/lib/storyboard
  assert.match(source, /import\s*\{[^}]*parseStepTimestamp[^}]*\}\s*from\s*["']@\/lib\/storyboard["']/);

  // 2. Defines renderStep and finishedAt in RenderOutputViewProps
  assert.match(source, /renderStep\?:/);
  assert.match(source, /finishedAt\?:/);

  // 3. Evaluates parseStepTimestamp on render finished_at
  assert.match(source, /parseStepTimestamp\(/);

  // 4. Renders the conditional "Ready" vs "Ready (Unverified)" badge text
  assert.match(source, /Ready \(Unverified\)/);
  assert.match(source, /isTimestampVerified\s*\?\s*["']Ready["']\s*:\s*["']Ready \(Unverified\)["']/);
});


