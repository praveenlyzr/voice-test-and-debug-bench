'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import ActivityLog, { useActivityLog } from '@/components/ActivityLog';

type Track = {
  sid: string;
  type: number;
  name: string;
  muted: boolean;
  source: number;
};

type Participant = {
  identity: string;
  name: string;
  sid: string;
  state: number;
  joinedAt: number | null;
  tracks: Track[];
  metadata: Record<string, unknown> | null;
};

type Room = {
  name: string;
  sid: string;
  numParticipants: number;
  maxParticipants: number;
  creationTime: number | null;
  metadata: Record<string, unknown> | null;
  participants: Participant[];
};

const PARTICIPANT_STATE: Record<number, { label: string; style: string }> = {
  0: { label: 'Joining', style: 'bg-yellow-100 text-yellow-800' },
  1: { label: 'Joined', style: 'bg-green-100 text-green-800' },
  2: { label: 'Active', style: 'bg-blue-100 text-blue-800' },
  3: { label: 'Disconnected', style: 'bg-red-100 text-red-800' },
};

const TRACK_SOURCE: Record<number, string> = {
  0: 'Unknown',
  1: 'Camera',
  2: 'Microphone',
  3: 'Screen Share',
  4: 'Screen Share Audio',
};

const TRACK_TYPE: Record<number, string> = {
  0: 'Audio',
  1: 'Video',
  2: 'Data',
};

export default function LiveCallsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { entries, addEntry, updateEntry } = useActivityLog('live-activity', 20);

  const fetchRooms = useCallback(async (showActivity = false) => {
    if (showActivity) {
      setLoading(true);
    }

    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) {
        throw new Error(`Failed to fetch rooms: ${res.statusText}`);
      }
      const data = await res.json();
      setRooms(data.rooms || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRoom = useCallback(
    async (roomName: string) => {
      setDeleting(roomName);
      const entryId = addEntry({
        action: 'room_deleted',
        status: 'pending',
        details: `Ending call in room: ${roomName}`,
        roomName,
      });

      try {
        const res = await fetch(`/api/rooms?room=${encodeURIComponent(roomName)}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || res.statusText);
        }

        updateEntry(entryId, {
          status: 'success',
          details: `Room ${roomName} ended successfully`,
        });

        // Refresh room list
        await fetchRooms();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        updateEntry(entryId, {
          status: 'error',
          details: message,
        });
      } finally {
        setDeleting(null);
      }
    },
    [addEntry, updateEntry, fetchRooms]
  );

  useEffect(() => {
    fetchRooms(true);
  }, [fetchRooms]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchRooms(), 5000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, fetchRooms]);

  const toggleRoomExpand = (roomName: string) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomName)) {
        next.delete(roomName);
      } else {
        next.add(roomName);
      }
      return next;
    });
  };

  const formatDuration = (startTime: number | null) => {
    if (!startTime) return 'N/A';
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getParticipantState = (state: number) => {
    return PARTICIPANT_STATE[state] || { label: 'Unknown', style: 'bg-slate-100 text-slate-800' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Calls</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor active rooms and participants in real-time
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={() => fetchRooms(true)}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active Rooms</p>
          <p className="text-2xl font-bold text-slate-900">{rooms.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Participants</p>
          <p className="text-2xl font-bold text-slate-900">
            {rooms.reduce((sum, room) => sum + room.participants.length, 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active Tracks</p>
          <p className="text-2xl font-bold text-slate-900">
            {rooms.reduce(
              (sum, room) =>
                sum +
                room.participants.reduce((pSum, p) => pSum + p.tracks.length, 0),
              0
            )}
          </p>
        </div>
      </div>

      {loading && rooms.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-slate-500">No active calls</p>
          <p className="text-sm text-slate-400 mt-2">
            Rooms will appear here when calls are in progress
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rooms.map((room) => {
            const isExpanded = expandedRooms.has(room.name);
            const isDeleting = deleting === room.name;

            return (
              <div
                key={room.sid}
                className="bg-white rounded-lg border border-slate-200 overflow-hidden"
              >
                {/* Room Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleRoomExpand(room.name)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-full">
                      <span className="text-indigo-600 font-bold">
                        {room.participants.length}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-900">
                        {room.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Duration: {formatDuration(room.creationTime)} | Started:{' '}
                        {formatTime(room.creationTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRoom(room.name);
                      }}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isDeleting ? 'Ending...' : 'End Call'}
                    </button>
                    <span className="text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    {/* Room Metadata */}
                    {room.metadata && (
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">
                          Room Metadata
                        </h4>
                        <pre className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                          {JSON.stringify(room.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Participants */}
                    <div className="divide-y divide-slate-100">
                      {room.participants.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">
                          No participants in this room
                        </div>
                      ) : (
                        room.participants.map((participant) => {
                          const stateInfo = getParticipantState(participant.state);
                          return (
                            <div key={participant.sid} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-medium text-slate-600">
                                      {(participant.name || participant.identity)
                                        .charAt(0)
                                        .toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">
                                      {participant.name || participant.identity}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {participant.identity}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${stateInfo.style}`}
                                  >
                                    {stateInfo.label}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    Joined: {formatTime(participant.joinedAt)}
                                  </span>
                                </div>
                              </div>

                              {/* Tracks */}
                              {participant.tracks.length > 0 && (
                                <div className="ml-11 mt-2">
                                  <p className="text-xs font-medium text-slate-500 mb-1">
                                    Tracks ({participant.tracks.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {participant.tracks.map((track) => (
                                      <div
                                        key={track.sid}
                                        className={`px-2 py-1 rounded text-xs ${
                                          track.muted
                                            ? 'bg-slate-100 text-slate-500'
                                            : 'bg-green-100 text-green-800'
                                        }`}
                                      >
                                        {TRACK_SOURCE[track.source] || 'Unknown'} (
                                        {TRACK_TYPE[track.type] || 'Unknown'})
                                        {track.muted && ' - Muted'}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Participant Metadata */}
                              {participant.metadata && (
                                <div className="ml-11 mt-2">
                                  <p className="text-xs font-medium text-slate-500 mb-1">
                                    Metadata
                                  </p>
                                  <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(participant.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActivityLog storageKey="live-activity" maxEntries={20} />
    </div>
  );
}
