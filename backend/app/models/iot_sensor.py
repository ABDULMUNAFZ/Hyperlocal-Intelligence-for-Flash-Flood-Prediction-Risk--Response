# FloodGuard Database Models - IoT Sensors & Flood Risk
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class IoTSensor(Base):
    """IoT sensor stations for real-time monitoring."""
    __tablename__ = "iot_sensors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sensor_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    sensor_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # rainfall, water_level, soil_moisture, weather_station
    manufacturer: Mapped[str] = mapped_column(String(100), nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=True)
    firmware_version: Mapped[str] = mapped_column(String(50), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=False,
    )
    elevation_m: Mapped[float] = mapped_column(Float, nullable=True)
    installation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    owner: Mapped[str] = mapped_column(String(255), nullable=True)  # IMD, state_govt, university, private
    maintenance_contact: Mapped[str] = mapped_column(String(255), nullable=True)
    communication: Mapped[str] = mapped_column(String(50), nullable=True)  # lora, gsm, wifi, satellite
    transmission_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    battery_level: Mapped[float] = mapped_column(Float, nullable=True)
    signal_strength: Mapped[float] = mapped_column(Float, nullable=True)
    calibration_params: Mapped[dict] = mapped_column(JSONB, default=dict)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_iot_sensors_type_active", "sensor_type", "is_active"),
    )


class IoTSensorReading(Base):
    """Time-series readings from IoT sensors."""
    __tablename__ = "iot_sensor_readings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sensor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("iot_sensors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Rainfall sensor
    rainfall_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_intensity_mmhr: Mapped[float] = mapped_column(Float, nullable=True)
    # Water level sensor
    water_level_m: Mapped[float] = mapped_column(Float, nullable=True)  # Above sensor datum
    discharge_cms: Mapped[float] = mapped_column(Float, nullable=True)  # m3/s
    # Soil moisture sensor
    soil_moisture_volumetric: Mapped[float] = mapped_column(Float, nullable=True)  # m3/m3
    soil_temperature_c: Mapped[float] = mapped_column(Float, nullable=True)
    soil_ec: Mapped[float] = mapped_column(Float, nullable=True)  # Electrical conductivity
    # Weather station
    temperature_c: Mapped[float] = mapped_column(Float, nullable=True)
    humidity_percent: Mapped[float] = mapped_column(Float, nullable=True)
    pressure_hpa: Mapped[float] = mapped_column(Float, nullable=True)
    wind_speed_ms: Mapped[float] = mapped_column(Float, nullable=True)
    wind_direction_deg: Mapped[float] = mapped_column(Float, nullable=True)
    solar_radiation_wm2: Mapped[float] = mapped_column(Float, nullable=True)
    # Quality
    quality_flag: Mapped[str] = mapped_column(String(20), nullable=True)  # good, suspect, missing, calibrated
    battery_voltage: Mapped[float] = mapped_column(Float, nullable=True)
    signal_rssi: Mapped[float] = mapped_column(Float, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_iot_readings_sensor_time", "sensor_id", "timestamp"),
        Index("idx_iot_readings_time", "timestamp"),
    )


class FloodRisk(Base):
    """Hyperlocal flood risk scores (100m-500m resolution)."""
    __tablename__ = "flood_risks"

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
    # Spatial reference (grid cell centroid)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    grid_resolution_m: Mapped[int] = mapped_column(Integer, nullable=False)  # 100, 250, 500
    # Risk scores (0-1)
    current_risk: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    forecast_24h_risk: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_48h_risk: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_72h_risk: Mapped[float] = mapped_column(Float, nullable=True)
    # Component scores
    rainfall_risk: Mapped[float] = mapped_column(Float, nullable=True)
    terrain_risk: Mapped[float] = mapped_column(Float, nullable=True)
    soil_risk: Mapped[float] = mapped_column(Float, nullable=True)
    landcover_risk: Mapped[float] = mapped_column(Float, nullable=True)
    antecedent_risk: Mapped[float] = mapped_column(Float, nullable=True)
    # Uncertainty
    uncertainty: Mapped[float] = mapped_column(Float, nullable=True)  # 0-1
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # Feature contributions (for explainability)
    feature_contributions: Mapped[dict] = mapped_column(JSONB, default=dict)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    region = relationship("Region", back_populates="flood_risks")

    __table_args__ = (
        UniqueConstraint("region_id", "latitude", "longitude", "grid_resolution_m", "computed_at", name="uq_flood_risk_unique"),
        Index("idx_flood_risks_current_risk", "current_risk"),
        Index("idx_flood_risks_computed", "computed_at"),
    )


class FloodRiskHistory(Base):
    """Historical flood risk scores for trend analysis."""
    __tablename__ = "flood_risk_history"

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
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    grid_resolution_m: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    feature_contributions: Mapped[dict] = mapped_column(JSONB, default=dict)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_flood_risk_hist_region_time", "region_id", "computed_at"),
        Index("idx_flood_risk_hist_location_time", "latitude", "longitude", "computed_at"),
    )