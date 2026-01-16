import { NextResponse } from 'next/server';

const CONTROL_API_URL = process.env.NEXT_PUBLIC_CONTROL_API_URL || '';

export async function GET() {
  // Check if backend URL is configured
  if (!CONTROL_API_URL || CONTROL_API_URL === 'true') {
    return NextResponse.json(
      {
        error: 'Backend API URL not configured',
        hint: 'Set NEXT_PUBLIC_CONTROL_API_URL to your backend URL (e.g., http://54.175.133.147:7000)',
        currentValue: CONTROL_API_URL || '(not set)',
      },
      { status: 500 }
    );
  }

  try {
    const url = `${CONTROL_API_URL}/sip-configs`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch SIP configs: ${error}`, url },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: `Failed to fetch SIP configs: ${message}`,
        url: `${CONTROL_API_URL}/sip-configs`,
        hint: 'Check if backend is running and accessible',
      },
      { status: 500 }
    );
  }
}
