import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const allowedServices = new Set(['livekit', 'agent', 'sip', 'redis', 'all']);

export async function GET(request: NextRequest) {
  const enableLogs =
    process.env.ENABLE_LOCAL_LOGS === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGS === 'true';

  if (process.env.NODE_ENV === 'production' || !enableLogs) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const service = (searchParams.get('service') || 'livekit').toLowerCase();
  const tailRaw = searchParams.get('tail') || '200';
  const sinceRaw = searchParams.get('since') || '';
  const tail = Math.max(1, Math.min(parseInt(tailRaw, 10) || 200, 500));
  let since = parseInt(sinceRaw, 10);

  if (!Number.isFinite(since) || since <= 0) {
    since = 0;
  } else if (since > 1_000_000_000_000) {
    since = Math.floor(since / 1000);
  }

  if (!allowedServices.has(service)) {
    return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
  }

  const backendDir = path.join(process.cwd(), '..', 'backend');
  const args = [
    '-f',
    'docker-compose.yml',
    '-f',
    'docker-compose.local.yml',
    'logs',
    '--tail',
    String(tail),
  ];

  if (since > 0) {
    args.push('--since', String(since));
  }

  if (service !== 'all') {
    args.push(service);
  }

  try {
    const { stdout, stderr } = await execFileAsync('docker-compose', args, {
      cwd: backendDir,
      maxBuffer: 1024 * 1024,
    });

    return NextResponse.json(
      {
        service,
        tail,
        logs: `${stdout}${stderr}`.trim(),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch logs: ${message}` },
      { status: 500 }
    );
  }
}
