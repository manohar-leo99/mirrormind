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
3. Deploy `backend/` to Railway.
4. Deploy `ai-service/` to Railway.
5. Create Railway Postgres, Redis, and ChromaDB services.
6. Copy the production env vars into Vercel and Railway.
7. Update the GitHub OAuth app callback URL.
8. Test `/health` on backend and AI service.
9. Test login, repo connect, chat, and PR review.

## Production URLs to set

- Frontend: `https://your-vercel-domain`
- Backend API: `https://your-railway-backend-domain`
- AI service: `https://your-railway-ai-domain`
- GitHub OAuth callback: `https://your-vercel-domain/api/auth/callback/github`

## Notes

- `frontend/vercel.json` is intentionally minimal because Vercel already detects Next.js.
- `backend/railway.toml` and `ai-service/railway.toml` pin the start commands for Railway.
- Do not deploy with localhost URLs in production env vars.
