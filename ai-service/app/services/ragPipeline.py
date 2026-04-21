from __future__ import annotations

import asyncio
from typing import Any, AsyncGenerator

from langchain_core.documents import Document

from app.services.embeddingService import get_embedding
from app.services.llmService import generate_answer_stream
from app.services.vectorStore import search_similar


def _build_context_chunks(results: dict[str, Any], threshold: float = 0.7) -> list[dict[str, Any]]:
    documents = results.get("documents", [[]])
    metadatas = results.get("metadatas", [[]])
    distances = results.get("distances", [[]])

    chunks: list[dict[str, Any]] = []
    if not documents or not documents[0]:
        return chunks

    for doc, metadata, distance in zip(documents[0], metadatas[0], distances[0]):
        if distance is not None and float(distance) >= threshold:
            continue
        chunks.append(
            {
                "document": doc,
                "metadata": metadata or {},
                "distance": float(distance) if distance is not None else 1.0,
            }
        )

    chunks.sort(key=lambda item: item["distance"])
    return chunks[:10]


def _to_langchain_documents(chunks: list[dict[str, Any]]) -> list[Document]:
    return [
        Document(
            page_content=chunk["document"],
            metadata=chunk.get("metadata", {}),
        )
        for chunk in chunks
    ]


async def query_rag(question: str, team_id: str) -> AsyncGenerator[dict[str, Any], None]:
    question_embedding = await get_embedding(question)
    results = await asyncio.to_thread(search_similar, team_id, question_embedding, 20)

    context_chunks = _build_context_chunks(results)
    context_docs = _to_langchain_documents(context_chunks)

    if not context_docs:
        yield {
            "type": "token",
            "content": "I could not find relevant indexed context for this team yet. Try ingesting more repositories first.",
        }
        yield {"type": "done", "sources": []}
        return

    llm_chunks = [
        {"document": doc.page_content, "metadata": doc.metadata} for doc in context_docs
    ]

    async for token in generate_answer_stream(question, llm_chunks):
        yield {"type": "token", "content": token}

    sources = [
        {
            "url": chunk["metadata"].get("source_url", ""),
            "type": chunk["metadata"].get("source_type", ""),
            "author": chunk["metadata"].get("author", ""),
            "preview": chunk["document"][:200],
        }
        for chunk in context_chunks
    ]
    yield {"type": "done", "sources": sources}
