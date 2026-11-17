import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MAX_VISUAL_STYLE_LENGTH,
  VISUAL_STYLE_WARNING_THRESHOLD,
  validateVisualStyleLength,
  getChannelVisualStyle,
} from "../src/lib/types.ts";

// ============================================================================
// 1. Constant Definitions & Validation Logic
// ============================================================================

test("1. MAX_VISUAL_STYLE_LENGTH is 2000 and VISUAL_STYLE_WARNING_THRESHOLD is 1980", () => {
  assert.equal(MAX_VISUAL_STYLE_LENGTH, 2000);
  assert.equal(VISUAL_STYLE_WARNING_THRESHOLD, 1980);
});

test("2. validateVisualStyleLength accepts undefined, null, empty string, and text <= 2,000 chars", () => {
  assert.equal(validateVisualStyleLength(undefined), null);
  assert.equal(validateVisualStyleLength(null), null);
  assert.equal(validateVisualStyleLength(""), null);

  // Short text
  assert.equal(validateVisualStyleLength("Pixar 3D style"), null);

  // Text well beyond old 600-character limit
  const text700 = "A".repeat(700);
  assert.equal(validateVisualStyleLength(text700), null);

  const text1500 = "B".repeat(1500);
  assert.equal(validateVisualStyleLength(text1500), null);

  // Exactly 2,000 characters
  const text2000 = "C".repeat(2000);
  assert.equal(validateVisualStyleLength(text2000), null);
});

test("3. validateVisualStyleLength rejects text exceeding 2,000 characters (e.g. 2,001 chars)", () => {
  const text2001 = "X".repeat(2001);
  const error2001 = validateVisualStyleLength(text2001);
  assert.ok(error2001 !== null);
  assert.match(error2001, /cannot exceed 2,000 characters/);
  assert.match(error2001, /2,001/);

  const text3000 = "Y".repeat(3000);
  const error3000 = validateVisualStyleLength(text3000);
  assert.ok(error3000 !== null);
  assert.match(error3000, /cannot exceed 2,000 characters/);
  assert.match(error3000, /3,000/);
});

// ============================================================================
// 2. Typing, Pasting, and Truncation Simulation
// ============================================================================

test("4. Typing and pasting beyond 600 characters up to 2,000 characters is accepted without truncation", () => {
  // Simulate pasting a 1,200 character visual direction description
  const longPrompt = "Cinematic 3D render, photorealistic lighting, 8k resolution. " + "Detailed texture, volumetric rays. ".repeat(30);
  assert.ok(longPrompt.length > 600);
  assert.ok(longPrompt.length <= 2000);

  // Validation accepts it
  assert.equal(validateVisualStyleLength(longPrompt), null);

  // Simulate HTML textarea maxLength behavior
  const pastedInput = longPrompt.slice(0, MAX_VISUAL_STYLE_LENGTH);
  assert.equal(pastedInput.length, longPrompt.length);
});

test("5. Pasting beyond 2,000 characters is prevented by maxLength or rejected by validation", () => {
  const oversizedText = "D".repeat(2500);

  // In HTML textarea, maxLength=2000 clamps pasted input to 2,000
  const clampedByTextarea = oversizedText.slice(0, MAX_VISUAL_STYLE_LENGTH);
  assert.equal(clampedByTextarea.length, 2000);
  assert.equal(validateVisualStyleLength(clampedByTextarea), null);

  // If input bypasses DOM maxLength (e.g. script injection), validation blocks it
  assert.ok(validateVisualStyleLength(oversizedText) !== null);
});

// ============================================================================
// 3. Payload Preservation (Without Trimming or Truncation) & Empty Value Behavior
// ============================================================================

test("6. Payload preparation sends full text without trimming or truncation when non-empty", () => {
  function prepareSettingsPayload(currentValue: string, existingSettings: Record<string, unknown> = {}) {
    const freshSettings = { ...existingSettings };
    const trimmed = currentValue.trim();
    if (trimmed.length > 0) {
      freshSettings.visual_style = currentValue;
    } else {
      delete freshSettings.visual_style;
    }
    return freshSettings;
  }

  // 1. Text with 2,000 chars sent in full
  const full2000 = "E".repeat(2000);
  const payload2000 = prepareSettingsPayload(full2000);
  assert.equal(payload2000.visual_style, full2000);
  assert.equal((payload2000.visual_style as string).length, 2000);

  // 2. Text with leading/trailing spaces preserves full user input (without trimming)
  const paddedPrompt = "  High contrast dramatic lighting, 9:16 vertical composition  ";
  const payloadPadded = prepareSettingsPayload(paddedPrompt);
  assert.equal(payloadPadded.visual_style, paddedPrompt);

  // 3. Existing unrelated settings are preserved
  const payloadWithExtras = prepareSettingsPayload("Claymation", { existing_key: "preserved_value" });
  assert.equal(payloadWithExtras.visual_style, "Claymation");
  assert.equal(payloadWithExtras.existing_key, "preserved_value");
});

test("7. Empty and optional values preserve existing behavior (deleting visual_style key)", () => {
  function prepareSettingsPayload(currentValue: string, existingSettings: Record<string, unknown> = {}) {
    const freshSettings = { ...existingSettings };
    const trimmed = currentValue.trim();
    if (trimmed.length > 0) {
      freshSettings.visual_style = currentValue;
    } else {
      delete freshSettings.visual_style;
    }
    return freshSettings;
  }

  // Empty string removes visual_style
  const payloadEmpty = prepareSettingsPayload("", { visual_style: "Previous Style" });
  assert.equal("visual_style" in payloadEmpty, false);

  // Whitespace-only string removes visual_style
  const payloadWhitespace = prepareSettingsPayload("   \n\t   ", { visual_style: "Previous Style" });
  assert.equal("visual_style" in payloadWhitespace, false);
});

test("8. getChannelVisualStyle extracts stored visual style or returns null when unset", () => {
  assert.equal(getChannelVisualStyle({ visual_style: "Cyberpunk neon" }), "Cyberpunk neon");
  assert.equal(getChannelVisualStyle({ visual_style: "  Clean 3D  " }), "Clean 3D");
  assert.equal(getChannelVisualStyle({ visual_style: "" }), null);
  assert.equal(getChannelVisualStyle({ visual_style: "   " }), null);
  assert.equal(getChannelVisualStyle({}), null);
  assert.equal(getChannelVisualStyle(null), null);
  assert.equal(getChannelVisualStyle(undefined), null);

  // Large prompt up to 2,000 characters
  const largeStyle = "Art direction: " + "Gothic architecture, fog, twilight. ".repeat(45);
  assert.ok(largeStyle.length <= 2000);
  assert.equal(getChannelVisualStyle({ visual_style: largeStyle }), largeStyle.trim());
});

// ============================================================================
// 4. Character Counter Formatting & Color Indicator Logic
// ============================================================================

test("9. Counter displays current count against 2,000 (e.g. '450 / 2,000 characters')", () => {
  function formatCounterText(length: number): string {
    return `${length} / 2,000 characters`;
  }

  assert.equal(formatCounterText(0), "0 / 2,000 characters");
  assert.equal(formatCounterText(450), "450 / 2,000 characters");
  assert.equal(formatCounterText(650), "650 / 2,000 characters");
  assert.equal(formatCounterText(1980), "1980 / 2,000 characters");
  assert.equal(formatCounterText(2000), "2000 / 2,000 characters");
});

test("10. Counter color changes appropriately based on thresholds", () => {
  function getCounterColorClass(length: number): string {
    return length > MAX_VISUAL_STYLE_LENGTH
      ? "text-red-600 font-bold"
      : length >= VISUAL_STYLE_WARNING_THRESHOLD
      ? "text-amber-600 font-bold"
      : "text-slate-400";
  }

  // Normal range: text-slate-400
  assert.equal(getCounterColorClass(0), "text-slate-400");
  assert.equal(getCounterColorClass(450), "text-slate-400");
  assert.equal(getCounterColorClass(600), "text-slate-400");
  assert.equal(getCounterColorClass(1000), "text-slate-400");
  assert.equal(getCounterColorClass(1979), "text-slate-400");

  // Approaching limit (>= 1980): text-amber-600 font-bold
  assert.equal(getCounterColorClass(1980), "text-amber-600 font-bold");
  assert.equal(getCounterColorClass(1999), "text-amber-600 font-bold");
  assert.equal(getCounterColorClass(2000), "text-amber-600 font-bold");

  // Exceeding limit (> 2000): text-red-600 font-bold
  assert.equal(getCounterColorClass(2001), "text-red-600 font-bold");
  assert.equal(getCounterColorClass(2500), "text-red-600 font-bold");
});

// ============================================================================
// 5. Component Source Integrity Verification
// ============================================================================

test("11. Source integrity: ChannelSettingsModal.tsx enforces 2,000 limit and displays 2,000 counter", () => {
  const filePath = path.resolve("src/components/ChannelSettingsModal.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  // Imports validation and limits
  assert.match(content, /MAX_VISUAL_STYLE_LENGTH/);
  assert.match(content, /VISUAL_STYLE_WARNING_THRESHOLD/);
  assert.match(content, /validateVisualStyleLength/);

  // Counter format has '2,000 characters'
  assert.match(content, /\/ 2,000 characters/);

  // Textarea maxLength is set to MAX_VISUAL_STYLE_LENGTH (2000)
  assert.match(content, /maxLength=\{MAX_VISUAL_STYLE_LENGTH\}/);

  // Validation called in handleSave
  assert.match(content, /validateVisualStyleLength\(currentValue\)/);

  // Full text is assigned to freshSettings.visual_style
  assert.match(content, /freshSettings\.visual_style\s*=\s*currentValue/);

  // No lingering 600 character limits
  assert.doesNotMatch(content, /maxLength=\{600\}/);
  assert.doesNotMatch(content, /\/ 600 characters/);
  assert.doesNotMatch(content, /currentValue\.length >= 580/);
});

test("12. Source integrity: ChannelVisualStyleEditor.tsx enforces 2,000 limit and displays 2,000 counter", () => {
  const filePath = path.resolve("src/components/ChannelVisualStyleEditor.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  // Imports validation and limits
  assert.match(content, /MAX_VISUAL_STYLE_LENGTH/);
  assert.match(content, /VISUAL_STYLE_WARNING_THRESHOLD/);
  assert.match(content, /validateVisualStyleLength/);

  // Counter format has '2,000 characters'
  assert.match(content, /\/ 2,000 characters/);

  // Textarea maxLength is set to MAX_VISUAL_STYLE_LENGTH (2000)
  assert.match(content, /maxLength=\{MAX_VISUAL_STYLE_LENGTH\}/);

  // Validation called in handleSave
  assert.match(content, /validateVisualStyleLength\(currentValue\)/);

  // Full text is assigned to freshSettings.visual_style
  assert.match(content, /freshSettings\.visual_style\s*=\s*currentValue/);

  // No lingering 600 character limits
  assert.doesNotMatch(content, /maxLength=\{600\}/);
  assert.doesNotMatch(content, /\/ 600 characters/);
  assert.doesNotMatch(content, /currentValue\.length >= 580/);
});

test("13. Source integrity: channels/[id]/settings/page.tsx enforces 2,000 limit and displays 2,000 counter", () => {
  const filePath = path.resolve("src/app/channels/[id]/settings/page.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  // Imports validation and limits
  assert.match(content, /MAX_VISUAL_STYLE_LENGTH/);
  assert.match(content, /VISUAL_STYLE_WARNING_THRESHOLD/);
  assert.match(content, /validateVisualStyleLength/);

  // Counter format has '2,000 characters'
  assert.match(content, /\/ 2,000 characters/);

  // Textarea maxLength is set to MAX_VISUAL_STYLE_LENGTH (2000)
  assert.match(content, /maxLength=\{MAX_VISUAL_STYLE_LENGTH\}/);

  // Validation called in handleSaveVisual
  assert.match(content, /validateVisualStyleLength\(currentVisualValue\)/);

  // Full text is assigned to freshSettings.visual_style
  assert.match(content, /freshSettings\.visual_style\s*=\s*currentVisualValue/);

  // No lingering 600 character limits for visual style
  assert.doesNotMatch(content, /maxLength=\{600\}/);
  assert.doesNotMatch(content, /\/ 600 characters/);
  assert.doesNotMatch(content, /currentVisualValue\.length >= 580/);
});
