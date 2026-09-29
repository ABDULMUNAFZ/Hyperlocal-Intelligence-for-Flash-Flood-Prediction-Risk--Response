# FloodGuard Population Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from app.db.session import get_db
from app.models.population import PopulationGrid, PopulationStats

router = APIRouter(prefix="/population", tags=["Population"])


@router.get("/grids", response_model=List[dict])
async def list_population_grids(
    source: Optional[str] = None,
    year: Optional[int] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List population grids."""
    query = select(PopulationGrid)
    if source:
        query = query.where(PopulationGrid.source == source)
    if year:
        query = query.where(PopulationGrid.year == year)
    query = query.order_by(PopulationGrid.year.desc()).limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "source": r.source,
            "product": r.product,
            "year": r.year,
            "resolution_m": r.resolution_m,
            "total_population": r.total_population,
        }
        for r in result.scalars().all()
    ]


@router.get("/stats/{region_id}", response_model=List[dict])
async def get_population_stats(
    region_id: UUID,
    year: Optional[int] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get population statistics for a region."""
    query = select(PopulationStats).where(PopulationStats.region_id == region_id)
    if year:
        query = query.where(PopulationStats.year == year)
    if source:
        query = query.where(PopulationStats.source == source)
    result = await db.execute(query)
    return [
        {
            "year": r.year,
            "source": r.source,
            "total_population": r.total_population,
            "male_population": r.male_population,
            "female_population": r.female_population,
            "age_0_14": r.age_0_14,
            "age_15_64": r.age_15_64,
            "age_65_plus": r.age_65_plus,
            "population_density": r.population_density,
            "vulnerable_population": r.vulnerable_population,
        }
        for r in result.scalars().all()
    ]


@router.get("/exposure/{simulation_id}")
async def get_population_exposure(
    simulation_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get population exposure from flood simulation."""
    from app.models.simulation import FloodSimulation
    sim = await db.get(FloodSimulation, simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return {
        "simulation_id": simulation_id,
        "affected_population": sim.affected_population or 0,
        "vulnerable_population_at_risk": 0,
        "message": "Detailed population exposure analysis would be computed here",
    }