export interface SubtitleSettings {
  maxCharsPerLine: number;
  maxLinesPerBlock: number;
  maxCPS: number;
  minDuration: number;
  maxDuration: number;
  minGap: number;
}

export const DEFAULT_SETTINGS: SubtitleSettings = {
  maxCharsPerLine: 32,
  maxLinesPerBlock: 2,
  maxCPS: 15,
  minDuration: 1.2,
  maxDuration: 6.0,
  minGap: 0.12,
};

export type WhisperModel =
  | 'whisper-large-v3-turbo'
  | 'whisper-large-v3'
  | 'distil-whisper-large-v3-en';

export interface AppConfig {
  apiKey: string;
  model: WhisperModel;
  seriesPrompt: string;
  settings: SubtitleSettings;
}

export type FileStatus =
  | 'pending'
  | 'extracting_audio'
  | 'transcribing'
  | 'postprocessing'
  | 'done'
  | 'error';

export interface ProcessingFile {
  id: string;
  file: File;
  name: string;
  duration: number | null;
  status: FileStatus;
  error?: string;
  subtitleBlocks?: SubtitleBlock[];
  srtContent?: string;
  validation?: ValidationResult;
  blockCount?: number;
  avgCPS?: number;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
  words?: WhisperWord[];
}

export interface WhisperResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
  words?: WhisperWord[];
}

export interface SubtitleBlock {
  index: number;
  startTime: number;
  endTime: number;
  lines: string[];
}

export type ValidationSeverity = 'warning' | 'error';

export interface ValidationIssue {
  blockIndex: number;
  severity: ValidationSeverity;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export type AppScreen = 'setup' | 'upload' | 'review';
