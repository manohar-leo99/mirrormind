from __future__ import annotations

from typing import Any

import chromadb

from app.core.config import get_settings
from app.core.errors import ServiceError


_client: chromadb.ClientAPI | None = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        settings = get_settings()
        try:
            remote_client = chromadb.HttpClient(
                host=settings.chroma_host,
                port=settings.chroma_port,
            )
            remote_client.heartbeat()
            _client = remote_client
        except Exception:
            # Local fallback keeps ingestion/query functional in dev if remote Chroma is down.
            _client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return _client


def get_team_collection(team_id: str):
    if not team_id.strip():
        raise ServiceError("team_id is required.", status_code=400)

    client = _get_client()
    return client.get_or_create_collection(
        name=f"team_{team_id}",
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(team_id: str, chunks: list[dict[str, Any]]) -> None:
    if not chunks:
        return

    collection = get_team_collection(team_id)
    try:
        collection.upsert(
            ids=[c["id"] for c in chunks],
            embeddings=[c["embedding"] for c in chunks],
            documents=[c["content"] for c in chunks],
            metadatas=[c["metadata"] for c in chunks],
        )
    except Exception as exc:  # pragma: no cover - network and external service failures
        raise ServiceError("Failed to store vectors in ChromaDB.", status_code=502, details=str(exc))


def search_similar(team_id: str, query_embedding: list[float], n_results: int = 20):
    collection = get_team_collection(team_id)
    try:
        return collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as exc:  # pragma: no cover
        raise ServiceError("Failed to query vectors from ChromaDB.", status_code=502, details=str(exc))


def delete_team_data(team_id: str) -> None:
    client = _get_client()
    try:
        client.delete_collection(name=f"team_{team_id}")
    except Exception:
        # If collection does not exist, treat as idempotent success.
        return


def delete_repo_chunks(team_id: str, repo_name: str) -> None:
    collection = get_team_collection(team_id)
    try:
        collection.delete(where={"repo_name": repo_name})
    except Exception:
        # Treat missing filters or empty collections as no-op.
        return


def chromadb_health() -> dict[str, str]:
    try:
        client = _get_client()
        client_type = type(client).__name__
        # Ensure we can perform a minimal API call on the active client.
        client.heartbeat()
        return {
            "status": "connected",
            "client": client_type,
        }
    except Exception as exc:  # pragma: no cover
        return {
            "status": "disconnected",
            "error": str(exc),
        }
