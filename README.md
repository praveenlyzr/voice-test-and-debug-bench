# Voice Test & Debug Bench (Frontend)

A simple, stateless Next.js UI to trigger outbound SIP calls via LiveKit and to test the agent in a browser session.

## What it does
- Place outbound calls (E.164 phone numbers)
- Choose STT/LLM/TTS per call
- Edit agent instructions
- Browser-based voice test (WebRTC) with the agent
- Optional log viewers for debugging (local or CloudWatch)

## Local development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

### Required env vars (local)
```
LIVEKIT_URL=wss://voice.preview.studio.lyzr.ai
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

### Optional CloudWatch logs (local or Amplify)
```
NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS=true
ENABLE_CLOUDWATCH_LOGS=true
AWS_REGION=us-east-1
CLOUDWATCH_LOG_GROUP=/livekit/production
CLOUDWATCH_STREAM_PREFIX=livekit
CLOUDWATCH_LOGS_TOKEN=your-debug-token
```

Notes:
- In Amplify, the app role must allow `logs:FilterLogEvents` (and `logs:DescribeLogStreams` if needed) for the log group.
- If `CLOUDWATCH_LOGS_TOKEN` is set, paste the token in the UI (the request sends `Authorization: Bearer <token>`).

### One-time Amplify CloudWatch setup (copy/paste)
This creates/attaches an Amplify service role (if missing), grants it read access to the log group, sets env vars on `main`, and verifies the stream prefix.

```bash
AWS_PROFILE=dev AWS_REGION=us-east-1 AMPLIFY_APP_ID=d34c6t2vowzt3r \
CLOUDWATCH_LOG_GROUP=/livekit/voice CLOUDWATCH_STREAM_PREFIX=livekit \
bash -c 'set -euo pipefail
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_NAME="amplify-cloudwatch-logs-role"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
TRUST_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "amplify.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON
)
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY"
fi
POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:${AWS_REGION}:*:log-group:${CLOUDWATCH_LOG_GROUP}",
        "arn:aws:logs:${AWS_REGION}:*:log-group:${CLOUDWATCH_LOG_GROUP}:*"
      ]
    }
  ]
}
JSON
)
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name AmplifyCloudWatchLogsRead --policy-document "$POLICY"
aws amplify update-app --app-id "$AMPLIFY_APP_ID" --iam-service-role-arn "$ROLE_ARN"
ENV_VARS="NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS=true,ENABLE_CLOUDWATCH_LOGS=true,AWS_REGION=$AWS_REGION,CLOUDWATCH_LOG_GROUP=$CLOUDWATCH_LOG_GROUP,CLOUDWATCH_STREAM_PREFIX=$CLOUDWATCH_STREAM_PREFIX"
if [ -n "${CLOUDWATCH_LOGS_TOKEN:-}" ]; then
  ENV_VARS="$ENV_VARS,CLOUDWATCH_LOGS_TOKEN=$CLOUDWATCH_LOGS_TOKEN"
fi
aws amplify update-branch --app-id "$AMPLIFY_APP_ID" --branch-name main --environment-variables "$ENV_VARS"
aws logs describe-log-streams --log-group-name "$CLOUDWATCH_LOG_GROUP" --log-stream-name-prefix "${CLOUDWATCH_STREAM_PREFIX}/" --max-items 5 --output table
'
```

## Amplify deployment (recommended)

### Console setup (fastest)
1. Amplify Console → New app → Host web app → GitHub
2. Select this repo + branch
3. App root: `.`
4. Build spec: `amplify.yml`
5. Add env vars:
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - (Optional) `AWS_REGION`, `CLOUDWATCH_LOG_GROUP`, `CLOUDWATCH_STREAM_PREFIX`,
     `NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS`, `ENABLE_CLOUDWATCH_LOGS`, `CLOUDWATCH_LOGS_TOKEN`
6. Deploy

### Scripted setup (CLI)
1. Create `.env.deploy` from the example:

```bash
cp .env.deploy.example .env.deploy
```

2. Run the script:

```bash
export AMPLIFY_REPOSITORY="https://github.com/NeuralgoLyzr/voice-module-research"
export AMPLIFY_ACCESS_TOKEN="<github_pat_with_repo + webhook access>"
export AMPLIFY_BRANCH="main"
AWS_PROFILE=dev AWS_REGION=us-east-1 bash deploy-amplify.sh
```

Notes:
- The PAT must be able to create webhooks (GitHub may block PATs in orgs; use the Amplify GitHub App if so).
- `deploy-amplify.sh` reads `.env.deploy` by default.

## API endpoints (server routes)

### `POST /api/make-call`
Creates a LiveKit room and dispatches the agent for an outbound SIP call.

**Request JSON**
```json
{
  "phoneNumber": "+15551234567",
  "stt": "assemblyai/universal-streaming:en",
  "llm": "openai/gpt-4.1-mini",
  "tts": "elevenlabs:pNInz6obpgDQGcFmaJgB",
  "agent_instructions": "..."
}
```

### `POST /api/start-web-session`
Creates a room, dispatches the agent, and returns a LiveKit token for the browser.

### `GET /api/local-logs` (dev only)
Fetches local docker-compose logs.
Enabled only when:
- `NEXT_PUBLIC_ENABLE_LOCAL_LOGS=true`
- `ENABLE_LOCAL_LOGS=true`

### `GET /api/cloudwatch-logs`
Fetches CloudWatch logs for the configured log group.
Enabled only when:
- `NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS=true`
- `ENABLE_CLOUDWATCH_LOGS=true`

## Debugging toggles
- `NEXT_PUBLIC_ENABLE_LOCAL_LOGS=true`
- `ENABLE_LOCAL_LOGS=true`
- `NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS=true`
- `ENABLE_CLOUDWATCH_LOGS=true`

Do **not** enable these in production.

## Repo structure
```
.
├── src/
│   ├── app/
│   │   ├── api/make-call/route.ts
│   │   ├── api/start-web-session/route.ts
│   │   ├── api/local-logs/route.ts
│   │   └── api/cloudwatch-logs/route.ts
│   └── components/CallTrigger.tsx
├── amplify.yml
├── deploy-amplify.sh
├── .env.local.example
└── .env.deploy.example
```

## Security
- Never commit `.env.local` or `.env.deploy` with real secrets.
- `LIVEKIT_API_SECRET` is only used server-side in API routes.
- Lock down CloudWatch logs using `CLOUDWATCH_LOGS_TOKEN`.
