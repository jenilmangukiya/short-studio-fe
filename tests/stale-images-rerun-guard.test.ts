import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { StepOut, StepStatus } from "../src/lib/types.ts";
import { imageInvalidationRegistry } from "../src/lib/visual-style-ui.ts";

// ============================================================================
// Logic Helper mirroring StepDetailPanel & SubtitlesOutputView guards
// ============================================================================

function evaluateStepRerunGuard({
  stepName,
  allSteps,
  videoId,
  isAnyRunning = false,
  isPending = false,
}: {
  stepName: string;
  allSteps: StepOut[];
  videoId: string;
  isAnyRunning?: boolean;
  isPending?: boolean;
}) {
  const normName = stepName.toLowerCase();
  const isRender = normName === "render";
  const isSubtitles = normName === "subtitles" || normName === "subtitle";
  const isDownstreamVisualStep = isRender || isSubtitles;

  const imagesStep = allSteps.find((s) => s.name.toLowerCase() === "images");
  const isRegistryStale = imageInvalidationRegistry.isStale(videoId);

  const isImagesReady = Boolean(
    imagesStep &&
    imagesStep.status === "done" &&
    !isRegistryStale
  );

  const isBlockedByImages = isDownstreamVisualStep && !isImagesReady;
  const isRerunDisabled = isAnyRunning || isPending || isBlockedByImages;

  return {
    isImagesReady,
    isBlockedByImages,
    isRerunDisabled,
    blockedReason: isBlockedByImages
      ? imagesStep?.status === "stale" || isRegistryStale
        ? `Scene images for this video are outdated or invalidated. You must regenerate the Images step before rerunning ${stepName}.`
        : imagesStep?.status === "running"
        ? `Scene images are currently generating. Please wait for the Images step to finish before rerunning ${stepName}.`
        : imagesStep?.status === "failed"
        ? `Scene image generation failed. Please fix or rerun the Images step before rerunning ${stepName}.`
        : `Scene images have not been generated yet. Please complete the Images step before rerunning ${stepName}.`
      : null,
  };
}

function evaluateApplySubtitlesGuard({
  previewStyleId,
  appliedStyleId,
  isApplying = false,
  isRunning = false,
  isImagesReady = true,
}: {
  previewStyleId: string;
  appliedStyleId: string;
  isApplying?: boolean;
  isRunning?: boolean;
  isImagesReady?: boolean;
}) {
  const isRerunInProgress = isApplying || isRunning;
  const previewDiffersFromApplied = previewStyleId !== appliedStyleId;
  const isApplyDisabled = isRerunInProgress || !previewDiffersFromApplied || isImagesReady === false;

  return {
    isApplyDisabled,
    canExecute: !isApplyDisabled,
  };
}

function evaluateRollbackGuard({
  stepName,
  isImagesReady = true,
}: {
  stepName: string;
  isImagesReady?: boolean;
}) {
  const normName = stepName.toLowerCase();
  const isDownstreamVisualStep = normName === "render" || normName === "subtitles" || normName === "subtitle";
  const isRollbackBlocked = isDownstreamVisualStep && isImagesReady === false;

  return {
    isRollbackBlocked,
  };
}

function createMockStep(name: string, position: number, status: string): StepOut {
  return {
    name,
    position,
    status,
    output: {},
    user_prompt: null,
    error: null,
    started_at: null,
    finished_at: null,
  };
}

function buildMockPipelineSteps(imageStatus: StepStatus | string | null): StepOut[] {
  const steps: StepOut[] = [
    createMockStep("script", 0, "done"),
    createMockStep("storyboard", 1, "done"),
    createMockStep("voiceover", 3, "done"),
    createMockStep("render", 4, "done"),
    createMockStep("subtitles", 5, "done"),
  ];

  if (imageStatus !== null) {
    steps.splice(2, 0, createMockStep("images", 2, imageStatus));
  }

  return steps;
}

// ============================================================================
// Tests
// ============================================================================

test("1. Render and Subtitles reruns are BLOCKED when Images step is 'stale'", () => {
  const videoId = "vid-stale-test-1";
  imageInvalidationRegistry.reset();

  const steps = buildMockPipelineSteps("stale");

  // Render step
  const renderGuard = evaluateStepRerunGuard({ stepName: "render", allSteps: steps, videoId });
  assert.equal(renderGuard.isImagesReady, false);
  assert.equal(renderGuard.isBlockedByImages, true);
  assert.equal(renderGuard.isRerunDisabled, true);
  assert.match(renderGuard.blockedReason || "", /outdated or invalidated/);

  // Subtitles step
  const subtitlesGuard = evaluateStepRerunGuard({ stepName: "subtitles", allSteps: steps, videoId });
  assert.equal(subtitlesGuard.isImagesReady, false);
  assert.equal(subtitlesGuard.isBlockedByImages, true);
  assert.equal(subtitlesGuard.isRerunDisabled, true);
});

test("2. Render and Subtitles reruns are BLOCKED when Images step is 'pending'", () => {
  const videoId = "vid-pending-test-2";
  imageInvalidationRegistry.reset();

  const steps = buildMockPipelineSteps("pending");

  const renderGuard = evaluateStepRerunGuard({ stepName: "render", allSteps: steps, videoId });
  assert.equal(renderGuard.isImagesReady, false);
  assert.equal(renderGuard.isBlockedByImages, true);
  assert.equal(renderGuard.isRerunDisabled, true);
  assert.match(renderGuard.blockedReason || "", /have not been generated yet/);

  const subGuard = evaluateStepRerunGuard({ stepName: "subtitles", allSteps: steps, videoId });
  assert.equal(subGuard.isBlockedByImages, true);
  assert.equal(subGuard.isRerunDisabled, true);
});

test("3. Render and Subtitles reruns are BLOCKED when Images step is 'running'", () => {
  const videoId = "vid-running-test-3";
  imageInvalidationRegistry.reset();

  const steps = buildMockPipelineSteps("running");

  const renderGuard = evaluateStepRerunGuard({ stepName: "render", allSteps: steps, videoId });
  assert.equal(renderGuard.isImagesReady, false);
  assert.equal(renderGuard.isBlockedByImages, true);
  assert.equal(renderGuard.isRerunDisabled, true);
  assert.match(renderGuard.blockedReason || "", /currently generating/);

  const subGuard = evaluateStepRerunGuard({ stepName: "subtitles", allSteps: steps, videoId });
  assert.equal(subGuard.isBlockedByImages, true);
  assert.equal(subGuard.isRerunDisabled, true);
});

test("4. Render and Subtitles reruns are BLOCKED when Images step is 'failed'", () => {
  const videoId = "vid-failed-test-4";
  imageInvalidationRegistry.reset();

  const steps = buildMockPipelineSteps("failed");

  const renderGuard = evaluateStepRerunGuard({ stepName: "render", allSteps: steps, videoId });
  assert.equal(renderGuard.isImagesReady, false);
  assert.equal(renderGuard.isBlockedByImages, true);
  assert.equal(renderGuard.isRerunDisabled, true);
  assert.match(renderGuard.blockedReason || "", /generation failed/);

  const subGuard = evaluateStepRerunGuard({ stepName: "subtitles", allSteps: steps, videoId });
  assert.equal(subGuard.isBlockedByImages, true);
  assert.equal(subGuard.isRerunDisabled, true);
});

test("5. Render and Subtitles reruns are BLOCKED when Images step is completely missing", () => {
  const videoId = "vid-missing-test-5";
  imageInvalidationRegistry.reset();

  // Missing images step entirely (null)
  const steps = buildMockPipelineSteps(null);

  const renderGuard = evaluateStepRerunGuard({ stepName: "render", allSteps: steps, videoId });
  assert.equal(renderGuard.isImagesReady, false);
  assert.equal(renderGuard.isBlockedByImages, true);
  assert.equal(renderGuard.isRerunDisabled, true);
  assert.match(renderGuard.blockedReason || "", /have not been generated yet/);

  const subGuard = evaluateStepRerunGuard({ stepName: "subtitles", allSteps: steps, videoId });
  assert.equal(subGuard.isBlockedByImages, true);
  assert.equal(subGuard.isRerunDisabled, true);
});

test("6. In-memory registry invalidation IMMEDIATELY blocks Render and Subtitles even if backend status is 'done'", () => {
  const videoId = "vid-registry-test-6";
  imageInvalidationRegistry.reset();

  // Backend still reports "done" before query refresh
  const steps = buildMockPipelineSteps("done");

  // Invalidate in memory (simulating visual style change)
  imageInvalidationRegistry.invalidateVideoImages(videoId);

  const renderGuard = evaluateStepRerunGuard({ stepName: "render", allSteps: steps, videoId });
  assert.equal(renderGuard.isImagesReady, false);
  assert.equal(renderGuard.isBlockedByImages, true);
  assert.equal(renderGuard.isRerunDisabled, true);
  assert.match(renderGuard.blockedReason || "", /outdated or invalidated/);

  const subGuard = evaluateStepRerunGuard({ stepName: "subtitles", allSteps: steps, videoId });
  assert.equal(subGuard.isBlockedByImages, true);
  assert.equal(subGuard.isRerunDisabled, true);
});

test("7. Upstream steps (Script, Storyboard, Voiceover, and Images itself) REMAIN UNBLOCKED", () => {
  const videoId = "vid-upstream-test-7";
  imageInvalidationRegistry.reset();

  const steps = buildMockPipelineSteps("stale");
  imageInvalidationRegistry.invalidateVideoImages(videoId);

  // Images regeneration itself must NOT be blocked
  const imagesGuard = evaluateStepRerunGuard({ stepName: "images", allSteps: steps, videoId });
  assert.equal(imagesGuard.isBlockedByImages, false);
  assert.equal(imagesGuard.isRerunDisabled, false);

  // Script rerun unblocked
  const scriptGuard = evaluateStepRerunGuard({ stepName: "script", allSteps: steps, videoId });
  assert.equal(scriptGuard.isBlockedByImages, false);
  assert.equal(scriptGuard.isRerunDisabled, false);

  // Storyboard rerun unblocked
  const storyboardGuard = evaluateStepRerunGuard({ stepName: "storyboard", allSteps: steps, videoId });
  assert.equal(storyboardGuard.isBlockedByImages, false);
  assert.equal(storyboardGuard.isRerunDisabled, false);

  // Voiceover rerun unblocked
  const voiceoverGuard = evaluateStepRerunGuard({ stepName: "voiceover", allSteps: steps, videoId });
  assert.equal(voiceoverGuard.isBlockedByImages, false);
  assert.equal(voiceoverGuard.isRerunDisabled, false);
});

test("8. Render and Subtitles reruns are RE-ENABLED once Images regeneration completes ('done' and not invalidated)", () => {
  const videoId = "vid-completed-test-8";
  imageInvalidationRegistry.reset();

  const steps = buildMockPipelineSteps("done");

  const renderGuard = evaluateStepRerunGuard({ stepName: "render", allSteps: steps, videoId });
  assert.equal(renderGuard.isImagesReady, true);
  assert.equal(renderGuard.isBlockedByImages, false);
  assert.equal(renderGuard.isRerunDisabled, false);
  assert.equal(renderGuard.blockedReason, null);

  const subGuard = evaluateStepRerunGuard({ stepName: "subtitles", allSteps: steps, videoId });
  assert.equal(subGuard.isImagesReady, true);
  assert.equal(subGuard.isBlockedByImages, false);
  assert.equal(subGuard.isRerunDisabled, false);
});

test("9. SubtitlesOutputView Apply Style is DISABLED when images are not ready", () => {
  // Preview differs, but images not ready -> disabled
  const guardNotReady = evaluateApplySubtitlesGuard({
    previewStyleId: "remotion_neon",
    appliedStyleId: "clean_cinematic",
    isImagesReady: false,
  });
  assert.equal(guardNotReady.isApplyDisabled, true);
  assert.equal(guardNotReady.canExecute, false);

  // Preview differs, images ready -> enabled
  const guardReady = evaluateApplySubtitlesGuard({
    previewStyleId: "remotion_neon",
    appliedStyleId: "clean_cinematic",
    isImagesReady: true,
  });
  assert.equal(guardReady.isApplyDisabled, false);
  assert.equal(guardReady.canExecute, true);

  // Preview matches applied -> disabled even if images ready
  const guardMatches = evaluateApplySubtitlesGuard({
    previewStyleId: "clean_cinematic",
    appliedStyleId: "clean_cinematic",
    isImagesReady: true,
  });
  assert.equal(guardMatches.isApplyDisabled, true);
});

test("10. StepHistoryModal Rollback is BLOCKED for Render/Subtitles when images are not ready, unblocked for others", () => {
  // Render rollback blocked when images not ready
  const renderRollback = evaluateRollbackGuard({ stepName: "render", isImagesReady: false });
  assert.equal(renderRollback.isRollbackBlocked, true);

  // Subtitles rollback blocked when images not ready
  const subRollback = evaluateRollbackGuard({ stepName: "subtitles", isImagesReady: false });
  assert.equal(subRollback.isRollbackBlocked, true);

  // Render rollback allowed when images are ready
  const renderReadyRollback = evaluateRollbackGuard({ stepName: "render", isImagesReady: true });
  assert.equal(renderReadyRollback.isRollbackBlocked, false);

  // Script rollback unaffected even when images are not ready
  const scriptRollback = evaluateRollbackGuard({ stepName: "script", isImagesReady: false });
  assert.equal(scriptRollback.isRollbackBlocked, false);

  // Storyboard rollback unaffected even when images are not ready
  const storyboardRollback = evaluateRollbackGuard({ stepName: "storyboard", isImagesReady: false });
  assert.equal(storyboardRollback.isRollbackBlocked, false);
});

test("11. Simulated browser refresh preserves blocked state from backend 'stale' status", () => {
  const videoId = "vid-refresh-test-11";

  // Simulate fresh browser session: reset registry completely
  imageInvalidationRegistry.reset();
  assert.equal(imageInvalidationRegistry.isStale(videoId), false);

  // Backend authoritative data loaded on refresh has status: "stale"
  const refreshedSteps = buildMockPipelineSteps("stale");

  const renderGuard = evaluateStepRerunGuard({ stepName: "render", allSteps: refreshedSteps, videoId });
  assert.equal(renderGuard.isImagesReady, false);
  assert.equal(renderGuard.isBlockedByImages, true);
  assert.equal(renderGuard.isRerunDisabled, true);
});

test("12. Source code integrity: StepDetailPanel, SubtitlesOutputView, StepHistoryModal enforce guards", () => {
  const panelPath = path.resolve(process.cwd(), "src/components/StepDetailPanel.tsx");
  const subPath = path.resolve(process.cwd(), "src/components/SubtitlesOutputView.tsx");
  const histPath = path.resolve(process.cwd(), "src/components/StepHistoryModal.tsx");

  assert.ok(fs.existsSync(panelPath), "StepDetailPanel.tsx must exist");
  assert.ok(fs.existsSync(subPath), "SubtitlesOutputView.tsx must exist");
  assert.ok(fs.existsSync(histPath), "StepHistoryModal.tsx must exist");

  const panelContent = fs.readFileSync(panelPath, "utf-8");
  const subContent = fs.readFileSync(subPath, "utf-8");
  const histContent = fs.readFileSync(histPath, "utf-8");

  // StepDetailPanel subscribes to imageInvalidationRegistry
  assert.match(panelContent, /useSyncExternalStore/, "Must use useSyncExternalStore");
  assert.match(panelContent, /imageInvalidationRegistry\.subscribe/, "Must subscribe to imageInvalidationRegistry");

  // StepDetailPanel derives isImagesReady and isBlockedByImages
  assert.match(panelContent, /isImagesReady/, "Must derive isImagesReady");
  assert.match(panelContent, /isBlockedByImages/, "Must derive isBlockedByImages");

  // StepDetailPanel disables Rerun button with title
  assert.match(panelContent, /disabled=\{[^}]*isBlockedByImages[^}]*\}/, "Rerun button must be disabled when isBlockedByImages");

  // StepDetailPanel passes isImagesReady to SubtitlesOutputView and StepHistoryModal
  assert.match(panelContent, /isImagesReady=\{isImagesReady\}/, "Must pass isImagesReady to child components");

  // SubtitlesOutputView disables apply button when isImagesReady === false
  assert.match(subContent, /isImagesReady\s*===\s*false/, "SubtitlesOutputView must check isImagesReady === false");
  assert.match(subContent, /disabled=\{[^}]*isImagesReady\s*===\s*false[^}]*\}/, "Apply button must be disabled when isImagesReady === false");

  // StepHistoryModal disables rollback button when isRollbackBlocked
  assert.match(histContent, /isRollbackBlocked/, "StepHistoryModal must compute isRollbackBlocked");
  assert.match(histContent, /disabled=\{[^}]*isRollbackBlocked[^}]*\}/, "Rollback button must be disabled when isRollbackBlocked");
});
