# FloodGuard Database Models - Population & Historical Flood
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class PopulationGrid(Base):
    """Population density grids from WorldPop, LandScan, Census."""
    __tablename__ = "population_grids"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # worldpop, landscan, census
    product: Mapped[str] = mapped_column(String(100), nullable=False)  # wpgp_unconstrained, wpgp_constrained, landscan_2022
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    resolution_m: Mapped[float] = mapped_column(Float, nullable=False)  # 100, 1000, etc.
    raster: Mapped[bytes] = mapped_column(nullable=True)
    total_population: Mapped[int] = mapped_column(Integer, nullable=True)
    min_density: Mapped[float] = mapped_column(Float, nullable=True)  # persons/sqkm
    max_density: Mapped[float] = mapped_column(Float, nullable=True)
    mean_density: Mapped[float] = mapped_column(Float, nullable=True)
    # Age/sex breakdown (if available)
    age_sex_breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("source", "product", "year", name="uq_population_grid_source_product_year"),
        Index("idx_population_grids_year", "year"),
    )


class PopulationStats(Base):
    """Aggregated population statistics by region."""
    __tablename__ = "population_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("regions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    total_population: Mapped[int] = mapped_column(Integer, nullable=False)
    male_population: Mapped[int] = mapped_column(Integer, nullable=True)
    female_population: Mapped[int] = mapped_column(Integer, nullable=True)
    age_0_14: Mapped[int] = mapped_column(Integer, nullable=True)
    age_15_64: Mapped[int] = mapped_column(Integer, nullable=True)
    age_65_plus: Mapped[int] = mapped_column(Integer, nullable=True)
    population_density: Mapped[float] = mapped_column(Float, nullable=True)  # persons/sqkm
    vulnerable_population: Mapped[int] = mapped_column(Integer, nullable=True)  # elderly, children, disabled
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("region_id", "year", "source", name="uq_pop_stats_region_year_source"),
    )


class HistoricalFloodEvent(Base):
    """Historical flood events from Dartmouth, EM-DAT, NIDM, news, satellite."""
    __tablename__ = "historical_flood_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    event_id: Mapped[str] = mapped_column(String(100), nullable=True, index=True)  # External ID (EM-DAT, DFO)
    name: Mapped[str] = mapped_column(String(255), nullable=True)  # e.g., "2018 Kerala Floods"
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # dartmouth, emdat, nidm, satellite, news, local
    flood_type: Mapped[str] = mapped_column(String(50), nullable=True, index=True)  # flash_flood, river_flood, coastal, urban, pluvial
    cause: Mapped[str] = mapped_column(String(100), nullable=True)  # heavy_rain, cloudburst, dam_break, cyclone
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=True)
    # Location
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    state: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    affected_area_sqkm: Mapped[float] = mapped_column(Float, nullable=True)
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True),
        nullable=True,
    )
    centroid: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=True,
    )
    # Impact
    fatalities: Mapped[int] = mapped_column(Integer, nullable=True)
    injured: Mapped[int] = mapped_column(Integer, nullable=True)
    displaced: Mapped[int] = mapped_column(Integer, nullable=True)
    affected_population: Mapped[int] = mapped_column(Integer, nullable=True)
    houses_damaged: Mapped[int] = mapped_column(Integer, nullable=True)
    houses_destroyed: Mapped[int] = mapped_column(Integer, nullable=True)
    economic_loss_usd: Mapped[float] = mapped_column(Float, nullable=True)
    # Meteorological
    max_rainfall_mm: Mapped[float] = mapped_column(Float, nullable=True)
    max_rainfall_duration_hours: Mapped[int] = mapped_column(Integer, nullable=True)
    antecedent_rainfall_mm: Mapped[float] = mapped_column(Float, nullable=True)  # 7-day prior
    # Validation
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_source: Mapped[str] = mapped_column(String(255), nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_hist_flood_event_dates", "start_date", "end_date"),
        Index("idx_hist_flood_event_location", "state", "district"),
    )


class HistoricalFloodExtent(Base):
    """Observed flood extents from satellite (Sentinel-1, MODIS, Landsat)."""
    __tablename__ = "historical_flood_extents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("historical_flood_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    observation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    satellite: Mapped[str] = mapped_column(String(50), nullable=False)  # sentinel1, modis, landsat, radarsat
    sensor: Mapped[str] = mapped_column(String(50), nullable=True)  # SAR, optical
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326),
        nullable=False,
    )
    area_sqkm: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[str] = mapped_column(String(20), nullable=True)  # high, medium, low
    processing_level: Mapped[str] = mapped_column(String(50), nullable=True)  # L1, L2, L3
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_hist_flood_extent_event_date", "event_id", "observation_date"),
    )