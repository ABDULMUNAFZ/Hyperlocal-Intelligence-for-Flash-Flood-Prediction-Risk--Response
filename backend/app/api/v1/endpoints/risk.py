# FloodGuard Risk Prediction Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_DWithin, ST_AsGeoJSON
from app.db.session import get_db
from app.models.iot_sensor import FloodRisk, FloodRiskHistory
from app.models.core import Region
from app.schemas.risk import (
    FloodRiskResponse,
    FloodRiskQueryParams,
    FloodRiskSummaryResponse,
    RiskPredictionRequest,
    RiskPredictionResponse,
)

router = APIRouter(prefix="/risk", tags=["Flood Risk Prediction"])


@router.get("", response_model=List[FloodRiskResponse])
async def get_flood_risks(
    params: FloodRiskQueryParams = Depends(),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
):
    """Get flood risk scores."""
    query = select(FloodRisk)

    if params.region_id:
        query = query.where(FloodRisk.region_id == params.region_id)
    if params.latitude and params.longitude and params.radius_km:
        point = ST_SetSRID(ST_MakePoint(params.longitude, params.latitude), 4326)
        query = query.where(ST_DWithin(FloodRisk.location, point, params.radius_km * 1000))
    if params.min_risk is not None:
        query = query.where(FloodRisk.current_risk >= params.min_risk)
    if params.max_risk is not None:
        query = query.where(FloodRisk.current_risk <= params.max_risk)
    if params.grid_resolution_m:
        query = query.where(FloodRisk.grid_resolution_m == params.grid_resolution_m)
    if params.model_version:
        query = query.where(FloodRisk.model_version == params.model_version)
    if params.since:
        query = query.where(FloodRisk.computed_at >= params.since)

    # Determine which risk column to use based on forecast_hours
    if params.forecast_hours:
        if params.forecast_hours <= 24:
            risk_col = FloodRisk.forecast_24h_risk
        elif params.forecast_hours <= 48:
            risk_col = FloodRisk.forecast_48h_risk
        else:
            risk_col = FloodRisk.forecast_72h_risk
        query = query.where(risk_col.is_not(None)).order_by(risk_col.desc())
    else:
        query = query.order_by(FloodRisk.current_risk.desc())

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/summary/{region_id}", response_model=FloodRiskSummaryResponse)
async def get_risk_summary(
    region_id: UUID,
    forecast_hours: int = Query(0, ge=0, le=168),
    db: AsyncSession = Depends(get_db),
):
    """Get flood risk summary for a region."""
    # Verify region exists
    region = await db.get(Region, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    # Determine risk column
    if forecast_hours <= 24 and forecast_hours > 0:
        risk_col = FloodRisk.forecast_24h_risk
    elif forecast_hours <= 48:
        risk_col = FloodRisk.forecast_48h_risk
    elif forecast_hours <= 72:
        risk_col = FloodRisk.forecast_72h_risk
    else:
        risk_col = FloodRisk.current_risk

    # Aggregate statistics
    stats_query = select(
        func.count(FloodRisk.id).label("total_cells"),
        func.sum(func.case((risk_col > 0.7, 1), else_=0)).label("high_risk_cells"),
        func.sum(func.case((and_(risk_col > 0.3, risk_col <= 0.7), 1), else_=0)).label("moderate_risk_cells"),
        func.sum(func.case((risk_col <= 0.3, 1), else_=0)).label("low_risk_cells"),
        func.max(risk_col).label("max_risk"),
        func.avg(risk_col).label("mean_risk"),
    ).where(FloodRisk.region_id == region_id)

    if forecast_hours > 0:
        stats_query = stats_query.where(risk_col.is_not(None))

    result = await db.execute(stats_query)
    stats = result.one()

    # Get affected population and buildings (simplified)
    # In production, join with population grid and building footprints
    affected_pop = 0
    affected_buildings = 0

    # Get latest computation time and model version
    latest_query = select(FloodRisk.computed_at, FloodRisk.model_version).where(
        FloodRisk.region_id == region_id
    ).order_by(FloodRisk.computed_at.desc()).limit(1)
    latest_result = await db.execute(latest_query)
    latest = latest_result.one_or_none()

    # Calculate high risk area (approximate)
    cell_area_sqkm = (params.grid_resolution_m or 250) ** 2 / 1_000_000
    high_risk_area = (stats.high_risk_cells or 0) * cell_area_sqkm

    return FloodRiskSummaryResponse(
        region_id=region_id,
        region_name=region.name,
        total_cells=stats.total_cells or 0,
        high_risk_cells=stats.high_risk_cells or 0,
        moderate_risk_cells=stats.moderate_risk_cells or 0,
        low_risk_cells=stats.low_risk_cells or 0,
        max_risk=float(stats.max_risk or 0),
        mean_risk=float(stats.mean_risk or 0),
        high_risk_area_sqkm=high_risk_area,
        affected_population=affected_pop,
        affected_buildings=affected_buildings,
        computed_at=latest[0] if latest else datetime.utcnow(),
        model_version=latest[1] if latest else "unknown",
    )


@router.post("/predict", response_model=RiskPredictionResponse)
async def trigger_risk_prediction(
    request: RiskPredictionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a new flood risk prediction."""
    region = await db.get(Region, request.region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    # In production, this would queue a Celery task
    # For now, return a mock response
    import uuid
    prediction_id = uuid.uuid4()

    return RiskPredictionResponse(
        prediction_id=prediction_id,
        region_id=request.region_id,
        status="queued",
        estimated_completion_seconds=30,
        message="Risk prediction queued. Check back shortly for results.",
    )


@router.get("/history/{region_id}")
async def get_risk_history(
    region_id: UUID,
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Get historical risk scores for a location."""
    since = datetime.utcnow() - timedelta(days=days)
    point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

    query = select(FloodRiskHistory).where(
        and_(
            FloodRiskHistory.region_id == region_id,
            FloodRiskHistory.computed_at >= since,
            ST_DWithin(
                ST_SetSRID(ST_MakePoint(FloodRiskHistory.longitude, FloodRiskHistory.latitude), 4326),
                point,
                500  # 500m radius
            ),
        )
    ).order_by(FloodRiskHistory.computed_at)

    result = await db.execute(query)
    history = result.scalars().all()

    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "region_id": region_id,
        "period_days": days,
        "data_points": len(history),
        "history": history,
    }


@router.get("/map/{region_id}")
async def get_risk_map(
    region_id: UUID,
    forecast_hours: int = Query(0, ge=0, le=168),
    resolution: int = Query(250, ge=50, le=1000),
    format: str = Query("geojson", pattern="^(geojson|png|mvt)$"),
    db: AsyncSession = Depends(get_db),
):
    """Get risk map as GeoJSON, PNG, or MVT."""
    region = await db.get(Region, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    # Determine risk column
    if forecast_hours <= 24 and forecast_hours > 0:
        risk_col = FloodRisk.forecast_24h_risk
    elif forecast_hours <= 48:
        risk_col = FloodRisk.forecast_48h_risk
    elif forecast_hours <= 72:
        risk_col = FloodRisk.forecast_72h_risk
    else:
        risk_col = FloodRisk.current_risk

    # Get risk grid as GeoJSON
    query = select(
        ST_AsGeoJSON(FloodRisk.location).label("geometry"),
        risk_col.label("risk"),
        FloodRisk.uncertainty,
        FloodRisk.feature_contributions,
    ).where(
        and_(
            FloodRisk.region_id == region_id,
            FloodRisk.grid_resolution_m == resolution,
            risk_col.is_not(None),
        )
    ).limit(50000)

    result = await db.execute(query)
    features = []
    for row in result:
        import json
        geom = json.loads(row.geometry)
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "risk": float(row.risk),
                "uncertainty": float(row.uncertainty) if row.uncertainty else None,
                "components": row.feature_contributions,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "properties": {
            "region_id": str(region_id),
            "region_name": region.name,
            "forecast_hours": forecast_hours,
            "resolution_m": resolution,
            "generated_at": datetime.utcnow().isoformat(),
            "risk_col": risk_col.key,
        },
    }