"""Catalyst Center infrastructure views for FloodGuard.

Results are cached in memory (successes for CACHE_TTL_S, failures for FAILURE_TTL_S) so dashboards
never hammer the controller, and every public function returns a JSON-ready dict instead of raising:
a Cisco outage can only ever show up as {"connected": false, ...}. This module is independent of the
flood prediction, risk and simulation code; nothing there imports it.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple
from urllib.parse import urlparse

from app.core.config import settings

from . import normalize
from .client import CatalystCenterClient, CatalystCenterError

logger = logging.getLogger(__name__)

CACHE_TTL_S = 45
FAILURE_TTL_S = 15



class _TTLCache:
    """Tiny in-memory TTL cache; get_or_create lets only one caller per key reach the controller."""

    def __init__(self, ttl_seconds: float):
        self.ttl = ttl_seconds
        self._mem: Dict[str, Tuple[float, Any]] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    def get(self, key: str) -> Optional[Any]:
        hit = self._mem.get(key)
        return hit[1] if hit and time.monotonic() - hit[0] < self.ttl else None

    def set(self, key: str, value: Any) -> None:
        self._mem[key] = (time.monotonic(), value)

    async def get_or_create(self, key: str, factory: Callable[[], Awaitable[Any]]) -> Any:
        cached = self.get(key)
        if cached is not None:
            return cached
        async with self._locks.setdefault(key, asyncio.Lock()):
            cached = self.get(key)
            if cached is None:
                cached = await factory()
                self.set(key, cached)
            return cached


_ok_cache = _TTLCache(CACHE_TTL_S)
_fail_cache = _TTLCache(FAILURE_TTL_S)
_client: Optional[CatalystCenterClient] = None


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def is_configured() -> bool:
    pw = settings.CATALYST_CENTER_PASSWORD
    return bool(settings.CATALYST_CENTER_URL and settings.CATALYST_CENTER_USERNAME and pw and pw.get_secret_value())


def controller_host() -> Optional[str]:
    url = settings.CATALYST_CENTER_URL
    return urlparse(url).hostname if url else None


def get_client() -> CatalystCenterClient:
    global _client
    if _client is None:
        if not settings.CATALYST_CENTER_VERIFY_SSL:
            logger.warning("catalyst_center: TLS certificate verification is disabled (CATALYST_CENTER_VERIFY_SSL=false)")
        assert settings.CATALYST_CENTER_URL and settings.CATALYST_CENTER_USERNAME and settings.CATALYST_CENTER_PASSWORD
        _client = CatalystCenterClient(
            settings.CATALYST_CENTER_URL,
            settings.CATALYST_CENTER_USERNAME,
            settings.CATALYST_CENTER_PASSWORD,
            verify_ssl=settings.CATALYST_CENTER_VERIFY_SSL,
            timeout=settings.CATALYST_CENTER_TIMEOUT,
        )
    return _client


def _envelope(connected: bool, **fields: Any) -> Dict[str, Any]:
    return {
        "source": normalize.SOURCE,
        "source_label": normalize.SOURCE_LABEL,
        "controller": controller_host(),
        "configured": is_configured(),
        "connected": connected,
        **fields,
    }


def _failure(message: str) -> Dict[str, Any]:
    return _envelope(False, error=message, retrieved_at=utcnow_iso())


async def _view(name: str, build: Callable[[CatalystCenterClient], Awaitable[Dict[str, Any]]]) -> Dict[str, Any]:
    """Serve a cached view, or build it; failures are cached briefly and returned as safe envelopes."""
    if not is_configured():
        return _envelope(False, error="Catalyst Center is not configured", retrieved_at=utcnow_iso())
    failed = _fail_cache.get(name)
    if failed is not None:
        return failed

    async def factory() -> Dict[str, Any]:
        data = await build(get_client())
        return _envelope(True, retrieved_at=utcnow_iso(), **data)

    try:
        return await _ok_cache.get_or_create(name, factory)
    except CatalystCenterError as exc:
        result = _failure(exc.public_message)
    except Exception as exc:  # noqa: BLE001 - never let an integration error escape into FloodGuard
        logger.warning("catalyst_center %s: unexpected %s", name, type(exc).__name__)
        result = _failure("Catalyst Center request failed")
    _fail_cache.set(name, result)
    return result


async def _status(client: CatalystCenterClient) -> Dict[str, Any]:
    await client.authenticate()
    count = normalize.device_count(await client.get("network-device/count"))
    return {"authenticated": True, "device_count": count}


async def _devices(client: CatalystCenterClient) -> Dict[str, Any]:
    await client.ensure_authenticated()
    count_raw, list_raw = await asyncio.gather(client.get("network-device/count"), client.get("network-device"))
    items = normalize.devices(list_raw)
    count = normalize.device_count(count_raw)
    return {"count": count if count is not None else len(items), "devices": items}


async def _health(client: CatalystCenterClient) -> Dict[str, Any]:
    await client.ensure_authenticated()
    results = await asyncio.gather(
        client.get("device-health"), client.get("network-health"), client.get("site-health"),
        return_exceptions=True,
    )
    errors: Dict[str, str] = {}

    def part(key: str, raw: Any, convert: Callable[[Any], Any]) -> Any:
        if isinstance(raw, CatalystCenterError):
            errors[key] = raw.public_message
            return None
        if isinstance(raw, BaseException):
            errors[key] = "Catalyst Center request failed"
            return None
        return convert(raw)

    out = {
        "devices": part("devices", results[0], normalize.device_health),
        "network": part("network", results[1], normalize.network_health),
        "sites": part("sites", results[2], normalize.site_health),
    }
    if len(errors) == 3:
        raise CatalystCenterError(next(iter(errors.values())))
    return {**out, "errors": errors or None}


async def _events(client: CatalystCenterClient) -> Dict[str, Any]:
    items = normalize.issues(await client.get("issues"))
    return {"count": len(items), "issues": items}


async def status() -> Dict[str, Any]:
    return await _view("status", _status)


async def devices() -> Dict[str, Any]:
    return await _view("devices", _devices)


async def health() -> Dict[str, Any]:
    return await _view("health", _health)


async def events() -> Dict[str, Any]:
    return await _view("events", _events)
