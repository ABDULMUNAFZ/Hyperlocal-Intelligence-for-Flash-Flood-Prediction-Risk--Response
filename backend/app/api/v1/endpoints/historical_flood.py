# FloodGuard Historical Flood Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from app.db.session import get_db
from app.models.population import HistoricalFloodEvent, HistoricalFloodExtent

router = APIRouter(prefix="/historical-floods", tags=["Historical Floods"])


@router.get("", response_model=List[dict])
async def list_historical_floods(
    state: Optional[str] = None,
    district: Optional[str] = None,
    flood_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    is_verified: Optional[bool] = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List historical flood events."""
    query = select(HistoricalFloodEvent)
    if state:
        query = query.where(HistoricalFloodEvent.state.ilike(f"%{state}%"))
    if district:
        query = query.where(HistoricalFloodEvent.district.ilike(f"%{district}%"))
    if flood_type:
        query = query.where(HistoricalFloodEvent.flood_type == flood_type)
    if start_date:
        query = query.where(HistoricalFloodEvent.start_date >= start_date)
    if end_date:
        query = query.where(HistoricalFloodEvent.start_date <= end_date)
    if is_verified is not None:
        query = query.where(HistoricalFloodEvent.is_verified == is_verified)

    query = query.order_by(HistoricalFloodEvent.start_date.desc()).limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "event_id": r.event_id,
            "name": r.name,
            "source": r.source,
            "flood_type": r.flood_type,
            "cause": r.cause,
            "start_date": r.start_date,
            "end_date": r.end_date,
            "state": r.state,
            "district": r.district,
            "fatalities": r.fatalities,
            "affected_population": r.affected_population,
            "economic_loss_usd": r.economic_loss_usd,
        }
        for r in result.scalars().all()
    ]


@router.get("/{event_id}", response_model=dict)
async def get_historical_flood(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get historical flood event by ID."""
    event = await db.get(HistoricalFloodEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Get extents
    extents_result = await db.execute(
        select(HistoricalFloodExtent).where(HistoricalFloodExtent.event_id == event_id)
    )
    extents = extents_result.scalars().all()

    return {
        "id": str(event.id),
        "event_id": event.event_id,
        "name": event.name,
        "source": event.source,
        "flood_type": event.flood_type,
        "cause": event.cause,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "duration_days": event.duration_days,
        "state": event.state,
        "district": event.district,
        "affected_area_sqkm": event.affected_area_sqkm,
        "fatalities": event.fatalities,
        "injured": event.injured,
        "displaced": event.displaced,
        "affected_population": event.affected_population,
        "houses_damaged": event.houses_damaged,
        "houses_destroyed": event.houses_destroyed,
        "economic_loss_usd": event.economic_loss_usd,
        "max_rainfall_mm": event.max_rainfall_mm,
        "antecedent_rainfall_mm": event.antecedent_rainfall_mm,
        "is_verified": event.is_verified,
        "extents": [
            {
                "observation_date": e.observation_date,
                "satellite": e.satellite,
                "area_sqkm": e.area_sqkm,
                "confidence": e.confidence,
            }
            for e in extents
        ],
    }


@router.get("/nearby")
async def get_nearby_floods(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50, gt=0, le=200),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get historical floods near a location."""
    from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_DWithin
    point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

    query = select(HistoricalFloodEvent).where(
        ST_DWithin(HistoricalFloodEvent.centroid, point, radius_km * 1000)
    ).order_by(HistoricalFloodEvent.start_date.desc()).limit(limit)

    result = await db.execute(query)
    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km,
        "events": [
            {
                "id": str(r.id),
                "name": r.name,
                "start_date": r.start_date,
                "flood_type": r.flood_type,
                "fatalities": r.fatalities,
                "distance_km": 0,  # Would compute from centroid
            }
            for r in result.scalars().all()
        ],
    }