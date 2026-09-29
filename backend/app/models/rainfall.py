# FloodGuard Database Models - Rainfall & Weather
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class RainfallObservation(Base):
    """Point rainfall observations from IMD AWS, rain gauges."""
    __tablename__ = "rainfall_observations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    station_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    station_name: Mapped[str] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # imd_aws, imd_gauge, mosdac, chirps, gsmamp, era5
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    elevation_m: Mapped[float] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    rainfall_mm: Mapped[float] = mapped_column(Float, nullable=False)  # Accumulated since last observation
    intensity_mmhr: Mapped[float] = mapped_column(Float, nullable=True)  # mm/hr
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)  # Accumulation period
    quality_flag: Mapped[str] = mapped_column(String(20), nullable=True)  # good, suspect, missing
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("station_id", "timestamp", name="uq_rainfall_obs_station_time"),
        Index("idx_rainfall_obs_time_location", "timestamp", "location"),
        Index("idx_rainfall_obs_source_time", "source", "timestamp"),
    )


class RainfallGrid(Base):
    """Gridded rainfall products (CHIRPS, GSMaP, ERA5, MSWEP, IMD gridded)."""
    __tablename__ = "rainfall_grids"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    product: Mapped[str] = mapped_column(String(100), nullable=False)  # chirps_daily, gsmamp_hourly, era5_hourly, etc.
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    resolution_deg: Mapped[float] = mapped_column(Float, nullable=False)  # 0.05, 0.1, 0.25
    raster: Mapped[bytes] = mapped_column(nullable=True)
    min_mm: Mapped[float] = mapped_column(Float, nullable=True)
    max_mm: Mapped[float] = mapped_column(Float, nullable=True)
    mean_mm: Mapped[float] = mapped_column(Float, nullable=True)
    coverage_bbox: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326),
        nullable=True,
    )
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("source", "product", "timestamp", name="uq_rainfall_grid_source_product_time"),
        Index("idx_rainfall_grids_time_source", "timestamp", "source"),
    )


class WeatherForecast(Base):
    """Weather forecasts from Open-Meteo, IMD WRF, NOAA GFS, ECMWF."""
    __tablename__ = "weather_forecasts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # open_meteo, imd_wrf, gfs, ecmwf
    model: Mapped[str] = mapped_column(String(100), nullable=False)  # ecmwf_ifs, gfs, icon, wrf_india
    init_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    valid_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    lead_time_hours: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=False,
    )
    # Weather variables
    temperature_2m: Mapped[float] = mapped_column(Float, nullable=True)
    dewpoint_2m: Mapped[float] = mapped_column(Float, nullable=True)
    relative_humidity_2m: Mapped[float] = mapped_column(Float, nullable=True)
    pressure_msl: Mapped[float] = mapped_column(Float, nullable=True)
    wind_speed_10m: Mapped[float] = mapped_column(Float, nullable=True)
    wind_direction_10m: Mapped[float] = mapped_column(Float, nullable=True)
    wind_gust_10m: Mapped[float] = mapped_column(Float, nullable=True)
    precipitation: Mapped[float] = mapped_column(Float, nullable=True)  # mm
    precipitation_probability: Mapped[float] = mapped_column(Float, nullable=True)
    cloudcover: Mapped[float] = mapped_column(Float, nullable=True)
    cloudcover_low: Mapped[float] = mapped_column(Float, nullable=True)
    cloudcover_mid: Mapped[float] = mapped_column(Float, nullable=True)
    cloudcover_high: Mapped[float] = mapped_column(Float, nullable=True)
    cape: Mapped[float] = mapped_column(Float, nullable=True)  # Convective Available Potential Energy
    lifted_index: Mapped[float] = mapped_column(Float, nullable=True)
    soil_moisture_0_7cm: Mapped[float] = mapped_column(Float, nullable=True)
    soil_moisture_7_28cm: Mapped[float] = mapped_column(Float, nullable=True)
    soil_moisture_28_100cm: Mapped[float] = mapped_column(Float, nullable=True)
    soil_moisture_100_255cm: Mapped[float] = mapped_column(Float, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("source", "model", "init_time", "valid_time", "latitude", "longitude", name="uq_weather_fcst_unique"),
        Index("idx_weather_fcst_init_valid", "init_time", "valid_time"),
        Index("idx_weather_fcst_location_time", "location", "valid_time"),
    )


class WeatherObservation(Base):
    """Surface weather observations from IMD AWS, MOSDAC."""
    __tablename__ = "weather_observations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    station_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    station_name: Mapped[str] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    elevation_m: Mapped[float] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    temperature_2m: Mapped[float] = mapped_column(Float, nullable=True)
    dewpoint_2m: Mapped[float] = mapped_column(Float, nullable=True)
    relative_humidity: Mapped[float] = mapped_column(Float, nullable=True)
    pressure: Mapped[float] = mapped_column(Float, nullable=True)
    wind_speed: Mapped[float] = mapped_column(Float, nullable=True)
    wind_direction: Mapped[float] = mapped_column(Float, nullable=True)
    wind_gust: Mapped[float] = mapped_column(Float, nullable=True)
    precipitation: Mapped[float] = mapped_column(Float, nullable=True)
    solar_radiation: Mapped[float] = mapped_column(Float, nullable=True)
    soil_temperature: Mapped[float] = mapped_column(Float, nullable=True)
    soil_moisture: Mapped[float] = mapped_column(Float, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("station_id", "timestamp", name="uq_weather_obs_station_time"),
    )