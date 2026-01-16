'use client';

import {
  STT_PROVIDERS,
  LLM_PROVIDERS,
  TTS_PROVIDERS,
  STT_OPTIONS,
  LLM_OPTIONS,
  TTS_OPTIONS,
  type ProviderInfo,
  type ModelCategory,
} from '@/lib/models';

type PluginSectionProps = {
  title: string;
  description: string;
  providers: ProviderInfo[];
  modelOptions: ModelCategory[];
  icon: string;
  color: string;
};

function PluginSection({
  title,
  description,
  providers,
  modelOptions,
  icon,
  color,
}: PluginSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className={`px-4 py-3 ${color} border-b border-slate-200`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {providers.map((provider) => {
          const categoryOptions = modelOptions.find(
            (cat) => cat.category === provider.name
          );
          return (
            <div key={provider.name} className="px-4 py-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-900">
                    {provider.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {provider.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    {provider.envKey}
                  </code>
                </div>
              </div>

              {/* Available Models */}
              {categoryOptions && categoryOptions.options.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase">
                    Available Models
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categoryOptions.options.map((option) => (
                      <div
                        key={option.value}
                        className="flex items-center justify-between bg-slate-50 rounded px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {option.label}
                          </p>
                          {option.description && (
                            <p className="text-xs text-slate-500">
                              {option.description}
                            </p>
                          )}
                        </div>
                        <code className="text-xs text-slate-400 ml-2 hidden lg:block">
                          {option.value}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PluginsPage() {
  const totalSTT = STT_OPTIONS.reduce((sum, cat) => sum + cat.options.length, 0);
  const totalLLM = LLM_OPTIONS.reduce((sum, cat) => sum + cat.options.length, 0);
  const totalTTS = TTS_OPTIONS.reduce((sum, cat) => sum + cat.options.length, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Installed Plugins</h1>
        <p className="text-sm text-slate-500 mt-1">
          Available STT, LLM, and TTS providers configured in the backend
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">STT Providers</p>
          <p className="text-2xl font-bold text-slate-900">{STT_PROVIDERS.length}</p>
          <p className="text-xs text-slate-400">{totalSTT} models available</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">LLM Providers</p>
          <p className="text-2xl font-bold text-slate-900">{LLM_PROVIDERS.length}</p>
          <p className="text-xs text-slate-400">{totalLLM} models available</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">TTS Providers</p>
          <p className="text-2xl font-bold text-slate-900">{TTS_PROVIDERS.length}</p>
          <p className="text-xs text-slate-400">{totalTTS} voices available</p>
        </div>
      </div>

      <div className="space-y-6">
        <PluginSection
          title="Speech-to-Text (STT)"
          description="Convert speech to text in real-time"
          providers={STT_PROVIDERS}
          modelOptions={STT_OPTIONS}
          icon="🎤"
          color="bg-blue-50"
        />

        <PluginSection
          title="Large Language Models (LLM)"
          description="Power conversational AI responses"
          providers={LLM_PROVIDERS}
          modelOptions={LLM_OPTIONS}
          icon="🧠"
          color="bg-purple-50"
        />

        <PluginSection
          title="Text-to-Speech (TTS)"
          description="Generate natural-sounding speech"
          providers={TTS_PROVIDERS}
          modelOptions={TTS_OPTIONS}
          icon="🔊"
          color="bg-green-50"
        />
      </div>

      {/* Configuration Note */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-500">💡</span>
          <div>
            <h3 className="text-sm font-medium text-amber-800">
              Configuration Note
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Providers require API keys to be configured in the backend{' '}
              <code className="bg-amber-100 px-1 rounded">.env</code> file. Models
              shown here are available when the corresponding provider is configured.
            </p>
            <div className="mt-2 text-xs text-amber-600">
              <p>Required environment variables:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>
                  <code className="bg-amber-100 px-1 rounded">ASSEMBLYAI_API_KEY</code>{' '}
                  - AssemblyAI STT
                </li>
                <li>
                  <code className="bg-amber-100 px-1 rounded">DEEPGRAM_API_KEY</code> -
                  Deepgram STT
                </li>
                <li>
                  <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> -
                  OpenAI STT/LLM/TTS
                </li>
                <li>
                  <code className="bg-amber-100 px-1 rounded">ELEVEN_API_KEY</code> -
                  ElevenLabs TTS
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
