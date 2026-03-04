import { useState, useCallback, useRef } from 'react';
import type { AppConfig, ProcessingFile } from '../types';
import { extractAudio, getAudioDuration } from '../core/audioExtractor';
import { transcribe, INTER_FILE_DELAY_MS } from '../core/groqApi';
import { postprocess } from '../core/postprocess';
import { formatSrt } from '../core/srtFormatter';
import { validate } from '../core/validator';
import { calcCPS } from '../utils/timing';
import FileRow from './FileRow';

const ACCEPTED_FORMATS = '.mp4,.mov,.mp3,.wav,.m4a,.webm,.ogg,.flac';
const MAX_FILES = 15;

interface Props {
  config: AppConfig;
  onComplete: (files: ProcessingFile[]) => void;
  onBack: () => void;
}

export default function UploadScreen({ config, onComplete, onBack }: Props) {
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: ProcessingFile[] = [];
    const arr = Array.from(fileList).slice(0, MAX_FILES - files.length);

    for (const file of arr) {
      const duration = await getAudioDuration(file);
      newFiles.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        duration: duration || null,
        status: 'pending',
      });
    }

    setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES));
  }, [files.length]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [addFiles],
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFile = (id: string, update: Partial<ProcessingFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...update } : f)));
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

  const startProcessing = async () => {
    setIsProcessing(true);
    stopRef.current = false;
    abortRef.current = new AbortController();

    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error');

    for (let i = 0; i < pendingFiles.length; i++) {
      if (stopRef.current) break;

      const file = pendingFiles[i];
      setCurrentIndex(i);

      try {
        // Step 1: Extract audio
        updateFile(file.id, { status: 'extracting_audio', error: undefined });
        const audioData = await extractAudio(file.file);

        if (stopRef.current) break;

        // Step 2: Transcribe
        updateFile(file.id, { status: 'transcribing' });
        const whisperResponse = await transcribe(
          audioData,
          config.apiKey,
          config.model,
          config.seriesPrompt,
          abortRef.current.signal,
        );

        if (stopRef.current) break;

        // Step 3: Post-process
        updateFile(file.id, { status: 'postprocessing' });
        const blocks = postprocess(whisperResponse, config.settings);

        // Step 4: Format SRT
        const srtContent = formatSrt(blocks);

        // Step 5: Validate
        const validation = validate(blocks, config.settings, file.duration ?? undefined);

        // Compute stats
        const blockCount = blocks.length;
        let totalCPS = 0;
        for (const b of blocks) {
          const text = b.lines.join(' ');
          totalCPS += calcCPS(text, b.startTime, b.endTime);
        }
        const avgCPS = blockCount > 0 ? totalCPS / blockCount : 0;

        updateFile(file.id, {
          status: 'done',
          subtitleBlocks: blocks,
          srtContent,
          validation,
          blockCount,
          avgCPS,
        });

        // Inter-file delay (rate limiting)
        if (i < pendingFiles.length - 1 && !stopRef.current) {
          await new Promise((resolve) => setTimeout(resolve, INTER_FILE_DELAY_MS));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateFile(file.id, { status: 'pending', error: undefined });
          break;
        }
        updateFile(file.id, { status: 'error', error: message });
      }
    }

    setIsProcessing(false);
  };

  const stopProcessing = () => {
    stopRef.current = true;
    abortRef.current?.abort();
  };

  const doneFiles = files.filter((f) => f.status === 'done');
  const hasPending = files.some((f) => f.status === 'pending' || f.status === 'error');
  const allDone = files.length > 0 && doneFiles.length === files.length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Upload & Process</h1>
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-200">
          &larr; Settings
        </button>
      </div>

      {/* Drop zone */}
      {!isProcessing && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
            dragOver ? 'border-blue-400 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <p className="text-gray-400 mb-2">
            Drag & drop video/audio files here
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Up to {MAX_FILES} files. Supported: mp4, mov, mp3, wav, m4a, webm, ogg, flac
          </p>
          <label className="inline-block px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg cursor-pointer transition-colors">
            Browse files
            <input
              type="file"
              multiple
              accept={ACCEPTED_FORMATS}
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* File table */}
      {files.length > 0 && (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-600 text-xs text-gray-400 uppercase">
                  <th className="py-2 px-3 text-left">File</th>
                  <th className="py-2 px-3 text-center">Duration</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center">Blocks</th>
                  <th className="py-2 px-3 text-center">Avg CPS</th>
                  <th className="py-2 px-3 text-center">Download</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <FileRow
                    key={f.id}
                    file={f}
                    onDownload={() => downloadSrt(f)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Progress indicator */}
          {isProcessing && (
            <div className="mb-4 text-sm text-gray-300">
              [{currentIndex + 1}/{files.filter((f) => f.status !== 'done').length + currentIndex + 1}]
              Processing {files.find((f) => f.status !== 'done' && f.status !== 'pending' && f.status !== 'error')?.name ?? '...'}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!isProcessing && hasPending && (
              <button
                onClick={startProcessing}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Start Transcription
              </button>
            )}

            {isProcessing && (
              <button
                onClick={stopProcessing}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Stop
              </button>
            )}

            {!isProcessing && files.length > 0 && (
              <button
                onClick={() => setFiles([])}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 text-sm"
              >
                Clear all
              </button>
            )}

            {allDone && (
              <button
                onClick={() => onComplete(files)}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Review Results
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
