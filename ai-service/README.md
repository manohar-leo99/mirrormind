# MirrorMind AI Service

FastAPI microservice for MirrorMind ingestion, query, embeddings, and PR review.

## Railway deployment

Deploy this as a separate Railway service from the same GitHub repo.

1. Create a new Railway service in the existing MirrorMind project.
2. Set the service root directory to `ai-service`.
3. Use the included `ai-service/railway.toml`.
4. Add these environment variables:
   - `GROQ_API_KEY`
   - `HUGGINGFACE_API_KEY`
   - `BACKEND_URL` = your Railway backend public URL
   - `CHROMA_HOST` = your Railway Chroma host or private service hostname
   - `CHROMA_PORT` = your Railway Chroma port, usually `8000` for the service container
   - `CHROMA_PERSIST_DIR` = optional local fallback path for development only
5. Confirm the service exposes `/health`.

## Local development

Copy `.env.example` to `.env` and fill in the required values.

Run the service with:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Notes

- This service must be deployed separately from the Node backend.
- MirrorChat, ingestion, and PR review depend on this service being online.
