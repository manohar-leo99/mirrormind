# MirrorMind Frontend

Next.js 14 frontend for MirrorMind.

## Local Development

1. Copy `.env.example` to `.env.local`.
2. Set `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and the backend URL.
3. Run:

```bash
npm install
npm run dev
```

## Railway Deployment

1. Create a Railway service from the same GitHub repo.
2. Set the service root directory to `frontend`.
3. Use `frontend/railway.toml`.
4. Add the frontend environment variables listed in `DEPLOYMENT_CHECKLIST.md`.
5. Set the GitHub OAuth callback URL to `https://<your-frontend-domain>/api/auth/callback/github`.
