#!/usr/bin/env python3
"""
FloodGuard Master Ingestion CLI
Run all data ingestion pipelines for South India flood prediction.
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db.session import async_session_maker, init_db
from app.services.data_sources import DATA_SOURCES, get_south_india_sources
from app.services.cache import CacheManager

# Import pipelines
from app.data.pipelines.rainfall import run_rainfall_ingestion
from app.data.pipelines.weather import run_forecast_ingestion
from app.data.pipelines.dem import run_dem_ingestion
from app.data.pipelines.soil import run_soil_ingestion
from app.data.pipelines.landcover import run_landcover_ingestion
from app.data.pipelines.osm import run_osm_ingestion
from app.data.pipelines.population import run_population_ingestion
from app.data.pipelines.historical_flood import run_historical_flood_ingestion
from app.data.pipelines.admin_boundaries import run_admin_boundaries_ingestion
from app.data.pipelines.iot import create_demo_sensors

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(f"logs/ingestion_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
    ],
)
logger = logging.getLogger("floodguard.ingestion")


class IngestionRunner:
    """Orchestrates all data ingestion pipelines."""

    def __init__(self, cache: CacheManager):
        self.cache = cache
        self.results = {}

    async def run_all(self, skip: List[str] = None, quick: bool = False):
        """Run all ingestion pipelines."""
        skip = skip or []

        pipelines = [
            ("admin_boundaries", "Administrative Boundaries (GADM)", self._run_admin_boundaries),
            ("dem", "Digital Elevation Model (Copernicus)", self._run_dem),
            ("rainfall", "Rainfall (Open-Meteo)", self._run_rainfall),
            ("weather", "Weather Forecast (Open-Meteo)", self._run_weather),
            ("soil", "Soil Data (SoilGrids)", self._run_soil),
            ("landcover", "Land Cover (ESA WorldCover)", self._run_landcover),
            ("osm", "Infrastructure (OpenStreetMap)", self._run_osm),
            ("population", "Population (WorldPop)", self._run_population),
            ("historical_flood", "Historical Floods (EM-DAT, DFO)", self._run_historical_flood),
            ("iot_demo", "IoT Demo Sensors", self._run_iot_demo),
        ]

        for key, name, func in pipelines:
            if key in skip:
                logger.info(f"Skipping {name}")
                continue

            logger.info(f"{'='*60}")
            logger.info(f"Starting: {name}")
            logger.info(f"{'='*60}")

            start = datetime.now()
            try:
                if quick and key in ["osm", "dem", "soil", "landcover"]:
                    # Quick mode: reduced scope
                    result = await func(quick=True)
                else:
                    result = await func()
                self.results[key] = {"status": "success", "result": result}
                logger.info(f"✓ {name} completed in {(datetime.now() - start).total_seconds():.1f}s")
            except Exception as e:
                logger.error(f"✗ {name} failed: {e}")
                self.results[key] = {"status": "failed", "error": str(e)}

        return self.results

    async def _run_admin_boundaries(self, quick: bool = False):
        from app.data.pipelines.admin_boundaries import run_admin_boundaries_ingestion
        return await run_admin_boundaries_ingestion("v4.1")

    async def _run_dem(self, quick: bool = False):
        max_tiles = 5 if quick else 50
        return await run_dem_ingestion("30m", max_tiles)

    async def _run_rainfall(self, quick: bool = False):
        return await run_rainfall_ingestion(resolution_km=10.0, historical_days=7 if not quick else 0)

    async def _run_weather(self, quick: bool = False):
        return await run_forecast_ingestion(resolution_km=20.0, hours=168)

    async def _run_soil(self, quick: bool = False):
        num_points = 50 if quick else 500
        return await run_soil_ingestion(num_points)

    async def _run_landcover(self, quick: bool = False):
        max_tiles = 3 if quick else 15
        return await run_landcover_ingestion("v200", max_tiles)

    async def _run_osm(self, quick: bool = False):
        if quick:
            # Just do critical infrastructure
            return await run_osm_ingestion("infrastructure")
        return await run_osm_ingestion("all")

    async def _run_population(self, quick: bool = False):
        return await run_population_ingestion()

    async def _run_historical_flood(self, quick: bool = False):
        return await run_historical_flood_ingestion()

    async def _run_iot_demo(self, quick: bool = False):
        async with async_session_maker() as db:
            create_demo_sensors(db)
            return {"status": "created"}


async def main():
    parser = argparse.ArgumentParser(
        description="FloodGuard Data Ingestion CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run all pipelines (full ingestion)
  python -m app.data.ingest_cli

  # Quick test run (reduced scope)
  python -m app.data.ingest_cli --quick

  # Skip specific pipelines
  python -m app.data.ingest_cli --skip osm dem

  # Run only specific pipeline
  python -m app.data.ingest_cli --only rainfall

  # List available pipelines
  python -m app.data.ingest_cli --list
        """
    )
    parser.add_argument(
        "--skip",
        nargs="+",
        help="Pipelines to skip",
        choices=["admin_boundaries", "dem", "rainfall", "weather", "soil",
                 "landcover", "osm", "population", "historical_flood", "iot_demo"],
    )
    parser.add_argument(
        "--only",
        nargs="+",
        help="Run only these pipelines",
        choices=["admin_boundaries", "dem", "rainfall", "weather", "soil",
                 "landcover", "osm", "population", "historical_flood", "iot_demo"],
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Quick mode with reduced scope for testing",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available pipelines and exit",
    )
    parser.add_argument(
        "--init-db",
        action="store_true",
        help="Initialize database before running",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.list:
        print("\nAvailable Ingestion Pipelines:")
        print("-" * 50)
        pipelines = [
            ("admin_boundaries", "Administrative Boundaries (GADM v4.1)"),
            ("dem", "Digital Elevation Model (Copernicus GLO-30/90)"),
            ("rainfall", "Rainfall Observations & Grids (Open-Meteo, ERA5)"),
            ("weather", "Weather Forecast (Open-Meteo, 30+ models)"),
            ("soil", "Soil Properties (ISRIC SoilGrids v2.0)"),
            ("landcover", "Land Cover (ESA WorldCover 2021, 10m)"),
            ("osm", "Infrastructure - Roads, Buildings, Amenities (OpenStreetMap)"),
            ("population", "Population Density (WorldPop 100m)"),
            ("historical_flood", "Historical Flood Events (EM-DAT, Dartmouth)"),
            ("iot_demo", "IoT Demo Sensors (Simulated for testing)"),
        ]
        for key, desc in pipelines:
            print(f"  {key:25} - {desc}")
        print()
        return 0

    # Initialize database
    if args.init_db:
        logger.info("Initializing database...")
        await init_db()
        logger.info("Database initialized")

    # Create cache
    cache = CacheManager()
    await cache.connect()

    try:
        runner = IngestionRunner(cache)

        if args.only:
            # Run only specified pipelines
            skip = [p for p in [
                "admin_boundaries", "dem", "rainfall", "weather", "soil",
                "landcover", "osm", "population", "historical_flood", "iot_demo"
            ] if p not in args.only]
            await runner.run_all(skip=skip, quick=args.quick)
        else:
            await runner.run_all(skip=args.skip, quick=args.quick)

        # Print summary
        print("\n" + "="*60)
        print("INGESTION SUMMARY")
        print("="*60)
        for key, result in runner.results.items():
            status = "✓" if result["status"] == "success" else "✗"
            print(f"  {status} {key:25} - {result['status']}")
            if result["status"] == "failed":
                print(f"      Error: {result['error']}")

        failed = sum(1 for r in runner.results.values() if r["status"] == "failed")
        if failed > 0:
            print(f"\n{failed} pipeline(s) failed")
            return 1
        else:
            print("\nAll pipelines completed successfully!")
            return 0

    finally:
        await cache.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)