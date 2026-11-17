import test from "node:test";
import assert from "node:assert/strict";
import {
  getVideoStatusConfig,
  formatRelativeTime,
  formatFullDateTime,
  computeVideoMetrics,
  filterAndSortVideos,
} from "../src/lib/video-ui.ts";
import type { VideoSummary } from "../src/lib/types.ts";

function createMockVideo(
  id: string,
  topic: string,
  status: string,
  createdAt: string,
  description: string | null = null
): VideoSummary {
  return {
    id,
    channel_id: "test-channel-id",
    topic,
    description,
    status,
    created_at: createdAt,
  };
}

// ============================================================================
// 1. Status Configuration Tests
// ============================================================================

test("1. getVideoStatusConfig returns correct badge labels, colors, and animation states", () => {
  const completed = getVideoStatusConfig("completed");
  assert.equal(completed.label, "Ready");
  assert.equal(completed.isAnimated, false);
  assert.match(completed.badgeClass, /emerald/);

  const inProgress = getVideoStatusConfig("in_progress");
  assert.equal(inProgress.label, "In Production");
  assert.equal(inProgress.isAnimated, true);
  assert.match(inProgress.badgeClass, /indigo/);

  const failed = getVideoStatusConfig("failed");
  assert.equal(failed.label, "Failed");
  assert.equal(failed.isAnimated, false);
  assert.match(failed.badgeClass, /rose/);

  const draft = getVideoStatusConfig("draft");
  assert.equal(draft.label, "Draft");
  assert.equal(draft.isAnimated, false);
  assert.match(draft.badgeClass, /slate/);
});

// ============================================================================
// 2. Relative & Formatted Time Tests
// ============================================================================

test("2. formatRelativeTime handles recent times, yesterday, and older dates safely", () => {
  const now = new Date();

  // 10 seconds ago
  const secAgo = new Date(now.getTime() - 10 * 1000).toISOString();
  assert.equal(formatRelativeTime(secAgo), "Just now");

  // 15 minutes ago
  const minAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(minAgo), "15m ago");

  // 3 hours ago
  const hoursAgo = new Date(now.getTime() - 3 * 3600 * 1000).toISOString();
  assert.equal(formatRelativeTime(hoursAgo), "3h ago");

  // Invalid date fallback
  assert.equal(formatRelativeTime("invalid-date-string"), "invalid-date-string");
});

test("3. formatFullDateTime produces valid readable date and time", () => {
  const iso = "2026-11-15T20:34:55.000Z";
  const formatted = formatFullDateTime(iso);
  assert.match(formatted, /2026/);
});

// ============================================================================
// 3. Channel KPI Metric Computation Tests
// ============================================================================

test("4. computeVideoMetrics aggregates totals and completion rate cleanly", () => {
  const sampleVideos: VideoSummary[] = [
    createMockVideo("1", "Goosebumps Topic", "completed", "2026-11-15T20:00:00Z"),
    createMockVideo("2", "Hypnic Jerk Topic", "completed", "2026-11-15T19:00:00Z"),
    createMockVideo("3", "Black Holes", "in_progress", "2026-11-15T18:00:00Z"),
    createMockVideo("4", "Quantum Computing", "draft", "2026-11-15T17:00:00Z"),
    createMockVideo("5", "Ancient Rome", "failed", "2026-11-15T16:00:00Z"),
  ];

  const metrics = computeVideoMetrics(sampleVideos);
  assert.equal(metrics.total, 5);
  assert.equal(metrics.completed, 2);
  assert.equal(metrics.inProgress, 1);
  assert.equal(metrics.draft, 1);
  assert.equal(metrics.failed, 1);
  assert.equal(metrics.completionRate, 40); // 2 out of 5 = 40%
});

test("5. computeVideoMetrics handles empty video lists without division by zero", () => {
  const metrics = computeVideoMetrics([]);
  assert.equal(metrics.total, 0);
  assert.equal(metrics.completed, 0);
  assert.equal(metrics.inProgress, 0);
  assert.equal(metrics.draft, 0);
  assert.equal(metrics.failed, 0);
  assert.equal(metrics.completionRate, 0);
});

// ============================================================================
// 4. Filtering and Sorting Tests
// ============================================================================

test("6. filterAndSortVideos: status filtering restricts results correctly", () => {
  const sampleVideos: VideoSummary[] = [
    createMockVideo("1", "Alpha", "completed", "2026-11-15T10:00:00Z"),
    createMockVideo("2", "Beta", "in_progress", "2026-11-15T11:00:00Z"),
    createMockVideo("3", "Gamma", "completed", "2026-11-15T12:00:00Z"),
  ];

  const completedOnly = filterAndSortVideos(sampleVideos, "", "completed");
  assert.equal(completedOnly.length, 2);
  assert.equal(completedOnly[0].id, "3");
  assert.equal(completedOnly[1].id, "1");

  const inProgressOnly = filterAndSortVideos(sampleVideos, "", "in_progress");
  assert.equal(inProgressOnly.length, 1);
  assert.equal(inProgressOnly[0].id, "2");

  const all = filterAndSortVideos(sampleVideos, "", "all");
  assert.equal(all.length, 3);
});

test("7. filterAndSortVideos: search query matches topic and description case-insensitively", () => {
  const sampleVideos: VideoSummary[] = [
    createMockVideo("1", "Why do we get goosebumps?", "completed", "2026-11-15T10:00:00Z", "Faceless science explainer"),
    createMockVideo("2", "Falling feeling in sleep", "completed", "2026-11-15T11:00:00Z", "Hypnic jerk video"),
    createMockVideo("3", "Deep Sea Creatures", "in_progress", "2026-11-15T12:00:00Z", "Mysteries of the abyss"),
  ];

  // Search by topic keyword
  const search1 = filterAndSortVideos(sampleVideos, "goosebumps", "all");
  assert.equal(search1.length, 1);
  assert.equal(search1[0].id, "1");

  // Search by description keyword
  const search2 = filterAndSortVideos(sampleVideos, "abyss", "all");
  assert.equal(search2.length, 1);
  assert.equal(search2[0].id, "3");

  // No match
  const search3 = filterAndSortVideos(sampleVideos, "space travel", "all");
  assert.equal(search3.length, 0);
});

test("8. filterAndSortVideos: sort options (newest, oldest, title) order results accurately", () => {
  const sampleVideos: VideoSummary[] = [
    createMockVideo("1", "Charlie", "completed", "2026-11-15T10:00:00Z"),
    createMockVideo("2", "Bravo", "completed", "2026-11-15T12:00:00Z"),
    createMockVideo("3", "Alpha", "completed", "2026-11-15T08:00:00Z"),
  ];

  // Newest First (12:00, 10:00, 08:00)
  const newest = filterAndSortVideos(sampleVideos, "", "all", "newest");
  assert.deepEqual(
    newest.map((v) => v.id),
    ["2", "1", "3"]
  );

  // Oldest First (08:00, 10:00, 12:00)
  const oldest = filterAndSortVideos(sampleVideos, "", "all", "oldest");
  assert.deepEqual(
    oldest.map((v) => v.id),
    ["3", "1", "2"]
  );

  // Alphabetical by title (Alpha, Bravo, Charlie)
  const title = filterAndSortVideos(sampleVideos, "", "all", "title");
  assert.deepEqual(
    title.map((v) => v.topic),
    ["Alpha", "Bravo", "Charlie"]
  );
});
