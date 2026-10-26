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

/**
 * Determine chunk sizes for a segment of words such that each chunk contains
 * between 3 and 5 words (unless the entire segment has fewer than 3 words).
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
 * Group a segment's words into timed subtitle chunks (3-5 words each).
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

  const sizes = getChunkSizes(validWords.length);
  const chunks: SubtitleChunk[] = [];
  let wordOffset = 0;

  for (let cIdx = 0; cIdx < sizes.length; cIdx++) {
    const size = sizes[cIdx];
    const chunkWordsSlice = validWords.slice(wordOffset, wordOffset + size);
    const isLastChunk = cIdx === sizes.length - 1;

    const chunkStart = chunkWordsSlice[0].start;
    const lastWord = chunkWordsSlice[chunkWordsSlice.length - 1];
    const lastWordEnd = Math.max(chunkStart, lastWord.end);

    let chunkEnd: number;
    if (!isLastChunk) {
      const nextWord = validWords[wordOffset + size];
      const nextStart = nextWord ? nextWord.start : lastWordEnd;
      // If there is an abnormally long gap (> 0.4s) before the next chunk,
      // let the current chunk fade out after 0.35s so text doesn't linger forever.
      if (nextStart - lastWordEnd > 0.4) {
        chunkEnd = lastWordEnd + 0.35;
      } else {
        chunkEnd = Math.max(lastWordEnd, nextStart);
      }
    } else {
      // Last chunk in segment: hold for a natural reading pause (0.35s) or up to segmentEnd
      const targetEnd = lastWordEnd + 0.35;
      chunkEnd = segmentEnd ? Math.max(lastWordEnd, Math.min(segmentEnd, targetEnd)) : targetEnd;
    }

    chunks.push({
      id: `seg-${segmentIndex}-c-${cIdx}`,
      segmentIndex,
      words: chunkWordsSlice,
      start: chunkStart,
      end: chunkEnd,
    });

    wordOffset += size;
  }

  return chunks;
}

/**
 * Build flat, sorted subtitle chunks across all segments for a video.
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

  return allChunks.sort((a, b) => a.start - b.start);
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
