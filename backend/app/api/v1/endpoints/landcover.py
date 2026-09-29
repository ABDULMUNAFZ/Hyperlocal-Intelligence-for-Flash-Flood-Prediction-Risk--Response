# FloodGuard Land Cover Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from app.db.session import get_db
from app.models.landcover import LandCoverGrid, LandCoverClass, BuildingFootprint, RoadNetwork, CriticalInfrastructure

router = APIRouter(prefix="/landcover", tags=["Land Cover"])


@router.get("/grids", response_model=List[dict])
async def list_landcover_grids(
    source: Optional[str] = None,
    year: Optional[int] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List land cover grids."""
    query = select(LandCoverGrid)
    if source:
        query = query.where(LandCoverGrid.source == source)
    if year:
        query = query.where(LandCoverGrid.year == year)
    query = query.order_by(LandCoverGrid.year.desc()).limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "source": r.source,
            "product": r.product,
            "year": r.year,
            "resolution_m": r.resolution_m,
            "class_distribution": r.class_distribution,
        }
        for r in result.scalars().all()
    ]


@router.get("/classes", response_model=List[dict])
async def list_landcover_classes(
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List land cover class definitions."""
    query = select(LandCoverClass)
    if source:
        query = query.where(LandCoverClass.source == source)
    result = await db.execute(query)
    return [
        {
            "class_value": r.class_value,
            "class_name": r.class_name,
            "manning_n": r.manning_n,
            "curve_number": r.curve_number,
            "impervious_fraction": r.impervious_fraction,
        }
        for r in result.scalars().all()
    ]


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
    return [{"id": str(r.id), "type": r.building_type, "area_sqm": r.area_sqm} for r in result.scalars().all()]


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
    return [{"id": str(r.id), "type": r.highway_type, "length_m": r.length_m} for r in result.scalars().all()]


@router.get("/infrastructure", response_model=List[dict])
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
            "geometry": r.geometry,
            "capacity": r.capacity,
        }
        for r in result.scalars().all()
    ]