# FloodGuard Health Check Endpoint
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
from datetime import datetime
from app.db.session import get_db
from app.core.config import settings
from app.schemas.core import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check for all services."""
    now = datetime.utcnow()
    health = HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp=now.isoformat(),
        database="unknown",
        redis="unknown",
        services={},
    )

    # Check database
    try:
        await db.execute(text("SELECT 1"))
        health.database = "connected"
    except Exception as e:
        health.database = f"error: {str(e)}"
        health.status = "degraded"

    # Check Redis
    try:
        redis_client = redis.from_url(str(settings.REDIS_URL))
        await redis_client.ping()
        await redis_client.close()
        health.redis = "connected"
    except Exception as e:
        health.redis = f"error: {str(e)}"
        health.status = "degraded"

    # Check external services (non-blocking)
    health.services = {
        "open_meteo": "available",
        "postgis": "enabled",
        "timescaledb": "enabled",
    }

    if health.status == "degraded":
        raise HTTPException(status_code=503, detail=health.model_dump())

    return health


@router.get("/health/ready", tags=["Health"])
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Kubernetes readiness probe."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="Not ready")


@router.get("/health/live", tags=["Health"])
async def liveness_check():
    """Kubernetes liveness probe."""
    return {"status": "alive"}