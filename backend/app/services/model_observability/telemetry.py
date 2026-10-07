"""In-process telemetry for FloodGuard inference: daily stats + optional Arize export.

`observe()` is the only call on the prediction path. It is synchronous, O(rows), never awaits I/O and
never raises: it appends records to a bounded in-memory buffer. A background task (started lazily on
the first observation) flushes every FLUSH_INTERVAL_S seconds: it adds the batch to today's counters in
Redis (shared by all API workers; falls back to this process's counters if Redis is down) and, when
Arize is configured, exports the records from a worker thread. Failed exports are logged and dropped,
never retried in a loop, so a broken observability backend cannot slow or block predictions.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional, Sequence, Tuple

from app.core.config import settings

from . import arize_exporter

logger = logging.getLogger(__name__)

MAX_BUFFER = 5000            # records held between flushes; oldest dropped beyond this
FLUSH_INTERVAL_S = 10.0
MAX_EXPORT_BATCH = 1000      # records per Arize request
BATCH_EXPORT_SAMPLE = 200    # rows exported per batch-prediction call (every row is still counted)
RATE_LIMIT_PAUSE_S = 60.0
HIGH_RISK_THRESHOLD = 0.6    # HIGH and CRITICAL, matching the engine's risk bands
KEY_PREFIX = "fg:model_obs"
STATS_TTL_S = 3 * 86400


@dataclass
class PredictionRecord:
    prediction_id: str
    timestamp: float
    feature_names: Tuple[str, ...]
    features: List[Optional[float]]
    probability: float
    prediction: int
    risk_level: str
    latency_ms: float
    model_used: str
    model_version: str
    export: bool = True


@dataclass
class _DayStats:
    day: str
    predictions: int = 0
    latency_ms_sum: float = 0.0
    high_risk: int = 0
    last_prediction_at: Optional[str] = None


@dataclass
class _ArizeState:
    last_success_at: Optional[str] = None
    last_error: Optional[str] = None
    last_error_at: Optional[str] = None
    exported_records: int = 0
    paused_until: float = 0.0


def _utc_day(ts: Optional[float] = None) -> str:
    return datetime.fromtimestamp(ts if ts is not None else time.time(), tz=timezone.utc).strftime("%Y-%m-%d")


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds")


@dataclass
class Telemetry:
    exporter: arize_exporter.ArizeExporter = field(default_factory=arize_exporter.ArizeExporter)
    buffer: Deque[PredictionRecord] = field(default_factory=lambda: deque(maxlen=MAX_BUFFER))
    dropped: int = 0
    local: _DayStats = field(default_factory=lambda: _DayStats(day=_utc_day()))
    arize: _ArizeState = field(default_factory=_ArizeState)
    _task: Optional[asyncio.Task] = None
    _redis: Any = None

    # ------------------------------------------------------------------ prediction path

    def observe(
        self,
        *,
        features: Any,
        feature_names: Sequence[str],
        probabilities: Sequence[Any],
        latency_ms: float,
        model_used: str,
        model_version: str,
        risk_level_of: Any,
        export_sample: Optional[int] = None,
    ) -> None:
        """Queue one record per prediction row. Never raises; never does I/O."""
        try:
            now = time.time()
            names = tuple(feature_names)
            rows = features.tolist() if hasattr(features, "tolist") else list(features)
            n = len(probabilities)
            per_row_ms = float(latency_ms) / max(n, 1)
            stride = max(1, n // export_sample) if export_sample else 1
            for i, p in enumerate(probabilities):
                prob = float(p[-1]) if hasattr(p, "__len__") else float(p)  # [p_no, p_flood] or p_flood
                if len(self.buffer) == self.buffer.maxlen:
                    self.dropped += 1
                self.buffer.append(PredictionRecord(
                    prediction_id=str(uuid.uuid4()),
                    timestamp=now,
                    feature_names=names,
                    features=list(rows[i]) if i < len(rows) else [],
                    probability=prob,
                    prediction=int(prob >= 0.5),
                    risk_level=str(risk_level_of(prob)),
                    latency_ms=per_row_ms,
                    model_used=model_used,
                    model_version=model_version,
                    export=(i % stride == 0),
                ))
            self._ensure_flusher()
        except Exception as exc:  # noqa: BLE001 - instrumentation must never affect predictions
            logger.debug("model observability: observe skipped (%s)", type(exc).__name__)

    def _ensure_flusher(self) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return  # not inside the event loop; the next async prediction starts the flusher
        if self._task is not None and not self._task.done() and self._task.get_loop() is loop:
            return
        if self._task is not None and self._task.get_loop() is not loop:
            self._redis = None  # the async Redis client is bound to the loop that created it
        self._task = loop.create_task(self._run())

    async def _run(self) -> None:
        while True:
            await asyncio.sleep(FLUSH_INTERVAL_S)
            try:
                await self.flush()
            except Exception as exc:  # noqa: BLE001
                logger.warning("model observability flush failed: %s", type(exc).__name__)

    # ------------------------------------------------------------------ background flush

    async def flush(self) -> None:
        if not self.buffer:
            return
        batch = list(self.buffer)
        self.buffer.clear()
        await self._record_stats(batch)
        await self._export(batch)

    async def _record_stats(self, batch: List[PredictionRecord]) -> None:
        day = _utc_day()
        if self.local.day != day:
            self.local = _DayStats(day=day)
        lat = sum(r.latency_ms for r in batch)
        high = sum(1 for r in batch if r.probability >= HIGH_RISK_THRESHOLD)
        last = _iso(max(r.timestamp for r in batch))
        self.local.predictions += len(batch)
        self.local.latency_ms_sum += lat
        self.local.high_risk += high
        self.local.last_prediction_at = last
        redis = await self._get_redis()
        if redis is None:
            return
        try:
            k = f"{KEY_PREFIX}:{day}"
            pipe = redis.pipeline()
            pipe.hincrby(k, "predictions", len(batch))
            pipe.hincrbyfloat(k, "latency_ms_sum", lat)
            pipe.hincrby(k, "high_risk", high)
            pipe.hset(k, "last_prediction_at", last)
            pipe.expire(k, STATS_TTL_S)
            await pipe.execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("model observability: redis stats unavailable (%s)", type(exc).__name__)
            self._redis = None

    async def _export(self, batch: List[PredictionRecord]) -> None:
        if not arize_exporter.is_configured():
            return
        if time.time() < self.arize.paused_until:
            return
        rows = [r for r in batch if r.export]
        groups: Dict[Tuple[Tuple[str, ...], str], List[PredictionRecord]] = {}
        for r in rows:
            groups.setdefault((r.feature_names, r.model_version), []).append(r)
        for (names, version), recs in groups.items():
            for i in range(0, len(recs), MAX_EXPORT_BATCH):
                chunk = recs[i:i + MAX_EXPORT_BATCH]
                result = await asyncio.to_thread(self.exporter.export, chunk, list(names), version)
                await self._note_export(result)
                if not result.ok:
                    return  # drop the rest of this flush; no retry storm

    async def _note_export(self, result: arize_exporter.ExportResult) -> None:
        now = time.time()
        if result.ok:
            self.arize.last_success_at = _iso(now)
            self.arize.exported_records += result.records
        else:
            self.arize.last_error, self.arize.last_error_at = result.message, _iso(now)
            if result.rate_limited:
                self.arize.paused_until = now + RATE_LIMIT_PAUSE_S
        redis = await self._get_redis()
        if redis is None:
            return
        try:
            k = f"{KEY_PREFIX}:arize"
            if result.ok:
                await redis.hset(k, mapping={"last_success_at": self.arize.last_success_at or ""})
                await redis.hincrby(k, "exported_records", result.records)
            else:
                await redis.hset(k, mapping={"last_error": result.message, "last_error_at": self.arize.last_error_at or ""})
        except Exception as exc:  # noqa: BLE001
            logger.warning("model observability: redis state unavailable (%s)", type(exc).__name__)
            self._redis = None

    async def _get_redis(self) -> Any:
        if self._redis is None:
            try:
                import redis.asyncio as aioredis

                self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=2, socket_connect_timeout=2)
            except Exception:  # noqa: BLE001
                return None
        return self._redis

    # ------------------------------------------------------------------ read side

    async def snapshot(self) -> Dict[str, Any]:
        """Today's stats (all workers via Redis when reachable) and Arize export state."""
        day = _utc_day()
        stats: Dict[str, Any] = {}
        arize_state: Dict[str, Any] = {}
        scope = "all_instances"
        redis = await self._get_redis()
        try:
            if redis is None:
                raise ConnectionError
            stats = await redis.hgetall(f"{KEY_PREFIX}:{day}") or {}
            arize_state = await redis.hgetall(f"{KEY_PREFIX}:arize") or {}
        except Exception:  # noqa: BLE001
            scope = "this_instance"
            local = self.local if self.local.day == day else _DayStats(day=day)
            stats = {
                "predictions": local.predictions, "latency_ms_sum": local.latency_ms_sum,
                "high_risk": local.high_risk, "last_prediction_at": local.last_prediction_at,
            }
            arize_state = {
                "last_success_at": self.arize.last_success_at, "last_error": self.arize.last_error,
                "last_error_at": self.arize.last_error_at, "exported_records": self.arize.exported_records,
            }
        predictions = int(float(stats.get("predictions") or 0))
        latency_sum = float(stats.get("latency_ms_sum") or 0.0)
        high = int(float(stats.get("high_risk") or 0))
        return {
            "stats": {
                "day": day,
                "scope": scope,
                "predictions": predictions,
                "avg_latency_ms": round(latency_sum / predictions, 2) if predictions else None,
                "high_risk_pct": round(100.0 * high / predictions, 1) if predictions else None,
                "last_prediction_at": stats.get("last_prediction_at") or None,
            },
            "arize": {
                "last_success_at": arize_state.get("last_success_at") or None,
                "last_error": arize_state.get("last_error") or None,
                "last_error_at": arize_state.get("last_error_at") or None,
                "exported_records": int(float(arize_state.get("exported_records") or 0)),
            },
        }


telemetry = Telemetry()
