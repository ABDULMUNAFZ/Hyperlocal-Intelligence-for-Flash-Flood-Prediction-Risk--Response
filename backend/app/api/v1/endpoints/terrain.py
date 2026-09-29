# FloodGuard Terrain & Soil Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from geoalchemy2.functions import ST_AsGeoJSON, ST_Value, ST_SetSRID, ST_MakePoint, ST_DWithin
from app.db.session import get_db
from app.models.terrain import TerrainTile, SlopeAspect, Watershed, RiverNetwork
from app.models.soil import SoilGrid, SoilProfile, SoilHydraulicProperties
from app.schemas.terrain import (
    TerrainTileResponse,
    ElevationQueryParams,
    ElevationResponse,
    ElevationProfileParams,
    ElevationProfileResponse,
    SlopeAspectQueryParams,
    SlopeAspectResponse,
    WatershedResponse,
    SoilPropertyResponse,
    SoilQueryParams,
    SoilProfileResponse,
    SoilHydraulicResponse,
)

router = APIRouter(prefix="/terrain", tags=["Terrain"])


@router.get("/tiles", response_model=List[TerrainTileResponse])
async def get_terrain_tiles(
    source: Optional[str] = None,
    bounds: Optional[str] = Query(None, description="minx,miny,maxx,maxy"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get terrain tiles."""
    query = select(TerrainTile)
    if source:
        query = query.where(TerrainTile.source == source)
    if bounds:
        try:
            minx, miny, maxx, maxy = map(float, bounds.split(","))
            from geoalchemy2.functions import ST_MakeEnvelope
            bbox = ST_MakeEnvelope(minx, miny, maxx, maxy, 4326)
            query = query.where(TerrainTile.geometry.ST_Intersects(bbox))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bounds format")

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/elevation", response_model=ElevationResponse)
async def get_elevation(
    params: ElevationQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Get elevation at a point from best available DEM."""
    point = ST_SetSRID(ST_MakePoint(params.longitude, params.latitude), 4326)

    query = select(TerrainTile).where(TerrainTile.geometry.ST_Contains(point))
    if params.source:
        query = query.where(TerrainTile.source == params.source)
    else:
        # Prefer higher resolution
        query = query.order_by(TerrainTile.resolution_m.asc())

    result = await db.execute(query.limit(1))
    tile = result.scalar_one_or_none()

    if not tile:
        raise HTTPException(status_code=404, detail="No elevation data available for this location")

    # Get elevation value from raster
    elev_query = select(ST_Value(tile.raster, 1, point)).select_from(select(tile).subquery())
    elevation = await db.scalar(elev_query)

    if elevation is None:
        # Fallback to tile statistics
        elevation = tile.mean_elevation

    return ElevationResponse(
        latitude=params.latitude,
        longitude=params.longitude,
        elevation_m=float(elevation) if elevation else 0,
        source=tile.source,
        resolution_m=tile.resolution_m,
    )


@router.post("/elevation/profile", response_model=ElevationProfileResponse)
async def get_elevation_profile(
    params: ElevationProfileParams,
    db: AsyncSession = Depends(get_db),
):
    """Get elevation profile along a line."""
    from geoalchemy2.functions import ST_MakeLine, ST_Transform, ST_Length, ST_LineInterpolatePoint
    from sqlalchemy import text

    if len(params.coordinates) < 2:
        raise HTTPException(status_code=400, detail="At least 2 coordinates required")

    # Create line from coordinates
    points = [ST_SetSRID(ST_MakePoint(lon, lat), 4326) for lon, lat in params.coordinates]
    line = ST_MakeLine(*points)

    # Sample points along line
    distances = []
    elevations = []
    coords = []

    for i in range(params.num_points):
        fraction = i / (params.num_points - 1)
        interp_query = select(ST_AsGeoJSON(ST_LineInterpolatePoint(line, fraction)))
        interp_result = await db.execute(interp_query)
        geom_json = interp_result.scalar_one()

        import json
        coord = json.loads(geom_json)["coordinates"]
        coords.append(coord)

        # Get elevation at this point
        point_geom = ST_SetSRID(ST_MakePoint(coord[0], coord[1]), 4326)
        tile_query = select(TerrainTile).where(TerrainTile.geometry.ST_Contains(point_geom))
        if params.source:
            tile_query = tile_query.where(TerrainTile.source == params.source)
        tile_query = tile_query.order_by(TerrainTile.resolution_m.asc()).limit(1)
        tile_result = await db.execute(tile_query)
        tile = tile_result.scalar_one_or_none()

        if tile:
            elev_query = select(ST_Value(tile.raster, 1, point_geom))
            elev = await db.scalar(elev_query)
            elevations.append(float(elev) if elev else tile.mean_elevation or 0)
        else:
            elevations.append(0)

        # Calculate cumulative distance
        if i == 0:
            distances.append(0)
        else:
            # Approximate distance
            import math
            prev = coords[-2]
            curr = coord
            d = math.sqrt((curr[0] - prev[0])**2 + (curr[1] - prev[1])**2) * 111000  # rough meters
            distances.append(distances[-1] + d)

    return ElevationProfileResponse(
        distances_m=distances,
        elevations_m=elevations,
        coordinates=coords,
    )


@router.get("/slope-aspect", response_model=SlopeAspectResponse)
async def get_slope_aspect(
    params: SlopeAspectQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Get slope, aspect, and derived terrain attributes at a point."""
    point = ST_SetSRID(ST_MakePoint(params.longitude, params.latitude), 4326)

    # Find terrain tile
    tile_query = select(TerrainTile).where(TerrainTile.geometry.ST_Contains(point)).limit(1)
    tile_result = await db.execute(tile_query)
    tile = tile_result.scalar_one_or_none()

    if not tile:
        raise HTTPException(status_code=404, detail="No terrain data available")

    # Get slope/aspect data
    sa_query = select(SlopeAspect).where(SlopeAspect.terrain_tile_id == tile.id)
    sa_result = await db.execute(sa_query)
    sa = sa_result.scalar_one_or_none()

    if not sa:
        raise HTTPException(status_code=404, detail="Slope/aspect not computed for this tile")

    # Sample values at point
    slope = await db.scalar(select(ST_Value(sa.slope_raster, 1, point)))
    aspect = await db.scalar(select(ST_Value(sa.aspect_raster, 1, point)))
    curvature = await db.scalar(select(ST_Value(sa.curvature_raster, 1, point))) if sa.curvature_raster else None
    flow_dir = await db.scalar(select(ST_Value(sa.flow_direction_raster, 1, point))) if sa.flow_direction_raster else None
    flow_acc = await db.scalar(select(ST_Value(sa.flow_accumulation_raster, 1, point))) if sa.flow_accumulation_raster else None
    twi = await db.scalar(select(ST_Value(sa.twi_raster, 1, point))) if sa.twi_raster else None
    spi = await db.scalar(select(ST_Value(sa.spi_raster, 1, point))) if sa.spi_raster else None

    return SlopeAspectResponse(
        latitude=params.latitude,
        longitude=params.longitude,
        slope_degrees=float(slope) if slope else 0,
        aspect_degrees=float(aspect) if aspect else 0,
        curvature=float(curvature) if curvature else None,
        flow_direction=int(flow_dir) if flow_dir else None,
        flow_accumulation=float(flow_acc) if flow_acc else None,
        twi=float(twi) if twi else None,
        spi=float(spi) if spi else None,
    )


@router.get("/watersheds", response_model=List[WatershedResponse])
async def get_watersheds(
    region_id: Optional[UUID] = None,
    min_area: float = Query(0, ge=0),
    max_area: Optional[float] = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get delineated watersheds."""
    query = select(Watershed).where(Watershed.area_sqkm >= min_area)
    if max_area:
        query = query.where(Watershed.area_sqkm <= max_area)
    if region_id:
        from app.models.core import Region
        query = query.join(Region, Watershed.geometry.ST_Within(Region.geometry)).where(Region.id == region_id)

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/watersheds/{watershed_id}/rivers")
async def get_watershed_rivers(
    watershed_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get river network for a watershed."""
    result = await db.execute(
        select(RiverNetwork).where(RiverNetwork.watershed_id == watershed_id)
    )
    rivers = result.scalars().all()
    return {"watershed_id": watershed_id, "rivers": rivers}


# Soil Router
soil_router = APIRouter(prefix="/soil", tags=["Soil"])


@soil_router.get("/properties", response_model=List[SoilPropertyResponse])
async def get_soil_properties(
    property_name: Optional[str] = None,
    depth_interval: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get available soil property grids."""
    query = select(SoilGrid)
    if property_name:
        query = query.where(SoilGrid.property_name == property_name)
    if depth_interval:
        query = query.where(SoilGrid.depth_interval == depth_interval)

    result = await db.execute(query)
    return result.scalars().all()


@soil_router.get("/profile", response_model=SoilProfileResponse)
async def get_soil_profile(
    params: SoilQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Get soil profile at a point."""
    point = ST_SetSRID(ST_MakePoint(params.longitude, params.latitude), 4326)

    # Find nearest soil profile
    profile_query = select(SoilProfile).order_by(SoilProfile.location.ST_Distance(point)).limit(1)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()

    if not profile:
        # Fall back to SoilGrids
        properties = {}
        if not params.properties:
            params.properties = ["ph", "soc", "bd", "clay", "sand", "silt", "cec", "nitrogen"]
        if not params.depths:
            params.depths = ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm", "100-200cm"]

        for prop in params.properties:
            properties[prop] = {}
            for depth in params.depths:
                grid_query = select(SoilGrid).where(
                    and_(
                        SoilGrid.property_name == prop,
                        SoilGrid.depth_interval == depth,
                        SoilGrid.geometry.ST_Contains(point),
                    )
                ).limit(1)
                grid_result = await db.execute(grid_query)
                grid = grid_result.scalar_one_or_none()
                if grid:
                    val = await db.scalar(select(ST_Value(grid.raster, 1, point)))
                    properties[prop][depth] = float(val) if val else grid.mean_value

        return SoilProfileResponse(
            latitude=params.latitude,
            longitude=params.longitude,
            properties=properties,
        )

    # Get hydraulic properties
    hydro_query = select(SoilHydraulicProperties).join(SoilGrid).where(
        SoilGrid.geometry.ST_Contains(point)
    ).limit(1)
    hydro_result = await db.execute(hydro_query)
    hydro = hydro_result.scalar_one_or_none()

    hydraulic = None
    if hydro:
        hydraulic = SoilHydraulicResponse(
            saturated_hydraulic_conductivity=hydro.saturated_hydraulic_conductivity,
            wetting_front_suction=hydro.wetting_front_suction,
            porosity=hydro.porosity,
            field_capacity=hydro.field_capacity,
            wilting_point=hydro.wilting_point,
            curve_number_amc2=hydro.curve_number_amc2,
            initial_infiltration_rate=hydro.initial_infiltration_rate,
            final_infiltration_rate=hydro.final_infiltration_rate,
            decay_constant=hydro.decay_constant,
        )

    return SoilProfileResponse(
        latitude=params.latitude,
        longitude=params.longitude,
        properties={},  # Would need to expand from profile.layers
        hydraulic_properties=hydraulic.model_dump() if hydraulic else None,
        taxonomy=profile.taxonomy,
        drainage_class=profile.drainage_class,
    )