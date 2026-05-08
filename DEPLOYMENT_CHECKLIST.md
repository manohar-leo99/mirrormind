# MirrorMind Deployment Guide

Frontend is on Vercel. Backend and AI service are on Railway. Databases can be Railway-managed or external.

## Clean Service Layout

1. Frontend root folder: `frontend`
2. Backend root folder: `backend`
3. AI service root folder: `ai-service`
4. Database services: Railway Postgres, Railway Redis, and optional Railway Chroma or external services

## Deployment Order

1. Push this repo to GitHub.
2. Deploy the backend on Railway.
3. Deploy the AI service on Railway.
4. Create or connect PostgreSQL, Redis, and Chroma.
5. Deploy the frontend on Vercel.
6. Paste the final public URLs into the env vars shown below.
7. Run `npm run prisma:push` once on the backend if the database is empty.
8. Test login, repo connect, chat, PR review, and team pages.

## URL Map

1. Frontend public URL: `https://<your-project>.vercel.app`
2. Backend public URL: `https://<your-backend>.up.railway.app`
3. AI service public URL: `https://<your-ai>.up.railway.app`
4. GitHub OAuth callback: `https://<your-project>.vercel.app/api/auth/callback/github`
5. GitHub webhook URL: `https://<your-backend>.up.railway.app/api/webhooks/github`

==================================================
FRONTEND (VERCEL)
==================================================

1. Folder to deploy:
frontend

2. Build command:
npm run build

3. Output directory:
Leave empty. Vercel auto-detects Next.js.

4. Environment variables to add in Vercel:
NEXTAUTH_URL=https://<your-project>.vercel.app
NEXTAUTH_SECRET=<your-long-random-secret>
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
BACKEND_URL=https://<your-backend>.up.railway.app
NEXT_PUBLIC_API_URL=https://<your-backend>.up.railway.app

What to paste:
`NEXTAUTH_URL` = your exact Vercel frontend URL.
`NEXTAUTH_SECRET` = your own random secret string.
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` = values from your GitHub OAuth App.
`BACKEND_URL` and `NEXT_PUBLIC_API_URL` = your Railway backend public URL.

5. Any changes made:
- Added Railway-aware auth fallback so the app still works if `NEXTAUTH_URL` is not manually set during runtime.
- Kept backend proxying through the backend service URL.
- Removed the stale frontend Railway config.

==================================================
BACKEND (RAILWAY)
==================================================

1. Folder to deploy:
backend

2. Start command:
npm run start

3. Build command:
npm run build

4. Environment variables:
PORT=4000
DATABASE_URL=<railway-postgres-connection-string>
REDIS_URL=<railway-redis-connection-string>
JWT_SECRET=<your-long-random-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
GITHUB_WEBHOOK_SECRET=<your-github-webhook-secret>
AI_SERVICE_URL=https://<your-ai>.up.railway.app
FRONTEND_URL=https://<your-project>.vercel.app
SCHEDULED_SYNC_GITHUB_TOKEN=<optional-github-token>

What to paste:
`DATABASE_URL` = Railway Postgres connection string.
`REDIS_URL` = Railway Redis connection string.
`JWT_SECRET` = your own random secret string.
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` = same GitHub OAuth App values used by the frontend.
`GITHUB_WEBHOOK_SECRET` = your own random webhook secret, same as GitHub webhook secret.
`AI_SERVICE_URL` = Railway AI service public URL.
`FRONTEND_URL` = your exact Vercel frontend URL.

5. Railway settings needed:
- Use the `backend` folder as the service root.
- Keep `PORT` set to `4000` or let Railway inject its own port if you prefer, but this code supports Railway's `PORT`.
- Add Railway Postgres and Redis as linked services.

6. CORS settings fixed or not:
Yes. The backend now allows the Vercel frontend origin plus Railway public domains and localhost during development.

==================================================
AI SERVICE (RAILWAY)
==================================================

1. Folder to deploy:
ai-service

2. Start command:
uvicorn main:app --host 0.0.0.0 --port $PORT

3. Requirements/packages:
Use `requirements.txt` in `ai-service`.

4. Environment variables:
GROQ_API_KEY=<your-groq-api-key>
HUGGINGFACE_API_KEY=<your-huggingface-api-key>
BACKEND_URL=https://<your-backend>.up.railway.app
CHROMA_HOST=<your-chroma-hostname>
CHROMA_PORT=8000
CHROMA_PERSIST_DIR=./.chroma

What to paste:
`GROQ_API_KEY` = your Groq API key.
`HUGGINGFACE_API_KEY` = your Hugging Face inference key.
`BACKEND_URL` = Railway backend public URL.
`CHROMA_HOST` = hostname of your Chroma service, without `https://`.
`CHROMA_PORT` = Chroma HTTP port.
`CHROMA_PERSIST_DIR` = local fallback folder for development.

==================================================
DATABASE SETUP
==================================================

Which database is used:
- PostgreSQL for the main app data.
- Redis for queues, jobs, and workers.
- Chroma for vector storage.

How to connect it:
- Paste Railway PostgreSQL URL into backend `DATABASE_URL`.
- Paste Railway Redis URL into backend `REDIS_URL`.
- Paste Chroma host/port into AI service `CHROMA_HOST` and `CHROMA_PORT`.

Where to paste DB URL:
- Railway backend service environment variables.

Migration commands:
- `npm run prisma:push` on the backend after `DATABASE_URL` is set.
- Use `npm run prisma:migrate` only if you are intentionally creating local migrations.

Seed commands if needed:
- `npm run prisma:seed` from the backend.

==================================================
FINAL DEPLOYMENT ORDER
==================================================

1. Deploy backend on Railway.
2. Deploy AI service on Railway.
3. Create/connect Postgres, Redis, and Chroma.
4. Deploy frontend on Vercel.
5. Paste final URLs into env vars and test login, chat, repo integration, and team pages.

==================================================
IMPORTANT
==================================================

- Frontend is Vercel only now.
- Backend/AI remain Railway.
- Remove old local or tunnel URLs from production env vars.
- Use exact public URLs, not internal Railway service names, for cross-service calls.
