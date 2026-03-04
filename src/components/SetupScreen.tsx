import { useState, useEffect } from 'react';
import type { AppConfig, WhisperModel } from '../types';
import { DEFAULT_SETTINGS } from '../types';

interface Props {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  onNext: () => void;
}

const MODELS: { value: WhisperModel; label: string }[] = [
  { value: 'whisper-large-v3-turbo', label: 'whisper-large-v3-turbo (recommended)' },
  { value: 'whisper-large-v3', label: 'whisper-large-v3' },
  { value: 'distil-whisper-large-v3-en', label: 'distil-whisper-large-v3-en' },
];

export default function SetupScreen({ config, onSave, onNext }: Props) {
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState<WhisperModel>(config.model);
  const [prompt, setPrompt] = useState(config.seriesPrompt);
  const [settings, setSettings] = useState(config.settings);

  useEffect(() => {
    setApiKey(config.apiKey);
    setModel(config.model);
    setPrompt(config.seriesPrompt);
    setSettings(config.settings);
  }, [config]);

  const handleSave = () => {
    const newConfig: AppConfig = { apiKey, model, seriesPrompt: prompt, settings };
    onSave(newConfig);
    onNext();
  };

  const updateSetting = (key: string, value: number) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const canProceed = apiKey.trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Setup</h1>

      <div className="space-y-6">
        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Groq API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="gsk_..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Saved in localStorage. Never sent anywhere except Groq API.
          </p>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Whisper Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as WhisperModel)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Series Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Series Prompt (optional)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Character names, terms, etc. E.g.: Wishroom, Elena, Marcus"
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
          />
        </div>

        {/* Subtitle Settings */}
        <div>
          <h2 className="text-sm font-medium text-gray-300 mb-3">
            Subtitle Settings (vertical 9:16)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <SettingInput
              label="Max chars/line"
              value={settings.maxCharsPerLine}
              onChange={(v) => updateSetting('maxCharsPerLine', v)}
            />
            <SettingInput
              label="Max CPS"
              value={settings.maxCPS}
              onChange={(v) => updateSetting('maxCPS', v)}
            />
            <SettingInput
              label="Min duration (s)"
              value={settings.minDuration}
              onChange={(v) => updateSetting('minDuration', v)}
              step={0.1}
            />
            <SettingInput
              label="Min gap (s)"
              value={settings.minGap}
              onChange={(v) => updateSetting('minGap', v)}
              step={0.01}
            />
          </div>
          <button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-300 underline"
          >
            Reset to defaults
          </button>
        </div>

        {/* Next */}
        <button
          onClick={handleSave}
          disabled={!canProceed}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
        >
          Continue to Upload
        </button>
      </div>
    </div>
  );
}

function SettingInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
