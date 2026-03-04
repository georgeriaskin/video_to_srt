import type { ProcessingFile } from '../types';

interface Props {
  file: ProcessingFile;
  onDownload?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  extracting_audio: 'Extracting audio...',
  transcribing: 'Transcribing...',
  postprocessing: 'Post-processing...',
  done: 'Done',
  error: 'Error',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-gray-400',
  extracting_audio: 'text-yellow-400',
  transcribing: 'text-blue-400',
  postprocessing: 'text-purple-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

export default function FileRow({ file, onDownload }: Props) {
  const formatDuration = (d: number | null) => {
    if (!d) return '—';
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <tr className="border-b border-gray-700">
      <td className="py-2 px-3 text-sm text-gray-200 max-w-[200px] truncate" title={file.name}>
        {file.name}
      </td>
      <td className="py-2 px-3 text-sm text-gray-400 text-center">
        {formatDuration(file.duration)}
      </td>
      <td className={`py-2 px-3 text-sm text-center ${STATUS_COLORS[file.status]}`}>
        {STATUS_LABELS[file.status]}
        {file.error && (
          <span className="block text-xs text-red-400 truncate max-w-[200px]" title={file.error}>
            {file.error}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-sm text-gray-400 text-center">
        {file.blockCount ?? '—'}
      </td>
      <td className="py-2 px-3 text-sm text-gray-400 text-center">
        {file.avgCPS != null ? file.avgCPS.toFixed(1) : '—'}
      </td>
      <td className="py-2 px-3 text-center">
        {file.status === 'done' && file.srtContent && (
          <button
            onClick={onDownload}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            .srt
          </button>
        )}
      </td>
    </tr>
  );
}
