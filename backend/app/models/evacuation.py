# FloodGuard Database Models - Evacuation
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class EvacuationZone(Base):
    """Evacuation zones based on flood risk contours."""
    __tablename__ = "evacuation_zones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("regions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zone_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # immediate, high, moderate, low, safe
    risk_threshold: Mapped[float] = mapped_column(Float, nullable=True)  # Risk score threshold
    depth_threshold_m: Mapped[float] = mapped_column(Float, nullable=True)  # Flood depth threshold
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326),
        nullable=False,
    )
    area_sqkm: Mapped[float] = mapped_column(Float, nullable=True)
    population: Mapped[int] = mapped_column(Integer, nullable=True)
    vulnerable_population: Mapped[int] = mapped_column(Integer, nullable=True)
    building_count: Mapped[int] = mapped_column(Integer, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # Evacuation priority (higher = evacuate first)
    estimated_evacuation_time_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    region = relationship("Region", back_populates="evacuation_zones")
    routes = relationship("EvacuationRoute", back_populates="zone")

    __table_args__ = (
        Index("idx_evac_zones_region_priority", "region_id", "priority"),
    )


class EvacuationRoute(Base):
    """Safe evacuation routes computed on flood-adjusted road network."""
    __tablename__ = "evacuation_routes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    zone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("evacuation_zones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shelter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shelters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326),
        nullable=False,
    )
    length_km: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_time_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    capacity_vehicles_per_hour: Mapped[int] = mapped_column(Integer, nullable=True)
    road_types: Mapped[list] = mapped_column(ARRAY(String), default=list)  # Types of roads used
    max_flood_depth_m: Mapped[float] = mapped_column(Float, nullable=True)  # Max depth along route
    is_viable: Mapped[bool] = mapped_column(Boolean, default=True)
    viability_notes: Mapped[str] = mapped_column(Text, nullable=True)
    # Turn-by-turn directions (simplified)
    waypoints: Mapped[list] = mapped_column(JSONB, default=list)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    zone = relationship("EvacuationZone", back_populates="routes")
    shelter = relationship("Shelter", back_populates="routes")

    __table_args__ = (
        Index("idx_evac_routes_zone_shelter", "zone_id", "shelter_id"),
    )


class Shelter(Base):
    """Emergency shelters with capacity and facilities."""
    __tablename__ = "shelters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("regions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shelter_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # school, community_hall, religious, stadium, camp
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    address: Mapped[str] = mapped_column(String(500), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    current_occupancy: Mapped[int] = mapped_column(Integer, default=0)
    # Facilities
    has_toilets: Mapped[bool] = mapped_column(Boolean, default=False)
    has_water: Mapped[bool] = mapped_column(Boolean, default=False)
    has_electricity: Mapped[bool] = mapped_column(Boolean, default=False)
    has_backup_power: Mapped[bool] = mapped_column(Boolean, default=False)
    has_medical: Mapped[bool] = mapped_column(Boolean, default=False)
    has_kitchen: Mapped[bool] = mapped_column(Boolean, default=False)
    is_accessible: Mapped[bool] = mapped_column(Boolean, default=False)  # Disabled access
    pet_friendly: Mapped[bool] = mapped_column(Boolean, default=False)
    # Flood safety
    elevation_m: Mapped[float] = mapped_column(Float, nullable=True)
    flood_risk_level: Mapped[str] = mapped_column(String(20), nullable=True)  # safe, low, medium, high
    min_flood_depth_m: Mapped[float] = mapped_column(Float, nullable=True)  # Depth at shelter location in 100yr flood
    contact_person: Mapped[str] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=True)
    manager_organization: Mapped[str] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    region = relationship("Region", back_populates="shelters")
    routes = relationship("EvacuationRoute", back_populates="shelter")

    __table_args__ = (
        Index("idx_shelters_region_active", "region_id", "is_active"),
    )


class EvacuationPlan(Base):
    """Complete evacuation plans for regions."""
    __tablename__ = "evacuation_plans"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    trigger_conditions: Mapped[dict] = mapped_column(JSONB, nullable=False)  # Risk thresholds, forecast criteria
    zones: Mapped[list] = mapped_column(JSONB, default=list)  # Zone IDs and priorities
    routes: Mapped[list] = mapped_column(JSONB, default=list)  # Route assignments
    shelters: Mapped[list] = mapped_column(JSONB, default=list)  # Shelter assignments with capacities
    estimated_total_time_hours: Mapped[float] = mapped_column(Float, nullable=True)
    total_population: Mapped[int] = mapped_column(Integer, nullable=True)
    total_vehicles: Mapped[int] = mapped_column(Integer, nullable=True)
    special_needs_plan: Mapped[dict] = mapped_column(JSONB, default=dict)  # Elderly, disabled, hospitals
    communication_plan: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    approved_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_evac_plans_region_active", "region_id", "is_active"),
    )