# AI model observability — read-only summary of the flood-risk model's production telemetry.
#
#   GET /api/v1/model-observability/summary   public: model id/version, today's prediction stats,
#                                             Arize AI connection/export state
#
# Aggregate counts only (no inputs, locations or users) from FloodGuard's own counters; it never calls
# Arize on a request and never returns credentials. Always HTTP 200: problems are reported in the body.
from typing import Any, Dict

from fastapi import APIRouter

from app.services.model_observability import service

router = APIRouter(prefix="/model-observability", tags=["AI Model Observability"])


@router.get("/summary")
async def model_observability_summary() -> Dict[str, Any]:
    return await service.summary()
