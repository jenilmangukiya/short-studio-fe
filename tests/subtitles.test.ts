import test from "node:test";
import assert from "node:assert/strict";
import {
  getChunkSizes,
  chunkWords,
  buildAllChunks,
  getActiveWordIndex,
  findActiveSubtitle,
  type SubtitleChunk,
} from "../src/lib/subtitles.ts";
import type { SubtitleData, WordTimestamp } from "../src/lib/types.ts";

test("getChunkSizes guarantees 3 to 5 words per chunk", () => {
  // Segments <= 5 words
  assert.deepEqual(getChunkSizes(0), []);
  assert.deepEqual(getChunkSizes(1), [1]);
  assert.deepEqual(getChunkSizes(2), [2]);
  assert.deepEqual(getChunkSizes(3), [3]);
  assert.deepEqual(getChunkSizes(4), [4]);
  assert.deepEqual(getChunkSizes(5), [5]);

  // Segments > 5 words: all chunks must be between 3 and 5 words
  for (let total = 6; total <= 35; total++) {
    const sizes = getChunkSizes(total);
    const sum = sizes.reduce((acc, s) => acc + s, 0);
    assert.equal(sum, total, `Sum of chunk sizes must equal total (${total})`);
    for (const size of sizes) {
      assert.ok(
        size >= 3 && size <= 5,
        `Chunk size ${size} for total ${total} must be between 3 and 5`
      );
    }
  }
});

test("chunkWords creates timed chunks with correct boundaries", () => {
  const sampleWords: WordTimestamp[] = [
    { text: "Why", start: 0.1, end: 0.35, confidence: 1 },
    { text: "do", start: 0.35, end: 0.5, confidence: 1 },
    { text: "airplane", start: 0.5, end: 1.1, confidence: 1 },
    { text: "windows", start: 1.1, end: 1.5, confidence: 1 },
    { text: "have", start: 1.5, end: 1.75, confidence: 1 },
    { text: "tiny", start: 1.75, end: 2.1, confidence: 1 },
    { text: "holes?", start: 2.1, end: 2.6, confidence: 1 },
  ]; // 7 words -> sizes [4, 3]

  const chunks = chunkWords(sampleWords, 1, 2.8);
  assert.equal(chunks.length, 2);

  // Chunk 1: 4 words ("Why do airplane windows")
  assert.equal(chunks[0].words.length, 4);
  assert.equal(chunks[0].start, 0.1);
  assert.equal(chunks[0].end, 1.5); // spans up to next chunk start

  // Chunk 2: 3 words ("have tiny holes?")
  assert.equal(chunks[1].words.length, 3);
  assert.equal(chunks[1].start, 1.5);
  assert.ok(chunks[1].end >= 2.6); // spans to last word end + cushion or segmentEnd
});

test("buildAllChunks handles multi-segment subtitles and sorts chronologically", () => {
  const subtitleData: SubtitleData = {
    segments: [
      {
        index: 2,
        text: "It balances the pressure.",
        start: 3.0,
        end: 5.0,
        words: [
          { text: "It", start: 3.1, end: 3.3 },
          { text: "balances", start: 3.3, end: 3.9 },
          { text: "the", start: 3.9, end: 4.1 },
          { text: "pressure.", start: 4.1, end: 4.8 },
        ],
      },
      {
        index: 1,
        text: "Why airplane windows?",
        start: 0.0,
        end: 2.5,
        words: [
          { text: "Why", start: 0.2, end: 0.5 },
          { text: "airplane", start: 0.5, end: 1.2 },
          { text: "windows?", start: 1.2, end: 1.9 },
        ],
      },
    ],
  };

  const allChunks = buildAllChunks(subtitleData);
  assert.equal(allChunks.length, 2);
  assert.equal(allChunks[0].segmentIndex, 1);
  assert.equal(allChunks[0].words[0].text, "Why");
  assert.equal(allChunks[1].segmentIndex, 2);
  assert.equal(allChunks[1].words[0].text, "It");
});

test("getActiveWordIndex highlights spoken word and bridges micro-pauses", () => {
  const chunk: SubtitleChunk = {
    id: "test-c-0",
    segmentIndex: 1,
    start: 1.0,
    end: 3.0,
    words: [
      { text: "First", start: 1.0, end: 1.4 },
      { text: "second", start: 1.5, end: 1.9 }, // 0.1s gap between 1.4 and 1.5
      { text: "third", start: 2.0, end: 2.5 },
    ],
  };

  // Exactly inside word 0
  assert.equal(getActiveWordIndex(chunk, 1.2), 0);

  // In the micro-pause between word 0 and word 1 (1.45s) -> keeps word 0 highlighted
  assert.equal(getActiveWordIndex(chunk, 1.45), 0);

  // Inside word 1
  assert.equal(getActiveWordIndex(chunk, 1.7), 1);

  // Inside word 2
  assert.equal(getActiveWordIndex(chunk, 2.2), 2);

  // In trailing display window after word 2 finishes (2.7s) -> keeps word 2 highlighted
  assert.equal(getActiveWordIndex(chunk, 2.7), 2);
});

test("findActiveSubtitle accurately tracks seeking, playback, and boundaries", () => {
  const chunks: SubtitleChunk[] = [
    {
      id: "c-1",
      segmentIndex: 1,
      start: 0.5,
      end: 2.0,
      words: [
        { text: "Hello", start: 0.5, end: 0.9 },
        { text: "world", start: 1.0, end: 1.5 },
        { text: "today", start: 1.5, end: 1.9 },
      ],
    },
    {
      id: "c-2",
      segmentIndex: 2,
      start: 3.0,
      end: 4.5,
      words: [
        { text: "Next", start: 3.0, end: 3.4 },
        { text: "scene", start: 3.4, end: 3.9 },
        { text: "starts", start: 3.9, end: 4.4 },
      ],
    },
  ];

  // 1. Before any audio starts (t = 0.2s)
  const before = findActiveSubtitle(chunks, 0.2);
  assert.equal(before.chunk, null);
  assert.equal(before.activeWordIndex, -1);

  // 2. Playback: first word active (t = 0.7s)
  const playing1 = findActiveSubtitle(chunks, 0.7);
  assert.equal(playing1.chunk?.id, "c-1");
  assert.equal(playing1.activeWordIndex, 0);

  // 3. Playback: second word active (t = 1.2s)
  const playing2 = findActiveSubtitle(chunks, 1.2);
  assert.equal(playing2.chunk?.id, "c-1");
  assert.equal(playing2.activeWordIndex, 1);

  // 4. In gap between scenes (t = 2.5s)
  const inGap = findActiveSubtitle(chunks, 2.5);
  assert.equal(inGap.chunk, null);
  assert.equal(inGap.activeWordIndex, -1);

  // 5. Seeking to scene 2 (t = 3.5s)
  const seeked = findActiveSubtitle(chunks, 3.5);
  assert.equal(seeked.chunk?.id, "c-2");
  assert.equal(seeked.activeWordIndex, 1);

  // 6. Seeking back to beginning (t = 0.6s)
  const seekedBack = findActiveSubtitle(chunks, 0.6);
  assert.equal(seekedBack.chunk?.id, "c-1");
  assert.equal(seekedBack.activeWordIndex, 0);

  // 7. Video ended (t = 6.0s)
  const afterEnd = findActiveSubtitle(chunks, 6.0);
  assert.equal(afterEnd.chunk, null);
  assert.equal(afterEnd.activeWordIndex, -1);
});

test("handles edge cases: null, undefined, empty segments, negative time", () => {
  assert.deepEqual(buildAllChunks(null), []);
  assert.deepEqual(buildAllChunks(undefined), []);
  assert.deepEqual(buildAllChunks({ segments: [] }), []);

  // Segment with empty words array
  const emptySegs: SubtitleData = {
    segments: [
      { index: 1, text: "No words", start: 0, end: 1, words: [] },
    ],
  };
  assert.deepEqual(buildAllChunks(emptySegs), []);

  // Negative current time or NaN
  assert.deepEqual(findActiveSubtitle([], -1), { chunk: null, activeWordIndex: -1 });
  assert.deepEqual(findActiveSubtitle([], 5), { chunk: null, activeWordIndex: -1 });
});

