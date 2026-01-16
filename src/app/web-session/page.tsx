'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
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

export default function WebSessionPage() {
  const [mode, setMode] = useState<ConfigMode>('custom');
  const [savedConfigs, setSavedConfigs] = useState<AgentConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  const [stt, setStt] = useState(DEFAULT_STT);
  const [llm, setLlm] = useState(DEFAULT_LLM);
  const [tts, setTts] = useState(DEFAULT_TTS);
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);

  const [status, setStatus] = useState('');
  const [connected, setConnected] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    token: string;
    roomName: string;
    livekitUrl: string;
    metadata?: unknown;
    value_sources?: Record<string, string>;
    defaults_used?: string[];
  } | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { addEntry, updateEntry } = useActivityLog('web-session-activity', 20);

  // Fetch saved configs
  useEffect(() => {
    async function fetchConfigs() {
      try {
        const res = await fetch('/api/agent-configs');
        if (res.ok) {
          const data = await res.json();
          setSavedConfigs(data.configs || []);
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
      }
    }
  }, [mode, selectedConfigId, savedConfigs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const joinRoom = useCallback(
    async (info: { token: string; livekitUrl: string }) => {
      try {
        setStatus('Connecting to room...');
        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          setStatus('Disconnected');
          setConnected(false);
        });

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === 'audio' && audioRef.current) {
            track.attach(audioRef.current);
          }
        });

        await room.connect(info.livekitUrl, info.token, {
          autoSubscribe: true,
        });

        setStatus('Connected');
        setConnected(true);
      } catch (err) {
        setStatus(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
        roomRef.current?.disconnect();
        roomRef.current = null;
        setConnected(false);
      }
    },
    []
  );

  const handleCreate = useCallback(async () => {
    setStatus('Requesting session...');
    const entryId = addEntry({
      action: 'session_started',
      status: 'pending',
      details: 'Starting web session...',
    });

    try {
      const res = await fetch('/api/start-web-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stt,
          llm,
          tts,
          agent_instructions: instructions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to start web session');
      }

      const info = {
        token: data.token as string,
        roomName: data.roomName as string,
        livekitUrl: data.livekitUrl as string,
        metadata: data.metadata,
        value_sources: data.value_sources,
        defaults_used: data.defaults_used,
      };

      setTokenInfo(info);
      setStatus(`Session ready in room ${info.roomName}`);

      updateEntry(entryId, {
        status: 'success',
        details: `Session created: ${info.roomName}`,
        roomName: info.roomName,
        apiResponse: {
          value_sources: info.value_sources,
          defaults_used: info.defaults_used,
        },
      });

      await joinRoom(info);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${message}`);
      setTokenInfo(null);
      updateEntry(entryId, {
        status: 'error',
        details: message,
      });
    }
  }, [instructions, joinRoom, llm, stt, tts, addEntry, updateEntry]);

  const handleDisconnect = useCallback(() => {
    const roomName = tokenInfo?.roomName;
    roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus('Disconnected');
    setConnected(false);

    addEntry({
      action: 'session_ended',
      status: 'success',
      details: 'Session disconnected',
      roomName,
    });
  }, [tokenInfo, addEntry]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Web Session</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create a browser voice session and interact with the AI agent
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
            <div className="mt-3 text-xs text-slate-500">
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
          <div className="grid gap-4 sm:grid-cols-3">
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
          </div>
          <div className="mt-4">
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
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCreate}
          disabled={connected || (mode === 'saved' && !selectedConfigId)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Create & Join Session
        </button>
        <button
          onClick={handleDisconnect}
          disabled={!connected}
          className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Status Panel */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connected
                  ? 'bg-green-500'
                  : status.startsWith('Error')
                  ? 'bg-red-500'
                  : 'bg-slate-400'
              }`}
            ></span>
            <span className="text-sm font-medium text-slate-700">
              {status || 'Idle'}
            </span>
          </div>
          {tokenInfo?.roomName && (
            <span className="text-xs text-slate-500">
              Room: {tokenInfo.roomName}
            </span>
          )}
        </div>

        <div className="p-4">
          {/* Audio Element */}
          <audio ref={audioRef} autoPlay className="w-full mb-4" controls />

          {/* Session Details */}
          {tokenInfo && (
            <div className="space-y-3">
              <div className="text-xs font-mono bg-slate-50 p-3 rounded border border-slate-200">
                <p className="text-slate-600">
                  <span className="text-slate-500">URL:</span> {tokenInfo.livekitUrl}
                </p>
                <p className="text-slate-600 truncate">
                  <span className="text-slate-500">Token:</span>{' '}
                  {tokenInfo.token.substring(0, 50)}...
                </p>
              </div>

              {/* Value Sources */}
              {tokenInfo.value_sources && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">
                    Configuration Sources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tokenInfo.value_sources).map(([key, source]) => (
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
              {tokenInfo.defaults_used && tokenInfo.defaults_used.length > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  Defaults used: {tokenInfo.defaults_used.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ActivityLog storageKey="web-session-activity" maxEntries={20} />
    </div>
  );
}
