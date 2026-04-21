from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def acquire(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, float]:
        now = time.time()
        async with self._lock:
            bucket = self._events[key]
            cutoff = now - window_seconds
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= max_requests:
                retry_after = window_seconds - (now - bucket[0])
                return False, max(retry_after, 0.0)

            bucket.append(now)
            return True, 0.0


limiter = InMemoryRateLimiter()
