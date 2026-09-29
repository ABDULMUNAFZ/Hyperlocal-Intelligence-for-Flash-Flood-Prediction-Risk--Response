# FloodGuard Regions Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from geoalchemy2.functions import ST_AsGeoJSON, ST_Centroid
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from app.db.session import get_db
from app.models.core import Region
from app.schemas.core import RegionResponse, RegionTreeResponse, RegionCreate, PaginatedResponse, PaginationParams

router = APIRouter(prefix="/regions", tags=["Regions"])


def _extract_centroid(centroid) -> Optional[dict]:
    if centroid is not None:
        try:
            return mapping(to_shape(centroid))
        except Exception:
            return None
    return None


def region_to_response(region: Region) -> RegionResponse:
    """Convert Region model to response with GeoJSON geometry."""
    return RegionResponse(
        id=region.id,
        name=region.name,
        name_local=region.name_local,
        level=region.level,
        parent_id=region.parent_id,
        state_code=region.state_code,
        district_code=region.district_code,
        census_code=region.census_code,
        area_sqkm=region.area_sqkm,
        population=region.population,
        centroid=_extract_centroid(region.centroid),
        metadata=region.extra_metadata or {},
        created_at=region.created_at,
        updated_at=region.updated_at,
    )


@router.get("", response_model=PaginatedResponse)
async def list_regions(
    pagination: PaginationParams = Depends(),
    level: Optional[int] = Query(None, ge=1, le=4),
    parent_id: Optional[UUID] = None,
    state_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List regions with optional filters."""
    query = select(Region)

    if level:
        query = query.where(Region.level == level)
    if parent_id:
        query = query.where(Region.parent_id == parent_id)
    if state_code:
        query = query.where(Region.state_code == state_code.upper())

    total = await db.scalar(select(func.count()).select_from(query.subquery()))

    query = query.order_by(Region.level, Region.name).offset(
        (pagination.page - 1) * pagination.page_size
    ).limit(pagination.page_size)

    result = await db.execute(query)
    regions = result.scalars().all()

    return PaginatedResponse(
        items=[region_to_response(r) for r in regions],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size,
    )


@router.get("/tree", response_model=List[RegionTreeResponse])
async def get_region_tree(
    state_code: Optional[str] = None,
    max_level: int = Query(4, ge=1, le=4),
    db: AsyncSession = Depends(get_db),
):
    """Get hierarchical region tree for South India."""
    query = select(Region).where(Region.level == 1)  # States
    if state_code:
        query = query.where(Region.state_code == state_code.upper())

    result = await db.execute(query)
    states = result.scalars().all()

    async def build_tree(region: Region, current_level: int) -> RegionTreeResponse:
        if current_level >= max_level:
            children = []
        else:
            child_query = select(Region).where(Region.parent_id == region.id).order_by(Region.name)
            child_result = await db.execute(child_query)
            children_models = child_result.scalars().all()
            children = [await build_tree(c, current_level + 1) for c in children_models]

        return RegionTreeResponse(
            id=region.id,
            name=region.name,
            name_local=region.name_local,
            level=region.level,
            parent_id=region.parent_id,
            state_code=region.state_code,
            district_code=region.district_code,
            census_code=region.census_code,
            centroid=_extract_centroid(region.centroid),
            area_sqkm=region.area_sqkm,
            population=region.population,
            metadata=region.extra_metadata or {},
            created_at=region.created_at,
            updated_at=region.updated_at,
            children=children,
        )

    return [await build_tree(state, 1) for state in states]


@router.get("/{region_id}", response_model=RegionResponse)
async def get_region(
    region_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get region by ID."""
    result = await db.execute(select(Region).where(Region.id == region_id))
    region = result.scalar_one_or_none()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return region_to_response(region)


@router.post("", response_model=RegionResponse, status_code=201)
async def create_region(
    region_in: RegionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new region (admin only)."""
    region = Region(**region_in.model_dump())
    db.add(region)
    await db.commit()
    await db.refresh(region)
    return region_to_response(region)


@router.get("/{region_id}/children", response_model=List[RegionResponse])
async def get_region_children(
    region_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get direct children of a region."""
    result = await db.execute(
        select(Region).where(Region.parent_id == region_id).order_by(Region.name)
    )
    return [region_to_response(r) for r in result.scalars().all()]


@router.get("/{region_id}/geometry")
async def get_region_geometry(
    region_id: UUID,
    simplify: float = Query(0, ge=0, description="Simplify tolerance in degrees"),
    db: AsyncSession = Depends(get_db),
):
    """Get region geometry as GeoJSON."""
    from geoalchemy2.functions import ST_SimplifyPreserveTopology

    query = select(ST_AsGeoJSON(Region.geometry).label("geojson")).where(Region.id == region_id)
    if simplify > 0:
        query = select(ST_AsGeoJSON(ST_SimplifyPreserveTopology(Region.geometry, simplify))).where(Region.id == region_id)

    result = await db.execute(query)
    geojson = result.scalar_one_or_none()
    if not geojson:
        raise HTTPException(status_code=404, detail="Region not found")

    import json
    return json.loads(geojson)