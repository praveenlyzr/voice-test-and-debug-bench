import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, stt, llm, tts, agent_instructions } = await request.json();

    // Validate phone number
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Basic phone number validation (international format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +15551234567)' },
        { status: 400 }
      );
    }

    // Check required environment variables
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

    // Initialize LiveKit Room Service Client
    const roomService = new RoomServiceClient(
      livekitHost,
      livekitApiKey,
      livekitApiSecret
    );

    // Create unique room name with timestamp
    const timestamp = Date.now();
    const roomName = `outbound-${timestamp}`;

    console.log(`Creating room: ${roomName} for call to ${phoneNumber}`);
    console.log(`Configuration: STT=${stt}, LLM=${llm}, TTS=${tts}`);

    const jobMetadata = {
      phone_number: phoneNumber,
      stt: stt || 'assemblyai/universal-streaming:en',
      llm: llm || 'openai/gpt-4.1-mini',
      tts: tts || 'elevenlabs:pNInz6obpgDQGcFmaJgB',
      agent_instructions:
        agent_instructions ||
        'You are a helpful voice AI assistant for phone calls. Be concise, friendly, and professional.',
      timestamp: timestamp,
      type: 'outbound_call',
    };

    // Create room (metadata retained for visibility)
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 300, // 5 minutes
      maxParticipants: 2,
      metadata: JSON.stringify(jobMetadata),
    });

    console.log(`Room created successfully: ${roomName}`);

    // Explicitly dispatch agent to the room (required when agent_name is set)
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

    return NextResponse.json({
      success: true,
      roomName: roomName,
      message: 'Call initiated',
      configuration: {
        stt: stt || 'assemblyai/universal-streaming:en',
        llm: llm || 'openai/gpt-4.1-mini',
        tts: tts || 'elevenlabs:pNInz6obpgDQGcFmaJgB'
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error making call:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to initiate call: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to initiate call' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'livekit-call-trigger'
  });
}
