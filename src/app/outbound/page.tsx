'use client';

import { useCallback, useEffect, useState } from 'react';
import ActivityLog, { useActivityLog } from '@/components/ActivityLog';
import {
  STT_OPTIONS,
  LLM_OPTIONS,
  TTS_OPTIONS,
  DEFAULT_STT,
  DEFAULT_LLM,
  DEFAULT_TTS,
  DEFAULT_INSTRUCTIONS,
  type ModelCategory,
} from '@/lib/models';

type AgentConfig = {
  id: string;
  name: string;
  phone_number?: string;
  stt_model?: string;
  llm_model?: string;
  tts_voice?: string;
  instructions?: string;
};

type SipConfig = {
  phone_number: string;
  outbound_trunk?: string;
  inbound_trunk?: string;
};

type ConfigMode = 'saved' | 'custom';

function ModelSelector({
  label,
  value,
  onChange,
  categories,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  categories: ModelCategory[];
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {categories.map((cat) => (
          <optgroup key={cat.category} label={cat.category}>
            {cat.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export default function OutboundPage() {
  const [mode, setMode] = useState<ConfigMode>('custom');
  const [savedConfigs, setSavedConfigs] = useState<AgentConfig[]>([]);
  const [sipConfigs, setSipConfigs] = useState<SipConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // Phone numbers
  const [callerNumber, setCallerNumber] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');

  // Model config
  const [stt, setStt] = useState(DEFAULT_STT);
  const [llm, setLlm] = useState(DEFAULT_LLM);
  const [tts, setTts] = useState(DEFAULT_TTS);
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);

  // Call state
  const [loading, setLoading] = useState(false);
  const [callResult, setCallResult] = useState<{
    success: boolean;
    roomName?: string;
    message: string;
    value_sources?: Record<string, string>;
    defaults_used?: string[];
  } | null>(null);

  const { addEntry, updateEntry } = useActivityLog('outbound-activity', 20);

  // Fetch saved configs and SIP configs
  useEffect(() => {
    async function fetchConfigs() {
      try {
        const [agentRes, sipRes] = await Promise.all([
          fetch('/api/agent-configs'),
          fetch('/api/sip-configs'),
        ]);

        if (agentRes.ok) {
          const data = await agentRes.json();
          setSavedConfigs(data.items || data.configs || []);
        }

        if (sipRes.ok) {
          const data = await sipRes.json();
          const configs = data.items || data.configs || [];
          setSipConfigs(configs);
          // Set default caller number if available
          if (configs.length > 0) {
            setCallerNumber(configs[0].phone_number);
          }
        }
      } catch {
        // Ignore errors
      } finally {
        setLoadingConfigs(false);
      }
    }
    fetchConfigs();
  }, []);

  // Apply saved config when selected
  useEffect(() => {
    if (mode === 'saved' && selectedConfigId) {
      const config = savedConfigs.find((c) => c.id === selectedConfigId);
      if (config) {
        if (config.stt_model) setStt(config.stt_model);
        if (config.llm_model) setLlm(config.llm_model);
        if (config.tts_voice) setTts(config.tts_voice);
        if (config.instructions) setInstructions(config.instructions);
        if (config.phone_number) setCallerNumber(config.phone_number);
      }
    }
  }, [mode, selectedConfigId, savedConfigs]);

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 1) return `+${cleaned}`;
    if (cleaned.length <= 4) return `+${cleaned.slice(0, 1)} (${cleaned.slice(1)}`;
    if (cleaned.length <= 7)
      return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4)}`;
    return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
  };

  const getCleanPhoneNumber = (formatted: string) => {
    const digits = formatted.replace(/\D/g, '');
    return `+${digits}`;
  };

  const makeCall = useCallback(async () => {
    if (!callerNumber || !recipientNumber) return;

    setLoading(true);
    setCallResult(null);

    const entryId = addEntry({
      action: 'call_initiated',
      status: 'pending',
      details: `Calling ${recipientNumber} from ${callerNumber}`,
    });

    try {
      const cleanRecipient = getCleanPhoneNumber(recipientNumber);
      const cleanCaller = callerNumber.startsWith('+')
        ? callerNumber
        : getCleanPhoneNumber(callerNumber);

      const response = await fetch('/api/make-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanRecipient,
          callerNumber: cleanCaller,
          stt,
          llm,
          tts,
          agent_instructions: instructions,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCallResult({
          success: true,
          roomName: data.roomName,
          message: `Call initiated to ${cleanRecipient}`,
          value_sources: data.value_sources,
          defaults_used: data.defaults_used,
        });

        updateEntry(entryId, {
          status: 'success',
          details: `Call initiated to ${cleanRecipient}`,
          roomName: data.roomName,
          apiResponse: {
            roomName: data.roomName,
            value_sources: data.value_sources,
            defaults_used: data.defaults_used,
          },
        });
      } else {
        throw new Error(data.error || 'Failed to initiate call');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCallResult({
        success: false,
        message,
      });

      updateEntry(entryId, {
        status: 'error',
        details: message,
      });
    } finally {
      setLoading(false);
    }
  }, [
    callerNumber,
    recipientNumber,
    stt,
    llm,
    tts,
    instructions,
    addEntry,
    updateEntry,
  ]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && callerNumber && recipientNumber && !loading) {
      makeCall();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Outbound Calls</h1>
        <p className="text-sm text-slate-500 mt-1">
          Place outbound phone calls with the voice AI agent
        </p>
      </div>

      {/* Config Mode Toggle */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setMode('saved')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'saved'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Use Saved Config
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'custom'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Custom Config
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Phone Numbers */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Phone Numbers
            </h2>

            {/* Caller Number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                From (Caller ID)
              </label>
              {sipConfigs.length > 0 ? (
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                  value={callerNumber}
                  onChange={(e) => setCallerNumber(e.target.value)}
                >
                  <option value="">Select a number</option>
                  {sipConfigs.map((config) => (
                    <option key={config.phone_number} value={config.phone_number}>
                      {config.phone_number}
                      {config.outbound_trunk ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="tel"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={callerNumber}
                  onChange={(e) => setCallerNumber(e.target.value)}
                  placeholder="+1 (555) 555-5555"
                  disabled={loadingConfigs}
                />
              )}
              <p className="text-xs text-slate-500 mt-1">
                {sipConfigs.length > 0
                  ? 'Select from registered numbers'
                  : 'Enter caller ID in E.164 format'}
              </p>
            </div>

            {/* Recipient Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                To (Recipient)
              </label>
              <input
                type="tel"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={recipientNumber}
                onChange={(e) => setRecipientNumber(formatPhoneNumber(e.target.value))}
                onKeyPress={handleKeyPress}
                placeholder="+1 (555) 555-5555"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter the phone number to call
              </p>
            </div>
          </div>

          {/* Call Button */}
          <button
            onClick={makeCall}
            disabled={loading || !callerNumber || !recipientNumber}
            className="w-full px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Placing Call...
              </span>
            ) : (
              'Place Outbound Call'
            )}
          </button>

          {/* Call Result */}
          {callResult && (
            <div
              className={`rounded-lg p-4 ${
                callResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  callResult.success ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {callResult.success ? 'Call Initiated' : 'Call Failed'}
              </p>
              <p
                className={`text-sm mt-1 ${
                  callResult.success ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {callResult.message}
              </p>

              {callResult.roomName && (
                <p className="text-xs text-slate-600 mt-2">
                  Room: {callResult.roomName}
                </p>
              )}

              {/* Value Sources */}
              {callResult.value_sources && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    Configuration Sources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(callResult.value_sources).map(([key, source]) => (
                      <span
                        key={key}
                        className={`text-xs px-2 py-1 rounded ${
                          source === 'request'
                            ? 'bg-blue-100 text-blue-800'
                            : source === 'db_config'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {key}: {source}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Defaults Used */}
              {callResult.defaults_used && callResult.defaults_used.length > 0 && (
                <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  Defaults used: {callResult.defaults_used.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Config */}
        <div className="space-y-4">
          {/* Saved Config Selector */}
          {mode === 'saved' && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="block text-sm font-medium text-slate-700">
                Select Agent Configuration
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                  value={selectedConfigId}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  disabled={loadingConfigs}
                >
                  <option value="">
                    {loadingConfigs ? 'Loading...' : 'Select a config'}
                  </option>
                  {savedConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                      {config.phone_number && ` (${config.phone_number})`}
                    </option>
                  ))}
                </select>
              </label>
              {selectedConfigId && (
                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  <p>STT: {stt}</p>
                  <p>LLM: {llm}</p>
                  <p>TTS: {tts}</p>
                </div>
              )}
            </div>
          )}

          {/* Custom Config Form */}
          {mode === 'custom' && (
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Agent Configuration
              </h2>
              <div className="space-y-4">
                <ModelSelector
                  label="Speech-to-Text"
                  value={stt}
                  onChange={setStt}
                  categories={STT_OPTIONS}
                />
                <ModelSelector
                  label="Language Model"
                  value={llm}
                  onChange={setLlm}
                  categories={LLM_OPTIONS}
                />
                <ModelSelector
                  label="Text-to-Speech"
                  value={tts}
                  onChange={setTts}
                  categories={TTS_OPTIONS}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Agent Instructions
                    <textarea
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      rows={4}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Enter instructions for the AI agent..."
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Info Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-blue-500">Info</span>
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Outbound Call Flow
                </h3>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Call is placed via SIP trunk</li>
                  <li>Agent connects when call is answered</li>
                  <li>Monitor progress in Live Calls page</li>
                  <li>Check value_sources for config transparency</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ActivityLog storageKey="outbound-activity" maxEntries={20} />
    </div>
  );
}
