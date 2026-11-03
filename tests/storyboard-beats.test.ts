import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTimestamp,
  getBeatImageStrategyDisplay,
  getBeatTimingDisplay,
  getTimelineTelemetryDisplay,
  getVisualBeatsCount,
  hasVisualBeats,
  isSceneAccordionExpanded,
  parseAndValidateStoryboard,
  parseVisualBeat,
  resolveBeatImageSource,
  resolveBeatTimingSource,
  resolveCorrelatedBeatTiming,
  correlateBeatsWithTelemetry,
  resolveStoryboardBeatImages,
  toggleSceneAccordion,
  updateSceneInList,
} from "../src/lib/storyboard.ts";
import type {
  BeatTelemetryInfo,
  RenderAnimationItem,
  RenderData,
  StoryboardScene,
  VisualBeat,
  VoiceoverItem,
} from "../src/lib/types.ts";

test("1. Legacy scenes without visual_beats parse successfully", () => {
  const legacyPayload = {
    storyboard: {
      visual_style: "Clean 3D render, soft studio lighting",
      style_source: "channel",
      total_seconds: 10.5,
      scenes: [
        {
          index: 1,
          narration: "Scene one narration text.",
          image_prompt: "A detailed view of an airplane window.",
          shot_type: "medium",
          est_seconds: 5.0,
        },
        {
          index: 2,
          narration: "Scene two narration text.",
          image_prompt: "Close up of the window pane.",
          shot_type: "close-up",
          est_seconds: 5.5,
        },
      ],
    },
    warnings: [],
  };

  const parsed = parseAndValidateStoryboard(legacyPayload);
  assert.ok(parsed, "Parsed storyboard should not be null");
  assert.equal(parsed.scenes.length, 2);
  assert.equal(parsed.visual_style, "Clean 3D render, soft studio lighting");
  assert.equal(parsed.style_source, "channel");
  assert.equal(parsed.total_seconds, 10.5);

  // Both scenes should parse correctly without visual_beats
  assert.equal(parsed.scenes[0].index, 1);
  assert.equal(parsed.scenes[0].narration, "Scene one narration text.");
  assert.equal(parsed.scenes[0].shot_type, "medium");
  assert.equal(parsed.scenes[0].est_seconds, 5.0);
  assert.equal(parsed.scenes[0].visual_beats, undefined);

  assert.equal(parsed.scenes[1].index, 2);
  assert.equal(parsed.scenes[1].visual_beats, undefined);
});

test("2. Valid VisualBeat data is retained, including timing, image strategy, and camera metadata", () => {
  const payloadWithBeats = {
    storyboard: {
      visual_style: "Cinematic realism",
      style_source: "default",
      subject_anchor: "A metallic turbine blade",
      environment_anchor: "Engine test cell",
      total_seconds: 8.5,
      total_visual_beats: 2,
      scenes: [
        {
          index: 1,
          narration: "Turbine blades withstand extreme temperatures inside jet engines.",
          visual_purpose: "Explain turbine durability",
          image_prompt: "Interior cross-section of a high-bypass turbofan.",
          shot_type: "wide",
          camera_angle: "eye-level",
          focal_point: "combustion chamber",
          visual_technique: "technical-illustration",
          environment: "jet engine housing",
          uses_anchor: true,
          final_prompt: "Cinematic realism. Interior cross-section of a high-bypass turbofan.",
          est_seconds: 8.5,
          animation: {
            animation_type: "zoom-in",
            start_scale: 1.0,
            end_scale: 1.08,
            intensity: "subtle",
          },
          visual_beats: [
            {
              id: "beat_1_1",
              scene_id: "1",
              order: 1,
              narration_text: "Turbine blades withstand extreme temperatures",
              start_time: 0.0,
              end_time: 4.25,
              duration_seconds: 4.25,
              start_word_index: 0,
              end_word_index: 4,
              timing_type: "aligned",
              visual_description: "Turbine rotor spinning in chamber",
              visual_purpose: "Establish subject",
              shot_type: "wide",
              camera_angle: "eye-level",
              focal_point: "rotor assembly",
              visual_technique: "technical-illustration",
              image_strategy: "new_image",
              source_image_id: "1",
            },
            {
              id: "beat_1_2",
              scene_id: "1",
              order: 2,
              narration_text: "inside jet engines.",
              start_time: 4.25,
              end_time: 8.5,
              duration_seconds: 4.25,
              start_word_index: 5,
              end_word_index: 7,
              timing_type: "aligned",
              visual_description: "Macro glowing ceramic thermal barrier coating",
              visual_purpose: "Reveal detail",
              shot_type: "macro",
              camera_angle: "low-angle",
              focal_point: "cooling holes",
              visual_technique: "macro-photo",
              image_strategy: "reuse_scene_image",
              source_image_id: "1",
            },
          ],
        },
      ],
    },
  };

  const parsed = parseAndValidateStoryboard(payloadWithBeats);
  assert.ok(parsed, "Parsed output should exist");
  assert.equal(parsed.subject_anchor, "A metallic turbine blade");
  assert.equal(parsed.environment_anchor, "Engine test cell");
  assert.equal(parsed.total_visual_beats, 2);

  const scene = parsed.scenes[0];
  assert.equal(scene.visual_purpose, "Explain turbine durability");
  assert.equal(scene.camera_angle, "eye-level");
  assert.equal(scene.focal_point, "combustion chamber");
  assert.equal(scene.visual_technique, "technical-illustration");
  assert.equal(scene.environment, "jet engine housing");
  assert.equal(scene.uses_anchor, true);
  assert.equal(scene.final_prompt, "Cinematic realism. Interior cross-section of a high-bypass turbofan.");
  assert.deepEqual(scene.animation, {
    animation_type: "zoom-in",
    start_scale: 1.0,
    end_scale: 1.08,
    intensity: "subtle",
  });

  assert.ok(Array.isArray(scene.visual_beats));
  assert.equal(scene.visual_beats.length, 2);

  const beat1 = scene.visual_beats[0];
  assert.equal(beat1.id, "beat_1_1");
  assert.equal(beat1.scene_id, "1");
  assert.equal(beat1.order, 1);
  assert.equal(beat1.narration_text, "Turbine blades withstand extreme temperatures");
  assert.equal(beat1.start_time, 0.0);
  assert.equal(beat1.end_time, 4.25);
  assert.equal(beat1.duration_seconds, 4.25);
  assert.equal(beat1.start_word_index, 0);
  assert.equal(beat1.end_word_index, 4);
  assert.equal(beat1.timing_type, "aligned");
  assert.equal(beat1.shot_type, "wide");
  assert.equal(beat1.camera_angle, "eye-level");
  assert.equal(beat1.focal_point, "rotor assembly");
  assert.equal(beat1.image_strategy, "new_image");
  assert.equal(beat1.source_image_id, "1");

  const beat2 = scene.visual_beats[1];
  assert.equal(beat2.id, "beat_1_2");
  assert.equal(beat2.shot_type, "macro");
  assert.equal(beat2.camera_angle, "low-angle");
  assert.equal(beat2.image_strategy, "reuse_scene_image");
  assert.equal(beat2.source_image_id, "1");
});

test("3. Editing narration preserves all unrelated scene properties", () => {
  const originalScene: StoryboardScene = {
    index: 1,
    narration: "Original narration text.",
    image_prompt: "Original visual prompt.",
    shot_type: "medium",
    est_seconds: 4.0,
    camera_angle: "top-down",
    focal_point: "center target",
    environment: "studio",
    uses_anchor: true,
    final_prompt: "Composed prompt string",
    animation: { animation_type: "pan-left" },
    visual_beats: [
      {
        id: "beat_1_1",
        order: 1,
        narration_text: "Original beat text",
        visual_description: "Beat visual",
        shot_type: "close-up",
        image_strategy: "new_image",
      },
    ],
    custom_field: "must_survive",
  };

  const updatedScenes = updateSceneInList([originalScene], 1, {
    narration: "  Updated narration with new script text.  ",
  });

  assert.equal(updatedScenes.length, 1);
  const updated = updatedScenes[0];

  // Only narration should change (trimmed)
  assert.equal(updated.narration, "Updated narration with new script text.");

  // All other fields must be strictly preserved
  assert.equal(updated.image_prompt, "Original visual prompt.");
  assert.equal(updated.shot_type, "medium");
  assert.equal(updated.est_seconds, 4.0);
  assert.equal(updated.camera_angle, "top-down");
  assert.equal(updated.focal_point, "center target");
  assert.equal(updated.environment, "studio");
  assert.equal(updated.uses_anchor, true);
  assert.equal(updated.final_prompt, "Composed prompt string");
  assert.deepEqual(updated.animation, { animation_type: "pan-left" });
  assert.deepEqual(updated.visual_beats, originalScene.visual_beats);
  assert.equal(updated.custom_field, "must_survive");
});

test("4. Editing the image prompt preserves all unrelated scene properties", () => {
  const originalScene: StoryboardScene = {
    index: 2,
    narration: "Keep this narration exactly as is.",
    image_prompt: "Initial prompt text.",
    shot_type: "aerial",
    est_seconds: 6.0,
    camera_angle: "high-angle",
    final_prompt: "Initial full prompt",
    visual_beats: [
      {
        id: "beat_2_1",
        order: 1,
        narration_text: "Keep this narration",
        visual_description: "Scenic vista",
        image_strategy: "reuse_scene_image",
      },
    ],
  };

  const updatedScenes = updateSceneInList([originalScene], 2, {
    image_prompt: "  New refined image prompt text with studio lighting.  ",
  });

  assert.equal(updatedScenes.length, 1);
  const updated = updatedScenes[0];

  // Only image_prompt should change
  assert.equal(updated.image_prompt, "New refined image prompt text with studio lighting.");

  // All other fields preserved
  assert.equal(updated.narration, "Keep this narration exactly as is.");
  assert.equal(updated.shot_type, "aerial");
  assert.equal(updated.camera_angle, "high-angle");
  assert.equal(updated.final_prompt, "Initial full prompt");
  assert.deepEqual(updated.visual_beats, originalScene.visual_beats);
});

test("5. Unknown future scene metadata survives parsing and saving", () => {
  const payloadWithFutureFields = {
    storyboard: {
      visual_style: "Neon cyberpunk",
      style_source: "channel",
      future_pipeline_flag: "v4_experimental",
      scenes: [
        {
          index: 1,
          narration: "A high-speed maglev train races across the skyline.",
          image_prompt: "Futuristic illuminated train on suspended monorail.",
          shot_type: "wide",
          est_seconds: 4.5,
          future_lens_focal_mm: 85,
          ai_post_processing_mode: "hdr_enhance",
          volumetric_fog_density: 0.75,
        },
      ],
    },
  };

  // Step 1: Parse
  const parsed = parseAndValidateStoryboard(payloadWithFutureFields);
  assert.ok(parsed);
  assert.equal(parsed.future_pipeline_flag, "v4_experimental");

  const parsedScene = parsed.scenes[0];
  assert.equal(parsedScene.future_lens_focal_mm, 85);
  assert.equal(parsedScene.ai_post_processing_mode, "hdr_enhance");
  assert.equal(parsedScene.volumetric_fog_density, 0.75);

  // Step 2: Edit a field and verify preservation
  const updated = updateSceneInList(parsed.scenes, 1, {
    shot_type: "medium-wide",
  });

  assert.equal(updated[0].shot_type, "medium-wide");
  assert.equal(updated[0].future_lens_focal_mm, 85);
  assert.equal(updated[0].ai_post_processing_mode, "hdr_enhance");
  assert.equal(updated[0].volumetric_fog_density, 0.75);
});

test("6. Missing or malformed optional beat data does not crash the storyboard view", () => {
  const malformedPayload = {
    storyboard: {
      visual_style: "Minimalist",
      style_source: "default",
      total_seconds: 5.0,
      scenes: [
        {
          index: 1,
          narration: "Valid narration text.",
          image_prompt: "Valid image prompt.",
          shot_type: "close-up",
          est_seconds: 5.0,
          visual_beats: [
            // Valid beat
            {
              id: "beat_1_1",
              order: 1,
              narration_text: "Valid slice",
              visual_description: "Valid description",
            },
            // Malformed non-object entries: null, primitive, array
            null,
            "corrupt string",
            42,
            [],
            // Object with missing optional fields & null timestamps
            {
              id: "beat_1_2",
              order: 2,
              narration_text: "Second slice",
              start_time: null,
              end_time: null,
              duration_seconds: null,
              source_image_id: null,
              visual_description: "Safe fallback",
            },
          ],
        },
      ],
    },
  };

  // Must not throw an unhandled exception
  const parsed = parseAndValidateStoryboard(malformedPayload);
  assert.ok(parsed);

  const scene = parsed.scenes[0];
  assert.ok(Array.isArray(scene.visual_beats));
  // The 2 valid object beats should be kept, the 4 non-objects filtered out cleanly
  assert.equal(scene.visual_beats.length, 2);

  assert.equal(scene.visual_beats[0].id, "beat_1_1");
  assert.equal(scene.visual_beats[0].order, 1);

  assert.equal(scene.visual_beats[1].id, "beat_1_2");
  assert.equal(scene.visual_beats[1].start_time, null);
  assert.equal(scene.visual_beats[1].end_time, null);
  assert.equal(scene.visual_beats[1].source_image_id, null);
});

test("7. The saved payload matches the actual backend update contract", () => {
  const originalScenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1 narration.",
      image_prompt: "Scene 1 prompt.",
      shot_type: "medium",
      est_seconds: 4.0,
      camera_angle: "eye-level",
      visual_beats: [
        {
          id: "beat_1_1",
          order: 1,
          narration_text: "Scene 1 beat",
          visual_description: "Beat moment",
          shot_type: "medium",
          image_strategy: "new_image",
          source_image_id: "1",
        },
      ],
    },
  ];

  // Simulate editing scene 1 in the UI
  const updatedScenes = updateSceneInList(originalScenes, 1, {
    narration: "Edited narration text.",
    image_prompt: "Edited visual prompt.",
  });

  // This is the payload structure sent by StepDetailPanel to api.videos.updateStepContent:
  // await onUpdateContent(step.name, { storyboard: { scenes: updatedScenes } }, "Inline storyboard scenes revision");
  const backendUpdateBody = {
    storyboard: {
      scenes: updatedScenes,
    },
  };

  assert.ok(backendUpdateBody.storyboard);
  assert.ok(Array.isArray(backendUpdateBody.storyboard.scenes));
  assert.equal(backendUpdateBody.storyboard.scenes.length, 1);

  const payloadScene = backendUpdateBody.storyboard.scenes[0];
  assert.equal(payloadScene.narration, "Edited narration text.");
  assert.equal(payloadScene.image_prompt, "Edited visual prompt.");
  assert.equal(payloadScene.shot_type, "medium");
  assert.equal(payloadScene.camera_angle, "eye-level");
  assert.ok(Array.isArray(payloadScene.visual_beats));
  assert.equal(payloadScene.visual_beats[0].id, "beat_1_1");
  assert.equal(payloadScene.visual_beats[0].image_strategy, "new_image");

  // Verify backend dictionary merge semantics:
  // In app/pipeline.py:
  // new_output = dict(target.output)
  // for k, v in updated_payload.items():
  //     if isinstance(v, dict) and isinstance(new_output.get(k), dict):
  //         new_output[k] = {**new_output[k], **v}
  const simulatedTargetOutput = {
    storyboard: {
      visual_style: "Studio style",
      style_source: "channel",
      subject_anchor: "Anchor object",
      total_seconds: 4.0,
      scenes: originalScenes,
    },
    meta: { provider: "mock" },
  };

  const simulatedNewOutput = {
    ...simulatedTargetOutput,
    storyboard: {
      ...simulatedTargetOutput.storyboard,
      ...backendUpdateBody.storyboard,
    },
  };

  // Top-level storyboard properties must remain intact in merged output
  assert.equal(simulatedNewOutput.storyboard.visual_style, "Studio style");
  assert.equal(simulatedNewOutput.storyboard.style_source, "channel");
  assert.equal(simulatedNewOutput.storyboard.subject_anchor, "Anchor object");

  // Replaced scenes array retains all beat and framing properties
  assert.equal(simulatedNewOutput.storyboard.scenes[0].narration, "Edited narration text.");
  assert.equal(simulatedNewOutput.storyboard.scenes[0].camera_angle, "eye-level");
  assert.equal(simulatedNewOutput.storyboard.scenes[0].visual_beats?.[0].id, "beat_1_1");
});

test("8. Aligned timing formatting correctly renders MM:SS.SS intervals", () => {
  // Test formatTimestamp helper
  assert.equal(formatTimestamp(0), "00:00.00");
  assert.equal(formatTimestamp(2.4), "00:02.40");
  assert.equal(formatTimestamp(4.15), "00:04.15");
  assert.equal(formatTimestamp(65.5), "01:05.50");

  const alignedBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Sample text",
    visual_description: "Sample visual",
    start_time: 2.4,
    end_time: 4.15,
    timing_type: "aligned",
  };

  const display = getBeatTimingDisplay(alignedBeat);
  assert.equal(display.status, "aligned");
  assert.equal(display.text, "00:02.40 – 00:04.15");
  assert.ok(display.badgeStyle.includes("emerald"));
});

test("9. Unassigned timing renders clear pending status", () => {
  const unassignedBeat: VisualBeat = {
    id: "beat_2",
    order: 2,
    narration_text: "Unassigned beat",
    visual_description: "Unassigned visual",
    start_time: null,
    end_time: null,
    timing_type: "unassigned",
  };

  const display = getBeatTimingDisplay(unassignedBeat);
  assert.equal(display.status, "unassigned");
  assert.equal(display.text, "Pending voiceover");
  assert.ok(display.badgeStyle.includes("slate"));

  // Also when beat object is undefined or empty
  const emptyDisplay = getBeatTimingDisplay({});
  assert.equal(emptyDisplay.status, "unassigned");
  assert.equal(emptyDisplay.text, "Pending voiceover");
});

test("10. Fallback and proportional timing renders indicator", () => {
  const proportionalBeat: VisualBeat = {
    id: "beat_3",
    order: 3,
    narration_text: "Proportional beat",
    visual_description: "Proportional visual",
    start_time: 1.0,
    end_time: 3.5,
    timing_type: "fallback_proportional",
  };

  const displayProp = getBeatTimingDisplay(proportionalBeat);
  assert.equal(displayProp.status, "fallback");
  assert.equal(displayProp.text, "~00:01.00 – 00:03.50 (proportional)");
  assert.ok(displayProp.badgeStyle.includes("blue"));

  const estimatedBeat: VisualBeat = {
    id: "beat_4",
    order: 4,
    narration_text: "Estimated beat",
    visual_description: "Estimated visual",
    start_time: 2.0,
    end_time: 5.0,
    timing_type: "estimated",
  };

  const displayEst = getBeatTimingDisplay(estimatedBeat);
  assert.equal(displayEst.status, "fallback");
  assert.equal(displayEst.text, "~00:02.00 – 00:05.00 (est)");
});

test("11. Invalid or missing timestamps never output NaN or misleading values", () => {
  // Test with NaN, inverted interval (end < start), negative numbers
  const nanBeat: VisualBeat = {
    id: "beat_nan",
    order: 1,
    narration_text: "Corrupt timing",
    visual_description: "Corrupt visual",
    start_time: Number.NaN,
    end_time: 4.0,
    timing_type: "aligned",
  };

  const displayNaN = getBeatTimingDisplay(nanBeat);
  assert.equal(displayNaN.status, "unassigned");
  assert.equal(displayNaN.text, "Pending voiceover");
  assert.ok(!displayNaN.text.includes("NaN"));

  const invertedBeat: VisualBeat = {
    id: "beat_inv",
    order: 2,
    narration_text: "Inverted interval",
    visual_description: "Inverted visual",
    start_time: 5.0,
    end_time: 2.0,
    timing_type: "aligned",
  };

  const displayInv = getBeatTimingDisplay(invertedBeat);
  assert.equal(displayInv.status, "unassigned");
  assert.equal(displayInv.text, "Pending voiceover");

  const negativeBeat: VisualBeat = {
    id: "beat_neg",
    order: 3,
    narration_text: "Negative time",
    visual_description: "Negative visual",
    start_time: -1.5,
    end_time: 2.0,
    timing_type: "aligned",
  };

  const displayNeg = getBeatTimingDisplay(negativeBeat);
  assert.equal(displayNeg.status, "unassigned");
  assert.equal(displayNeg.text, "Pending voiceover");
});

test("12. All three image strategy labels format properly", () => {
  const reuseScene = getBeatImageStrategyDisplay("reuse_scene_image");
  assert.equal(reuseScene.label, "Reuse Scene Image");
  assert.ok(reuseScene.badgeStyle.includes("indigo"));

  const reusePrev = getBeatImageStrategyDisplay("reuse_previous_image");
  assert.equal(reusePrev.label, "Reuse Previous Image");
  assert.ok(reusePrev.badgeStyle.includes("purple"));

  const newImg = getBeatImageStrategyDisplay("new_image");
  assert.equal(newImg.label, "New Image");
  assert.ok(newImg.badgeStyle.includes("amber"));

  // Default / missing fallback
  const missing = getBeatImageStrategyDisplay(undefined);
  assert.equal(missing.label, "Reuse Scene Image");

  // Custom strategy
  const custom = getBeatImageStrategyDisplay("custom_generative_fill");
  assert.equal(custom.label, "Custom Generative Fill");
});

test("13. Optional camera metadata being absent is handled cleanly", () => {
  const minimalBeatRaw = {
    id: "beat_min",
    order: 1,
    narration_text: "Minimal beat",
    visual_description: "Minimal visual description",
  };

  const beat = parseVisualBeat(minimalBeatRaw);
  assert.ok(beat);
  assert.equal(beat.camera_angle, undefined);
  assert.equal(beat.visual_technique, undefined);
  assert.equal(beat.focal_point, undefined);
  assert.equal(beat.visual_purpose, undefined);
  assert.equal(beat.source_image_id, undefined);
});

test("14. Missing narration or visual description handled safely", () => {
  const beatWithoutText = parseVisualBeat({
    id: "beat_empty",
    order: 1,
  });

  assert.ok(beatWithoutText);
  assert.equal(beatWithoutText.narration_text, "");
  assert.equal(beatWithoutText.visual_description, "");

  // Timing display still works safely
  const timing = getBeatTimingDisplay(beatWithoutText);
  assert.equal(timing.text, "Pending voiceover");

  // Strategy display still works safely
  const strategy = getBeatImageStrategyDisplay(beatWithoutText.image_strategy);
  assert.equal(strategy.label, "Reuse Scene Image");
});

test("15. hasVisualBeats and getVisualBeatsCount correctly detect beats", () => {
  const sceneWithBeats: StoryboardScene = {
    index: 1,
    narration: "Narr",
    image_prompt: "Prompt",
    shot_type: "wide",
    est_seconds: 4.0,
    visual_beats: [
      { id: "beat_1_1", order: 1, narration_text: "Beat 1", visual_description: "Moment 1" },
      { id: "beat_1_2", order: 2, narration_text: "Beat 2", visual_description: "Moment 2" },
      { id: "beat_1_3", order: 3, narration_text: "Beat 3", visual_description: "Moment 3" },
    ],
  };

  assert.equal(hasVisualBeats(sceneWithBeats), true);
  assert.equal(getVisualBeatsCount(sceneWithBeats), 3);

  // Legacy scene without visual_beats
  const legacyScene: StoryboardScene = {
    index: 2,
    narration: "Narr",
    image_prompt: "Prompt",
    shot_type: "close-up",
    est_seconds: 3.5,
  };

  assert.equal(hasVisualBeats(legacyScene), false);
  assert.equal(getVisualBeatsCount(legacyScene), 0);

  // Scene with empty visual_beats array
  const sceneWithEmptyBeats: StoryboardScene = {
    index: 3,
    narration: "Narr",
    image_prompt: "Prompt",
    shot_type: "macro",
    est_seconds: 2.0,
    visual_beats: [],
  };

  assert.equal(hasVisualBeats(sceneWithEmptyBeats), false);
  assert.equal(getVisualBeatsCount(sceneWithEmptyBeats), 0);

  // Null or undefined scene
  assert.equal(hasVisualBeats(null), false);
  assert.equal(hasVisualBeats(undefined), false);
  assert.equal(getVisualBeatsCount(null), 0);
  assert.equal(getVisualBeatsCount(undefined), 0);
});

test("16. Accordion toggle state expands and collapses independently per scene", () => {
  let accordionState: Record<number, boolean> = {};

  // Initially, all scenes are collapsed
  assert.equal(isSceneAccordionExpanded(accordionState, 1), false);
  assert.equal(isSceneAccordionExpanded(accordionState, 2), false);

  // Expand Scene 1
  accordionState = toggleSceneAccordion(accordionState, 1);
  assert.equal(isSceneAccordionExpanded(accordionState, 1), true);
  assert.equal(isSceneAccordionExpanded(accordionState, 2), false, "Scene 2 must not be affected by Scene 1");

  // Expand Scene 2
  accordionState = toggleSceneAccordion(accordionState, 2);
  assert.equal(isSceneAccordionExpanded(accordionState, 1), true, "Scene 1 remains expanded");
  assert.equal(isSceneAccordionExpanded(accordionState, 2), true, "Scene 2 is now expanded");

  // Collapse Scene 1
  accordionState = toggleSceneAccordion(accordionState, 1);
  assert.equal(isSceneAccordionExpanded(accordionState, 1), false, "Scene 1 collapsed");
  assert.equal(isSceneAccordionExpanded(accordionState, 2), true, "Scene 2 remains expanded");

  // Collapse Scene 2
  accordionState = toggleSceneAccordion(accordionState, 2);
  assert.equal(isSceneAccordionExpanded(accordionState, 1), false);
  assert.equal(isSceneAccordionExpanded(accordionState, 2), false);
});

test("17. Scene index and beat ordering propagate correctly to VisualBeats", () => {
  const payload = {
    storyboard: {
      visual_style: "Documentary",
      scenes: [
        {
          index: 2,
          narration: "Scene two text",
          image_prompt: "Scene two prompt",
          shot_type: "medium",
          est_seconds: 4.0,
          visual_beats: [
            { id: "b2_1", order: 1, narration_text: "Slice 1", visual_description: "Moment 1" },
            { id: "b2_2", order: 2, narration_text: "Slice 2", visual_description: "Moment 2" },
          ],
        },
      ],
    },
  };

  const parsed = parseAndValidateStoryboard(payload);
  assert.ok(parsed);
  const scene = parsed.scenes[0];
  assert.equal(scene.index, 2);
  assert.ok(scene.visual_beats);
  assert.equal(scene.visual_beats.length, 2);

  // Check beat orders and IDs
  assert.equal(scene.visual_beats[0].order, 1);
  assert.equal(scene.visual_beats[0].id, "b2_1");
  assert.equal(scene.visual_beats[1].order, 2);
  assert.equal(scene.visual_beats[1].id, "b2_2");
});

test("18. Empty beat arrays do not display an accordion section", () => {
  const payload = {
    storyboard: {
      visual_style: "Minimal",
      scenes: [
        {
          index: 1,
          narration: "Scene without beats",
          image_prompt: "Scene prompt",
          shot_type: "wide",
          est_seconds: 3.0,
          visual_beats: [],
        },
      ],
    },
  };

  const parsed = parseAndValidateStoryboard(payload);
  assert.ok(parsed);
  const scene = parsed.scenes[0];
  // hasVisualBeats must return false so UI skips the accordion completely
  assert.equal(hasVisualBeats(scene), false);
  assert.equal(getVisualBeatsCount(scene), 0);
});

test("19. Legacy scenes without visual_beats array remain completely unaffected", () => {
  const payload = {
    storyboard: {
      visual_style: "Classic",
      scenes: [
        {
          index: 1,
          narration: "Classic scene narration",
          image_prompt: "Classic prompt",
          shot_type: "close-up",
          est_seconds: 5.0,
        },
      ],
    },
  };

  const parsed = parseAndValidateStoryboard(payload);
  assert.ok(parsed);
  const scene = parsed.scenes[0];
  assert.equal(scene.visual_beats, undefined);
  assert.equal(hasVisualBeats(scene), false);
  assert.equal(getVisualBeatsCount(scene), 0);
});

test("20. Existing scene editing preserves visual beats and unrelated metadata", () => {
  const initialScenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Original narration",
      image_prompt: "Original prompt",
      shot_type: "medium",
      est_seconds: 4.5,
      camera_angle: "low-angle",
      focal_point: "cockpit controls",
      visual_technique: "cinematic-photo",
      visual_beats: [
        {
          id: "beat_1_1",
          order: 1,
          narration_text: "Original beat narration",
          visual_description: "Pilot hand on throttle",
          shot_type: "close-up",
          image_strategy: "reuse_scene_image",
          start_time: 0.0,
          end_time: 2.25,
          timing_type: "aligned",
        },
      ],
      custom_meta: { key: "preserved_val" },
    },
  ];

  // User edits scene 1 narration in the UI
  const updatedScenes = updateSceneInList(initialScenes, 1, {
    narration: "New updated narration text",
  });

  assert.equal(updatedScenes[0].narration, "New updated narration text");
  // Visual beats array and all properties must be strictly preserved
  assert.ok(updatedScenes[0].visual_beats);
  assert.equal(updatedScenes[0].visual_beats.length, 1);
  assert.equal(updatedScenes[0].visual_beats[0].id, "beat_1_1");
  assert.equal(updatedScenes[0].visual_beats[0].narration_text, "Original beat narration");
  assert.equal(updatedScenes[0].visual_beats[0].start_time, 0.0);
  assert.equal(updatedScenes[0].visual_beats[0].timing_type, "aligned");
  assert.equal(updatedScenes[0].camera_angle, "low-angle");
  assert.equal(updatedScenes[0].focal_point, "cockpit controls");
  assert.deepEqual(updatedScenes[0].custom_meta, { key: "preserved_val" });
});

test("21. resolveBeatImageSource: reuse_scene_image resolves to parent scene index with Scene Image label", () => {
  const beat: VisualBeat = {
    id: "beat_2_1",
    order: 1,
    narration_text: "Scene 2 beat 1",
    image_strategy: "reuse_scene_image",
  };

  const resolvedWithAvailable = resolveBeatImageSource({
    beat,
    sceneIndex: 2,
    availableImageIndices: new Set([1, 2, 3]),
  });

  assert.equal(resolvedWithAvailable.status, "scene_image");
  assert.equal(resolvedWithAvailable.resolvedSceneIndex, 2);
  assert.equal(resolvedWithAvailable.sourceLabel, "Scene Image");
  assert.equal(resolvedWithAvailable.isAvailable, true);

  // Default strategy (unspecified) also resolves to parent scene image
  const beatNoStrategy: VisualBeat = {
    id: "beat_2_2",
    order: 2,
    narration_text: "Scene 2 beat 2",
  };
  const resolvedDefault = resolveBeatImageSource({
    beat: beatNoStrategy,
    sceneIndex: 2,
    availableImageIndices: [2],
  });
  assert.equal(resolvedDefault.status, "scene_image");
  assert.equal(resolvedDefault.resolvedSceneIndex, 2);
  assert.equal(resolvedDefault.sourceLabel, "Scene Image");
  assert.equal(resolvedDefault.isAvailable, true);
});

test("22. resolveBeatImageSource: reuse_scene_image with missing parent image marks isAvailable as false", () => {
  const beat: VisualBeat = {
    id: "beat_4_1",
    order: 1,
    narration_text: "Scene 4 beat 1",
    image_strategy: "reuse_scene_image",
  };

  // Scene 4 has not yet generated an image (availableImageIndices contains only 1, 2)
  const resolved = resolveBeatImageSource({
    beat,
    sceneIndex: 4,
    availableImageIndices: [1, 2],
  });

  assert.equal(resolved.status, "scene_image");
  assert.equal(resolved.resolvedSceneIndex, 4);
  assert.equal(resolved.sourceLabel, "Scene Image");
  assert.equal(resolved.isAvailable, false);
  assert.match(resolved.description || "", /not ready/i);
});

test("23. resolveBeatImageSource: reuse_previous_image resolves to previous beat's image index", () => {
  const beat: VisualBeat = {
    id: "beat_2_2",
    order: 2,
    narration_text: "Scene 2 beat 2",
    image_strategy: "reuse_previous_image",
  };

  // Immediately preceding beat was from Scene 1
  const resolved = resolveBeatImageSource({
    beat,
    sceneIndex: 2,
    previousBeatImageIndex: 1,
    availableImageIndices: [1, 2],
  });

  assert.equal(resolved.status, "previous_image");
  assert.equal(resolved.resolvedSceneIndex, 1);
  assert.equal(resolved.sourceLabel, "Previous Beat Image");
  assert.equal(resolved.isAvailable, true);
  assert.match(resolved.description || "", /Reused from Scene 1/i);
});

test("24. resolveBeatImageSource: reuse_previous_image with no previous beat resolves to unavailable", () => {
  const firstBeat: VisualBeat = {
    id: "beat_1_1",
    order: 1,
    narration_text: "Scene 1 beat 1",
    image_strategy: "reuse_previous_image",
  };

  // First beat in video has no previous beat
  const resolved = resolveBeatImageSource({
    beat: firstBeat,
    sceneIndex: 1,
    previousBeatImageIndex: null,
  });

  assert.equal(resolved.status, "unavailable");
  assert.equal(resolved.resolvedSceneIndex, null);
  assert.equal(resolved.sourceLabel, "Previous Beat Image");
  assert.equal(resolved.isAvailable, false);
  assert.equal(resolved.description, "Previous beat image unavailable");
});

test("25. resolveBeatImageSource: reuse_previous_image fallback to explicit source_image_id and invalid ID handling", () => {
  const beatWithExplicitSource: VisualBeat = {
    id: "beat_3_1",
    order: 1,
    narration_text: "Scene 3 beat 1",
    image_strategy: "reuse_previous_image",
    source_image_id: "2",
  };

  // When previousBeatImageIndex is not provided, parses source_image_id "2"
  const resolved = resolveBeatImageSource({
    beat: beatWithExplicitSource,
    sceneIndex: 3,
    availableImageIndices: [2, 3],
  });

  assert.equal(resolved.status, "previous_image");
  assert.equal(resolved.resolvedSceneIndex, 2);
  assert.equal(resolved.sourceLabel, "Previous Beat Image");
  assert.equal(resolved.isAvailable, true);

  // Invalid / non-numeric source_image_id resolves to unavailable
  const beatWithBadSource: VisualBeat = {
    id: "beat_3_2",
    order: 2,
    narration_text: "Scene 3 beat 2",
    image_strategy: "reuse_previous_image",
    source_image_id: "not_a_number_or_asset",
  };
  const resolvedBad = resolveBeatImageSource({
    beat: beatWithBadSource,
    sceneIndex: 3,
  });
  assert.equal(resolvedBad.status, "unavailable");
  assert.equal(resolvedBad.resolvedSceneIndex, null);
  assert.equal(resolvedBad.isAvailable, false);
});

test("26. resolveBeatImageSource: new_image without distinct asset resolves to new_image_required placeholder", () => {
  const beat: VisualBeat = {
    id: "beat_1_2",
    order: 2,
    narration_text: "Scene 1 beat 2",
    image_strategy: "new_image",
    // Even if source_image_id equals parent scene index (from backend default generation),
    // a new image has NOT been generated for this beat! Never display parent scene image as new!
    source_image_id: "1",
  };

  const resolved = resolveBeatImageSource({
    beat,
    sceneIndex: 1,
    availableImageIndices: [1],
  });

  assert.equal(resolved.status, "new_image_required");
  assert.equal(resolved.resolvedSceneIndex, null);
  assert.equal(resolved.sourceLabel, "New Image");
  assert.equal(resolved.isAvailable, false);
  assert.equal(resolved.description, "New image required");
});

test("27. resolveBeatImageSource: new_image with distinct asset in beatImageMap resolves to new_image_available", () => {
  const beat: VisualBeat = {
    id: "beat_custom_asset",
    order: 1,
    narration_text: "Custom asset beat",
    image_strategy: "new_image",
  };

  const resolved = resolveBeatImageSource({
    beat,
    sceneIndex: 1,
    beatImageMap: {
      beat_custom_asset: 5,
    },
  });

  assert.equal(resolved.status, "new_image_available");
  assert.equal(resolved.resolvedSceneIndex, 5);
  assert.equal(resolved.sourceLabel, "New Image");
  assert.equal(resolved.isAvailable, true);
  assert.equal(resolved.description, "Beat-specific image");
});

test("28. resolveStoryboardBeatImages: threads sequential beat image resolution across multiple scenes", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "Prompt 1",
      shot_type: "wide",
      est_seconds: 5.0,
      visual_beats: [
        {
          id: "beat_1_1",
          order: 1,
          narration_text: "Beat 1.1 narration",
          image_strategy: "reuse_scene_image",
        },
        {
          id: "beat_1_2",
          order: 2,
          narration_text: "Beat 1.2 narration",
          image_strategy: "reuse_previous_image",
        },
      ],
    },
    {
      index: 2,
      narration: "Scene 2",
      image_prompt: "Prompt 2",
      shot_type: "close-up",
      est_seconds: 5.0,
      visual_beats: [
        {
          id: "beat_2_1",
          order: 1,
          narration_text: "Beat 2.1 narration",
          image_strategy: "reuse_previous_image",
        },
        {
          id: "beat_2_2",
          order: 2,
          narration_text: "Beat 2.2 narration",
          image_strategy: "new_image",
        },
      ],
    },
    {
      index: 3,
      narration: "Scene 3 legacy without beats",
      image_prompt: "Prompt 3",
      shot_type: "medium",
      est_seconds: 4.5,
    },
  ];

  const imageMap = resolveStoryboardBeatImages(scenes, {
    availableImageIndices: [1, 2],
  });

  // Beat 1.1: reuse_scene_image -> Scene 1
  const b11 = imageMap.get("beat_1_1");
  assert.ok(b11);
  assert.equal(b11.status, "scene_image");
  assert.equal(b11.resolvedSceneIndex, 1);
  assert.equal(b11.isAvailable, true);

  // Beat 1.2: reuse_previous_image -> reuses Scene 1 (from beat 1.1)
  const b12 = imageMap.get("beat_1_2");
  assert.ok(b12);
  assert.equal(b12.status, "previous_image");
  assert.equal(b12.resolvedSceneIndex, 1);
  assert.equal(b12.isAvailable, true);

  // Beat 2.1: reuse_previous_image across scene boundary -> reuses Scene 1 (from beat 1.2)
  const b21 = imageMap.get("beat_2_1");
  assert.ok(b21);
  assert.equal(b21.status, "previous_image");
  assert.equal(b21.resolvedSceneIndex, 1);
  assert.equal(b21.isAvailable, true);

  // Beat 2.2: new_image -> new_image_required placeholder, resolvedSceneIndex is null
  const b22 = imageMap.get("beat_2_2");
  assert.ok(b22);
  assert.equal(b22.status, "new_image_required");
  assert.equal(b22.resolvedSceneIndex, null);
  assert.equal(b22.isAvailable, false);
});

test("29. resolveBeatTimingSource: Render timing takes highest precedence when valid and not stale", () => {
  const storyboardBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Storyboard text",
    start_time: 0.0,
    end_time: 3.0,
    duration_seconds: 3.0,
    timing_type: "aligned",
  };

  const voBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Voiceover text",
    start_time: 0.2,
    end_time: 2.8,
    duration_seconds: 2.6,
    timing_type: "aligned",
  };

  const renderAnimation: RenderAnimationItem = {
    scene_index: 1,
    beat_id: "beat_1",
    beat_order: 1,
    start_time: 0.33,
    end_time: 2.67,
    duration_seconds: 2.34,
    frames: 70,
    render_mode: "beat",
  };

  const resolved = resolveBeatTimingSource({
    storyboardBeat,
    voiceoverBeat: voBeat,
    renderAnimation,
    isRenderStale: false,
  });

  assert.equal(resolved.source, "render");
  assert.equal(resolved.timingType, "executed");
  assert.equal(resolved.startTime, 0.33);
  assert.equal(resolved.endTime, 2.67);
  assert.equal(resolved.durationSeconds, 2.34);
  assert.equal(resolved.isPending, false);
  assert.equal(resolved.isFallback, false);
});

test("30. resolveBeatTimingSource: Voiceover aligned timing takes precedence over storyboard when render is unavailable", () => {
  const storyboardBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Storyboard text",
    start_time: 0.0,
    end_time: 5.0,
    timing_type: "fallback_proportional",
  };

  const voBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Voiceover text",
    start_time: 1.0,
    end_time: 4.5,
    timing_type: "aligned",
  };

  const resolved = resolveBeatTimingSource({
    storyboardBeat,
    voiceoverBeat: voBeat,
  });

  assert.equal(resolved.source, "voiceover");
  assert.equal(resolved.timingType, "aligned");
  assert.equal(resolved.startTime, 1.0);
  assert.equal(resolved.endTime, 4.5);
  assert.equal(resolved.isFallback, false);
});

test("31. resolveBeatTimingSource: Voiceover proportional timing is preserved with proportional indicator", () => {
  const voBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Voiceover text",
    start_time: 0.0,
    end_time: 3.5,
    timing_type: "fallback_proportional",
  };

  const resolved = resolveBeatTimingSource({
    voiceoverBeat: voBeat,
  });

  assert.equal(resolved.source, "voiceover");
  assert.equal(resolved.timingType, "fallback_proportional");
  assert.equal(resolved.isFallback, true);
  assert.ok(resolved.formattedInterval.includes("(proportional)"));
});

test("32. resolveBeatTimingSource: Storyboard timing is used when render and voiceover are missing", () => {
  const storyboardBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Storyboard text",
    start_time: 2.0,
    end_time: 6.0,
    timing_type: "aligned",
  };

  const resolved = resolveBeatTimingSource({
    storyboardBeat,
  });

  assert.equal(resolved.source, "storyboard");
  assert.equal(resolved.startTime, 2.0);
  assert.equal(resolved.endTime, 6.0);
});

test("33. resolveBeatTimingSource: Pending/unassigned beat returns null start/end with Pending voiceover label", () => {
  const storyboardBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Pending beat",
    timing_type: "unassigned",
  };

  const resolved = resolveBeatTimingSource({
    storyboardBeat,
  });

  assert.equal(resolved.source, "pending");
  assert.equal(resolved.startTime, null);
  assert.equal(resolved.endTime, null);
  assert.equal(resolved.isPending, true);
  assert.equal(resolved.formattedInterval, "Pending voiceover");
});

test("34. resolveBeatTimingSource: Invalid, negative, or inverted timestamps fall back cleanly", () => {
  // Inverted timestamps (end < start)
  const invalidVo: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Invalid timing text",
    start_time: 5.0,
    end_time: 2.0,
    timing_type: "aligned",
  };

  const validStoryboard: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Valid storyboard text",
    start_time: 0.0,
    end_time: 3.0,
    timing_type: "aligned",
  };

  const resolved = resolveBeatTimingSource({
    voiceoverBeat: invalidVo,
    storyboardBeat: validStoryboard,
  });

  // Invalid voiceover should be skipped, falling back to valid storyboard
  assert.equal(resolved.source, "storyboard");
  assert.equal(resolved.startTime, 0.0);
  assert.equal(resolved.endTime, 3.0);
});

test("35. resolveBeatTimingSource: Stale render records are ignored and fall back to voiceover/storyboard", () => {
  const voBeat: VisualBeat = {
    id: "beat_1",
    order: 1,
    narration_text: "Voiceover text",
    start_time: 1.0,
    end_time: 4.0,
    timing_type: "aligned",
  };

  const staleRender: RenderAnimationItem = {
    scene_index: 1,
    beat_id: "beat_1",
    start_time: 0.5,
    end_time: 2.5,
    frames: 60,
  };

  const resolved = resolveBeatTimingSource({
    voiceoverBeat: voBeat,
    renderAnimation: staleRender,
    isRenderStale: true,
  });

  assert.equal(resolved.source, "voiceover");
  assert.equal(resolved.startTime, 1.0);
  assert.equal(resolved.endTime, 4.0);
});

test("36. correlateBeatsWithTelemetry: Matches rendered beat animation by composite scene_index and beat_id", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 5.0,
      visual_beats: [
        { id: "b1_1", order: 1, narration_text: "Beat 1.1" },
        { id: "b1_2", order: 2, narration_text: "Beat 1.2" },
      ],
    },
  ];

  const renderData: RenderData = {
    video_path: "video.mp4",
    render_mode: "beat",
    beats_rendered: 2,
    animations: [
      {
        scene_index: 1,
        beat_id: "b1_1",
        beat_order: 1,
        render_mode: "beat",
        animation_type: "zoom-in",
        duration_seconds: 2.5,
        frames: 75,
      },
      {
        scene_index: 1,
        beat_id: "b1_2",
        beat_order: 2,
        render_mode: "beat",
        animation_type: "pan-right",
        duration_seconds: 2.5,
        frames: 75,
      },
    ],
  };

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    renderData,
  });

  assert.equal(correlated.scenes.length, 1);
  const beats = correlated.scenes[0].beats;
  assert.equal(beats.length, 2);

  assert.equal(beats[0].telemetry.status, "rendered");
  if (beats[0].telemetry.status === "rendered") {
    assert.equal(beats[0].telemetry.animation.animation_type, "zoom-in");
    assert.equal(beats[0].telemetry.animation.frames, 75);
  }

  assert.equal(beats[1].telemetry.status, "rendered");
  if (beats[1].telemetry.status === "rendered") {
    assert.equal(beats[1].telemetry.animation.animation_type, "pan-right");
  }
});

test("37. correlateBeatsWithTelemetry: Fallback to beat_order when beat_id differs", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [
        { id: "frontend_beat_id", order: 1, narration_text: "Beat 1" },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "beat",
    animations: [
      {
        scene_index: 1,
        beat_id: "backend_generated_id",
        beat_order: 1,
        render_mode: "beat",
        animation_type: "zoom-out",
        frames: 60,
      },
    ],
  };

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    renderData,
  });

  const beat = correlated.scenes[0].beats[0];
  assert.equal(beat.telemetry.status, "rendered");
  if (beat.telemetry.status === "rendered") {
    assert.equal(beat.telemetry.animation.animation_type, "zoom-out");
  }
});

test("38. correlateBeatsWithTelemetry: Multi-scene isolation - same beat_order in different scenes never collides", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 3.0,
      visual_beats: [{ id: "b1", order: 1, narration_text: "S1 Beat 1" }],
    },
    {
      index: 2,
      narration: "Scene 2",
      image_prompt: "P2",
      shot_type: "close-up",
      est_seconds: 3.0,
      visual_beats: [{ id: "b2", order: 1, narration_text: "S2 Beat 1" }],
    },
  ];

  const renderData: RenderData = {
    render_mode: "beat",
    animations: [
      {
        scene_index: 1,
        beat_id: "b1",
        beat_order: 1,
        animation_type: "zoom-in",
      },
      // Note: Scene 2 beat 1 is not in animations!
    ],
  };

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    renderData,
  });

  assert.equal(correlated.scenes[0].beats[0].telemetry.status, "rendered");
  // Scene 2 beat 1 must NOT get Scene 1's animation despite having the same beat_order: 1!
  assert.equal(correlated.scenes[1].beats[0].telemetry.status, "unavailable");
});

test("39. correlateBeatsWithTelemetry: Scene-level fallback correctly flagged as scene_fallback with fallback reason", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 5.0,
      visual_beats: [
        { id: "b1_1", order: 1, narration_text: "Beat 1.1" },
        { id: "b1_2", order: 2, narration_text: "Beat 1.2" },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "scene",
    beat_fallback_reasons: {
      "1": "Unfeasible pan animation",
    },
    animations: [
      {
        scene_index: 1,
        render_mode: "scene",
        animation_type: "zoom-in",
        fallback_applied: true,
        fallback_reason: "Unfeasible pan animation",
      },
    ],
  };

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    renderData,
  });

  const b1 = correlated.scenes[0].beats[0];
  const b2 = correlated.scenes[0].beats[1];

  assert.equal(b1.telemetry.status, "scene_fallback");
  assert.equal(b2.telemetry.status, "scene_fallback");

  if (b1.telemetry.status === "scene_fallback") {
    assert.equal(b1.telemetry.beatFallbackReason, "Unfeasible pan animation");
    assert.equal(b1.telemetry.sceneAnimation?.animation_type, "zoom-in");
  }
});

test("40. correlateBeatsWithTelemetry: Missing render telemetry correctly mapped as unavailable", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [{ id: "b1", order: 1, narration_text: "Beat 1" }],
    },
  ];

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    renderData: null,
  });

  const beat = correlated.scenes[0].beats[0];
  assert.equal(beat.telemetry.status, "unavailable");
});

test("41. correlateBeatsWithTelemetry: Stale render telemetry mapped as stale with isStale: true", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [{ id: "b1", order: 1, narration_text: "Beat 1" }],
    },
  ];

  const staleRenderData: RenderData = {
    render_mode: "beat",
    animations: [
      {
        scene_index: 1,
        beat_id: "b1",
        beat_order: 1,
        render_mode: "beat",
        animation_type: "zoom-in",
      },
    ],
  };

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    renderData: staleRenderData,
    isRenderStale: true,
  });

  const beat = correlated.scenes[0].beats[0];
  assert.equal(beat.telemetry.status, "stale");
  if (beat.telemetry.status === "stale") {
    assert.equal(beat.telemetry.isStale, true);
    assert.equal(beat.telemetry.previousStatus, "rendered");
    assert.equal(beat.telemetry.previousAnimation?.animation_type, "zoom-in");
  }
});

test("42. correlateBeatsWithTelemetry: Voiceover beat overlays storyboard beat timing and narration", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Storyboard scene narration",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [
        {
          id: "b1",
          order: 1,
          narration_text: "Draft storyboard narration",
          start_time: 0.0,
          end_time: 2.0,
          timing_type: "unassigned",
        },
      ],
    },
  ];

  const voiceoverItems: VoiceoverItem[] = [
    {
      index: 1,
      scene_index: 1,
      narration: "Final voiceover scene text",
      status: "ok",
      reused: false,
      start_time: 0.0,
      end_time: 2.5,
      duration_seconds: 2.5,
      visual_beats: [
        {
          id: "b1",
          order: 1,
          narration_text: "Aligned voiceover narration",
          start_time: 0.1,
          end_time: 2.4,
          duration_seconds: 2.3,
          timing_type: "aligned",
          start_word_index: 0,
          end_word_index: 4,
        },
      ],
    },
  ];

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    voiceoverItems,
  });

  const beat = correlated.scenes[0].beats[0];
  assert.equal(beat.voiceoverBeat?.narration_text, "Aligned voiceover narration");
  assert.equal(beat.voiceoverBeat?.timing_type, "aligned");
  assert.equal(beat.resolvedTiming.source, "voiceover");
  assert.equal(beat.resolvedTiming.startTime, 0.1);
  assert.equal(beat.resolvedTiming.endTime, 2.4);
});

test("43. correlateBeatsWithTelemetry: Legacy scenes without visual beats correlate cleanly without errors", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Legacy scene",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 5.0,
    },
  ];

  const renderData: RenderData = {
    render_mode: "scene",
    animations: [
      {
        scene_index: 1,
        animation_type: "pan-left",
      },
    ],
  };

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    renderData,
  });

  assert.equal(correlated.scenes.length, 1);
  assert.equal(correlated.scenes[0].beats.length, 0);
  assert.equal(correlated.scenes[0].sceneTelemetry?.animation_type, "pan-left");
});

test("44. resolveCorrelatedBeatTiming: End-to-end timing resolution from correlated result", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "medium",
      est_seconds: 3.0,
      visual_beats: [
        {
          id: "b1",
          order: 1,
          narration_text: "Beat 1 narration",
          start_time: 0.0,
          end_time: 3.0,
          timing_type: "aligned",
        },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "beat",
    animations: [
      {
        scene_index: 1,
        beat_id: "b1",
        beat_order: 1,
        start_time: 0.2,
        end_time: 2.8,
        frames: 78,
      },
    ],
  };

  const correlated = correlateBeatsWithTelemetry({
    scenes,
    renderData,
  });

  const beatItem = correlated.scenes[0].beats[0];
  const timing = resolveCorrelatedBeatTiming(beatItem);

  assert.equal(timing.source, "render");
  assert.equal(timing.startTime, 0.2);
  assert.equal(timing.endTime, 2.8);
  assert.equal(timing.durationSeconds, 2.6);
});

test("45. Stage 3.5.5.3: VisualBeatCard telemetry helper produces rendered badge with motion and frames", () => {
  const telemetry: BeatTelemetryInfo = {
    status: "rendered",
    sceneIndex: 1,
    beatId: "b1",
    beatOrder: 1,
    animation: {
      scene_index: 1,
      beat_id: "b1",
      beat_order: 1,
      animation_type: "zoom-in",
      start_time: 0.0,
      end_time: 2.5,
      frames: 75,
      duration_seconds: 2.5,
    },
    durationSeconds: 2.5,
    frames: 75,
    isStale: false,
    feasibilityStatus: "feasible",
  };

  const display = getTimelineTelemetryDisplay(telemetry);
  assert.equal(display.label, "Rendered");
  assert.equal(display.icon, "✓");
  assert.ok(display.badgeStyle.includes("emerald"));
  assert.ok(display.accessibleText.includes("Rendered"));
  assert.equal(telemetry.animation?.animation_type, "zoom-in");
  assert.equal(telemetry.frames, 75);
});

test("46. Stage 3.5.5.3: Scene fallback beat telemetry produces explicit fallback notice and is NEVER rendered", () => {
  const telemetry: BeatTelemetryInfo = {
    status: "scene_fallback",
    sceneIndex: 2,
    beatId: "b2",
    beatOrder: 1,
    fallbackReason: "Voiceover alignment unavailable for scene 2",
    beatFallbackReason: "Scene-level fallback triggered",
    isStale: false,
  };

  const display = getTimelineTelemetryDisplay(telemetry);
  assert.equal(display.label, "Scene Fallback");
  assert.equal(display.icon, "⚠️");
  assert.ok(display.badgeStyle.includes("amber"));
  assert.ok(display.accessibleText.includes("fallback"));
  // Must NOT claim to be rendered
  assert.notEqual(telemetry.status, "rendered");
  if (telemetry.status === "scene_fallback") {
    assert.equal(telemetry.animation, undefined);
  }
});

test("47. Stage 3.5.5.3: Stale render telemetry produces stale status badge", () => {
  const telemetry: BeatTelemetryInfo = {
    status: "stale",
    sceneIndex: 1,
    beatId: "b1",
    beatOrder: 1,
    previousStatus: "rendered",
    isStale: true,
  };

  const display = getTimelineTelemetryDisplay(telemetry);
  assert.equal(display.label, "Stale Render");
  assert.equal(display.icon, "🔄");
  assert.ok(display.badgeStyle.includes("purple"));
  assert.ok(display.accessibleText.includes("Stale"));
});

test("48. Stage 3.5.5.3: Scene-level fallback is accurately identified per scene and beats count is isolated", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1 rendered beats",
      image_prompt: "P1",
      shot_type: "wide",
      est_seconds: 4.0,
      visual_beats: [
        { id: "s1_b1", order: 1, narration_text: "Beat 1", start_time: 0.0, end_time: 2.0 },
        { id: "s1_b2", order: 2, narration_text: "Beat 2", start_time: 2.0, end_time: 4.0 },
      ],
    },
    {
      index: 2,
      narration: "Scene 2 fallback",
      image_prompt: "P2",
      shot_type: "medium",
      est_seconds: 3.0,
      visual_beats: [
        { id: "s2_b1", order: 1, narration_text: "Beat 1", start_time: 4.0, end_time: 7.0 },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "visual_beats",
    animations: [
      { scene_index: 1, beat_id: "s1_b1", animation_type: "zoom-in", frames: 60, start_time: 0.0, end_time: 2.0 },
      { scene_index: 1, beat_id: "s1_b2", animation_type: "pan-left", frames: 60, start_time: 2.0, end_time: 4.0 },
    ],
    scene_fallbacks: {
      2: "Missing word alignment for scene 2",
    },
  };

  const correlation = correlateBeatsWithTelemetry({
    scenes,
    renderData,
  });

  // Scene 1 assertions
  assert.equal(correlation.sceneFallbacks.has(1), false);
  const s1Beats = scenes[0].visual_beats ?? [];
  const s1Rendered = s1Beats.filter(
    (b) => correlation.beatTelemetry.get(b.id!)?.status === "rendered"
  ).length;
  assert.equal(s1Rendered, 2);
  assert.equal(s1Rendered, s1Beats.length); // All Beats Rendered

  // Scene 2 assertions
  assert.equal(correlation.sceneFallbacks.has(2), true);
  assert.equal(correlation.sceneFallbacks.get(2), "Missing word alignment for scene 2");
  const s2Beats = scenes[1].visual_beats ?? [];
  const s2Rendered = s2Beats.filter(
    (b) => correlation.beatTelemetry.get(b.id!)?.status === "rendered"
  ).length;
  assert.equal(s2Rendered, 0); // None rendered
  assert.equal(correlation.beatTelemetry.get("s2_b1")?.status, "scene_fallback");
});

test("49. Stage 3.5.5.3: Top summary card metrics reflect total, rendered, and fallback scenes", () => {
  const scenes: StoryboardScene[] = [
    {
      index: 1,
      narration: "Scene 1",
      image_prompt: "P1",
      shot_type: "close-up",
      est_seconds: 3.0,
      visual_beats: [
        { id: "b1", order: 1, narration_text: "Text 1" },
        { id: "b2", order: 2, narration_text: "Text 2" },
      ],
    },
    {
      index: 2,
      narration: "Scene 2",
      image_prompt: "P2",
      shot_type: "wide",
      est_seconds: 3.0,
      visual_beats: [
        { id: "b3", order: 1, narration_text: "Text 3" },
      ],
    },
  ];

  const renderData: RenderData = {
    render_mode: "visual_beats",
    animations: [
      { scene_index: 1, beat_id: "b1", animation_type: "zoom-in", frames: 60 },
      { scene_index: 1, beat_id: "b2", animation_type: "zoom-out", frames: 60 },
    ],
    scene_fallbacks: {
      2: "Image crop infeasible",
    },
  };

  const correlation = correlateBeatsWithTelemetry({
    scenes,
    renderData,
    isRenderStale: false,
  });

  assert.equal(correlation.totalBeatsCount, 3);
  assert.equal(correlation.renderedBeatsCount, 2);
  assert.equal(correlation.fallbackBeatsCount, 1);
  assert.equal(correlation.sceneFallbacks.size, 1);
  assert.equal(correlation.isRenderStale, false);
});
