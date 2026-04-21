from __future__ import annotations

import asyncio
from typing import Any

from app.services.embeddingService import get_embedding
from app.services.llmService import review_pull_request
from app.services.vectorStore import search_similar


def _extract_team_patterns(search_results: dict[str, Any]) -> list[dict[str, Any]]:
    docs = search_results.get("documents", [[]])
    metadatas = search_results.get("metadatas", [[]])
    distances = search_results.get("distances", [[]])

    patterns: list[dict[str, Any]] = []
    if not docs or not docs[0]:
        return patterns

    for doc, metadata, distance in zip(docs[0], metadatas[0], distances[0]):
        if distance is not None and float(distance) > 0.85:
            continue
        patterns.append({"document": doc, "metadata": metadata or {}})

    return patterns[:10]


async def review_pr(team_id: str, pr_title: str, pr_diff: str) -> dict[str, Any]:
    review_embedding = await get_embedding(f"{pr_title}\n{pr_diff[:4000]}")
    search_results = await asyncio.to_thread(search_similar, team_id, review_embedding, 15)
    team_patterns = _extract_team_patterns(search_results)

    review = await review_pull_request(
        pr_diff=pr_diff,
        pr_title=pr_title,
        team_patterns=team_patterns,
    )

    issues = review.get("issues", [])
    normalized_issues: list[dict[str, Any]] = []
    for issue in issues:
        normalized_issues.append(
            {
                "severity": str(issue.get("severity", "info")),
                "description": str(issue.get("description", "No description provided.")),
                "suggestion": issue.get("suggestion"),
                "line": issue.get("line"),
            }
        )

    return {
        "summary": str(review.get("summary", "No summary provided.")),
        "approved": bool(review.get("approved", False)),
        "issues": normalized_issues,
    }
