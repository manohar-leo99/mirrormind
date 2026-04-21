from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.review import ReviewRequest, ReviewResponse
from app.services.prReviewer import review_pr
from app.services.rateLimiter import limiter

router = APIRouter(prefix="", tags=["review"])


async def _run_review(payload: ReviewRequest) -> ReviewResponse:
    result = await review_pr(
        team_id=payload.team_id,
        pr_title=payload.pr_title,
        pr_diff=payload.pr_diff,
    )
    return ReviewResponse(**result)


@router.post("/review", response_model=ReviewResponse)
async def review(payload: ReviewRequest):
    allowed, retry_after = await limiter.acquire(
        key=f"review:{payload.team_id}",
        max_requests=60,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry in {retry_after:.1f}s",
        )

    return await _run_review(payload)


@router.post("/review-pr", response_model=ReviewResponse)
async def review_pr_alias(payload: ReviewRequest):
    return await review(payload)
