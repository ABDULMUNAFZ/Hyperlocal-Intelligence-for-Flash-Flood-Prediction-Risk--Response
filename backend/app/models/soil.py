# FloodGuard Database Models - Soil
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class SoilGrid(Base):
    """Soil properties from SoilGrids (ISRIC) at 250m resolution."""
    __tablename__ = "soil_grids"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    property_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # ph, soc, bd, clay, sand, silt, cec, nitrogen
    depth_interval: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # 0-5cm, 5-15cm, 15-30cm, 30-60cm, 60-100cm, 100-200cm
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    raster: Mapped[bytes] = mapped_column(nullable=True)
    min_value: Mapped[float] = mapped_column(Float, nullable=True)
    max_value: Mapped[float] = mapped_column(Float, nullable=True)
    mean_value: Mapped[float] = mapped_column(Float, nullable=True)
    uncertainty_raster: Mapped[bytes] = mapped_column(nullable=True)
    source_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v2.0")
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("property_name", "depth_interval", name="uq_soil_grid_prop_depth"),
        Index("idx_soil_grids_property_depth", "property_name", "depth_interval"),
    )


class SoilProfile(Base):
    """Detailed soil profile data from WoSIS/ISRIC for specific locations."""
    __tablename__ = "soil_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    profile_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    country: Mapped[str] = mapped_column(String(100), nullable=True)
    taxonomy: Mapped[str] = mapped_column(String(255), nullable=True)  # WRB/USDA classification
    drainage_class: Mapped[str] = mapped_column(String(50), nullable=True)  # well, moderate, poor, very_poor
    layers: Mapped[list] = mapped_column(JSONB, default=list)  # List of layer dicts with depth, properties
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = ()


class SoilHydraulicProperties(Base):
    """Derived hydraulic properties for infiltration modeling."""
    __tablename__ = "soil_hydraulic_properties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    soil_grid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("soil_grids.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Green-Ampt parameters
    saturated_hydraulic_conductivity: Mapped[float] = mapped_column(Float, nullable=True)  # Ks (mm/hr)
    wetting_front_suction: Mapped[float] = mapped_column(Float, nullable=True)  # psi (mm)
    porosity: Mapped[float] = mapped_column(Float, nullable=True)  # theta_s
    field_capacity: Mapped[float] = mapped_column(Float, nullable=True)  # theta_fc
    wilting_point: Mapped[float] = mapped_column(Float, nullable=True)  # theta_wp
    # SCS-CN parameters
    curve_number_amc1: Mapped[int] = mapped_column(Integer, nullable=True)  # Antecedent Moisture Condition I
    curve_number_amc2: Mapped[int] = mapped_column(Integer, nullable=True)  # AMC II (normal)
    curve_number_amc3: Mapped[int] = mapped_column(Integer, nullable=True)  # AMC III (wet)
    # Horton parameters
    initial_infiltration_rate: Mapped[float] = mapped_column(Float, nullable=True)  # f0 (mm/hr)
    final_infiltration_rate: Mapped[float] = mapped_column(Float, nullable=True)  # fc (mm/hr)
    decay_constant: Mapped[float] = mapped_column(Float, nullable=True)  # k (1/hr)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_soil_hydraulic_grid", "soil_grid_id"),
    )