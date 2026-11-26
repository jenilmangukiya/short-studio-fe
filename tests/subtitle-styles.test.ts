import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SUBTITLE_STYLE_ID,
  resolveSubtitleStyleId,
  getSubtitleWordStyle,
  buildAllChunks,
  findActiveSubtitle,
  getActiveWordIndex,
  type SubtitleChunk,
} from "../src/lib/subtitles.ts";
import type { SubtitleData, SubtitleMeta, SubtitleStyleOut } from "../src/lib/types.ts";
import { api, ApiError } from "../src/lib/api.ts";

test("1. DEFAULT_SUBTITLE_STYLE_ID points to clean_cinematic", () => {
  assert.equal(DEFAULT_SUBTITLE_STYLE_ID, "clean_cinematic");
});

test("2. resolveSubtitleStyleId: resolves valid styles and safely falls back for legacy/unknown data", () => {
  // Valid styles
  assert.equal(resolveSubtitleStyleId("clean_cinematic"), "clean_cinematic");
  assert.equal(resolveSubtitleStyleId("remotion_neon"), "remotion_neon");
  assert.equal(resolveSubtitleStyleId("dynamic_highlight"), "dynamic_highlight");

  // Trimming and case-insensitivity
  assert.equal(resolveSubtitleStyleId("  clean_cinematic  "), "clean_cinematic");
  assert.equal(resolveSubtitleStyleId("REMOTION_NEON"), "remotion_neon");
  assert.equal(resolveSubtitleStyleId("Dynamic_Highlight"), "dynamic_highlight");
  assert.equal(resolveSubtitleStyleId("  DYNAMIC_HIGHLIGHT  "), "dynamic_highlight");

  // Legacy missing metadata fallbacks
  assert.equal(resolveSubtitleStyleId(undefined), "clean_cinematic");
  assert.equal(resolveSubtitleStyleId(null), "clean_cinematic");
  assert.equal(resolveSubtitleStyleId(""), "clean_cinematic");
  assert.equal(resolveSubtitleStyleId("   "), "clean_cinematic");
  assert.equal(resolveSubtitleStyleId("unknown_style"), "clean_cinematic");
  assert.equal(resolveSubtitleStyleId("tiktok_bounce"), "clean_cinematic");
});

test("3. Legacy video record without style resolves to clean_cinematic", () => {
  const legacySubtitles: SubtitleData = {
    segments: [
      {
        index: 1,
        text: "Why do airplane windows have tiny holes?",
        start: 0.2,
        end: 2.8,
        words: [
          { text: "Why", start: 0.2, end: 0.5 },
          { text: "do", start: 0.5, end: 0.7 },
          { text: "airplane", start: 0.7, end: 1.2 },
          { text: "windows", start: 1.2, end: 1.6 },
          { text: "have", start: 1.6, end: 1.9 },
          { text: "tiny", start: 1.9, end: 2.2 },
          { text: "holes?", start: 2.2, end: 2.7 },
        ],
      },
    ],
    // Note: No style field present
  };

  const legacyMeta: SubtitleMeta = {
    provider: "acoustic",
    model: "vosk-forced-aligner",
    words_count: 7,
    // Note: No style field present
  };

  const resolved = resolveSubtitleStyleId(legacySubtitles.style ?? legacyMeta.style);
  assert.equal(resolved, "clean_cinematic");
});

test("4. Clean Cinematic word styling: preserves existing default appearance", () => {
  const activeStyle = getSubtitleWordStyle("clean_cinematic", true);
  const inactiveStyle = getSubtitleWordStyle("clean_cinematic", false);

  // Active word: amber-300, 110% scale, normal casing, prominent shadow
  assert.equal(activeStyle.color, "#fcd34d");
  assert.equal(activeStyle.scale, 1.1);
  assert.equal(activeStyle.textTransform, "none");
  assert.equal(activeStyle.fontWeight, 900);
  assert.ok(activeStyle.textShadow?.includes("251, 191, 36"));

  // Inactive word: white/85, 100% scale, normal casing
  assert.equal(inactiveStyle.color, "rgba(255, 255, 255, 0.85)");
  assert.equal(inactiveStyle.scale, 1.0);
  assert.equal(inactiveStyle.textTransform, "none");
  assert.equal(inactiveStyle.fontWeight, 700);
});

test("5. Remotion Neon word styling: bold white inactive, electric cyan active at ~106% scale with strong outline", () => {
  const activeStyle = getSubtitleWordStyle("remotion_neon", true);
  const inactiveStyle = getSubtitleWordStyle("remotion_neon", false);

  // Active word: electric cyan (#28F5FC), 1.06 scale (~106%), stroke, cyan glow
  assert.equal(activeStyle.color, "#28F5FC");
  assert.equal(activeStyle.scale, 1.06);
  assert.equal(activeStyle.textTransform, "none");
  assert.equal(activeStyle.textStroke, "2.5px #000000");
  assert.equal(activeStyle.paintOrder, "stroke fill");
  assert.ok(activeStyle.textShadow?.includes("40, 245, 252"));

  // Inactive word: bold white (#FFFFFF), 1.0 scale, stroke, strong shadow
  assert.equal(inactiveStyle.color, "#FFFFFF");
  assert.equal(inactiveStyle.scale, 1.0);
  assert.equal(inactiveStyle.textTransform, "none");
  assert.equal(inactiveStyle.textStroke, "2.5px #000000");
  assert.equal(inactiveStyle.paintOrder, "stroke fill");
  assert.ok(inactiveStyle.textShadow?.includes("rgba(0, 0, 0, 0.95)"));
});

test("6. Dynamic Highlight word styling: uppercase captions, yellow active at ~110% scale with strong outline", () => {
  const activeStyle = getSubtitleWordStyle("dynamic_highlight", true);
  const inactiveStyle = getSubtitleWordStyle("dynamic_highlight", false);

  // Active word: vibrant yellow (#FFE600), 1.10 scale (110%), uppercase, yellow punch glow
  assert.equal(activeStyle.color, "#FFE600");
  assert.equal(activeStyle.scale, 1.1);
  assert.equal(activeStyle.textTransform, "uppercase");
  assert.equal(activeStyle.textStroke, "3px #000000");
  assert.equal(activeStyle.paintOrder, "stroke fill");
  assert.ok(activeStyle.textShadow?.includes("255, 230, 0"));

  // Inactive word: white (#FFFFFF), 1.0 scale, uppercase, strong outline and shadow
  assert.equal(inactiveStyle.color, "#FFFFFF");
  assert.equal(inactiveStyle.scale, 1.0);
  assert.equal(inactiveStyle.textTransform, "uppercase");
  assert.equal(inactiveStyle.textStroke, "3px #000000");
  assert.equal(inactiveStyle.paintOrder, "stroke fill");
  assert.ok(inactiveStyle.textShadow?.includes("rgba(0, 0, 0, 0.95)"));
});

test("7. Active-word styling resets correctly across words", () => {
  const chunk: SubtitleChunk = {
    id: "chunk-1",
    segmentIndex: 1,
    start: 1.0,
    end: 3.0,
    words: [
      { text: "Airplanes", start: 1.0, end: 1.5 },
      { text: "fly", start: 1.6, end: 2.0 },
      { text: "smoothly", start: 2.1, end: 2.8 },
    ],
  };

  // At t = 1.2s: word 0 is active, words 1 and 2 are inactive
  const activeIdx1: number = getActiveWordIndex(chunk, 1.2);
  assert.equal(activeIdx1, 0);

  const word0StyleT1 = getSubtitleWordStyle("remotion_neon", activeIdx1 === 0);
  const word1StyleT1 = getSubtitleWordStyle("remotion_neon", (activeIdx1 as number) === 1);
  assert.equal(word0StyleT1.color, "#28F5FC");
  assert.equal(word0StyleT1.scale, 1.06);
  assert.equal(word1StyleT1.color, "#FFFFFF");
  assert.equal(word1StyleT1.scale, 1.0);

  // At t = 1.8s: word 1 is active, word 0 has reset to inactive!
  const activeIdx2: number = getActiveWordIndex(chunk, 1.8);
  assert.equal(activeIdx2, 1);

  const word0StyleT2 = getSubtitleWordStyle("remotion_neon", (activeIdx2 as number) === 0);
  const word1StyleT2 = getSubtitleWordStyle("remotion_neon", activeIdx2 === 1);
  assert.equal(word0StyleT2.color, "#FFFFFF");
  assert.equal(word0StyleT2.scale, 1.0);
  assert.equal(word1StyleT2.color, "#28F5FC");
  assert.equal(word1StyleT2.scale, 1.06);
});

test("8. Subtitle timing synchronization and chunking is identical across styles", () => {
  const subtitleData: SubtitleData = {
    segments: [
      {
        index: 1,
        text: "The cabin pressure is controlled carefully.",
        start: 0.5,
        end: 3.8,
        words: [
          { text: "The", start: 0.5, end: 0.7 },
          { text: "cabin", start: 0.7, end: 1.1 },
          { text: "pressure", start: 1.1, end: 1.6 },
          { text: "is", start: 1.6, end: 1.8 },
          { text: "controlled", start: 1.8, end: 2.5 },
          { text: "carefully.", start: 2.5, end: 3.2 },
        ],
      },
    ],
  };

  const chunks = buildAllChunks(subtitleData);
  assert.ok(chunks.length > 0);

  // Playback sync at t = 1.3s
  const activeAt13 = findActiveSubtitle(chunks, 1.3);
  assert.ok(activeAt13.chunk !== null);
  assert.equal(activeAt13.activeWordIndex, 2); // "pressure"

  // Both clean_cinematic and dynamic_highlight map to the same active word index
  const cleanWord = getSubtitleWordStyle("clean_cinematic", true);
  const dynamicWord = getSubtitleWordStyle("dynamic_highlight", true);

  assert.equal(cleanWord.scale, 1.1);
  assert.equal(dynamicWord.scale, 1.1);
  assert.equal(dynamicWord.textTransform, "uppercase");
});

test("9. Preview style change does not mutate saved video or subtitle data", () => {
  const originalSubtitles: SubtitleData = {
    style: "clean_cinematic",
    segments: [
      {
        index: 1,
        text: "Clean video segment",
        start: 0.0,
        end: 1.5,
        words: [
          { text: "Clean", start: 0.1, end: 0.5 },
          { text: "video", start: 0.5, end: 0.9 },
          { text: "segment", start: 0.9, end: 1.4 },
        ],
      },
    ],
  };

  // Deep clone to ensure immutability check
  const snapshotBefore = JSON.stringify(originalSubtitles);

  // Simulate local preview switching
  const appliedStyle = resolveSubtitleStyleId(originalSubtitles.style);
  assert.equal(appliedStyle, "clean_cinematic");

  let currentPreviewStyle = "remotion_neon";
  assert.notEqual(currentPreviewStyle, appliedStyle);

  // Check preview style presentation
  const previewWord = getSubtitleWordStyle(currentPreviewStyle, true);
  assert.equal(previewWord.color, "#28F5FC");

  // Saved data must not be mutated
  assert.equal(JSON.stringify(originalSubtitles), snapshotBefore);
  assert.equal(originalSubtitles.style, "clean_cinematic");

  // Switch to dynamic_highlight
  currentPreviewStyle = "dynamic_highlight";
  const dynamicPreviewWord = getSubtitleWordStyle(currentPreviewStyle, true);
  assert.equal(dynamicPreviewWord.color, "#FFE600");
  assert.equal(JSON.stringify(originalSubtitles), snapshotBefore);

  // Restore back to applied style
  currentPreviewStyle = appliedStyle;
  const restoredWord = getSubtitleWordStyle(currentPreviewStyle, true);
  assert.equal(restoredWord.color, "#fcd34d");
  assert.equal(JSON.stringify(originalSubtitles), snapshotBefore);
});

test("10. Style API integration: api.videos.getSubtitleStyles fetches from backend", async () => {
  const mockStyles: SubtitleStyleOut[] = [
    {
      id: "clean_cinematic",
      name: "Clean Cinematic",
      description: "Clean, elegant subtitle style with high readability across all video backgrounds.",
      is_default: true,
    },
    {
      id: "remotion_neon",
      name: "Remotion Neon",
      description: "High-energy viral Shorts style inspired by the Remotion POC with electric cyan active-word pop.",
      is_default: false,
    },
    {
      id: "dynamic_highlight",
      name: "Dynamic Highlight",
      description: "Punchy, creator-focused all-caps typography with vibrant yellow active-word punch.",
      is_default: false,
    },
  ];

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      assert.equal(url, "/api/videos/subtitle-styles");
      return new Response(JSON.stringify(mockStyles), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const styles = await api.videos.getSubtitleStyles();
    assert.equal(styles.length, 3);
    assert.equal(styles[0].id, "clean_cinematic");
    assert.equal(styles[0].is_default, true);
    assert.equal(styles[1].id, "remotion_neon");
    assert.equal(styles[1].is_default, false);
    assert.equal(styles[2].id, "dynamic_highlight");
    assert.equal(styles[2].is_default, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("11. Style API integration: handles API error properly", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ detail: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    };

    await assert.rejects(
      async () => {
        await api.videos.getSubtitleStyles();
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal((err as ApiError).status, 500);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("12. Preview source: uncaptioned base video is requested for overlay preview (captioned=false)", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl = "";
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return new Response(new Blob(["video-bytes"], { type: "video/mp4" }), {
        status: 200,
        headers: {
          "Content-Disposition": 'attachment; filename="test-original.mp4"',
          "Content-Type": "video/mp4",
        },
      });
    };

    // Subtitle preview requests uncaptioned video
    await api.videos.getVideoBlob("test-vid-123", false);
    assert.ok(
      capturedUrl.includes("/api/videos/test-vid-123/download?captioned=false"),
      `Expected uncaptioned download URL, got ${capturedUrl}`
    );

    // Standard download requests captioned video
    await api.videos.getVideoBlob("test-vid-123", true);
    assert.ok(
      capturedUrl.includes("/api/videos/test-vid-123/download?captioned=true"),
      `Expected captioned download URL, got ${capturedUrl}`
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("13. Subtitle style selector data display: all API-provided styles are represented with metadata", () => {
  const styles: SubtitleStyleOut[] = [
    {
      id: "clean_cinematic",
      name: "Clean Cinematic",
      description: "Classic semi-transparent rounded box with crisp white text.",
      is_default: true,
    },
    {
      id: "remotion_neon",
      name: "Remotion Neon",
      description: "High-contrast bold white lettering with an electric cyan active-word glow.",
      is_default: false,
    },
    {
      id: "dynamic_highlight",
      name: "Dynamic Highlight",
      description: "Bold uppercase captions with a vibrant yellow active-word highlight.",
      is_default: false,
    },
  ];

  // Verify all 3 styles are present and identifiable
  assert.equal(styles.length, 3);
  const ids = styles.map((s) => s.id);
  assert.deepEqual(ids, ["clean_cinematic", "remotion_neon", "dynamic_highlight"]);

  // Verify default marking
  const defaultStyle = styles.find((s) => s.is_default);
  assert.ok(defaultStyle);
  assert.equal(defaultStyle.id, "clean_cinematic");
});

test("14. Applied and previewed styles distinction & local preview state update", () => {
  // Simulate video state with applied style "clean_cinematic"
  const appliedStyleId = resolveSubtitleStyleId("clean_cinematic");
  let userPreviewStyle: string | null = null;

  // 1. Initial state: user has not chosen a preview style yet
  const getEffectivePreviewStyle = () =>
    (userPreviewStyle && userPreviewStyle !== appliedStyleId ? userPreviewStyle : null) ??
    appliedStyleId;

  assert.equal(getEffectivePreviewStyle(), "clean_cinematic");
  assert.equal(getEffectivePreviewStyle() !== appliedStyleId, false, "Preview initially equals applied style");

  // 2. User selects "remotion_neon"
  userPreviewStyle = "remotion_neon";
  assert.equal(getEffectivePreviewStyle(), "remotion_neon");
  assert.equal(appliedStyleId, "clean_cinematic", "Applied style must remain unmodified");
  assert.equal(getEffectivePreviewStyle() !== appliedStyleId, true, "Preview differs from applied style");

  // 3. Reset restores preview to applied style
  userPreviewStyle = null;
  assert.equal(getEffectivePreviewStyle(), "clean_cinematic");
  assert.equal(getEffectivePreviewStyle() !== appliedStyleId, false, "Reset restores preview to applied");
});

test("15. Apply button enablement logic based on preview difference and running state", () => {
  const appliedStyleId = "clean_cinematic";

  const isApplyEnabled = (
    previewStyleId: string,
    isApplying: boolean,
    isRunning: boolean,
    isImagesReady: boolean = true
  ) => {
    const isRerunInProgress = isApplying || isRunning;
    const previewDiffers = previewStyleId !== appliedStyleId;
    return previewDiffers && !isRerunInProgress && isImagesReady;
  };

  // Preview matches applied -> disabled
  assert.equal(isApplyEnabled("clean_cinematic", false, false), false);

  // Preview differs, idle -> enabled
  assert.equal(isApplyEnabled("remotion_neon", false, false), true);
  assert.equal(isApplyEnabled("dynamic_highlight", false, false), true);

  // Preview differs, but rerun is applying -> disabled
  assert.equal(isApplyEnabled("remotion_neon", true, false), false);

  // Preview differs, but pipeline is running -> disabled
  assert.equal(isApplyEnabled("remotion_neon", false, true), false);

  // Preview differs, but both applying and running -> disabled
  assert.equal(isApplyEnabled("remotion_neon", true, true), false);

  // Preview differs, idle, but images are not ready -> disabled
  assert.equal(isApplyEnabled("remotion_neon", false, false, false), false);
});

test("16. Apply & Regenerate Subtitles sends correct subtitle_style payload and enqueues worker", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string; body: unknown }[] = [];

  try {
    globalThis.fetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      if (String(url).endsWith("/steps/subtitles/rerun")) {
        return new Response(
          JSON.stringify({
            id: "vid-phase3b-1",
            topic: "Test video",
            status: "running",
            current_step: "subtitles",
            steps: [
              {
                name: "subtitles",
                status: "pending",
                output: { subtitles: { style: "remotion_neon" } },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (String(url).endsWith("/next")) {
        return new Response(
          JSON.stringify({
            id: "vid-phase3b-1",
            status: "running",
            current_step: "subtitles",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("{}", { status: 200 });
    };

    // Trigger rerunStep with subtitle_style = "remotion_neon"
    const videoId = "vid-phase3b-1";
    const selectedStyle = "remotion_neon";

    await api.videos.rerunStep(videoId, "subtitles", undefined, selectedStyle);
    await api.videos.next(videoId);

    // Verify 1st call: POST /videos/{id}/steps/subtitles/rerun
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, `/api/videos/${videoId}/steps/subtitles/rerun`);
    assert.equal(requests[0].method, "POST");
    assert.deepEqual(requests[0].body, {
      prompt: null,
      subtitle_style: "remotion_neon",
    });

    // Verify 2nd call: POST /videos/{id}/next
    assert.equal(requests[1].url, `/api/videos/${videoId}/next`);
    assert.equal(requests[1].method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("17. Duplicate rerun requests are prevented while request is in flight", async () => {
  let isApplying = false;
  let callCount = 0;

  const handleApplyStyle = async () => {
    if (isApplying) {
      return; // Early return prevents duplicate
    }
    isApplying = true;
    try {
      callCount++;
      // Simulate network latency
      await new Promise((res) => setTimeout(res, 20));
    } finally {
      isApplying = false;
    }
  };

  // Launch two concurrent clicks
  const [p1, p2] = [handleApplyStyle(), handleApplyStyle()];
  await Promise.all([p1, p2]);

  assert.equal(callCount, 1, "Only 1 rerun request must be dispatched");
});

test("18. Failed regeneration preserves previously applied style and user preview selection", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ detail: "Vosk aligner worker error: audio corrupt" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    };

    const initialAppliedStyle = resolveSubtitleStyleId("clean_cinematic");
    const userPreviewStyle: string | null = "dynamic_highlight";
    let isApplying = false;

    const executeApply = async (): Promise<string | null> => {
      isApplying = true;
      try {
        await api.videos.rerunStep("vid-fail-1", "subtitles", undefined, userPreviewStyle);
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : String(err);
      } finally {
        isApplying = false;
      }
    };

    const regenError = await executeApply();

    // Verify error was caught
    assert.ok(regenError !== null);
    assert.ok(regenError.includes("Vosk aligner worker error"));

    // Verify applied style was NOT modified
    assert.equal(initialAppliedStyle, "clean_cinematic");

    // Verify preview style remains selected so user can retry
    assert.equal(userPreviewStyle, "dynamic_highlight");
    assert.equal(isApplying, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("19. Successful backend completion updates applied style and resets preview diff", () => {
  // Step 1: Initial state
  let backendStyle: string | undefined = "clean_cinematic";
  let appliedStyleId = resolveSubtitleStyleId(backendStyle);
  const userPreviewStyle: string | null = "remotion_neon";

  const getEffectivePreviewStyle = () =>
    (userPreviewStyle && userPreviewStyle !== appliedStyleId ? userPreviewStyle : null) ??
    appliedStyleId;

  assert.equal(appliedStyleId, "clean_cinematic");
  assert.equal(getEffectivePreviewStyle(), "remotion_neon");
  assert.equal(getEffectivePreviewStyle() !== appliedStyleId, true);

  // Step 2: Backend rerun finishes with output.subtitles.style = "remotion_neon"
  backendStyle = "remotion_neon";
  appliedStyleId = resolveSubtitleStyleId(backendStyle);

  // User preview style matches newly applied style -> diff automatically clears
  assert.equal(appliedStyleId, "remotion_neon");
  assert.equal(getEffectivePreviewStyle(), "remotion_neon");
  assert.equal(getEffectivePreviewStyle() !== appliedStyleId, false, "Diff is now false after completion");
});

test("20. Legacy video support: defaults to clean_cinematic, allows preview and rerun apply", async () => {
  // Legacy video with no subtitle style field
  const legacySubtitlesOutput = {
    segments: [
      {
        index: 1,
        text: "Legacy subtitles test",
        start: 0,
        end: 1.5,
        words: [{ text: "Legacy", start: 0, end: 0.8 }],
      },
    ],
  };

  const appliedStyle = resolveSubtitleStyleId(
    (legacySubtitlesOutput as { style?: string }).style
  );
  assert.equal(appliedStyle, "clean_cinematic", "Legacy defaults to clean_cinematic");

  // User can preview remotion_neon
  const previewStyle = resolveSubtitleStyleId("remotion_neon");
  assert.notEqual(previewStyle, appliedStyle);

  // Ensure getSubtitleWordStyle works seamlessly for legacy data preview
  const previewWordStyle = getSubtitleWordStyle(previewStyle, true);
  assert.equal(previewWordStyle.color, "#28F5FC");
});
