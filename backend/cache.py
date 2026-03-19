"""
Experiment caching layer.

Uses Redis when available, falls back to an in-memory dict for local dev.
Cache key = SHA-256 hash of sorted config dict → cached best_val_accuracy.
"""

import hashlib
import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cache interface
# ---------------------------------------------------------------------------

class DictCache:
    """Thread-safe in-memory cache (used when Redis is not available)."""

    def __init__(self):
        self._store: dict[str, tuple[Any, float | None]] = {}
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            self.misses += 1
            return None
        value, expires_at = entry
        if expires_at is not None and time.time() >= expires_at:
            del self._store[key]
            self.misses += 1
            return None
        self.hits += 1
        return value

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        expires_at = (time.time() + ttl) if ttl is not None else None
        self._store[key] = (value, expires_at)

    def exists(self, key: str) -> bool:
        return self.get(key) is not None

    def stats(self) -> dict:
        return {
            "backend": "memory",
            "keys": len(self._store),
            "hits": self.hits,
            "misses": self.misses,
        }


class RedisCache:
    """Redis-backed cache."""

    def __init__(self, url: str):
        import redis
        self._client = redis.from_url(url, decode_responses=True)
        self.hits = 0
        self.misses = 0
        self._url = url

    def get(self, key: str) -> Any | None:
        raw = self._client.get(key)
        if raw is None:
            self.misses += 1
            return None
        self.hits += 1
        return json.loads(raw)

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        payload = json.dumps(value)
        if ttl is None:
            self._client.set(key, payload)
            return

        if ttl <= 0:
            self._client.delete(key)
            return

        self._client.setex(key, ttl, payload)

    def exists(self, key: str) -> bool:
        return bool(self._client.exists(key))

    def stats(self) -> dict:
        info = self._client.info("keyspace")
        total_keys = sum(
            db_info.get("keys", 0) for db_info in info.values() if isinstance(db_info, dict)
        )
        return {
            "backend": "redis",
            "url": self._url,
            "keys": total_keys,
            "hits": self.hits,
            "misses": self.misses,
        }


# ---------------------------------------------------------------------------
# Config hashing
# ---------------------------------------------------------------------------

def config_cache_key(config: dict) -> str:
    """Deterministic SHA-256 hash of a training config dict."""
    normalised = json.dumps(config, sort_keys=True, default=str)
    return f"train:{hashlib.sha256(normalised.encode()).hexdigest()[:16]}"


# ---------------------------------------------------------------------------
# Singleton factory
# ---------------------------------------------------------------------------

_cache_instance: DictCache | RedisCache | None = None


def get_cache() -> DictCache | RedisCache:
    """Return the global cache instance (creates on first call)."""
    global _cache_instance
    if _cache_instance is not None:
        return _cache_instance

    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            _cache_instance = RedisCache(redis_url)
            # ping to verify connection
            _cache_instance._client.ping()
            logger.info(f"Cache: connected to Redis at {redis_url}")
        except Exception as exc:
            logger.warning(f"Cache: Redis unavailable ({exc}), falling back to memory")
            _cache_instance = DictCache()
    else:
        logger.info("Cache: no REDIS_URL set, using in-memory DictCache")
        _cache_instance = DictCache()

    return _cache_instance


def reset_cache() -> None:
    """Reset the global cache (used in tests)."""
    global _cache_instance
    _cache_instance = None
