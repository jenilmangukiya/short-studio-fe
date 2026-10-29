import type { SubtitleData, WordTimestamp } from "./types";

export interface SubtitleChunk {
  id: string;
  segmentIndex: number;
  words: WordTimestamp[];
  start: number;
  end: number;
}

export interface ActiveSubtitleState {
  chunk: SubtitleChunk | null;
  activeWordIndex: number;
}

const TERMINAL_PUNCT = /[.!?]["'”’)]*$/;
const CLAUSE_PUNCT = /[,;:—–]["'”’)]*$/;
const PAUSE_BREAK_SEC = 0.35;
const CLAUSE_PAUSE_SEC = 0.15;
const MAX_CAPTION_CHARS = 28;
const TARGET_WORDS_PER_CHUNK = 4;
const MAX_WORDS_PER_CHUNK = 5;

/**
 * Determine fallback chunk sizes for a segment of words such that each chunk
 * contains between 3 and 5 words (unless the entire segment has fewer than 3 words).
 */
export function getChunkSizes(totalWords: number): number[] {
  if (totalWords <= 0) return [];
  if (totalWords <= 5) return [totalWords];

  const sizes: number[] = [];
  let remaining = totalWords;

  while (remaining > 0) {
    if (remaining <= 5) {
      sizes.push(remaining);
      break;
    }
    if (remaining === 6) {
      sizes.push(3, 3);
      break;
    }
    if (remaining === 7) {
      sizes.push(4, 3);
      break;
    }
    if (remaining === 8) {
      sizes.push(4, 4);
      break;
    }
    // For 9+, consume 4 and continue partitioning
    sizes.push(4);
    remaining -= 4;
  }

  return sizes;
}

/**
 * Partition aligned words into readable subtitle chunks respecting sentence/clause
 * punctuation, acoustic speech pauses, character length, and word count limits.
 * Mirrors backend `_partition_words_into_captions` in `app/subtitles/types.py`.
 */
export function partitionWordsIntoChunks(words: WordTimestamp[]): WordTimestamp[][] {
  if (!words || words.length === 0) return [];

  const groups: WordTimestamp[][] = [];
  let current: WordTimestamp[] = [];
  let currentChars = 0;

  for (let idx = 0; idx < words.length; idx++) {
    const word = words[idx];
    const wordText = (word.text || "").trim();
    if (!wordText) continue;

    const wordLen = wordText.length;
    const projectedChars = currentChars === 0 ? wordLen : currentChars + 1 + wordLen;

    if (
      current.length > 0 &&
      (projectedChars > MAX_CAPTION_CHARS || current.length >= MAX_WORDS_PER_CHUNK)
    ) {
      groups.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(word);
    currentChars = currentChars === 0 ? wordLen : currentChars + 1 + wordLen;

    const isLast = idx === words.length - 1;
    if (isLast) {
      groups.push(current);
      current = [];
      currentChars = 0;
      break;
    }

    const nextWord = words[idx + 1];
    const gap = Math.max(0, nextWord.start - word.end);
    const hasTerminal = TERMINAL_PUNCT.test(wordText);
    const hasClause = CLAUSE_PUNCT.test(wordText);

    const shouldBreak =
      hasTerminal ||
      gap >= PAUSE_BREAK_SEC ||
      (hasClause && (current.length >= 2 || gap >= CLAUSE_PAUSE_SEC)) ||
      (current.length >= TARGET_WORDS_PER_CHUNK && currentChars >= 18);

    if (shouldBreak) {
      groups.push(current);
      current = [];
      currentChars = 0;
    }
  }

  if (current.length > 0) {
    groups.push(current);
  }

  // Merge trailing single-word orphan into previous chunk if no pause/sentence boundary separates them
  if (groups.length >= 2 && groups[groups.length - 1].length === 1) {
    const prevGroup = groups[groups.length - 2];
    const lastWord = groups[groups.length - 1][0];
    const prevLast = prevGroup[prevGroup.length - 1];
    const gap = Math.max(0, lastWord.start - prevLast.end);
    const prevChars = prevGroup.reduce((sum, w) => sum + w.text.length, 0) + (prevGroup.length - 1);
    if (
      !TERMINAL_PUNCT.test(prevLast.text.trim()) &&
      gap < PAUSE_BREAK_SEC &&
      prevGroup.length < MAX_WORDS_PER_CHUNK &&
      prevChars + 1 + lastWord.text.length <= MAX_CAPTION_CHARS + 4
    ) {
      prevGroup.push(lastWord);
      groups.pop();
    }
  }

  return groups;
}

/**
 * Group a segment's words into timed subtitle chunks.
 */
export function chunkWords(
  words: WordTimestamp[],
  segmentIndex: number,
  segmentEnd?: number
): SubtitleChunk[] {
  if (!words || words.length === 0) return [];

  // Filter out any invalid items
  const validWords = words.filter(
    (w) => typeof w.text === "string" && !Number.isNaN(w.start) && !Number.isNaN(w.end)
  );
  if (validWords.length === 0) return [];

  const groups = partitionWordsIntoChunks(validWords);
  const chunks: SubtitleChunk[] = [];

  for (let cIdx = 0; cIdx < groups.length; cIdx++) {
    const chunkWordsSlice = groups[cIdx];
    const isLastChunk = cIdx === groups.length - 1;

    const chunkStart = chunkWordsSlice[0].start;
    const lastWord = chunkWordsSlice[chunkWordsSlice.length - 1];
    const lastWordEnd = Math.max(chunkStart + 0.12, lastWord.end);

    let chunkEnd: number;
    if (!isLastChunk) {
      const nextChunkStart = groups[cIdx + 1][0].start;
      const gap = nextChunkStart - lastWordEnd;
      if (gap > 0.4) {
        chunkEnd = Math.min(nextChunkStart, Math.max(chunkStart + 0.6, lastWordEnd + 0.35));
      } else {
        chunkEnd = Math.max(lastWordEnd, nextChunkStart);
      }
    } else {
      // Hold for a natural reading pause (0.35s) at the end of the segment;
      // if segmentEnd is strictly greater than lastWordEnd, respect it as an upper bound.
      const desiredEnd = Math.max(chunkStart + 0.6, lastWordEnd + 0.35);
      if (segmentEnd && segmentEnd > lastWordEnd + 0.05) {
        chunkEnd = Math.max(lastWordEnd, Math.min(segmentEnd, desiredEnd));
      } else {
        chunkEnd = desiredEnd;
      }
    }

    chunks.push({
      id: `seg-${segmentIndex}-c-${cIdx}`,
      segmentIndex,
      words: chunkWordsSlice,
      start: chunkStart,
      end: chunkEnd,
    });
  }

  return chunks;
}

/**
 * Build flat, sorted subtitle chunks across all segments for a video,
 * clamping consecutive chunk end times so cross-segment chunks never overlap.
 */
export function buildAllChunks(subtitles: SubtitleData | null | undefined): SubtitleChunk[] {
  if (!subtitles || !Array.isArray(subtitles.segments) || subtitles.segments.length === 0) {
    return [];
  }

  const sortedSegments = [...subtitles.segments].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0) || (a.start ?? 0) - (b.start ?? 0)
  );

  const allChunks: SubtitleChunk[] = [];
  for (const seg of sortedSegments) {
    if (!seg.words || seg.words.length === 0) continue;
    const segChunks = chunkWords(seg.words, seg.index ?? 1, seg.end);
    allChunks.push(...segChunks);
  }

  allChunks.sort((a, b) => a.start - b.start);

  // Prevent cross-segment overlap and smoothly bridge tiny inter-segment gaps
  for (let i = 0; i < allChunks.length - 1; i++) {
    const curr = allChunks[i];
    const next = allChunks[i + 1];
    if (next.start > curr.start) {
      const lastWordEnd = Math.max(
        curr.start + 0.12,
        curr.words[curr.words.length - 1]?.end ?? curr.end
      );
      const gap = next.start - lastWordEnd;
      if (gap >= 0 && gap <= 0.4) {
        curr.end = next.start;
      } else if (curr.end > next.start) {
        curr.end = next.start;
      }
    }
  }

  return allChunks;
}

/**
 * Determine which word within the active chunk corresponds to currentTime.
 */
export function getActiveWordIndex(chunk: SubtitleChunk, currentTime: number): number {
  const words = chunk.words;
  if (!words || words.length === 0) return -1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = words[i + 1];

    // Current time is within the spoken boundaries of this word
    if (currentTime >= word.start && currentTime <= word.end) {
      return i;
    }

    // Current time is in the micro-gap between this word and the next word:
    // keep the current word highlighted for a seamless transition.
    if (nextWord && currentTime > word.end && currentTime < nextWord.start) {
      return i;
    }
  }

  // If time is before the first word but within the chunk's display window
  if (currentTime < words[0].start) {
    return 0;
  }

  // If time is after the last word's end but within chunk's trailing display window
  if (currentTime > words[words.length - 1].end) {
    return words.length - 1;
  }

  return -1;
}

/**
 * Find the active chunk and currently spoken word for a given video currentTime.
 */
export function findActiveSubtitle(
  chunks: SubtitleChunk[],
  currentTime: number
): ActiveSubtitleState {
  if (!chunks || chunks.length === 0 || currentTime < 0) {
    return { chunk: null, activeWordIndex: -1 };
  }

  // Find the chunk that spans currentTime
  const activeChunk = chunks.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );

  if (!activeChunk) {
    return { chunk: null, activeWordIndex: -1 };
  }

  const activeWordIndex = getActiveWordIndex(activeChunk, currentTime);
  return { chunk: activeChunk, activeWordIndex };
}
