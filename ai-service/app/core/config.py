from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    groq_api_key: str
    huggingface_api_key: str
    chroma_host: str
    chroma_port: int
    chroma_persist_dir: str
    backend_url: str
    hf_embedding_model: str
    groq_primary_model: str
    groq_fallback_model: str
    ingestion_max_commits: int
    ingestion_max_pull_requests: int
    ingestion_max_review_comments: int
    ingestion_max_code_files: int
    ingestion_max_file_bytes: int


_cached_settings: Settings | None = None


def get_settings() -> Settings:
    global _cached_settings
    if _cached_settings is None:
        _cached_settings = Settings(
            groq_api_key=os.getenv("GROQ_API_KEY", ""),
            huggingface_api_key=os.getenv("HUGGINGFACE_API_KEY", ""),
            chroma_host=os.getenv("CHROMA_HOST", "localhost"),
            chroma_port=int(os.getenv("CHROMA_PORT", "8001")),
            chroma_persist_dir=os.getenv("CHROMA_PERSIST_DIR", "./.chroma"),
            backend_url=os.getenv("BACKEND_URL", "http://localhost:4000"),
            hf_embedding_model=os.getenv(
                "HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
            ),
            groq_primary_model=os.getenv(
                "GROQ_PRIMARY_MODEL", "llama-3.3-70b-versatile"
            ),
            groq_fallback_model=os.getenv(
                "GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant"
            ),
            ingestion_max_commits=int(os.getenv("INGESTION_MAX_COMMITS", "500")),
            ingestion_max_pull_requests=int(
                os.getenv("INGESTION_MAX_PULL_REQUESTS", "200")
            ),
            ingestion_max_review_comments=int(
                os.getenv("INGESTION_MAX_REVIEW_COMMENTS", "20")
            ),
            ingestion_max_code_files=int(
                os.getenv("INGESTION_MAX_CODE_FILES", "80")
            ),
            ingestion_max_file_bytes=int(
                os.getenv("INGESTION_MAX_FILE_BYTES", "50000")
            ),
        )
    return _cached_settings
