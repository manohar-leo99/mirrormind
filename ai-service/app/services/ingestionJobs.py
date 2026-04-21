from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from uuid import uuid4

from app.models.ingest import IngestStatusResponse


@dataclass(frozen=True)
class IngestionJob:
    job_id: str
    team_id: str
    repo_url: str
    status: str
    items_processed: int
    total_items: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime


_jobs: dict[str, IngestionJob] = {}
_jobs_lock = asyncio.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_job(team_id: str, repo_url: str) -> IngestionJob:
    timestamp = _now()
    job = IngestionJob(
        job_id=str(uuid4()),
        team_id=team_id,
        repo_url=repo_url,
        status="pending",
        items_processed=0,
        total_items=0,
        error_message=None,
        created_at=timestamp,
        updated_at=timestamp,
    )
    async with _jobs_lock:
        _jobs[job.job_id] = job
    return job


async def get_job(job_id: str) -> IngestionJob | None:
    async with _jobs_lock:
        return _jobs.get(job_id)


async def update_job(job_id: str, **changes: object) -> IngestionJob:
    async with _jobs_lock:
        current = _jobs[job_id]
        updated = replace(current, updated_at=_now(), **changes)
        _jobs[job_id] = updated
        return updated


async def mark_running(job_id: str) -> IngestionJob:
    return await update_job(job_id, status="running", error_message=None)


async def update_progress(job_id: str, items_processed: int, total_items: int) -> IngestionJob:
    return await update_job(
        job_id,
        status="running",
        items_processed=items_processed,
        total_items=total_items,
    )


async def mark_completed(job_id: str, items_processed: int, total_items: int) -> IngestionJob:
    return await update_job(
        job_id,
        status="completed",
        items_processed=items_processed,
        total_items=total_items,
        error_message=None,
    )


async def mark_failed(job_id: str, error_message: str) -> IngestionJob:
    return await update_job(job_id, status="failed", error_message=error_message)


def to_response(job: IngestionJob) -> IngestStatusResponse:
    return IngestStatusResponse(
        jobId=job.job_id,
        teamId=job.team_id,
        repoUrl=job.repo_url,
        status=job.status,
        itemsProcessed=job.items_processed,
        totalItems=job.total_items,
        errorMessage=job.error_message,
        createdAt=job.created_at,
        updatedAt=job.updated_at,
    )
