import type { ProcessingFile } from '../types';
import { formatSrtTime, calcCPS } from '../utils/timing';

interface Props {
  file: ProcessingFile;
}

export default function SrtPreview({ file }: Props) {
  if (!file.subtitleBlocks || !file.validation) return null;

  const issuesByBlock = new Map<number, typeof file.validation.issues>();
  for (const issue of file.validation.issues) {
    const arr = issuesByBlock.get(issue.blockIndex) ?? [];
    arr.push(issue);
    issuesByBlock.set(issue.blockIndex, arr);
  }

  // Global issues (blockIndex = -1)
  const globalIssues = file.validation.issues.filter((i) => i.blockIndex === -1);

  return (
    <div className="space-y-1">
      {globalIssues.length > 0 && (
        <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-sm text-yellow-300">
          {globalIssues.map((issue, i) => (
            <div key={i}>{issue.message}</div>
          ))}
        </div>
      )}

      {file.subtitleBlocks.map((block, i) => {
        const blockIssues = issuesByBlock.get(i) ?? [];
        const hasError = blockIssues.some((i) => i.severity === 'error');
        const hasWarning = blockIssues.some((i) => i.severity === 'warning');
        const text = block.lines.join(' ');
        const cps = calcCPS(text, block.startTime, block.endTime);
        const duration = block.endTime - block.startTime;

        let bgClass = 'bg-gray-800/50';
        if (hasError) bgClass = 'bg-red-900/30 border border-red-700';
        else if (hasWarning) bgClass = 'bg-yellow-900/20 border border-yellow-700/50';

        return (
          <div key={i} className={`p-2 rounded text-sm ${bgClass}`}>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>#{i + 1}</span>
              <span>
                {formatSrtTime(block.startTime)} → {formatSrtTime(block.endTime)}
                {' '}({duration.toFixed(2)}s, {cps.toFixed(1)} CPS)
              </span>
              <span>
                {block.lines.map((l) => l.length).join('/')} chars
              </span>
            </div>
            <div className="font-mono text-gray-200 whitespace-pre-wrap">
              {block.lines.join('\n')}
            </div>
            {blockIssues.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {blockIssues.map((issue, j) => (
                  <div
                    key={j}
                    className={`text-xs ${issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
                  >
                    {issue.severity === 'error' ? '!!' : '!'} {issue.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
