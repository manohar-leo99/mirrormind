from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.models.ingest import IngestRequest, IngestStartResponse, TeamDeleteResponse
from app.services.chunker import chunk_text
from app.services.embeddingService import get_embeddings_batch
from app.services.githubIngestion import build_ingestion_documents, fetch_github_data
from app.services.ingestionJobs import (
    create_job,
    get_job,
    mark_completed,
    mark_failed,
    mark_running,
    to_response,
    update_progress,
)
from app.services.rateLimiter import limiter
from app.services.vectorStore import add_chunks, delete_repo_chunks, delete_team_data

router = APIRouter(prefix="", tags=["ingestion"])


async def _run_ingestion(job_id: str, payload: IngestRequest) -> None:
    try:
        await mark_running(job_id)

        github_payload = await fetch_github_data(payload.repo_url, payload.github_token)
        documents = build_ingestion_documents(github_payload)

        if payload.is_full_sync:
            await asyncio.to_thread(
                delete_repo_chunks,
                payload.team_id,
                github_payload["repo_name"],
            )

        chunks: list[dict] = []
        for doc in documents:
            chunks.extend(
                chunk_text(
                    text=doc["content"],
                    source_metadata={
                        "source_type": doc["source_type"],
                        "source_id": doc["source_id"],
                        "source_url": doc["source_url"],
                        "author": doc.get("author", ""),
                        "date": doc.get("date", ""),
                        "repo_name": doc.get("repo_name", ""),
                    },
                )
            )

        total_items = len(chunks)
        if total_items == 0:
            await mark_completed(job_id, items_processed=0, total_items=0)
            return

        await update_progress(job_id, items_processed=0, total_items=total_items)

        processed = 0
        for start in range(0, total_items, 32):
            batch = chunks[start : start + 32]
            embeddings = await get_embeddings_batch([item["content"] for item in batch])
            for item, embedding in zip(batch, embeddings):
                item["embedding"] = embedding

            await asyncio.to_thread(add_chunks, payload.team_id, batch)
            processed += len(batch)
            await update_progress(job_id, items_processed=processed, total_items=total_items)

        await mark_completed(job_id, items_processed=processed, total_items=total_items)
    except Exception as exc:  # pragma: no cover
        await mark_failed(job_id, str(exc))


@router.post("/ingest", response_model=IngestStartResponse)
async def start_ingest(payload: IngestRequest, background_tasks: BackgroundTasks):
    allowed, retry_after = await limiter.acquire(
        key=f"ingest:{payload.team_id}",
        max_requests=30,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry in {retry_after:.1f}s",
        )

    job = await create_job(team_id=payload.team_id, repo_url=payload.repo_url)
    background_tasks.add_task(_run_ingestion, job.job_id, payload)
    return IngestStartResponse(jobId=job.job_id, status=job.status)


@router.get("/ingest/status/{job_id}")
async def get_ingest_status(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return to_response(job)


@router.delete("/ingest/{team_id}", response_model=TeamDeleteResponse)
async def delete_team_ingestion(team_id: str):
    await asyncio.to_thread(delete_team_data, team_id)
    return TeamDeleteResponse(success=True, teamId=team_id)
