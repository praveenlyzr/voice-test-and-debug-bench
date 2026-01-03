'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

// Available options (require provider API keys in agent env)
const STT_OPTIONS = [
  { value: 'assemblyai/universal-streaming:en', label: 'AssemblyAI (Recommended)' },
  { value: 'deepgram/nova-2:en', label: 'Deepgram Nova 2' },
];

const LLM_OPTIONS = [
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'openai/gpt-4.1', label: 'GPT-4.1' },
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'openai/gpt-5', label: 'GPT-5' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano' },
  { value: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'google/gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  { value: 'baseten/qwen3-235b-a22b-instruct', label: 'Qwen3 235B A22B Instruct' },
  { value: 'baseten/kimi-k2-instruct', label: 'Kimi K2 Instruct' },
  { value: 'baseten/deepseek-v3', label: 'DeepSeek V3' },
  { value: 'baseten/deepseek-v3.2', label: 'DeepSeek V3.2' },
];

const TTS_OPTIONS = [
  { value: 'elevenlabs:pNInz6obpgDQGcFmaJgB', label: 'ElevenLabs - Adam' },
  { value: 'elevenlabs:21m00Tcm4TlvDq8ikWAM', label: 'ElevenLabs - Rachel' },
];

const DEFAULT_INSTRUCTIONS = `You are a helpful voice AI assistant for phone calls.
Be concise, friendly, and professional.
Keep responses brief since users are on the phone.`;
const DEFAULTS_STORAGE_KEY = 'livekit-outbound-defaults';

export default function CallTrigger() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState('');

  // Configuration state (outbound defaults)
  const [stt, setStt] = useState(STT_OPTIONS[0].value);
  const [llm, setLlm] = useState(LLM_OPTIONS[0].value);
  const [tts, setTts] = useState(TTS_OPTIONS[0].value);
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [webStatus, setWebStatus] = useState('');
  const [webRoomName, setWebRoomName] = useState('');
  const [webConnecting, setWebConnecting] = useState(false);
  const [webConnected, setWebConnected] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enableLocalLogs =
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGS === 'true';
  const enableCloudwatchLogs =
    process.env.NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS === 'true';
  const logsEnabled = enableLocalLogs || enableCloudwatchLogs;
  const [logService, setLogService] = useState('livekit');
  const [logTail, setLogTail] = useState(200);
  const [logText, setLogText] = useState('');
  const [logError, setLogError] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [logAutoRefresh, setLogAutoRefresh] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [logMatchCase, setLogMatchCase] = useState(false);
  const [logSince, setLogSince] = useState<number | null>(null);
  const [logSource, setLogSource] = useState(
    enableCloudwatchLogs ? 'cloudwatch' : 'local',
  );
  const [logAuthToken, setLogAuthToken] = useState('');

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEFAULTS_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as {
        stt?: string;
        llm?: string;
        tts?: string;
        instructions?: string;
      };
      if (stored.stt) setStt(stored.stt);
      if (stored.llm) setLlm(stored.llm);
      if (stored.tts) setTts(stored.tts);
      if (stored.instructions) setInstructions(stored.instructions);
    } catch {
      localStorage.removeItem(DEFAULTS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload = {
      stt,
      llm,
      tts,
      instructions,
    };
    try {
      localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures (private mode, quota, etc).
    }
  }, [stt, llm, tts, instructions]);

  useEffect(() => {
    if (logSource === 'local' && !enableLocalLogs && enableCloudwatchLogs) {
      setLogSource('cloudwatch');
    }
    if (logSource === 'cloudwatch' && !enableCloudwatchLogs && enableLocalLogs) {
      setLogSource('local');
    }
  }, [logSource, enableLocalLogs, enableCloudwatchLogs]);

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 1) return `+${cleaned}`;
    if (cleaned.length <= 4) return `+${cleaned.slice(0, 1)} (${cleaned.slice(1)}`;
    if (cleaned.length <= 7) return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4)}`;
    return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
  };

  const getCleanPhoneNumber = (formatted: string) => {
    const digits = formatted.replace(/\D/g, '');
    return `+${digits}`;
  };

  const makeCall = async () => {
    if (!phoneNumber) return;

    setLoading(true);
    setStatus('Initiating call...');
    setRoomName('');

    try {
      const cleanNumber = getCleanPhoneNumber(phoneNumber);

      const response = await fetch('/api/make-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanNumber,
          stt,
          llm,
          tts,
          agent_instructions: instructions,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`✓ Call initiated to ${cleanNumber}`);
        setRoomName(data.roomName);
      } else {
        setStatus(`✗ Error: ${data.error}`);
      }
    } catch (error) {
      setStatus(`✗ Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && phoneNumber && !loading) {
      makeCall();
    }
  };

  const startWebSession = async () => {
    if (webConnected || webConnecting) return;
    setWebConnecting(true);
    setWebStatus('Starting web session...');
    setWebRoomName('');

    try {
      const response = await fetch('/api/start-web-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stt,
          llm,
          tts,
          agent_instructions: instructions,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setWebStatus(`✗ Error: ${data.error || 'Failed to start web session'}`);
        return;
      }

      const livekitUrl =
        data.livekitUrl ||
        process.env.NEXT_PUBLIC_LIVEKIT_URL ||
        'ws://localhost:7880';

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio && audioRef.current) {
            track.attach(audioRef.current);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach();
          }
        })
        .on(RoomEvent.Disconnected, () => {
          setWebConnected(false);
          setWebStatus('Disconnected');
        });

      await room.connect(livekitUrl, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setWebConnected(true);
      setWebRoomName(data.roomName || '');
      setWebStatus('✓ Connected. Speak and the agent should answer.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWebStatus(`✗ Error: ${message}`);
      roomRef.current?.disconnect();
      roomRef.current = null;
    } finally {
      setWebConnecting(false);
    }
  };

  const stopWebSession = () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setWebConnected(false);
    setWebStatus('Disconnected');
  };

  const resetDefaults = () => {
    setStt(STT_OPTIONS[0].value);
    setLlm(LLM_OPTIONS[0].value);
    setTts(TTS_OPTIONS[0].value);
    setInstructions(DEFAULT_INSTRUCTIONS);
    localStorage.removeItem(DEFAULTS_STORAGE_KEY);
  };

  const fetchLogs = useCallback(async () => {
    if (!logsEnabled) return;
    setLogLoading(true);
    setLogError('');
    try {
      const params = new URLSearchParams({
        service: logService,
        tail: String(logTail),
      });
      if (logSince) {
        params.set('since', String(logSince));
      }
      if (logSource === 'cloudwatch' && logFilter.trim()) {
        params.set('filter', logFilter.trim());
      }
      const endpoint =
        logSource === 'cloudwatch' ? '/api/cloudwatch-logs' : '/api/local-logs';
      const headers: HeadersInit = {};
      if (logSource === 'cloudwatch' && logAuthToken.trim()) {
        headers.Authorization = `Bearer ${logAuthToken.trim()}`;
      }
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        headers,
      });
      const data = await response.json();
      if (!response.ok) {
        setLogError(data.error || 'Failed to fetch logs');
        return;
      }
      setLogText(data.logs || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLogError(message);
    } finally {
      setLogLoading(false);
    }
  }, [
    logsEnabled,
    logSource,
    logService,
    logTail,
    logSince,
    logFilter,
    logAuthToken,
  ]);

  useEffect(() => {
    if (!logsEnabled || !logAutoRefresh) return;
    fetchLogs();
    const id = setInterval(fetchLogs, 2000);
    return () => clearInterval(id);
  }, [logsEnabled, logAutoRefresh, fetchLogs]);

  const clearLogs = () => {
    setLogSince(Math.floor(Date.now() / 1000));
    setLogText('');
    setLogError('');
  };

  const resetLogSince = () => {
    setLogSince(null);
  };

  const logSinceLabel = logSince
    ? new Date(logSince * 1000).toLocaleTimeString()
    : '';

  const filteredLogs = useMemo(() => {
    if (!logText) {
      return { text: '', total: 0, shown: 0 };
    }

    const rawFilter = logFilter.trim();
    const normalizedFilter = logMatchCase
      ? rawFilter
      : rawFilter.toLowerCase();
    const lines = logText.split('\n');

    const matchesLevel = (line: string) => {
      if (logLevel === 'all') return true;
      const normalized = logMatchCase ? line : line.toLowerCase();
      if (logLevel === 'warn') {
        return normalized.includes('warn');
      }
      return normalized.includes(logLevel);
    };

    const matchesFilter = (line: string) => {
      if (!normalizedFilter) return true;
      const haystack = logMatchCase ? line : line.toLowerCase();
      return haystack.includes(normalizedFilter);
    };

    const filteredLines = lines.filter(
      (line) => matchesLevel(line) && matchesFilter(line),
    );

    return {
      text: filteredLines.join('\n'),
      total: lines.length,
      shown: filteredLines.length,
    };
  }, [logText, logFilter, logLevel, logMatchCase]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            LiveKit Call Trigger
          </h1>
          <p className="text-gray-600 text-sm">
            Configure outbound defaults and make SIP calls
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {/* Phone Number Input */}
            <div className="mb-4">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+1 (555) 555-5555"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-lg"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Format: +1 (XXX) XXX-XXXX
              </p>
            </div>

            {/* Make Call Button */}
            <button
              onClick={makeCall}
              disabled={loading || !phoneNumber}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed
                       transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Calling...
                </span>
              ) : (
                '📞 Make Call'
              )}
            </button>

            {/* Status Display */}
            {status && (
              <div className={`mt-6 p-4 rounded-lg ${
                status.startsWith('✓')
                  ? 'bg-green-50 border border-green-200'
                  : status.startsWith('✗')
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                <p className={`text-sm font-medium ${
                  status.startsWith('✓')
                    ? 'text-green-800'
                    : status.startsWith('✗')
                    ? 'text-red-800'
                    : 'text-blue-800'
                }`}>
                  {status}
                </p>
                {roomName && (
                  <p className="text-xs text-gray-600 mt-1">
                    Room: {roomName}
                  </p>
                )}
                {status.startsWith('✓') && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600 font-medium">Outbound defaults:</p>
                    <p className="text-xs text-gray-500">STT: {STT_OPTIONS.find(o => o.value === stt)?.label}</p>
                    <p className="text-xs text-gray-500">LLM: {LLM_OPTIONS.find(o => o.value === llm)?.label}</p>
                    <p className="text-xs text-gray-500">TTS: {TTS_OPTIONS.find(o => o.value === tts)?.label}</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">
                Browser Test (no phone)
              </h2>
              <p className="text-xs text-slate-600 mb-4">
                Join a WebRTC room and talk to the agent with your microphone. Uses the
                outbound defaults from the right column.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={startWebSession}
                  disabled={webConnecting || webConnected}
                  className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium
                           hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {webConnecting ? 'Connecting...' : 'Start Web Session'}
                </button>
                <button
                  onClick={stopWebSession}
                  disabled={!webConnected}
                  className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium
                           hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  End Session
                </button>
              </div>
              {webStatus && (
                <p className="mt-3 text-xs text-slate-700">{webStatus}</p>
              )}
              {webRoomName && (
                <p className="mt-1 text-xs text-slate-500">Room: {webRoomName}</p>
              )}
              <audio ref={audioRef} autoPlay />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Outbound Defaults
                </h2>
                <p className="text-xs text-gray-500">
                  Saved in this browser. Used for SIP outbound and browser tests.
                </p>
              </div>
              <button
                onClick={resetDefaults}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                Reset
              </button>
            </div>

            {/* STT Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speech-to-Text (STT)
              </label>
              <select
                value={stt}
                onChange={(e) => setStt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                {STT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* LLM Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language Model (LLM)
              </label>
              <select
                value={llm}
                onChange={(e) => setLlm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                {LLM_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* TTS Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text-to-Speech (TTS) Voice
              </label>
              <select
                value={tts}
                onChange={(e) => setTts(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                {TTS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Agent Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="Enter instructions for how the agent should behave..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Customize how your agent responds and behaves during calls
              </p>
            </div>
          </div>
        </div>

        {logsEnabled && (
          <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Logs (debug)
            </h2>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {enableLocalLogs && enableCloudwatchLogs && (
                <>
                  <label className="text-xs text-gray-600">Source</label>
                  <select
                    value={logSource}
                    onChange={(e) => setLogSource(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                  >
                    <option value="cloudwatch">cloudwatch</option>
                    <option value="local">local</option>
                  </select>
                </>
              )}
              {logSource === 'cloudwatch' && (
                <>
                  <label className="text-xs text-gray-600">Token</label>
                  <input
                    type="password"
                    value={logAuthToken}
                    onChange={(e) => setLogAuthToken(e.target.value)}
                    placeholder="Bearer token (optional)"
                    className="px-2 py-1 border border-gray-300 rounded-md text-xs min-w-[160px]"
                  />
                </>
              )}
              <label className="text-xs text-gray-600">Service</label>
              <select
                value={logService}
                onChange={(e) => setLogService(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-md text-xs"
              >
                <option value="livekit">livekit</option>
                <option value="agent">agent</option>
                <option value="sip">sip</option>
                <option value="redis">redis</option>
                {logSource === 'cloudwatch' && (
                  <option value="caddy">caddy</option>
                )}
                <option value="all">all</option>
              </select>
              <label className="text-xs text-gray-600">Tail</label>
              <input
                type="number"
                min={1}
                max={500}
                value={logTail}
                onChange={(e) => setLogTail(Number(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-300 rounded-md text-xs"
              />
              <button
                onClick={fetchLogs}
                disabled={logLoading}
                className="px-3 py-1 text-xs rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {logLoading ? 'Loading...' : 'Fetch'}
              </button>
              <button
                onClick={clearLogs}
                className="px-3 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Clear logs
              </button>
              <label className="text-xs text-gray-600">Filter</label>
              <input
                type="text"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                placeholder="e.g. error, SIP, trunk"
                className="px-2 py-1 border border-gray-300 rounded-md text-xs min-w-[160px]"
              />
              <label className="text-xs text-gray-600">Level</label>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-md text-xs"
              >
                <option value="all">all</option>
                <option value="error">error</option>
                <option value="warn">warn</option>
                <option value="info">info</option>
                <option value="debug">debug</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={logAutoRefresh}
                  onChange={(e) => setLogAutoRefresh(e.target.checked)}
                />
                Auto refresh
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={logMatchCase}
                  onChange={(e) => setLogMatchCase(e.target.checked)}
                />
                Match case
              </label>
              {(logFilter || logLevel !== 'all' || logMatchCase) && (
                <button
                  onClick={() => {
                    setLogFilter('');
                    setLogLevel('all');
                    setLogMatchCase(false);
                  }}
                  className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Clear filter
                </button>
              )}
            </div>
            {logError && (
              <p className="text-xs text-red-600 mb-2">✗ {logError}</p>
            )}
            {logSince ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                <span>Showing logs since {logSinceLabel}</span>
                <button
                  onClick={resetLogSince}
                  className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Show all
                </button>
              </div>
            ) : null}
            {!!logText && (
              <p className="text-xs text-gray-500 mb-2">
                Showing {filteredLogs.shown} of {filteredLogs.total} lines
              </p>
            )}
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 max-h-64 overflow-auto whitespace-pre-wrap">
              {filteredLogs.text ||
                (logText ? 'No logs match the current filter.' : 'No logs yet.')}
            </pre>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Outbound defaults are stored only in this browser.
          </p>
        </div>
      </div>
    </div>
  );
}
