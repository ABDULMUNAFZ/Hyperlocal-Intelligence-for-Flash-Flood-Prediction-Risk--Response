# FloodGuard FastAPI Application
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.db.session import init_db, close_db
from app.api.v1.endpoints import (
    prediction,
    health,
    auth,
    users,
    regions,
    data_sources,
    weather,
    terrain,
    landcover,
    infrastructure,
    population,
    historical_flood,
    iot_sensors,
    risk,
    simulation,
    evacuation,
    alerts,
    ai_assistant,
    health,
    data_status,
    geo,
    geo_sim,
    live,
    emergency,
    catalyst_center,
    model_observability,
)
from app.data.pipelines.iot import iot_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title="FloodGuard API",
    description="Flash Flood Prediction System for Hilly Regions - SIH 26192",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression — except for Server-Sent Events, which must not be buffered
class SelectiveGZipMiddleware:
    def __init__(self, app, minimum_size: int = 1000):
        self.app = app
        self.gzip = GZipMiddleware(app, minimum_size=minimum_size)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"].endswith("/live/stream"):
            return await self.app(scope, receive, send)
        return await self.gzip(scope, receive, send)


app.add_middleware(SelectiveGZipMiddleware, minimum_size=1000)

@app.get("/health", tags=["Health"], include_in_schema=False)
async def root_health():
    """Liveness for container / load-balancer checks (no dependencies). Full checks: /api/v1/health."""
    return {"status": "ok", "service": "floodguard-api"}


# Include routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(regions.router, prefix="/api/v1")
app.include_router(data_sources.router, prefix="/api/v1")
app.include_router(weather.router, prefix="/api/v1")
app.include_router(terrain.router, prefix="/api/v1")
app.include_router(landcover.router, prefix="/api/v1")
app.include_router(infrastructure.router, prefix="/api/v1")
app.include_router(population.router, prefix="/api/v1")
app.include_router(historical_flood.router, prefix="/api/v1")
app.include_router(iot_sensors.router, prefix="/api/v1")
app.include_router(iot_router, prefix="/api/v1")  # IoT ingestion interface
app.include_router(data_status.router, prefix="/api/v1")
app.include_router(prediction.router, prefix="")  # Data source status
app.include_router(risk.router, prefix="/api/v1")
app.include_router(simulation.router, prefix="/api/v1")
app.include_router(evacuation.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(ai_assistant.router, prefix="/api/v1")
app.include_router(geo.router, prefix="/api/v1")
app.include_router(geo_sim.router, prefix="/api/v1")
app.include_router(live.router, prefix="/api/v1")
app.include_router(emergency.push_router, prefix="/api/v1")
app.include_router(emergency.router, prefix="/api/v1")
app.include_router(emergency.rescue_router, prefix="/api/v1")
app.include_router(emergency.safe_router, prefix="/api/v1")
app.include_router(catalyst_center.router, prefix="/api/v1")  # Cisco Catalyst Center (optional, read-only)
app.include_router(model_observability.router, prefix="/api/v1")  # Model observability (optional Arize AI export)


@app.get("/")
async def root():
    return {
        "name": "FloodGuard API",
        "version": "1.0.0",
        "description": "Flash Flood Prediction System for Hilly Regions",
        "docs": "/docs",
    }


@app.get("/api/v1", tags=["Health"])
@app.get("/api/v1/", include_in_schema=False)
async def api_index():
    """Index of the v1 API (the prefix itself has no resource of its own)."""
    return {
        "name": "FloodGuard API",
        "version": "1.0.0",
        "api": "v1",
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "links": {
            "health": "/api/v1/health",
            "liveness": "/health",
            "docs": "/docs",
            "openapi": "/openapi.json",
            "live_stream": "/api/v1/live/stream",
        },
    }