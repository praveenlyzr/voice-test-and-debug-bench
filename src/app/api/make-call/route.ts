import { NextRequest, NextResponse } from 'next/server';

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, callerNumber, stt, llm, tts, agent_instructions } = body;

    // Validate phone number
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

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

    // Call the backend API to place the outbound call
    const url = `${CONTROL_API_URL}/calls/outbound`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        caller_number: callerNumber,
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
          error: data.detail || data.error || 'Failed to initiate call',
          backendUrl: url,
        },
        { status: response.status }
      );
    }

    // Return the backend response (includes room_name, value_sources, etc.)
    return NextResponse.json({
      success: true,
      roomName: data.room_name,
      message: 'Call initiated',
      value_sources: data.value_sources,
      defaults_used: data.defaults_used,
      configuration: {
        stt: data.stt_model,
        llm: data.llm_model,
        tts: data.tts_voice,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: `Failed to initiate call: ${message}`,
        hint: 'Check if backend is running at ' + CONTROL_API_URL,
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'livekit-call-trigger',
    backendUrl: CONTROL_API_URL || '(not configured)',
  });
}
