# FloodGuard Rainfall Ingestion Pipeline
"""Real rainfall data ingestion from Open-Meteo, CHIRPS, and other sources."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import httpx
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.rainfall import RainfallObservation, RainfallGrid
from app.models.core import DataSource, ProcessingJob
from app.services.data_sources import DATA_SOURCES, get_primary_source, DataSourceType
from app.services.data_quality import DataQualityChecker, DataQualityStatus
from app.services.cache import get_source_health, ResilientHttpClient, RetryConfig, CacheManager

logger = logging.getLogger(__name__)

# South India bounding box
SOUTH_INDIA_BBOX = [74.0, 8.0, 84.0, 19.0]  # [min_lon, min_lat, max_lon, max_lat]


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
    quality_report: Optional[Any] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.start_time is None:
            self.start_time = datetime.utcnow()


class OpenMeteoRainfallClient:
    """Client for fetching rainfall from Open-Meteo API."""

    def __init__(self, cache: Optional[CacheManager] = None):
        self.base_url = "https://api.open-meteo.com/v1"
        self.client = ResilientHttpClient(
            base_url=self.base_url,
            cache=cache,
            retry_config=RetryConfig(max_attempts=3, base_delay=2.0),
            timeout=30.0,
            rate_limit=10.0,  # 10 requests/second
        )
        self.health = get_source_health("open_meteo_rainfall")

    async def close(self):
        await self.client.close()

    async def get_current_rainfall(self, latitude: float, longitude: float) -> Optional[Dict]:
        """Get current rainfall for a point."""
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": "precipitation",
            "hourly": "precipitation,precipitation_probability",
            "timezone": "UTC",
            "forecast_hours": 1,
            "past_hours": 24,
        }

        try:
            result = await self.client.get("/forecast", params=params, cache_ttl=300)
            self.health.record_success()
            return result
        except Exception as e:
            self.health.record_failure(str(e))
            logger.error(f"Open-Meteo current rainfall error: {e}")
            return None

    async def get_historical_rainfall(self, latitude: float, longitude: float,
                                      start_date: str, end_date: str) -> Optional[Dict]:
        """Get historical rainfall (ERA5) for a point."""
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": "precipitation",
            "timezone": "UTC",
            "models": "era5",
        }

        try:
            result = await self.client.get("/era5", params=params, cache_ttl=86400)
            self.health.record_success()
            return result
        except Exception as e:
            self.health.record_failure(str(e))
            logger.error(f"Open-Meteo historical rainfall error: {e}")
            return None

    async def get_grid_rainfall(self, bbox: List[float], resolution_km: float = 10.0) -> Optional[Dict]:
        """Get rainfall grid for a bounding box (uses best available model)."""
        # Open-Meteo doesn't directly support grid queries for arbitrary bboxes
        # We'll sample points in a grid pattern
        min_lon, min_lat, max_lon, max_lat = bbox
        step = resolution_km / 111.0  # approximate degrees

        points = []
        lat = min_lat
        while lat <= max_lat:
            lon = min_lon
            while lon <= max_lon:
                points.append((lat, lon))
                lon += step
            lat += step

        # Batch request for multiple points (Open-Meteo supports multiple locations)
        if len(points) > 100:
            points = points[:100]  # Limit for demo

        latitudes = [p[0] for p in points]
        longitudes = [p[1] for p in points]

        params = {
            "latitude": latitudes,
            "longitude": longitudes,
            "hourly": "precipitation,precipitation_probability",
            "timezone": "UTC",
            "past_hours": 24,
            "forecast_hours": 48,
        }

        try:
            result = await self.client.get("/forecast", params=params, cache_ttl=300)
            self.health.record_success()
            return result
        except Exception as e:
            self.health.record_failure(str(e))
            logger.error(f"Open-Meteo grid rainfall error: {e}")
            return None


class RainfallIngestionPipeline:
    """Main pipeline for ingesting rainfall data."""

    def __init__(self, db: AsyncSession, cache: Optional[CacheManager] = None):
        self.db = db
        self.cache = cache
        self.quality_checker = DataQualityChecker(stale_threshold_hours=6.0)
        self.open_meteo = OpenMeteoRainfallClient(cache)

    async def ingest_current_rainfall_grid(self, resolution_km: float = 10.0) -> IngestionResult:
        """Ingest current rainfall as a grid over South India."""
        result = IngestionResult(
            source_name="open_meteo_rainfall",
            job_type="ingest_current_rainfall_grid",
        )

        logger.info(f"Starting rainfall grid ingestion for South India at {resolution_km}km resolution")

        # Get grid data from Open-Meteo
        grid_data = await self.open_meteo.get_grid_rainfall(SOUTH_INDIA_BBOX, resolution_km)

        if not grid_data:
            result.errors.append("Failed to fetch grid data from Open-Meteo")
            self._record_job(result)
            return result

        # Process hourly data
        hourly = grid_data.get("hourly", {})
        times = hourly.get("time", [])
        precipitation = hourly.get("precipitation", [])
        latitudes = grid_data.get("latitude", [])
        longitudes = grid_data.get("longitude", [])

        if not times or not precipitation:
            result.errors.append("No hourly precipitation data in response")
            self._record_job(result)
            return result

        # Get or create data source record
        source = await self._get_or_create_source("open_meteo_rainfall")

        # Process each time step (we'll store the latest)
        latest_idx = -1
        timestamp = datetime.fromisoformat(times[latest_idx].replace("Z", "+00:00"))

        # Create grid record
        for i, (lat, lon) in enumerate(zip(latitudes, longitudes)):
            result.records_processed += 1

            # Get precipitation for this point at latest time
            if isinstance(precipitation[0], list):
                # Multiple locations: precipitation[location][time]
                precip_val = precipitation[i][latest_idx] if i < len(precipitation) else 0
            else:
                # Single location
                precip_val = precipitation[latest_idx] if latest_idx < len(precipitation) else 0

            if precip_val is None:
                precip_val = 0.0

            # Create observation record
            obs_data = {
                "source": "open_meteo",
                "station_id": f"OM_{lat:.4f}_{lon:.4f}",
                "station_name": f"Open-Meteo Grid {lat:.4f},{lon:.4f}",
                "latitude": lat,
                "longitude": lon,
                "elevation_m": grid_data.get("elevation", [0])[i] if grid_data.get("elevation") else None,
                "timestamp": timestamp,
                "rainfall_mm": float(precip_val),
                "intensity_mmhr": float(precip_val),  # hourly = mm/hr
                "duration_minutes": 60,
                "quality_flag": "good" if precip_val >= 0 else "suspect",
            }

            # Quality check
            qc_report = self.quality_checker.check_rainfall_observation(obs_data)
            if qc_report.overall_status == DataQualityStatus.INVALID:
                result.records_failed += 1
                result.errors.append(f"Quality check failed for {obs_data['station_id']}: {qc_report.checks}")
                continue

            # Check for duplicates
            existing = await self.db.execute(
                select(RainfallObservation).where(
                    RainfallObservation.station_id == obs_data["station_id"],
                    RainfallObservation.timestamp == obs_data["timestamp"],
                )
            )
            if existing.scalar_one_or_none():
                result.records_skipped += 1
                continue

            # Insert
            obs = RainfallObservation(**obs_data)
            self.db.add(obs)
            result.records_inserted += 1

        # Also create grid record for the full raster
        await self._create_grid_record(source.id, timestamp, precipitation, latitudes, longitudes, grid_data)

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        logger.info(f"Rainfall grid ingestion complete: {result.records_inserted} inserted, {result.records_skipped} skipped")
        return result

    async def ingest_historical_rainfall(self, latitude: float, longitude: float,
                                         days_back: int = 30) -> IngestionResult:
        """Ingest historical rainfall for a specific point."""
        result = IngestionResult(
            source_name="open_meteo_rainfall",
            job_type="ingest_historical_rainfall",
        )

        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days_back)

        data = await self.open_meteo.get_historical_rainfall(
            latitude, longitude,
            start_date.isoformat(),
            end_date.isoformat(),
        )

        if not data:
            result.errors.append("Failed to fetch historical data")
            self._record_job(result)
            return result

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        precipitation = hourly.get("precipitation", [])

        source = await self._get_or_create_source("open_meteo_rainfall")

        for i, (time_str, precip) in enumerate(zip(times, precipitation)):
            result.records_processed += 1

            if precip is None:
                precip = 0.0

            timestamp = datetime.fromisoformat(time_str.replace("Z", "+00:00"))

            obs_data = {
                "source": "open_meteo_era5",
                "station_id": f"ERA5_{latitude:.4f}_{longitude:.4f}",
                "station_name": f"ERA5 Reanalysis {latitude:.4f},{longitude:.4f}",
                "latitude": latitude,
                "longitude": longitude,
                "elevation_m": data.get("elevation"),
                "timestamp": timestamp,
                "rainfall_mm": float(precip),
                "intensity_mmhr": float(precip),
                "duration_minutes": 60,
                "quality_flag": "good",
            }

            qc_report = self.quality_checker.check_rainfall_observation(obs_data)
            if qc_report.overall_status == DataQualityStatus.INVALID:
                result.records_failed += 1
                continue

            existing = await self.db.execute(
                select(RainfallObservation).where(
                    RainfallObservation.station_id == obs_data["station_id"],
                    RainfallObservation.timestamp == obs_data["timestamp"],
                )
            )
            if existing.scalar_one_or_none():
                result.records_skipped += 1
                continue

            obs = RainfallObservation(**obs_data)
            self.db.add(obs)
            result.records_inserted += 1

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        return result

    async def ingest_imd_aws_rainfall(self) -> IngestionResult:
        """Ingest rainfall from IMD AWS stations (requires API key)."""
        result = IngestionResult(
            source_name="imd_aws_rainfall",
            job_type="ingest_imd_aws_rainfall",
        )

        # This requires IMD API key - placeholder for real implementation
        result.errors.append("IMD API key not configured - skipping")
        self._record_job(result)
        return result

    async def _get_or_create_source(self, source_name: str):
        """Get or create data source record."""
        source_info = DATA_SOURCES.get(source_name)
        if not source_info:
            raise ValueError(f"Unknown source: {source_name}")

        stmt = select(DataSource).where(DataSource.name == source_name)
        result = await self.db.execute(stmt)
        source = result.scalar_one_or_none()

        if not source:
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

    async def _create_grid_record(self, source_id, timestamp, precipitation, latitudes, longitudes, grid_data):
        """Create a rainfall grid record."""
        # For now, just log - full raster storage would need raster processing
        logger.info(f"Grid record would be created for {len(latitudes)} points at {timestamp}")

    def _record_job(self, result: IngestionResult):
        """Record processing job."""
        job = ProcessingJob(
            job_type=result.job_type,
            status="completed" if result.records_failed == 0 else "completed_with_errors",
            data_source_id=None,  # Would link to source
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


# CLI command function
async def run_rainfall_ingestion(resolution_km: float = 10.0, historical_days: int = 0):
    """CLI entry point for rainfall ingestion."""
    from app.db.session import async_session_maker

    async with async_session_maker() as db:
        cache = CacheManager()
        await cache.connect()

        pipeline = RainfallIngestionPipeline(db, cache)

        if historical_days > 0:
            # Ingest historical for key locations in South India
            key_locations = [
                (12.9716, 77.5946),  # Bangalore
                (13.0827, 80.2707),  # Chennai
                (10.8505, 76.2711),  # Coimbatore
                (9.9312, 76.2673),   # Kochi
                (17.3850, 78.4867),  # Hyderabad
            ]
            for lat, lon in key_locations:
                await pipeline.ingest_historical_rainfall(lat, lon, historical_days)
        else:
            await pipeline.ingest_current_rainfall_grid(resolution_km)

        await cache.close()

    return {"status": "completed"}


if __name__ == "__main__":
    import sys
    resolution = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0
    historical = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    asyncio.run(run_rainfall_ingestion(resolution, historical))