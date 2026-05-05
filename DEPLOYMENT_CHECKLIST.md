# MirrorMind Deployment Checklist

This repo follows the DOC6 path:

- Frontend on Vercel
- Backend on Railway
- AI service on Railway
- PostgreSQL on Railway
- Redis on Railway
- ChromaDB on Railway

## What I need from you

1. GitHub repo access is already in place by pushing this project to GitHub.
2. Your Vercel production URL after the frontend deploys.
3. Your Railway backend URL.
4. Your Railway AI service URL.
5. The final production values for these environment variables:
   - `NEXTAUTH_SECRET`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_WEBHOOK_SECRET`
   - `JWT_SECRET`
   - `GROQ_API_KEY`
   - `HUGGINGFACE_API_KEY`
6. The Railway connection strings for:
   - `DATABASE_URL`
   - `REDIS_URL`
7. The Railway Chroma host and port, if you expose Chroma separately.

## Deployment order

1. Push the repo to GitHub.
2. Deploy `frontend/` to Vercel.
3. Deploy `backend/` to Railway as one service.
4. Deploy `ai-service/` to Railway as a second service in the same project.
5. Create Railway Postgres, Redis, and ChromaDB services.
6. Copy the production env vars into Vercel and Railway.
7. Update the GitHub OAuth app callback URL.
8. Test `/health` on backend and AI service.
9. Test login, repo connect, chat, and PR review.

## Railway service layout

- Backend service root: `backend`
- AI service root: `ai-service`
- PostgreSQL: Railway managed database service
- Redis: Railway managed Redis service
- ChromaDB: Railway Docker service using `chromadb/chroma`

## Production URLs to set

- Frontend: `https://your-vercel-domain`
- Backend API: `https://your-railway-backend-domain`
- AI service: `https://your-railway-ai-domain`
- GitHub OAuth callback: `https://your-vercel-domain/api/auth/callback/github`

## Required environment variables by service

### Vercel frontend

- `NEXTAUTH_URL` = `https://your-vercel-domain`
- `NEXTAUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `BACKEND_URL` or `NEXT_PUBLIC_API_URL` = `https://your-railway-backend-domain`

### Railway backend

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_WEBHOOK_SECRET`
- `AI_SERVICE_URL` = `https://your-railway-ai-domain`
- `FRONTEND_URL` = `https://your-vercel-domain`

### Railway AI service

- `GROQ_API_KEY`
- `HUGGINGFACE_API_KEY`
- `BACKEND_URL` = `https://your-railway-backend-domain`
- `CHROMA_HOST` = Railway Chroma hostname
- `CHROMA_PORT` = Railway Chroma port

## Notes

- `frontend/vercel.json` is intentionally minimal because Vercel already detects Next.js.
- `backend/railway.toml` and `ai-service/railway.toml` pin the start commands for Railway.
- The backend cannot power MirrorChat by itself; the AI service must be deployed and reachable.
- Do not deploy with localhost URLs in production env vars.
