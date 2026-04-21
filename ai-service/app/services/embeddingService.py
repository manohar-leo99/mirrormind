from __future__ import annotations

import asyncio
import threading
from typing import Callable

import httpx
from sentence_transformers import SentenceTransformer

from app.core.config import get_settings
from app.core.errors import ServiceError


_local_model: SentenceTransformer | None = None
_local_model_lock = threading.Lock()
_HF_API_BASE = "https://api-inference.huggingface.co/models"
_hf_disabled = False


def _get_local_model() -> SentenceTransformer:
    global _local_model
    if _local_model is None:
        with _local_model_lock:
            if _local_model is None:
                settings = get_settings()
                _local_model = SentenceTransformer(settings.hf_embedding_model)
    return _local_model


def _normalize_embedding(payload: object) -> list[float] | None:
    if isinstance(payload, list) and payload:
        if isinstance(payload[0], list):
            return [float(value) for value in payload[0]]
        if isinstance(payload[0], (float, int)):
            return [float(value) for value in payload]
    return None


async def _hf_embedding(text: str) -> list[float] | None:
    global _hf_disabled

    if _hf_disabled:
        return None

    settings = get_settings()
    if not settings.huggingface_api_key:
        _hf_disabled = True
        return None

    model = settings.hf_embedding_model
    url = f"{_HF_API_BASE}/{model}"
    headers = {"Authorization": f"Bearer {settings.huggingface_api_key}"}

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json={"inputs": text, "options": {"wait_for_model": True}},
                )

            if response.status_code == 200:
                normalized = _normalize_embedding(response.json())
                if normalized is not None:
                    return normalized

            if response.status_code in (429, 503):
                await asyncio.sleep(2**attempt)
                continue

            if response.status_code in (401, 403, 404):
                _hf_disabled = True
                return None

            return None
        except httpx.HTTPError:
            await asyncio.sleep(2**attempt)

    return None


async def get_embedding(text: str) -> list[float]:
    cleaned = text.strip()
    if not cleaned:
        raise ServiceError("Text cannot be empty for embedding.", status_code=400)

    from_hf = await _hf_embedding(cleaned)
    if from_hf is not None:
        return from_hf

    model = _get_local_model()
    return await asyncio.to_thread(
        lambda: model.encode(cleaned, normalize_embeddings=True).tolist()
    )


async def get_embeddings_batch(
    texts: list[str],
    progress_callback: Callable[[int, int], asyncio.Future | None] | None = None,
) -> list[list[float]]:
    if not texts:
        return []

    results: list[list[float]] = []
    total = len(texts)

    for start in range(0, total, 32):
        batch = texts[start : start + 32]
        batch_embeddings = await asyncio.gather(*[get_embedding(text) for text in batch])
        results.extend(batch_embeddings)

        if progress_callback is not None:
            maybe_awaitable = progress_callback(len(results), total)
            if maybe_awaitable is not None:
                await maybe_awaitable

    return results
