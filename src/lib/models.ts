// Model options for STT, LLM, and TTS providers
// Based on available provider API keys in the backend

export type ModelOption = {
  value: string;
  label: string;
  description?: string;
};

export type ModelCategory = {
  category: string;
  options: ModelOption[];
};

// Speech-to-Text Models
export const STT_OPTIONS: ModelCategory[] = [
  {
    category: 'AssemblyAI',
    options: [
      { value: 'assemblyai/universal-streaming:en', label: 'Universal Streaming', description: 'Best accuracy, real-time' },
    ],
  },
  {
    category: 'Deepgram',
    options: [
      { value: 'deepgram/nova-2', label: 'Nova 2 (Recommended)', description: 'Lowest latency ~100-200ms' },
      { value: 'deepgram/nova-3:en', label: 'Nova 3', description: 'Latest model' },
      { value: 'deepgram/enhanced', label: 'Enhanced', description: 'Better for noisy environments' },
      { value: 'deepgram/base', label: 'Base', description: 'Cost-effective' },
    ],
  },
  {
    category: 'OpenAI',
    options: [
      { value: 'openai/whisper-1', label: 'Whisper', description: 'High accuracy, higher latency' },
    ],
  },
];

// Large Language Models
export const LLM_OPTIONS: ModelCategory[] = [
  {
    category: 'OpenAI',
    options: [
      { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (Recommended)', description: 'Best latency/quality balance' },
      { value: 'openai/gpt-4o', label: 'GPT-4o', description: 'Highest quality' },
      { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Fast, high quality' },
      { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fastest, lowest cost' },
    ],
  },
];

// Text-to-Speech Models with Voice IDs
export const TTS_OPTIONS: ModelCategory[] = [
  {
    category: 'ElevenLabs',
    options: [
      { value: 'elevenlabs:pNInz6obpgDQGcFmaJgB', label: 'Adam (Male)', description: 'Professional, default voice' },
      { value: 'elevenlabs:21m00Tcm4TlvDq8ikWAM', label: 'Rachel (Female)', description: 'Natural, clear' },
      { value: 'elevenlabs:EXAVITQu4vr4xnSDxMaL', label: 'Bella (Female)', description: 'Warm, friendly' },
      { value: 'elevenlabs:ErXwobaYiN019PkySvjV', label: 'Antoni (Male)', description: 'Warm, conversational' },
      { value: 'elevenlabs:MF3mGyEYCl7XYWbV9V6O', label: 'Elli (Female)', description: 'Young, energetic' },
      { value: 'elevenlabs:TxGEqnHWrfWFTfGW9XjX', label: 'Josh (Male)', description: 'Deep, authoritative' },
      { value: 'elevenlabs:VR6AewLTigWG4xSOukaG', label: 'Arnold (Male)', description: 'Confident, strong' },
      { value: 'elevenlabs:AZnzlk1XvdvUeBnXmlld', label: 'Domi (Female)', description: 'Assertive, clear' },
    ],
  },
  {
    category: 'OpenAI',
    options: [
      { value: 'openai/tts-1', label: 'TTS-1', description: 'Standard quality' },
      { value: 'openai/tts-1-hd', label: 'TTS-1 HD', description: 'Higher quality' },
    ],
  },
];

// Flatten options for simple dropdowns
export const flattenOptions = (categories: ModelCategory[]): ModelOption[] => {
  return categories.flatMap((cat) => cat.options);
};

// Get flat arrays for backward compatibility
export const STT_OPTIONS_FLAT = flattenOptions(STT_OPTIONS);
export const LLM_OPTIONS_FLAT = flattenOptions(LLM_OPTIONS);
export const TTS_OPTIONS_FLAT = flattenOptions(TTS_OPTIONS);

// Default values
export const DEFAULT_STT = 'assemblyai/universal-streaming:en';
export const DEFAULT_LLM = 'openai/gpt-4o-mini';
export const DEFAULT_TTS = 'elevenlabs:pNInz6obpgDQGcFmaJgB';
export const DEFAULT_INSTRUCTIONS = `You are a helpful voice AI assistant for phone calls.
Be concise, friendly, and professional.
Keep responses brief since users are on the phone.`;

// Provider info for plugins page
export type ProviderInfo = {
  name: string;
  envKey: string;
  models: string[];
  description: string;
};

export const STT_PROVIDERS: ProviderInfo[] = [
  {
    name: 'AssemblyAI',
    envKey: 'ASSEMBLYAI_API_KEY',
    models: ['universal-streaming'],
    description: 'High accuracy speech recognition with real-time streaming',
  },
  {
    name: 'Deepgram',
    envKey: 'DEEPGRAM_API_KEY',
    models: ['nova-2', 'nova-3', 'enhanced', 'base'],
    description: 'Fast, accurate speech recognition with lowest latency',
  },
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    models: ['whisper-1'],
    description: 'Whisper model for high accuracy transcription',
  },
];

export const LLM_PROVIDERS: ProviderInfo[] = [
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    description: 'GPT models for conversational AI',
  },
];

export const TTS_PROVIDERS: ProviderInfo[] = [
  {
    name: 'ElevenLabs',
    envKey: 'ELEVEN_API_KEY',
    models: ['eleven_turbo_v2_5', 'eleven_multilingual_v2'],
    description: 'Natural-sounding voice synthesis with many voice options',
  },
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    models: ['tts-1', 'tts-1-hd'],
    description: 'Text-to-speech with multiple voice presets',
  },
];
