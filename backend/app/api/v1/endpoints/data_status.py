# FloodGuard Data Status Endpoint
"""API endpoint for data source status panel."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime

from app.db.session import get_db
from app.models.core import DataSource, ProcessingJob
from app.models.rainfall import RainfallObservation, WeatherForecast
from app.models.terrain import TerrainTile
from app.models.soil import SoilGrid
from app.models.landcover import LandCoverGrid
from app.models.landcover import BuildingFootprint, RoadNetwork
from app.models.population import PopulationGrid
from app.models.population import HistoricalFloodEvent
from app.services.data_quality import get_data_freshness_status, create_data_status_response

router = APIRouter(prefix="/data-sources", tags=["Data Status"])


@router.get("/status")
async def get_data_source_status(db: AsyncSession = Depends(get_db)):
    """Get status of all data sources."""
    status_list = []

    # Check each data source type
    checks = [
        ("open_meteo_rainfall", "rainfall", RainfallObservation, RainfallObservation.timestamp),
        ("chirps_rainfall", "rainfall", RainfallObservation, RainfallObservation.timestamp),
        ("nasa_gpm_imerg", "rainfall", RainfallObservation, RainfallObservation.timestamp),
        ("imd_aws_rainfall", "rainfall", RainfallObservation, RainfallObservation.timestamp),
        ("mosdac_gsmap", "rainfall", RainfallObservation, RainfallObservation.timestamp),
        ("open_meteo_forecast", "weather_forecast", WeatherForecast, WeatherForecast.valid_time),
        ("noaa_gfs", "weather_forecast", WeatherForecast, WeatherForecast.valid_time),
        ("imd_wrf", "weather_forecast", WeatherForecast, WeatherForecast.valid_time),
        ("copernicus_glo30", "dem", TerrainTile, TerrainTile.data_date),
        ("copernicus_glo90", "dem", TerrainTile, TerrainTile.data_date),
        ("srtm_30m", "dem", TerrainTile, TerrainTile.data_date),
        ("alos_palsar", "dem", TerrainTile, TerrainTile.data_date),
        ("soilgrids", "soil", SoilGrid, None),
        ("hw_sd", "soil", SoilGrid, None),
        ("esa_worldcover", "landcover", LandCoverGrid, None),
        ("modis_mcd12q1", "landcover", LandCoverGrid, None),
        ("bhuvan_lulc", "landcover", LandCoverGrid, None),
        ("hydrosheds", "hydrology", TerrainTile, None),
        ("hydroatlas", "hydrology", TerrainTile, None),
        ("openstreetmap", "infrastructure", BuildingFootprint, None),
        ("microsoft_buildings", "infrastructure", BuildingFootprint, None),
        ("worldpop", "population", PopulationGrid, None),
        ("landscan", "population", PopulationGrid, None),
        ("emdat", "historical_flood", HistoricalFloodEvent, HistoricalFloodEvent.start_date),
        ("dartmouth_flood", "historical_flood", HistoricalFloodEvent, HistoricalFloodEvent.start_date),
        ("nidm_flood", "historical_flood", HistoricalFloodEvent, HistoricalFloodEvent.start_date),
        ("gadm", "admin", None, None),
        ("census_india", "admin", None, None),
    ]

    for source_name, source_type, model, date_col in checks:
        # Get data source record
        ds_result = await db.execute(
            select(DataSource).where(DataSource.name == source_name)
        )
        ds = ds_result.scalar_one_or_none()

        if not ds:
            # Data source not registered
            status_list.append(create_data_status_response(
                source_name, None, 0, "Data source not registered in database"
            ))
            continue

        last_update = None
        record_count = 0
        error = None

        if model and date_col is not None:
            try:
                # Get latest record
                latest_result = await db.execute(
                    select(func.max(date_col)).select_from(model).where(model.source == source_name)
                )
                last_update = latest_result.scalar_one_or_none()

                # Count records
                count_result = await db.execute(
                    select(func.count(model.id)).where(model.source == source_name)
                )
                record_count = count_result.scalar() or 0
            except Exception as e:
                error = f"Query error: {str(e)}"
        elif model:
            # Static data, just count
            try:
                count_result = await db.execute(
                    select(func.count(model.id)).where(model.source == source_name)
                )
                record_count = count_result.scalar() or 0
                # For static data, use created_at from data source
                last_update = ds.last_successful_fetch
            except Exception as e:
                error = f"Query error: {str(e)}"
        else:
            # No model (e.g., GADM)
            record_count = 0
            last_update = ds.last_successful_fetch

        status_list.append(create_data_status_response(
            source_name, last_update, record_count, error
        ))

    return status_list


@router.get("/health-summary")
async def get_health_summary(db: AsyncSession = Depends(get_db)):
    """Get overall system health summary."""
    # Count sources by status
    all_status = await get_data_source_status(db)

    summary = {
        "total_sources": len(all_status),
        "fresh": len([s for s in all_status if s["status"] == "fresh"]),
        "stale": len([s for s in all_status if s["status"] == "stale"]),
        "degraded": len([s for s in all_status if s["status"] == "degraded"]),
        "invalid": len([s for s in all_status if s["status"] == "invalid"]),
        "unavailable": len([s for s in all_status if s["status"] == "unavailable"]),
        "last_check": datetime.utcnow().isoformat(),
    }

    # Overall health
    if summary["invalid"] > 0:
        summary["overall"] = "degraded"
    elif summary["stale"] > 0 or summary["degraded"] > 0:
        summary["overall"] = "warning"
    elif summary["fresh"] > 0:
        summary["overall"] = "healthy"
    else:
        summary["overall"] = "unknown"

    return summary