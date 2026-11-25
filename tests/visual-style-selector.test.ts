import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_VISUAL_STYLE_ID,
  type VisualStyleId,
  type VideoCreate,
} from "../src/lib/types.ts";
import {
  resolveEffectiveStyle,
  isExplicitSelection,
  getStyleSelectionDescription,
  getStyleVisualMeta,
} from "../src/lib/visual-style-ui.ts";

// ============================================================================
// 1. Style Resolution and Inheritance Tests
// ============================================================================

test("1. resolveEffectiveStyle prioritizes explicit user selection over channel default", () => {
  const explicit: VisualStyleId = "stickman_tactical_explainer";
  const channelDefault: VisualStyleId = "stylized_2d_narrative";

  const resolved = resolveEffectiveStyle(explicit, channelDefault);
  assert.equal(resolved, "stickman_tactical_explainer");
});

test("2. resolveEffectiveStyle falls back to channel default when no explicit selection", () => {
  const channelDefault: VisualStyleId = "stylized_2d_narrative";

  const resolved = resolveEffectiveStyle(null, channelDefault);
  assert.equal(resolved, "stylized_2d_narrative");

  const resolvedUndefined = resolveEffectiveStyle(undefined, channelDefault);
  assert.equal(resolvedUndefined, "stylized_2d_narrative");
});

test("3. resolveEffectiveStyle falls back to DEFAULT_VISUAL_STYLE_ID when channel has no default", () => {
  const resolvedNull = resolveEffectiveStyle(null, null);
  assert.equal(resolvedNull, DEFAULT_VISUAL_STYLE_ID);
  assert.equal(resolvedNull, "legacy_default");

  const resolvedUndefined = resolveEffectiveStyle(undefined, undefined);
  assert.equal(resolvedUndefined, DEFAULT_VISUAL_STYLE_ID);
});

test("4. isExplicitSelection differentiates user choice from inherited default", () => {
  assert.equal(isExplicitSelection("legacy_default"), true);
  assert.equal(isExplicitSelection("stickman_tactical_explainer"), true);
  assert.equal(isExplicitSelection("stylized_2d_narrative"), true);

  assert.equal(isExplicitSelection(null), false);
  assert.equal(isExplicitSelection(undefined), false);
});

test("5. getStyleSelectionDescription produces accurate user guidance", () => {
  // Explicit choice
  const explicitDesc = getStyleSelectionDescription("stickman_tactical_explainer", "legacy_default");
  assert.equal(explicitDesc.isOverridden, true);
  assert.equal(explicitDesc.effectiveId, "stickman_tactical_explainer");
  assert.match(explicitDesc.summaryText, /Custom override active/);
  assert.match(explicitDesc.summaryText, /stickman_tactical_explainer/);

  // Inherited from channel default
  const channelDesc = getStyleSelectionDescription(null, "stylized_2d_narrative");
  assert.equal(channelDesc.isOverridden, false);
  assert.equal(channelDesc.effectiveId, "stylized_2d_narrative");
  assert.match(channelDesc.summaryText, /Inheriting channel default/);
  assert.match(channelDesc.summaryText, /stylized_2d_narrative/);

  // Inherited from system default
  const systemDesc = getStyleSelectionDescription(null, null);
  assert.equal(systemDesc.isOverridden, false);
  assert.equal(systemDesc.effectiveId, "legacy_default");
  assert.match(systemDesc.summaryText, /Using system default/);
  assert.match(systemDesc.summaryText, /Clean 3D Studio/);
});

// ============================================================================
// 2. CSS-based Visual Presentation Metadata Tests
// ============================================================================

test("6. getStyleVisualMeta returns distinct motifs and swatches for all canonical presets", () => {
  const styles: VisualStyleId[] = [
    "legacy_default",
    "stickman_tactical_explainer",
    "stylized_2d_narrative",
  ];

  for (const styleId of styles) {
    const meta = getStyleVisualMeta(styleId);
    assert.ok(meta, `Metadata exists for ${styleId}`);
    assert.ok(meta.badgeLabel, `Badge label exists for ${styleId}`);
    assert.ok(meta.iconName, `Icon name exists for ${styleId}`);
    assert.ok(meta.swatches.length >= 3, `Palette has swatches for ${styleId}`);
    assert.ok(meta.gradientClass, `Gradient exists for ${styleId}`);
  }

  // Icons should be unique per style
  const icons = styles.map((s) => getStyleVisualMeta(s).iconName);
  const uniqueIcons = new Set(icons);
  assert.equal(uniqueIcons.size, 3);
  assert.ok(uniqueIcons.has("cube"));
  assert.ok(uniqueIcons.has("stickman"));
  assert.ok(uniqueIcons.has("drama"));
});

test("7. getStyleVisualMeta provides graceful fallback for unknown styles", () => {
  const fallback = getStyleVisualMeta("unknown_style_id");
  assert.equal(fallback.badgeLabel, "3D Render");
  assert.equal(fallback.iconName, "cube");
  assert.ok(fallback.swatches.length > 0);
});

// ============================================================================
// 3. Creation Payload Generation Tests
// ============================================================================

test("8. VideoCreate payload omits visual_style_id when selection is null (preserving inheritance)", () => {
  const topic = "How Quantum Computing Works";
  const description = "Explain superposition and entanglement";
  const selectedStyleId: VisualStyleId | null = null;

  const payload: VideoCreate = {
    topic,
    description,
    ...(selectedStyleId ? { visual_style_id: selectedStyleId } : {}),
  };

  assert.equal(payload.topic, topic);
  assert.equal(payload.description, description);
  assert.equal("visual_style_id" in payload, false);
  assert.equal(payload.visual_style_id, undefined);
});

test("9. VideoCreate payload includes visual_style_id when user makes an explicit selection", () => {
  const topic = "How Black Holes Warp Time";
  const description = null;
  const selectedStyleId: VisualStyleId = "stickman_tactical_explainer";

  const payload: VideoCreate = {
    topic,
    description,
    ...(selectedStyleId ? { visual_style_id: selectedStyleId } : {}),
  };

  assert.equal(payload.topic, topic);
  assert.equal(payload.description, null);
  assert.equal(payload.visual_style_id, "stickman_tactical_explainer");
  assert.equal("visual_style_id" in payload, true);
});

test("10. VideoCreate payload includes visual_style_id if legacy_default is explicitly chosen", () => {
  const topic = "History of Architecture";
  const selectedStyleId: VisualStyleId = "legacy_default";

  const payload: VideoCreate = {
    topic,
    ...(selectedStyleId ? { visual_style_id: selectedStyleId } : {}),
  };

  assert.equal(payload.visual_style_id, "legacy_default");
});

// ============================================================================
// 4. Source & Architecture Integrity Tests
// ============================================================================

test("11. VisualStyleSelector component source code implements required UI patterns", () => {
  const componentPath = path.resolve(
    process.cwd(),
    "src/components/VisualStyleSelector.tsx"
  );
  assert.ok(fs.existsSync(componentPath), "VisualStyleSelector.tsx must exist");

  const content = fs.readFileSync(componentPath, "utf-8");

  // Uses useVisualStyles hook
  assert.match(content, /useVisualStyles\(\)/, "Must use useVisualStyles hook");

  // Implements accessible radiogroup semantics
  assert.match(content, /role="radiogroup"/, "Must have radiogroup role");
  assert.match(content, /role="radio"/, "Cards must have radio role");
  assert.match(content, /aria-checked=/, "Must have aria-checked attribute");

  // Implements loading, error, and empty states
  assert.match(content, /isLoading/, "Must handle isLoading state");
  assert.match(content, /isError/, "Must handle isError state");
  assert.match(content, /refetch/, "Must provide retry button for error state");
  assert.match(content, /styles\.length === 0/, "Must handle empty styles list");

  // Does NOT render unhosted backend preview images via <img> tag
  assert.doesNotMatch(
    content,
    /<img[^>]+preview_image_path/,
    "Must not render unhosted preview_image_path in <img> tag"
  );

  // Uses CSS palette swatches and motifs
  assert.match(content, /getStyleVisualMeta/, "Must use CSS visual metadata");
  assert.match(content, /StyleIcon|iconName/i, "Must render motif indicators");
  assert.match(content, /swatch/i, "Must render palette swatches");
});

test("12. ChannelDetailPage integrates VisualStyleSelector in creation flow", () => {
  const pagePath = path.resolve(
    process.cwd(),
    "src/app/channels/[id]/page.tsx"
  );
  assert.ok(fs.existsSync(pagePath), "channels/[id]/page.tsx must exist");

  const content = fs.readFileSync(pagePath, "utf-8");

  // Imports and mounts VisualStyleSelector
  assert.match(
    content,
    /import\s+{[^}]*VisualStyleSelector[^}]*}\s+from\s+["']@\/components\/VisualStyleSelector["']/,
    "Must import VisualStyleSelector"
  );
  assert.match(
    content,
    /<VisualStyleSelector/,
    "Must render VisualStyleSelector inside page component"
  );

  // Tracks selectedStyleId state
  assert.match(
    content,
    /const\s+\[selectedStyleId,\s*setSelectedStyleId\]\s*=\s*useState<VisualStyleId\s*\|\s*null>\(null\)/,
    "Must maintain selectedStyleId state defaulting to null"
  );

  // Passes channelDefaultStyleId to selector
  assert.match(
    content,
    /channelDefaultStyleId=\{channel\?\.default_visual_style_id\}/,
    "Must pass channel?.default_visual_style_id to selector"
  );

  // Resets state on successful creation and modal close
  assert.match(
    content,
    /setSelectedStyleId\(null\)/,
    "Must reset selectedStyleId to null on create/close"
  );
});
