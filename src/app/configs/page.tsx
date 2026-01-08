'use client';

import { useCallback, useEffect, useState } from 'react';

type Config = {
  _id?: string;
  name?: string;
  description?: string;
  agent_role?: string;
  agent_instructions?: string;
  agent_goal?: string;
  phone_number?: string;
  sip_config?: {
    region?: string;
    inbound_trunk?: string;
    outbound_trunk?: string;
  };
  voice_config?: {
    initiator?: string;
    message?: string;
    language?: string;
    tts_config?: Record<string, unknown>;
    stt_config?: Record<string, unknown>;
  };
};

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_CONTROL_API_URL || '';

export default function ConfigsPage() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneLookup, setPhoneLookup] = useState('');
  const [lookupResult, setLookupResult] = useState<Config | null>(null);

  const fetchConfigs = useCallback(async () => {
    if (!apiBase) {
      setError('Set Control API URL');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/configs`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || res.statusText);
      }
      setConfigs((data.items as Config[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (apiBase) fetchConfigs();
  }, [apiBase, fetchConfigs]);

  const saveConfig = async (cfg: Config) => {
    if (!apiBase) {
      setError('Set Control API URL');
      return;
    }
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || res.statusText);
      }
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLookup = async () => {
    if (!apiBase || !phoneLookup) {
      setError('Set Control API URL and phone number');
      return;
    }
    setError('');
    setLookupResult(null);
    try {
      const res = await fetch(
        `${apiBase.replace(/\/$/, '')}/configs/phone/${encodeURIComponent(phoneLookup)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || res.statusText);
      }
      setLookupResult(data as Config);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const addEmptyConfig = () => {
    setConfigs((prev) => [
      {
        _id: '',
        name: '',
        phone_number: '',
        sip_config: {
          region: 'us-east-1',
          inbound_trunk: '',
          outbound_trunk: '',
        },
        voice_config: {
          initiator: 'human',
          message: 'Hello, How are you doing today?',
          language: 'English',
          tts_config: {},
          stt_config: {},
        },
      },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configs</h1>
        <p className="text-sm text-slate-600">Manage agent configs via Control API.</p>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Control API URL
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="https://voice.preview.studio.lyzr.ai/api"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchConfigs}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
          >
            Refresh
          </button>
          <button
            onClick={addEmptyConfig}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add new config row
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-slate-600">Loading…</p>}
      </div>

      <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Lookup by phone</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="+15551234567"
            value={phoneLookup}
            onChange={(e) => setPhoneLookup(e.target.value)}
          />
          <button
            onClick={handleLookup}
            className="rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Lookup
          </button>
        </div>
        {lookupResult && (
          <div className="rounded border border-slate-100 bg-slate-50 p-3 text-xs font-mono text-slate-800">
            {JSON.stringify(lookupResult, null, 2)}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {configs.length === 0 && !loading && (
          <p className="text-sm text-slate-600">No configs loaded.</p>
        )}
        {configs.map((cfg, idx) => (
          <div key={idx} className="rounded border border-slate-200 bg-white p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="ID (_id)"
                value={cfg._id || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) => (i === idx ? { ...c, _id: e.target.value } : c))
                  )
                }
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Name"
                value={cfg.name || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c))
                  )
                }
              />
              <textarea
                className="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Description"
                rows={2}
                value={cfg.description || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) => (i === idx ? { ...c, description: e.target.value } : c))
                  )
                }
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Agent role"
                value={cfg.agent_role || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) => (i === idx ? { ...c, agent_role: e.target.value } : c))
                  )
                }
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Agent goal"
                value={cfg.agent_goal || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) => (i === idx ? { ...c, agent_goal: e.target.value } : c))
                  )
                }
              />
              <textarea
                className="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                placeholder="Agent instructions"
                rows={3}
                value={cfg.agent_instructions || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) =>
                      i === idx ? { ...c, agent_instructions: e.target.value } : c
                    )
                  )
                }
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Phone number (E.164)"
                value={cfg.phone_number || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) => (i === idx ? { ...c, phone_number: e.target.value } : c))
                  )
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="SIP region"
                value={cfg.sip_config?.region || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) =>
                      i === idx
                        ? {
                            ...c,
                            sip_config: { ...(c.sip_config || {}), region: e.target.value },
                          }
                        : c
                    )
                  )
                }
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Inbound trunk (ID)"
                value={cfg.sip_config?.inbound_trunk || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) =>
                      i === idx
                        ? {
                            ...c,
                            sip_config: { ...(c.sip_config || {}), inbound_trunk: e.target.value },
                          }
                        : c
                    )
                  )
                }
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Outbound trunk (ID)"
                value={cfg.sip_config?.outbound_trunk || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) =>
                      i === idx
                        ? {
                            ...c,
                            sip_config: { ...(c.sip_config || {}), outbound_trunk: e.target.value },
                          }
                        : c
                    )
                  )
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Voice initiator"
                value={cfg.voice_config?.initiator || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) =>
                      i === idx
                        ? {
                            ...c,
                            voice_config: { ...(c.voice_config || {}), initiator: e.target.value },
                          }
                        : c
                    )
                  )
                }
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Voice message"
                value={cfg.voice_config?.message || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) =>
                      i === idx
                        ? { ...c, voice_config: { ...(c.voice_config || {}), message: e.target.value } }
                        : c
                    )
                  )
                }
              />
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Voice language"
                value={cfg.voice_config?.language || ''}
                onChange={(e) =>
                  setConfigs((prev) =>
                    prev.map((c, i) =>
                      i === idx
                        ? {
                            ...c,
                            voice_config: { ...(c.voice_config || {}), language: e.target.value },
                          }
                        : c
                    )
                  )
                }
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => saveConfig(configs[idx])}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
