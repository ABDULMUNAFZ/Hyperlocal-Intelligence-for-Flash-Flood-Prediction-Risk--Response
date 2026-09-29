# FloodGuard Caching and Failure Handling
"""Retry logic, caching, timeout handling, and graceful degradation."""

import asyncio
import hashlib
import json
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Generic, List, Optional, TypeVar, Union
from functools import wraps

import redis.asyncio as redis
from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    base_delay: float = 1.0  # seconds
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True
    retryable_exceptions: tuple = (Exception,)
    retryable_status_codes: tuple = (429, 500, 502, 503, 504)


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5
    recovery_timeout: float = 60.0  # seconds
    half_open_max_calls: int = 3


class CircuitState(str):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Circuit breaker for external service calls."""

    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.half_open_calls = 0

    def record_success(self):
        self.failure_count = 0
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.config.half_open_max_calls:
                self.state = CircuitState.CLOSED
                self.success_count = 0
                logger.info(f"Circuit breaker {self.name} CLOSED")

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()

        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            logger.warning(f"Circuit breaker {self.name} OPEN (half-open failure)")
        elif self.state == CircuitState.CLOSED and self.failure_count >= self.config.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(f"Circuit breaker {self.name} OPEN (threshold reached)")

    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if self.last_failure_time:
                elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
                if elapsed >= self.config.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_calls = 0
                    self.success_count = 0
                    logger.info(f"Circuit breaker {self.name} HALF_OPEN")
                    return True
            return False
        if self.state == CircuitState.HALF_OPEN:
            return self.half_open_calls < self.config.half_open_max_calls
        return False

    def increment_half_open(self):
        self.half_open_calls += 1


class CacheEntry(BaseModel, Generic[T]):
    """Cached data entry with metadata."""
    data: T
    created_at: datetime
    expires_at: datetime
    source: str
    etag: Optional[str] = None
    hit_count: int = 0


class CacheManager:
    """Multi-level cache with Redis backend."""

    def __init__(self, redis_url: str = "redis://localhost:6379/0", default_ttl: int = 3600):
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self._redis: Optional[redis.Redis] = None
        self._local_cache: Dict[str, CacheEntry] = {}

    async def connect(self):
        self._redis = redis.from_url(self.redis_url, decode_responses=True)

    async def close(self):
        if self._redis:
            await self._redis.close()

    def _make_key(self, namespace: str, key: str) -> str:
        return f"floodguard:{namespace}:{key}"

    async def get(self, namespace: str, key: str, model: type = None) -> Optional[T]:
        """Get cached value."""
        full_key = self._make_key(namespace, key)

        # Try local cache first
        if full_key in self._local_cache:
            entry = self._local_cache[full_key]
            if entry.expires_at > datetime.utcnow():
                entry.hit_count += 1
                return entry.data
            else:
                del self._local_cache[full_key]

        # Try Redis
        if self._redis:
            try:
                data = await self._redis.get(full_key)
                if data:
                    entry = CacheEntry.model_validate_json(data)
                    if entry.expires_at > datetime.utcnow():
                        # Store in local cache for faster access
                        self._local_cache[full_key] = entry
                        return entry.data
                    else:
                        await self._redis.delete(full_key)
            except Exception as e:
                logger.warning(f"Cache get error for {full_key}: {e}")

        return None

    async def set(self, namespace: str, key: str, value: T, ttl: Optional[int] = None,
                  source: str = "unknown", etag: Optional[str] = None) -> bool:
        """Set cached value."""
        full_key = self._make_key(namespace, key)
        ttl = ttl or self.default_ttl
        expires_at = datetime.utcnow() + timedelta(seconds=ttl)

        entry = CacheEntry(
            data=value,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            source=source,
            etag=etag,
        )

        # Store in local cache
        self._local_cache[full_key] = entry

        # Store in Redis
        if self._redis:
            try:
                await self._redis.setex(full_key, ttl, entry.model_dump_json())
                return True
            except Exception as e:
                logger.warning(f"Cache set error for {full_key}: {e}")
                return False

        return True

    async def delete(self, namespace: str, key: str) -> bool:
        """Delete cached value."""
        full_key = self._make_key(namespace, key)
        self._local_cache.pop(full_key, None)
        if self._redis:
            try:
                await self._redis.delete(full_key)
                return True
            except Exception:
                pass
        return False

    async def clear_namespace(self, namespace: str) -> int:
        """Clear all keys in a namespace."""
        if self._redis:
            try:
                pattern = self._make_key(namespace, "*")
                keys = []
                async for key in self._redis.scan_iter(match=pattern):
                    keys.append(key)
                if keys:
                    await self._redis.delete(*keys)
                # Clear local cache
                to_delete = [k for k in self._local_cache if k.startswith(f"floodguard:{namespace}:")]
                for k in to_delete:
                    del self._local_cache[k]
                return len(keys)
            except Exception as e:
                logger.warning(f"Cache clear error for {namespace}: {e}")
        return 0


class ResilientHttpClient:
    """HTTP client with retry, circuit breaker, and caching."""

    def __init__(self, base_url: str, cache: Optional[CacheManager] = None,
                 retry_config: Optional[RetryConfig] = None,
                 circuit_breaker: Optional[CircuitBreaker] = None,
                 timeout: float = 30.0,
                 rate_limit: Optional[float] = None):
        self.base_url = base_url.rstrip("/")
        self.cache = cache
        self.retry_config = retry_config or RetryConfig()
        self.circuit_breaker = circuit_breaker
        self.timeout = timeout
        self.rate_limit = rate_limit
        self._last_request_time = 0.0
        self._session = None

    async def _get_session(self):
        import aiohttp
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def _respect_rate_limit(self):
        if self.rate_limit:
            elapsed = time.time() - self._last_request_time
            min_interval = 1.0 / self.rate_limit
            if elapsed < min_interval:
                await asyncio.sleep(min_interval - elapsed)
        self._last_request_time = time.time()

    def _is_retryable(self, exception: Exception, status: Optional[int] = None) -> bool:
        if isinstance(exception, self.retry_config.retryable_exceptions):
            return True
        if status and status in self.retry_config.retryable_status_codes:
            return True
        return False

    async def _execute_with_retry(self, func: Callable, *args, **kwargs) -> Any:
        last_exception = None

        for attempt in range(self.retry_config.max_attempts):
            if self.circuit_breaker and not self.circuit_breaker.can_execute():
                raise Exception(f"Circuit breaker {self.circuit_breaker.name} is OPEN")

            try:
                await self._respect_rate_limit()
                result = await func(*args, **kwargs)

                if self.circuit_breaker:
                    self.circuit_breaker.record_success()
                return result

            except Exception as e:
                last_exception = e
                if self.circuit_breaker:
                    self.circuit_breaker.record_failure()

                if attempt < self.retry_config.max_attempts - 1 and self._is_retryable(e):
                    delay = min(
                        self.retry_config.base_delay * (self.retry_config.exponential_base ** attempt),
                        self.retry_config.max_delay,
                    )
                    if self.retry_config.jitter:
                        import random
                        delay *= (0.5 + random.random())
                    logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay:.1f}s...")
                    await asyncio.sleep(delay)
                else:
                    break

        raise last_exception

    async def get(self, path: str, params: Dict = None, headers: Dict = None,
                  use_cache: bool = True, cache_ttl: int = 3600,
                  cache_namespace: str = "http") -> Any:
        """GET request with caching."""
        url = f"{self.base_url}/{path.lstrip('/')}"
        cache_key = hashlib.md5(f"{url}:{json.dumps(params, sort_keys=True)}".encode()).hexdigest()

        # Try cache first
        if use_cache and self.cache:
            cached = await self.cache.get(cache_namespace, cache_key)
            if cached is not None:
                logger.debug(f"Cache hit for {url}")
                return cached

        async def _do_request():
            session = await self._get_session()
            async with session.get(url, params=params, headers=headers) as response:
                if response.status == 304:
                    # Not modified, use cached version
                    return None
                response.raise_for_status()
                content_type = response.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    return await response.json()
                elif "text/" in content_type:
                    return await response.text()
                else:
                    return await response.read()

        result = await self._execute_with_retry(_do_request)

        # Cache successful result
        if use_cache and self.cache and result is not None:
            await self.cache.set(cache_namespace, cache_key, result, ttl=cache_ttl, source=url)

        return result

    async def post(self, path: str, json_data: Dict = None, data: Any = None,
                   headers: Dict = None) -> Any:
        """POST request with retry."""
        url = f"{self.base_url}/{path.lstrip('/')}"

        async def _do_request():
            session = await self._get_session()
            async with session.post(url, json=json_data, data=data, headers=headers) as response:
                response.raise_for_status()
                return await response.json()

        return await self._execute_with_retry(_do_request)


def with_retry(config: Optional[RetryConfig] = None):
    """Decorator for adding retry logic to async functions."""
    retry_config = config or RetryConfig()

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(retry_config.max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < retry_config.max_attempts - 1 and isinstance(e, retry_config.retryable_exceptions):
                        delay = min(
                            retry_config.base_delay * (retry_config.exponential_base ** attempt),
                            retry_config.max_delay,
                        )
                        if retry_config.jitter:
                            import random
                            delay *= (0.5 + random.random())
                        logger.warning(f"{func.__name__} attempt {attempt + 1} failed: {e}. Retrying in {delay:.1f}s...")
                        await asyncio.sleep(delay)
                    else:
                        break
            raise last_exception
        return wrapper
    return decorator


class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, rate: float, burst: int = 1):
        self.rate = rate  # requests per second
        self.burst = burst
        self.tokens = burst
        self.last_update = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: int = 1):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_update
            self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
            self.last_update = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return

            # Wait for tokens
            deficit = tokens - self.tokens
            wait_time = deficit / self.rate
            await asyncio.sleep(wait_time)
            self.tokens = 0
            self.last_update = time.monotonic()


class DataSourceHealth:
    """Track health status of a data source."""

    def __init__(self, source_name: str):
        self.source_name = source_name
        self.consecutive_failures = 0
        self.consecutive_successes = 0
        self.last_success: Optional[datetime] = None
        self.last_failure: Optional[datetime] = None
        self.last_error: Optional[str] = None
        self.total_requests = 0
        self.total_failures = 0
        self.circuit_breaker = CircuitBreaker(source_name)
        self.rate_limiter: Optional[RateLimiter] = None

    def record_success(self):
        self.consecutive_failures = 0
        self.consecutive_successes += 1
        self.last_success = datetime.utcnow()
        self.total_requests += 1
        self.circuit_breaker.record_success()

    def record_failure(self, error: str):
        self.consecutive_failures += 1
        self.consecutive_successes = 0
        self.last_failure = datetime.utcnow()
        self.last_error = error
        self.total_requests += 1
        self.total_failures += 1
        self.circuit_breaker.record_failure()

    def get_status(self) -> Dict[str, Any]:
        success_rate = 0
        if self.total_requests > 0:
            success_rate = (self.total_requests - self.total_failures) / self.total_requests

        return {
            "source": self.source_name,
            "circuit_state": self.circuit_breaker.state,
            "consecutive_failures": self.consecutive_failures,
            "consecutive_successes": self.consecutive_successes,
            "last_success": self.last_success.isoformat() if self.last_success else None,
            "last_failure": self.last_failure.isoformat() if self.last_failure else None,
            "last_error": self.last_error,
            "total_requests": self.total_requests,
            "total_failures": self.total_failures,
            "success_rate": round(success_rate, 4),
            "healthy": self.circuit_breaker.state == CircuitState.CLOSED and self.consecutive_failures < 3,
        }

    def can_make_request(self) -> bool:
        return self.circuit_breaker.can_execute()


# Global health tracker
_data_source_health: Dict[str, DataSourceHealth] = {}


def get_source_health(source_name: str) -> DataSourceHealth:
    """Get or create health tracker for a source."""
    if source_name not in _data_source_health:
        _data_source_health[source_name] = DataSourceHealth(source_name)
    return _data_source_health[source_name]


def get_all_source_health() -> Dict[str, Dict[str, Any]]:
    """Get health status for all tracked sources."""
    return {name: health.get_status() for name, health in _data_source_health.items()}