from __future__ import annotations

import time
from collections import defaultdict


class FixedWindowLimiter:
    """In-memory fixed-window counter (dev / single-node)."""

    def __init__(self) -> None:
        self._buckets: dict[str, tuple[float, int]] = {}

    def allow(self, key: str, limit: int, window_sec: float) -> bool:
        now = time.monotonic()
        start, count = self._buckets.get(key, (now, 0))
        if now - start >= window_sec:
            self._buckets[key] = (now, 1)
            return True
        if count >= limit:
            return False
        self._buckets[key] = (start, count + 1)
        return True


edge_limiter = FixedWindowLimiter()
