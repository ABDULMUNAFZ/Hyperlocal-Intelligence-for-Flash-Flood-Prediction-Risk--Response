# FloodGuard Flood Simulation Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from geoalchemy2.functions import ST_AsGeoJSON, ST_SetSRID, ST_MakePoint
from app.db.session import get_db
from app.models.simulation import FloodSimulation, FloodSimulationTimeSeries, WhatIfScenario, SimulationStatus
from app.schemas.simulation import (
    FloodSimulationCreate,
    FloodSimulationUpdate,
    FloodSimulationResponse,
    FloodSimulationStatusResponse,
    FloodSimulationResultResponse,
    WhatIfScenarioCreate,
    WhatIfScenarioResponse,
    SimulationQueryParams,
)

router = APIRouter(prefix="/simulations", tags=["Flood Simulation"])


@router.post("", response_model=FloodSimulationResponse, status_code=201)
async def create_simulation(
    sim_in: FloodSimulationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Create and queue a new flood simulation."""
    sim = FloodSimulation(**sim_in.model_dump())
    db.add(sim)
    await db.commit()
    await db.refresh(sim)

    # Queue simulation task (in production, use Celery)
    background_tasks.add_task(run_simulation_task, sim.id)

    return sim


async def run_simulation_task(simulation_id: UUID):
    """Background task to run simulation.

    No hydrodynamic solver is configured in this deployment, so the job is marked
    FAILED with an explanatory message instead of writing placeholder results.
    See GET /api/v1/geo/simulation/capabilities.
    """
    from app.db.session import async_session_maker
    async with async_session_maker() as db:
        sim = await db.get(FloodSimulation, simulation_id)
        if sim:
            sim.status = SimulationStatus.FAILED
            sim.started_at = datetime.utcnow()
            sim.completed_at = datetime.utcnow()
            sim.error_message = (
                "Simulation engine unavailable: no hydrodynamic flood solver is configured. "
                "No depth, extent or impact values were produced."
            )
            await db.commit()


@router.get("", response_model=List[FloodSimulationResponse])
async def list_simulations(
    params: SimulationQueryParams = Depends(),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List flood simulations."""
    query = select(FloodSimulation)

    if params.status:
        query = query.where(FloodSimulation.status == params.status)
    if params.scenario_type:
        query = query.where(FloodSimulation.scenario_type == params.scenario_type)
    if params.created_by:
        query = query.where(FloodSimulation.created_by == params.created_by)
    if params.region_id:
        from app.models.core import Region
        query = query.join(Region, FloodSimulation.simulation_area.ST_Within(Region.geometry)).where(Region.id == params.region_id)
    if params.since:
        query = query.where(FloodSimulation.created_at >= params.since)

    query = query.order_by(FloodSimulation.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{sim_id}", response_model=FloodSimulationResponse)
async def get_simulation(
    sim_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get simulation by ID."""
    result = await db.execute(
        select(FloodSimulation).where(FloodSimulation.id == sim_id)
    )
    sim = result.scalar_one_or_none()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return sim


@router.get("/{sim_id}/status", response_model=FloodSimulationStatusResponse)
async def get_simulation_status(
    sim_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get simulation status."""
    result = await db.execute(
        select(FloodSimulation).where(FloodSimulation.id == sim_id)
    )
    sim = result.scalar_one_or_none()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    progress = None
    if sim.status == SimulationStatus.RUNNING:
        # Calculate progress from time series
        ts_count = await db.scalar(
            select(func.count(FloodSimulationTimeSeries.id)).where(
                FloodSimulationTimeSeries.simulation_id == sim_id
            )
        )
        # Estimate total timesteps
        total_ts = int(sim.simulation_duration_hours * 3600 / (sim.timestep_seconds or 60))
        if total_ts > 0:
            progress = min(100, (ts_count / total_ts) * 100)

    return FloodSimulationStatusResponse(
        id=sim.id,
        status=sim.status.value,
        progress_percent=progress,
        current_timestep=ts_count if sim.status == SimulationStatus.RUNNING else None,
        total_timesteps=total_ts if sim.status == SimulationStatus.RUNNING else None,
        error_message=sim.error_message,
    )


@router.get("/{sim_id}/results", response_model=FloodSimulationResultResponse)
async def get_simulation_results(
    sim_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get simulation results."""
    sim = await db.get(FloodSimulation, sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    if sim.status != SimulationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Simulation not completed")

    # Get time series
    ts_result = await db.execute(
        select(FloodSimulationTimeSeries)
        .where(FloodSimulationTimeSeries.simulation_id == sim_id)
        .order_by(FloodSimulationTimeSeries.timestep)
    )
    time_series = ts_result.scalars().all()

    ts_data = []
    for ts in time_series:
        ts_data.append({
            "timestep": ts.timestep,
            "simulation_time_hours": ts.simulation_time_hours,
            "flooded_area_sqkm": ts.flooded_area_sqkm,
            "max_depth_m": ts.max_depth_m,
            "max_velocity_ms": ts.max_velocity_ms,
        })

    return FloodSimulationResultResponse(
        simulation_id=sim.id,
        max_depth={"raster_id": str(sim.max_depth_raster) if sim.max_depth_raster else None, "stats": {"max": sim.max_depth_m}},
        max_velocity={"raster_id": str(sim.max_velocity_raster) if sim.max_velocity_raster else None, "stats": {"max": sim.max_velocity_ms}},
        arrival_time={"raster_id": str(sim.arrival_time_raster) if sim.arrival_time_raster else None, "stats": {}},
        flood_extent={"raster_id": str(sim.flood_extent_raster) if sim.flood_extent_raster else None, "stats": {"area_sqkm": sim.flooded_area_sqkm}},
        time_series=ts_data,
        summary={
            "max_depth_m": sim.max_depth_m,
            "max_velocity_ms": sim.max_velocity_ms,
            "flooded_area_sqkm": sim.flooded_area_sqkm,
            "flooded_volume_m3": sim.flooded_volume_m3,
            "affected_population": sim.affected_population,
            "affected_buildings": sim.affected_buildings,
            "affected_roads_km": sim.affected_roads_km,
        },
    )


@router.delete("/{sim_id}", status_code=204)
async def delete_simulation(
    sim_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a simulation."""
    sim = await db.get(FloodSimulation, sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    await db.delete(sim)
    await db.commit()


# What-If Scenarios
whatif_router = APIRouter(prefix="/what-if", tags=["What-If Scenarios"])


@whatif_router.post("", response_model=WhatIfScenarioResponse, status_code=201)
async def create_whatif_scenario(
    scenario_in: WhatIfScenarioCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a what-if scenario template."""
    scenario = WhatIfScenario(**scenario_in.model_dump())
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@whatif_router.get("", response_model=List[WhatIfScenarioResponse])
async def list_whatif_scenarios(
    category: Optional[str] = None,
    region_id: Optional[UUID] = None,
    is_template: Optional[bool] = None,
    is_public: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List what-if scenarios."""
    query = select(WhatIfScenario)
    if category:
        query = query.where(WhatIfScenario.category == category)
    if region_id:
        query = query.where(WhatIfScenario.region_id == region_id)
    if is_template is not None:
        query = query.where(WhatIfScenario.is_template == is_template)
    if is_public is not None:
        query = query.where(WhatIfScenario.is_public == is_public)

    query = query.order_by(WhatIfScenario.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@whatif_router.get("/{scenario_id}", response_model=WhatIfScenarioResponse)
async def get_whatif_scenario(
    scenario_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get what-if scenario by ID."""
    scenario = await db.get(WhatIfScenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@whatif_router.post("/{scenario_id}/run", response_model=FloodSimulationResponse)
async def run_whatif_scenario(
    scenario_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Run a what-if scenario as a simulation."""
    scenario = await db.get(WhatIfScenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Create simulation from scenario parameters
    sim = FloodSimulation(
        name=f"What-If: {scenario.name}",
        description=scenario.description,
        scenario_type="what_if",
        rainfall_scenario=scenario.parameters.get("rainfall_scenario", {}),
        antecedent_conditions=scenario.parameters.get("antecedent_conditions", {}),
        simulation_area=scenario.parameters.get("simulation_area"),
        grid_resolution_m=scenario.parameters.get("grid_resolution_m", 30),
        model_type=scenario.parameters.get("model_type", "shallow_water_2d"),
        solver=scenario.parameters.get("solver", "cpu"),
        simulation_duration_hours=scenario.parameters.get("simulation_duration_hours", 24),
        infiltration_model=scenario.parameters.get("infiltration_model"),
        routing_method=scenario.parameters.get("routing_method"),
        created_by=scenario.created_by,
    )
    db.add(sim)
    await db.commit()
    await db.refresh(sim)

    background_tasks.add_task(run_simulation_task, sim.id)

    return sim