# FloodGuard OSM Infrastructure Ingestion Pipeline
"""Real infrastructure data ingestion from OpenStreetMap."""

import asyncio
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

import httpx
import geopandas as gpd
from shapely.geometry import shape, mapping
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import WKTElement

from app.db.session import get_db
from app.models.landcover import BuildingFootprint, RoadNetwork, CriticalInfrastructure
from app.models.core import DataSource, ProcessingJob, Region
from app.services.data_sources import DATA_SOURCES, DataSourceType
from app.services.cache import CacheManager, ResilientHttpClient, RetryConfig, get_source_health

logger = logging.getLogger(__name__)

# South India bounding box
SOUTH_INDIA_BBOX = [74.0, 8.0, 84.0, 19.0]

# Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# OSM queries for South India
OSM_QUERIES = {
    "buildings": """
    [out:json][timeout:300];
    (
      way["building"]({south},{west},{north},{east});
      relation["building"]({south},{west},{north},{east});
    );
    out body;
    >;
    out skel qt;
    """,
    "roads": """
    [out:json][timeout:300];
    (
      way["highway"]({south},{west},{north},{east});
    );
    out body;
    >;
    out skel qt;
    """,
    "waterways": """
    [out:json][timeout:300];
    (
      way["waterway"]({south},{west},{north},{east});
      relation["waterway"]({south},{west},{north},{east});
    );
    out body;
    >;
    out skel qt;
    """,
    "amenities": """
    [out:json][timeout:300];
    (
      node["amenity"~"hospital|school|fire_station|police|community_centre|shelter"]({south},{west},{north},{east});
      way["amenity"~"hospital|school|fire_station|police|community_centre|shelter"]({south},{west},{north},{east});
    );
    out center;
    """,
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


class OSMClient:
    """Client for querying OpenStreetMap via Overpass API."""

    def __init__(self, cache: Optional[CacheManager] = None):
        self.client = ResilientHttpClient(
            base_url=OVERPASS_URL,
            cache=cache,
            retry_config=RetryConfig(max_attempts=3, base_delay=10.0),
            timeout=300.0,
            rate_limit=0.5,  # Be very respectful to Overpass
        )
        self.health = get_source_health("openstreetmap")

    async def close(self):
        await self.client.close()

    async def query(self, query: str) -> Optional[Dict]:
        """Execute an Overpass query."""
        try:
            result = await self.client.post("/interpreter", data={"data": query}, cache_ttl=86400)
            self.health.record_success()
            return result
        except Exception as e:
            self.health.record_failure(str(e))
            logger.error(f"Overpass query error: {e}")
            return None


class OSMIngestionPipeline:
    """Pipeline for ingesting OSM infrastructure data."""

    def __init__(self, db: AsyncSession, cache: Optional[CacheManager] = None):
        self.db = db
        self.cache = cache
        self.osm = OSMClient(cache)

    async def ingest_buildings(self, bbox: List[float] = None) -> IngestionResult:
        """Ingest building footprints from OSM."""
        result = IngestionResult(
            source_name="openstreetmap",
            job_type="ingest_osm_buildings",
        )

        bbox = bbox or SOUTH_INDIA_BBOX
        west, south, east, north = bbox

        query = OSM_QUERIES["buildings"].format(
            south=south, west=west, north=north, east=east
        )

        logger.info("Querying OSM for buildings in South India...")
        data = await self.osm.query(query)

        if not data or "elements" not in data:
            result.errors.append("Failed to fetch OSM buildings")
            self._record_job(result)
            return result

        elements = data["elements"]
        logger.info(f"Found {len(elements)} OSM elements")

        # Process ways (buildings are typically ways)
        nodes = {el["id"]: (el["lat"], el["lon"]) for el in elements if el["type"] == "node"}

        source = await self._get_or_create_source("openstreetmap")

        for el in elements:
            if el["type"] != "way" or "geometry" not in el:
                continue

            result.records_processed += 1

            # Build geometry from node references
            coords = []
            for node in el["geometry"]:
                coords.append((node["lon"], node["lat"]))

            # Close polygon
            if coords[0] != coords[-1]:
                coords.append(coords[0])

            if len(coords) < 4:
                result.records_failed += 1
                continue

            # Create polygon WKT
            from shapely.geometry import Polygon
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if not poly.is_valid or poly.area == 0:
                result.records_failed += 1
                continue

            # Check for existing
            osm_id = str(el["id"])
            existing = await self.db.execute(
                select(BuildingFootprint).where(
                    BuildingFootprint.source == "osm",
                    BuildingFootprint.osm_id == osm_id,
                )
            )
            if existing.scalar_one_or_none():
                result.records_skipped += 1
                continue

            # Extract tags
            tags = el.get("tags", {})
            building_type = tags.get("building", "yes")
            building_use = self._infer_building_use(tags)

            building = BuildingFootprint(
                source="osm",
                osm_id=osm_id,
                geometry=f"SRID=4326;{poly.wkt}",
                centroid=f"SRID=4326;POINT({poly.centroid.x} {poly.centroid.y})",
                area_sqm=poly.area * 111000 * 111000,  # rough conversion
                building_type=building_type,
                use=building_use,
                levels=tags.get("building:levels"),
                height_m=tags.get("height"),
                metadata={"tags": tags},
            )
            self.db.add(building)
            result.records_inserted += 1

            # Batch commit every 100
            if result.records_inserted % 100 == 0:
                await self.db.commit()
                logger.info(f"Inserted {result.records_inserted} buildings...")

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        logger.info(f"OSM buildings: {result.records_inserted} inserted, {result.records_skipped} skipped")
        return result

    async def ingest_roads(self, bbox: List[float] = None) -> IngestionResult:
        """Ingest road network from OSM."""
        result = IngestionResult(
            source_name="openstreetmap",
            job_type="ingest_osm_roads",
        )

        bbox = bbox or SOUTH_INDIA_BBOX
        west, south, east, north = bbox

        query = OSM_QUERIES["roads"].format(
            south=south, west=west, north=north, east=east
        )

        logger.info("Querying OSM for roads in South India...")
        data = await self.osm.query(query)

        if not data or "elements" not in data:
            result.errors.append("Failed to fetch OSM roads")
            self._record_job(result)
            return result

        elements = data["elements"]
        nodes = {el["id"]: (el["lat"], el["lon"]) for el in elements if el["type"] == "node"}

        source = await self._get_or_create_source("openstreetmap")

        highway_types = {
            "motorway", "trunk", "primary", "secondary", "tertiary",
            "residential", "service", "unclassified", "track", "path",
            "motorway_link", "trunk_link", "primary_link", "secondary_link",
        }

        for el in elements:
            if el["type"] != "way" or "geometry" not in el:
                continue

            tags = el.get("tags", {})
            highway = tags.get("highway")

            if highway not in highway_types:
                continue

            result.records_processed += 1

            coords = [(node["lon"], node["lat"]) for node in el["geometry"]]
            if len(coords) < 2:
                result.records_failed += 1
                continue

            from shapely.geometry import LineString
            line = LineString(coords)
            if not line.is_valid:
                result.records_failed += 1
                continue

            osm_id = str(el["id"])
            existing = await self.db.execute(
                select(RoadNetwork).where(
                    RoadNetwork.source == "osm",
                    RoadNetwork.osm_id == osm_id,
                )
            )
            if existing.scalar_one_or_none():
                result.records_skipped += 1
                continue

            # Determine flood vulnerability based on highway type
            vulnerability = self._road_vulnerability(highway)

            road = RoadNetwork(
                source="osm",
                osm_id=osm_id,
                geometry=f"SRID=4326;{line.wkt}",
                name=tags.get("name"),
                highway_type=highway,
                surface=tags.get("surface"),
                lanes=tags.get("lanes"),
                max_speed_kmh=self._parse_maxspeed(tags.get("maxspeed")),
                oneway=tags.get("oneway") == "yes",
                bridge=tags.get("bridge") == "yes",
                tunnel=tags.get("tunnel") == "yes",
                flood_vulnerability=vulnerability,
                metadata={"tags": tags},
            )
            self.db.add(road)
            result.records_inserted += 1

            if result.records_inserted % 100 == 0:
                await self.db.commit()

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        logger.info(f"OSM roads: {result.records_inserted} inserted")
        return result

    async def ingest_critical_infrastructure(self, bbox: List[float] = None) -> IngestionResult:
        """Ingest critical infrastructure (hospitals, schools, etc.) from OSM."""
        result = IngestionResult(
            source_name="openstreetmap",
            job_type="ingest_osm_critical_infrastructure",
        )

        bbox = bbox or SOUTH_INDIA_BBOX
        west, south, east, north = bbox

        query = OSM_QUERIES["amenities"].format(
            south=south, west=west, north=north, east=east
        )

        data = await self.osm.query(query)

        if not data or "elements" not in data:
            result.errors.append("Failed to fetch OSM amenities")
            self._record_job(result)
            return result

        source = await self._get_or_create_source("openstreetmap")

        category_mapping = {
            "hospital": "hospital",
            "clinic": "hospital",
            "school": "school",
            "university": "school",
            "college": "school",
            "fire_station": "emergency",
            "police": "emergency",
            "community_centre": "community",
            "shelter": "shelter",
            "place_of_worship": "community",
        }

        for el in data["elements"]:
            result.records_processed += 1

            tags = el.get("tags", {})
            amenity = tags.get("amenity")

            if amenity not in category_mapping:
                continue

            # Get coordinates
            if el["type"] == "node":
                lon, lat = el["lon"], el["lat"]
            elif el["type"] == "way" and "center" in el:
                lon, lat = el["center"]["lon"], el["center"]["lat"]
            else:
                continue

            from shapely.geometry import Point
            point = Point(lon, lat)

            category = category_mapping[amenity]
            osm_id = str(el["id"])

            existing = await self.db.execute(
                select(CriticalInfrastructure).where(
                    CriticalInfrastructure.geometry.ST_Equals(f"SRID=4326;{point.wkt}"),
                )
            )
            if existing.scalar_one_or_none():
                result.records_skipped += 1
                continue

            infra = CriticalInfrastructure(
                name=tags.get("name", f"{amenity}_{osm_id}"),
                category=category,
                subcategory=amenity,
                geometry=f"SRID=4326;{point.wkt}",
                address=tags.get("addr:full"),
                capacity=tags.get("capacity"),
                contact_phone=tags.get("phone"),
                contact_email=tags.get("email"),
                operator=tags.get("operator"),
                is_emergency_facility=category in ["hospital", "emergency"],
                metadata={"osm_id": osm_id, "tags": tags},
            )
            self.db.add(infra)
            result.records_inserted += 1

        await self.db.commit()
        result.end_time = datetime.utcnow()
        self._record_job(result)
        logger.info(f"OSM critical infrastructure: {result.records_inserted} inserted")
        return result

    def _infer_building_use(self, tags: Dict) -> str:
        """Infer building use from OSM tags."""
        if "building" in tags:
            btype = tags["building"]
            if btype in ["house", "apartments", "residential", "detached", "terrace"]:
                return "residential"
            elif btype in ["commercial", "office", "retail", "shop", "supermarket"]:
                return "commercial"
            elif btype in ["industrial", "warehouse", "factory"]:
                return "industrial"
            elif btype in ["school", "university", "college", "kindergarten"]:
                return "educational"
            elif btype in ["hospital", "clinic", "healthcare"]:
                return "healthcare"
            elif btype in ["fire_station", "police", "government", "public"]:
                return "government"
            elif btype in ["place_of_worship", "church", "temple", "mosque"]:
                return "religious"
        if "amenity" in tags:
            return tags["amenity"]
        return "unknown"

    def _road_vulnerability(self, highway: str) -> str:
        """Assess flood vulnerability of road type."""
        high_vuln = {"path", "track", "service", "residential"}
        medium_vuln = {"tertiary", "secondary", "primary"}
        low_vuln = {"trunk", "motorway"}

        if highway in high_vuln:
            return "high"
        elif highway in medium_vuln:
            return "medium"
        elif highway in low_vuln:
            return "low"
        return "medium"

    def _parse_maxspeed(self, maxspeed: Optional[str]) -> Optional[int]:
        """Parse maxspeed tag to integer km/h."""
        if not maxspeed:
            return None
        try:
            # Handle formats like "50", "50 km/h", "30 mph"
            import re
            match = re.search(r'(\d+)', maxspeed)
            if match:
                val = int(match.group(1))
                if "mph" in maxspeed.lower():
                    return int(val * 1.609)
                return val
        except Exception:
            pass
        return None

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
async def run_osm_ingestion(ingest_type: str = "all", bbox: List[float] = None):
    from app.db.session import async_session_maker

    async with async_session_maker() as db:
        cache = CacheManager()
        await cache.connect()

        pipeline = OSMIngestionPipeline(db, cache)

        if ingest_type in ["all", "buildings"]:
            await pipeline.ingest_buildings(bbox)
        if ingest_type in ["all", "roads"]:
            await pipeline.ingest_roads(bbox)
        if ingest_type in ["all", "infrastructure"]:
            await pipeline.ingest_critical_infrastructure(bbox)

        await cache.close()

    return {"status": "completed"}


if __name__ == "__main__":
    import sys
    ingest_type = sys.argv[1] if len(sys.argv) > 1 else "all"
    asyncio.run(run_osm_ingestion(ingest_type))