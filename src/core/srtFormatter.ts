import type { SubtitleBlock } from '../types';
import { formatSrtTime } from '../utils/timing';

/** Format subtitle blocks into SRT string */
export function formatSrt(blocks: SubtitleBlock[]): string {
  return blocks
    .map((block, i) => {
      const index = i + 1;
      const start = formatSrtTime(block.startTime);
      const end = formatSrtTime(block.endTime);
      const text = block.lines.join('\n');
      return `${index}\n${start} --> ${end}\n${text}`;
    })
    .join('\n\n') + '\n';
}
