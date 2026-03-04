import { useState } from 'react';
import JSZip from 'jszip';
import type { ProcessingFile } from '../types';
import SrtPreview from './SrtPreview';

interface Props {
  files: ProcessingFile[];
  onBack: () => void;
  onReprocess: (fileId: string) => void;
}

export default function ReviewScreen({ files, onBack, onReprocess }: Props) {
  const [selectedId, setSelectedId] = useState(files[0]?.id ?? '');

  const selectedFile = files.find((f) => f.id === selectedId);

  const getStatusColor = (file: ProcessingFile): string => {
    if (!file.validation) return 'bg-gray-600';
    const hasErrors = file.validation.issues.some((i) => i.severity === 'error');
    const hasWarnings = file.validation.issues.some((i) => i.severity === 'warning');
    if (hasErrors) return 'bg-red-500';
    if (hasWarnings) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const downloadSrt = (file: ProcessingFile) => {
    if (!file.srtContent) return;
    const blob = new Blob([file.srtContent], { type: 'text/srt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.[^.]+$/, '.srt');
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllZip = async () => {
    const zip = new JSZip();
    for (const file of files) {
      if (file.srtContent) {
        const srtName = file.name.replace(/\.[^.]+$/, '.srt');
        zip.file(srtName, file.srtContent);
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doneFiles = files.filter((f) => f.status === 'done');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Review</h1>
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-200">
          &larr; Back to Upload
        </button>
      </div>

      <div className="flex gap-6">
        {/* Left panel: episode list */}
        <div className="w-64 shrink-0">
          <div className="space-y-1 mb-4">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => setSelectedId(file.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  file.id === selectedId
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(file)}`} />
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <button
              onClick={downloadAllZip}
              disabled={doneFiles.length === 0}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Download All SRTs (.zip)
            </button>
          </div>
        </div>

        {/* Right panel: SRT preview */}
        <div className="flex-1 min-w-0">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-200 truncate">
                  {selectedFile.name}
                </h2>
                <div className="flex gap-2 shrink-0">
                  {selectedFile.status === 'error' && (
                    <button
                      onClick={() => onReprocess(selectedFile.id)}
                      className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                    >
                      Re-process
                    </button>
                  )}
                  {selectedFile.srtContent && (
                    <button
                      onClick={() => downloadSrt(selectedFile)}
                      className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Download SRT
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              {selectedFile.status === 'done' && (
                <div className="flex gap-4 mb-3 text-xs text-gray-400">
                  <span>Blocks: {selectedFile.blockCount}</span>
                  <span>Avg CPS: {selectedFile.avgCPS?.toFixed(1)}</span>
                  {selectedFile.validation && (
                    <>
                      <span className="text-red-400">
                        Errors: {selectedFile.validation.issues.filter((i) => i.severity === 'error').length}
                      </span>
                      <span className="text-yellow-400">
                        Warnings: {selectedFile.validation.issues.filter((i) => i.severity === 'warning').length}
                      </span>
                    </>
                  )}
                </div>
              )}

              {selectedFile.status === 'done' ? (
                <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
                  <SrtPreview file={selectedFile} />
                </div>
              ) : selectedFile.status === 'error' ? (
                <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
                  {selectedFile.error}
                </div>
              ) : (
                <div className="text-gray-500">Not processed yet</div>
              )}
            </>
          ) : (
            <div className="text-gray-500">Select an episode</div>
          )}
        </div>
      </div>
    </div>
  );
}
