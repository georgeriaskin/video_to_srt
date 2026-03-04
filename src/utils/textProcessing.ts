/** Natural break points for splitting subtitle lines */
const BREAK_AFTER = [',', '—', '...'];
const BREAK_BEFORE_WORDS = ['and', 'but', 'or', 'so', 'in', 'with', 'for', 'on', 'at', 'to', 'from', 'that', 'which', 'when', 'where', 'while', 'because', 'before', 'after'];
const PREPOSITION_PHRASES = ['in the', 'with a', 'for the', 'on the', 'at the', 'to the', 'from the'];

/**
 * Split text into balanced lines, each within maxCharsPerLine.
 * Returns 1 or 2 lines.
 */
export function splitIntoLines(text: string, maxCharsPerLine: number): string[] {
  text = text.trim();
  if (text.length <= maxCharsPerLine) {
    return [text];
  }

  // Try to find a natural break point near the middle
  const mid = Math.floor(text.length / 2);
  let bestBreak = -1;
  let bestScore = Infinity;

  const words = text.split(' ');
  let pos = 0;

  for (let i = 0; i < words.length - 1; i++) {
    pos += words[i].length;
    const breakPos = pos;
    pos += 1; // space

    const line1Len = breakPos;
    const line2Len = text.length - breakPos - 1;

    // Both lines must fit
    if (line1Len > maxCharsPerLine || line2Len > maxCharsPerLine) continue;

    // Score: distance from middle (prefer balanced) + break quality bonus
    let score = Math.abs(breakPos - mid);

    const wordBefore = words[i];
    const wordAfter = words[i + 1];

    // Prefer breaking after punctuation
    if (BREAK_AFTER.some((p) => wordBefore.endsWith(p))) {
      score -= 10;
    }

    // Prefer breaking before conjunctions/prepositions
    if (BREAK_BEFORE_WORDS.includes(wordAfter.toLowerCase())) {
      score -= 5;
    }

    // Prefer breaking before prepositional phrases
    const remaining = text.slice(breakPos + 1).toLowerCase();
    if (PREPOSITION_PHRASES.some((p) => remaining.startsWith(p))) {
      score -= 7;
    }

    if (score < bestScore) {
      bestScore = score;
      bestBreak = breakPos;
    }
  }

  if (bestBreak > 0) {
    return [text.slice(0, bestBreak).trim(), text.slice(bestBreak).trim()];
  }

  // Fallback: hard break at maxCharsPerLine on a word boundary
  let breakAt = maxCharsPerLine;
  while (breakAt > 0 && text[breakAt] !== ' ') breakAt--;
  if (breakAt === 0) breakAt = maxCharsPerLine;

  return [text.slice(0, breakAt).trim(), text.slice(breakAt).trim()];
}

/** Check if a word is a filler */
export function isFiller(word: string): boolean {
  const fillers = ['uh', 'um', 'ah', 'eh', 'hmm', 'mhm', 'uh-huh'];
  return fillers.includes(word.toLowerCase().replace(/[.,!?]/g, ''));
}

/** Clean up Whisper text artifacts */
export function cleanText(text: string): string {
  let cleaned = text.trim();

  // Remove duplicate punctuation
  cleaned = cleaned.replace(/\.{2}(?!\.)/g, '.');
  cleaned = cleaned.replace(/\.\.\.\./g, '...');
  cleaned = cleaned.replace(/,,+/g, ',');
  cleaned = cleaned.replace(/!!+/g, '!');
  cleaned = cleaned.replace(/\?\?+/g, '?');

  // Trim whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned;
}
