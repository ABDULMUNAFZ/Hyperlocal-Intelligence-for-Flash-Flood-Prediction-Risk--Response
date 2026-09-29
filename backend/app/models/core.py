# FloodGuard Database Models - Core
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(Base, TimestampMixin):
    """User accounts for disaster managers, admins, and public users."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="public",
        index=True,
    )  # admin, disaster_manager, analyst, public
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=True)
    organization: Mapped[str] = mapped_column(String(255), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="en")
    notification_preferences: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Relationships
    alert_subscriptions = relationship("AlertSubscription", back_populates="user", cascade="all, delete-orphan")
    simulation_jobs = relationship("FloodSimulation", back_populates="created_by_user", cascade="all, delete-orphan")


class Region(Base, TimestampMixin):
    """Administrative regions for South India (State, District, Taluk, Village)."""
    __tablename__ = "regions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name_local: Mapped[str] = mapped_column(String(255), nullable=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    parent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("regions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    state_code: Mapped[str] = mapped_column(String(10), nullable=True, index=True)
    district_code: Mapped[str] = mapped_column(String(20), nullable=True, index=True)
    census_code: Mapped[str] = mapped_column(String(20), nullable=True, index=True)
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326),
        nullable=False,
    )
    centroid: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    area_sqkm: Mapped[float] = mapped_column(nullable=True)
    population: Mapped[int] = mapped_column(Integer, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    parent = relationship("Region", remote_side=[id], backref="children")
    flood_risks = relationship("FloodRisk", back_populates="region")
    evacuation_zones = relationship("EvacuationZone", back_populates="region")
    shelters = relationship("Shelter", back_populates="region")

    __table_args__ = (
        Index("idx_regions_level_parent", "level", "parent_id"),
    )


class DataSource(Base, TimestampMixin):
    """Track data sources and their metadata for provenance."""
    __tablename__ = "data_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(255), nullable=False)
    api_endpoint: Mapped[str] = mapped_column(String(500), nullable=True)
    license: Mapped[str] = mapped_column(String(255), nullable=True)
    attribution: Mapped[str] = mapped_column(Text, nullable=True)
    update_frequency: Mapped[str] = mapped_column(String(50), nullable=True)
    spatial_resolution: Mapped[str] = mapped_column(String(50), nullable=True)
    temporal_resolution: Mapped[str] = mapped_column(String(50), nullable=True)
    coverage_area: Mapped[str] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_fetched: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_successful_fetch: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    fetch_error_count: Mapped[int] = mapped_column(Integer, default=0)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)


class ProcessingJob(Base, TimestampMixin):
    """Track ETL and data processing jobs."""
    __tablename__ = "processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    job_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True, default="pending")
    data_source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("data_sources.id", ondelete="SET NULL"),
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    records_processed: Mapped[int] = mapped_column(Integer, default=0)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)