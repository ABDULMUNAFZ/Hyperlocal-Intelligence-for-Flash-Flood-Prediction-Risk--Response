# FloodGuard Soil Data Ingestion Pipeline
"""Real soil data ingestion from SoilGrids (ISRIC) and other sources."""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import httpx
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.soil import SoilGrid, SoilProfile, SoilHydraulicProperties
from app.models.core import DataSource, ProcessingJob
from app.services.data_sources import DATA_SOURCES, DataSourceType
from app.services.cache import CacheManager, ResilientHttpClient, RetryConfig, get_source_health

logger = logging.getLogger(__name__)

# South India bounding box
SOUTH_INDIA_BBOX = [74.0, 8.0, 84.0, 19.0]

# SoilGrids properties and depth intervals
SOILGRIDS_PROPERTIES = [
    "phh2o",      # pH in H2O
    "soc",        # Soil organic carbon (g/kg)
    "bdod",       # Bulk density (cg/cm3)
    "clay",       # Clay content (g/kg)
    "sand",       # Sand content (g/kg)
    "silt",       # Silt content (g/kg)
    "cec",        # Cation exchange capacity (mmol+/kg)
    "nitrogen",   # Total nitrogen (cg/kg)
    "cfvo",       # Coarse fragments volumetric (%)
    "ocs",        # Organic carbon stock (t/ha)
    "ocd",        # Organic carbon density (hg/m3)
]

SOILGRIDS_DEPTHS = [
    "0-5cm",
    "5-15cm",
    "15-30cm",
    "30-60cm",
    "60-100cm",
    "100-200cm",
]

# Units for each property
SOILGRIDS_UNITS = {
    "phh2o": "pH",
    "soc": "g/kg",
    "bdod": "cg/cm3",
    "clay": "g/kg",
    "sand": "g/kg",
    "silt": "g/kg",
    "cec": "mmol+/kg",
    "nitrogen": "cg/kg",
    "cfvo": "%",
    "ocs": "t/ha",
    "ocd": "hg/m3",
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


class SoilGridsClient:
    """Client for fetching soil data from SoilGrids REST API."""

    def __init__(self, cache: Optional[CacheManager] = None):
        self.base_url = "https://rest.isric.org/soilgrids/v2.0"
        self.client = ResilientHttpClient(
            base_url=self.base_url,
            cache=cache,
            retry_config=RetryConfig(max_attempts=3, base_delay=5.0),
            timeout=60.0,
            rate_limit=2.0,  # Be nice to the API
        )
        self.health = get_source_health("soilgrids")

    async def close(self):
        await self.client.close()

    async def get_property_tile(self, property_name: str, depth: str,
                                 bbox: List[float] = None) -> Optional[Dict]:
        """Get a soil property tile as GeoTIFF info."""
        # SoilGrids REST API returns metadata and tile URLs
        # For actual GeoTIFF data, we'd download from AWS/GEE
        params = {
            "property": property_name,
            "depth": depth,
        }
        if bbox:
            params["bbox"] = ",".join(map(str, bbox))

        try:
            result = await self.client.get(f"/properties/{property_name}/{depth}",
                                           params=params, cache_ttl=86400)
            self.health.record_success()
            return result
        except Exception as e:
            self.health.record_failure(str(e))
            logger.error(f"SoilGrids property tile error: {e}")
            return None

    async def query_point(self, latitude: float, longitude: float,
                           properties: List[str] = None,
                           depths: List[str] = None) -> Optional[Dict]:
        """Query soil properties at a point."""
        properties = properties or SOILGRIDS_PROPERTIES
        depths = depths or SOILGRIDS_DEPTHS

        params = {
            "lat": latitude,
            "lon": longitude,
            "properties": ",".join(properties),
            "depths": ",".join(depths),
        }

        try:
            result = await self.client.get("/properties/query", params=params, cache_ttl=86400)
            self.health.record_success()
            return result
        except Exception as e:
            self.health.record_failure(str(e))
            logger.error(f"SoilGrids point query error: {e}")
            return None


class SoilIngestionPipeline:
    """Pipeline for ingesting soil data."""

    def __init__(self, db: AsyncSession, cache: Optional[CacheManager] = None):
        self.db = db
        self.cache = cache
        self.soilgrids = SoilGridsClient(cache)

    async def ingest_soilgrids_metadata(self) -> IngestionResult:
        """Ingest SoilGrids metadata for all property/depth combinations."""
        result = IngestionResult(
            source_name="soilgrids",
            job_type="ingest_soilgrids_metadata",
        )

        logger.info("Starting SoilGrids metadata ingestion")

        source = await self._get_or_create_source("soilgrids")

        for prop in SOILGRIDS_PROPERTIES:
            for depth in SOILGRIDS_DEPTHS:
                result.records_processed += 1

                # Check if already exists
                existing = await self.db.execute(
                    select(SoilGrid).where(
                        SoilGrid.property_name == prop,
                        SoilGrid.depth_interval == depth,
                        SoilGrid.source_version == "v2.0",
                    )
                )
                if existing.scalar_one_or_none():
                    result.records_skipped += 1
                    continue

                # Create record with metadata (actual raster would be downloaded separately)
                soil_grid = SoilGrid(
                    property_name=prop,
                    depth_interval=depth,
                    unit=SOILGRIDS_UNITS.get(prop, "unknown"),
                    source_version="v2.0",
                    metadata={
                        "description": f"SoilGrids v2.0 {prop} at {depth}",
                        "source": "ISRIC SoilGrids",
                        "crs": "EPSG:4326",
                        "resolution_m": 250,
                    },
                )
                self.db.add(soil_grid)
                result.records_inserted += 1

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        logger.info(f"SoilGrids metadata ingestion: {result.records_inserted} inserted")
        return result

    async def ingest_point_profiles(self, locations: List[Tuple[float, float]]) -> IngestionResult:
        """Ingest soil profiles for specific point locations."""
        result = IngestionResult(
            source_name="soilgrids",
            job_type="ingest_soil_profiles",
        )

        logger.info(f"Querying SoilGrids for {len(locations)} locations")

        for lat, lon in locations:
            result.records_processed += 1

            data = await self.soilgrids.query_point(lat, lon)
            if not data:
                result.records_failed += 1
                result.errors.append(f"Failed to query point {lat},{lon}")
                continue

            # Process response
            profile_id = f"SG_{lat:.6f}_{lon:.6f}"

            # Check existing
            existing = await self.db.execute(
                select(SoilProfile).where(SoilProfile.profile_id == profile_id)
            )
            if existing.scalar_one_or_none():
                result.records_skipped += 1
                continue

            # Build layers from response
            layers = []
            properties_data = data.get("properties", {})
            for prop_name, prop_data in properties_data.items():
                for depth_name, depth_data in prop_data.get("depths", {}).items():
                    layers.append({
                        "property": prop_name,
                        "depth": depth_name,
                        "mean": depth_data.get("mean"),
                        "uncertainty": depth_data.get("uncertainty"),
                        "unit": SOILGRIDS_UNITS.get(prop_name, ""),
                    })

            profile = SoilProfile(
                profile_id=profile_id,
                latitude=lat,
                longitude=lon,
                location=f"SRID=4326;POINT({lon} {lat})",
                country="India",
                layers=layers,
                metadata={"source": "soilgrids_v2", "query_date": datetime.utcnow().isoformat()},
            )
            self.db.add(profile)

            # Also compute hydraulic properties
            await self._compute_hydraulic_properties(layers, profile_id)

            result.records_inserted += 1

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        return result

    async def _compute_hydraulic_properties(self, layers: List[Dict], profile_id: str):
        """Compute hydraulic properties from soil texture."""
        # Find relevant layers (0-30cm for surface properties)
        surface_layers = [l for l in layers if l["depth"] in ["0-5cm", "5-15cm", "15-30cm"]]

        # Average surface properties
        clay_vals = [l["mean"] for l in surface_layers if l["property"] == "clay" and l["mean"]]
        sand_vals = [l["mean"] for l in surface_layers if l["property"] == "sand" and l["mean"]]
        bd_vals = [l["mean"] for l in surface_layers if l["property"] == "bdod" and l["mean"]]
        soc_vals = [l["mean"] for l in surface_layers if l["property"] == "soc" and l["mean"]]

        if not clay_vals or not sand_vals:
            return

        clay_pct = np.mean(clay_vals) / 10.0  # g/kg to %
        sand_pct = np.mean(sand_vals) / 10.0
        bd = np.mean(bd_vals) / 100.0 if bd_vals else 1.3  # cg/cm3 to g/cm3
        soc = np.mean(soc_vals) / 10.0 if soc_vals else 1.0  # g/kg to %

        silt_pct = 100 - clay_pct - sand_pct

        # Estimate hydraulic properties using pedotransfer functions (simplified)
        # Saxton & Rawls (2006) approximations
        theta_s = 0.489 - 0.00126 * sand_pct - 0.00064 * clay_pct + 0.00158 * soc  # porosity
        theta_fc = 0.299 + 0.00158 * clay_pct + 0.00038 * sand_pct + 0.00263 * soc  # field capacity
        theta_wp = 0.106 + 0.00415 * clay_pct + 0.00030 * sand_pct + 0.00133 * soc  # wilting point

        # Saturated hydraulic conductivity (cm/hr -> mm/hr)
        ks = 10**(2.77 - 0.024 * clay_pct - 0.002 * sand_pct + 0.003 * soc) * 10

        # Green-Ampt wetting front suction (cm)
        psi = 10**(1.65 - 0.009 * clay_pct - 0.002 * sand_pct) * 10

        # SCS Curve Number (AMC II) - approximate from texture
        if clay_pct > 40:
            cn = 85  # Clay soils
        elif clay_pct > 20:
            cn = 78  # Loam
        elif sand_pct > 70:
            cn = 68  # Sandy
        else:
            cn = 72

        # Horton parameters
        f0 = 250  # mm/hr initial
        fc = max(5, ks / 10)  # mm/hr final
        k = 2.0  # 1/hr decay

        # Find or create SoilGrid record to link
        grid = await self.db.execute(
            select(SoilGrid).where(
                SoilGrid.property_name == "bdod",
                SoilGrid.depth_interval == "0-5cm",
            )
        )
        grid = grid.scalar_one_or_none()

        if grid:
            hydro = SoilHydraulicProperties(
                soil_grid_id=grid.id,
                saturated_hydraulic_conductivity=ks,
                wetting_front_suction=psi,
                porosity=theta_s,
                field_capacity=theta_fc,
                wilting_point=theta_wp,
                curve_number_amc2=cn,
                initial_infiltration_rate=f0,
                final_infiltration_rate=fc,
                decay_constant=k,
                metadata={
                    "profile_id": profile_id,
                    "method": "Saxton_Rawls_2006_approximation",
                    "clay_pct": clay_pct,
                    "sand_pct": sand_pct,
                    "silt_pct": silt_pct,
                    "bulk_density": bd,
                    "soc_pct": soc,
                },
            )
            self.db.add(hydro)

    async def _get_or_create_source(self, source_name: str):
        source_info = DATA_SOURCES.get(source_name)
        from sqlalchemy import select
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
async def run_soil_ingestion(num_points: int = 100):
    from app.db.session import async_session_maker
    import random

    async with async_session_maker() as db:
        cache = CacheManager()
        await cache.connect()

        pipeline = SoilIngestionPipeline(db, cache)

        # Ingest metadata first
        await pipeline.ingest_soilgrids_metadata()

        # Generate random points in South India
        locations = []
        for _ in range(num_points):
            lat = random.uniform(8.0, 19.0)
            lon = random.uniform(74.0, 84.0)
            locations.append((lat, lon))

        await pipeline.ingest_point_profiles(locations)

        await cache.close()

    return {"status": "completed"}


if __name__ == "__main__":
    import sys
    num_points = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    asyncio.run(run_soil_ingestion(num_points))