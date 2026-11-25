import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/lib/api.ts";
import {
  DEFAULT_VISUAL_STYLE_ID,
  type VisualStyleId,
  type VisualStylesListOut,
  type VideoCreate,
  type VideoSummary,
  type VideoDetail,
  type VideoStyleUpdate,
} from "../src/lib/types.ts";

// ============================================================================
// 1. Visual-Style Catalog Response Typing and API Path
// ============================================================================

test("1. DEFAULT_VISUAL_STYLE_ID points to legacy_default", () => {
  assert.equal(DEFAULT_VISUAL_STYLE_ID, "legacy_default");
});

test("2. VisualStyleId accepts exactly the three canonical backend presets", () => {
  const validStyles: VisualStyleId[] = [
    "legacy_default",
    "stickman_tactical_explainer",
    "stylized_2d_narrative",
  ];
  assert.equal(validStyles.length, 3);
  assert.deepEqual(validStyles, [
    "legacy_default",
    "stickman_tactical_explainer",
    "stylized_2d_narrative",
  ]);
});

test("3. api.visualStyles.list calls GET /api/visual-styles with skipAuth", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string; headers: Headers }[] = [];

  const mockResponse: VisualStylesListOut = {
    default_style_id: "legacy_default",
    styles: [
      {
        id: "legacy_default",
        name: "Clean 3D Studio (Default)",
        version: 1,
        category: "3d_render",
        description: "Smooth stylized 3D matte characters and objects.",
        preview_image_path: "previews/legacy_default.jpg",
        is_default: true,
      },
      {
        id: "stickman_tactical_explainer",
        name: "Stickman Tactical Explainer",
        version: 1,
        category: "illustrated_2d",
        description: "Minimalist white circular-head stick figures.",
        preview_image_path: "previews/stickman_tactical.jpg",
        is_default: false,
      },
      {
        id: "stylized_2d_narrative",
        name: "Stylized 2D Narrative Drama",
        version: 1,
        category: "illustrated_2d",
        description: "Expressive chibi-stick cartoon figures.",
        preview_image_path: "previews/stylized_2d.jpg",
        is_default: false,
      },
    ],
  };

  try {
    globalThis.fetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: init?.method || "GET",
        headers: new Headers(init?.headers),
      });

      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await api.visualStyles.list();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/visual-styles");
    assert.equal(requests[0].method, "GET");
    // Public endpoint: skipAuth means no Authorization header is attached
    assert.equal(requests[0].headers.get("Authorization"), null);

    // Verify response schema
    assert.equal(result.default_style_id, "legacy_default");
    assert.equal(result.styles.length, 3);
    assert.equal(result.styles[0].id, "legacy_default");
    assert.equal(result.styles[0].is_default, true);
    assert.equal(result.styles[1].id, "stickman_tactical_explainer");
    assert.equal(result.styles[2].id, "stylized_2d_narrative");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// 2. Video Creation Supports Optional visual_style_id
// ============================================================================

test("4. api.videos.create sends visual_style_id when provided", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string; body: unknown }[] = [];

  const channelId = "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c";
  const newVideo: VideoCreate = {
    topic: "Why Do We Shiver When Cold?",
    description: "Explain biological thermoregulation",
    visual_style_id: "stickman_tactical_explainer",
  };

  const mockResponse: VideoSummary = {
    id: "vid-style-1",
    channel_id: channelId,
    topic: "Why Do We Shiver When Cold?",
    description: "Explain biological thermoregulation",
    status: "draft",
    visual_style_id: "stickman_tactical_explainer",
    visual_style_version: 1,
    created_at: new Date().toISOString(),
  };

  try {
    globalThis.fetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return new Response(JSON.stringify(mockResponse), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await api.videos.create(channelId, newVideo);

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `/api/channels/${channelId}/videos`);
    assert.equal(requests[0].method, "POST");
    assert.deepEqual(requests[0].body, {
      topic: "Why Do We Shiver When Cold?",
      description: "Explain biological thermoregulation",
      visual_style_id: "stickman_tactical_explainer",
    });

    assert.equal(result.visual_style_id, "stickman_tactical_explainer");
    assert.equal(result.visual_style_version, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("5. api.videos.create without visual_style_id remains fully supported", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string; body: unknown }[] = [];

  const channelId = "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c";
  const newVideo: VideoCreate = {
    topic: "Ancient Roman Aqueducts",
  };

  const mockResponse: VideoSummary = {
    id: "vid-style-2",
    channel_id: channelId,
    topic: "Ancient Roman Aqueducts",
    description: null,
    status: "draft",
    visual_style_id: "legacy_default",
    visual_style_version: 1,
    created_at: new Date().toISOString(),
  };

  try {
    globalThis.fetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return new Response(JSON.stringify(mockResponse), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await api.videos.create(channelId, newVideo);

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `/api/channels/${channelId}/videos`);
    assert.equal(requests[0].method, "POST");
    assert.deepEqual(requests[0].body, {
      topic: "Ancient Roman Aqueducts",
    });

    assert.equal(result.topic, "Ancient Roman Aqueducts");
    assert.equal(result.visual_style_id, "legacy_default");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// 3. Video Style Update Uses Correct PATCH Path and Request Body
// ============================================================================

test("6. api.videos.updateVisualStyle sends PATCH /api/videos/{id}/visual-style with correct body", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string; body: unknown; headers: Headers }[] = [];

  const videoId = "vid-patch-style-1";
  const targetStyle: VisualStyleId = "stylized_2d_narrative";

  const mockResponse: VideoDetail = {
    id: videoId,
    channel_id: "chan-1",
    topic: "Microbiology Deep Dive",
    description: "Cellular mitosis in action",
    status: "in_progress",
    visual_style_id: "stylized_2d_narrative",
    visual_style_version: 1,
    visual_style_snapshot: {
      id: "stylized_2d_narrative",
      version: 1,
      display_name: "Stylized 2D Narrative Drama",
      category: "illustrated_2d",
    },
    created_at: new Date().toISOString(),
    steps: [
      {
        name: "script",
        position: 1,
        status: "done",
        output: { script: { narration: "Cells divide..." } },
        user_prompt: null,
        error: null,
        started_at: null,
        finished_at: null,
      },
      {
        name: "images",
        position: 3,
        status: "stale",
        output: null,
        user_prompt: null,
        error: null,
        started_at: null,
        finished_at: null,
      },
    ],
  };

  try {
    globalThis.fetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(String(init.body)) : null,
        headers: new Headers(init?.headers),
      });

      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await api.videos.updateVisualStyle(videoId, targetStyle);

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `/api/videos/${videoId}/visual-style`);
    assert.equal(requests[0].method, "PATCH");
    assert.equal(requests[0].headers.get("Content-Type"), "application/json");
    assert.deepEqual(requests[0].body, {
      visual_style_id: "stylized_2d_narrative",
    });

    assert.equal(result.id, videoId);
    assert.equal(result.visual_style_id, "stylized_2d_narrative");
    assert.equal(result.visual_style_version, 1);
    assert.ok(result.visual_style_snapshot !== null);
    assert.equal(result.visual_style_snapshot?.id, "stylized_2d_narrative");
    assert.equal(result.steps.find((s) => s.name === "images")?.status, "stale");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// 4. Legacy Videos with Null Style Fields Remain Compatible
// ============================================================================

test("7. Legacy videos with null/undefined style fields are fully type-compatible", () => {
  const legacySummary: VideoSummary = {
    id: "legacy-vid-1",
    channel_id: "chan-legacy",
    topic: "Legacy Video Created Before Visual Styles",
    description: null,
    status: "completed",
    visual_style_id: null,
    visual_style_version: null,
    created_at: "2026-10-01T12:00:00Z",
  };

  assert.equal(legacySummary.visual_style_id, null);
  assert.equal(legacySummary.visual_style_version, null);

  const legacyDetail: VideoDetail = {
    ...legacySummary,
    visual_style_snapshot: null,
    steps: [],
  };

  assert.equal(legacyDetail.visual_style_snapshot, null);
  assert.equal(legacyDetail.steps.length, 0);

  // Can safely check if a video has a custom visual style or uses legacy fallback
  const isCustomStyle =
    Boolean(legacyDetail.visual_style_id) &&
    legacyDetail.visual_style_id !== DEFAULT_VISUAL_STYLE_ID;
  assert.equal(isCustomStyle, false);
});

test("8. VideoStyleUpdate type matches backend expectation", () => {
  const updatePayload: VideoStyleUpdate = {
    visual_style_id: "stickman_tactical_explainer",
  };
  assert.equal(updatePayload.visual_style_id, "stickman_tactical_explainer");
});
