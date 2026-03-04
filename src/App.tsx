import { useState, useEffect } from 'react';
import type { AppConfig, AppScreen, ProcessingFile } from './types';
import { DEFAULT_SETTINGS } from './types';
import SetupScreen from './components/SetupScreen';
import UploadScreen from './components/UploadScreen';
import ReviewScreen from './components/ReviewScreen';

const STORAGE_KEY = 'srt-service-config';

function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        apiKey: parsed.apiKey ?? '',
        model: parsed.model ?? 'whisper-large-v3-turbo',
        seriesPrompt: parsed.seriesPrompt ?? '',
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      };
    }
  } catch { /* ignore */ }
  return {
    apiKey: '',
    model: 'whisper-large-v3-turbo',
    seriesPrompt: '',
    settings: DEFAULT_SETTINGS,
  };
}

function saveConfig(config: AppConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('setup');
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const [processedFiles, setProcessedFiles] = useState<ProcessingFile[]>([]);

  useEffect(() => {
    if (config.apiKey) {
      setScreen('upload');
    }
  }, []);

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleComplete = (files: ProcessingFile[]) => {
    setProcessedFiles(files);
    setScreen('review');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-6">
        {/* Navigation breadcrumb */}
        <div className="max-w-6xl mx-auto mb-6 flex items-center gap-2 text-sm text-gray-500">
          <span
            onClick={() => setScreen('setup')}
            className={`cursor-pointer hover:text-gray-300 ${screen === 'setup' ? 'text-white' : ''}`}
          >
            Setup
          </span>
          <span>/</span>
          <span
            onClick={() => setScreen('upload')}
            className={`cursor-pointer hover:text-gray-300 ${screen === 'upload' ? 'text-white' : ''}`}
          >
            Upload
          </span>
          <span>/</span>
          <span
            className={screen === 'review' ? 'text-white' : ''}
          >
            Review
          </span>
        </div>

        {screen === 'setup' && (
          <SetupScreen
            config={config}
            onSave={handleSaveConfig}
            onNext={() => setScreen('upload')}
          />
        )}

        {screen === 'upload' && (
          <UploadScreen
            config={config}
            onComplete={handleComplete}
            onBack={() => setScreen('setup')}
          />
        )}

        {screen === 'review' && (
          <ReviewScreen
            files={processedFiles}
            onBack={() => setScreen('upload')}
            onReprocess={(fileId) => {
              setProcessedFiles((prev) =>
                prev.map((f) =>
                  f.id === fileId ? { ...f, status: 'pending' as const, error: undefined } : f,
                ),
              );
              setScreen('upload');
            }}
          />
        )}
      </div>
    </div>
  );
}
