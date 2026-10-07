"""Offline tests for the optional Arize AI model-observability layer.

Arize is mocked throughout: no Arize account or network access is needed. The key property under
test is that observability can fail in every way without changing or breaking a flood prediction.
"""

import asyncio
import json
import logging
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-0123456789")

import numpy as np
import pytest
import requests
from pydantic import SecretStr

from app.core.config import settings
from app.ml.inference import InferenceEngine
from app.services.geo.features import FEATURE_NAMES
from app.services.model_observability import arize_exporter, service
from app.services.model_observability import telemetry as telemetry_mod
from app.services.model_observability.telemetry import Telemetry

API_KEY = "arize-key-DO-NOT-LEAK"
SPACE_ID = "space-id-DO-NOT-LEAK"


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code


class FakeArizeClient:
    """Stands in for arize.pandas.logger.Client; records every log() call."""

    def __init__(self, outcome=200):
        self.outcome = outcome
        self.calls = []

    def log(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return FakeResponse(self.outcome)


class StubPredictor:
    is_fitted = True

    def predict_proba(self, X):
        return np.full(X.shape[0], 0.73)


@pytest.fixture
def tel(monkeypatch):
    """A fresh Telemetry with Redis disabled (local counters) and a fake Arize client."""
    t = Telemetry()

    async def no_redis():
        return None

    monkeypatch.setattr(t, "_get_redis", no_redis)
    monkeypatch.setattr(telemetry_mod, "telemetry", t)
    monkeypatch.setattr(service, "telemetry", t)
    t.exporter._client = FakeArizeClient()
    return t


@pytest.fixture
def arize_on(monkeypatch):
    monkeypatch.setattr(settings, "ARIZE_ENABLED", True)
    monkeypatch.setattr(settings, "ARIZE_API_KEY", SecretStr(API_KEY))
    monkeypatch.setattr(settings, "ARIZE_SPACE_ID", SPACE_ID)


def engine_with_stub() -> InferenceEngine:
    engine = InferenceEngine()
    engine._models["ensemble"] = StubPredictor()
    engine._model_versions["flood_ensemble"] = "1.2.0"
    return engine


def features_row():
    return np.arange(len(FEATURE_NAMES), dtype=float)


def observe(t: Telemetry, probs=(0.73,), latency=12.0):
    t.observe(
        features=np.vstack([features_row() for _ in probs]),
        feature_names=FEATURE_NAMES,
        probabilities=list(probs),
        latency_ms=latency,
        model_used="ensemble",
        model_version="1.2.0",
        risk_level_of=lambda p: "HIGH" if p >= 0.6 else "LOW",
    )


# ------------------------------------------------------------------ 1. disabled / 2. missing credentials


@pytest.mark.asyncio
async def test_disabled_counts_stats_but_never_exports(tel, monkeypatch):
    monkeypatch.setattr(settings, "ARIZE_ENABLED", False)
    observe(tel)
    await tel.flush()
    assert tel.exporter._client.calls == []
    assert tel.local.predictions == 1
    out = await service.summary()
    assert out["arize"]["status"] == "not_connected" and out["arize"]["message"] == "Arize AI not connected"


@pytest.mark.asyncio
async def test_enabled_without_credentials_is_not_connected(tel, monkeypatch):
    monkeypatch.setattr(settings, "ARIZE_ENABLED", True)
    monkeypatch.setattr(settings, "ARIZE_API_KEY", None)
    monkeypatch.setattr(settings, "ARIZE_SPACE_ID", None)
    observe(tel)
    await tel.flush()
    assert tel.exporter._client.calls == []
    out = await service.summary()
    assert out["arize"]["status"] == "not_connected" and "missing" in out["arize"]["message"]


# ------------------------------------------------------------------ 3. success / 8. mapping / 9. logging


@pytest.mark.asyncio
async def test_successful_export_maps_model_inputs_and_outputs(tel, arize_on):
    pytest.importorskip("arize")
    from arize.utils.types import Environments, ModelTypes

    observe(tel, probs=(0.73, 0.12))
    await tel.flush()
    (call,) = tel.exporter._client.calls
    frame, schema = call["dataframe"], call["schema"]
    assert call["model_id"] == "FloodGuard-Risk-Prediction" and call["model_version"] == "1.2.0"
    assert call["model_type"] == ModelTypes.BINARY_CLASSIFICATION and call["environment"] == Environments.PRODUCTION
    assert list(schema.feature_column_names) == FEATURE_NAMES
    assert list(frame["prediction_label"]) == ["flood", "no_flood"]
    assert list(frame["prediction_score"]) == [0.73, 0.12]
    assert list(frame["risk_level"]) == ["HIGH", "LOW"]
    assert frame.loc[0, "rainfall_1h_mm"] == 0.0 and frame.loc[0, "historical_flood_count"] == len(FEATURE_NAMES) - 1
    assert frame["prediction_id"].is_unique
    out = await service.summary()
    assert out["arize"]["status"] == "connected" and out["arize"]["exported_records"] == 2


def test_frame_contains_no_personal_data(arize_on):
    rec = telemetry_mod.PredictionRecord(
        prediction_id="p1", timestamp=1700000000, feature_names=tuple(FEATURE_NAMES), features=list(features_row()),
        probability=0.5, prediction=1, risk_level="MODERATE", latency_ms=3.0, model_used="ensemble", model_version="1",
    )
    cols = set(arize_exporter.build_frame([rec], FEATURE_NAMES).columns)
    assert cols == set(FEATURE_NAMES) | {"prediction_id", "prediction_ts", "prediction_label", "prediction_score",
                                         "risk_level", "inference_latency_ms", "model_used", "deployment_env"}


# ------------------------------------------------------------------ 4-6. failures


@pytest.mark.asyncio
async def test_api_failure_is_reported_not_raised(tel, arize_on):
    tel.exporter._client = FakeArizeClient(outcome=500)
    observe(tel)
    await tel.flush()
    out = await service.summary()
    assert out["arize"]["status"] == "error" and out["arize"]["message"] == "Arize returned HTTP 500"


@pytest.mark.asyncio
@pytest.mark.parametrize("outcome,message", [
    (requests.Timeout("slow"), "Arize did not respond in time"),
    (requests.ConnectionError("down"), "Arize is unreachable"),
    (401, "Arize rejected the credentials"),
    (ValueError("schema"), "Arize export failed"),
])
async def test_timeout_unreachable_bad_credentials(tel, arize_on, outcome, message):
    tel.exporter._client = FakeArizeClient(outcome=outcome)
    observe(tel)
    await tel.flush()
    assert tel.arize.last_error == message


@pytest.mark.asyncio
async def test_rate_limit_pauses_exports(tel, arize_on):
    tel.exporter._client = FakeArizeClient(outcome=429)
    observe(tel)
    await tel.flush()
    assert tel.arize.paused_until > 0
    observe(tel)
    await tel.flush()
    assert len(tel.exporter._client.calls) == 1  # no second request while paused
    assert tel.local.predictions == 2             # stats keep counting


# ------------------------------------------------------------------ 7. prediction unaffected


@pytest.mark.asyncio
async def test_prediction_unchanged_when_arize_fails(tel, arize_on):
    tel.exporter._client = FakeArizeClient(outcome=requests.ConnectionError("down"))
    engine = engine_with_stub()
    result = await engine.predict(features_row(), FEATURE_NAMES)
    assert result["predictions"] == [1] and result["probabilities"] == [0.73]
    await tel.flush()  # the failing export happens off the request path and is swallowed
    assert tel.arize.last_error == "Arize is unreachable"


@pytest.mark.asyncio
async def test_prediction_unchanged_when_observability_itself_breaks(monkeypatch):
    def boom(**_):
        raise RuntimeError("telemetry bug")

    monkeypatch.setattr(telemetry_mod.telemetry, "observe", boom)
    engine = engine_with_stub()
    result = await engine.predict(features_row(), FEATURE_NAMES)
    assert result["probabilities"] == [0.73]
    batch = await engine.predict_batch(np.vstack([features_row()] * 3), FEATURE_NAMES)
    assert batch["total_samples"] == 3


@pytest.mark.asyncio
async def test_batch_predictions_counted_and_export_sampled(tel, arize_on):
    engine = engine_with_stub()
    n = 1000
    await engine.predict_batch(np.vstack([features_row()] * n), FEATURE_NAMES)
    await tel.flush()
    assert tel.local.predictions == n
    exported = sum(len(c["dataframe"]) for c in tel.exporter._client.calls)
    assert 0 < exported <= telemetry_mod.BATCH_EXPORT_SAMPLE


# ------------------------------------------------------------------ 12. no credentials exposed


@pytest.mark.asyncio
async def test_summary_and_logs_never_contain_credentials(tel, arize_on, caplog):
    caplog.set_level(logging.DEBUG)
    tel.exporter._client = FakeArizeClient(outcome=403)
    observe(tel)
    await tel.flush()
    blob = json.dumps(await service.summary()) + caplog.text
    assert API_KEY not in blob and SPACE_ID not in blob


def test_summary_route_is_public_and_safe(tel, arize_on):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.endpoints import model_observability

    app = FastAPI()
    app.include_router(model_observability.router, prefix="/api/v1")
    with TestClient(app) as http:
        r = http.get("/api/v1/model-observability/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["model"]["id"] == "FloodGuard-Risk-Prediction" and body["stats"]["predictions"] == 0
    assert API_KEY not in r.text and SPACE_ID not in r.text



def test_flusher_restarts_on_a_new_event_loop(monkeypatch):
    """A flusher stranded on a closed loop must not stop flushing on the next one."""
    t = Telemetry()
    monkeypatch.setattr(telemetry_mod, "telemetry", t)

    async def predict_once():
        observe(t)

    first_loop = asyncio.new_event_loop()
    first_loop.run_until_complete(predict_once())
    first_loop.close()  # closed without cancelling: the flusher task is left pending, not done
    stranded = t._task
    assert stranded is not None and not stranded.done()
    t._redis = object()  # stand-in for a client bound to the closed loop

    second_loop = asyncio.new_event_loop()
    try:
        second_loop.run_until_complete(predict_once())
        assert t._task is not stranded and t._task.get_loop() is second_loop
        assert t._redis is None
        t._task.cancel()
    finally:
        second_loop.close()
