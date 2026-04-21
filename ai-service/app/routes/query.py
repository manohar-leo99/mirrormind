from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.query import EmbedRequest, EmbedResponse, QueryRequest
from app.services.embeddingService import get_embedding, get_embeddings_batch
from app.services.ragPipeline import query_rag
from app.services.rateLimiter import limiter

router = APIRouter(prefix="", tags=["query"])


@router.post("/embed", response_model=EmbedResponse)
async def embed(payload: EmbedRequest):
    source_texts = payload.texts if payload.texts else [payload.text]  # type: ignore[list-item]

    allowed, retry_after = await limiter.acquire(
        key="embed:global",
        max_requests=300,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry in {retry_after:.1f}s",
        )

    if len(source_texts) == 1:
        embedding = await get_embedding(source_texts[0])
        return EmbedResponse(embeddings=[embedding])

    embeddings = await get_embeddings_batch(source_texts)
    return EmbedResponse(embeddings=embeddings)


@router.post("/query")
async def query(payload: QueryRequest):
    allowed, retry_after = await limiter.acquire(
        key=f"query:{payload.team_id}",
        max_requests=120,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry in {retry_after:.1f}s",
        )

    async def event_stream():
        try:
            async for event in query_rag(payload.question, payload.team_id):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            error_event = {"type": "error", "error": str(exc)}
            done_event = {"type": "done", "sources": []}
            yield f"data: {json.dumps(error_event)}\n\n"
            yield f"data: {json.dumps(done_event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
