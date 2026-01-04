import { NextRequest, NextResponse } from 'next/server';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const token = process.env.CLOUDWATCH_LOGS_TOKEN || '';
  if (token) {
    const authHeader = request.headers.get('authorization') || '';
    const expected = `Bearer ${token}`;
    if (authHeader !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const debugRaw = (searchParams.get('debug') || '').toLowerCase();
  const debug = debugRaw === '1' || debugRaw === 'true' || debugRaw === 'yes';

  if (!enableLogs && !debug) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const regionOverride = (searchParams.get('region') || '').trim();
  const logGroupOverride = (searchParams.get('logGroup') || '').trim();
  const streamPrefixOverride = (searchParams.get('streamPrefix') || '').trim();

  const accessKeyId = (process.env.CLOUDWATCH_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.CLOUDWATCH_SECRET_ACCESS_KEY || '').trim();
  const sessionToken = (process.env.CLOUDWATCH_SESSION_TOKEN || '').trim();
  const explicitCredentials =
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
          ...(sessionToken ? { sessionToken } : {}),
        }
      : undefined;

  const envRegion =
    process.env.CLOUDWATCH_REGION ||
    process.env.CLOUDWATCH_AWS_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    '';
  const envLogGroup = process.env.CLOUDWATCH_LOG_GROUP || '';
  const envStreamPrefix = process.env.CLOUDWATCH_STREAM_PREFIX || 'livekit';

  const region = regionOverride || envRegion || '';
  const logGroup = logGroupOverride || envLogGroup || '';
  const streamPrefix = streamPrefixOverride || envStreamPrefix || 'livekit';

  const missing: string[] = [];
  if (!region) missing.push('CLOUDWATCH_REGION');
  if (!logGroup) missing.push('CLOUDWATCH_LOG_GROUP');

  if (debug) {
    const credentialHints = {
      hasEnvAccessKey: Boolean(process.env.AWS_ACCESS_KEY_ID),
      hasEnvSecretKey: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
      hasEnvSessionToken: Boolean(process.env.AWS_SESSION_TOKEN),
      hasContainerRelativeUri: Boolean(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI),
      hasContainerFullUri: Boolean(process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI),
      hasWebIdentityToken: Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE),
      hasRoleArn: Boolean(process.env.AWS_ROLE_ARN),
      hasProfile: Boolean(process.env.AWS_PROFILE),
      executionEnv: process.env.AWS_EXECUTION_ENV || null,
      lambdaFunction: process.env.AWS_LAMBDA_FUNCTION_NAME || null,
    };
    return NextResponse.json(
      {
        enabled: enableLogs,
        configured: missing.length === 0,
        missing,
        effective: {
          region: region || null,
          logGroup: logGroup || null,
          streamPrefix: streamPrefix || null,
        },
        env: {
          region: envRegion || null,
          logGroup: envLogGroup || null,
          streamPrefix: envStreamPrefix || null,
        },
        overrides: {
          region: regionOverride || null,
          logGroup: logGroupOverride || null,
          streamPrefix: streamPrefixOverride || null,
        },
        credentialHints,
        explicitCredentialHints: {
          hasAccessKeyId: Boolean(accessKeyId),
          hasSecretAccessKey: Boolean(secretAccessKey),
          hasSessionToken: Boolean(sessionToken),
          usingExplicitCredentials: Boolean(explicitCredentials),
        },
      },
      { status: 200 }
    );
  }

  if (missing.length > 0) {
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
    const client = new CloudWatchLogsClient({
      region,
      credentials: explicitCredentials,
    });
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
