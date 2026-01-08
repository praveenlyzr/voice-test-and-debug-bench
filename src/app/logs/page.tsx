'use client';

import { useCallback, useEffect, useState } from 'react';

const services = ['livekit', 'agent', 'sip', 'redis', 'all'] as const;

export default function LogsPage() {
  const [service, setService] = useState<(typeof services)[number]>('livekit');
  const [tail, setTail] = useState(200);
  const [since, setSince] = useState('');
  const [logs, setLogs] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    setLogs('');
    try {
      const params = new URLSearchParams({ service, tail: String(tail) });
      if (since) params.set('since', since);
      const res = await fetch(`/api/local-logs?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || res.statusText);
      }
      setLogs(data.logs || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [service, tail, since]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Logs</h1>
        <p className="text-sm text-slate-600">Fetch docker-compose logs (dev/local).</p>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Service
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={service}
              onChange={(e) => setService(e.target.value as (typeof services)[number])}
            >
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tail
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={tail}
              onChange={(e) => setTail(parseInt(e.target.value, 10) || 200)}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Since (seconds)
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="0"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </label>
        </div>
        <button
          onClick={fetchLogs}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Refresh
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-slate-600">Loading…</p>}
      </div>

      <div className="rounded border border-slate-200 bg-slate-900 p-4 text-xs text-slate-100 whitespace-pre-wrap">
        {logs || 'No logs yet.'}
      </div>
    </div>
  );
}
