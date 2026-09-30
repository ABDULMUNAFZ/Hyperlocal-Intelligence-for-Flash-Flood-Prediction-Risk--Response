# FloodGuard Health Check Endpoints
#
#   /health                 (root, see main.py) — liveness only, no dependencies (container/ALB checks)
#   /api/v1/health/live     — liveness
#   /api/v1/health/ready    — database reachable
#   /api/v1/health          — real component checks: PostgreSQL, PostGIS, migrations, Redis, Celery,
#                             ML models, Web Push config. 503 when a critical dependency is down.
import asyncio
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db

router = APIRouter()
_STARTED = time.monotonic()
APP_VERSION = "1.0.0"


def _code_migration_heads() -> list:
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        cfg = Config(str(Path(__file__).resolve().parents[4] / "alembic.ini"))
        cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[4] / "alembic"))
        return list(ScriptDirectory.from_config(cfg).get_heads())
    except Exception:  # noqa: BLE001
        return []


def _celery_ping() -> Dict[str, Any]:
    from app.core.celery_app import celery_app

    replies = celery_app.control.inspect(timeout=2.0).ping() or {}
    return {"status": "ok" if replies else "no_workers", "workers": sorted(replies)}


async def _timed(coro, timeout: float):
    t = time.perf_counter()
    try:
        out = await asyncio.wait_for(coro, timeout)
        return out, round((time.perf_counter() - t) * 1000, 1)
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"[:300]}, round((time.perf_counter() - t) * 1000, 1)


@router.get("/health", tags=["Health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Component health. Critical: database + PostGIS + Redis (503 if any fails)."""
    checks: Dict[str, Any] = {}

    async def database():
        row = (await db.execute(text("SELECT version(), postgis_lib_version()"))).one()
        return {"status": "ok", "postgres": row[0].split(",")[0], "postgis": row[1]}

    async def migrations():
        current = (await db.execute(text("SELECT version_num FROM alembic_version"))).scalars().all()
        heads = _code_migration_heads()
        ok = bool(heads) and set(current) == set(heads)
        return {"status": "ok" if ok else "pending", "database": current, "code": heads}

    async def spatial():
        d = (await db.execute(text("""SELECT round(ST_Distance(ST_SetSRID(ST_MakePoint(76.083,11.61),4326)::geography,
                                                              ST_SetSRID(ST_MakePoint(76.133,11.556),4326)::geography))"""))).scalar()
        return {"status": "ok" if d and 7000 < d < 9000 else "error", "test_distance_m": d}

    async def redis_check():
        c = redis.from_url(str(settings.REDIS_URL))
        try:
            await c.ping()
            return {"status": "ok", "tls": str(settings.REDIS_URL).startswith("rediss://")}
        finally:
            await c.aclose()

    async def ml():
        from app.ml.inference import get_inference_service

        h = await (await get_inference_service()).engine.health_check()
        fitted = [k for k, v in (h.get("models_fitted") or {}).items() if v]
        return {"status": "ok" if fitted else "no_models", "models_loaded": h.get("models_loaded", []), "models_fitted": fitted}

    for name, coro, timeout in [("database", database(), 5), ("migrations", migrations(), 5), ("spatial_query", spatial(), 5),
                                ("redis", redis_check(), 3), ("ml_models", ml(), 20)]:
        out, ms = await _timed(coro, timeout)
        checks[name] = {**out, "latency_ms": ms}
    out, ms = await _timed(asyncio.to_thread(_celery_ping), 4)
    checks["celery"] = {**out, "latency_ms": ms}

    from app.services.emergency.core import push_configured

    checks["web_push"] = {"status": "configured" if push_configured() else "not_configured"}

    critical = all(checks[k].get("status") == "ok" for k in ("database", "spatial_query", "redis"))
    degraded = [k for k in ("migrations", "celery", "ml_models") if checks[k].get("status") != "ok"]
    body = {
        "status": "healthy" if critical and not degraded else ("degraded" if critical else "unhealthy"),
        "version": APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_s": round(time.monotonic() - _STARTED),
        "database": checks["database"].get("status"),
        "redis": checks["redis"].get("status"),
        "checks": checks,
    }
    if not critical:
        raise HTTPException(status_code=503, detail=body)
    return body


@router.get("/health/ready", tags=["Health"])
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness probe: database reachable."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="Not ready")


@router.get("/health/live", tags=["Health"])
async def liveness_check():
    """Liveness probe (no dependencies)."""
    return {"status": "alive"}
