'use client';

import { useState } from 'react';

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_CONTROL_API_URL || '';

export default function InboundPage() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!apiBase || !phone) {
      setError('Set Control API URL and phone number.');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await fetch(
        `${apiBase.replace(/\/$/, '')}/configs/phone/${encodeURIComponent(phone)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || res.statusText);
      }
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Inbound</h1>
        <p className="text-sm text-slate-600">
          Inbound calls are routed by LiveKit SIP trunks. Use the phone number to find the config
          that will be applied by the agent.
        </p>
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
        <label className="block text-sm font-medium text-slate-700">
          Phone number (E.164)
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="+15551234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <button
          onClick={handleLookup}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Lookup config
        </button>
        {loading && <p className="text-sm text-slate-600">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
            {result}
          </pre>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Notes</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Multiple phone numbers can share the same SIP trunk.</li>
          <li>Per-number behavior is driven by the config fetched by phone number.</li>
          <li>Agent uses the inbound caller/dialed number to select the right config.</li>
        </ul>
      </div>
    </div>
  );
}
