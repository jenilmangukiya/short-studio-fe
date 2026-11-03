import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBeatSegmentGeometry,
  computeSceneTrackGeometry,
  computeTimelineMetrics,
  correlateBeatsWithTelemetry,
  getTimelineTelemetryDisplay,
  getTimelineTimingBadge,
  resolveCorrelatedBeatTiming,
  updateSceneInList,
} from "../src/lib/storyboard.ts";
import type {
  RenderData,
  StoryboardScene,
  VoiceoverItem,
} from "../src/lib/types.ts";

test("1. computeTimelineMetrics: Empty timeline data returns null duration and false continuous timing", () => {
  const emptyMetrics1 = computeTimelineMetrics([]);
  assert.equal(emptyMetrics1.effectiveTotalDuration, null);
  assert.equal(emptyMetrics1.hasContinuousTiming, false);
  assert.equal(emptyMetrics1.totalBeatsCount, 0);
  assert.equal(emptyMetrics1.rulerTicks.length, 0);

  // Null / undefined safety
  const emptyMetrics2 = computeTimelineMetrics(null as unknown as []);
  assert.equal(emptyMetrics2.effectiveTotalDuration, null);
  assert.equal(emptyMetrics2.hasContinuousTiming, false);
});

test("2. computeTimelineMetrics: Multiple scenes and multiple beats compute exact counts and ruler ticks", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 5.0,
      visual_beats: [
        { id: "b1_1", order: 1, narration_text: "Beat 1.1", start_time: 0.0, end_time: 2.5, timing_type: "aligned" },
        { id: "b1_2", order: 2, narration_text: "Beat 1.2", start_time: 2.5, end_time: 5.0, timing_type: "aligned" },
      ],
    },
    {
      index: 2,
      narration: "Scene 2",
      image_prompt: "P2",
      shot_type: "close-up",
      est_seconds: 5.0,
      visual_beats: [
        { id: "b2_1", order: 1, narration_text: "Beat 2.1", start_time: 5.0, end_time: 7.5, timing_type: "aligned" },
        { id: "b2_2", order: 2, narration_text: "Beat 2.2", start_time: 7.5, end_time: 10.0, timing_type: "aligned" },
      ],
    },
  ];

  const correlation = correlateBeatsWithTelemetry({ scenes });
  const metrics = computeTimelineMetrics(correlation.scenes);

  assert.equal(metrics.totalBeatsCount, 4);
  assert.equal(metrics.timedBeatsCount, 4);
  assert.equal(metrics.pendingBeatsCount, 0);
  assert.equal(metrics.effectiveTotalDuration, 10.0);
  assert.equal(metrics.hasContinuousTiming, true);

  // Ruler ticks at 0%, 25%, 50%, 75%, 100%
  assert.equal(metrics.rulerTicks.length, 5);
  assert.equal(metrics.rulerTicks[0].percent, 0);
  assert.equal(metrics.rulerTicks[0].timestamp, "00:00.00");
  assert.equal(metrics.rulerTicks[2].percent, 50);
  assert.equal(metrics.rulerTicks[2].timestamp, "00:05.00");
  assert.equal(metrics.rulerTicks[4].percent, 100);
  assert.equal(metrics.rulerTicks[4].timestamp, "00:10.00");
});

test("3. computeBeatSegmentGeometry: Actual rendered timing, frames, and linear percentages", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 10.0,
      visual_beats: [
        { id: "b1", order: 1, narration_text: "Rendered beat text" },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "beat",
    beats_rendered: 1,
    animations: [
      {
        scene_index: 1,
        beat_id: "b1",
        beat_order: 1,
        render_mode: "beat",
        start_time: 0.0,
        end_time: 2.5,
        frames: 75,
        duration_seconds: 2.5,
        animation_type: "zoom-in",
      },
    ],
  };

  const correlation = correlateBeatsWithTelemetry({ scenes, renderData });
  const beatItem = correlation.scenes[0].beats[0];
  const geometry = computeBeatSegmentGeometry(beatItem, 10.0);

  // Linear geometry: 0.0 to 2.5 out of 10.0s -> left: 0%, width: 25%
  assert.equal(geometry.leftPercent, 0);
  assert.equal(geometry.widthPercent, 25);
  assert.equal(geometry.durationSeconds, 2.5);
  assert.equal(geometry.isPending, false);

  // Telemetry display & frames
  assert.equal(geometry.telemetryDisplay.status, "rendered");
  assert.equal(geometry.telemetryDisplay.label, "Rendered");
  assert.ok(geometry.telemetryDisplay.accessibleText.includes("75 frames"));

  // Timing badge
  assert.equal(geometry.timingBadge.label, "Executed (75f)");
});

test("4. computeBeatSegmentGeometry: Voiceover-aligned and proportional timing badges", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 6.0,
      visual_beats: [
        {
          id: "b1",
          order: 1,
          narration_text: "Aligned beat",
          start_time: 0.0,
          end_time: 3.0,
          timing_type: "aligned",
        },
        {
          id: "b2",
          order: 2,
          narration_text: "Proportional beat",
          start_time: 3.0,
          end_time: 6.0,
          timing_type: "fallback_proportional",
        },
      ],
    },
  ];

  const correlation = correlateBeatsWithTelemetry({ scenes });

  // Beat 1: Aligned
  const geom1 = computeBeatSegmentGeometry(correlation.scenes[0].beats[0], 6.0);
  assert.equal(geom1.timingBadge.label, "Word-Aligned");
  assert.equal(geom1.leftPercent, 0);
  assert.equal(geom1.widthPercent, 50);

  // Beat 2: Proportional
  const geom2 = computeBeatSegmentGeometry(correlation.scenes[0].beats[1], 6.0);
  assert.equal(geom2.timingBadge.label, "Proportional (est)");
  assert.ok(geom2.formattedInterval.includes("(proportional)"));
  assert.equal(geom2.leftPercent, 50);
  assert.equal(geom2.widthPercent, 50);
});

test("5. computeBeatSegmentGeometry: Storyboard planned timing is distinguished from executed timing", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [
        {
          id: "b1",
          order: 1,
          narration_text: "Planned beat",
          start_time: 0.0,
          end_time: 4.0,
          timing_type: "estimated",
        },
      ],
    },
  ];

  const correlation = correlateBeatsWithTelemetry({ scenes });
  const geom = computeBeatSegmentGeometry(correlation.scenes[0].beats[0], 4.0);

  assert.equal(geom.timingBadge.label, "estimated");
  assert.ok(geom.timingBadge.accessibleText.includes("Storyboard planned timing"));
  assert.ok(!geom.timingBadge.label.includes("Executed"));
});

test("6. computeBeatSegmentGeometry: Pending beats receive NO fabricated timestamps or widths", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 5.0,
      visual_beats: [
        {
          id: "pending_b1",
          order: 1,
          narration_text: "Pending beat",
          timing_type: "unassigned",
        },
      ],
    },
  ];

  const correlation = correlateBeatsWithTelemetry({ scenes });
  const geom = computeBeatSegmentGeometry(correlation.scenes[0].beats[0], 10.0);

  assert.equal(geom.isPending, true);
  assert.equal(geom.leftPercent, null, "Pending beat must NOT have a fabricated leftPercent");
  assert.equal(geom.widthPercent, null, "Pending beat must NOT have a fabricated widthPercent");
  assert.equal(geom.timingBadge.label, "Pending voiceover");
});

test("7. computeBeatSegmentGeometry: Scene-level fallback records are NEVER falsely marked as rendered", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 6.0,
      visual_beats: [
        {
          id: "b1_1",
          order: 1,
          narration_text: "Beat 1.1",
          start_time: 0.0,
          end_time: 3.0,
          timing_type: "aligned",
        },
        {
          id: "b1_2",
          order: 2,
          narration_text: "Beat 1.2",
          start_time: 3.0,
          end_time: 6.0,
          timing_type: "aligned",
        },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "scene",
    beat_fallback_reasons: {
      "1": "Ken Burns crop out of bounds",
    },
    animations: [
      {
        scene_index: 1,
        render_mode: "scene",
        animation_type: "zoom-in",
        fallback_applied: true,
        fallback_reason: "Ken Burns crop out of bounds",
      },
    ],
  };

  const correlation = correlateBeatsWithTelemetry({ scenes, renderData });

  // Scene track geometry
  const scGeom = computeSceneTrackGeometry(correlation.scenes[0], 6.0);
  assert.equal(scGeom.hasFallback, true);
  assert.equal(scGeom.fallbackReason, "Ken Burns crop out of bounds");

  // Child beats geometry
  const b1Geom = computeBeatSegmentGeometry(correlation.scenes[0].beats[0], 6.0);
  const b2Geom = computeBeatSegmentGeometry(correlation.scenes[0].beats[1], 6.0);

  assert.equal(b1Geom.telemetryDisplay.status, "scene_fallback");
  assert.equal(b1Geom.telemetryDisplay.label, "Scene Fallback");
  assert.ok(b1Geom.telemetryDisplay.accessibleText.includes("Ken Burns crop out of bounds"));
  assert.notEqual(b1Geom.telemetryDisplay.status, "rendered", "Must NOT claim fallback beat was rendered");

  assert.equal(b2Geom.telemetryDisplay.status, "scene_fallback");
  assert.notEqual(b2Geom.telemetryDisplay.status, "rendered");
});

test("8. Unavailable and stale telemetry are accurately distinguished", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [
        {
          id: "b1",
          order: 1,
          narration_text: "Beat 1",
          start_time: 0.0,
          end_time: 4.0,
          timing_type: "aligned",
        },
      ],
    },
  ];

  // 1. Unavailable
  const corrUnavailable = correlateBeatsWithTelemetry({ scenes, renderData: null });
  const geomUnavailable = computeBeatSegmentGeometry(corrUnavailable.scenes[0].beats[0], 4.0);
  assert.equal(geomUnavailable.telemetryDisplay.status, "unavailable");
  assert.equal(geomUnavailable.telemetryDisplay.label, "Not Rendered");

  // 2. Stale
  const staleRenderData: RenderData = {
    render_mode: "beat",
    animations: [
      {
        scene_index: 1,
        beat_id: "b1",
        beat_order: 1,
        render_mode: "beat",
        start_time: 0.0,
        end_time: 4.0,
        frames: 120,
      },
    ],
  };
  const corrStale = correlateBeatsWithTelemetry({
    scenes,
    renderData: staleRenderData,
    isRenderStale: true,
  });
  const geomStale = computeBeatSegmentGeometry(corrStale.scenes[0].beats[0], 4.0);
  assert.equal(geomStale.telemetryDisplay.status, "stale");
  assert.equal(geomStale.telemetryDisplay.label, "Stale Render");
  assert.ok(geomStale.telemetryDisplay.accessibleText.includes("Stale"));
});

test("9. computeSceneTrackGeometry: Legacy scenes without visual beats derive scene bounds cleanly", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Legacy scene narration without visual beats",
      image_prompt: "Prompt 1",
      shot_type: "wide",
      est_seconds: 5.5,
      start_time: 0.0,
      end_time: 5.5,
    },
  ];

  const correlation = correlateBeatsWithTelemetry({ scenes });
  const scGeom = computeSceneTrackGeometry(correlation.scenes[0], 10.0);

  assert.equal(scGeom.sceneIndex, 1);
  assert.equal(scGeom.startTime, 0.0);
  assert.equal(scGeom.endTime, 5.5);
  assert.equal(scGeom.durationSeconds, 5.5);
  assert.equal(scGeom.leftPercent, 0);
  assert.equal(scGeom.widthPercent, 55);
  assert.equal(scGeom.hasFallback, false);
});

test("10. Short or narrow segments preserve linear time proportion without distortion", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 20.0,
      visual_beats: [
        {
          id: "short_beat",
          order: 1,
          narration_text: "Very short beat",
          start_time: 0.0,
          end_time: 0.2, // 0.2s out of 20s = 1.0%
          timing_type: "aligned",
        },
        {
          id: "long_beat",
          order: 2,
          narration_text: "Long beat",
          start_time: 0.2,
          end_time: 20.0, // 19.8s out of 20s = 99.0%
          timing_type: "aligned",
        },
      ],
    },
  ];

  const correlation = correlateBeatsWithTelemetry({ scenes });

  // 0.2s out of 20.0s -> exact 1.0%
  const geomShort = computeBeatSegmentGeometry(correlation.scenes[0].beats[0], 20.0);
  assert.equal(geomShort.leftPercent, 0);
  assert.equal(geomShort.widthPercent, 1.0);

  // 19.8s out of 20.0s -> exact 99.0%
  const geomLong = computeBeatSegmentGeometry(correlation.scenes[0].beats[1], 20.0);
  assert.equal(geomLong.leftPercent, 1.0);
  assert.equal(geomLong.widthPercent, 99.0);
});

test("11. getTimelineTelemetryDisplay and getTimelineTimingBadge provide accessible text not relying on color alone", () => {
  // Rendered
  const telRendered = getTimelineTelemetryDisplay({
    status: "rendered",
    sceneIndex: 1,
    beatId: "b1",
    beatOrder: 1,
    frames: 90,
    durationSeconds: 3.0,
    animation: { scene_index: 1 },
    isStale: false,
  });
  assert.equal(telRendered.icon, "✓");
  assert.ok(telRendered.accessibleText.includes("Rendered: executed by video renderer (90 frames)"));

  // Scene Fallback
  const telFallback = getTimelineTelemetryDisplay({
    status: "scene_fallback",
    sceneIndex: 1,
    beatId: "b1",
    beatOrder: 1,
    fallbackReason: "Feasibility check failed",
    isStale: false,
  });
  assert.equal(telFallback.icon, "⚠️");
  assert.ok(telFallback.accessibleText.includes("Feasibility check failed"));

  // Stale
  const telStale = getTimelineTelemetryDisplay({
    status: "stale",
    sceneIndex: 1,
    beatId: "b1",
    beatOrder: 1,
    previousStatus: "rendered",
    isStale: true,
  });
  assert.equal(telStale.icon, "🔄");
  assert.ok(telStale.accessibleText.includes("outdated"));

  // Pending Timing
  const tbPending = getTimelineTimingBadge({
    source: "pending",
    startTime: null,
    endTime: null,
    durationSeconds: null,
    timingType: "unassigned",
    formattedInterval: "Pending voiceover",
    isExecuted: false,
    isPending: true,
    isFallback: false,
  });
  assert.equal(tbPending.label, "Pending voiceover");
  assert.equal(tbPending.icon, "⏱️");
});

test("12. Stage 3.5.5.4 (Req 1): Storyboard view receives and displays correct correlation data", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "A quick glimpse into space.",
      image_prompt: "Galactic nebula",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [
        { id: "b1", order: 1, narration_text: "A quick glimpse", visual_description: "Nebula cloud" },
        { id: "b2", order: 2, narration_text: "into space", visual_description: "Stars zooming" },
      ],
    },
  ];

  // Storyboard step without voiceover or render data
  const correlation = correlateBeatsWithTelemetry({ scenes });

  assert.equal(correlation.scenes.length, 1);
  assert.equal(correlation.scenes[0].beats.length, 2);
  assert.equal(correlation.totalBeatsCount, 2);
  assert.equal(correlation.renderedBeatsCount, 0);
  assert.equal(correlation.fallbackBeatsCount, 0);
  assert.equal(correlation.beatTelemetry.get("b1")?.status, "unavailable");
  assert.equal(correlation.beatTelemetry.get("b2")?.status, "unavailable");
});

test("13. Stage 3.5.5.4 (Req 2): Voiceover alignment updates the timeline", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "A quick glimpse into space.",
      image_prompt: "Galactic nebula",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [
        { id: "b1", order: 1, narration_text: "A quick glimpse", timing_type: "unassigned" },
        { id: "b2", order: 2, narration_text: "into space", timing_type: "unassigned" },
      ],
    },
  ];

  // Before voiceover: beats are pending
  const beforeVO = correlateBeatsWithTelemetry({ scenes });
  const metricsBefore = computeTimelineMetrics(beforeVO.scenes);
  assert.equal(metricsBefore.pendingBeatsCount, 2);
  assert.equal(metricsBefore.hasContinuousTiming, false);

  // After voiceover completes: word alignment continuous timestamps are provided
  const voiceoverItems: VoiceoverItem[] = [
    {
      index: 1,
      scene_index: 1,
      scene_id: 1,
      narration: "A quick glimpse into space.",
      status: "ok",
      reused: false,
      audio_file: "scene_1.wav",
      duration_seconds: 4.2,
      visual_beats: [
        { id: "b1", order: 1, narration_text: "A quick glimpse", start_time: 0.0, end_time: 1.8, timing_type: "aligned" },
        { id: "b2", order: 2, narration_text: "into space", start_time: 1.8, end_time: 4.2, timing_type: "aligned" },
      ],
    },
  ];

  const afterVO = correlateBeatsWithTelemetry({ scenes, voiceoverItems });
  const metricsAfter = computeTimelineMetrics(afterVO.scenes);
  assert.equal(metricsAfter.pendingBeatsCount, 0);
  assert.equal(metricsAfter.timedBeatsCount, 2);
  assert.equal(metricsAfter.hasContinuousTiming, true);
  assert.equal(metricsAfter.effectiveTotalDuration, 4.2);

  const b1Timing = resolveCorrelatedBeatTiming(afterVO.scenes[0].beats[0]);
  assert.equal(b1Timing.source, "voiceover");
  assert.equal(b1Timing.timingType, "aligned");
  assert.equal(b1Timing.startTime, 0.0);
  assert.equal(b1Timing.endTime, 1.8);
});

test("14. Stage 3.5.5.4 (Req 3): Render execution timing takes precedence when valid", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Narrate beat 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 3.0,
      visual_beats: [
        { id: "b1", order: 1, narration_text: "Narrate beat 1", start_time: 0.0, end_time: 3.0, timing_type: "estimated" },
      ],
    },
  ];

  const voiceoverItems: VoiceoverItem[] = [
    {
      index: 1,
      scene_index: 1,
      narration: "Narrate beat 1",
      status: "ok",
      reused: false,
      audio_file: "scene_1.wav",
      duration_seconds: 3.2,
      visual_beats: [
        { id: "b1", order: 1, narration_text: "Narrate beat 1", start_time: 0.1, end_time: 3.1, timing_type: "aligned" },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "visual_beats",
    animations: [
      {
        scene_index: 1,
        beat_id: "b1",
        beat_order: 1,
        animation_type: "zoom-in",
        start_time: 0.12,
        end_time: 3.08,
        frames: 89,
        duration_seconds: 2.96,
      },
    ],
  };

  const correlation = correlateBeatsWithTelemetry({ scenes, voiceoverItems, renderData });
  const beatItem = correlation.scenes[0].beats[0];
  const timing = resolveCorrelatedBeatTiming(beatItem);

  assert.equal(timing.source, "render");
  assert.equal(timing.isExecuted, true);
  assert.equal(timing.startTime, 0.12);
  assert.equal(timing.endTime, 3.08);
  assert.equal(timing.frames, 89);
  assert.equal(correlation.renderedBeatsCount, 1);
});

test("15. Stage 3.5.5.4 (Req 4): Scene-level fallback remains a parent-scene status", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 3.0,
      visual_beats: [
        { id: "b1_1", order: 1, narration_text: "Beat 1" },
        { id: "b1_2", order: 2, narration_text: "Beat 2" },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "visual_beats",
    animations: [
      {
        scene_index: 1,
        animation_type: "ken-burns",
        beat_fallback_reason: "Word alignment missing for scene 1",
      },
    ],
  };

  const correlation = correlateBeatsWithTelemetry({ scenes, renderData });

  // Parent scene fallback is indexed
  assert.equal(correlation.sceneFallbacks.has(1), true);
  assert.equal(correlation.sceneFallbacks.get(1), "Word alignment missing for scene 1");

  // Child beats have fallback status, NOT rendered
  assert.equal(correlation.renderedBeatsCount, 0);
  assert.equal(correlation.fallbackBeatsCount, 2);
  for (const beat of correlation.scenes[0].beats) {
    assert.equal(beat.telemetry.status, "scene_fallback");
    assert.notEqual(beat.telemetry.status, "rendered");
  }
});

test("16. Stage 3.5.5.4 (Req 5): Missing telemetry remains unavailable", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 3.0,
      visual_beats: [{ id: "b1", order: 1, narration_text: "Beat 1" }],
    },
  ];

  // Render output has animations for scene 2 only
  const renderData: RenderData = {
    render_mode: "visual_beats",
    animations: [
      { scene_index: 2, beat_id: "other", animation_type: "zoom-in" },
    ],
  };

  const correlation = correlateBeatsWithTelemetry({ scenes, renderData });
  const beatItem = correlation.scenes[0].beats[0];

  assert.equal(beatItem.telemetry.status, "unavailable");
  assert.notEqual(beatItem.telemetry.status, "scene_fallback");
  assert.notEqual(beatItem.telemetry.status, "rendered");
});

test("17. Stage 3.5.5.4 (Req 6): Stale render data is not presented as current execution", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Revised narration",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 3.0,
      visual_beats: [
        { id: "b1", order: 1, narration_text: "Revised beat", start_time: 0.0, end_time: 3.0, timing_type: "estimated" },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "visual_beats",
    animations: [
      { scene_index: 1, beat_id: "b1", animation_type: "zoom-in", start_time: 0.0, end_time: 2.5, frames: 75 },
    ],
  };

  // Upstream revision marked render as stale
  const correlation = correlateBeatsWithTelemetry({ scenes, renderData, isRenderStale: true });
  const beatItem = correlation.scenes[0].beats[0];

  assert.equal(correlation.isRenderStale, true);
  assert.equal(beatItem.telemetry.status, "stale");
  assert.equal(correlation.renderedBeatsCount, 0); // Not counted as active rendered count

  // Timing resolution falls back from stale render to storyboard/voiceover
  const timing = resolveCorrelatedBeatTiming(beatItem);
  assert.notEqual(timing.source, "render");
  assert.equal(timing.isExecuted, false);
});

test("18. Stage 3.5.5.4 (Req 7): Legacy scenes without visual beats still render correctly", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Legacy scene 1",
      image_prompt: "Prompt 1",
      shot_type: "wide",
      est_seconds: 4.5,
      start_time: 0.0,
      end_time: 4.5,
      // No visual_beats property
    },
    {
      index: 2,
      narration: "Legacy scene 2",
      image_prompt: "Prompt 2",
      shot_type: "close-up",
      est_seconds: 5.5,
      start_time: 4.5,
      end_time: 10.0,
      visual_beats: [], // Empty beats array
    },
  ];

  const correlation = correlateBeatsWithTelemetry({ scenes });
  const metrics = computeTimelineMetrics(correlation.scenes);

  assert.equal(metrics.totalBeatsCount, 0);
  assert.equal(metrics.effectiveTotalDuration, 10.0);
  assert.equal(metrics.hasContinuousTiming, true);

  const geom1 = computeSceneTrackGeometry(correlation.scenes[0], metrics.effectiveTotalDuration!);
  assert.equal(geom1.sceneIndex, 1);
  assert.equal(geom1.startTime, 0.0);
  assert.equal(geom1.endTime, 4.5);
  assert.equal(geom1.widthPercent, 45);

  const geom2 = computeSceneTrackGeometry(correlation.scenes[1], metrics.effectiveTotalDuration!);
  assert.equal(geom2.sceneIndex, 2);
  assert.equal(geom2.startTime, 4.5);
  assert.equal(geom2.endTime, 10.0);
  assert.equal(geom2.widthPercent, 55);

  // Un-timed legacy scene without continuous timestamps does not crash or fabricate timestamps
  const untimedScene: StoryboardScene = {
    index: 3,
    narration: "Untimed scene",
    image_prompt: "Prompt 3",
    shot_type: "wide",
    est_seconds: 3.0,
  };
  const untimedCorr = correlateBeatsWithTelemetry({ scenes: [untimedScene] });
  const untimedGeom = computeSceneTrackGeometry(untimedCorr.scenes[0], 10.0);
  assert.equal(untimedGeom.startTime, null);
  assert.equal(untimedGeom.leftPercent, null);
});

test("19. Stage 3.5.5.4 (Req 8): Editing storyboard content does not remove beat metadata", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Original narration",
      image_prompt: "Original prompt",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [
        {
          id: "beat_1",
          order: 1,
          narration_text: "Beat text",
          visual_description: "Beat visual",
          shot_type: "close-up",
          camera_angle: "low-angle",
          focal_point: "face",
          visual_technique: "slow-pan",
          image_strategy: "reuse_scene_image",
          start_time: 0.0,
          end_time: 2.0,
          timing_type: "aligned",
        },
      ],
    },
  ];

  // User edits scene narration and image prompt in inline editor
  const updatedScenes = updateSceneInList(scenes, 1, {
    narration: "Updated narration text",
    image_prompt: "Updated prompt text",
  });

  assert.equal(updatedScenes[0].narration, "Updated narration text");
  assert.equal(updatedScenes[0].image_prompt, "Updated prompt text");
  assert.equal(updatedScenes[0].visual_beats?.length, 1);

  const preservedBeat = updatedScenes[0].visual_beats![0];
  assert.equal(preservedBeat.id, "beat_1");
  assert.equal(preservedBeat.order, 1);
  assert.equal(preservedBeat.shot_type, "close-up");
  assert.equal(preservedBeat.camera_angle, "low-angle");
  assert.equal(preservedBeat.focal_point, "face");
  assert.equal(preservedBeat.visual_technique, "slow-pan");
  assert.equal(preservedBeat.image_strategy, "reuse_scene_image");
});

test("20. Stage 3.5.5.4 (Req 9): Render view handles missing storyboard or voiceover data gracefully", () => {
  // Empty or missing storyboard scenes
  const correlationEmpty = correlateBeatsWithTelemetry({
    scenes: [],
    renderData: { render_mode: "visual_beats", animations: [{ scene_index: 1 }] },
  });

  assert.equal(correlationEmpty.scenes.length, 0);
  assert.equal(correlationEmpty.totalBeatsCount, 0);

  const metrics = computeTimelineMetrics(correlationEmpty.scenes);
  assert.equal(metrics.effectiveTotalDuration, null);
  assert.equal(metrics.hasContinuousTiming, false);
});

test("21. Stage 3.5.5.4 (Req 10): Timeline updates when upstream data changes", () => {
  const scene: StoryboardScene = {
    index: 1,
    narration: "A quick mystery.",
    image_prompt: "Old prompt",
    shot_type: "wide",
    est_seconds: 5.0,
    visual_beats: [
      { id: "b1", order: 1, narration_text: "A quick", timing_type: "unassigned" },
      { id: "b2", order: 2, narration_text: "mystery.", timing_type: "unassigned" },
    ],
  };

  // Phase A: Storyboard only
  const corr1 = correlateBeatsWithTelemetry({ scenes: [scene] });
  assert.equal(computeTimelineMetrics(corr1.scenes).pendingBeatsCount, 2);
  assert.equal(corr1.renderedBeatsCount, 0);

  // Phase B: Voiceover aligns beats
  const corr2 = correlateBeatsWithTelemetry({
    scenes: [scene],
    voiceoverItems: [
      {
        index: 1,
        scene_index: 1,
        narration: "A quick mystery.",
        status: "ok",
        reused: false,
        duration_seconds: 5.0,
        visual_beats: [
          { id: "b1", order: 1, narration_text: "A quick", start_time: 0.0, end_time: 2.2, timing_type: "aligned" },
          { id: "b2", order: 2, narration_text: "mystery.", start_time: 2.2, end_time: 5.0, timing_type: "aligned" },
        ],
      },
    ],
  });
  assert.equal(computeTimelineMetrics(corr2.scenes).pendingBeatsCount, 0);
  assert.equal(computeTimelineMetrics(corr2.scenes).hasContinuousTiming, true);
  assert.equal(corr2.renderedBeatsCount, 0);

  // Phase C: Render executes beats
  const corr3 = correlateBeatsWithTelemetry({
    scenes: [scene],
    voiceoverItems: [
      {
        index: 1,
        scene_index: 1,
        narration: "A quick mystery.",
        status: "ok",
        reused: false,
        duration_seconds: 5.0,
        visual_beats: [
          { id: "b1", order: 1, narration_text: "A quick", start_time: 0.0, end_time: 2.2, timing_type: "aligned" },
          { id: "b2", order: 2, narration_text: "mystery.", start_time: 2.2, end_time: 5.0, timing_type: "aligned" },
        ],
      },
    ],
    renderData: {
      render_mode: "visual_beats",
      animations: [
        { scene_index: 1, beat_id: "b1", animation_type: "zoom-in", frames: 66, start_time: 0.0, end_time: 2.2 },
        { scene_index: 1, beat_id: "b2", animation_type: "pan-right", frames: 84, start_time: 2.2, end_time: 5.0 },
      ],
    },
  });
  assert.equal(corr3.renderedBeatsCount, 2);
  assert.equal(resolveCorrelatedBeatTiming(corr3.scenes[0].beats[0]).isExecuted, true);
  assert.equal(resolveCorrelatedBeatTiming(corr3.scenes[0].beats[1]).isExecuted, true);
});
