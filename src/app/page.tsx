'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import ActivityLog, { useActivityLog, type ActivityEntry } from '@/components/ActivityLog';

type DashboardStats = {
  activeRooms: number;
  totalParticipants: number;
  registeredNumbers: number;
  agentConfigs: number;
};

type QuickAction = {
  href: string;
  label: string;
  description: string;
  icon: string;
  color: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: '/web-session',
    label: 'Start Web Session',
    description: 'Test voice AI in browser',
    icon: '🎙️',
    color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
  },
  {
    href: '/outbound',
    label: 'Place Outbound Call',
    description: 'Call a phone number',
    icon: '📞',
    color: 'bg-green-50 hover:bg-green-100 border-green-200',
  },
  {
    href: '/live',
    label: 'View Live Calls',
    description: 'Monitor active rooms',
    icon: '📊',
    color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
  },
  {
    href: '/numbers',
    label: 'Manage Numbers',
    description: 'View registered numbers',
    icon: '📱',
    color: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeRooms: 0,
    totalParticipants: 0,
    registeredNumbers: 0,
    agentConfigs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { entries } = useActivityLog('dashboard-activity', 10);

  // Collect recent activity from all pages
  const [allActivity, setAllActivity] = useState<ActivityEntry[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const [roomsRes, sipRes, agentRes] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/sip-configs'),
        fetch('/api/agent-configs'),
      ]);

      const roomsData = roomsRes.ok ? await roomsRes.json() : { rooms: [] };
      const sipData = sipRes.ok ? await sipRes.json() : { configs: [] };
      const agentData = agentRes.ok ? await agentRes.json() : { configs: [] };

      const rooms = roomsData.rooms || [];
      const totalParticipants = rooms.reduce(
        (sum: number, room: { participants: unknown[] }) =>
          sum + (room.participants?.length || 0),
        0
      );

      setStats({
        activeRooms: rooms.length,
        totalParticipants,
        registeredNumbers: (sipData.configs || []).length,
        agentConfigs: (agentData.configs || []).length,
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Collect activity from different storage keys
  useEffect(() => {
    const collectActivity = () => {
      const storageKeys = [
        'dashboard-activity',
        'web-session-activity',
        'outbound-activity',
        'live-activity',
        'numbers-activity',
      ];

      const allEntries: ActivityEntry[] = [];
      for (const key of storageKeys) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored) as ActivityEntry[];
            allEntries.push(
              ...parsed.map((e) => ({
                ...e,
                timestamp: new Date(e.timestamp),
              }))
            );
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Sort by timestamp, most recent first, and take top 10
      allEntries.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      setAllActivity(allEntries.slice(0, 10));
    };

    collectActivity();
    const activityInterval = setInterval(collectActivity, 5000);
    return () => clearInterval(activityInterval);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchStats, 10000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, fetchStats]);

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusColor = () => {
    if (error) return 'bg-red-500';
    if (loading) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (loading) return 'Loading...';
    return 'Connected';
  };

  return (
    <div>
      {/* Header with Status */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            LiveKit Voice AI Test Bench Overview
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            <span className="text-sm text-slate-600">{getStatusText()}</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Auto-refresh (10s)
          </label>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link
          href="/live"
          className="bg-white rounded-lg border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Active Calls</p>
            <span className="text-lg">📞</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats.activeRooms}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.totalParticipants} participants
          </p>
        </Link>

        <Link
          href="/numbers"
          className="bg-white rounded-lg border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Registered Numbers</p>
            <span className="text-lg">📱</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats.registeredNumbers}
          </p>
          <p className="text-xs text-slate-400 mt-1">Phone numbers</p>
        </Link>

        <Link
          href="/configs"
          className="bg-white rounded-lg border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Agent Configs</p>
            <span className="text-lg">⚙️</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats.agentConfigs}
          </p>
          <p className="text-xs text-slate-400 mt-1">Saved configurations</p>
        </Link>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">System Status</p>
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
          </div>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {error ? 'Error' : 'Healthy'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Updated: {formatTime(lastUpdated)}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${action.color}`}
            >
              <span className="text-2xl">{action.icon}</span>
              <div>
                <p className="text-sm font-medium text-slate-900">{action.label}</p>
                <p className="text-xs text-slate-500">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          <p className="text-xs text-slate-500">Last 10 actions across all pages</p>
        </div>
        {allActivity.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No recent activity
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {allActivity.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      entry.status === 'success'
                        ? 'bg-green-500'
                        : entry.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                    }`}
                  ></span>
                  <div>
                    <p className="text-sm text-slate-800">
                      {entry.action.replace(/_/g, ' ')}
                    </p>
                    {entry.details && (
                      <p className="text-xs text-slate-500 truncate max-w-md">
                        {entry.details}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  {entry.timestamp.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ActivityLog storageKey="dashboard-activity" maxEntries={10} />
    </div>
  );
}
