'use client';

import { useCallback, useEffect, useState } from 'react';

export type ActivityEntry = {
  id: string;
  timestamp: Date;
  action: string;
  status: 'success' | 'error' | 'pending';
  details?: string;
  roomName?: string;
  apiResponse?: Record<string, unknown>;
};

type ActivityLogProps = {
  storageKey: string;
  maxEntries?: number;
};

const ACTION_ICONS: Record<string, string> = {
  call_initiated: '📞',
  call_ended: '📴',
  session_started: '🎙️',
  session_ended: '🔇',
  config_loaded: '📋',
  config_saved: '💾',
  room_deleted: '🗑️',
  sync_complete: '🔄',
  error: '❌',
  default: '📌',
};

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

export function useActivityLog(storageKey: string, maxEntries = 20) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ActivityEntry[];
        setEntries(
          parsed.map((e) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          }))
        );
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // Ignore storage errors
    }
  }, [entries, storageKey]);

  const addEntry = useCallback(
    (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
      const newEntry: ActivityEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date(),
      };
      setEntries((prev) => [newEntry, ...prev].slice(0, maxEntries));
      return newEntry.id;
    },
    [maxEntries]
  );

  const updateEntry = useCallback(
    (id: string, updates: Partial<Omit<ActivityEntry, 'id' | 'timestamp'>>) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      );
    },
    []
  );

  const clearEntries = useCallback(() => {
    setEntries([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { entries, addEntry, updateEntry, clearEntries };
}

export default function ActivityLog({
  storageKey,
  maxEntries = 20,
}: ActivityLogProps) {
  const { entries, clearEntries } = useActivityLog(storageKey, maxEntries);
  const [expanded, setExpanded] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set()
  );

  const toggleEntryExpand = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getIcon = (action: string) => {
    return ACTION_ICONS[action] || ACTION_ICONS.default;
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border border-slate-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            Activity Log
          </span>
          <span className="text-xs text-slate-500">({entries.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearEntries();
            }}
            className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
          >
            Clear
          </button>
          <span className="text-slate-400">{expanded ? '▼' : '▶'}</span>
        </div>
      </button>

      {expanded && (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
          {entries.map((entry) => (
            <div key={entry.id} className="px-4 py-2 hover:bg-slate-50">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => toggleEntryExpand(entry.id)}
              >
                <span className="text-base">{getIcon(entry.action)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[entry.status]}`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  {entry.roomName && (
                    <span className="text-xs text-slate-500">
                      Room: {entry.roomName}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="text-slate-400 text-xs">
                  {expandedEntries.has(entry.id) ? '▼' : '▶'}
                </span>
              </div>

              {expandedEntries.has(entry.id) && (
                <div className="mt-2 ml-8 text-xs">
                  {entry.details && (
                    <p className="text-slate-600 mb-2">{entry.details}</p>
                  )}
                  {entry.apiResponse && (
                    <pre className="bg-slate-100 p-2 rounded text-slate-700 overflow-x-auto">
                      {JSON.stringify(entry.apiResponse, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
