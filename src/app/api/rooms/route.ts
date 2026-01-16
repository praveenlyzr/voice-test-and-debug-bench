import { NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_HOST = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

function getHttpHost(wsUrl: string): string {
  return wsUrl
    .replace('wss://', 'https://')
    .replace('ws://', 'http://');
}

export async function GET() {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { error: 'LiveKit credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const roomService = new RoomServiceClient(
      getHttpHost(LIVEKIT_HOST),
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    const rooms = await roomService.listRooms();

    // Enrich room data with participant info
    const roomsWithDetails = await Promise.all(
      rooms.map(async (room) => {
        try {
          const participants = await roomService.listParticipants(room.name);
          return {
            name: room.name,
            sid: room.sid,
            numParticipants: room.numParticipants,
            maxParticipants: room.maxParticipants,
            creationTime: room.creationTime ? Number(room.creationTime) * 1000 : null,
            metadata: room.metadata ? JSON.parse(room.metadata) : null,
            participants: participants.map((p) => ({
              identity: p.identity,
              name: p.name,
              sid: p.sid,
              state: p.state,
              joinedAt: p.joinedAt ? Number(p.joinedAt) * 1000 : null,
              tracks: p.tracks?.map((t) => ({
                sid: t.sid,
                type: t.type,
                name: t.name,
                muted: t.muted,
                source: t.source,
              })) || [],
              metadata: p.metadata ? JSON.parse(p.metadata) : null,
            })),
          };
        } catch {
          // If we can't get participants, return room without them
          return {
            name: room.name,
            sid: room.sid,
            numParticipants: room.numParticipants,
            maxParticipants: room.maxParticipants,
            creationTime: room.creationTime ? Number(room.creationTime) * 1000 : null,
            metadata: room.metadata ? JSON.parse(room.metadata) : null,
            participants: [],
          };
        }
      })
    );

    return NextResponse.json({
      rooms: roomsWithDetails,
      count: roomsWithDetails.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to list rooms: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { error: 'LiveKit credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get('room');

    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    const roomService = new RoomServiceClient(
      getHttpHost(LIVEKIT_HOST),
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    await roomService.deleteRoom(roomName);

    return NextResponse.json({
      success: true,
      message: `Room ${roomName} deleted`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to delete room: ${message}` },
      { status: 500 }
    );
  }
}
