# FloodGuard Database Models - Flood Simulation
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func, Enum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime
import enum


class SimulationStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FloodSimulation(Base):
    """Flood simulation jobs and results."""
    __tablename__ = "flood_simulations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[SimulationStatus] = mapped_column(
        Enum(SimulationStatus),
        default=SimulationStatus.PENDING,
        nullable=False,
        index=True,
    )
    # Simulation parameters
    scenario_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # forecast, historical, what_if, design_storm
    rainfall_scenario: Mapped[dict] = mapped_column(JSONB, nullable=False)  # Intensity, duration, pattern
    antecedent_conditions: Mapped[dict] = mapped_column(JSONB, default=dict)  # Soil moisture, prior rainfall
    simulation_area: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True),
        nullable=False,
    )
    grid_resolution_m: Mapped[int] = mapped_column(Integer, nullable=False)  # 10, 30, 100
    # Model configuration
    model_type: Mapped[str] = mapped_column(String(50), nullable=False)  # shallow_water_2d, kinematic_wave, diffusive_wave
    solver: Mapped[str] = mapped_column(String(50), nullable=True)  # gpu, cpu
    timestep_seconds: Mapped[float] = mapped_column(Float, nullable=True)
    simulation_duration_hours: Mapped[float] = mapped_column(Float, nullable=False)
    # Infiltration/routing
    infiltration_model: Mapped[str] = mapped_column(String(50), nullable=True)  # green_ampt, horton, scs_cn
    routing_method: Mapped[str] = mapped_column(String(50), nullable=True)  # muskingum, kinematic_wave
    # Execution
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    compute_time_seconds: Mapped[float] = mapped_column(Float, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    # Results (stored as references to raster files or in DB)
    max_depth_raster: Mapped[bytes] = mapped_column(nullable=True)
    max_velocity_raster: Mapped[bytes] = mapped_column(nullable=True)
    arrival_time_raster: Mapped[bytes] = mapped_column(nullable=True)
    flood_extent_raster: Mapped[bytes] = mapped_column(nullable=True)
    # Summary statistics
    max_depth_m: Mapped[float] = mapped_column(Float, nullable=True)
    max_velocity_ms: Mapped[float] = mapped_column(Float, nullable=True)
    flooded_area_sqkm: Mapped[float] = mapped_column(Float, nullable=True)
    flooded_volume_m3: Mapped[float] = mapped_column(Float, nullable=True)
    affected_population: Mapped[int] = mapped_column(Integer, nullable=True)
    affected_buildings: Mapped[int] = mapped_column(Integer, nullable=True)
    affected_roads_km: Mapped[float] = mapped_column(Float, nullable=True)
    # Output files (paths)
    output_directory: Mapped[str] = mapped_column(String(500), nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    created_by_user = relationship("User", back_populates="simulation_jobs")
    time_series = relationship("FloodSimulationTimeSeries", back_populates="simulation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_flood_sim_status", "status"),
        Index("idx_flood_sim_created_by", "created_by"),
    )


class FloodSimulationTimeSeries(Base):
    """Time-series outputs from flood simulation."""
    __tablename__ = "flood_simulation_timeseries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    simulation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("flood_simulations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestep: Mapped[int] = mapped_column(Integer, nullable=False)  # Timestep index
    simulation_time_hours: Mapped[float] = mapped_column(Float, nullable=False)
    depth_raster: Mapped[bytes] = mapped_column(nullable=True)
    velocity_raster: Mapped[bytes] = mapped_column(nullable=True)
    extent_raster: Mapped[bytes] = mapped_column(nullable=True)
    flooded_area_sqkm: Mapped[float] = mapped_column(Float, nullable=True)
    max_depth_m: Mapped[float] = mapped_column(Float, nullable=True)
    max_velocity_ms: Mapped[float] = mapped_column(Float, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    simulation = relationship("FloodSimulation", back_populates="time_series")

    __table_args__ = (
        UniqueConstraint("simulation_id", "timestep", name="uq_flood_sim_ts_unique"),
        Index("idx_flood_sim_ts_sim_time", "simulation_id", "simulation_time_hours"),
    )


class WhatIfScenario(Base):
    """Pre-defined what-if scenarios for quick simulation."""
    __tablename__ = "what_if_scenarios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # design_storm, climate_change, dam_break, urbanization
    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("regions.id", ondelete="CASCADE"),
        nullable=True,
    )
    parameters: Mapped[dict] = mapped_column(JSONB, nullable=False)  # All simulation parameters
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_whatif_category", "category"),
        Index("idx_whatif_region", "region_id"),
    )