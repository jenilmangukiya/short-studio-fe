import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_VISUAL_INTENTS,
  ENVIRONMENT_TYPE_LABELS,
  HUMAN_PRESENCE_LABELS,
  VISUAL_INTENT_LABELS,
  getEnvironmentTypeLabel,
  getHumanPresenceLabel,
  getVisualIntentLabel,
  isValidVisualIntent,
  type EnvironmentEntity,
  type EnvironmentType,
  type HumanPresence,
  type ProtagonistConfig,
  type VisualIntent,
} from "../src/lib/types.ts";
import {
  parseAndValidateStoryboard,
  updateSceneInList,
} from "../src/lib/storyboard.ts";

test("Phase 1B — Human Presence canonical contract and labels", () => {
  const allowedValues: HumanPresence[] = ["none", "contextual", "single", "ensemble"];

  // 1. All 4 values map to exact human-readable labels specified in requirements
  assert.equal(getHumanPresenceLabel("none"), "No Humans");
  assert.equal(getHumanPresenceLabel("contextual"), "Contextual Humans");
  assert.equal(getHumanPresenceLabel("single"), "Single Protagonist");
  assert.equal(getHumanPresenceLabel("ensemble"), "Recurring Ensemble");

  // 2. Default/fallback behavior
  assert.equal(getHumanPresenceLabel(null), "No Humans");
  assert.equal(getHumanPresenceLabel(undefined), "No Humans");

  // 3. ProtagonistConfig accepts only human_presence, not character_count
  const config1: ProtagonistConfig = {
    human_presence: "none",
  };
  assert.equal(config1.human_presence, "none");
  assert.equal(config1.archetype_summary, undefined);

  const config2: ProtagonistConfig = {
    human_presence: "contextual",
    archetype_summary: "Local eyewitnesses and emergency workers",
  };
  assert.equal(config2.human_presence, "contextual");
  assert.equal(config2.archetype_summary, "Local eyewitnesses and emergency workers");

  // Verify HUMAN_PRESENCE_LABELS mapping completeness
  for (const val of allowedValues) {
    assert.ok(HUMAN_PRESENCE_LABELS[val], `Missing label for ${val}`);
  }
});

test("Phase 1B — Visual Intent canonical values and labels", () => {
  const expectedValues: VisualIntent[] = [
    "establishing",
    "action_event",
    "environmental_context",
    "mechanism_explanation",
    "human_experience",
    "detail_focus",
    "abstract_visualization",
    "narrative_resolution",
  ];

  // 1. All 8 required values are recognized
  assert.equal(ALLOWED_VISUAL_INTENTS.length, 8);
  for (const intent of expectedValues) {
    assert.ok(isValidVisualIntent(intent), `${intent} should be valid VisualIntent`);
    assert.ok(VISUAL_INTENT_LABELS[intent], `Missing label for ${intent}`);
  }

  // 2. Reject arbitrary strings
  assert.equal(isValidVisualIntent("random_unknown"), false);
  assert.equal(isValidVisualIntent(123), false);
  assert.equal(isValidVisualIntent(null), false);

  // 3. Human-readable labels
  assert.equal(getVisualIntentLabel("establishing"), "Establishing");
  assert.equal(getVisualIntentLabel("action_event"), "Action Event");
  assert.equal(getVisualIntentLabel("environmental_context"), "Environmental Context");
  assert.equal(getVisualIntentLabel("mechanism_explanation"), "Mechanism Explanation");
  assert.equal(getVisualIntentLabel("human_experience"), "Human Experience");
  assert.equal(getVisualIntentLabel("detail_focus"), "Detail Focus");
  assert.equal(getVisualIntentLabel("abstract_visualization"), "Abstract Visualization");
  assert.equal(getVisualIntentLabel("narrative_resolution"), "Narrative Resolution");
  assert.equal(getVisualIntentLabel(undefined), "");
  assert.equal(getVisualIntentLabel(null), "");
});

test("Phase 1B — Storyboard parsing validates and preserves visual_intent", () => {
  const payload = {
    storyboard: {
      visual_style: "Cinematic realism",
      style_source: "preset",
      total_seconds: 9.0,
      scenes: [
        {
          index: 1,
          narration: "Scene 1 narration.",
          image_prompt: "Opening shot of mountains.",
          shot_type: "wide",
          est_seconds: 4.5,
          visual_intent: "establishing",
          visual_beats: [
            {
              id: "b1_1",
              order: 1,
              narration_text: "Scene 1 narration.",
              visual_description: "Wide mountain range at sunrise.",
              visual_intent: "establishing",
              shot_type: "wide",
              image_strategy: "new_image",
            },
          ],
        },
        {
          index: 2,
          narration: "Scene 2 narration explaining the gear mechanism.",
          image_prompt: "Exploded gear diagram.",
          shot_type: "close-up",
          est_seconds: 4.5,
          visual_intent: "mechanism_explanation",
          visual_beats: [
            {
              id: "b2_1",
              order: 1,
              narration_text: "Scene 2 narration explaining",
              visual_description: "Detailed view of the planetary gears.",
              visual_intent: "detail_focus",
              shot_type: "macro",
            },
            {
              id: "b2_2",
              order: 2,
              narration_text: "the gear mechanism.",
              visual_description: "Dynamic schematic with rotational torque arrows.",
              visual_intent: "mechanism_explanation",
              shot_type: "diagram",
            },
          ],
        },
      ],
    },
    warnings: [],
  };

  const parsed = parseAndValidateStoryboard(payload);
  assert.ok(parsed, "Parsed storyboard must not be null");
  assert.equal(parsed.scenes.length, 2);

  // Scene 1
  assert.equal(parsed.scenes[0].visual_intent, "establishing");
  assert.ok(parsed.scenes[0].visual_beats);
  assert.equal(parsed.scenes[0].visual_beats[0].visual_intent, "establishing");

  // Scene 2
  assert.equal(parsed.scenes[1].visual_intent, "mechanism_explanation");
  assert.ok(parsed.scenes[1].visual_beats);
  assert.equal(parsed.scenes[1].visual_beats[0].visual_intent, "detail_focus");
  assert.equal(parsed.scenes[1].visual_beats[1].visual_intent, "mechanism_explanation");

  // Updating a scene preserves or updates visual_intent
  const updated = updateSceneInList(parsed.scenes, 1, {
    narration: "Revised scene 1 narration.",
    visual_intent: "environmental_context",
  });
  assert.equal(updated[0].visual_intent, "environmental_context");
  assert.equal(updated[0].narration, "Revised scene 1 narration.");
  assert.equal(updated[1].visual_intent, "mechanism_explanation");
});

test("Phase 1B — Environment Metadata schema and label synchronization", () => {
  const allowedEnvTypes: EnvironmentType[] = [
    "exterior",
    "interior",
    "atmospheric",
    "macro_surface",
    "conceptual_void",
  ];

  // 1. Verify environment_type labels
  assert.equal(getEnvironmentTypeLabel("exterior"), "Exterior");
  assert.equal(getEnvironmentTypeLabel("interior"), "Interior");
  assert.equal(getEnvironmentTypeLabel("atmospheric"), "Atmospheric");
  assert.equal(getEnvironmentTypeLabel("macro_surface"), "Macro Surface");
  assert.equal(getEnvironmentTypeLabel("conceptual_void"), "Conceptual Void");
  assert.equal(getEnvironmentTypeLabel(undefined), "Exterior");

  for (const envType of allowedEnvTypes) {
    assert.ok(ENVIRONMENT_TYPE_LABELS[envType], `Missing label for ${envType}`);
  }

  // 2. Validate EnvironmentEntity shape adhering to backend schema
  const env: EnvironmentEntity = {
    id: "env_bedroom",
    name: "Cozy Bedroom",
    spatial_layout: "Rectangular 12x14 foot room with queen bed against north wall and large window east",
    lighting_setup: "Dim 2700K warm bedside lamp with gentle moonlight spill through sheer blinds",
    persistent_props: ["wooden nightstand", "linen comforter", "analog alarm clock"],
    time_of_day: "night",
    environment_type: "interior",
  };

  assert.equal(env.id, "env_bedroom");
  assert.equal(env.name, "Cozy Bedroom");
  assert.equal(env.environment_type, "interior");
  assert.equal(env.time_of_day, "night");
  assert.equal(env.persistent_props?.length, 3);
  assert.equal(getEnvironmentTypeLabel(env.environment_type), "Interior");
});
