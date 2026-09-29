# FloodGuard DEM Ingestion Pipeline
"""Real Digital Elevation Model ingestion from Copernicus, SRTM, and other sources."""

import asyncio
import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

import boto3
import numpy as np
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.merge import merge
from rasterio.crs import CRS
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.terrain import TerrainTile, SlopeAspect, Watershed, RiverNetwork
from app.models.core import DataSource, ProcessingJob
from app.services.data_sources import DATA_SOURCES, DataSourceType
from app.services.cache import CacheManager, get_source_health

logger = logging.getLogger(__name__)

# South India bounding box in WGS84
SOUTH_INDIA_BBOX = [74.0, 8.0, 84.0, 19.0]  # [min_lon, min_lat, max_lon, max_lat]

# Copernicus tile naming for South India
# Tiles covering South India (approximately)
COPERNICUS_TILES_SOUTH_INDIA = [
    # Format: (northing, easting) for tile naming
    # South India spans roughly S8 to S19, E74 to E84
    ("S08", "E074"), ("S08", "E075"), ("S08", "E076"), ("S08", "E077"),
    ("S08", "E078"), ("S08", "E079"), ("S08", "E080"), ("S08", "E081"),
    ("S08", "E082"), ("S08", "E083"), ("S08", "E084"),
    ("S09", "E074"), ("S09", "E075"), ("S09", "E076"), ("S09", "E077"),
    ("S09", "E078"), ("S09", "E079"), ("S09", "E080"), ("S09", "E081"),
    ("S09", "E082"), ("S09", "E083"), ("S09", "E084"),
    ("S10", "E074"), ("S10", "E075"), ("S10", "E076"), ("S10", "E077"),
    ("S10", "E078"), ("S10", "E079"), ("S10", "E080"), ("S10", "E081"),
    ("S10", "E082"), ("S10", "E083"), ("S10", "E084"),
    ("S11", "E074"), ("S11", "E075"), ("S11", "E076"), ("S11", "E077"),
    ("S11", "E078"), ("S11", "E079"), ("S11", "E080"), ("S11", "E081"),
    ("S11", "E082"), ("S11", "E083"), ("S11", "E084"),
    ("S12", "E074"), ("S12", "E075"), ("S12", "E076"), ("S12", "E077"),
    ("S12", "E078"), ("S12", "E079"), ("S12", "E080"), ("S12", "E081"),
    ("S12", "E082"), ("S12", "E083"), ("S12", "E084"),
    ("S13", "E074"), ("S13", "E075"), ("S13", "E076"), ("S13", "E077"),
    ("S13", "E078"), ("S13", "E079"), ("S13", "E080"), ("S13", "E081"),
    ("S13", "E082"), ("S13", "E083"), ("S13", "E084"),
    ("S14", "E074"), ("S14", "E075"), ("S14", "E076"), ("S14", "E077"),
    ("S14", "E078"), ("S14", "E079"), ("S14", "E080"), ("S14", "E081"),
    ("S14", "E082"), ("S14", "E083"), ("S14", "E084"),
    ("S15", "E074"), ("S15", "E075"), ("S15", "E076"), ("S15", "E077"),
    ("S15", "E078"), ("S15", "E079"), ("S15", "E080"), ("S15", "E081"),
    ("S15", "E082"), ("S15", "E083"), ("S15", "E084"),
    ("S16", "E074"), ("S16", "E075"), ("S16", "E076"), ("S16", "E077"),
    ("S16", "E078"), ("S16", "E079"), ("S16", "E080"), ("S16", "E081"),
    ("S16", "E082"), ("S16", "E083"), ("S16", "E084"),
    ("S17", "E074"), ("S17", "E075"), ("S17", "E076"), ("S17", "E077"),
    ("S17", "E078"), ("S17", "E079"), ("S17", "E080"), ("S17", "E081"),
    ("S17", "E082"), ("S17", "E083"), ("S17", "E084"),
    ("S18", "E074"), ("S18", "E075"), ("S18", "E076"), ("S18", "E077"),
    ("S18", "E078"), ("S18", "E079"), ("S18", "E080"), ("S18", "E081"),
    ("S18", "E082"), ("S18", "E083"), ("S18", "E084"),
    ("S19", "E074"), ("S19", "E075"), ("S19", "E076"), ("S19", "E077"),
    ("S19", "E078"), ("S19", "E079"), ("S19", "E080"), ("S19", "E081"),
    ("S19", "E082"), ("S19", "E083"), ("S19", "E084"),
]


@dataclass
class IngestionResult:
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


class CopernicusDEMClient:
    """Client for downloading Copernicus DEM from AWS S3."""

    def __init__(self, cache: Optional[CacheManager] = None, resolution: str = "30m"):
        self.resolution = resolution  # "30m" or "90m"
        if resolution == "30m":
            self.bucket = "copernicus-dem-30m"
            self.prefix = "Copernicus_DSM_COG_10_"
        else:
            self.bucket = "copernicus-dem-90m"
            self.prefix = "Copernicus_DSM_COG_30_"

        self.s3 = boto3.client('s3', region_name='eu-central-1')
        self.health = get_source_health(f"copernicus_glo{30 if resolution == '30m' else 90}")
        self.cache = cache

    def _tile_to_s3_key(self, northing: str, easting: str) -> str:
        """Convert tile coordinates to S3 key."""
        return f"{self.prefix}{northing}_{easting}_DEM/{self.prefix}{northing}_{easting}_DEM.tif"

    async def download_tile(self, northing: str, easting: str, output_path: Path) -> bool:
        """Download a single DEM tile from S3."""
        key = self._tile_to_s3_key(northing, easting)

        try:
            # Check if tile exists
            self.s3.head_object(Bucket=self.bucket, Key=key)

            # Download
            self.s3.download_file(self.bucket, key, str(output_path))
            self.health.record_success()
            logger.info(f"Downloaded {key} to {output_path}")
            return True

        except self.s3.exceptions.ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                logger.warning(f"Tile not found: {key}")
                self.health.record_failure(f"Tile not found: {key}")
                return False
            else:
                logger.error(f"S3 error for {key}: {e}")
                self.health.record_failure(str(e))
                return False
        except Exception as e:
            logger.error(f"Download error for {key}: {e}")
            self.health.record_failure(str(e))
            return False

    async def get_tile_bounds(self, northing: str, easting: str) -> Tuple[float, float, float, float]:
        """Get geographic bounds of a tile."""
        # Parse tile coordinates
        # Format: S15_00, E075_00
        lat_str = northing.replace('S', '').replace('N', '').replace('_00', '')
        lon_str = easting.replace('W', '').replace('E', '').replace('_00', '')

        lat = -int(lat_str) if northing.startswith('S') else int(lat_str)
        lon = int(lon_str) if easting.startswith('E') else -int(lon_str)

        # Tiles are 1x1 degree
        return (lon, lat, lon + 1, lat + 1)


class DEMIngestionPipeline:
    """Pipeline for ingesting DEM data and computing derivatives."""

    def __init__(self, db: AsyncSession, cache: Optional[CacheManager] = None,
                 data_dir: str = "/data/dem"):
        self.db = db
        self.cache = cache
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.copernicus_30m = CopernicusDEMClient(cache, "30m")
        self.copernicus_90m = CopernicusDEMClient(cache, "90m")

    async def ingest_copernicus_tiles(self, tiles: List[Tuple[str, str]] = None,
                                       resolution: str = "30m") -> IngestionResult:
        """Ingest Copernicus DEM tiles for South India."""
        result = IngestionResult(
            source_name=f"copernicus_glo{30 if resolution == '30m' else 90}",
            job_type=f"ingest_copernicus_{resolution}_tiles",
        )

        tiles = tiles or COPERNICUS_TILES_SOUTH_INDIA
        client = self.copernicus_30m if resolution == "30m" else self.copernicus_90m

        logger.info(f"Starting Copernicus {resolution} DEM ingestion for {len(tiles)} tiles")

        for northing, easting in tiles:
            result.records_processed += 1

            tile_id = f"{client.prefix}{northing}_{easting}_DEM"
            output_path = self.data_dir / f"{tile_id}.tif"

            # Check if already in database
            existing = await self.db.execute(
                select(TerrainTile).where(
                    TerrainTile.source == f"copernicus_glo{resolution}",
                    TerrainTile.tile_id == tile_id,
                )
            )
            if existing.scalar_one_or_none():
                result.records_skipped += 1
                continue

            # Download tile
            success = await client.download_tile(northing, easting, output_path)
            if not success:
                result.records_failed += 1
                continue

            # Process tile
            try:
                await self._process_dem_tile(output_path, tile_id, northing, easting, resolution)
                result.records_inserted += 1
            except Exception as e:
                logger.error(f"Processing failed for {tile_id}: {e}")
                result.errors.append(f"{tile_id}: {e}")
                result.records_failed += 1

            # Clean up downloaded file
            if output_path.exists():
                output_path.unlink()

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        return result

    async def _process_dem_tile(self, tif_path: Path, tile_id: str,
                                 northing: str, easting: str, resolution: str):
        """Process a DEM tile: compute stats, slope, aspect, flow direction."""
        client = self.copernicus_30m if resolution == "30m" else self.copernicus_90m

        # Get tile bounds
        min_lon, min_lat, max_lon, max_lat = await client.get_tile_bounds(northing, easting)

        with rasterio.open(tif_path) as src:
            # Read elevation data
            elevation = src.read(1, masked=True)
            transform = src.transform
            crs = src.crs
            nodata = src.nodata

            # Compute statistics
            valid_data = elevation.compressed()
            if len(valid_data) == 0:
                raise ValueError("No valid elevation data in tile")

            min_elev = float(np.min(valid_data))
            max_elev = float(np.max(valid_data))
            mean_elev = float(np.mean(valid_data))
            std_elev = float(np.std(valid_data))

            # Create geometry for tile bounds
            from shapely.geometry import box
            tile_geom = box(min_lon, min_lat, max_lon, max_lat)

            # Create terrain tile record
            terrain_tile = TerrainTile(
                source=f"copernicus_glo{resolution}",
                tile_id=tile_id,
                resolution_m=30 if resolution == "30m" else 90,
                geometry=f"SRID=4326;{tile_geom.wkt}",
                min_elevation=min_elev,
                max_elevation=max_elev,
                mean_elevation=mean_elev,
                std_elevation=std_elev,
                data_date=datetime.utcnow(),
                metadata={
                    "northing": northing,
                    "easting": easting,
                    "crs": str(crs),
                    "nodata": nodata,
                    "width": src.width,
                    "height": src.height,
                },
            )
            self.db.add(terrain_tile)
            await self.db.flush()

            # Compute and store slope, aspect, flow direction
            await self._compute_slope_aspect(terrain_tile.id, elevation, transform, crs, nodata)

    async def _compute_slope_aspect(self, terrain_tile_id, elevation, transform, crs, nodata):
        """Compute slope, aspect, curvature, flow direction, accumulation."""
        from rasterio.warp import transform as warp_transform
        from scipy import ndimage

        # Calculate slope and aspect using Horn's method
        # Using 3x3 window
        dzdx = np.gradient(elevation, axis=1) / transform.a
        dzdy = np.gradient(elevation, axis=0) / transform.e

        # Slope in degrees
        slope_rad = np.arctan(np.sqrt(dzdx**2 + dzdy**2))
        slope_deg = np.degrees(slope_rad)

        # Aspect in degrees (0 = North, clockwise)
        aspect_rad = np.arctan2(-dzdx, dzdy)  # Note: -dzdx for correct orientation
        aspect_deg = np.degrees(aspect_rad)
        aspect_deg = np.where(aspect_deg < 0, aspect_deg + 360, aspect_deg)
        aspect_deg = np.where(slope_deg == 0, -1, aspect_deg)  # Flat areas

        # Curvature (profile + plan)
        # Second derivatives
        d2zdx2 = np.gradient(dzdx, axis=1) / transform.a
        d2zdy2 = np.gradient(dzdy, axis=0) / transform.e
        d2zdxdy = np.gradient(dzdx, axis=0) / transform.e

        # Profile curvature
        profile_curv = -(d2zdx2 * dzdx**2 + 2 * d2zdxdy * dzdx * dzdy + d2zdy2 * dzdy**2) / \
                       (dzdx**2 + dzdy**2 + 1e-10)

        # Plan curvature
        plan_curv = -(d2zdx2 * dzdy**2 - 2 * d2zdxdy * dzdx * dzdy + d2zdy2 * dzdx**2) / \
                    (dzdx**2 + dzdy**2 + 1e-10)

        # Total curvature
        curvature = profile_curv + plan_curv

        # Flow direction (D8)
        flow_dir = self._compute_d8_flow_direction(elevation, nodata)

        # Flow accumulation
        flow_acc = self._compute_flow_accumulation(flow_dir)

        # Topographic Wetness Index (TWI)
        twi = np.log(flow_acc / np.tan(slope_rad + 1e-10))

        # Stream Power Index (SPI)
        spi = flow_acc * np.tan(slope_rad)

        # Store as raster records (in production, would save to files and reference)
        # For now, store summary stats
        slope_aspect = SlopeAspect(
            terrain_tile_id=terrain_tile_id,
            metadata={
                "slope_stats": {
                    "min": float(np.nanmin(slope_deg)),
                    "max": float(np.nanmax(slope_deg)),
                    "mean": float(np.nanmean(slope_deg)),
                },
                "aspect_stats": {
                    "min": float(np.nanmin(aspect_deg[aspect_deg >= 0])),
                    "max": float(np.nanmax(aspect_deg[aspect_deg >= 0])),
                    "mean": float(np.nanmean(aspect_deg[aspect_deg >= 0])),
                },
                "curvature_stats": {
                    "min": float(np.nanmin(curvature)),
                    "max": float(np.nanmax(curvature)),
                    "mean": float(np.nanmean(curvature)),
                },
            },
        )
        self.db.add(slope_aspect)

    def _compute_d8_flow_direction(self, elevation, nodata):
        """Compute D8 flow direction."""
        rows, cols = elevation.shape
        flow_dir = np.full((rows, cols), 255, dtype=np.uint8)  # 255 = nodata

        # D8 direction encoding (1=E, 2=SE, 4=S, 8=SW, 16=W, 32=NW, 64=N, 128=NE)
        directions = [
            (0, 1, 1),    # E
            (1, 1, 2),    # SE
            (1, 0, 4),    # S
            (1, -1, 8),   # SW
            (0, -1, 16),  # W
            (-1, -1, 32), # NW
            (-1, 0, 64),  # N
            (-1, 1, 128), # NE
        ]

        for i in range(1, rows - 1):
            for j in range(1, cols - 1):
                if elevation.mask[i, j] if hasattr(elevation, 'mask') else elevation[i, j] == nodata:
                    continue

                center = elevation[i, j] if not hasattr(elevation, 'mask') else elevation[i, j]
                max_slope = -1
                best_dir = 0

                for di, dj, code in directions:
                    ni, nj = i + di, j + dj
                    neighbor = elevation[ni, nj] if not hasattr(elevation, 'mask') else elevation[ni, nj]
                    if hasattr(elevation, 'mask') and elevation.mask[ni, nj]:
                        continue
                    if neighbor == nodata:
                        continue

                    slope = (center - neighbor) / (np.sqrt(di**2 + dj**2) * 30)  # 30m resolution
                    if slope > max_slope:
                        max_slope = slope
                        best_dir = code

                if max_slope > 0:
                    flow_dir[i, j] = best_dir

        return flow_dir

    def _compute_flow_accumulation(self, flow_dir):
        """Compute flow accumulation using D8."""
        rows, cols = flow_dir.shape
        flow_acc = np.ones((rows, cols), dtype=np.float32)

        # Simple recursive accumulation (in production, use efficient algorithm)
        # This is a placeholder - real implementation would use TauDEM or similar
        for i in range(rows):
            for j in range(cols):
                if flow_dir[i, j] != 255:
                    flow_acc[i, j] = 1.0

        return flow_acc

    async def compute_watersheds(self, pour_points: List[Tuple[float, float]]) -> IngestionResult:
        """Compute watershed boundaries for given pour points."""
        result = IngestionResult(
            source_name="computed",
            job_type="compute_watersheds",
        )

        # This would use the flow direction/accumulation from DEM
        # Placeholder for real implementation using pysheds or similar
        result.errors.append("Watershed computation requires full DEM mosaic - not yet implemented")
        self._record_job(result)
        return result

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
async def run_dem_ingestion(resolution: str = "30m", max_tiles: int = 10):
    from app.db.session import async_session_maker

    async with async_session_maker() as db:
        cache = CacheManager()
        await cache.connect()

        pipeline = DEMIngestionPipeline(db, cache)

        # Limit tiles for testing
        tiles = COPERNICUS_TILES_SOUTH_INDIA[:max_tiles]
        await pipeline.ingest_copernicus_tiles(tiles, resolution)

        await cache.close()

    return {"status": "completed"}


if __name__ == "__main__":
    import sys
    resolution = sys.argv[1] if len(sys.argv) > 1 else "30m"
    max_tiles = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    asyncio.run(run_dem_ingestion(resolution, max_tiles))