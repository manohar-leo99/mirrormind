from __future__ import annotations

from typing import Any

import tiktoken


def chunk_text(
    text: str,
    source_metadata: dict[str, Any],
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[dict[str, Any]]:
    if not text.strip():
        return []

    encoding = tiktoken.get_encoding("cl100k_base")
    tokens = encoding.encode(text)
    chunks: list[dict[str, Any]] = []

    stride = max(chunk_size - overlap, 1)
    for i in range(0, len(tokens), stride):
        chunk_tokens = tokens[i : i + chunk_size]
        content = encoding.decode(chunk_tokens)

        chunk_id = f"{source_metadata['source_id']}_chunk_{i}"
        chunks.append(
            {
                "id": chunk_id,
                "content": content,
                "metadata": {
                    "source_type": source_metadata["source_type"],
                    "source_id": source_metadata["source_id"],
                    "source_url": source_metadata["source_url"],
                    "author": source_metadata.get("author", ""),
                    "date": source_metadata.get("date", ""),
                    "repo_name": source_metadata.get("repo_name", ""),
                },
            }
        )

    return chunks
