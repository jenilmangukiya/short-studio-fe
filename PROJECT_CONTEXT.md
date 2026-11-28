# Shorts Studio Frontend — Project Context & Architecture

## Overview

Shorts Studio Frontend is a Next.js 16 (React 19) + Tailwind CSS web application providing an automated studio interface for vertical short-form video creation (YouTube Shorts, Instagram Reels, TikTok).

The frontend interfaces with the Shorts Studio FastAPI backend through a deterministic 6-step pipeline:
```
creative_direction → script → storyboard → images → voiceover → render → subtitles
```

---

## Phase 1D: Storytelling & Adaptive Duration Architecture

### 1. Video Creation Duration Controls (`src/app/channels/[id]/page.tsx`)

The Create Video modal supports two storytelling duration modes:

- **Automatic Mode (Default)**:
  - AI determines the optimal storytelling duration (30s – 180s) based on topic depth, information revelation strategy, and scene density.
  - Submits payload: `{ duration_mode: "auto", target_duration: null }`.
- **Custom Target Duration Mode**:
  - Allows creators to select approximate duration targets within `[30, 180]` seconds.
  - Preset quick-select pills: `30s`, `45s`, `60s`, `90s`, `120s`, `180s` (`DURATION_PRESETS`).
  - Fine-grained integer number input and slider `[30, 180]`.
  - Submits payload: `{ duration_mode: "manual", target_duration: integer }`.
- **Storytelling Guidance Disclaimer**:
  - The UI clearly communicates that duration is an approximate storytelling guidance target for pacing and script structure, not an exact rendered video length.
- **State Preservation**:
  - Switching between Auto and Manual modes preserves the selected duration number.
  - Reset logic clears form state cleanly on modal close and successful creation.
  - Mandatory visual style selection (`visual_style_id`) is strictly preserved.

### 2. Creative Direction Review UI (`src/components/CreativeDirectionOutputView.tsx`)

Displays the authoritative storytelling plan and duration strategy generated in Creative Direction:

- **Storytelling Archetype**:
  - Displays formatted badge (`getFormatArchetypeLabel`) for canonical archetypes (e.g. Experiential History, Mystery Investigation, Character Journey, Everyday Curiosity, Scientific Discovery, Cause and Effect, Direct Explanation, Explainer / Myth Bust, Narrative Story).
- **Adaptive Duration Strategy Card**:
  - Displays resolved storytelling target duration (`resolved_target_duration` or `recommended_duration_seconds`).
  - Displays duration rationale (`duration_rationale`) explaining the storytelling budget.
  - Displays requested mode/target context (`durationMode`, `requestedDuration`).
  - If output is stale, marks the section with a prominent `Stale / Pending Rerun` warning badge.
- **Storytelling Narrative Plan**:
  - Vantage Point / Perspective (`narrative_perspective`).
  - Information Revelation Strategy (`information_revelation_strategy`).
  - Opening Situation / Cold Open Hook (`opening_situation` or `opening_approach`).
  - **Ordered Narrative Stages**:
    - Stage name and sequence index.
    - Narrative pacing badge (e.g. `pacing: "deliberate"`).
    - Storytelling focus allocation pill (`~X% narrative share`), clearly labeled as pacing guidance rather than rendered timestamps.
    - Narrative action description (`description`).
    - Stage goal (`stage_goal` / `story_beat_goal`).
    - Emotional or intellectual targets (`emotional_target` / `intellectual_target`).
  - Audience Takeaway (`audience_takeaway`) and Resolution Payoff (`resolution_payoff`).
- **Phase 1A–1C Protections Preserved**:
  - Protagonist configuration and human presence badge.
  - Frozen visual style snapshot (`visual_style_snapshot`).
  - Creative constraints list.
  - Obsolete `visual_genre` remains completely omitted.

### 3. Duration Lifecycle Breakdown (`src/app/videos/[id]/page.tsx`)

The video detail page header features a four-tier duration lifecycle indicator:

1. **Requested Duration**: Displays requested configuration (`Auto (AI-determined)` or `${target}s (Manual)`).
2. **Resolved Storytelling Target**: Displays canonical resolved duration from `creative_direction.resolved_target_duration`.
   - Only shown when Creative Direction step is `done` and not `stale`.
   - When CD is running: displays `Resolving...`.
   - When CD is stale: displays `Pending Rerun` (never presents outdated output as authoritative).
   - When CD is pending: displays `Awaiting CD` (never invents false defaults).
3. **Estimated Narration Duration**: Displays estimated script duration from `storyboard.total_seconds` once storyboard generation completes.
4. **Actual Generated Duration**: Displays exact final duration from `render.duration_seconds` (or fallback `voiceover.total_duration_seconds`) once rendered.

---

## Phase 1A–1C Contract Alignment Summary

- **Visual Styles**: Three canonical catalog presets (`legacy_default`, `stickman_tactical_explainer`, `stylized_2d_narrative`). Mandatory selection on video creation. Single source of truth is the frozen snapshot `visual_style_snapshot`.
- **Visual Genre**: Completely removed from frontend types, displays, and API models.
- **Visual Intents**: Exactly eight canonical values (`establishing`, `action_event`, `environmental_context`, `mechanism_explanation`, `human_experience`, `detail_focus`, `abstract_visualization`, `narrative_resolution`).
- **Visual Techniques**: Strict union of five canonical values (`cinematic_illustration`, `physical_close_up`, `in_scene_cue`, `cutaway`, `diagram`) with human-readable labels.
- **Transitions**: Supported transitions include `none`, `fade`, `dissolve`, `wipe`, `cross_fade`, and `spatial_cutaway`.
- **Continuous Voiceover**: Single unified audio stream (`GET /videos/{video_id}/audio`), no per-scene audio file endpoints.

---

## Testing & Quality Assurance

- **Test Suite**: 232 tests passing across 16 test suites (`npm test`).
  - Contract regression tests in `tests/phase-1d-contract.test.ts`.
- **TypeScript**: Strict type check with `npx tsc --noEmit` (0 errors).
- **ESLint**: Complete lint check with `npm run lint` (0 errors, 0 warnings).
