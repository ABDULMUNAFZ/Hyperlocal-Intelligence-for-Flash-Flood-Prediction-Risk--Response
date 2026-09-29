# FloodGuard Database Setup
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData, text
from app.core.config import settings

# Naming convention for constraints
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=NAMING_CONVENTION)


class Base(DeclarativeBase):
    metadata = metadata


# Create async engine
engine = create_async_engine(
    str(settings.DATABASE_URL),
    echo=settings.LOG_LEVEL == "DEBUG",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """Dependency for getting DB session."""
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database - create tables. Extensions are created manually."""
    # Import all models to register them
    from app.models import (  # noqa: F401
        core,
        terrain,
        rainfall,
        soil,
        landcover,
        population,
        iot_sensor,
        simulation,
        evacuation,
        alerts,
        training,
    )

    from app.models import live, emergency  # noqa: F401  (live ops + emergency response tables)

    async with engine.begin() as conn:
        # Create missing tables only. (Previously every startup dropped ALL tables, which wiped
        # users, alerts and reports on each dev-server reload.) checkfirst=True skips existing
        # tables, so their indexes are not re-created.
        await conn.run_sync(lambda c: Base.metadata.create_all(c, checkfirst=True))
        # Enum value added after the type was first created
        await conn.execute(text("ALTER TYPE alerttype ADD VALUE IF NOT EXISTS 'LANDSLIDE'"))
        
        # Create spatial indexes manually to avoid SQLAlchemy duplicate index bug
        # Only create indexes for tables that actually have the geometry/location column
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_regions_geometry ON regions USING gist (geometry)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_regions_centroid ON regions USING gist (centroid)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_terrain_tiles_geometry ON terrain_tiles USING gist (geometry)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_watersheds_geometry ON watersheds USING gist (geometry)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_river_network_geometry ON river_network USING gist (geometry)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rainfall_observations_location ON rainfall_observations USING gist (location)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_weather_forecasts_location ON weather_forecasts USING gist (location)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_weather_observations_location ON weather_observations USING gist (location)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_iot_sensors_location ON iot_sensors USING gist (location)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_flood_risks_location ON flood_risks USING gist (location)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_flood_simulations_geometry ON flood_simulations USING gist (simulation_area)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_evacuation_zones_geometry ON evacuation_zones USING gist (geometry)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_evacuation_routes_geometry ON evacuation_routes USING gist (geometry)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_shelters_geometry ON shelters USING gist (geometry)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_alerts_geometry ON alerts USING gist (geometry)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_training_samples_grid_date ON training_samples USING gist (grid_cell_id, event_date)"))
        # Emergency response spatial indexes (also created by alembic revision 7c1e5a2b9d40)
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_locations_geog ON user_locations USING gist (location)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rescue_requests_geog ON rescue_requests USING gist (location)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_shelters_geography ON shelters USING gist ((geometry::geography))"))


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()