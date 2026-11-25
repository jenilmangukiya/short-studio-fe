import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  imageInvalidationRegistry,
  invalidateVideoStyleQueries,
} from "../src/lib/visual-style-ui.ts";
import { objectUrlRegistry } from "../src/lib/object-url.ts";

// ============================================================================
// Helper to simulate a mounted AuthenticatedImage component observer
// ============================================================================

function createMountedImageObserver({
  queryClient,
  videoId,
  sceneIndex,
  promptHash,
  queryFn,
  isStale = false,
}: {
  queryClient: QueryClient;
  videoId: string;
  sceneIndex: number;
  promptHash?: string;
  queryFn: (signal?: AbortSignal) => Promise<Blob>;
  isStale?: boolean;
}) {
  let currentBlob: Blob | undefined = undefined;
  let currentUrl: string | null = null;
  let isMounted = true;

  const getInvalidationVersion = () => imageInvalidationRegistry.getVersion(videoId);
  const getIsRegistryStale = () => imageInvalidationRegistry.isStale(videoId);

  let effectiveIsStale = Boolean(isStale || getIsRegistryStale());

  const observer = new QueryObserver(queryClient, {
    queryKey: ["scene-image", videoId, sceneIndex, promptHash, getInvalidationVersion()],
    queryFn: ({ signal }) => queryFn(signal),
    enabled: Boolean(videoId && sceneIndex !== undefined && !effectiveIsStale),
    staleTime: 1000 * 60 * 60,
    gcTime: Infinity,
    retry: 0,
  });

  const syncStateFromBlob = (blob: Blob | undefined | null) => {
    if (!isMounted) return;
    const effectiveBlob = effectiveIsStale ? undefined : (blob || undefined);

    // Release old blob if changed
    if (currentBlob && currentBlob !== effectiveBlob) {
      objectUrlRegistry.release(currentBlob);
      currentBlob = undefined;
    }

    // Acquire new blob if present
    if (effectiveBlob && effectiveBlob !== currentBlob) {
      currentBlob = effectiveBlob;
      currentUrl = objectUrlRegistry.acquire(effectiveBlob);
    } else if (!effectiveBlob) {
      currentUrl = null;
    }
  };

  const unsubscribeObserver = observer.subscribe((result) => {
    effectiveIsStale = Boolean(isStale || getIsRegistryStale());
    syncStateFromBlob(result.data);
  });

  const unsubscribeRegistry = imageInvalidationRegistry.subscribe(() => {
    effectiveIsStale = Boolean(isStale || getIsRegistryStale());
    const version = getInvalidationVersion();

    observer.setOptions({
      queryKey: ["scene-image", videoId, sceneIndex, promptHash, version],
      queryFn: ({ signal }) => queryFn(signal),
      enabled: Boolean(videoId && sceneIndex !== undefined && !effectiveIsStale),
      staleTime: 1000 * 60 * 60,
      gcTime: Infinity,
      retry: 0,
    });

    if (effectiveIsStale) {
      syncStateFromBlob(undefined);
    }
  });

  return {
    observer,
    getCurrentUrl: () => currentUrl,
    getCurrentBlob: () => currentBlob,
    getEffectiveIsStale: () => effectiveIsStale,
    unmount: () => {
      isMounted = false;
      if (currentBlob) {
        objectUrlRegistry.release(currentBlob);
        currentBlob = undefined;
      }
      currentUrl = null;
      unsubscribeObserver();
      unsubscribeRegistry();
    },
    updateProps: (newOptions: {
      videoId?: string;
      sceneIndex?: number;
      promptHash?: string;
      isStale?: boolean;
    }) => {
      const vId = newOptions.videoId ?? videoId;
      const sIdx = newOptions.sceneIndex ?? sceneIndex;
      const pHash = newOptions.promptHash ?? promptHash;
      if (newOptions.isStale !== undefined) {
        isStale = newOptions.isStale;
      }
      effectiveIsStale = Boolean(isStale || imageInvalidationRegistry.isStale(vId));
      const version = imageInvalidationRegistry.getVersion(vId);

      observer.setOptions({
        queryKey: ["scene-image", vId, sIdx, pHash, version],
        queryFn: ({ signal }) => queryFn(signal),
        enabled: Boolean(vId && sIdx !== undefined && !effectiveIsStale),
        staleTime: 1000 * 60 * 60,
        gcTime: Infinity,
        retry: 0,
      });

      syncStateFromBlob(observer.getCurrentResult().data);
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

test("1. An image component is mounted and displays an image", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();
  const mockBlob = new Blob(["mock-image-bytes-v1"], { type: "image/png" });

  const mounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-1",
    sceneIndex: 1,
    promptHash: "hash-v1",
    queryFn: async () => mockBlob,
  });

  // Wait for initial fetch to settle
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(mounted.getCurrentBlob(), mockBlob);
  assert.ok(mounted.getCurrentUrl() !== null, "Object URL must be acquired");
  assert.equal(typeof mounted.getCurrentUrl(), "string");
  assert.equal(objectUrlRegistry.getEntryCount(), 1);

  mounted.unmount();
  assert.equal(objectUrlRegistry.getEntryCount(), 0, "Object URL must be released on unmount");
  queryClient.clear();
});

test("2. Visual-style change occurs while component remains mounted -> old image disappears immediately", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();
  const mockBlob = new Blob(["mock-image-v1"], { type: "image/png" });

  const mounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-change-active",
    sceneIndex: 1,
    promptHash: "hash-v1",
    queryFn: async () => mockBlob,
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(mounted.getCurrentBlob(), mockBlob);
  assert.ok(mounted.getCurrentUrl() !== null);

  // User changes visual style: invalidateVideoStyleQueries runs while component remains mounted
  await invalidateVideoStyleQueries(queryClient, "vid-change-active", "chan-1");

  // Old image must disappear immediately without requiring unmount/remount
  assert.equal(mounted.getCurrentBlob(), undefined, "Old blob reference must be cleared");
  assert.equal(mounted.getCurrentUrl(), null, "Old Object URL must be revoked and reset to null");
  assert.equal(mounted.getEffectiveIsStale(), true, "Component must detect stale state");
  assert.equal(objectUrlRegistry.getEntryCount(), 0, "Object URL registry must have released the blob");

  mounted.unmount();
  queryClient.clear();
});

test("3. Component displays correct stale/placeholder state after visual-style change", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();
  const mockBlob = new Blob(["mock-image-v1"], { type: "image/png" });

  const mounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-stale-placeholder",
    sceneIndex: 2,
    promptHash: "hash-v1",
    queryFn: async () => mockBlob,
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(mounted.getEffectiveIsStale(), false);

  // Trigger style invalidation
  await invalidateVideoStyleQueries(queryClient, "vid-stale-placeholder");

  // Component must be in effective stale state
  assert.equal(mounted.getEffectiveIsStale(), true);
  assert.equal(mounted.getCurrentUrl(), null);

  mounted.unmount();
  queryClient.clear();
});

test("4. No premature image fetch or repeated 404 retry occurs while images are stale", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();
  let fetchCount = 0;

  const mockBlob = new Blob(["mock-image-v1"], { type: "image/png" });

  const mounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-no-premature-fetch",
    sceneIndex: 1,
    promptHash: "hash-v1",
    queryFn: async () => {
      fetchCount++;
      return mockBlob;
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(fetchCount, 1, "Initial fetch executed once");

  // Visual style change occurs
  await invalidateVideoStyleQueries(queryClient, "vid-no-premature-fetch");

  // Observer is disabled while stale: verify no additional fetch occurs over multiple ticks
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(fetchCount, 1, "Must NOT fetch while images are marked stale");

  // Mounting another observer for the same stale video must also NOT trigger a fetch
  let secondFetchCount = 0;
  const secondMounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-no-premature-fetch",
    sceneIndex: 2,
    promptHash: "hash-v1",
    queryFn: async () => {
      secondFetchCount++;
      throw new Error("404 Not Found");
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(secondFetchCount, 0, "Second observer must be disabled and emit 0 network requests");

  mounted.unmount();
  secondMounted.unmount();
  queryClient.clear();
});

test("5. Regeneration completes and new image can load with updated promptHash", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();

  const oldBlob = new Blob(["old-style-image"], { type: "image/png" });
  const newBlob = new Blob(["new-style-image"], { type: "image/png" });
  let currentServerBlob = oldBlob;

  const mounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-regen-flow",
    sceneIndex: 1,
    promptHash: "hash-v1",
    queryFn: async () => currentServerBlob,
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(mounted.getCurrentBlob(), oldBlob);

  // 1. Style change invalidates images
  await invalidateVideoStyleQueries(queryClient, "vid-regen-flow");
  assert.equal(mounted.getCurrentBlob(), undefined);
  assert.equal(mounted.getCurrentUrl(), null);

  // 2. Regeneration pipeline finishes: server has new image and prompt hash
  currentServerBlob = newBlob;
  imageInvalidationRegistry.clearVideoImageInvalidation("vid-regen-flow");

  // 3. Component receives new promptHash from updated video state
  mounted.updateProps({ promptHash: "hash-v2", isStale: false });

  await new Promise((resolve) => setTimeout(resolve, 40));

  // 4. New image is loaded and displayed
  assert.equal(mounted.getCurrentBlob(), newBlob, "New blob must load after regeneration");
  assert.ok(mounted.getCurrentUrl() !== null, "New Object URL must be acquired");
  assert.equal(mounted.getEffectiveIsStale(), false);

  mounted.unmount();
  queryClient.clear();
});

test("6. Object URLs created by component are revoked correctly on invalidation", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();

  const originalRevoke = URL.revokeObjectURL;
  const revokedUrls: string[] = [];
  URL.revokeObjectURL = (url: string) => {
    revokedUrls.push(url);
    originalRevoke.call(URL, url);
  };

  try {
    const mockBlob = new Blob(["test-revoke-bytes"], { type: "image/png" });

    const mounted = createMountedImageObserver({
      queryClient,
      videoId: "vid-revoke-test",
      sceneIndex: 1,
      promptHash: "hash-1",
      queryFn: async () => mockBlob,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    const acquiredUrl = mounted.getCurrentUrl();
    assert.ok(acquiredUrl !== null);
    assert.equal(revokedUrls.length, 0);

    // Visual style change occurs
    await invalidateVideoStyleQueries(queryClient, "vid-revoke-test");

    // URL must be revoked immediately
    assert.equal(revokedUrls.length, 1);
    assert.equal(revokedUrls[0], acquiredUrl);
    assert.equal(objectUrlRegistry.getEntryCount(), 0);

    mounted.unmount();
    queryClient.clear();
  } finally {
    URL.revokeObjectURL = originalRevoke;
  }
});

test("7. Shared Object URLs across multiple mounted components maintain refCount and revoke only when all release", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();

  const originalRevoke = URL.revokeObjectURL;
  const revokedUrls: string[] = [];
  URL.revokeObjectURL = (url: string) => {
    revokedUrls.push(url);
    originalRevoke.call(URL, url);
  };

  try {
    const sharedBlob = new Blob(["shared-image-bytes"], { type: "image/png" });

    // Component A (e.g. Gallery Thumbnail)
    const compA = createMountedImageObserver({
      queryClient,
      videoId: "vid-shared-ref",
      sceneIndex: 1,
      promptHash: "hash-shared",
      queryFn: async () => sharedBlob,
    });

    // Component B (e.g. Preview Modal)
    const compB = createMountedImageObserver({
      queryClient,
      videoId: "vid-shared-ref",
      sceneIndex: 1,
      promptHash: "hash-shared",
      queryFn: async () => sharedBlob,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(compA.getCurrentUrl(), compB.getCurrentUrl(), "Both components share same object URL");
    assert.equal(objectUrlRegistry.getRefCount(sharedBlob), 2);
    assert.equal(revokedUrls.length, 0);

    // Component A unmounts
    compA.unmount();
    assert.equal(objectUrlRegistry.getRefCount(sharedBlob), 1, "RefCount decrements to 1");
    assert.equal(revokedUrls.length, 0, "URL must NOT be revoked while Component B is still mounted");
    assert.ok(compB.getCurrentUrl() !== null);

    // Component B unmounts
    compB.unmount();
    assert.equal(objectUrlRegistry.getRefCount(sharedBlob), 0);
    assert.equal(revokedUrls.length, 1, "URL revoked once last component unmounts");
    assert.equal(objectUrlRegistry.getEntryCount(), 0);
    queryClient.clear();
  } finally {
    URL.revokeObjectURL = originalRevoke;
  }
});

test("8. Switching between videos does not leak or display previous video's image", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();

  const blobA = new Blob(["video-A-image"], { type: "image/png" });

  const mounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-A",
    sceneIndex: 1,
    promptHash: "hash-A",
    queryFn: async () => blobA,
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(mounted.getCurrentBlob(), blobA);
  const urlA = mounted.getCurrentUrl();
  assert.ok(urlA !== null);

  // Switch props to video B with new queryFn
  mounted.updateProps({ videoId: "vid-B", sceneIndex: 1, promptHash: "hash-B" });

  // While video B query is executing, video A's blob was released
  assert.notEqual(mounted.getCurrentBlob(), blobA, "Must not retain video A's blob");
  assert.notEqual(mounted.getCurrentUrl(), urlA, "Must not retain video A's URL");

  mounted.unmount();
  queryClient.clear();
});

test("9. Existing image loading behavior remains intact when no style change occurs", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();
  const standardBlob = new Blob(["standard-render-image"], { type: "image/png" });

  const mounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-standard",
    sceneIndex: 1,
    promptHash: "hash-std",
    queryFn: async () => standardBlob,
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(mounted.getCurrentBlob(), standardBlob);
  assert.ok(mounted.getCurrentUrl() !== null);
  assert.equal(mounted.getEffectiveIsStale(), false);

  mounted.unmount();
  queryClient.clear();
});

test("10. Audio and unrelated query data remain strictly unaffected by visual style invalidation", async () => {
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();

  const videoId = "vid-unrelated-test";
  const channelId = "chan-unrelated-test";

  // Populate queries
  queryClient.setQueryData(["scene-image", videoId, 1, "h1", 0], new Blob(["img"]));
  queryClient.setQueryData(["video-audio", videoId], new Blob(["audio-bytes"], { type: "audio/mp3" }));
  queryClient.setQueryData(["visual-styles"], { default_style_id: "legacy_default", styles: [] });
  queryClient.setQueryData(["video", videoId], { id: videoId, topic: "Preserve Test" });

  // Invalidate visual style
  await invalidateVideoStyleQueries(queryClient, videoId, channelId);

  // 1. Audio query MUST be preserved
  const audioData = queryClient.getQueryData(["video-audio", videoId]);
  assert.ok(audioData instanceof Blob, "Audio data must remain in cache");

  // 2. Visual-styles catalog MUST be preserved
  const catalogData = queryClient.getQueryData(["visual-styles"]);
  assert.ok(catalogData !== undefined, "Catalog query must remain in cache");

  // 3. Scene-image queries for this video MUST be evicted
  const sceneData = queryClient.getQueryData(["scene-image", videoId, 1, "h1", 0]);
  assert.equal(sceneData, undefined, "Scene image must be evicted from cache");
  queryClient.clear();
});

// ============================================================================
// Group 2: Lifecycle, Refresh & Invalidation Clearing Regression Tests
// ============================================================================

test("11. Simulated browser refresh with fresh registry preserves stale state if backend images status is stale", async () => {
  // Simulate complete browser refresh: in-memory registry is reset/empty
  imageInvalidationRegistry.reset();
  const queryClient = new QueryClient();

  // Video was invalidated prior to refresh; backend returns step status: "stale"
  const isBackendStepStale = true;
  let fetchAttempted = false;

  const mounted = createMountedImageObserver({
    queryClient,
    videoId: "vid-after-refresh",
    sceneIndex: 1,
    promptHash: "hash-stale-after-refresh",
    queryFn: async () => {
      fetchAttempted = true;
      throw new Error("404 Not Found");
    },
    isStale: isBackendStepStale, // Propagated from step.status === "stale" in StepDetailPanel
  });

  await new Promise((resolve) => setTimeout(resolve, 30));

  // Assertions:
  // 1. Component detects stale state even though in-memory registry is fresh (version 0, not in staleVideos)
  assert.equal(mounted.getEffectiveIsStale(), true, "Must be stale from backend step status");
  // 2. No network fetch is attempted (no 404 error)
  assert.equal(fetchAttempted, false, "Must NOT attempt fetch for invalidated images after refresh");
  assert.equal(mounted.getCurrentBlob(), undefined);
  assert.equal(mounted.getCurrentUrl(), null);

  mounted.unmount();
  queryClient.clear();
});

test("12. Initial mount of an already-completed images step does NOT clear a pending invalidation", () => {
  imageInvalidationRegistry.reset();
  const videoId = "vid-pending-inval";

  // Visual style change marks images as invalidated in registry
  imageInvalidationRegistry.invalidateVideoImages(videoId);
  assert.equal(imageInvalidationRegistry.isStale(videoId), true);

  // Simulate StepDetailPanel lifecycle:
  // prevStatusRef starts as initial step status ("done")
  const currentStepStatus = "done";
  let prevStatus = currentStepStatus;

  const simulateStepDetailPanelMount = () => {
    // Mounting with already "done" step status
    if (prevStatus === "running" && currentStepStatus === "done") {
      imageInvalidationRegistry.clearVideoImageInvalidation(videoId);
    }
    prevStatus = currentStepStatus;
  };

  simulateStepDetailPanelMount();

  // Invalidation MUST NOT be cleared by initial mount
  assert.equal(
    imageInvalidationRegistry.isStale(videoId),
    true,
    "Initial mount with done status must NOT clear pending invalidation"
  );
});

test("13. Images step transitioning from running to done clears invalidation after active regeneration", () => {
  imageInvalidationRegistry.reset();
  const videoId = "vid-active-regen";

  // Visual style change marks video as stale
  imageInvalidationRegistry.invalidateVideoImages(videoId);
  assert.equal(imageInvalidationRegistry.isStale(videoId), true);

  // Simulate regeneration lifecycle:
  // 1. Initial mount while pending or stale
  let currentStepStatus = "stale";
  let prevStatus = currentStepStatus;

  // 2. Regeneration starts: status changes to running
  currentStepStatus = "running";
  if (prevStatus === "running" && currentStepStatus === "done") {
    imageInvalidationRegistry.clearVideoImageInvalidation(videoId);
  }
  prevStatus = currentStepStatus;
  assert.equal(imageInvalidationRegistry.isStale(videoId), true, "Still stale while running");

  // 3. Regeneration completes: status transitions from running -> done
  currentStepStatus = "done";
  if (prevStatus === "running" && currentStepStatus === "done") {
    imageInvalidationRegistry.clearVideoImageInvalidation(videoId);
  }
  prevStatus = currentStepStatus;

  // Invalidation MUST be cleared now that regeneration actually ran and finished
  assert.equal(
    imageInvalidationRegistry.isStale(videoId),
    false,
    "Active running -> done transition must clear invalidation"
  );
});

test("14. Failed or cancelled regeneration does NOT clear invalidation", () => {
  imageInvalidationRegistry.reset();
  const videoId = "vid-failed-regen";

  imageInvalidationRegistry.invalidateVideoImages(videoId);
  assert.equal(imageInvalidationRegistry.isStale(videoId), true);

  let currentStepStatus = "running";
  let prevStatus = "stale";
  prevStatus = currentStepStatus; // now running

  // Scenario A: Regeneration fails (status -> failed)
  currentStepStatus = "failed";
  if (prevStatus === "running" && currentStepStatus === "done") {
    imageInvalidationRegistry.clearVideoImageInvalidation(videoId);
  }
  prevStatus = currentStepStatus;
  assert.equal(imageInvalidationRegistry.isStale(videoId), true, "Failed regeneration must leave images stale");

  // Scenario B: Regeneration cancelled/reverted (status -> pending or stale)
  const cancelledStatus: string = "stale";
  if (prevStatus === "running" && cancelledStatus === "done") {
    imageInvalidationRegistry.clearVideoImageInvalidation(videoId);
  }
  assert.equal(imageInvalidationRegistry.isStale(videoId), true, "Stale/cancelled state must leave images stale");
});

test("15. An old completion cannot clear a newer visual-style invalidation", () => {
  imageInvalidationRegistry.reset();
  const videoId = "vid-newer-style-change";

  // Video was previously completed
  const currentStepStatus = "done";
  let prevStatus = "running"; // finished previous run

  // Active transition completed earlier
  if (prevStatus === "running" && currentStepStatus === "done") {
    imageInvalidationRegistry.clearVideoImageInvalidation(videoId);
  }
  prevStatus = currentStepStatus;
  assert.equal(imageInvalidationRegistry.isStale(videoId), false);

  // Now, user updates visual style!
  imageInvalidationRegistry.invalidateVideoImages(videoId);
  assert.equal(imageInvalidationRegistry.isStale(videoId), true);

  // StepDetailPanel re-renders with currentStepStatus still "done" before refetch/rerun kicks in
  if (prevStatus === "running" && currentStepStatus === "done") {
    imageInvalidationRegistry.clearVideoImageInvalidation(videoId);
  }
  prevStatus = currentStepStatus;

  // Must REMAIN stale because prevStatus was "done", not "running"
  assert.equal(
    imageInvalidationRegistry.isStale(videoId),
    true,
    "Older done status re-render must NOT clear newer style invalidation"
  );
});

test("16. Clearing invalidation for one video does NOT affect another video", () => {
  imageInvalidationRegistry.reset();
  const videoA = "vid-A-isolated";
  const videoB = "vid-B-isolated";

  imageInvalidationRegistry.invalidateVideoImages(videoA);
  imageInvalidationRegistry.invalidateVideoImages(videoB);

  assert.equal(imageInvalidationRegistry.isStale(videoA), true);
  assert.equal(imageInvalidationRegistry.isStale(videoB), true);

  // Clear video A only
  imageInvalidationRegistry.clearVideoImageInvalidation(videoA);

  assert.equal(imageInvalidationRegistry.isStale(videoA), false);
  assert.equal(imageInvalidationRegistry.isStale(videoB), true, "Video B invalidation must remain intact");
});
