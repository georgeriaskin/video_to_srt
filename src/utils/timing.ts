/** Format seconds to SRT timestamp: HH:MM:SS,mmm */
export function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return (
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0') +
    ':' +
    String(s).padStart(2, '0') +
    ',' +
    String(ms).padStart(3, '0')
  );
}

/** Parse SRT timestamp to seconds */
export function parseSrtTime(ts: string): number {
  const [hms, ms] = ts.split(',');
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

/** Calculate characters per second for a subtitle block */
export function calcCPS(text: string, startTime: number, endTime: number): number {
  const duration = endTime - startTime;
  if (duration <= 0) return Infinity;
  return text.length / duration;
}
