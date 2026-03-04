import type { WhisperModel, WhisperResponse } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 10_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function transcribe(
  audioData: Uint8Array,
  apiKey: string,
  model: WhisperModel,
  prompt: string,
  signal?: AbortSignal,
): Promise<WhisperResponse> {
  const formData = new FormData();
  formData.append('file', new Blob([audioData], { type: 'audio/wav' }), 'audio.wav');
  formData.append('model', model);
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('language', 'en');
  formData.append('temperature', '0');
  if (prompt.trim()) {
    formData.append('prompt', prompt.trim());
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal,
      });

      if (response.status === 429) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`Rate limited (429). Retrying in ${backoff / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errorText}`);
      }

      return (await response.json()) as WhisperResponse;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastError = err as Error;
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`Request failed. Retrying in ${backoff / 1000}s...`, err);
        await sleep(backoff);
      }
    }
  }

  throw lastError ?? new Error('Transcription failed after retries');
}

/** Delay between sequential file processing */
export const INTER_FILE_DELAY_MS = 3000;
