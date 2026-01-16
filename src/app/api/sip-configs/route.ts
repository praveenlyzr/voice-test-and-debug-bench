import { NextResponse } from 'next/server';

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL || 'http://localhost:7000';

export async function GET() {
  try {
    const response = await fetch(`${CONTROL_API_URL}/sip-configs`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch SIP configs: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch SIP configs: ${message}` },
      { status: 500 }
    );
  }
}
