# MirrorMind Railway Deployment

Deploy everything in one Railway project with separate services for the frontend, backend, AI service, PostgreSQL, Redis, and ChromaDB.

## Service Layout

1. Frontend service root: `frontend`
2. Backend service root: `backend`
3. AI service root: `ai-service`
4. PostgreSQL: Railway managed database service
5. Redis: Railway managed Redis service
6. ChromaDB: Railway service or container running Chroma over HTTP

## Deployment Order

1. Push the repo to GitHub.
2. Create a Railway project from this repo.
3. Add PostgreSQL and Redis to the project.
4. Add ChromaDB to the project.
5. Deploy the backend service first.
6. Deploy the AI service second.
7. Deploy the frontend service last.
8. Set the GitHub OAuth callback and webhook URLs.
9. Run the one-time Prisma schema push for the backend.
10. Test `/health`, login, repo connect, chat, and PR review.

## URLs You Will Copy Between Services

1. Frontend public URL: `https://<your-frontend-service>.up.railway.app`
2. Backend public URL: `https://<your-backend-service>.up.railway.app`
3. AI service public URL: `https://<your-ai-service>.up.railway.app`
4. GitHub OAuth callback: `https://<your-frontend-service>.up.railway.app/api/auth/callback/github`
5. GitHub webhook URL: `https://<your-backend-service>.up.railway.app/api/webhooks/github`

## Frontend Environment Variables

Use this format in the Railway frontend service:

```env
NEXTAUTH_URL=https://<your-frontend-service>.up.railway.app
NEXTAUTH_SECRET=<your-long-random-secret>
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
BACKEND_URL=https://<your-backend-service>.up.railway.app
NEXT_PUBLIC_API_URL=https://<your-backend-service>.up.railway.app
```

## Backend Environment Variables

Use this format in the Railway backend service:

```env
DATABASE_URL=<railway-postgres-connection-string>
REDIS_URL=<railway-redis-connection-string>
JWT_SECRET=<your-long-random-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
GITHUB_WEBHOOK_SECRET=<your-github-webhook-secret>
AI_SERVICE_URL=https://<your-ai-service>.up.railway.app
FRONTEND_URL=https://<your-frontend-service>.up.railway.app
SCHEDULED_SYNC_GITHUB_TOKEN=<optional-github-token>
```

## AI Service Environment Variables

Use this format in the Railway AI service:

```env
GROQ_API_KEY=<your-groq-api-key>
HUGGINGFACE_API_KEY=<your-huggingface-api-key>
BACKEND_URL=https://<your-backend-service>.up.railway.app
CHROMA_HOST=<your-chroma-service-hostname>
CHROMA_PORT=8000
CHROMA_PERSIST_DIR=./.chroma
```

## Database Setup

1. Copy the Railway PostgreSQL connection string into `DATABASE_URL` on the backend.
2. Copy the Railway Redis connection string into `REDIS_URL` on the backend.
3. If you run Chroma as a separate Railway service, copy its hostname into `CHROMA_HOST` and its HTTP port into `CHROMA_PORT`.
4. Run `npm run prisma:push` once in the backend service after `DATABASE_URL` is set so the schema exists.

## Important Notes

1. Do not use localhost URLs in production Railway variables.
2. `BACKEND_URL` is the preferred frontend URL variable. `NEXT_PUBLIC_API_URL` is optional and can mirror the same backend URL.
3. The frontend and backend GitHub client ID/secret values should match the same GitHub OAuth app.
4. The AI service must be online for chat, ingestion, and PR review to work.
