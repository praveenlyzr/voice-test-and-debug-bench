import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { stt, llm, tts, agent_instructions } = body || {};

    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
    const agentName = process.env.LIVEKIT_AGENT_NAME || 'telephony-agent';

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      const missing = [];
      if (!livekitUrl) missing.push('LIVEKIT_URL');
      if (!livekitApiKey) missing.push('LIVEKIT_API_KEY');
      if (!livekitApiSecret) missing.push('LIVEKIT_API_SECRET');
      console.error('Missing LiveKit configuration:', missing.join(', '));
      return NextResponse.json(
        {
          error: 'Server configuration error: Missing LiveKit credentials',
          missing,
          hint: 'Set these environment variables in Amplify or .env.local'
        },
        { status: 500 }
      );
    }

    const livekitHost = livekitUrl.replace(/^ws(s)?:\/\//, 'http$1://');
    const roomService = new RoomServiceClient(
      livekitHost,
      livekitApiKey,
      livekitApiSecret
    );

    const timestamp = Date.now();
    const roomName = `web-${timestamp}`;
    const identity = `web-${Math.random().toString(36).slice(2, 10)}`;

    const jobMetadata = {
      stt: stt || 'assemblyai/universal-streaming:en',
      llm: llm || 'openai/gpt-4.1-mini',
      tts: tts || 'elevenlabs:pNInz6obpgDQGcFmaJgB',
      agent_instructions:
        agent_instructions ||
        'You are a helpful voice AI assistant for phone calls. Be concise, friendly, and professional.',
      timestamp,
      type: 'web_session',
    };

    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 300,
      maxParticipants: 2,
      metadata: JSON.stringify(jobMetadata),
    });

    const sdk: any = await import('livekit-server-sdk');
    const AgentDispatchClient = sdk.AgentDispatchClient;
    if (!AgentDispatchClient) {
      throw new Error('AgentDispatchClient not available in livekit-server-sdk');
    }

    const agentDispatch = new AgentDispatchClient(
      livekitHost,
      livekitApiKey,
      livekitApiSecret
    );

    await agentDispatch.createDispatch(roomName, agentName, {
      metadata: JSON.stringify(jobMetadata),
    });

    const tokenBuilder = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity,
      name: 'Web Caller',
    });
    tokenBuilder.addGrant({ roomJoin: true, room: roomName });
    const token = await tokenBuilder.toJwt();

    return NextResponse.json(
      {
        token,
        roomName,
        livekitUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error starting web session:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to start web session: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'livekit-web-session',
  });
}
