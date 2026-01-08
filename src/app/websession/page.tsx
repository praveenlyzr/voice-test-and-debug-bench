'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';

const DEFAULT_INSTRUCTIONS = `You are a helpful voice AI assistant for phone calls.
Be concise, friendly, and professional.
Keep responses brief since users are on the phone.`;

export default function WebSessionPage() {
  const [stt, setStt] = useState('assemblyai/universal-streaming:en');
  const [llm, setLlm] = useState('openai/gpt-4.1-mini');
  const [tts, setTts] = useState('elevenlabs:pNInz6obpgDQGcFmaJgB');
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [status, setStatus] = useState('');
  const [tokenInfo, setTokenInfo] = useState<{
    token: string;
    roomName: string;
    livekitUrl: string;
    metadata?: unknown;
  } | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const joinRoom = useCallback(
    async (info: { token: string; livekitUrl: string }) => {
      try {
        setStatus('Connecting…');
        const room = new Room();
        roomRef.current = room;
        room.on(RoomEvent.Disconnected, () => setStatus('Disconnected'));
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === 'audio' && audioRef.current) {
            track.attach(audioRef.current);
          }
        });
        await room.connect(info.livekitUrl, info.token, {
          autoSubscribe: true,
        });
        setStatus('Connected');
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
        roomRef.current?.disconnect();
        roomRef.current = null;
      }
    },
    []
  );

  const handleCreate = useCallback(async () => {
    setStatus('Requesting session…');
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
      };
      setTokenInfo(info);
      setStatus(`Session ready in room ${info.roomName}`);
      await joinRoom(info);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setTokenInfo(null);
    }
  }, [instructions, joinRoom, llm, stt, tts]);

  const handleDisconnect = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus('Disconnected');
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Web Session</h1>
        <p className="text-sm text-slate-600">
          Create a browser session, dispatch the agent, and join locally.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          STT model
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={stt}
            onChange={(e) => setStt(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          LLM model
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={llm}
            onChange={(e) => setLlm(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          TTS voice
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={tts}
            onChange={(e) => setTts(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Agent instructions
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleCreate}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
        >
          Create & Join
        </button>
        <button
          onClick={handleDisconnect}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Disconnect
        </button>
      </div>

      <div className="rounded border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">Status</p>
        <p className="text-sm text-slate-700">{status || 'Idle'}</p>
        {tokenInfo && (
          <div className="mt-3 space-y-1 text-xs font-mono text-slate-700">
            <div>Room: {tokenInfo.roomName}</div>
            <div>LiveKit URL: {tokenInfo.livekitUrl}</div>
            <div className="break-all">Token: {tokenInfo.token}</div>
          </div>
        )}
        <audio ref={audioRef} autoPlay className="mt-3 w-full" />
      </div>
    </div>
  );
}
