# FloodGuard Database Models - Land Cover & Infrastructure
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class LandCoverGrid(Base):
    """Land cover classifications from ESA WorldCover, MODIS, Bhuvan."""
    __tablename__ = "landcover_grids"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # esa_worldcover, modis_mcd12q1, bhuvan_lulc
    product: Mapped[str] = mapped_column(String(100), nullable=False)  # v100_2020, v200_2021, etc.
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    resolution_m: Mapped[float] = mapped_column(Float, nullable=False)  # 10, 30, 500
    # Class distribution (percentage per class)
    class_distribution: Mapped[dict] = mapped_column(JSONB, default=dict)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("source", "product", "year", name="uq_landcover_grid_source_product_year"),
        Index("idx_landcover_grids_year", "year"),
    )


class LandCoverClass(Base):
    """Land cover class definitions and hydrological parameters."""
    __tablename__ = "landcover_classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    class_value: Mapped[int] = mapped_column(Integer, nullable=False)
    class_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    # Hydrological parameters
    manning_n: Mapped[float] = mapped_column(Float, nullable=True)  # Manning's roughness
    curve_number: Mapped[int] = mapped_column(Integer, nullable=True)  # SCS-CN for AMC II
    interception_storage: Mapped[float] = mapped_column(Float, nullable=True)  # mm
    initial_abstraction: Mapped[float] = mapped_column(Float, nullable=True)  # mm
    impervious_fraction: Mapped[float] = mapped_column(Float, nullable=True)  # 0-1
    # Green infrastructure
    is_green_infrastructure: Mapped[bool] = mapped_column(Boolean, default=False)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("source", "class_value", name="uq_landcover_class_source_value"),
    )


class BuildingFootprint(Base):
    """Building footprints from OSM, Bhuvan, Microsoft Building Footprints."""
    __tablename__ = "building_footprints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # osm, bhuvan, microsoft, google
    osm_id: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True),
        nullable=False,
    )
    centroid: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=True,
    )
    area_sqm: Mapped[float] = mapped_column(Float, nullable=True)
    height_m: Mapped[float] = mapped_column(Float, nullable=True)
    levels: Mapped[int] = mapped_column(Integer, nullable=True)
    building_type: Mapped[str] = mapped_column(String(100), nullable=True)  # residential, commercial, industrial, institutional
    use: Mapped[str] = mapped_column(String(100), nullable=True)  # house, apartment, office, school, hospital
    construction_material: Mapped[str] = mapped_column(String(100), nullable=True)
    roof_material: Mapped[str] = mapped_column(String(100), nullable=True)
    foundation_type: Mapped[str] = mapped_column(String(100), nullable=True)
    year_built: Mapped[int] = mapped_column(Integer, nullable=True)
    population: Mapped[int] = mapped_column(Integer, nullable=True)  # Estimated occupancy
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_building_footprints_type", "building_type"),
    )


class RoadNetwork(Base):
    """Road network from OSM, Bhuvan, NHAI."""
    __tablename__ = "road_network"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    osm_id: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    highway_type: Mapped[str] = mapped_column(String(50), nullable=True, index=True)  # motorway, trunk, primary, secondary, tertiary, residential, service
    surface: Mapped[str] = mapped_column(String(50), nullable=True)  # asphalt, concrete, unpaved, gravel
    lanes: Mapped[int] = mapped_column(Integer, nullable=True)
    width_m: Mapped[float] = mapped_column(Float, nullable=True)
    max_speed_kmh: Mapped[int] = mapped_column(Integer, nullable=True)
    oneway: Mapped[bool] = mapped_column(Boolean, default=False)
    bridge: Mapped[bool] = mapped_column(Boolean, default=False)
    tunnel: Mapped[bool] = mapped_column(Boolean, default=False)
    elevation_m: Mapped[float] = mapped_column(Float, nullable=True)
    flood_vulnerability: Mapped[str] = mapped_column(String(20), nullable=True)  # low, medium, high, critical
    # For evacuation routing
    capacity_vehicles_per_hour: Mapped[int] = mapped_column(Integer, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_road_network_highway", "highway_type"),
    )


class CriticalInfrastructure(Base):
    """Critical infrastructure: hospitals, schools, power, water, communications."""
    __tablename__ = "critical_infrastructure"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # hospital, school, power_plant, substation, water_treatment, telecom, shelter, government
    subcategory: Mapped[str] = mapped_column(String(100), nullable=True)
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    address: Mapped[str] = mapped_column(String(500), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=True)  # beds, students, MW, etc.
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=True)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=True)
    operator: Mapped[str] = mapped_column(String(255), nullable=True)
    is_emergency_facility: Mapped[bool] = mapped_column(Boolean, default=False)
    backup_power: Mapped[bool] = mapped_column(Boolean, default=False)
    flood_protection_level: Mapped[str] = mapped_column(String(20), nullable=True)  # none, basic, enhanced, critical
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_critical_infra_category", "category"),
    )