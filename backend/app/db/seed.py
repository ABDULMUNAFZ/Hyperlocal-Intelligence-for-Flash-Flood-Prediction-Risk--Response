# FloodGuard Database Seeder
"""Seeds initial users, regions, data sources, and demo sensors."""

import asyncio
import logging
from sqlalchemy import select, text
from app.db.session import async_session_maker
from app.models.core import User, Region, DataSource
from app.models.iot_sensor import IoTSensor
from app.api.v1.endpoints.auth import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("floodguard.seed")


DEMO_USERS = [
    {
        "email": "demo@floodguard.in",
        "full_name": "Demo User",
        "role": "disaster_manager",
        "organization": "Kerala State Disaster Management Authority",
        "phone": "+919876543210",
    },
    {
        "email": "dm@floodguard.in",
        "full_name": "Disaster Manager",
        "role": "disaster_manager",
        "organization": "State Emergency Operations Centre",
        "phone": "+919876543211",
    },
    {
        "email": "analyst@floodguard.in",
        "full_name": "Geospatial Analyst",
        "role": "analyst",
        "organization": "Hydrology & Remote Sensing Cell",
        "phone": "+919876543212",
    },
    {
        "email": "public@floodguard.in",
        "full_name": "Citizen User",
        "role": "public",
        "organization": "Community Volunteer",
        "phone": "+919876543213",
    },
    {
        "email": "admin@floodguard.in",
        "full_name": "System Administrator",
        "role": "admin",
        "organization": "FloodGuard Operations",
        "phone": "+919876543214",
    },
]

REGIONS = [
    {
        "name": "Kerala",
        "name_local": "കേരളം",
        "level": 1,
        "state_code": "KL",
        "geometry": "MULTIPOLYGON(((74.0 8.0, 77.5 8.0, 77.5 12.5, 74.0 12.5, 74.0 8.0)))",
        "centroid": "POINT(76.0 10.0)",
        "area_sqkm": 38852,
        "population": 33406061,
        "metadata": '{"source": "gadm"}',
    },
    {
        "name": "Karnataka",
        "name_local": "ಕರ್ನಾಟಕ",
        "level": 1,
        "state_code": "KA",
        "geometry": "MULTIPOLYGON(((74.0 11.5, 78.5 11.5, 78.5 18.5, 74.0 18.5, 74.0 11.5)))",
        "centroid": "POINT(76.5 15.0)",
        "area_sqkm": 191791,
        "population": 61130704,
        "metadata": '{"source": "gadm"}',
    },
    {
        "name": "Tamil Nadu",
        "name_local": "தமிழ்நாடு",
        "level": 1,
        "state_code": "TN",
        "geometry": "MULTIPOLYGON(((77.0 8.0, 80.5 8.0, 80.5 13.5, 77.0 13.5, 77.0 8.0)))",
        "centroid": "POINT(78.5 10.5)",
        "area_sqkm": 130058,
        "population": 72147030,
        "metadata": '{"source": "gadm"}',
    },
    {
        "name": "Andhra Pradesh",
        "name_local": "ఆంధ్రప్రదేశ్",
        "level": 1,
        "state_code": "AP",
        "geometry": "MULTIPOLYGON(((77.0 12.5, 84.5 12.5, 84.5 19.5, 77.0 19.5, 77.0 12.5)))",
        "centroid": "POINT(80.5 16.0)",
        "area_sqkm": 162970,
        "population": 49577103,
        "metadata": '{"source": "gadm"}',
    },
    {
        "name": "Telangana",
        "name_local": "తెలంగాణ",
        "level": 1,
        "state_code": "TG",
        "geometry": "MULTIPOLYGON(((77.0 15.5, 81.5 15.5, 81.5 19.5, 77.0 19.5, 77.0 15.5)))",
        "centroid": "POINT(79.5 17.5)",
        "area_sqkm": 112077,
        "population": 35193978,
        "metadata": '{"source": "gadm"}',
    },
]

DATA_SOURCES = [
    {
        "name": "open_meteo_rainfall",
        "description": "Open-Meteo Rainfall observations and API",
        "source_type": "rainfall",
        "provider": "Open-Meteo",
        "license": "CC-BY-4.0",
        "attribution": "Data by Open-Meteo",
        "is_active": True,
    },
    {
        "name": "open_meteo_forecast",
        "description": "Open-Meteo Weather Forecast (Hourly & Daily)",
        "source_type": "weather_forecast",
        "provider": "Open-Meteo",
        "license": "CC-BY-4.0",
        "attribution": "Data by Open-Meteo",
        "is_active": True,
    },
    {
        "name": "copernicus_glo30",
        "description": "Copernicus DEM GLO-30 Digital Elevation Model",
        "source_type": "dem",
        "provider": "Copernicus/ESA",
        "license": "Copernicus Free License",
        "attribution": "Copernicus DEM",
        "is_active": True,
    },
    {
        "name": "soilgrids",
        "description": "SoilGrids v2.0 Global Soil Information",
        "source_type": "soil",
        "provider": "ISRIC",
        "license": "CC-BY-4.0",
        "attribution": "SoilGrids by ISRIC",
        "is_active": True,
    },
    {
        "name": "esa_worldcover",
        "description": "ESA WorldCover 10m Land Cover",
        "source_type": "landcover",
        "provider": "ESA Copernicus",
        "license": "CC-BY-4.0",
        "attribution": "ESA WorldCover",
        "is_active": True,
    },
    {
        "name": "openstreetmap",
        "description": "OpenStreetMap Roads, Rivers & Critical Infrastructure",
        "source_type": "infrastructure",
        "provider": "OSM Community",
        "license": "ODbL",
        "attribution": "© OpenStreetMap contributors",
        "is_active": True,
    },
    {
        "name": "worldpop",
        "description": "WorldPop Population Count & Density Grids",
        "source_type": "population",
        "provider": "WorldPop",
        "license": "CC-BY-4.0",
        "attribution": "WorldPop",
        "is_active": True,
    },
]

DEMO_SENSORS = [
    {
        "sensor_id": "SIM_KL_WAY_001",
        "name": "Wayanad Hillcrest Water Level",
        "sensor_type": "water_level",
        "latitude": 11.6854,
        "longitude": 76.1320,
        "elevation_m": 750,
        "location": "POINT(76.1320 11.6854)",
    },
    {
        "sensor_id": "SIM_KL_IDK_001",
        "name": "Idukki Reservoir Inflow Station",
        "sensor_type": "water_level",
        "latitude": 9.8497,
        "longitude": 76.9710,
        "elevation_m": 820,
        "location": "POINT(76.9710 9.8497)",
    },
    {
        "sensor_id": "SIM_KL_KOC_001",
        "name": "Kochi Coastal Rain Gauge",
        "sensor_type": "rainfall",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "elevation_m": 12,
        "location": "POINT(76.2673 9.9312)",
    },
    {
        "sensor_id": "SIM_KA_COORG_001",
        "name": "Coorg Catchment Gauge",
        "sensor_type": "rainfall",
        "latitude": 12.4244,
        "longitude": 75.7382,
        "elevation_m": 1050,
        "location": "POINT(75.7382 12.4244)",
    },
    {
        "sensor_id": "SIM_TN_NIL_001",
        "name": "Nilgiris Slope Soil Moisture",
        "sensor_type": "soil_moisture",
        "latitude": 11.4102,
        "longitude": 76.6950,
        "elevation_m": 1800,
        "location": "POINT(76.6950 11.4102)",
    },
]


async def seed_all():
    logger.info("Starting FloodGuard database seeding...")
    hashed_password = get_password_hash("demo123")

    async with async_session_maker() as session:
        # 1. Users
        for user_data in DEMO_USERS:
            stmt = select(User).where(User.email == user_data["email"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                user = User(
                    email=user_data["email"],
                    hashed_password=hashed_password,
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    organization=user_data["organization"],
                    phone=user_data["phone"],
                    is_active=True,
                    is_verified=True,
                )
                session.add(user)
                logger.info(f"Created user: {user_data['email']}")
        await session.commit()

        # 2. Regions
        for r in REGIONS:
            stmt = select(Region).where(Region.name == r["name"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                await session.execute(
                    text(
                        """
                        INSERT INTO regions (id, name, name_local, level, state_code, geometry, centroid, area_sqkm, population, metadata)
                        VALUES (
                            gen_random_uuid(), :name, :name_local, :level, :state_code,
                            ST_GeomFromText(:geometry, 4326),
                            ST_GeogFromText(:centroid),
                            :area_sqkm, :population, CAST(:metadata AS jsonb)
                        )
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    {
                        "name": r["name"],
                        "name_local": r["name_local"],
                        "level": r["level"],
                        "state_code": r["state_code"],
                        "geometry": r["geometry"],
                        "centroid": r["centroid"],
                        "area_sqkm": r["area_sqkm"],
                        "population": r["population"],
                        "metadata": '{"source": "gadm"}',
                    },
                )
                logger.info(f"Created region: {r['name']}")
        await session.commit()

        # 3. Data Sources
        for ds in DATA_SOURCES:
            stmt = select(DataSource).where(DataSource.name == ds["name"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                source = DataSource(
                    name=ds["name"],
                    description=ds["description"],
                    source_type=ds["source_type"],
                    provider=ds["provider"],
                    license=ds["license"],
                    attribution=ds["attribution"],
                    is_active=ds["is_active"],
                )
                session.add(source)
                logger.info(f"Created data source: {ds['name']}")
        await session.commit()

        # 4. Demo IoT Sensors
        for sensor in DEMO_SENSORS:
            stmt = select(IoTSensor).where(IoTSensor.sensor_id == sensor["sensor_id"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                await session.execute(
                    text(
                        """
                        INSERT INTO iot_sensors (
                            id, sensor_id, name, sensor_type, manufacturer, model,
                            latitude, longitude, elevation_m, location, owner,
                            communication, transmission_interval_minutes, is_active, calibration_params, metadata
                        )
                        VALUES (
                            gen_random_uuid(), :sensor_id, :name, :sensor_type, 'FloodGuard', 'v1',
                            :latitude, :longitude, :elevation_m, ST_GeogFromText(:location),
                            'demo@floodguard.in', 'simulated', 15, true, '{}'::jsonb, '{"simulated": true}'::jsonb
                        )
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    sensor,
                )
                logger.info(f"Created IoT sensor: {sensor['name']}")
        await session.commit()

    logger.info("✓ Database seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_all())
