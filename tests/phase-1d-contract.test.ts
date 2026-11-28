import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_DURATION_SECONDS,
  DURATION_PRESETS,
  FORMAT_ARCHETYPE_LABELS,
  getFormatArchetypeLabel,
  type CreativeDirectionOutput,
  type NarrativePlan,
  type NarrativeStage,
  type ScriptAttemptDiagnostic,
  type ScriptContent,
  type ScriptMeta,
  type VideoCreate,
  type VideoDetail,
  type VideoDurationMode,
  type VideoSummary,
} from "../src/lib/types.ts";

// ============================================================================
// 1. Video Creation Duration Controls & Payloads
// ============================================================================

test("Phase 1D — Default creation mode is automatic with target_duration null", () => {
  const defaultPayload: VideoCreate = {
    topic: "Why Do We Get Goosebumps When We Are Cold?",
    description: "Explain the arrector pili muscle evolution.",
    visual_style_id: "stickman_tactical_explainer",
    duration_mode: "auto",
    target_duration: null,
  };

  assert.equal(defaultPayload.duration_mode, "auto");
  assert.equal(defaultPayload.target_duration, null);
  assert.equal(defaultPayload.visual_style_id, "stickman_tactical_explainer");
});

test("Phase 1D — Manual duration mode requires valid target duration between 30 and 180 seconds", () => {
  const manualPayload: VideoCreate = {
    topic: "The Mystery of the Bloop",
    description: "Deep sea acoustic phenomenon target 45s",
    visual_style_id: "stylized_2d_narrative",
    duration_mode: "manual",
    target_duration: 45,
  };

  assert.equal(manualPayload.duration_mode, "manual");
  assert.equal(manualPayload.target_duration, 45);
  assert.equal(manualPayload.target_duration >= MIN_VIDEO_DURATION_SECONDS, true);
  assert.equal(manualPayload.target_duration <= MAX_VIDEO_DURATION_SECONDS, true);
  assert.equal(Number.isInteger(manualPayload.target_duration), true);
});

test("Phase 1D — Presets match the canonical backend supported list [30, 45, 60, 90, 120, 180]", () => {
  assert.deepEqual([...DURATION_PRESETS], [30, 45, 60, 90, 120, 180]);
  for (const preset of DURATION_PRESETS) {
    assert.equal(preset >= MIN_VIDEO_DURATION_SECONDS, true);
    assert.equal(preset <= MAX_VIDEO_DURATION_SECONDS, true);
  }
});

test("Phase 1D — Duration validation enforces boundaries and integer types", () => {
  function validateDuration(mode: VideoDurationMode, target: number | null): { valid: boolean; error?: string } {
    if (mode === "auto") {
      if (target !== null && target !== undefined) {
        return { valid: false, error: "Auto mode must not supply target duration" };
      }
      return { valid: true };
    }

    if (target === null || target === undefined || isNaN(target) || !Number.isInteger(target)) {
      return { valid: false, error: "Custom duration must be an integer" };
    }

    if (target < MIN_VIDEO_DURATION_SECONDS || target > MAX_VIDEO_DURATION_SECONDS) {
      return { valid: false, error: `Duration must be between ${MIN_VIDEO_DURATION_SECONDS} and ${MAX_VIDEO_DURATION_SECONDS}` };
    }

    return { valid: true };
  }

  // Valid auto
  assert.equal(validateDuration("auto", null).valid, true);

  // Invalid auto with manual target
  assert.equal(validateDuration("auto", 60).valid, false);

  // Valid manual boundaries
  assert.equal(validateDuration("manual", 30).valid, true);
  assert.equal(validateDuration("manual", 60).valid, true);
  assert.equal(validateDuration("manual", 180).valid, true);

  // Invalid manual bounds
  assert.equal(validateDuration("manual", 29).valid, false);
  assert.equal(validateDuration("manual", 181).valid, false);
  assert.equal(validateDuration("manual", 0).valid, false);
  assert.equal(validateDuration("manual", -60).valid, false);

  // Invalid non-integer
  assert.equal(validateDuration("manual", 45.5).valid, false);
  assert.equal(validateDuration("manual", NaN).valid, false);
});

// ============================================================================
// 2. NarrativePlan and NarrativeStage Backend Contract Synchronization
// ============================================================================

test("Phase 1D — NarrativeStage schema supports ordered storytelling beats with goals, pacing, and percentages", () => {
  const stage: NarrativeStage = {
    stage_name: "The Unexplained Cold Open",
    description: "Introduce the sudden 1997 ultra-low frequency ocean sound.",
    stage_goal: "Hook the viewer with an unsettling mystery",
    pacing: "deliberate",
    emotional_target: "curiosity and eerie tension",
    target_beat_percentage: 20,
  };

  assert.equal(stage.stage_name, "The Unexplained Cold Open");
  assert.equal(stage.description, "Introduce the sudden 1997 ultra-low frequency ocean sound.");
  assert.equal(stage.stage_goal, "Hook the viewer with an unsettling mystery");
  assert.equal(stage.pacing, "deliberate");
  assert.equal(stage.emotional_target, "curiosity and eerie tension");
  assert.equal(stage.target_beat_percentage, 20);
});

test("Phase 1D — NarrativePlan schema supports opening situation, progression stages, and resolution", () => {
  const plan: NarrativePlan = {
    narrative_perspective: "curious_investigator",
    opening_situation: "In the summer of 1997, deep ocean hydrophones picked up a sound louder than a blue whale.",
    information_revelation_strategy: "mystery_first_then_science",
    story_progression: [
      {
        stage_name: "The Anomaly",
        description: "Hydrophone array records 5,000 km anomaly.",
        pacing: "fast",
        target_beat_percentage: 25,
      },
      {
        stage_name: "The Cryptid Hypothesis",
        description: "Internet speculates about deep sea leviathans.",
        pacing: "moderate",
        target_beat_percentage: 25,
      },
      {
        stage_name: "The Glacial Truth",
        description: "NOAA links frequency to Antarctic icequake ice calving.",
        pacing: "revelatory",
        target_beat_percentage: 35,
      },
      {
        stage_name: "The Payoff",
        description: "Scale of ice sheet collapse dwarfing all biological sound.",
        pacing: "grand",
        target_beat_percentage: 15,
      },
    ],
    audience_takeaway: "The real planet is often stranger and more powerful than our monstrous imaginations.",
    resolution_payoff: "A satisfying scientific resolution to a mythical modern cryptid story.",
  };

  assert.equal(plan.narrative_perspective, "curious_investigator");
  assert.equal(plan.opening_situation?.includes("1997"), true);
  assert.equal(plan.information_revelation_strategy, "mystery_first_then_science");
  assert.equal(plan.story_progression?.length, 4);
  assert.equal(plan.audience_takeaway?.includes("stranger"), true);
  assert.equal(plan.resolution_payoff?.includes("scientific resolution"), true);

  // Total allocation sums to 100% guidance
  const totalAllocation = plan.story_progression?.reduce(
    (sum, s) => sum + (s.target_beat_percentage || 0),
    0
  );
  assert.equal(totalAllocation, 100);
});

test("Phase 1D — Storytelling Archetype formatting produces clean human-readable labels", () => {
  assert.equal(FORMAT_ARCHETYPE_LABELS.mystery_investigation, "Mystery Investigation");
  assert.equal(getFormatArchetypeLabel("experiential_history"), "Experiential History");
  assert.equal(getFormatArchetypeLabel("mystery_investigation"), "Mystery Investigation");
  assert.equal(getFormatArchetypeLabel("character_journey"), "Character Journey");
  assert.equal(getFormatArchetypeLabel("everyday_curiosity"), "Everyday Curiosity");
  assert.equal(getFormatArchetypeLabel("scientific_discovery"), "Scientific Discovery");
  assert.equal(getFormatArchetypeLabel("cause_and_effect"), "Cause and Effect");
  assert.equal(getFormatArchetypeLabel("direct_explanation"), "Direct Explanation");
  assert.equal(getFormatArchetypeLabel("explainer_myth_bust"), "Explainer / Myth Bust");
  assert.equal(getFormatArchetypeLabel("narrative_story"), "Narrative Story");

  // Fallback formatting for unknown archetype
  assert.equal(getFormatArchetypeLabel("unusual_format_story"), "Unusual Format Story");
  assert.equal(getFormatArchetypeLabel(null), "");
});

// ============================================================================
// 3. Creative Direction Output Duration Fields
// ============================================================================

test("Phase 1D — CreativeDirectionOutput retains duration fields and narrative plan without data loss", () => {
  const cd: CreativeDirectionOutput = {
    format_archetype: "mystery_investigation",
    storytelling_angle: "How a 1997 ocean recording spawned 15 years of monster rumors",
    central_thesis: "The Bloop was not a biological creature, but an Antarctic iceberg cracking.",
    tone: "investigative and atmospheric",
    protagonist_config: {
      human_presence: "contextual",
      archetype_summary: "Oceanographers and hydrophone operators",
    },
    recommended_duration_seconds: 75,
    resolved_target_duration: 75,
    duration_rationale: "Topic requires establishing the anomaly, exploring the mythical creature hype, and delivering the glacial physics resolution.",
    narrative_plan: {
      narrative_perspective: "curious_investigator",
      opening_situation: "In 1997, NOAA hydrophones heard something impossible.",
      story_progression: [
        { stage_name: "The Sound", description: "The mysterious recording." },
        { stage_name: "The Science", description: "The icequake revelation." },
      ],
    },
  };

  assert.equal(cd.recommended_duration_seconds, 75);
  assert.equal(cd.resolved_target_duration, 75);
  assert.equal(cd.duration_rationale?.includes("establishing the anomaly"), true);
  assert.equal(cd.narrative_plan?.story_progression?.length, 2);
});

// ============================================================================
// 4. Distinction Between Requested, Resolved, Estimated, and Actual Durations
// ============================================================================

test("Phase 1D — Duration lifecycle cleanly differentiates the 4 duration concepts", () => {
  interface PipelineStepMock {
    name: string;
    status: "pending" | "running" | "awaiting_approval" | "done" | "failed" | "stale";
    output?: Record<string, unknown>;
  }

  function resolveDurationLifecycle(
    video: { duration_mode?: VideoDurationMode; target_duration?: number | null },
    steps: PipelineStepMock[]
  ) {
    const cdStep = steps.find((s) => s.name === "creative_direction");
    const storyboardStep = steps.find((s) => s.name === "storyboard");
    const renderStep = steps.find((s) => s.name === "render");
    const voiceoverStep = steps.find((s) => s.name === "voiceover");

    // 1. Requested
    const requested = {
      mode: video.duration_mode || "auto",
      target: video.target_duration ?? null,
    };

    // 2. Resolved (only authoritative if CD is done and not stale)
    const isCdAuthoritative = cdStep?.status === "done";
    const cdOutput = cdStep?.output?.creative_direction as Record<string, unknown> | undefined;
    const resolvedTarget = isCdAuthoritative && typeof cdOutput?.resolved_target_duration === "number"
      ? (cdOutput.resolved_target_duration as number)
      : null;

    // 3. Estimated Narration (from Storyboard)
    const isStoryboardDone = storyboardStep?.status === "done";
    const sbOutput = storyboardStep?.output?.storyboard as Record<string, unknown> | undefined;
    const estimatedNarration = isStoryboardDone && typeof sbOutput?.total_seconds === "number"
      ? (sbOutput.total_seconds as number)
      : null;

    // 4. Actual Generated Duration
    const isRenderDone = renderStep?.status === "done";
    const renderOutput = renderStep?.output?.render as Record<string, unknown> | undefined;
    const actualRender = isRenderDone && typeof renderOutput?.duration_seconds === "number"
      ? (renderOutput.duration_seconds as number)
      : null;

    const isVoDone = voiceoverStep?.status === "done";
    const voOutput = voiceoverStep?.output?.voiceover as Record<string, unknown> | undefined;
    const actualAudio = isVoDone && typeof voOutput?.total_duration_seconds === "number"
      ? (voOutput.total_duration_seconds as number)
      : null;

    return {
      requested,
      resolvedTarget,
      isCdAuthoritative,
      estimatedNarration,
      actualRender,
      actualAudio,
    };
  }

  // Case A: Fresh video before pipeline runs
  const freshVideo = { duration_mode: "auto" as const, target_duration: null };
  const freshSteps: PipelineStepMock[] = [
    { name: "creative_direction", status: "pending" },
    { name: "script", status: "pending" },
    { name: "storyboard", status: "pending" },
  ];
  const freshResult = resolveDurationLifecycle(freshVideo, freshSteps);
  assert.equal(freshResult.requested.mode, "auto");
  assert.equal(freshResult.requested.target, null);
  // Must NOT invent a default resolved target
  assert.equal(freshResult.resolvedTarget, null);
  assert.equal(freshResult.isCdAuthoritative, false);
  assert.equal(freshResult.estimatedNarration, null);
  assert.equal(freshResult.actualRender, null);

  // Case B: Creative Direction completed in Auto Mode
  const cdSteps: PipelineStepMock[] = [
    {
      name: "creative_direction",
      status: "done",
      output: {
        creative_direction: {
          resolved_target_duration: 85,
          recommended_duration_seconds: 85,
        },
      },
    },
    { name: "script", status: "done" },
    { name: "storyboard", status: "pending" },
  ];
  const cdResult = resolveDurationLifecycle(freshVideo, cdSteps);
  assert.equal(cdResult.resolvedTarget, 85);
  assert.equal(cdResult.isCdAuthoritative, true);
  assert.equal(cdResult.estimatedNarration, null);

  // Case C: Stale Creative Direction step (rerun triggered earlier)
  const staleSteps: PipelineStepMock[] = [
    {
      name: "creative_direction",
      status: "stale",
      output: {
        creative_direction: {
          resolved_target_duration: 85,
        },
      },
    },
  ];
  const staleResult = resolveDurationLifecycle(freshVideo, staleSteps);
  // Stale output must NOT be presented as authoritative resolved target
  assert.equal(staleResult.resolvedTarget, null);
  assert.equal(staleResult.isCdAuthoritative, false);

  // Case D: Full pipeline finished with Manual 45s request
  const manualVideo = { duration_mode: "manual" as const, target_duration: 45 };
  const completedSteps: PipelineStepMock[] = [
    {
      name: "creative_direction",
      status: "done",
      output: { creative_direction: { resolved_target_duration: 45 } },
    },
    { name: "script", status: "done" },
    {
      name: "storyboard",
      status: "done",
      output: { storyboard: { total_seconds: 46.2 } },
    },
    {
      name: "voiceover",
      status: "done",
      output: { voiceover: { total_duration_seconds: 44.8 } },
    },
    {
      name: "render",
      status: "done",
      output: { render: { duration_seconds: 45.1 } },
    },
  ];
  const completedResult = resolveDurationLifecycle(manualVideo, completedSteps);
  assert.equal(completedResult.requested.mode, "manual");
  assert.equal(completedResult.requested.target, 45);
  assert.equal(completedResult.resolvedTarget, 45);
  assert.equal(completedResult.estimatedNarration, 46.2);
  assert.equal(completedResult.actualAudio, 44.8);
  assert.equal(completedResult.actualRender, 45.1);
});

// ============================================================================
// 5. Video Summary and Detail Field Synchronization
// ============================================================================

test("Phase 1D — VideoSummary and VideoDetail types preserve duration_mode and target_duration", () => {
  const summary: VideoSummary = {
    id: "9f0c2a7e-4b61-4fa3-80f4-5f4e3c99021a",
    channel_id: "c18a287b-8ff8-4c63-b82b-df554a9c687e",
    topic: "The Firefall of Yosemite",
    description: "Natural horsetail fall phenomenon",
    status: "in_progress",
    created_at: "2026-11-28T00:00:00Z",
    visual_style_id: "stickman_tactical_explainer",
    visual_style_version: 1,
    duration_mode: "manual",
    target_duration: 60,
  };

  assert.equal(summary.duration_mode, "manual");
  assert.equal(summary.target_duration, 60);

  const detail: VideoDetail = {
    ...summary,
    visual_style_snapshot: {
      id: "stickman_tactical_explainer",
      display_name: "Stickman Tactical Explainer",
      category: "2d_minimal",
    },
    steps: [],
  };

  assert.equal(detail.duration_mode, "manual");
  assert.equal(detail.target_duration, 60);
  assert.equal(detail.visual_style_snapshot?.id, "stickman_tactical_explainer");
});

// ============================================================================
// 6. Phase 1D.7 Schema Simplification & Diagnostic Metadata Isolation
// ============================================================================

test("Phase 1D.7 — Creative Direction removes emotional_progression and supports empty creative_constraints", () => {
  const cd: CreativeDirectionOutput = {
    format_archetype: "cause_and_effect",
    storytelling_angle: "The cascade of events behind the 1977 New York blackout",
    central_thesis: "Lightning strikes combined with cascading relay trip failures darkened NYC",
    tone: "tense and analytical",
    protagonist_config: {
      human_presence: "contextual",
      archetype_summary: "Con Edison grid operators",
    },
    creative_constraints: [], // Empty array supported
    recommended_duration_seconds: 60,
    resolved_target_duration: 60,
    duration_rationale: "Requires pacing through 3 distinct substation relay failures before blackout.",
    narrative_plan: {
      narrative_perspective: "experiential_witness",
      opening_situation: "On July 13, 1977, lightning struck a Buchanan substation.",
      information_revelation_strategy: "progressive_reveal",
      story_progression: [
        { stage_name: "The Strike", description: "Lightning severs 345kV lines." },
        { stage_name: "The Cascade", description: "Feeder lines trip one by one." },
        { stage_name: "The Darkness", description: "Entire city plunges into darkness." },
      ],
      audience_takeaway: "Grid resilience hinges on human decision buffers under automated cascade failure.",
      resolution_payoff: "A concrete historical payoff explaining why modern grids isolate automatically.",
    },
  };

  assert.equal(cd.format_archetype, "cause_and_effect");
  assert.equal(cd.storytelling_angle, "The cascade of events behind the 1977 New York blackout");
  assert.equal(cd.central_thesis.includes("cascading relay"), true);
  assert.equal(cd.tone, "tense and analytical");
  assert.equal(cd.protagonist_config.human_presence, "contextual");
  assert.deepEqual(cd.creative_constraints, []);
  assert.equal(cd.recommended_duration_seconds, 60);
  assert.equal(cd.resolved_target_duration, 60);
  assert.equal(cd.duration_rationale?.includes("substation relay"), true);

  // Runtime and structural check: emotional_progression must NOT exist
  const cdRecord = cd as unknown as Record<string, unknown>;
  assert.equal("emotional_progression" in cdRecord, false);
  assert.equal(cdRecord.emotional_progression, undefined);

  // Verify the 6 canonical narrative_plan fields
  assert.ok(cd.narrative_plan);
  assert.equal(cd.narrative_plan.narrative_perspective, "experiential_witness");
  assert.equal(cd.narrative_plan.opening_situation?.includes("July 13, 1977"), true);
  assert.equal(cd.narrative_plan.information_revelation_strategy, "progressive_reveal");
  assert.equal(cd.narrative_plan.story_progression?.length, 3);
  assert.equal(cd.narrative_plan.audience_takeaway?.includes("Grid resilience"), true);
  assert.equal(cd.narrative_plan.resolution_payoff?.includes("historical payoff"), true);
});

test("Phase 1D.7 — Script removes angle and hashtags, supports optional claims_to_verify", () => {
  // Script with optional claims_to_verify populated
  const scriptWithClaims: ScriptContent = {
    title: "The 1977 New York City Blackout",
    hook: "At 8:37 PM, a single lightning bolt struck a power line north of New York City.",
    narration: "At 8:37 PM, a single lightning bolt struck a power line north of New York City. Over the next hour, a catastrophic cascade of relay failures plunged nine million people into pitch darkness.",
    claims_to_verify: [
      "Lightning struck Buchanan substation at 8:37 PM",
      "Nine million people were affected by the outage",
    ],
  };

  assert.equal(scriptWithClaims.title, "The 1977 New York City Blackout");
  assert.equal(scriptWithClaims.hook?.startsWith("At 8:37 PM"), true);
  assert.equal(scriptWithClaims.narration?.startsWith(scriptWithClaims.hook || ""), true);
  assert.equal(scriptWithClaims.claims_to_verify?.length, 2);

  // Runtime check: angle and hashtags must NOT exist in ScriptContent
  const scriptRecord = scriptWithClaims as unknown as Record<string, unknown>;
  assert.equal("angle" in scriptRecord, false);
  assert.equal(scriptRecord.angle, undefined);
  assert.equal("hashtags" in scriptRecord, false);
  assert.equal(scriptRecord.hashtags, undefined);

  // Script with empty claims_to_verify array
  const scriptEmptyClaims: ScriptContent = {
    title: "Why Ice Floats",
    hook: "Have you ever wondered why ice floats instead of sinking?",
    narration: "Have you ever wondered why ice floats instead of sinking? Water expands as it freezes into a crystalline lattice.",
    claims_to_verify: [],
  };
  assert.deepEqual(scriptEmptyClaims.claims_to_verify, []);

  // Script with omitted claims_to_verify
  const scriptNoClaims: ScriptContent = {
    title: "Why Ice Floats",
    hook: "Have you ever wondered why ice floats instead of sinking?",
    narration: "Have you ever wondered why ice floats instead of sinking? Water expands as it freezes into a crystalline lattice.",
  };
  assert.equal(scriptNoClaims.claims_to_verify, undefined);
});

test("Phase 1D.7 — Diagnostic metadata isolates attempts_history from authoritative script narration", () => {
  const rejectedDraft: ScriptAttemptDiagnostic = {
    attempt: 1,
    script: {
      title: "Broken Draft",
      hook: "Hey guys check this out!",
      narration: "Hey guys check this out! Today we are gonna talk about the blackout [insert camera cut here]...",
    },
    triggering_reasons: [
      "Bracketed production notes detected: '[insert camera cut here]'",
      "Meta-cliché opening hook: 'Hey guys check this out!'",
    ],
    provider: "google",
    model: "gemini-2.5-flash",
    input_tokens: 420,
    output_tokens: 95,
    latency_seconds: 1.12,
  };

  const authoritativeScript: ScriptContent = {
    title: "The 1977 New York City Blackout",
    hook: "At 8:37 PM, a single lightning bolt struck a power line north of New York City.",
    narration: "At 8:37 PM, a single lightning bolt struck a power line north of New York City. A cascade of relay failures plunged nine million people into pitch darkness.",
    claims_to_verify: ["Outage began at 8:37 PM"],
  };

  const scriptMeta: ScriptMeta = {
    prompt_version: "script-v1:a1b2c3d4",
    provider: "google",
    model: "gemini-2.5-flash",
    attempts: 2,
    attempts_history: [rejectedDraft],
    estimated_duration_seconds: 42.5,
  };

  const stepOutput = {
    script: authoritativeScript,
    meta: scriptMeta,
    warnings: [],
  };

  // Authoritative extraction logic: must extract stepOutput.script, NOT attempts_history
  const resolvedScript = stepOutput.script || (("narration" in stepOutput) ? stepOutput : {});
  assert.equal(resolvedScript.title, "The 1977 New York City Blackout");
  assert.equal(resolvedScript.hook?.startsWith("At 8:37 PM"), true);
  assert.equal(resolvedScript.narration?.includes("[insert camera cut here]"), false);

  // Diagnostic metadata is preserved for auditing but isolated
  assert.equal(stepOutput.meta.attempts, 2);
  assert.equal(stepOutput.meta.attempts_history?.length, 1);
  assert.equal(stepOutput.meta.attempts_history[0].attempt, 1);
  assert.equal(stepOutput.meta.attempts_history[0].triggering_reasons.length, 2);
  assert.equal(stepOutput.meta.attempts_history[0].script.title, "Broken Draft");
});
