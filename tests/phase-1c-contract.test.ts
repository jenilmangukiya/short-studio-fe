import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_VISUAL_INTENTS,
  ALLOWED_VISUAL_TECHNIQUES,
  ALLOWED_BEAT_TRANSITIONS,
  VISUAL_INTENT_LABELS,
  VISUAL_TECHNIQUE_LABELS,
  isValidVisualIntent,
  isValidVisualTechnique,
  isValidBeatTransition,
  getVisualIntentLabel,
  getVisualTechniqueLabel,
  getBeatTransitionLabel,
  type ArtDirection,
  type CreativeDirectionOutput,
  type EntityBindings,
  type StoryboardBeat,
  type StoryboardScene,
  type VisualIntent,
  type VisualTechnique,
} from "../src/lib/types.ts";
import {
  parseAndValidateStoryboard,
  parseVisualBeat,
  updateSceneInList,
} from "../src/lib/storyboard.ts";

// ============================================================================
// 1. Creative Direction & Removal of Obsolete Visual Genre
// ============================================================================

test("Phase 1C — Creative Direction completely removes visual_genre and uses frozen style snapshot", () => {
  // CreativeDirectionOutput object conforming strictly to the updated contract
  const cd: CreativeDirectionOutput = {
    format_archetype: "explainer_myth_bust",
    storytelling_angle: "The counter-intuitive physics of cold water shock",
    central_thesis: "The mammalian dive reflex triggers immediate involuntary gasp before freezing",
    tone: "urgent and scientific",
    protagonist_config: {
      human_presence: "contextual",
      archetype_summary: "Swimmers and rescue divers",
    },
    emotional_progression: [
      {
        phase: "hook",
        target_emotion: "curiosity",
        visual_intent: "establishing",
      },
      {
        phase: "resolution",
        target_emotion: "relief",
        visual_intent: "narrative_resolution",
      },
    ],
    creative_constraints: ["Zero visible modern diving gear", "No animated text overlays"],
  };

  assert.equal(cd.format_archetype, "explainer_myth_bust");
  assert.equal(cd.storytelling_angle, "The counter-intuitive physics of cold water shock");
  assert.equal(cd.central_thesis, "The mammalian dive reflex triggers immediate involuntary gasp before freezing");
  assert.equal(cd.tone, "urgent and scientific");
  assert.equal(cd.protagonist_config.human_presence, "contextual");
  assert.equal(cd.creative_constraints?.length, 2);

  // Compile-time and runtime check: visual_genre is NOT a property of CreativeDirectionOutput
  const cdRecord = cd as unknown as Record<string, unknown>;
  assert.equal("visual_genre" in cdRecord, false);
  assert.equal(cdRecord.visual_genre, undefined);

  // ArtDirection in VideoBible also removes visual_genre
  const artDir: ArtDirection = {
    style_family: "stylized_2d_narrative",
    rendering_texture: "clean graphic linework with subtle paper grain",
    lighting_philosophy: "dramatic low-key directional lighting",
    primary_palette_hex: ["#1A1A24", "#F4EBD9", "#E63946"],
    negative_prompt_tokens: "3d render, photorealism, CGI",
    negative_anchors: ["photorealism"],
  };

  const artRecord = artDir as unknown as Record<string, unknown>;
  assert.equal("visual_genre" in artRecord, false);
  assert.equal(artRecord.visual_genre, undefined);
  assert.equal(artDir.style_family, "stylized_2d_narrative");
});

// ============================================================================
// 2. Visual Intent Canonical Values and Rejection of Obsolete Values
// ============================================================================

test("Phase 1C — Visual Intent enforces exactly eight canonical values and rejects character_moment", () => {
  const canonicalIntents: VisualIntent[] = [
    "establishing",
    "action_event",
    "environmental_context",
    "mechanism_explanation",
    "human_experience",
    "detail_focus",
    "abstract_visualization",
    "narrative_resolution",
  ];

  // Exactly 8 canonical values in ALLOWED_VISUAL_INTENTS
  assert.equal(ALLOWED_VISUAL_INTENTS.length, 8);
  for (const intent of canonicalIntents) {
    assert.ok(ALLOWED_VISUAL_INTENTS.includes(intent), `Missing canonical intent: ${intent}`);
    assert.equal(isValidVisualIntent(intent), true);
    assert.ok(VISUAL_INTENT_LABELS[intent], `Missing label for canonical intent: ${intent}`);
    assert.equal(getVisualIntentLabel(intent).length > 0, true);
  }

  // Exact readable display labels
  assert.equal(getVisualIntentLabel("establishing"), "Establishing");
  assert.equal(getVisualIntentLabel("action_event"), "Action Event");
  assert.equal(getVisualIntentLabel("environmental_context"), "Environmental Context");
  assert.equal(getVisualIntentLabel("mechanism_explanation"), "Mechanism Explanation");
  assert.equal(getVisualIntentLabel("human_experience"), "Human Experience");
  assert.equal(getVisualIntentLabel("detail_focus"), "Detail Focus");
  assert.equal(getVisualIntentLabel("abstract_visualization"), "Abstract Visualization");
  assert.equal(getVisualIntentLabel("narrative_resolution"), "Narrative Resolution");

  // Rejection of character_moment (obsolete from Phase 1A/B design)
  assert.equal(isValidVisualIntent("character_moment"), false);
  assert.equal((ALLOWED_VISUAL_INTENTS as readonly string[]).includes("character_moment"), false);

  // Rejection of non-canonical, empty, or malformed intents
  assert.equal(isValidVisualIntent("arbitrary_intent"), false);
  assert.equal(isValidVisualIntent(""), false);
  assert.equal(isValidVisualIntent(123), false);
  assert.equal(isValidVisualIntent(null), false);
  assert.equal(isValidVisualIntent(undefined), false);

  // Parsing a beat with character_moment falls back safely to defaultVisualIntent
  const beatWithObsoleteIntent = parseVisualBeat({
    id: "beat_obsolete",
    order: 1,
    narration_text: "A character reacts.",
    visual_intent: "character_moment",
  }, 1, "environmental_context");

  assert.ok(beatWithObsoleteIntent);
  assert.equal(beatWithObsoleteIntent.visual_intent, "environmental_context");
});

// ============================================================================
// 3. Visual Technique Canonical Union and Invalid Technique Rejection
// ============================================================================

test("Phase 1C — Visual Technique strict union and readable display labels", () => {
  const canonicalTechniques: VisualTechnique[] = [
    "cinematic_illustration",
    "physical_close_up",
    "in_scene_cue",
    "cutaway",
    "diagram",
  ];

  // Exactly 5 canonical values in ALLOWED_VISUAL_TECHNIQUES
  assert.equal(ALLOWED_VISUAL_TECHNIQUES.length, 5);
  for (const tech of canonicalTechniques) {
    assert.ok(ALLOWED_VISUAL_TECHNIQUES.includes(tech), `Missing canonical technique: ${tech}`);
    assert.equal(isValidVisualTechnique(tech), true);
    assert.ok(VISUAL_TECHNIQUE_LABELS[tech], `Missing label for canonical technique: ${tech}`);
  }

  // Exact required readable display labels
  assert.equal(getVisualTechniqueLabel("cinematic_illustration"), "Cinematic Illustration");
  assert.equal(getVisualTechniqueLabel("physical_close_up"), "Physical Close-up");
  assert.equal(getVisualTechniqueLabel("in_scene_cue"), "In-scene Cue");
  assert.equal(getVisualTechniqueLabel("cutaway"), "Cutaway");
  assert.equal(getVisualTechniqueLabel("diagram"), "Diagram");

  // Empty / null handling
  assert.equal(getVisualTechniqueLabel(undefined), "");
  assert.equal(getVisualTechniqueLabel(null), "");
});

test("Phase 1C — Invalid visual technique rejection in parsing and validation", () => {
  // 1. isValidVisualTechnique rejects non-canonical values
  assert.equal(isValidVisualTechnique("technical-illustration"), false);
  assert.equal(isValidVisualTechnique("macro-photo"), false);
  assert.equal(isValidVisualTechnique("cinematic-photo"), false);
  assert.equal(isValidVisualTechnique("slow-pan"), false);
  assert.equal(isValidVisualTechnique("arbitrary_free_text"), false);
  assert.equal(isValidVisualTechnique(""), false);
  assert.equal(isValidVisualTechnique(null), false);
  assert.equal(isValidVisualTechnique(undefined), false);

  // 2. parseVisualBeat rejects invalid visual technique
  const beatWithInvalidTech = parseVisualBeat({
    id: "beat_bad_tech",
    order: 1,
    narration_text: "Narration text",
    visual_intent: "detail_focus",
    visual_technique: "invalid_unrestricted_string",
  });
  assert.ok(beatWithInvalidTech);
  assert.equal(beatWithInvalidTech.visual_technique, undefined);

  // 3. parseVisualBeat preserves canonical visual technique
  const beatWithCanonicalTech = parseVisualBeat({
    id: "beat_good_tech",
    order: 1,
    narration_text: "Schematic view of gear tooth pressure.",
    visual_intent: "mechanism_explanation",
    visual_technique: "diagram",
  });
  assert.ok(beatWithCanonicalTech);
  assert.equal(beatWithCanonicalTech.visual_technique, "diagram");

  // 4. parseAndValidateStoryboard rejects invalid scene and beat techniques
  const payload = {
    storyboard: {
      visual_style: "stylized_2d_narrative",
      style_source: "preset",
      total_seconds: 5.0,
      scenes: [
        {
          index: 1,
          narration: "A detailed cutaway into the volcanic chamber.",
          image_prompt: "Cutaway of magma channels.",
          shot_type: "cutaway",
          est_seconds: 5.0,
          visual_intent: "mechanism_explanation",
          visual_technique: "cutaway",
          visual_beats: [
            {
              id: "b1_1",
              order: 1,
              narration_text: "A detailed cutaway",
              visual_intent: "mechanism_explanation",
              visual_technique: "cutaway",
            },
            {
              id: "b1_2",
              order: 2,
              narration_text: "into the volcanic chamber.",
              visual_intent: "detail_focus",
              visual_technique: "unrestricted_legacy_technique", // Invalid!
            },
          ],
        },
        {
          index: 2,
          narration: "Scene with invalid top-level technique.",
          image_prompt: "Exterior view.",
          shot_type: "wide",
          est_seconds: 4.0,
          visual_intent: "establishing",
          visual_technique: "bogus_technique", // Invalid!
        },
      ],
    },
  };

  const validated = parseAndValidateStoryboard(payload);
  assert.ok(validated);
  assert.equal(validated.scenes.length, 2);

  // Scene 1: valid technique preserved
  assert.equal(validated.scenes[0].visual_technique, "cutaway");
  assert.equal(validated.scenes[0].visual_beats?.[0].visual_technique, "cutaway");
  // Beat 2 had invalid technique, so it falls back to scene technique ("cutaway")
  assert.equal(validated.scenes[0].visual_beats?.[1].visual_technique, "cutaway");

  // Scene 2: invalid top-level technique is rejected (undefined)
  assert.equal(validated.scenes[1].visual_technique, undefined);
});

// ============================================================================
// 4. Separation of Visual Intent and Visual Technique
// ============================================================================

test("Phase 1C — Visual intent and visual technique remain orthogonal and distinct", () => {
  // An explanatory mechanism scene can be presented using cinematic illustration, physical close-up, or diagram
  const scene1: StoryboardScene = {
    index: 1,
    narration: "The fuel injector atomizes high-pressure kerosene.",
    image_prompt: "Close up of fuel droplets leaving brass nozzle.",
    shot_type: "macro",
    est_seconds: 4.0,
    visual_intent: "mechanism_explanation", // Purpose: explaining a mechanism
    visual_technique: "physical_close_up",  // Technique: physical close-up (NOT a diagram!)
  };

  const scene2: StoryboardScene = {
    index: 2,
    narration: "Pressure waves travel across the chamber.",
    image_prompt: "Vector flow schematic with pressure gradients.",
    shot_type: "diagram",
    est_seconds: 4.0,
    visual_intent: "mechanism_explanation", // Same intent: explaining a mechanism
    visual_technique: "diagram",            // Different technique: standalone diagram
  };

  const scene3: StoryboardScene = {
    index: 3,
    narration: "The night sky filled with falling volcanic glass.",
    image_prompt: "Atmospheric evening rain of dark tephra.",
    shot_type: "wide",
    est_seconds: 4.0,
    visual_intent: "environmental_context",
    visual_technique: "cinematic_illustration",
  };

  assert.notEqual(scene1.visual_technique, scene1.visual_intent);
  assert.equal(scene1.visual_intent, "mechanism_explanation");
  assert.equal(scene1.visual_technique, "physical_close_up");

  assert.equal(scene2.visual_intent, "mechanism_explanation");
  assert.equal(scene2.visual_technique, "diagram");

  assert.equal(scene3.visual_intent, "environmental_context");
  assert.equal(scene3.visual_technique, "cinematic_illustration");
});

// ============================================================================
// 5. Preservation of Entity Bindings and Transitions (including spatial_cutaway)
// ============================================================================

test("Phase 1C — Storyboard parsing and editing preserves entity bindings and spatial_cutaway transitions", () => {
  const entityBindings: EntityBindings = {
    character_id: "char_pilot_eva",
    secondary_character_ids: ["char_copilot_dan"],
    environment_id: "env_cockpit_cabin",
    object_ids: ["obj_flight_yoke", "obj_altimeter"],
    machine_ids: ["mach_turbofan_engine"],
    concept_id: "concept_aerodynamic_stall",
  };

  // Verify spatial_cutaway transition is canonical and labeled
  assert.ok(ALLOWED_BEAT_TRANSITIONS.includes("spatial_cutaway"));
  assert.equal(isValidBeatTransition("spatial_cutaway"), true);
  assert.equal(getBeatTransitionLabel("spatial_cutaway"), "Spatial Cutaway");

  const rawStoryboard = {
    storyboard: {
      visual_style: "stylized_2d_narrative",
      style_source: "preset",
      total_seconds: 6.0,
      scenes: [
        {
          index: 1,
          narration: "Inside the cockpit, warning indicators flashed amber.",
          image_prompt: "Pilot hands on the vibrating flight yoke.",
          shot_type: "medium_close_up",
          est_seconds: 3.0,
          visual_intent: "human_experience",
          visual_technique: "in_scene_cue",
          transition_from_previous: "establishing",
          entity_bindings: entityBindings,
          visual_beats: [
            {
              id: "b1_1",
              order: 1,
              narration_text: "Inside the cockpit,",
              visual_intent: "environmental_context",
              visual_technique: "in_scene_cue",
              entity_bindings: entityBindings,
              transition_from_previous: "establishing",
            },
            {
              id: "b1_2",
              order: 2,
              narration_text: "warning indicators flashed amber.",
              visual_intent: "detail_focus",
              visual_technique: "physical_close_up",
              entity_bindings: entityBindings,
              transition_from_previous: "same_scene_reframe",
            },
          ],
        },
        {
          index: 2,
          narration: "Simultaneously, ice was accreting across the pitot tube exterior.",
          image_prompt: "Exterior cutaway showing airflow freezing over the sensor port.",
          shot_type: "cutaway",
          est_seconds: 3.0,
          visual_intent: "mechanism_explanation",
          visual_technique: "cutaway",
          transition_from_previous: "spatial_cutaway", // Transition to outside exterior!
          entity_bindings: {
            ...entityBindings,
            environment_id: "env_exterior_fuselage",
          },
          visual_beats: [
            {
              id: "b2_1",
              order: 1,
              narration_text: "Simultaneously, ice was accreting across the pitot tube exterior.",
              visual_intent: "mechanism_explanation",
              visual_technique: "cutaway",
              transition_from_previous: "spatial_cutaway",
              entity_bindings: {
                ...entityBindings,
                environment_id: "env_exterior_fuselage",
              },
            },
          ],
        },
      ],
    },
  };

  const parsed = parseAndValidateStoryboard(rawStoryboard);
  assert.ok(parsed);
  assert.equal(parsed.scenes.length, 2);

  // Scene 1 bindings and transitions
  const s1 = parsed.scenes[0];
  assert.equal(s1.transition_from_previous, "establishing");
  assert.deepEqual(s1.entity_bindings, entityBindings);
  assert.equal(s1.visual_beats?.[0].transition_from_previous, "establishing");
  assert.deepEqual(s1.visual_beats?.[0].entity_bindings, entityBindings);

  // Scene 2 spatial_cutaway transition and bindings
  const s2 = parsed.scenes[1];
  assert.equal(s2.transition_from_previous, "spatial_cutaway");
  assert.equal(s2.visual_technique, "cutaway");
  assert.equal(s2.entity_bindings?.environment_id, "env_exterior_fuselage");
  assert.equal(s2.entity_bindings?.concept_id, "concept_aerodynamic_stall");
  assert.equal(s2.visual_beats?.[0].transition_from_previous, "spatial_cutaway");

  // Verify inline editing preserves entity bindings and transitions
  const updatedScenes = updateSceneInList(parsed.scenes, 2, {
    narration: "Simultaneously, severe rime ice choked the sensor.",
    visual_intent: "mechanism_explanation",
    visual_technique: "cutaway",
  });

  const updatedScene2 = updatedScenes[1];
  assert.equal(updatedScene2.narration, "Simultaneously, severe rime ice choked the sensor.");
  assert.equal(updatedScene2.visual_intent, "mechanism_explanation");
  assert.equal(updatedScene2.visual_technique, "cutaway");
  assert.equal(updatedScene2.transition_from_previous, "spatial_cutaway");
  assert.deepEqual(updatedScene2.entity_bindings, {
    ...entityBindings,
    environment_id: "env_exterior_fuselage",
  });
  assert.equal(updatedScene2.visual_beats?.length, 1);
  assert.equal(updatedScene2.visual_beats?.[0].transition_from_previous, "spatial_cutaway");
});

// ============================================================================
// 6. Backend Contract Alignment
// ============================================================================

test("Phase 1C — StoryboardBeat matches canonical backend contract", () => {
  const beat: StoryboardBeat = {
    beat_id: "beat_scene_1_1",
    scene_index: 1,
    order: 1,
    narration_slice: "An enormous volcanic plume ascends 40 kilometers.",
    duration_est_seconds: 3.5,
    visual_intent: "establishing",
    visual_technique: "cinematic_illustration",
    entity_bindings: {
      environment_id: "env_sumbawa_caldera",
      concept_id: "concept_ash_injection",
      character_id: null,
      object_ids: [],
      secondary_character_ids: [],
    },
    transition_from_previous: "establishing",
    continuity_intent: "Establish setting scale",
    camera: {
      shot_type: "extreme_wide",
      camera_angle: "low_angle",
      focal_point_description: "Massive towering volcanic ash column",
      movement_type: "pull_out",
    },
    character_state: null,
    environment_state_override: "ash twilight with red glow",
    foley_cues: [
      {
        foley_id: "foley_distant_rumble",
        offset_seconds: 0.2,
        relative_volume: 0.8,
      },
    ],
    final_prompt: "Stylized 2D narrative art. Massive smoking caldera with towering ash plume.",
  };

  assert.equal(beat.beat_id, "beat_scene_1_1");
  assert.equal(beat.scene_index, 1);
  assert.equal(beat.visual_intent, "establishing");
  assert.equal(beat.visual_technique, "cinematic_illustration");
  assert.equal(beat.entity_bindings.environment_id, "env_sumbawa_caldera");
  assert.equal(beat.transition_from_previous, "establishing");
  assert.equal(beat.camera.shot_type, "extreme_wide");
  assert.equal(beat.foley_cues?.[0].foley_id, "foley_distant_rumble");
});
