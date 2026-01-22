import { NextRequest, NextResponse } from 'next/server';

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { stt, llm, tts, agent_instructions } = body || {};

    // Check if backend URL is configured
    if (!CONTROL_API_URL || CONTROL_API_URL === 'true') {
      return NextResponse.json(
        {
          error: 'Backend API URL not configured',
          hint: 'Set NEXT_PUBLIC_CONTROL_API_URL to your backend URL',
        },
        { status: 500 }
      );
    }

    // Call the backend API to create a web session
    const url = `${CONTROL_API_URL}/sessions/web`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stt,
        llm,
        tts,
        agent_instructions,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data.detail || data.error || 'Failed to start web session',
          backendUrl: url,
        },
        { status: response.status }
      );
    }

    // Return the backend response (includes token, room_name, livekit_url, etc.)
    // Backend now returns correct PUBLIC_LIVEKIT_URL, use it directly
    const livekitUrl = data.livekit_url;
    console.log('Web session created:', { roomName: data.room_name, livekitUrl });
    return NextResponse.json({
      token: data.token,
      roomName: data.room_name,
      livekitUrl,
      metadata: data.metadata,
      value_sources: data.value_sources,
      defaults_used: data.defaults_used,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: `Failed to start web session: ${message}`,
        hint: 'Check if backend is running at ' + CONTROL_API_URL,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'livekit-web-session',
    backendUrl: CONTROL_API_URL || '(not configured)',
  });
}
