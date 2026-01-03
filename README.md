# LiveKit Call Trigger Frontend

A simple, stateless web interface to trigger outbound phone calls via LiveKit SIP integration.

## Features

- Clean, minimal UI for triggering outbound calls
- Outbound defaults panel (saved in browser)
- No authentication or data persistence (as requested)
- Phone number validation with E.164 format
- Real-time call status feedback
- Browser-based agent test (no phone)
- Responsive design with Tailwind CSS
- Built with Next.js 14 and TypeScript
 - Optional local log viewer for debugging (dev-only)

## Prerequisites

- Node.js 18+ installed
- LiveKit server running and accessible
- LiveKit API credentials (API Key and Secret)

## Quick Start

### 1. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Configure Environment

Copy the example environment file and fill in your LiveKit credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
LIVEKIT_URL=wss://livekit.yourdomain.com
LIVEKIT_API_KEY=your-api-key-here
LIVEKIT_API_SECRET=your-api-secret-here
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Test the Application

1. Enter a phone number in E.164 format (e.g., +15551234567)
2. Click "Make Call"
3. The backend will create a LiveKit room with the phone number in metadata
4. The agent will detect the metadata and place the outbound call

### 5. Test the Agent Without a Phone

Use the **Browser Test (no phone)** panel to join a WebRTC room with your mic.
This validates the agent locally without Twilio.

---

## 🚀 AWS Amplify Deployment (Recommended)

Amplify handles build + hosting for Next.js (including API routes) without managing S3 or CloudFront directly.

### Setup

1. Create a new Amplify app from this repo in the AWS Console
2. Set **App root** to `livekit/frontend`
3. Use the build spec at `amplify.yml`
4. Add environment variables: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
5. Deploy

### Scripted Setup (CLI)

You can create/update an Amplify app and set env vars via:

```bash
cd livekit/frontend
bash deploy-amplify.sh
```

Required (one of):
- `AMPLIFY_APP_ID` (use existing app)
- `AMPLIFY_REPOSITORY` + `AMPLIFY_ACCESS_TOKEN` or `AMPLIFY_OAUTH_TOKEN` (create app)

The script reads `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_DOMAIN` from
`livekit/secrets` and uses the deployed EC2 IP in `livekit/aws-resources.json`
when a domain isn’t set.

### Update Deployment

Push changes to your repo or trigger a new build in the Amplify Console.

### Teardown

Delete the Amplify app in the AWS Console. `../cleanup-aws.sh` only tears down backend resources created by the scripts.

---

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── make-call/
│   │   │   │   └── route.ts      # API endpoint for outbound calls
│   │   │   ├── start-web-session/
│   │   │   │   └── route.ts      # API endpoint for browser sessions
│   │   │   └── local-logs/
│   │   │       └── route.ts      # Local-only log viewer (dev)
│   │   ├── globals.css           # Global styles
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Home page
│   └── components/
│       └── CallTrigger.tsx       # Main call trigger component
├── public/                       # Static assets
├── .env.local.example           # Environment template
├── package.json                 # Dependencies
├── tsconfig.json               # TypeScript config
├── next.config.js              # Next.js config
└── tailwind.config.ts          # Tailwind config
```

## API Endpoints

### POST /api/make-call

Initiates an outbound call by creating a LiveKit room with phone number metadata.

**Request Body:**
```json
{
  "phoneNumber": "+15551234567"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "roomName": "outbound-1234567890123",
  "message": "Call initiated"
}
```

**Error Response (400/500):**
```json
{
  "error": "Error message"
}
```

### GET /api/make-call

Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "service": "livekit-call-trigger"
}
```

### POST /api/start-web-session

Creates a room, dispatches the agent, and returns a token for browser WebRTC.

**Response (200):**
```json
{
  "token": "<jwt>",
  "roomName": "web-1234567890123",
  "livekitUrl": "ws://localhost:7880"
}
```

### GET /api/start-web-session

Health check endpoint.

### GET /api/local-logs (dev only)

Fetches local `docker-compose` logs. Requires:
```
NEXT_PUBLIC_ENABLE_LOCAL_LOGS=true
ENABLE_LOCAL_LOGS=true
```

## Phone Number Format

The application accepts phone numbers in E.164 format:
- Must start with `+`
- Followed by country code (1-3 digits)
- Followed by subscriber number (up to 14 digits total after +)

Examples:
- US: `+15551234567`
- UK: `+447911123456`
- India: `+919876543210`

## Deployment Options

### Option 1: AWS Amplify (Recommended)

Use `amplify.yml` at repo root and set the app root to `livekit/frontend`. Add the LiveKit environment variables in the Amplify Console.

### Option 2: Vercel (Easiest)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Follow the prompts. Vercel will automatically detect Next.js and configure everything.

Add environment variables in Vercel dashboard:
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

### Option 3: AWS EC2 / Docker

```bash
# Build production
npm run build

# Start production server
npm run start
```

Or use Docker:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t livekit-call-frontend .
docker run -p 3000:3000 --env-file .env.local livekit-call-frontend
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LIVEKIT_URL` | WebSocket URL of your LiveKit server | Yes |
| `LIVEKIT_API_KEY` | LiveKit API key for authentication | Yes |
| `LIVEKIT_API_SECRET` | LiveKit API secret for authentication | Yes |

## Security Considerations

1. **API Secrets**: Never expose `LIVEKIT_API_SECRET` to the client
   - Secrets are only used in server-side API routes
   - Not included in client-side bundles

2. **CORS**: Configure CORS if hosting on different domain than LiveKit server

3. **Rate Limiting**: Consider adding rate limiting to prevent abuse:
   ```typescript
   // Example with next-rate-limit
   import rateLimit from 'next-rate-limit';

   const limiter = rateLimit({
     interval: 60 * 1000, // 1 minute
     uniqueTokenPerInterval: 500,
   });
   ```

4. **Input Validation**: Phone numbers are validated server-side

5. **No Data Persistence**: As designed, no call history or user data is stored

## Troubleshooting

### "Server configuration error"
- Check `.env.local` exists and has all required variables
- Restart dev server after changing environment variables

### "Invalid phone number format"
- Ensure number starts with `+` and country code
- Use E.164 format: `+[country code][subscriber number]`

### "Failed to initiate call"
- Verify LiveKit server is running and accessible
- Check API credentials are correct
- View browser console and server logs for details
- Ensure outbound trunk is configured in backend

### CORS Errors
- If frontend and LiveKit server are on different domains
- Configure appropriate CORS headers in LiveKit config

## Development

### Adding Features

The application is intentionally minimal. Common additions:

1. **Call History**: Add a database and display past calls
2. **Authentication**: Add user login/auth
3. **Bulk Calling**: Upload CSV and call multiple numbers
4. **Call Status**: WebSocket connection to show real-time status
5. **Recording**: Trigger call recording via Egress

### Code Style

```bash
# Run linter
npm run lint

# Format code (if prettier is added)
npm run format
```

## Performance

- Server-side rendering for fast initial load
- Minimal JavaScript bundle (~150KB gzipped)
- Optimized with Next.js automatic code splitting
- CDN-friendly with Amplify/Vercel Edge

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [LiveKit Server SDK](https://docs.livekit.io/reference/server-sdk-js)
- [LiveKit Telephony](https://docs.livekit.io/telephony)
- [Tailwind CSS](https://tailwindcss.com/docs)

## License

MIT
