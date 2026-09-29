"""Shared helpers: HTTP client, caching, provenance, Wayanad geometry."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Optional

import httpx
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

logger = logging.getLogger(__name__)

USER_AGENT = "FloodGuard/1.0 (flood situational awareness; open-data research)"
DATA_DIR = Path(__file__).parent / "data"
CACHE_DIR = Path(__file__).resolve().parents[3] / ".cache" / "geo"

# Wayanad district bounding box derived from the OSM boundary (relation 2018203)
WAYANAD_BBOX = (75.773149, 11.451361, 76.4435318, 11.9786826)
WAYANAD_LGD_DISTRICT_CODE = "567"

_client: Optional[httpx.AsyncClient] = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT},
            timeout=httpx.Timeout(45.0, connect=10.0),
            follow_redirects=True,
        )
    return _client


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@lru_cache(maxsize=1)
def wayanad_geometry() -> BaseGeometry:
    fc = json.loads((DATA_DIR / "wayanad_boundary.geojson").read_text())
    return shape(fc["features"][0]["geometry"])


def freshness(observed_at: Optional[str], live_minutes: int = 90, recent_hours: int = 24) -> str:
    """Classify a timestamp as LIVE / RECENT / STALE / UNAVAILABLE."""
    if not observed_at:
        return "UNAVAILABLE"
    try:
        ts = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
    except ValueError:
        return "UNAVAILABLE"
    age = (datetime.now(timezone.utc) - ts).total_seconds()
    if age < live_minutes * 60:
        return "LIVE"
    if age < recent_hours * 3600:
        return "RECENT"
    return "STALE"


def provenance(
    source: str,
    *,
    kind: str,
    status: str,
    retrieved_at: Optional[str] = None,
    reference: Optional[str] = None,
    url: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Standard provenance block attached to every geo response.

    kind:   OBSERVED | MODEL_ANALYSIS | FORECAST | HISTORICAL | STATIC_DATASET | DERIVED | MODEL_PREDICTION
    status: LIVE | RECENT | HISTORICAL | STALE | UNAVAILABLE
    """
    return {
        "source": source,
        "kind": kind,
        "status": status,
        "retrieved_at": retrieved_at or utcnow_iso(),
        "reference": reference,
        "url": url,
        "notes": notes,
    }


class TTLCache:
    """Small in-process TTL cache with optional JSON persistence on disk."""

    def __init__(self, name: str, ttl_seconds: float, persist: bool = False, max_items: int = 2000):
        self.name = name
        self.ttl = ttl_seconds
        self.persist = persist
        self.max_items = max_items
        self._mem: Dict[str, tuple[float, Any]] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    @staticmethod
    def key(*parts: Any) -> str:
        raw = json.dumps(parts, sort_keys=True, default=str)
        return hashlib.sha1(raw.encode()).hexdigest()

    def _path(self, key: str) -> Path:
        return CACHE_DIR / self.name / f"{key}.json"

    def get(self, key: str) -> Optional[Any]:
        hit = self._mem.get(key)
        now = time.time()
        if hit and now - hit[0] < self.ttl:
            return hit[1]
        if self.persist:
            p = self._path(key)
            if p.exists() and now - p.stat().st_mtime < self.ttl:
                try:
                    value = json.loads(p.read_text())
                    self._mem[key] = (p.stat().st_mtime, value)
                    return value
                except Exception:  # noqa: BLE001 - corrupt cache file is just a miss
                    pass
        return None

    def set(self, key: str, value: Any) -> None:
        if len(self._mem) >= self.max_items:
            oldest = sorted(self._mem.items(), key=lambda kv: kv[1][0])[: self.max_items // 4]
            for k, _ in oldest:
                self._mem.pop(k, None)
        self._mem[key] = (time.time(), value)
        if self.persist:
            try:
                p = self._path(key)
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(json.dumps(value, default=str))
            except Exception as exc:  # noqa: BLE001
                logger.warning("geo cache %s: could not persist: %s", self.name, exc)

    async def get_or_create(self, key: str, factory: Callable[[], Awaitable[Any]]) -> Any:
        cached = self.get(key)
        if cached is not None:
            return cached
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            cached = self.get(key)
            if cached is not None:
                return cached
            value = await factory()
            if value is not None:
                self.set(key, value)
            return value


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    import math

    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
