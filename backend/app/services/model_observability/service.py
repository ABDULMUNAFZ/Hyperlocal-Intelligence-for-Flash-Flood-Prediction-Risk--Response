"""Read-side summary for the dashboard's "AI Model Intelligence" panel.

Reads only FloodGuard's own telemetry (Redis counters) and the result of the last Arize export; it never
calls Arize on a page load. Drift is computed by Arize monitors inside Arize, so it is not mirrored here.
No credentials or identifiers beyond the model id/version are returned.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.core.config import settings

from . import arize_exporter
from .telemetry import telemetry

logger = logging.getLogger(__name__)

MODEL_DISPLAY_NAME = "FloodGuard Risk Prediction"
ARIZE_APP_URL = "https://app.arize.com/"


def _production_model_version() -> Optional[str]:
    try:
        from app.ml.registry import ModelStage, get_model_registry

        prod = get_model_registry().get_models_by_stage(ModelStage.PRODUCTION)
        m = next((x for x in prod if x.name == "flood_ensemble"), prod[0] if prod else None)
        return m.version if m else None
    except Exception as exc:  # noqa: BLE001 - a registry problem must not break the panel
        logger.warning("model observability: registry unavailable (%s)", type(exc).__name__)
        return None


def _arize_status(state: Dict[str, Any]) -> Dict[str, Any]:
    enabled = settings.ARIZE_ENABLED
    configured = arize_exporter.is_configured()
    sdk = arize_exporter.sdk_available() if configured else None
    if not configured:
        status, message = "not_connected", (
            "Arize AI not connected" if not enabled else "Arize AI is enabled but ARIZE_API_KEY / ARIZE_SPACE_ID are missing"
        )
    elif not sdk:
        status, message = "error", "Arize SDK is not installed on the backend"
    else:
        ok, err = state.get("last_success_at"), state.get("last_error_at")
        if err and (not ok or err > ok):
            status, message = "error", state.get("last_error") or "Arize AI temporarily unavailable"
        elif ok:
            status, message = "connected", "Arize AI Connected"
        else:
            status, message = "pending", "Arize AI configured; waiting for the first prediction to export"
    return {
        "enabled": enabled,
        "configured": configured,
        "status": status,
        "message": message,
        "model_id": settings.ARIZE_MODEL_ID if configured else None,
        "last_export_at": state.get("last_success_at"),
        "last_error_at": state.get("last_error_at"),
        "exported_records": state.get("exported_records", 0),
        "app_url": ARIZE_APP_URL if configured else None,
    }


async def summary() -> Dict[str, Any]:
    snap = await telemetry.snapshot()
    return {
        "source": "floodguard_model_observability",
        "model": {
            "name": MODEL_DISPLAY_NAME,
            "id": settings.ARIZE_MODEL_ID,
            "version": _production_model_version(),
            "type": "binary classification (flood probability)",
        },
        "stats": snap["stats"],
        "arize": _arize_status(snap["arize"]),
        "drift": {
            "source": "arize",
            "note": "Data and prediction drift are computed by Arize monitors on the exported predictions; view them in your Arize space.",
        },
    }
