from __future__ import annotations

import asyncio
import hashlib
import time
from typing import Any

from github import Github, GithubException

from app.core.config import get_settings
from app.core.errors import ServiceError


SUPPORTED_CODE_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".java",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".cs",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".swift",
    ".kt",
    ".scala",
    ".sql",
    ".sh",
    ".yaml",
    ".yml",
    ".json",
    ".toml",
    ".ini",
    ".env",
    ".md",
}

SKIP_PATH_SEGMENTS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    "vendor",
    "target",
    "__pycache__",
    "venv",
    ".venv",
}


def _parse_repo_name(repo_url: str) -> str:
    normalized = repo_url.replace("https://github.com/", "").replace(".git", "").strip("/")
    parts = normalized.split("/")
    if len(parts) < 2:
        raise ServiceError("Invalid GitHub repository URL.", status_code=400)
    return f"{parts[0]}/{parts[1]}"


def _is_supported_source_file(path: str) -> bool:
    normalized = path.strip().lower()
    if not normalized:
        return False

    wrapped = f"/{normalized}/"
    for segment in SKIP_PATH_SEGMENTS:
        if f"/{segment}/" in wrapped:
            return False

    if normalized.endswith(".min.js") or normalized.endswith(".min.css"):
        return False

    dot_index = normalized.rfind(".")
    if dot_index <= 0:
        return False

    extension = normalized[dot_index:]
    return extension in SUPPORTED_CODE_EXTENSIONS


def _safe_decode_file_content(raw_bytes: bytes) -> str:
    return raw_bytes.decode("utf-8", errors="ignore")


def _collect_repo_files(
    repo: Any,
    repo_name: str,
    branch_name: str,
    max_files: int,
    max_file_bytes: int,
) -> list[dict[str, Any]]:
    try:
        branch_sha = repo.get_branch(branch_name).commit.sha
        tree = repo.get_git_tree(branch_sha, recursive=True)
    except Exception:
        return []

    candidates: list[tuple[str, int]] = []
    for item in tree.tree:
        if getattr(item, "type", "") != "blob":
            continue

        path = getattr(item, "path", "")
        if not _is_supported_source_file(path):
            continue

        size = int(getattr(item, "size", 0) or 0)
        if size <= 0 or size > max_file_bytes:
            continue

        candidates.append((path, size))
        if len(candidates) >= max_files:
            break

    files: list[dict[str, Any]] = []
    for path, _size in candidates:
        try:
            content_file = repo.get_contents(path, ref=branch_name)
            if isinstance(content_file, list):
                continue

            decoded = _safe_decode_file_content(content_file.decoded_content)
            if not decoded.strip():
                continue

            files.append(
                {
                    "path": path,
                    "url": f"https://github.com/{repo_name}/blob/{branch_name}/{path}",
                    "source_id": f"file_{hashlib.sha1(path.encode()).hexdigest()[:12]}",
                    "content": decoded,
                }
            )
        except Exception:
            continue

    return files


def _fetch_github_data_sync(repo_url: str, github_token: str) -> dict[str, Any]:
    settings = get_settings()
    repo_name = _parse_repo_name(repo_url)

    client = Github(github_token, per_page=100, retry=0)
    attempted_public_fallback = False

    retries = 3
    for attempt in range(retries):
        try:
            repo = client.get_repo(repo_name)
            break
        except GithubException as exc:
            if exc.status in (401, 404) and not attempted_public_fallback:
                # Fallback for public repos when token is missing/expired.
                client = Github(per_page=100, retry=0)
                attempted_public_fallback = True
                continue

            if exc.status == 403:
                message = str(exc)
                details = getattr(exc, "data", None)
                if isinstance(details, dict) and isinstance(details.get("message"), str):
                    message = details["message"]

                if "rate limit" in message.lower():
                    # A deterministic failure is better than hanging for GithubRetry backoff windows.
                    raise ServiceError(
                        "GitHub API rate limit exceeded. Try again later or provide a valid GitHub token.",
                        status_code=429,
                    )

            if exc.status == 404:
                if attempted_public_fallback:
                    raise ServiceError("Repository not found or private access denied.", status_code=404)
                raise ServiceError("GitHub token or repository is invalid.", status_code=400)

            if exc.status == 403 and attempt < retries - 1:
                time.sleep(2**attempt)
                continue
            raise ServiceError("GitHub API request failed.", status_code=502, details=str(exc))
    else:
        raise ServiceError("GitHub API unavailable.", status_code=503)

    data: dict[str, Any] = {
        "repo_name": repo_name,
        "default_branch": repo.default_branch or "main",
        "commits": [],
        "pull_requests": [],
        "readme": "",
        "files": [],
    }

    commit_limit = settings.ingestion_max_commits
    for idx, commit in enumerate(repo.get_commits()):
        if idx >= commit_limit:
            break
        data["commits"].append(
            {
                "sha": commit.sha[:8],
                "message": commit.commit.message,
                "author": commit.commit.author.name if commit.commit.author else "unknown",
                "date": str(commit.commit.author.date) if commit.commit.author else "",
                "url": commit.html_url,
                "source_id": f"commit_{commit.sha[:12]}",
            }
        )

    pr_limit = settings.ingestion_max_pull_requests
    comment_limit = settings.ingestion_max_review_comments
    should_fetch_review_comments = not attempted_public_fallback
    for idx, pr in enumerate(repo.get_pulls(state="all", sort="updated")):
        if idx >= pr_limit:
            break

        pr_data: dict[str, Any] = {
            "number": pr.number,
            "title": pr.title,
            "body": pr.body or "",
            "author": pr.user.login if pr.user else "unknown",
            "state": pr.state,
            "created_at": str(pr.created_at),
            "url": pr.html_url,
            "comments": [],
            "source_id": f"pr_{pr.number}",
        }

        if should_fetch_review_comments:
            for c_idx, comment in enumerate(pr.get_review_comments()):
                if c_idx >= comment_limit:
                    break
                pr_data["comments"].append(
                    {
                        "author": comment.user.login if comment.user else "unknown",
                        "body": comment.body,
                        "path": comment.path,
                    }
                )

        data["pull_requests"].append(pr_data)

    try:
        readme = repo.get_readme()
        data["readme"] = readme.decoded_content.decode("utf-8")
    except Exception:
        data["readme"] = ""

    data["files"] = _collect_repo_files(
        repo=repo,
        repo_name=repo_name,
        branch_name=data["default_branch"],
        max_files=settings.ingestion_max_code_files,
        max_file_bytes=settings.ingestion_max_file_bytes,
    )

    return data


async def fetch_github_data(repo_url: str, github_token: str) -> dict[str, Any]:
    return await asyncio.to_thread(_fetch_github_data_sync, repo_url, github_token)


def build_ingestion_documents(payload: dict[str, Any]) -> list[dict[str, Any]]:
    repo_name = payload["repo_name"]
    docs: list[dict[str, Any]] = []

    if payload.get("readme"):
        docs.append(
            {
                "source_type": "readme",
                "source_id": f"readme_{hashlib.sha1(repo_name.encode()).hexdigest()[:12]}",
                "source_url": f"https://github.com/{repo_name}",
                "author": "",
                "date": "",
                "repo_name": repo_name,
                "content": payload["readme"],
            }
        )

    for commit in payload.get("commits", []):
        docs.append(
            {
                "source_type": "commit",
                "source_id": commit["source_id"],
                "source_url": commit["url"],
                "author": commit["author"],
                "date": commit["date"],
                "repo_name": repo_name,
                "content": commit["message"],
            }
        )

    for pr in payload.get("pull_requests", []):
        comment_blob = "\n".join(
            [
                f"[{c['author']} on {c.get('path', 'unknown')}] {c['body']}"
                for c in pr.get("comments", [])
            ]
        )
        content = (
            f"PR #{pr['number']}: {pr['title']}\n"
            f"State: {pr['state']}\n"
            f"Body:\n{pr['body']}\n\n"
            f"Review Comments:\n{comment_blob}"
        )
        docs.append(
            {
                "source_type": "pr",
                "source_id": pr["source_id"],
                "source_url": pr["url"],
                "author": pr["author"],
                "date": pr["created_at"],
                "repo_name": repo_name,
                "content": content,
            }
        )

    for repo_file in payload.get("files", []):
        file_path = repo_file.get("path", "unknown")
        file_content = repo_file.get("content", "")
        docs.append(
            {
                "source_type": "file",
                "source_id": repo_file.get("source_id", f"file_{file_path}"),
                "source_url": repo_file.get("url", f"https://github.com/{repo_name}"),
                "author": "",
                "date": "",
                "repo_name": repo_name,
                "content": f"File: {file_path}\n\n{file_content}",
            }
        )

    return docs
