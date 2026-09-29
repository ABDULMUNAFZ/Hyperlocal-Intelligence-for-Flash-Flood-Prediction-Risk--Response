# FloodGuard Administrative Boundaries Ingestion Pipeline
"""Real administrative boundaries ingestion from GADM and Census India."""

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import geopandas as gpd
import requests
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import WKTElement
from shapely.geometry import shape, mapping
from shapely.ops import transform
import pyproj

from app.db.session import get_db
from app.models.core import Region, DataSource, ProcessingJob
from app.services.data_sources import DATA_SOURCES, DataSourceType
from app.services.cache import CacheManager, get_source_health

logger = logging.getLogger(__name__)

# South India states
SOUTH_INDIA_STATES = [
    ("Karnataka", "KA"),
    ("Kerala", "KL"),
    ("Tamil Nadu", "TN"),
    ("Andhra Pradesh", "AP"),
    ("Telangana", "TG"),
]

# GADM download URLs
GADM_URLS = {
    "v4.1": "https://geodata.ucdavis.edu/gadm/gadm4.1/gadm_410.gpkg",
    "v3.6": "https://geodata.ucdavis.edu/gadm/gadm3.6/gadm36.gpkg",
}


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


class GADMClient:
    """Client for downloading GADM administrative boundaries."""

    def __init__(self, cache: Optional[CacheManager] = None):
        self.cache = cache
        self.health = get_source_health("gadm")
        self.data_dir = Path("/data/admin_boundaries")
        self.data_dir.mkdir(parents=True, exist_ok=True)

    async def download_gadm(self, version: str = "v4.1") -> Optional[Path]:
        """Download GADM GeoPackage."""
        url = GADM_URLS.get(version)
        if not url:
            logger.error(f"Unknown GADM version: {version}")
            return None

        output_path = self.data_dir / f"gadm_{version}.gpkg"

        if output_path.exists():
            logger.info(f"GADM {version} already downloaded")
            self.health.record_success()
            return output_path

        try:
            logger.info(f"Downloading GADM {version} from {url}...")
            async with requests.get(url, stream=True, timeout=600) as response:
                response.raise_for_status()
                with open(output_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)

            self.health.record_success()
            logger.info(f"Downloaded GADM {version} to {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"GADM download error: {e}")
            self.health.record_failure(str(e))
            return None


class AdminBoundariesIngestionPipeline:
    """Pipeline for ingesting administrative boundaries."""

    def __init__(self, db: AsyncSession, cache: Optional[CacheManager] = None):
        self.db = db
        self.cache = cache
        self.gadm = GADMClient(cache)

    async def ingest_gadm_india(self, version: str = "v4.1") -> IngestionResult:
        """Ingest Indian administrative boundaries from GADM."""
        result = IngestionResult(
            source_name="gadm",
            job_type=f"ingest_gadm_india_{version}",
        )

        gpkg_path = await self.gadm.download_gadm(version)
        if not gpkg_path:
            result.errors.append("Failed to download GADM")
            self._record_job(result)
            return result

        source = await self._get_or_create_source("gadm")

        try:
            # Read all layers
            layers = gpd.list_layers(gpkg_path)
            logger.info(f"GADM layers: {layers['name'].tolist()}")

            # Layer naming: ADM_0 = country, ADM_1 = state, ADM_2 = district, ADM_3 = subdistrict
            for layer_name in layers['name']:
                if not layer_name.startswith("ADM_"):
                    continue

                level = int(layer_name.split("_")[1])
                if level > 3:
                    continue

                logger.info(f"Processing {layer_name} (level {level})...")
                gdf = gpd.read_file(gpkg_path, layer=layer_name)

                # Filter for India
                if "GID_0" in gdf.columns:
                    gdf = gdf[gdf["GID_0"] == "IND"]
                elif "COUNTRY" in gdf.columns:
                    gdf = gdf[gdf["COUNTRY"] == "India"]

                if len(gdf) == 0:
                    continue

                logger.info(f"Found {len(gdf)} features for India in {layer_name}")

                for _, row in gdf.iterrows():
                    result.records_processed += 1

                    await self._process_admin_feature(
                        row, level, layer_name, version, source.id, result
                    )

        except Exception as e:
            logger.error(f"GADM processing error: {e}")
            result.errors.append(str(e))
            result.records_failed += 1

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        return result

    async def _process_admin_feature(self, row, level: int, layer_name: str,
                                      version: str, source_id, result: IngestionResult):
        """Process a single administrative feature."""
        from shapely.geometry import shape

        # Extract name fields based on level
        name_fields = {
            0: ["NAME_0"],
            1: ["NAME_1", "NAME_0"],
            2: ["NAME_2", "NAME_1", "NAME_0"],
            3: ["NAME_3", "NAME_2", "NAME_1", "NAME_0"],
        }

        name = None
        for field in name_fields.get(level, []):
            if field in row and pd.notna(row[field]):
                name = str(row[field])
                break

        if not name:
            return

        # Extract code fields
        code_fields = {
            0: ["GID_0"],
            1: ["GID_1", "GID_0"],
            2: ["GID_2", "GID_1", "GID_0"],
            3: ["GID_3", "GID_2", "GID_1", "GID_0"],
        }

        code = None
        for field in code_fields.get(level, []):
            if field in row and pd.notna(row[field]):
                code = str(row[field])
                break

        # Geometry
        geom = row.geometry
        if geom is None or geom.is_empty:
            result.records_failed += 1
            return

        # Ensure valid
        if not geom.is_valid:
            geom = geom.buffer(0)
        if not geom.is_valid:
            result.records_failed += 1
            return

        # Convert to WKT with SRID
        wkt = f"SRID=4326;{geom.wkt}"

        # Compute centroid
        centroid = geom.centroid
        centroid_wkt = f"SRID=4326;{centroid.wkt}"

        # Area in sqkm (approximate)
        area_sqkm = geom.area * 111 * 111  # rough degrees to km2

        # Determine parent
        parent_id = None
        if level > 0:
            parent_name = None
            for field in name_fields.get(level - 1, []):
                if field in row and pd.notna(row[field]):
                    parent_name = str(row[field])
                    break
            if parent_name:
                parent = await self.db.execute(
                    select(Region).where(
                        Region.name == parent_name,
                        Region.level == level,
                    )
                )
                parent_obj = parent.scalar_one_or_none()
                if parent_obj:
                    parent_id = parent_obj.id

        # Check existing
        existing = await self.db.execute(
            select(Region).where(
                Region.name == name,
                Region.level == level + 1,  # GADM 0=country, 1=state -> our 1=state, 2=district
                Region.parent_id == parent_id,
            )
        )
        if existing.scalar_one_or_none():
            result.records_skipped += 1
            return

        # Map GADM level to our level (1=state, 2=district, 3=taluk, 4=village)
        our_level = level + 1

        # State code mapping
        state_code_map = {
            "Karnataka": "KA",
            "Kerala": "KL",
            "Tamil Nadu": "TN",
            "Andhra Pradesh": "AP",
            "Telangana": "TG",
        }

        state_code = None
        if our_level == 1:
            state_code = state_code_map.get(name)

        region = Region(
            name=name,
            level=our_level,
            parent_id=parent_id,
            state_code=state_code,
            district_code=code if our_level == 2 else None,
            geometry=wkt,
            centroid=centroid_wkt,
            area_sqkm=area_sqkm,
            metadata={
                "gadm_version": version,
                "gadm_layer": layer_name,
                "gadm_code": code,
                "source": "gadm",
            },
        )
        self.db.add(region)
        result.records_inserted += 1

    async def ingest_census_india(self) -> IngestionResult:
        """Ingest Census India boundaries (placeholder - requires official data)."""
        result = IngestionResult(
            source_name="census_india",
            job_type="ingest_census_india_boundaries",
        )

        result.errors.append("Census India boundaries require official data access - not publicly downloadable")
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
async def run_admin_boundaries_ingestion(version: str = "v4.1"):
    from app.db.session import async_session_maker
    import pandas as pd

    async with async_session_maker() as db:
        cache = CacheManager()
        await cache.connect()

        pipeline = AdminBoundariesIngestionPipeline(db, cache)
        await pipeline.ingest_gadm_india(version)

        await cache.close()

    return {"status": "completed"}


if __name__ == "__main__":
    import sys
    version = sys.argv[1] if len(sys.argv) > 1 else "v4.1"
    asyncio.run(run_admin_boundaries_ingestion(version))