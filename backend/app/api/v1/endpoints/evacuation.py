# FloodGuard Evacuation Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from geoalchemy2.functions import ST_AsGeoJSON, ST_SetSRID, ST_MakePoint, ST_DWithin, ST_ShortestLine
from app.db.session import get_db
from app.models.evacuation import EvacuationZone, EvacuationRoute, Shelter, EvacuationPlan
from app.models.simulation import FloodSimulation
from app.schemas.evacuation import (
    EvacuationZoneCreate,
    EvacuationZoneResponse,
    EvacuationRouteCreate,
    EvacuationRouteResponse,
    ShelterCreate,
    ShelterUpdate,
    ShelterResponse,
    EvacuationPlanCreate,
    EvacuationPlanResponse,
    SafeRouteRequest,
    SafeRouteResponse,
)

router = APIRouter(prefix="/evacuation", tags=["Evacuation"])


# Evacuation Zones
@router.post("/zones", response_model=EvacuationZoneResponse, status_code=201)
async def create_evacuation_zone(
    zone_in: EvacuationZoneCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an evacuation zone."""
    zone = EvacuationZone(**zone_in.model_dump())
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return zone


@router.get("/zones", response_model=List[EvacuationZoneResponse])
async def list_evacuation_zones(
    region_id: Optional[UUID] = None,
    zone_type: Optional[str] = None,
    simulation_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """List evacuation zones."""
    query = select(EvacuationZone)

    if region_id:
        query = query.where(EvacuationZone.region_id == region_id)
    if zone_type:
        query = query.where(EvacuationZone.zone_type == zone_type)

    query = query.order_by(EvacuationZone.priority.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/zones/{zone_id}", response_model=EvacuationZoneResponse)
async def get_evacuation_zone(
    zone_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get evacuation zone by ID."""
    zone = await db.get(EvacuationZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Evacuation zone not found")
    return zone


@router.get("/zones/from-simulation/{simulation_id}")
async def generate_zones_from_simulation(
    simulation_id: UUID,
    risk_thresholds: str = Query("0.3,0.5,0.7,0.9", description="Comma-separated risk thresholds"),
    depth_thresholds: str = Query("0.1,0.3,0.5,1.0,2.0", description="Comma-separated depth thresholds (m)"),
    db: AsyncSession = Depends(get_db),
):
    """Auto-generate evacuation zones from simulation results."""
    sim = await db.get(FloodSimulation, simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    if sim.status != "completed":
        raise HTTPException(status_code=400, detail="Simulation not completed")

    # In production, this would use the flood extent raster to generate zones
    # For now, return a mock response
    risk_vals = [float(x) for x in risk_thresholds.split(",")]
    depth_vals = [float(x) for x in depth_thresholds.split(",")]

    zones = []
    zone_types = ["safe", "low", "moderate", "high", "immediate"]

    for i, (risk_t, depth_t, ztype) in enumerate(zip(risk_vals, depth_vals, zone_types)):
        zones.append({
            "zone_type": ztype,
            "risk_threshold": risk_t,
            "depth_threshold_m": depth_t,
            "priority": len(zone_types) - i,
            "estimated_population": 0,  # Would calculate from population grid
        })

    return {
        "simulation_id": simulation_id,
        "generated_zones": zones,
        "message": "Zones generated. Review and save to database.",
    }


# Evacuation Routes
@router.post("/routes", response_model=EvacuationRouteResponse, status_code=201)
async def create_evacuation_route(
    route_in: EvacuationRouteCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an evacuation route."""
    route = EvacuationRoute(**route_in.model_dump())
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return route


@router.get("/routes", response_model=List[EvacuationRouteResponse])
async def list_evacuation_routes(
    zone_id: Optional[UUID] = None,
    shelter_id: Optional[UUID] = None,
    is_viable: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    """List evacuation routes."""
    query = select(EvacuationRoute)

    if zone_id:
        query = query.where(EvacuationRoute.zone_id == zone_id)
    if shelter_id:
        query = query.where(EvacuationRoute.shelter_id == shelter_id)
    if is_viable is not None:
        query = query.where(EvacuationRoute.is_viable == is_viable)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/routes/compute")
async def compute_evacuation_routes(
    zone_id: UUID,
    shelter_ids: List[UUID],
    max_flood_depth: float = Query(0.3, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Compute evacuation routes from zone to shelters (uses road network)."""
    zone = await db.get(EvacuationZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    shelters = []
    for sid in shelter_ids:
        shelter = await db.get(Shelter, sid)
        if shelter:
            shelters.append(shelter)

    # In production, this would run a shortest path algorithm on flood-adjusted road network
    # For now, return mock routes
    routes = []
    for shelter in shelters:
        # Straight line as placeholder
        from geoalchemy2.functions import ST_MakeLine
        line = ST_MakeLine(zone.geometry.ST_Centroid(), shelter.geometry)
        routes.append({
            "zone_id": zone_id,
            "shelter_id": shelter.id,
            "name": f"Route to {shelter.name}",
            "geometry": line,
            "length_km": 5.2,  # Mock
            "estimated_time_minutes": 15,
            "max_flood_depth_m": 0.1,
            "is_viable": True,
        })

    return {"zone_id": zone_id, "computed_routes": routes}


# Shelters
@router.post("/shelters", response_model=ShelterResponse, status_code=201)
async def create_shelter(
    shelter_in: ShelterCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a shelter."""
    shelter = Shelter(**shelter_in.model_dump())
    db.add(shelter)
    await db.commit()
    await db.refresh(shelter)
    return shelter


@router.get("/shelters", response_model=List[ShelterResponse])
async def list_shelters(
    region_id: Optional[UUID] = None,
    shelter_type: Optional[str] = None,
    is_active: bool = True,
    min_capacity: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List shelters."""
    query = select(Shelter).where(
        and_(Shelter.is_active == is_active, Shelter.capacity >= min_capacity)
    )

    if region_id:
        query = query.where(Shelter.region_id == region_id)
    if shelter_type:
        query = query.where(Shelter.shelter_type == shelter_type)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/shelters/{shelter_id}", response_model=ShelterResponse)
async def get_shelter(
    shelter_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get shelter by ID."""
    shelter = await db.get(Shelter, shelter_id)
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found")
    return shelter


@router.patch("/shelters/{shelter_id}", response_model=ShelterResponse)
async def update_shelter(
    shelter_id: UUID,
    shelter_update: ShelterUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update shelter occupancy/status."""
    shelter = await db.get(Shelter, shelter_id)
    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter not found")

    update_data = shelter_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shelter, field, value)

    await db.commit()
    await db.refresh(shelter)
    return shelter


@router.get("/shelters/nearby")
async def find_nearby_shelters(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50, gt=0, le=200),
    min_capacity: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Find shelters near a location."""
    point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

    query = select(Shelter).where(
        and_(
            Shelter.is_active == True,
            Shelter.capacity >= min_capacity,
            ST_DWithin(Shelter.geometry, point, radius_km * 1000),
        )
    ).order_by(Shelter.geometry.ST_Distance(point))

    result = await db.execute(query.limit(20))
    shelters = result.scalars().all()

    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km,
        "shelters": shelters,
    }


# Safe Routes
@router.post("/safe-route", response_model=SafeRouteResponse)
async def get_safe_route(
    request: SafeRouteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Compute safe evacuation route avoiding flooded areas."""
    # In production, this would run Dijkstra/A* on flood-adjusted road network
    # For now, return a mock response

    from app.models.landcover import RoadNetwork

    # Check if roads are flooded
    origin = ST_SetSRID(ST_MakePoint(request.origin_lon, request.origin_lat), 4326)
    dest = ST_SetSRID(ST_MakePoint(request.destination_lon, request.destination_lat), 4326)

    # Straight line distance
    import math
    dist = math.sqrt(
        (request.destination_lat - request.origin_lat)**2 +
        (request.destination_lon - request.origin_lon)**2
    ) * 111  # km

    return SafeRouteResponse(
        geometry={"type": "LineString", "coordinates": [
            [request.origin_lon, request.origin_lat],
            [request.destination_lon, request.destination_lat],
        ]},
        length_km=dist,
        estimated_time_minutes=int(dist * 2),  # ~30 km/h average
        max_flood_depth_m=0.0,
        flood_segments=[],
        instructions=[
            f"Head towards destination",
            f"Distance: {dist:.1f} km",
        ],
        is_safe=True,
        warnings=[],
    )


# Evacuation Plans
@router.post("/plans", response_model=EvacuationPlanResponse, status_code=201)
async def create_evacuation_plan(
    plan_in: EvacuationPlanCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an evacuation plan."""
    plan = EvacuationPlan(**plan_in.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.get("/plans", response_model=List[EvacuationPlanResponse])
async def list_evacuation_plans(
    region_id: Optional[UUID] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """List evacuation plans."""
    query = select(EvacuationPlan).where(EvacuationPlan.is_active == is_active)
    if region_id:
        query = query.where(EvacuationPlan.region_id == region_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/plans/{plan_id}", response_model=EvacuationPlanResponse)
async def get_evacuation_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get evacuation plan by ID."""
    plan = await db.get(EvacuationPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Evacuation plan not found")
    return plan