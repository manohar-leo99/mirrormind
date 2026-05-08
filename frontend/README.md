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

## Vercel Deployment

1. Connect this folder to Vercel as the frontend project.
2. Leave the build command as `npm run build`.
3. Leave the output directory empty.
4. Add the frontend environment variables listed in `DEPLOYMENT_CHECKLIST.md`.
5. Set the GitHub OAuth callback URL to `https://<your-project>.vercel.app/api/auth/callback/github`.
