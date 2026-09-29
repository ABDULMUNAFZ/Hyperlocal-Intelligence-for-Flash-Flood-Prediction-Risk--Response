# FloodGuard Weather Forecast Ingestion Pipeline
"""Real weather forecast data ingestion from Open-Meteo and other sources."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.rainfall import WeatherForecast, WeatherObservation
from app.models.core import DataSource, ProcessingJob
from app.services.data_sources import DATA_SOURCES, DataSourceType
from app.services.data_quality import DataQualityChecker, DataQualityStatus
from app.services.cache import CacheManager, ResilientHttpClient, RetryConfig, get_source_health

logger = logging.getLogger(__name__)

# South India bounding box
SOUTH_INDIA_BBOX = [74.0, 8.0, 84.0, 19.0]


@dataclass
class IngestionResult:
    """Result of an ingestion job."""
    source_name: str
    job_type: str
    records_processed: int = 0
    records_inserted: int = 0
    records_skipped: int = 0
    records_failed: int = 0
    errors: List[str] = None
    start_time: datetime = None
    end_time: datetime = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.start_time is None:
            self.start_time = datetime.utcnow()


class OpenMeteoWeatherClient:
    """Client for fetching weather forecasts from Open-Meteo."""

    def __init__(self, cache: Optional[CacheManager] = None):
        self.base_url = "https://api.open-meteo.com/v1"
        self.client = ResilientHttpClient(
            base_url=self.base_url,
            cache=cache,
            retry_config=RetryConfig(max_attempts=3, base_delay=2.0),
            timeout=30.0,
            rate_limit=10.0,
        )
        self.health = get_source_health("open_meteo_forecast")

    async def close(self):
        await self.client.close()

    async def get_forecast_grid(self, bbox: List[float], resolution_km: float = 20.0,
                                 hours: int = 168) -> Optional[Dict]:
        """Get forecast grid for bounding box."""
        min_lon, min_lat, max_lon, max_lat = bbox
        step = resolution_km / 111.0

        points = []
        lat = min_lat
        while lat <= max_lat:
            lon = min_lon
            while lon <= max_lon:
                points.append((lat, lon))
                lon += step
            lat += step

        if len(points) > 50:
            points = points[:50]

        latitudes = [p[0] for p in points]
        longitudes = [p[1] for p in points]

        params = {
            "latitude": latitudes,
            "longitude": longitudes,
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,"
                      "wind_gust_10m,pressure_msl,precipitation,precipitation_probability,"
                      "cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,"
                      "cape,lifted_index,soil_moisture_0_7cm,soil_moisture_7_28cm,"
                      "soil_moisture_28_100cm,soil_moisture_100_255cm",
            "timezone": "UTC",
            "forecast_hours": hours,
            "models": "best_match",
        }

        try:
            result = await self.client.get("/forecast", params=params, cache_ttl=1800)
            self.health.record_success()
            return result
        except Exception as e:
            self.health.record_failure(str(e))
            logger.error(f"Open-Meteo forecast grid error: {e}")
            return None

    async def get_ensemble_forecast(self, latitude: float, longitude: float,
                                     hours: int = 168) -> Optional[Dict]:
        """Get ensemble forecast for uncertainty quantification."""
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": "temperature_2m,precipitation,wind_speed_10m",
            "timezone": "UTC",
            "forecast_hours": hours,
            "ensemble": "true",
        }

        try:
            result = await self.client.get("/forecast", params=params, cache_ttl=3600)
            self.health.record_success()
            return result
        except Exception as e:
            self.health.record_failure(str(e))
            logger.error(f"Open-Meteo ensemble error: {e}")
            return None


class WeatherForecastIngestionPipeline:
    """Pipeline for ingesting weather forecasts."""

    def __init__(self, db: AsyncSession, cache: Optional[CacheManager] = None):
        self.db = db
        self.cache = cache
        self.quality_checker = DataQualityChecker(stale_threshold_hours=3.0)
        self.open_meteo = OpenMeteoWeatherClient(cache)

    async def ingest_forecast_grid(self, resolution_km: float = 20.0, hours: int = 168) -> IngestionResult:
        """Ingest forecast grid over South India."""
        result = IngestionResult(
            source_name="open_meteo_forecast",
            job_type="ingest_forecast_grid",
        )

        logger.info(f"Starting forecast grid ingestion at {resolution_km}km for {hours}h")

        grid_data = await self.open_meteo.get_forecast_grid(SOUTH_INDIA_BBOX, resolution_km, hours)

        if not grid_data:
            result.errors.append("Failed to fetch forecast grid")
            self._record_job(result)
            return result

        # Process data
        hourly = grid_data.get("hourly", {})
        times = hourly.get("time", [])
        latitudes = grid_data.get("latitude", [])
        longitudes = grid_data.get("longitude", [])

        source = await self._get_or_create_source("open_meteo_forecast")

        # Extract all variables
        variables = [
            "temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m",
            "wind_gust_10m", "pressure_msl", "precipitation", "precipitation_probability",
            "cloudcover", "cloudcover_low", "cloudcover_mid", "cloudcover_high",
            "cape", "lifted_index", "soil_moisture_0_7cm", "soil_moisture_7_28cm",
            "soil_moisture_28_100cm", "soil_moisture_100_255cm",
        ]

        var_data = {}
        for var in variables:
            var_data[var] = hourly.get(var, [])

        # For each location, create forecast records
        for i, (lat, lon) in enumerate(zip(latitudes, longitudes)):
            location_data = {
                "latitude": lat,
                "longitude": lon,
                "source": "open_meteo",
                "model": grid_data.get("model", "best_match"),
            }

            # Add elevation if available
            if grid_data.get("elevation") and i < len(grid_data["elevation"]):
                location_data["elevation_m"] = grid_data["elevation"][i]

            # Process each time step
            for t_idx, time_str in enumerate(times):
                result.records_processed += 1

                try:
                    valid_time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                except ValueError:
                    result.records_failed += 1
                    continue

                # Build forecast record
                forecast_data = {
                    **location_data,
                    "init_time": datetime.utcnow(),
                    "valid_time": valid_time,
                    "lead_time_hours": t_idx + 1,
                }

                for var in variables:
                    vals = var_data.get(var, [])
                    if vals and t_idx < len(vals):
                        if isinstance(vals[0], list):
                            # Multiple locations
                            forecast_data[var] = vals[i][t_idx] if i < len(vals) else None
                        else:
                            forecast_data[var] = vals[t_idx]

                # Quality check
                qc_report = self.quality_checker.check_weather_forecast(forecast_data)
                if qc_report.overall_status == DataQualityStatus.INVALID:
                    result.records_failed += 1
                    continue

                # Check duplicate
                existing = await self.db.execute(
                    select(WeatherForecast).where(
                        WeatherForecast.source == forecast_data["source"],
                        WeatherForecast.model == forecast_data["model"],
                        WeatherForecast.init_time == forecast_data["init_time"],
                        WeatherForecast.valid_time == forecast_data["valid_time"],
                        WeatherForecast.latitude == forecast_data["latitude"],
                        WeatherForecast.longitude == forecast_data["longitude"],
                    )
                )
                if existing.scalar_one_or_none():
                    result.records_skipped += 1
                    continue

                forecast = WeatherForecast(**forecast_data)
                self.db.add(forecast)
                result.records_inserted += 1

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        logger.info(f"Forecast grid ingestion: {result.records_inserted} inserted, {result.records_skipped} skipped")
        return result

    async def ingest_current_observations(self, bbox: List[float] = None) -> IngestionResult:
        """Ingest current weather observations (if available from API)."""
        result = IngestionResult(
            source_name="open_meteo_forecast",
            job_type="ingest_current_observations",
        )

        # Open-Meteo doesn't provide observations directly
        # This would need a different source like IMD AWS
        result.errors.append("Open-Meteo doesn't provide observations - use IMD AWS or MOSDAC")
        self._record_job(result)
        return result

    async def _get_or_create_source(self, source_name: str):
        source_info = DATA_SOURCES.get(source_name)
        stmt = select(DataSource).where(DataSource.name == source_name)
        result = await self.db.execute(stmt)
        source = result.scalar_one_or_none()

        if not source and source_info:
            source = DataSource(
                name=source_info.name,
                description=source_info.description,
                source_type=source_info.source_type.value,
                provider=source_info.provider,
                api_endpoint=source_info.api_endpoint,
                license=source_info.license,
                attribution=source_info.attribution,
                update_frequency=source_info.update_frequency,
                spatial_resolution=source_info.spatial_resolution,
                temporal_resolution=source_info.temporal_resolution,
                coverage_area=source_info.coverage,
                is_active=True,
                metadata=source_info.to_dict(),
            )
            self.db.add(source)
            await self.db.flush()

        return source

    def _record_job(self, result: IngestionResult):
        job = ProcessingJob(
            job_type=result.job_type,
            status="completed" if result.records_failed == 0 else "completed_with_errors",
            started_at=result.start_time,
            completed_at=result.end_time,
            error_message="; ".join(result.errors) if result.errors else None,
            records_processed=result.records_processed,
            metadata={
                "records_inserted": result.records_inserted,
                "records_skipped": result.records_skipped,
                "records_failed": result.records_failed,
            },
        )
        self.db.add(job)


# CLI
async def run_forecast_ingestion(resolution_km: float = 20.0, hours: int = 168):
    from app.db.session import async_session_maker

    async with async_session_maker() as db:
        cache = CacheManager()
        await cache.connect()

        pipeline = WeatherForecastIngestionPipeline(db, cache)
        await pipeline.ingest_forecast_grid(resolution_km, hours)

        await cache.close()

    return {"status": "completed"}


if __name__ == "__main__":
    import sys
    resolution = float(sys.argv[1]) if len(sys.argv) > 1 else 20.0
    hours = int(sys.argv[2]) if len(sys.argv) > 2 else 168
    asyncio.run(run_forecast_ingestion(resolution, hours))