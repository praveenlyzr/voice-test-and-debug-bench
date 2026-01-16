import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check environment configuration
 * GET /api/debug - Returns status of all required env vars (without exposing secrets)
 */
export async function GET() {
  const checkEnv = (key: string) => {
    const value = process.env[key];
    if (!value) return { status: 'missing', length: 0 };
    return { status: 'set', length: value.length };
  };

  const config = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,

    // LiveKit Configuration
    livekit: {
      LIVEKIT_URL: checkEnv('LIVEKIT_URL'),
      LIVEKIT_API_KEY: checkEnv('LIVEKIT_API_KEY'),
      LIVEKIT_API_SECRET: checkEnv('LIVEKIT_API_SECRET'),
      LIVEKIT_AGENT_NAME: checkEnv('LIVEKIT_AGENT_NAME'),
    },

    // Backend API
    backend: {
      NEXT_PUBLIC_CONTROL_API_URL: checkEnv('NEXT_PUBLIC_CONTROL_API_URL'),
    },

    // CloudWatch Logs
    cloudwatch: {
      ENABLE_CLOUDWATCH_LOGS: checkEnv('ENABLE_CLOUDWATCH_LOGS'),
      NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS: checkEnv('NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS'),
      CLOUDWATCH_REGION: checkEnv('CLOUDWATCH_REGION'),
      CLOUDWATCH_LOG_GROUP: checkEnv('CLOUDWATCH_LOG_GROUP'),
      CLOUDWATCH_STREAM_PREFIX: checkEnv('CLOUDWATCH_STREAM_PREFIX'),
      CLOUDWATCH_LOGS_TOKEN: checkEnv('CLOUDWATCH_LOGS_TOKEN'),
    },

    // Local Logs
    localLogs: {
      ENABLE_LOCAL_LOGS: checkEnv('ENABLE_LOCAL_LOGS'),
      NEXT_PUBLIC_ENABLE_LOCAL_LOGS: checkEnv('NEXT_PUBLIC_ENABLE_LOCAL_LOGS'),
    },

    // Feature flags summary
    features: {
      livekitConfigured: Boolean(
        process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET
      ),
      backendConfigured: Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL),
      cloudwatchEnabled: process.env.ENABLE_CLOUDWATCH_LOGS === 'true' ||
                         process.env.NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS === 'true',
      localLogsEnabled: process.env.ENABLE_LOCAL_LOGS === 'true' ||
                        process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGS === 'true',
    },

    // Hints for debugging
    hints: [],
  };

  // Add helpful hints
  if (!config.features.livekitConfigured) {
    config.hints.push('LiveKit not configured - web sessions and calls will fail');
  }
  if (!config.features.backendConfigured) {
    config.hints.push('Backend API URL not set - SIP configs and agent configs will fail');
  }
  if (!config.features.cloudwatchEnabled && !config.features.localLogsEnabled) {
    config.hints.push('No logging enabled - set ENABLE_CLOUDWATCH_LOGS=true or ENABLE_LOCAL_LOGS=true');
  }

  return NextResponse.json(config, { status: 200 });
}
