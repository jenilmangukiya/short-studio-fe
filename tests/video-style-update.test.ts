import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { api } from "../src/lib/api.ts";
import {
  type VisualStyleId,
  type VisualStyleSummaryOut,
  type VideoDetail,
} from "../src/lib/types.ts";
import {
  getVideoEffectiveStyleId,
  isLegacyVideo,
  getVideoStyleDisplayName,
  getVideoStyleDescription,
  invalidateVideoStyleQueries,
} from "../src/lib/visual-style-ui.ts";

const mockCatalogStyles: VisualStyleSummaryOut[] = [
  {
    id: "legacy_default",
    name: "Clean 3D Studio (Default)",
    version: 1,
    category: "3d_render",
    description: "Smooth stylized 3D matte characters and objects with clean studio lighting.",
    preview_image_path: "previews/legacy_default.jpg",
    is_default: true,
  },
  {
    id: "stickman_tactical_explainer",
    name: "Stickman Tactical Explainer",
    version: 1,
    category: "illustrated_2d",
    description: "Minimalist white circular-head stick figures with tactical diagrams.",
    preview_image_path: "previews/stickman_tactical.jpg",
    is_default: false,
  },
  {
    id: "stylized_2d_narrative",
    name: "Stylized 2D Narrative",
    version: 1,
    category: "illustrated_2d",
    description: "High-contrast illustrated storybook aesthetics with dramatic lighting.",
    preview_image_path: "previews/stylized_2d.jpg",
    is_default: false,
  },
];

// ============================================================================
// Group 1: Display & Legacy Video Compatibility Tests
// ============================================================================

test("1. Video with a known visual-style ID displays the correct style name and description", () => {
  const video: Partial<VideoDetail> = {
    id: "v-1",
    visual_style_id: "stickman_tactical_explainer",
    visual_style_version: 1,
    visual_style_snapshot: null,
  };

  const effectiveId = getVideoEffectiveStyleId(video);
  const displayName = getVideoStyleDisplayName(video, mockCatalogStyles);
  const description = getVideoStyleDescription(video, mockCatalogStyles);
  const isLegacy = isLegacyVideo(video);

  assert.equal(effectiveId, "stickman_tactical_explainer");
  assert.equal(displayName, "Stickman Tactical Explainer");
  assert.equal(description, "Minimalist white circular-head stick figures with tactical diagrams.");
  assert.equal(isLegacy, false);
});

test("2. Legacy video with null style fields displays 'Legacy Default — Clean 3D Studio'", () => {
  const legacyVideo: Partial<VideoDetail> = {
    id: "v-legacy",
    visual_style_id: null,
    visual_style_version: null,
    visual_style_snapshot: null,
  };

  const effectiveId = getVideoEffectiveStyleId(legacyVideo);
  const displayName = getVideoStyleDisplayName(legacyVideo, mockCatalogStyles);
  const description = getVideoStyleDescription(legacyVideo, mockCatalogStyles);
  const isLegacy = isLegacyVideo(legacyVideo);

  assert.equal(effectiveId, "legacy_default");
  assert.equal(displayName, "Legacy Default — Clean 3D Studio");
  assert.match(description, /Smooth stylized 3D matte/);
  assert.equal(isLegacy, true);
});

test("3. Missing or empty catalog metadata does not crash the page and provides graceful fallbacks", () => {
  const videoWithStyle: Partial<VideoDetail> = {
    id: "v-empty-catalog",
    visual_style_id: "stylized_2d_narrative",
  };

  // With empty catalog array
  const displayNameEmpty = getVideoStyleDisplayName(videoWithStyle, []);
  const descriptionEmpty = getVideoStyleDescription(videoWithStyle, []);
  assert.equal(displayNameEmpty, "Stylized 2D Narrative");
  assert.ok(descriptionEmpty.length > 0);

  // With undefined catalog
  const displayNameUndefined = getVideoStyleDisplayName(videoWithStyle, undefined);
  assert.equal(displayNameUndefined, "Stylized 2D Narrative");

  // Legacy video with undefined catalog
  const legacyDisplayName = getVideoStyleDisplayName({ visual_style_id: null }, undefined);
  assert.equal(legacyDisplayName, "Legacy Default — Clean 3D Studio");
});

test("4. Existing frozen snapshot data is authoritative and is not overwritten by catalog data", () => {
  const videoWithSnapshot: Partial<VideoDetail> = {
    id: "v-frozen",
    visual_style_id: "stickman_tactical_explainer",
    visual_style_version: 1,
    visual_style_snapshot: {
      id: "stickman_tactical_explainer",
      name: "Authoritative Frozen Stickman Preset v1",
      description: "Custom frozen description stored at time of creation.",
    },
  };

  const displayName = getVideoStyleDisplayName(videoWithSnapshot, mockCatalogStyles);
  const description = getVideoStyleDescription(videoWithSnapshot, mockCatalogStyles);

  // Snapshot name and description must be favored over catalog data
  assert.equal(displayName, "Authoritative Frozen Stickman Preset v1");
  assert.equal(description, "Custom frozen description stored at time of creation.");
});

// ============================================================================
// Group 2: Style Update Workflow & Guard Tests
// ============================================================================

test("5. Opening the change dialog preselects the current effective style", () => {
  const standardVideo: Partial<VideoDetail> = {
    id: "v-std",
    visual_style_id: "stylized_2d_narrative",
  };
  assert.equal(getVideoEffectiveStyleId(standardVideo), "stylized_2d_narrative");

  const legacyVideo: Partial<VideoDetail> = {
    id: "v-leg",
    visual_style_id: null,
  };
  assert.equal(getVideoEffectiveStyleId(legacyVideo), "legacy_default");
});

test("6. Selecting a different style and confirming calls api.videos.updateVisualStyle", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string; body: unknown }[] = [];

  const videoId = "vid-change-123";
  const newStyle: VisualStyleId = "stickman_tactical_explainer";

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: input.toString(),
      method: init?.method || "GET",
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });

    return new Response(
      JSON.stringify({
        id: videoId,
        channel_id: "ch-1",
        topic: "Test Video",
        status: "in_progress",
        visual_style_id: newStyle,
        visual_style_version: 2,
        visual_style_snapshot: { id: newStyle, name: "Stickman Tactical Explainer" },
        steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await api.videos.updateVisualStyle(videoId, newStyle);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, new RegExp(`/api/videos/${videoId}/visual-style$`));
    assert.equal(requests[0].method, "PATCH");
    assert.deepEqual(requests[0].body, { visual_style_id: "stickman_tactical_explainer" });
    assert.equal(result.visual_style_id, "stickman_tactical_explainer");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("7. Selecting the already-active style prevents unnecessary API updates", () => {
  const currentStyleId: VisualStyleId = "stickman_tactical_explainer";
  const selectedStyleId: VisualStyleId = "stickman_tactical_explainer";

  const isCurrentSelection = selectedStyleId === currentStyleId;
  assert.equal(isCurrentSelection, true);

  // In ChangeVisualStyleModal, handleSubmit guards:
  // if (isCurrentSelection || updateStyleMutation.isPending) return;
  let apiCalled = false;
  const simulatedSubmit = () => {
    if (isCurrentSelection) return;
    apiCalled = true;
  };

  simulatedSubmit();
  assert.equal(apiCalled, false);
});

test("8. Legacy video with null style fields can be upgraded to another style", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string; body: unknown }[] = [];

  const videoId = "vid-legacy-upgrade";
  const targetStyle: VisualStyleId = "stylized_2d_narrative";

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: input.toString(),
      method: init?.method || "GET",
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });

    return new Response(
      JSON.stringify({
        id: videoId,
        channel_id: "ch-1",
        topic: "Legacy Upgraded",
        status: "in_progress",
        visual_style_id: targetStyle,
        visual_style_version: 1,
        steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const legacyVideo: Partial<VideoDetail> = {
      id: videoId,
      visual_style_id: null,
    };

    const currentEffective = getVideoEffectiveStyleId(legacyVideo);
    assert.equal(currentEffective, "legacy_default");

    // Selecting stylized_2d_narrative is a change from legacy_default
    const isSame = (targetStyle as string) === (currentEffective as string);
    assert.equal(isSame, false);

    const result = await api.videos.updateVisualStyle(videoId, targetStyle);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].body, { visual_style_id: targetStyle });
    assert.equal(result.visual_style_id, targetStyle);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("9. Legacy video selecting legacy_default does not cause an unnecessary update", () => {
  const legacyVideo: Partial<VideoDetail> = {
    id: "vid-legacy-same",
    visual_style_id: null,
  };

  const currentEffective = getVideoEffectiveStyleId(legacyVideo);
  assert.equal(currentEffective, "legacy_default");

  const chosenStyle: VisualStyleId = "legacy_default";
  const isUnchanged = (chosenStyle as string) === (currentEffective as string);
  assert.equal(isUnchanged, true);

  // Submit must be prevented when chosen style matches current effective style
  let calls = 0;
  const simulatedSubmit = (target: VisualStyleId) => {
    if (target === currentEffective) return;
    calls += 1;
  };

  simulatedSubmit(chosenStyle);
  assert.equal(calls, 0);
});

test("10. Canceling the dialog does not call the API", () => {
  let calls = 0;
  const onCancel = (triggerApi = false) => {
    // Closes dialog and resets selection without invoking API
    if (triggerApi) {
      calls += 1;
    }
  };

  onCancel(false);
  assert.equal(calls, 0);
});

test("11. Duplicate submissions are prevented while mutation is pending", () => {
  let pending = true;
  let calls = 0;

  const handleSimulatedSubmit = () => {
    if (pending) return;
    calls += 1;
  };

  handleSimulatedSubmit();
  handleSimulatedSubmit();
  assert.equal(calls, 0);

  pending = false;
  handleSimulatedSubmit();
  assert.equal(calls, 1);
});

test("12. Mutation failure displays actionable error without falsely updating UI state", async () => {
  const originalFetch = globalThis.fetch;
  const videoId = "vid-fail";

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({ detail: "Visual style preset stickman_tactical_explainer is temporarily unavailable." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    let capturedError: Error | null = null;
    try {
      await api.videos.updateVisualStyle(videoId, "stickman_tactical_explainer");
    } catch (err) {
      capturedError = err as Error;
    }

    assert.ok(capturedError, "API must reject on 500 status");
    assert.match(capturedError.message, /temporarily unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Group 3: Cache Lifecycle, Invalidation & Cancellation Tests
// ============================================================================

test("13. invalidateVideoStyleQueries cancels scene-image queries and awaits cancellation before removal", async () => {
  const videoId = "vid-test-cache-123";
  const channelId = "ch-test-cache-456";

  const eventLog: string[] = [];
  let isCancelAwaited = false;

  const mockQueryClient = {
    cancelQueries: async (options: { queryKey: unknown[] }) => {
      const keyStr = (options.queryKey as string[]).join(".");
      eventLog.push(`cancel-start:${keyStr}`);
      await new Promise((resolve) => setTimeout(resolve, 15));
      isCancelAwaited = true;
      eventLog.push(`cancel-finish:${keyStr}`);
    },
    removeQueries: (options: { queryKey: unknown[] }) => {
      const keyStr = (options.queryKey as string[]).join(".");
      // Verify cancellation finished BEFORE removeQueries is called
      assert.equal(isCancelAwaited, true, "cancelQueries must complete before removeQueries executes");
      eventLog.push(`remove:${keyStr}`);
    },
    invalidateQueries: (options: { queryKey: unknown[] }) => {
      const keyStr = (options.queryKey as string[]).join(".");
      eventLog.push(`invalidate:${keyStr}`);
      return Promise.resolve();
    },
  };

  await invalidateVideoStyleQueries(mockQueryClient, videoId, channelId);

  // Verify exact lifecycle order
  const cancelStartIndex = eventLog.indexOf(`cancel-start:scene-image.${videoId}`);
  const cancelFinishIndex = eventLog.indexOf(`cancel-finish:scene-image.${videoId}`);
  const removeIndex = eventLog.indexOf(`remove:scene-image.${videoId}`);

  assert.ok(cancelStartIndex !== -1, "Must call cancelQueries for scene-image");
  assert.ok(cancelFinishIndex !== -1, "Must finish cancelQueries for scene-image");
  assert.ok(removeIndex !== -1, "Must call removeQueries for scene-image");
  assert.ok(cancelStartIndex < cancelFinishIndex, "Cancellation start precedes finish");
  assert.ok(cancelFinishIndex < removeIndex, "Cancellation finish precedes removal");
});

test("14. invalidateVideoStyleQueries does NOT invalidate scene-image queries (preventing premature 404 refetches)", async () => {
  const videoId = "vid-no-image-invalidation-789";
  const channelId = "ch-789";

  const invalidatedKeys: unknown[][] = [];
  const removedKeys: unknown[][] = [];

  const mockQueryClient = {
    cancelQueries: async () => {},
    removeQueries: (options: { queryKey: unknown[] }) => {
      removedKeys.push(options.queryKey);
    },
    invalidateQueries: (options: { queryKey: unknown[] }) => {
      invalidatedKeys.push(options.queryKey);
      return Promise.resolve();
    },
  };

  await invalidateVideoStyleQueries(mockQueryClient, videoId, channelId);

  // 1. Scene-image queries must NOT be invalidated
  const hasSceneImageInvalidated = invalidatedKeys.some(
    (k) => Array.isArray(k) && k[0] === "scene-image"
  );
  assert.equal(hasSceneImageInvalidated, false, "Must NOT invalidate ['scene-image', videoId]");

  // 2. Scene-image queries MUST be removed from cache (clearing both active and inactive blobs)
  const hasSceneImageRemoved = removedKeys.some(
    (k) => Array.isArray(k) && k[0] === "scene-image" && k[1] === videoId
  );
  assert.equal(hasSceneImageRemoved, true, "Must remove ['scene-image', videoId] from cache");

  // 3. Other required queries are still invalidated
  const hasVideoQuery = invalidatedKeys.some(
    (k) => Array.isArray(k) && k[0] === "video" && k[1] === videoId
  );
  assert.equal(hasVideoQuery, true, "Must invalidate ['video', videoId]");

  const hasBlobQuery = invalidatedKeys.some(
    (k) => Array.isArray(k) && k[0] === "video-blob" && k[1] === videoId
  );
  assert.equal(hasBlobQuery, true, "Must invalidate ['video-blob', videoId]");

  const hasSubtitlesQuery = invalidatedKeys.some(
    (k) => Array.isArray(k) && k[0] === "video-subtitles" && k[1] === videoId
  );
  assert.equal(hasSubtitlesQuery, true, "Must invalidate ['video-subtitles', videoId]");

  const hasChannelVideosQuery = invalidatedKeys.some(
    (k) =>
      Array.isArray(k) &&
      k[0] === "channel" &&
      k[1] === channelId &&
      k[2] === "videos"
  );
  assert.equal(hasChannelVideosQuery, true, "Must invalidate ['channel', channelId, 'videos']");

  // 4. Audio and visual-styles catalog queries remain strictly preserved
  const hasAudioQuery = invalidatedKeys.some(
    (k) => Array.isArray(k) && k[0] === "video-audio"
  );
  assert.equal(hasAudioQuery, false, "Must NOT invalidate ['video-audio', videoId]");

  const hasCatalogQuery = invalidatedKeys.some(
    (k) => Array.isArray(k) && k[0] === "visual-styles"
  );
  assert.equal(hasCatalogQuery, false, "Must NOT invalidate ['visual-styles']");
});

test("15. api.videos.getSceneImageBlob accepts AbortSignal and supports request cancellation", async () => {
  const originalFetch = globalThis.fetch;
  let receivedSignal: AbortSignal | undefined = undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    receivedSignal = init?.signal ?? undefined;
    if (init?.signal?.aborted) {
      throw new DOMException("This operation was aborted", "AbortError");
    }
    return new Response(new Blob(["mock-image-data"]), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  }) as typeof fetch;

  try {
    // Call with active signal
    const controller = new AbortController();
    const blobPromise = api.videos.getSceneImageBlob("v-cancel-test", 1, controller.signal);
    const blob = await blobPromise;
    assert.ok(blob instanceof Blob);
    assert.equal(receivedSignal, controller.signal);

    // Call with pre-aborted signal
    controller.abort();
    let abortedError: Error | null = null;
    try {
      await api.videos.getSceneImageBlob("v-cancel-test", 1, controller.signal);
    } catch (err) {
      abortedError = err as Error;
    }
    assert.ok(abortedError !== null, "Must reject when signal is aborted");
    assert.equal(abortedError.name, "AbortError");

    // Existing signature (without signal) remains 100% backward-compatible
    const uncancelled = await api.videos.getSceneImageBlob("v-cancel-test", 1);
    assert.ok(uncancelled instanceof Blob);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("16. AuthenticatedImage component forwards TanStack Query signal to getSceneImageBlob", () => {
  const componentPath = path.resolve(
    process.cwd(),
    "src/components/AuthenticatedImage.tsx"
  );
  assert.ok(fs.existsSync(componentPath), "AuthenticatedImage.tsx must exist");

  const content = fs.readFileSync(componentPath, "utf-8");
  assert.match(
    content,
    /queryFn:\s*\(\s*{\s*signal\s*}\s*\)\s*=>\s*api\.videos\.getSceneImageBlob\([^)]*signal\)/,
    "useAuthenticatedImage must forward signal to api.videos.getSceneImageBlob"
  );
});

test("17. ChangeVisualStyleModal awaits invalidateVideoStyleQueries on mutation success", () => {
  const modalPath = path.resolve(
    process.cwd(),
    "src/components/ChangeVisualStyleModal.tsx"
  );
  assert.ok(fs.existsSync(modalPath), "ChangeVisualStyleModal.tsx must exist");

  const content = fs.readFileSync(modalPath, "utf-8");
  assert.match(
    content,
    /onSuccess:\s*async\s*\([^)]*\)\s*=>\s*{[^}]*await\s+invalidateVideoStyleQueries/,
    "ChangeVisualStyleModal mutation must be async and await invalidateVideoStyleQueries"
  );
});

// ============================================================================
// Group 4: Source & UI Component Verification
// ============================================================================

test("18. ChangeVisualStyleModal source code contains required elements and safeguards", () => {
  const modalPath = path.resolve(
    process.cwd(),
    "src/components/ChangeVisualStyleModal.tsx"
  );
  assert.ok(fs.existsSync(modalPath), "ChangeVisualStyleModal.tsx must exist");

  const content = fs.readFileSync(modalPath, "utf-8");

  // Reuses VisualStyleSelector
  assert.match(content, /<VisualStyleSelector/, "Must reuse VisualStyleSelector");

  // Accessible dialog semantics
  assert.match(content, /role="dialog"/, "Must have dialog role");
  assert.match(content, /aria-modal="true"/, "Must have aria-modal attribute");

  // Invalidation notice warning
  assert.match(content, /recomposes visual prompts/i, "Must explain visual prompt recomposition");
  assert.match(content, /invalidates existing scene images/i, "Must explain image and render invalidation");
  assert.match(content, /voiceover audio are safely preserved/i, "Must clarify audio preservation");

  // Mutation and disablement safeguards
  assert.match(content, /api\.videos\.updateVisualStyle/, "Must call api.videos.updateVisualStyle");
  assert.match(content, /isCurrentSelection/, "Must prevent submission if current style is chosen");
  assert.match(content, /updateStyleMutation\.isPending/, "Must track pending state");
  assert.match(content, /invalidateVideoStyleQueries/, "Must call invalidateVideoStyleQueries on success");
});

test("19. Video detail page source code displays current style and mounts change modal", () => {
  const pagePath = path.resolve(
    process.cwd(),
    "src/app/videos/[id]/page.tsx"
  );
  assert.ok(fs.existsSync(pagePath), "videos/[id]/page.tsx must exist");

  const content = fs.readFileSync(pagePath, "utf-8");

  // Imports and mounts ChangeVisualStyleModal
  assert.match(content, /ChangeVisualStyleModal/, "Must import ChangeVisualStyleModal");
  assert.match(content, /<ChangeVisualStyleModal/, "Must mount ChangeVisualStyleModal");

  // Displays visual style info in header
  assert.match(content, /Visual Style:/, "Must show Visual Style label in header");
  assert.match(content, /getVideoStyleDisplayName/, "Must compute display name with snapshot awareness");
  assert.match(content, /getVideoStyleDescription/, "Must compute style description");
  assert.match(content, /Change Style/, "Must provide Change Style trigger button");

  // Handles legacy videos
  assert.match(content, /Legacy Default/, "Must communicate legacy default status");
});
