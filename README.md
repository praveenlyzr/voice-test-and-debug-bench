# LiveKit Voice Test Bench

A Next.js frontend for testing and monitoring LiveKit voice AI calls and sessions.

## Features

- **Dashboard** - Overview with auto-refreshing stats (active calls, registered numbers, agent configs)
- **Numbers** - View and manage registered phone numbers with SIP configurations
- **Web Session** - Browser-based voice testing with saved or custom configs
- **Outbound** - Place outbound phone calls with value_sources transparency
- **Live Calls** - Real-time monitoring of active rooms and participants
- **Plugins** - View available STT, LLM, and TTS providers
- **Configs** - Manage saved agent configurations
- **Logs** - CloudWatch and local log viewer

## Pages Overview

### Dashboard (`/`)
Overview page with:
- Active calls count (auto-refresh every 10s)
- Registered numbers count
- Agent configs count
- System status indicator
- Quick action buttons
- Recent activity feed (aggregated from all pages)

### Numbers (`/numbers`)
View all registered phone numbers:
- Phone number display with formatting
- Inbound/outbound trunk IDs
- Agent config association
- Configuration status badges (Configured/Partial/Missing)
- Expandable details with full JSON

### Web Session (`/web-session`)
Browser-based voice testing:
- Mode toggle: "Use Saved Config" or "Custom Config"
- Saved config dropdown (from database)
- Model selectors for STT, LLM, TTS with grouped options
- Agent instructions editor
- Real-time connection status
- Value sources display (shows where each config value came from)
- Activity log

### Outbound (`/outbound`)
Place outbound phone calls:
- Caller number selector (from registered numbers)
- Recipient number input with auto-formatting
- Mode toggle for saved/custom config
- Model selectors with descriptions
- Call status with room info
- `value_sources` and `defaults_used` display
- Activity log

### Live Calls (`/live`)
Real-time call monitoring:
- Active rooms list with participant count
- Auto-refresh every 5 seconds (configurable)
- Expandable room details:
  - Room metadata
  - Participant info (identity, state, join time)
  - Track details (type, source, muted status)
- End call button for each room
- Stats bar (rooms, participants, tracks)

### Plugins (`/plugins`)
Available provider information:
- STT providers (AssemblyAI, Deepgram, OpenAI)
- LLM providers (OpenAI)
- TTS providers (ElevenLabs, OpenAI)
- Model lists with descriptions
- Required environment variables

## Local Development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

### Required env vars
```env
# Backend API
NEXT_PUBLIC_CONTROL_API_URL=http://localhost:7000

# LiveKit credentials
LIVEKIT_URL=wss://your-livekit-url
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

### Optional CloudWatch logs
```env
CLOUDWATCH_REGION=us-east-1
NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS=true
ENABLE_CLOUDWATCH_LOGS=true
CLOUDWATCH_LOG_GROUP=/livekit/production
CLOUDWATCH_STREAM_PREFIX=livekit
CLOUDWATCH_LOGS_TOKEN=your-debug-token
```

## API Routes

| Route | Description |
|-------|-------------|
| `GET /api/rooms` | List active LiveKit rooms with participants |
| `DELETE /api/rooms?room=name` | Delete/end a room |
| `GET /api/sip-configs` | Get registered SIP configurations |
| `GET /api/agent-configs` | Get saved agent configurations |
| `POST /api/make-call` | Initiate outbound call |
| `POST /api/start-web-session` | Create web session |
| `GET /api/local-logs` | Fetch local Docker logs |
| `GET /api/cloudwatch-logs` | Fetch CloudWatch logs |

### `POST /api/make-call`
Creates a LiveKit room and dispatches the agent for an outbound SIP call.

**Request JSON**
```json
{
  "phoneNumber": "+15551234567",
  "callerNumber": "+15559876543",
  "stt": "assemblyai/universal-streaming:en",
  "llm": "openai/gpt-4o-mini",
  "tts": "elevenlabs:pNInz6obpgDQGcFmaJgB",
  "agent_instructions": "..."
}
```

**Response** includes `value_sources` and `defaults_used` for transparency.

### `POST /api/start-web-session`
Creates a room, dispatches the agent, and returns a LiveKit token for the browser.

## Activity Logging

Each page includes an embedded activity log that tracks:
- Actions performed (calls initiated, sessions started, etc.)
- Status (success, error, pending)
- Details and API responses
- Room names
- Value sources and defaults used

Activity is persisted in localStorage per page:
- `dashboard-activity`
- `web-session-activity`
- `outbound-activity`
- `live-activity`
- `numbers-activity`

## Model Options

### STT (Speech-to-Text)
| Provider | Models |
|----------|--------|
| AssemblyAI | `assemblyai/universal-streaming:en` |
| Deepgram | `deepgram/nova-2`, `deepgram/nova-3:en`, `deepgram/enhanced` |
| OpenAI | `openai/whisper-1` |

### LLM (Language Model)
| Provider | Models |
|----------|--------|
| OpenAI | `openai/gpt-4o-mini` (recommended), `openai/gpt-4o`, `openai/gpt-4-turbo` |

### TTS (Text-to-Speech)
| Provider | Voices |
|----------|--------|
| ElevenLabs | Adam, Rachel, Bella, Antoni, Elli, Josh, Arnold, Domi |
| OpenAI | `openai/tts-1`, `openai/tts-1-hd` |

## Amplify Deployment

### Console setup
1. Amplify Console -> New app -> Host web app -> GitHub
2. Select this repo + branch
3. App root: `.`
4. Build spec: `amplify.yml`
5. Add env vars (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, NEXT_PUBLIC_CONTROL_API_URL)
6. Deploy

### Sync to deployment repo
```bash
./sync-frontend-test-bench.sh
```

## Troubleshooting

**"CloudWatch logging is not configured."**
- The app is missing `CLOUDWATCH_REGION` or `CLOUDWATCH_LOG_GROUP` at runtime. Set the env vars and trigger a new build.

**"Could not load credentials from any providers"**
- The Amplify app has no IAM service role (or the role lacks CloudWatch permissions). Attach a service role that can call `logs:FilterLogEvents` on your log group.

**API calls failing**
- Check that `NEXT_PUBLIC_CONTROL_API_URL` points to your running backend
- Verify CORS is configured on the backend
- Check browser console for detailed error messages

## Project Structure
```
src/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── numbers/page.tsx      # Registered numbers
│   ├── web-session/page.tsx  # Web session testing
│   ├── outbound/page.tsx     # Outbound calls
│   ├── live/page.tsx         # Live call monitor
│   ├── plugins/page.tsx      # Provider info
│   ├── configs/page.tsx      # Agent configs
│   ├── logs/page.tsx         # Log viewer
│   └── api/                   # API routes
├── components/
│   ├── ActivityLog.tsx       # Reusable activity log
│   └── CallTrigger.tsx       # Legacy call component
└── lib/
    └── models.ts             # Model options constants
```

## Security

- Never commit `.env.local` or `.env.deploy` with real secrets
- `LIVEKIT_API_SECRET` is only used server-side in API routes
- Lock down CloudWatch logs using `CLOUDWATCH_LOGS_TOKEN`