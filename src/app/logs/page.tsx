'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const services = ['livekit', 'agent', 'sip', 'redis', 'caddy', 'all'] as const;
type LogSource = 'local' | 'cloudwatch';

export default function LogsPage() {
  const [source, setSource] = useState<LogSource>('cloudwatch');
  const [service, setService] = useState<(typeof services)[number]>('livekit');
  const [tail, setTail] = useState(200);
  const [since, setSince] = useState('');
  const [filter, setFilter] = useState('');
  const [logs, setLogs] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // CloudWatch settings
  const [cwRegion, setCwRegion] = useState('us-east-1');
  const [cwLogGroup, setCwLogGroup] = useState('/livekit/voice');
  const [cwStreamPrefix, setCwStreamPrefix] = useState('livekit');
  const [cwToken, setCwToken] = useState('');

  // Debug info
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('logs-settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.source) setSource(parsed.source);
        if (parsed.cwRegion) setCwRegion(parsed.cwRegion);
        if (parsed.cwLogGroup) setCwLogGroup(parsed.cwLogGroup);
        if (parsed.cwStreamPrefix) setCwStreamPrefix(parsed.cwStreamPrefix);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'logs-settings',
        JSON.stringify({ source, cwRegion, cwLogGroup, cwStreamPrefix })
      );
    } catch {
      // Ignore
    }
  }, [source, cwRegion, cwLogGroup, cwStreamPrefix]);

  const fetchDebugInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/debug');
      if (res.ok) {
        const data = await res.json();
        setDebugInfo(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchDebugInfo();
  }, [fetchDebugInfo]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let endpoint: string;
      const params = new URLSearchParams({
        service,
        tail: String(tail),
      });

      if (since) params.set('since', since);

      if (source === 'cloudwatch') {
        endpoint = '/api/cloudwatch-logs';
        if (cwRegion) params.set('region', cwRegion);
        if (cwLogGroup) params.set('logGroup', cwLogGroup);
        if (cwStreamPrefix) params.set('streamPrefix', cwStreamPrefix);
        if (filter) params.set('filter', filter);
      } else {
        endpoint = '/api/local-logs';
      }

      const headers: HeadersInit = {};
      if (source === 'cloudwatch' && cwToken) {
        headers.Authorization = `Bearer ${cwToken}`;
      }

      const res = await fetch(`${endpoint}?${params.toString()}`, { headers });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || res.statusText);
      }

      setLogs(data.logs || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLogs('');
    } finally {
      setLoading(false);
    }
  }, [source, service, tail, since, filter, cwRegion, cwLogGroup, cwStreamPrefix, cwToken]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    if (!logs || !filter || source === 'cloudwatch') return logs;
    // Client-side filter for local logs
    const lowerFilter = filter.toLowerCase();
    return logs
      .split('\n')
      .filter((line) => line.toLowerCase().includes(lowerFilter))
      .join('\n');
  }, [logs, filter, source]);

  const clearLogs = () => {
    setSince(String(Math.floor(Date.now() / 1000)));
    setLogs('');
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            View application logs from CloudWatch or local Docker
          </p>
        </div>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
        </button>
      </div>

      {/* Debug Info Panel */}
      {showDebug && debugInfo && (
        <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Environment Debug Info
          </h3>
          <pre className="text-xs text-slate-600 overflow-x-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      {/* Source Toggle */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setSource('cloudwatch')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            source === 'cloudwatch'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          CloudWatch
        </button>
        <button
          onClick={() => setSource('local')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            source === 'local'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Local Docker
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        {/* CloudWatch Settings */}
        {source === 'cloudwatch' && (
          <div className="grid gap-3 sm:grid-cols-4 pb-4 border-b border-slate-200">
            <label className="text-sm font-medium text-slate-700">
              Region
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={cwRegion}
                onChange={(e) => setCwRegion(e.target.value)}
                placeholder="us-east-1"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Log Group
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={cwLogGroup}
                onChange={(e) => setCwLogGroup(e.target.value)}
                placeholder="/livekit/voice"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Stream Prefix
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={cwStreamPrefix}
                onChange={(e) => setCwStreamPrefix(e.target.value)}
                placeholder="livekit"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Token (optional)
              <input
                type="password"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={cwToken}
                onChange={(e) => setCwToken(e.target.value)}
                placeholder="Bearer token"
              />
            </label>
          </div>
        )}

        {/* Common Controls */}
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Service
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
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
            Tail (lines)
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={tail}
              onChange={(e) => setTail(parseInt(e.target.value, 10) || 200)}
              min={1}
              max={500}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Filter
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="e.g. error, SIP"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Since (epoch seconds)
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              placeholder="optional"
            />
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Fetching...' : 'Fetch Logs'}
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
          >
            Clear & Set Since
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300"
            />
            Auto-refresh (3s)
          </label>
          {since && (
            <span className="text-xs text-slate-500">
              Since: {new Date(parseInt(since, 10) * 1000).toLocaleTimeString()}
              <button
                onClick={() => setSince('')}
                className="ml-2 text-indigo-600 hover:underline"
              >
                Clear
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800 font-medium">Error</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          {source === 'cloudwatch' && (
            <p className="text-xs text-red-600 mt-2">
              Check that ENABLE_CLOUDWATCH_LOGS=true and CloudWatch credentials are configured.
              Click &quot;Show Debug Info&quot; above to see env var status.
            </p>
          )}
          {source === 'local' && (
            <p className="text-xs text-red-600 mt-2">
              Local logs only work in development with Docker. Try CloudWatch for production.
            </p>
          )}
        </div>
      )}

      {/* Logs Display */}
      <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {source === 'cloudwatch' ? 'CloudWatch Logs' : 'Docker Logs'} - {service}
          </span>
          <span className="text-xs text-slate-500">
            {filteredLogs ? filteredLogs.split('\n').length : 0} lines
          </span>
        </div>
        <pre className="p-4 text-xs text-slate-100 whitespace-pre-wrap max-h-[600px] overflow-auto font-mono">
          {filteredLogs || (loading ? 'Loading...' : 'No logs yet. Click "Fetch Logs" to start.')}
        </pre>
      </div>
    </div>
  );
}
