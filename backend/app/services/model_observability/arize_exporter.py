"""Export FloodGuard inference records to Arize AI (arize==7.x pandas logger).

Runs off the request path (called from the telemetry flusher in a worker thread). Every outcome is
returned as an ExportResult with a fixed, credential-free message; nothing here raises to callers.
Records carry only model inputs/outputs and pipeline metadata: no user, contact or location data.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, List, Optional, Sequence

from app.core.config import settings

logger = logging.getLogger(__name__)

PREDICTION_ID = "prediction_id"
TIMESTAMP = "prediction_ts"
LABEL = "prediction_label"
SCORE = "prediction_score"
TAGS = ["risk_level", "inference_latency_ms", "model_used", "deployment_env"]
FLOOD, NO_FLOOD = "flood", "no_flood"


@dataclass
class ExportResult:
    ok: bool
    message: str
    status: Optional[int] = None
    rate_limited: bool = False
    records: int = 0


def is_configured() -> bool:
    key = settings.ARIZE_API_KEY
    return bool(settings.ARIZE_ENABLED and settings.ARIZE_SPACE_ID and key and key.get_secret_value())


def sdk_available() -> bool:
    try:
        import arize.pandas.logger  # noqa: F401
    except Exception:  # noqa: BLE001 - any import problem means "not available"
        return False
    return True


def build_frame(records: Sequence[Any], feature_names: Sequence[str]):
    """One row per prediction; feature columns use the model's own FEATURE_NAMES."""
    import pandas as pd

    rows = []
    for r in records:
        row = {
            PREDICTION_ID: r.prediction_id,
            TIMESTAMP: int(r.timestamp),
            LABEL: FLOOD if r.prediction == 1 else NO_FLOOD,
            SCORE: float(r.probability),
            "risk_level": r.risk_level,
            "inference_latency_ms": round(float(r.latency_ms), 3),
            "model_used": r.model_used,
            "deployment_env": settings.ENVIRONMENT,
        }
        for name, value in zip(feature_names, r.features):
            row[name] = None if value is None else float(value)
        rows.append(row)
    return pd.DataFrame(rows)


class ArizeExporter:
    def __init__(self) -> None:
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            from arize.pandas.logger import Client

            key = settings.ARIZE_API_KEY
            assert key is not None and settings.ARIZE_SPACE_ID
            self._client = Client(space_id=settings.ARIZE_SPACE_ID, api_key=key.get_secret_value())
        return self._client

    def export(self, records: Sequence[Any], feature_names: List[str], model_version: str) -> ExportResult:
        """Send one batch synchronously (call from a worker thread). Never raises."""
        if not records:
            return ExportResult(True, "nothing to export")
        started = time.perf_counter()
        try:
            from arize.utils.types import Environments, ModelTypes, Schema

            frame = build_frame(records, feature_names)
            schema = Schema(
                prediction_id_column_name=PREDICTION_ID,
                timestamp_column_name=TIMESTAMP,
                prediction_label_column_name=LABEL,
                prediction_score_column_name=SCORE,
                feature_column_names=list(feature_names),
                tag_column_names=TAGS,
            )
            response = self._get_client().log(
                dataframe=frame,
                schema=schema,
                environment=Environments.PRODUCTION,
                model_id=settings.ARIZE_MODEL_ID,
                model_type=ModelTypes.BINARY_CLASSIFICATION,
                model_version=model_version,
                timeout=settings.ARIZE_TIMEOUT,
            )
            status = getattr(response, "status_code", None)
        except Exception as exc:  # noqa: BLE001 - observability must never propagate
            return self._failure(exc, started, len(records))

        elapsed = (time.perf_counter() - started) * 1000
        logger.info("arize export %d records -> %s in %.0f ms", len(records), status, elapsed)
        if status == 200:
            return ExportResult(True, "exported", status=status, records=len(records))
        if status in (401, 403):
            return ExportResult(False, "Arize rejected the credentials", status=status)
        if status == 404:
            return ExportResult(False, "Arize space or endpoint not found", status=status)
        if status == 429:
            return ExportResult(False, "Arize rate limit reached; pausing exports", status=status, rate_limited=True)
        return ExportResult(False, f"Arize returned HTTP {status}", status=status)

    @staticmethod
    def _failure(exc: Exception, started: float, n: int) -> ExportResult:
        import requests

        elapsed = (time.perf_counter() - started) * 1000
        if isinstance(exc, requests.Timeout):
            msg = "Arize did not respond in time"
        elif isinstance(exc, requests.ConnectionError):
            msg = "Arize is unreachable"
        elif isinstance(exc, ImportError):
            msg = "Arize SDK is not installed"
        else:
            msg = "Arize export failed"
        # exception type only: SDK errors can echo request details
        logger.warning("arize export %d records failed after %.0f ms: %s", n, elapsed, type(exc).__name__)
        return ExportResult(False, msg)
