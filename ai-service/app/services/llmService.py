from __future__ import annotations

import asyncio
import json
import re
import threading
from typing import Any, AsyncGenerator

from groq import Groq

from app.core.config import get_settings
from app.core.errors import ServiceError


_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.groq_api_key:
            raise ServiceError("GROQ_API_KEY is not configured.", status_code=500)
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def _is_rate_limited(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    if status_code == 429:
        return True
    message = str(exc).lower()
    return "rate" in message and "limit" in message


def _is_model_unavailable(exc: Exception) -> bool:
    message = str(exc).lower()
    markers = (
        "model_decommissioned",
        "decommissioned",
        "no longer supported",
        "model not found",
        "unsupported model",
    )
    return any(marker in message for marker in markers)


def _should_try_fallback(exc: Exception) -> bool:
    return _is_rate_limited(exc) or _is_model_unavailable(exc)


def _candidate_models() -> list[str]:
    settings = get_settings()
    ordered = [
        settings.groq_primary_model,
        settings.groq_fallback_model,
        "llama-3.3-70b-versatile",
        "mixtral-8x7b-32768",
        "llama-3.1-8b-instant",
    ]
    seen: set[str] = set()
    models: list[str] = []
    for model in ordered:
        if model and model not in seen:
            seen.add(model)
            models.append(model)
    return models


def _stream_completion(model: str, system_prompt: str, user_prompt: str):
    client = _get_client()
    return client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        stream=True,
        max_tokens=1500,
        temperature=0.1,
    )


def _build_context(context_chunks: list[dict[str, Any]]) -> str:
    if not context_chunks:
        return "No relevant team context was retrieved."

    sections = []
    for chunk in context_chunks:
        metadata = chunk.get("metadata", {})
        sections.append(
            "\n".join(
                [
                    f"Source: {metadata.get('source_url', '')}",
                    f"Type: {metadata.get('source_type', '')}",
                    chunk.get("document", ""),
                ]
            )
        )
    return "\n\n---\n\n".join(sections)


async def generate_answer_stream(
    question: str,
    context_chunks: list[dict[str, Any]],
) -> AsyncGenerator[str, None]:
    context = _build_context(context_chunks)

    system_prompt = (
        "You are MirrorMind, an AI assistant with deep knowledge of this engineering team's "
        "codebase. Answer questions using only the provided context from the team's code, "
        "PRs, and discussions. Always cite sources. If context is insufficient, say so clearly."
    )
    user_prompt = (
        f"Context from team codebase:\n{context}\n\n"
        f"Developer question: {question}\n\n"
        "Provide a concise, accurate answer with practical guidance."
    )

    queue: asyncio.Queue[object] = asyncio.Queue()
    sentinel = object()
    loop = asyncio.get_running_loop()

    def worker() -> None:
        stream = None
        last_error: Exception | None = None
        try:
            models = _candidate_models()
            for index, model in enumerate(models):
                try:
                    stream = _stream_completion(model, system_prompt, user_prompt)
                    break
                except Exception as exc:  # pragma: no cover
                    last_error = exc
                    if index < len(models) - 1 and _should_try_fallback(exc):
                        continue
                    raise

            if stream is None:
                raise last_error or RuntimeError("No Groq model could be selected.")

            for chunk in stream:
                token = None
                if chunk.choices and chunk.choices[0].delta:
                    token = chunk.choices[0].delta.content
                if token:
                    loop.call_soon_threadsafe(queue.put_nowait, token)
        except Exception as exc:  # pragma: no cover
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, sentinel)

    threading.Thread(target=worker, daemon=True).start()

    while True:
        item = await queue.get()
        if item is sentinel:
            break
        if isinstance(item, Exception):
            raise ServiceError("Groq generation failed.", status_code=502, details=str(item))
        yield str(item)


def _review_once(model: str, pr_diff: str, pr_title: str, team_patterns: list[dict[str, Any]]) -> dict[str, Any]:
    context = "\n".join([pattern.get("document", "") for pattern in team_patterns[:5]])
    prompt = f"""You are a senior code reviewer for this engineering team.
Review the following pull request against established team patterns.

Team coding patterns:
{context}

Pull Request Title: {pr_title}
Pull Request Diff:
{pr_diff[:8000]}

Respond in JSON with this shape:
{{
  \"summary\": \"2-3 sentence assessment\",
  \"approved\": true,
  \"issues\": [
    {{
      \"severity\": \"error|warning|info\",
      \"description\": \"issue details\",
      \"suggestion\": \"fix guidance\",
      \"line\": null
    }}
  ]
}}
"""

    client = _get_client()
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1200,
        temperature=0.1,
    )

    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise ServiceError("Groq returned an empty review.", status_code=502)

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # Some models return markdown-wrapped JSON. Extract the first JSON object defensively.
        match = re.search(r"\{[\s\S]*\}", content)
        if not match:
            raise ServiceError(
                "Groq returned non-JSON PR review output.",
                status_code=502,
                details=content[:500],
            )
        data = json.loads(match.group(0))

    return {
        "summary": str(data.get("summary", "No summary provided.")),
        "approved": bool(data.get("approved", False)),
        "issues": data.get("issues", []),
    }


async def review_pull_request(
    pr_diff: str,
    pr_title: str,
    team_patterns: list[dict[str, Any]],
) -> dict[str, Any]:
    models = _candidate_models()
    last_error: Exception | None = None

    for index, model in enumerate(models):
        try:
            return await asyncio.to_thread(
                _review_once,
                model,
                pr_diff,
                pr_title,
                team_patterns,
            )
        except Exception as exc:
            last_error = exc
            if index < len(models) - 1 and _should_try_fallback(exc):
                continue
            raise ServiceError("Groq PR review failed.", status_code=502, details=str(exc))

    raise ServiceError(
        "Groq PR review failed.",
        status_code=502,
        details=str(last_error) if last_error else "No review model available.",
    )
