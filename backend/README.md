# MirrorMind Backend

Node.js 20 + Express + TypeScript backend for MirrorMind.

## Quick Setup

1. Install dependencies:
   npm install

2. Configure environment:
   Copy `.env.example` to `.env` and fill required values.

3. Generate Prisma client:
   npm run prisma:generate

4. Push schema to DB (dev):
   npm run prisma:push

5. Start backend:
   npm run dev

Backend defaults to http://localhost:4000.

## Required Services

- PostgreSQL (DATABASE_URL)
- Redis (REDIS_URL)
- Python AI service at http://localhost:8000 (AI_SERVICE_URL)

## GitHub Webhook Setup

Configure a webhook on each repository:

- Payload URL: `https://yourserver.com/api/webhooks/github`
- Content type: `application/json`
- Secret: value of `GITHUB_WEBHOOK_SECRET`
- Events: `Pull requests`

The webhook validates `X-Hub-Signature-256` (HMAC SHA-256).

## API Surface

- `/api/auth/*` - GitHub OAuth sync/callback, token refresh/logout, current user
- `/api/team/*` - Team details, invites, member role management, invitation join
- `/api/repos/*` - Repo connection/disconnect
- `/api/ingestion/*` - Ingestion status and manual sync
- `/api/query` - SSE chat query streaming
- `/api/conversations/*` - Conversation history CRUD
- `/api/reviews/*` - PR review list/detail/manual trigger
- `/api/webhooks/github` - GitHub pull_request webhook receiver
- `/api/billing/*` - Billing status and mock upgrade

## Workers

- BullMQ `ingestion` worker: repository ingestion lifecycle
- BullMQ `pr-review` worker: AI PR review processing and optional GitHub comments
- Daily incremental sync scheduler: `node-cron` every 24 hours
