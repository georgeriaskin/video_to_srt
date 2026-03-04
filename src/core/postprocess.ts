import type { WhisperResponse, WhisperWord, SubtitleBlock, SubtitleSettings } from '../types';
import { splitIntoLines, isFiller, cleanText } from '../utils/textProcessing';
import { calcCPS } from '../utils/timing';

interface WordSpan {
  word: string;
  start: number;
  end: number;
}

/**
 * Main post-processing pipeline.
 * Converts raw Whisper response into production-quality subtitle blocks.
 */
export function postprocess(
  response: WhisperResponse,
  settings: SubtitleSettings,
): SubtitleBlock[] {
  // Step 1: Extract word-level spans, filter noise
  let words = extractWords(response);

  // Step 2: Remove fillers
  words = removeFillers(words);

  // Step 3: Group words into sentences
  const sentences = groupIntoSentences(words);

  // Step 4: Build subtitle blocks from sentences, respecting char limits
  let blocks = buildBlocks(sentences, settings);

  // Step 5: Apply timing constraints
  blocks = applyTimingConstraints(blocks, settings);

  // Step 6: Ensure no overlaps with minimum gap
  blocks = fixOverlaps(blocks, settings);

  // Step 7: Clean text and format lines
  blocks = formatBlockLines(blocks, settings);

  // Step 8: Re-index
  blocks = blocks.map((b, i) => ({ ...b, index: i + 1 }));

  return blocks;
}

function extractWords(response: WhisperResponse): WordSpan[] {
  const words: WordSpan[] = [];

  // Prefer top-level words if available
  if (response.words && response.words.length > 0) {
    for (const w of response.words) {
      words.push({ word: w.word.trim(), start: w.start, end: w.end });
    }
    return words.filter((w) => w.word.length > 0);
  }

  // Fall back to segment-level words
  for (const seg of response.segments) {
    // Skip segments with high no_speech_prob
    if (seg.no_speech_prob > 0.6) continue;

    if (seg.words && seg.words.length > 0) {
      for (const w of seg.words) {
        words.push({ word: w.word.trim(), start: w.start, end: w.end });
      }
    } else {
      // No word-level timestamps — treat whole segment as one block
      words.push({ word: seg.text.trim(), start: seg.start, end: seg.end });
    }
  }

  return words.filter((w) => w.word.length > 0);
}

function removeFillers(words: WordSpan[]): WordSpan[] {
  return words.filter((w) => !isFiller(w.word));
}

/**
 * Group words into sentences based on sentence-ending punctuation.
 */
function groupIntoSentences(words: WordSpan[]): WordSpan[][] {
  if (words.length === 0) return [];

  const sentences: WordSpan[][] = [];
  let current: WordSpan[] = [];

  for (const word of words) {
    current.push(word);

    const lastChar = word.word.slice(-1);
    if ('.!?'.includes(lastChar) || word.word.endsWith('...') || word.word.endsWith('—')) {
      sentences.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    sentences.push(current);
  }

  return sentences;
}

/**
 * Build subtitle blocks from sentences. Split long sentences into
 * multiple blocks so each block stays within char limits.
 */
function buildBlocks(
  sentences: WordSpan[][],
  settings: SubtitleSettings,
): SubtitleBlock[] {
  const maxBlockChars = settings.maxCharsPerLine * settings.maxLinesPerBlock;
  const blocks: SubtitleBlock[] = [];

  for (const sentence of sentences) {
    const text = sentence.map((w) => w.word).join(' ');

    if (text.length <= maxBlockChars) {
      blocks.push({
        index: 0,
        startTime: sentence[0].start,
        endTime: sentence[sentence.length - 1].end,
        lines: [text],
      });
    } else {
      // Split sentence into chunks that fit
      const chunks = splitSentenceIntoChunks(sentence, maxBlockChars);
      for (const chunk of chunks) {
        const chunkText = chunk.map((w) => w.word).join(' ');
        blocks.push({
          index: 0,
          startTime: chunk[0].start,
          endTime: chunk[chunk.length - 1].end,
          lines: [chunkText],
        });
      }
    }
  }

  return blocks;
}

/**
 * Split a sentence (array of words) into chunks of max total chars.
 * Prefer natural break points.
 */
function splitSentenceIntoChunks(
  words: WordSpan[],
  maxChars: number,
): WordSpan[][] {
  const chunks: WordSpan[][] = [];
  let current: WordSpan[] = [];
  let currentLen = 0;

  const breakWords = new Set(['and', 'but', 'or', 'so', 'that', 'which', 'when', 'where', 'while', 'because', 'before', 'after']);

  for (let i = 0; i < words.length; i++) {
    const wordLen = current.length > 0 ? words[i].word.length + 1 : words[i].word.length;

    if (currentLen + wordLen > maxChars && current.length > 0) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }

    // Prefer breaking before conjunctions/prepositions if we're over half capacity
    if (
      current.length > 0 &&
      currentLen > maxChars * 0.4 &&
      breakWords.has(words[i].word.toLowerCase().replace(/[.,!?]/g, ''))
    ) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }

    current.push(words[i]);
    currentLen += wordLen;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function applyTimingConstraints(
  blocks: SubtitleBlock[],
  settings: SubtitleSettings,
): SubtitleBlock[] {
  return blocks.map((block) => {
    let { startTime, endTime } = block;
    const text = block.lines.join(' ');
    let duration = endTime - startTime;

    // Minimum duration
    if (duration < settings.minDuration) {
      endTime = startTime + settings.minDuration;
      duration = settings.minDuration;
    }

    // Maximum duration
    if (duration > settings.maxDuration) {
      endTime = startTime + settings.maxDuration;
    }

    // Check CPS — if too high, we can't fix timing alone (text was already split)
    const cps = calcCPS(text, startTime, endTime);
    if (cps > settings.maxCPS && duration < settings.maxDuration) {
      // Extend duration to bring CPS within target
      const neededDuration = text.length / settings.maxCPS;
      endTime = startTime + Math.min(neededDuration, settings.maxDuration);
    }

    // Delay subtitle slightly after speech start for better sync
    startTime = Math.max(0, startTime + 0.05);

    return { ...block, startTime, endTime };
  });
}

function fixOverlaps(
  blocks: SubtitleBlock[],
  settings: SubtitleSettings,
): SubtitleBlock[] {
  const result = [...blocks];

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const curr = result[i];

    const gap = curr.startTime - prev.endTime;
    if (gap < settings.minGap) {
      // Trim previous block's end
      result[i - 1] = {
        ...prev,
        endTime: curr.startTime - settings.minGap,
      };

      // Ensure we didn't make duration negative
      if (result[i - 1].endTime <= result[i - 1].startTime) {
        result[i - 1] = {
          ...result[i - 1],
          endTime: result[i - 1].startTime + 0.5,
        };
        // Push current forward if needed
        result[i] = {
          ...curr,
          startTime: result[i - 1].endTime + settings.minGap,
        };
      }
    }
  }

  return result;
}

function formatBlockLines(
  blocks: SubtitleBlock[],
  settings: SubtitleSettings,
): SubtitleBlock[] {
  return blocks.map((block) => {
    const fullText = cleanText(block.lines.join(' '));
    const lines = splitIntoLines(fullText, settings.maxCharsPerLine);
    return { ...block, lines };
  });
}
