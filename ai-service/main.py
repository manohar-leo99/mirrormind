from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.errors import add_exception_handlers
from app.routes.ingest import router as ingest_router
from app.routes.query import router as query_router
from app.routes.review import router as review_router
from app.services.vectorStore import chromadb_health

project_root = Path(__file__).resolve().parents[1]
load_dotenv(project_root / ".env")
load_dotenv(Path(__file__).resolve().with_name(".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

app = FastAPI(
    title="MirrorMind AI Service",
    version="1.0.0",
    description="FastAPI microservice for embeddings, RAG query, ingestion, and PR review.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_exception_handlers(app)

app.include_router(ingest_router)
app.include_router(query_router)
app.include_router(review_router)


@app.get("/health")
async def health_check():
    chroma = await asyncio.to_thread(chromadb_health)
    overall_status = "ok" if chroma.get("status") == "connected" else "degraded"
    return {
        "status": overall_status,
        "chromadb": chroma.get("status"),
        "chromadbClient": chroma.get("client"),
    }
