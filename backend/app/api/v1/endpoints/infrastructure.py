# FloodGuard Infrastructure Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from app.db.session import get_db
from app.models.landcover import BuildingFootprint, RoadNetwork, CriticalInfrastructure

router = APIRouter(prefix="/infrastructure", tags=["Infrastructure"])


@router.get("/buildings", response_model=List[dict])
async def get_buildings(
    region_id: Optional[UUID] = None,
    building_type: Optional[str] = None,
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
):
    """Get building footprints."""
    query = select(BuildingFootprint)
    if region_id:
        from app.models.core import Region
        query = query.join(Region, BuildingFootprint.geometry.ST_Within(Region.geometry)).where(Region.id == region_id)
    if building_type:
        query = query.where(BuildingFootprint.building_type == building_type)
    query = query.limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "source": r.source,
            "building_type": r.building_type,
            "use": r.use,
            "area_sqm": r.area_sqm,
            "height_m": r.height_m,
            "levels": r.levels,
            "population": r.population,
        }
        for r in result.scalars().all()
    ]


@router.get("/roads", response_model=List[dict])
async def get_roads(
    region_id: Optional[UUID] = None,
    highway_type: Optional[str] = None,
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
):
    """Get road network."""
    query = select(RoadNetwork)
    if region_id:
        from app.models.core import Region
        query = query.join(Region, RoadNetwork.geometry.ST_Within(Region.geometry)).where(Region.id == region_id)
    if highway_type:
        query = query.where(RoadNetwork.highway_type == highway_type)
    query = query.limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "source": r.source,
            "highway_type": r.highway_type,
            "surface": r.surface,
            "lanes": r.lanes,
            "max_speed_kmh": r.max_speed_kmh,
            "length_m": r.length_m,
            "flood_vulnerability": r.flood_vulnerability,
        }
        for r in result.scalars().all()
    ]


@router.get("/critical", response_model=List[dict])
async def get_critical_infrastructure(
    region_id: Optional[UUID] = None,
    category: Optional[str] = None,
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    """Get critical infrastructure."""
    query = select(CriticalInfrastructure)
    if region_id:
        from app.models.core import Region
        query = query.join(Region, CriticalInfrastructure.geometry.ST_Within(Region.geometry)).where(Region.id == region_id)
    if category:
        query = query.where(CriticalInfrastructure.category == category)
    query = query.limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "category": r.category,
            "subcategory": r.subcategory,
            "capacity": r.capacity,
            "is_emergency_facility": r.is_emergency_facility,
            "backup_power": r.backup_power,
        }
        for r in result.scalars().all()
    ]


@router.get("/exposure/{simulation_id}")
async def get_infrastructure_exposure(
    simulation_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get infrastructure exposure from flood simulation."""
    # In production, this would compute exposure by intersecting simulation results with infrastructure
    from app.models.simulation import FloodSimulation
    sim = await db.get(FloodSimulation, simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return {
        "simulation_id": simulation_id,
        "buildings_affected": sim.affected_buildings or 0,
        "roads_affected_km": sim.affected_roads_km or 0,
        "critical_infrastructure_at_risk": [],
        "message": "Detailed exposure analysis would be computed here",
    }