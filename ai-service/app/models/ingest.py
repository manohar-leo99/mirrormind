from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    repo_url: str = Field(alias="repoUrl")
    team_id: str = Field(alias="teamId")
    github_token: str = Field(alias="githubToken")
    is_full_sync: bool = Field(default=True, alias="isFullSync")


class IngestStartResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    status: str


class IngestStatusResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    team_id: str = Field(alias="teamId")
    repo_url: str = Field(alias="repoUrl")
    status: str
    items_processed: int = Field(alias="itemsProcessed")
    total_items: int = Field(alias="totalItems")
    error_message: str | None = Field(default=None, alias="errorMessage")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class TeamDeleteResponse(BaseModel):
    success: bool
    team_id: str = Field(alias="teamId")
