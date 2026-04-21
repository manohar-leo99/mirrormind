from __future__ import annotations

from pydantic import BaseModel, Field


class ReviewRequest(BaseModel):
    pr_diff: str = Field(alias="prDiff")
    pr_title: str = Field(alias="prTitle")
    team_id: str = Field(alias="teamId")


class ReviewIssue(BaseModel):
    severity: str
    description: str
    suggestion: str | None = None
    line: int | None = None


class ReviewResponse(BaseModel):
    summary: str
    approved: bool
    issues: list[ReviewIssue]
