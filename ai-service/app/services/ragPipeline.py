from __future__ import annotations

import asyncio
from typing import Any, AsyncGenerator

from langchain_core.documents import Document

from app.services.embeddingService import get_embedding
from app.services.llmService import generate_answer_stream
from app.services.vectorStore import search_similar


def _build_context_chunks(
    results: dict[str, Any],
    base_threshold: float = 0.95,
    max_chunks: int = 12,
    max_chunks_per_source: int = 3,
) -> list[dict[str, Any]]:
    documents = results.get("documents", [[]])
    metadatas = results.get("metadatas", [[]])
    distances = results.get("distances", [[]])

    chunks: list[dict[str, Any]] = []
    if not documents or not documents[0]:
        return chunks

    for doc, metadata, distance in zip(documents[0], metadatas[0], distances[0]):
        if not doc:
            continue

        score = float(distance) if distance is not None else 1.0
        chunks.append(
            {
                "document": doc,
                "metadata": metadata or {},
                "distance": score,
            }
        )

    chunks.sort(key=lambda item: item["distance"])
    if not chunks:
        return []

    best_distance = chunks[0]["distance"]
    adaptive_threshold = min(base_threshold, best_distance + 0.35)

    filtered = [
        chunk for chunk in chunks if chunk["distance"] <= adaptive_threshold
    ]

    diversified: list[dict[str, Any]] = []
    per_source_counts: dict[str, int] = {}
    for chunk in filtered:
        metadata = chunk.get("metadata", {})
        source_id = str(
            metadata.get("source_id")
            or metadata.get("source_url")
            or "unknown_source"
        )

        count = per_source_counts.get(source_id, 0)
        if count >= max_chunks_per_source:
            continue

        diversified.append(chunk)
        per_source_counts[source_id] = count + 1
        if len(diversified) >= max_chunks:
            break

    return diversified


def _to_langchain_documents(chunks: list[dict[str, Any]]) -> list[Document]:
    return [
        Document(
            page_content=chunk["document"],
            metadata=chunk.get("metadata", {}),
        )
        for chunk in chunks
    ]


async def query_rag(question: str, team_id: str) -> AsyncGenerator[dict[str, Any], None]:
    context_chunks: list[dict[str, Any]] = []

    try:
        question_embedding = await get_embedding(question)
        results = await asyncio.to_thread(search_similar, team_id, question_embedding, 20)
        context_chunks = _build_context_chunks(results)
    except Exception:
        # Fall back to a best-effort LLM answer when retrieval is unavailable.
        context_chunks = []

    context_docs = _to_langchain_documents(context_chunks)

    llm_chunks = [
        {"document": doc.page_content, "metadata": doc.metadata} for doc in context_docs
    ]

    async for token in generate_answer_stream(question, llm_chunks):
        yield {"type": "token", "content": token}

    sources: list[dict[str, str]] = []
    seen_source_ids: set[str] = set()
    for index, chunk in enumerate(context_chunks):
        metadata = chunk.get("metadata", {})
        source_id = str(metadata.get("source_id") or f"source_{index + 1}")
        if source_id in seen_source_ids:
            continue

        seen_source_ids.add(source_id)
        sources.append(
            {
                "id": source_id,
                "url": str(metadata.get("source_url") or "#"),
                "type": str(metadata.get("source_type") or "unknown"),
                "author": str(metadata.get("author") or "unknown"),
                "preview": chunk["document"][:220],
            }
        )

    yield {"type": "done", "sources": sources}
