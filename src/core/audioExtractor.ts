import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

export type FFmpegProgressCallback = (progress: number) => void;

async function ensureLoaded(onProgress?: FFmpegProgressCallback): Promise<FFmpeg> {
  if (ffmpeg && loadPromise) {
    await loadPromise;
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(1, progress)));
    });
  }

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

  loadPromise = ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  await loadPromise;
  return ffmpeg;
}

export async function extractAudio(
  file: File,
  onProgress?: FFmpegProgressCallback,
): Promise<Uint8Array> {
  const ff = await ensureLoaded(onProgress);

  const inputName = 'input' + getExtension(file.name);
  const outputName = 'output.wav';

  await ff.writeFile(inputName, await fetchFile(file));

  await ff.exec([
    '-i', inputName,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y', outputName,
  ]);

  const data = await ff.readFile(outputName);

  // Clean up to save memory
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  return data as Uint8Array;
}

export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      // Return 0 if we can't determine duration (will try via ffmpeg later)
      resolve(0);
    };
    audio.src = url;
  });
}

function getExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? `.${ext}` : '.mp4';
}
