import type { SubtitleBlock, SubtitleSettings, ValidationIssue, ValidationResult } from '../types';
import { calcCPS } from '../utils/timing';

export function validate(
  blocks: SubtitleBlock[],
  settings: SubtitleSettings,
  audioDuration?: number,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = block.lines.join('\n');
    const plainText = block.lines.join(' ');
    const duration = block.endTime - block.startTime;
    const cps = calcCPS(plainText, block.startTime, block.endTime);

    // Check line length
    for (const line of block.lines) {
      if (line.length > settings.maxCharsPerLine) {
        issues.push({
          blockIndex: i,
          severity: 'error',
          message: `Line too long: ${line.length} chars (max ${settings.maxCharsPerLine})`,
        });
      }
    }

    // Check line count
    if (block.lines.length > settings.maxLinesPerBlock) {
      issues.push({
        blockIndex: i,
        severity: 'error',
        message: `Too many lines: ${block.lines.length} (max ${settings.maxLinesPerBlock})`,
      });
    }

    // Check empty blocks
    if (!text.trim()) {
      issues.push({
        blockIndex: i,
        severity: 'error',
        message: 'Empty subtitle block',
      });
    }

    // Check CPS
    if (cps > 18) {
      issues.push({
        blockIndex: i,
        severity: 'error',
        message: `CPS too high: ${cps.toFixed(1)} (max 18)`,
      });
    } else if (cps > settings.maxCPS) {
      issues.push({
        blockIndex: i,
        severity: 'warning',
        message: `CPS above target: ${cps.toFixed(1)} (target ${settings.maxCPS})`,
      });
    }

    // Check min duration
    if (duration < settings.minDuration && duration > 0) {
      issues.push({
        blockIndex: i,
        severity: 'warning',
        message: `Short duration: ${duration.toFixed(2)}s (min ${settings.minDuration}s)`,
      });
    }

    // Check max duration
    if (duration > settings.maxDuration) {
      issues.push({
        blockIndex: i,
        severity: 'warning',
        message: `Long duration: ${duration.toFixed(2)}s (max ${settings.maxDuration}s)`,
      });
    }

    // Check timing overlaps
    if (i > 0) {
      const prev = blocks[i - 1];
      const gap = block.startTime - prev.endTime;
      if (gap < 0) {
        issues.push({
          blockIndex: i,
          severity: 'error',
          message: `Overlaps with previous block by ${(-gap * 1000).toFixed(0)}ms`,
        });
      } else if (gap < settings.minGap && gap >= 0) {
        issues.push({
          blockIndex: i,
          severity: 'warning',
          message: `Gap too small: ${(gap * 1000).toFixed(0)}ms (min ${settings.minGap * 1000}ms)`,
        });
      }
    }

    // Check for long pauses (possible missed speech)
    if (i > 0) {
      const prev = blocks[i - 1];
      const gap = block.startTime - prev.endTime;
      if (gap > 10) {
        issues.push({
          blockIndex: i,
          severity: 'warning',
          message: `Long pause: ${gap.toFixed(1)}s gap — possible missed speech`,
        });
      }
    }
  }

  // Check for hallucination patterns (repeated phrases)
  detectHallucinations(blocks, issues);

  // Check total coverage vs audio duration
  if (audioDuration && blocks.length > 0) {
    const lastEnd = blocks[blocks.length - 1].endTime;
    const ratio = lastEnd / audioDuration;
    if (ratio < 0.8 || ratio > 1.2) {
      issues.push({
        blockIndex: -1,
        severity: 'warning',
        message: `Subtitle coverage ${(ratio * 100).toFixed(0)}% of audio duration (expected ~100%)`,
      });
    }
  }

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

function detectHallucinations(blocks: SubtitleBlock[], issues: ValidationIssue[]): void {
  if (blocks.length < 5) return;

  for (let i = 0; i <= blocks.length - 5; i++) {
    const windowTexts = blocks.slice(i, i + 5).map((b) => b.lines.join(' ').toLowerCase());

    // Check if any 3+ word phrase repeats in all 5 consecutive blocks
    const words0 = windowTexts[0].split(/\s+/);
    for (let w = 0; w <= words0.length - 3; w++) {
      const phrase = words0.slice(w, w + 3).join(' ');
      if (phrase.length < 5) continue;
      const count = windowTexts.filter((t) => t.includes(phrase)).length;
      if (count >= 5) {
        issues.push({
          blockIndex: i,
          severity: 'error',
          message: `Possible hallucination: "${phrase}" repeats in 5 consecutive blocks`,
        });
        return;
      }
    }
  }
}
