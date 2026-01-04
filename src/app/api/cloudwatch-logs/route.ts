import { NextRequest, NextResponse } from 'next/server';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

const allowedServices = new Set(['livekit', 'agent', 'sip', 'redis', 'caddy', 'all']);

function parseSince(raw: string | null): number | undefined {
  if (!raw) return undefined;
  let value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (value > 1_000_000_000_000) {
    value = Math.floor(value / 1000);
  }
  return value * 1000;
}

export async function GET(request: NextRequest) {
  const enableLogs =
    process.env.ENABLE_CLOUDWATCH_LOGS === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS === 'true';

  if (!enableLogs) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const token = process.env.CLOUDWATCH_LOGS_TOKEN || '';
  if (token) {
    const authHeader = request.headers.get('authorization') || '';
    const expected = `Bearer ${token}`;
    if (authHeader !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const regionOverride = (searchParams.get('region') || '').trim();
  const logGroupOverride = (searchParams.get('logGroup') || '').trim();
  const streamPrefixOverride = (searchParams.get('streamPrefix') || '').trim();

  const region =
    regionOverride ||
    process.env.CLOUDWATCH_REGION ||
    process.env.CLOUDWATCH_AWS_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    '';
  const logGroup = logGroupOverride || process.env.CLOUDWATCH_LOG_GROUP || '';
  const streamPrefix =
    streamPrefixOverride || process.env.CLOUDWATCH_STREAM_PREFIX || 'livekit';

  if (!region || !logGroup) {
    const missing: string[] = [];
    if (!region) missing.push('CLOUDWATCH_REGION');
    if (!logGroup) missing.push('CLOUDWATCH_LOG_GROUP');
    return NextResponse.json(
      { error: 'CloudWatch logging is not configured.', missing },
      { status: 500 }
    );
  }

  const service = (searchParams.get('service') || 'livekit').toLowerCase();
  const tailRaw = searchParams.get('tail') || '200';
  const filterRaw = (searchParams.get('filter') || '').trim();
  const sinceMs = parseSince(searchParams.get('since'));
  const tail = Math.max(1, Math.min(Number.parseInt(tailRaw, 10) || 200, 500));

  if (!allowedServices.has(service)) {
    return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
  }

  const logStreamNamePrefix =
    service === 'all' ? undefined : `${streamPrefix}/${service}`;

  const filterPattern = filterRaw
    ? `"${filterRaw.replace(/"/g, '')}"`
    : undefined;

  try {
    const client = new CloudWatchLogsClient({ region });
    const command = new FilterLogEventsCommand({
      logGroupName: logGroup,
      logStreamNamePrefix,
      startTime: sinceMs,
      limit: tail,
      interleaved: true,
      filterPattern,
    });

    const response = await client.send(command);
    const events = response.events || [];

    events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const logs = events
      .map((event) => {
        const ts = event.timestamp
          ? new Date(event.timestamp).toISOString()
          : '';
        const message = (event.message || '').trimEnd();
        return ts ? `${ts} ${message}` : message;
      })
      .join('\n')
      .trim();

    return NextResponse.json(
      {
        service,
        tail,
        logs,
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
