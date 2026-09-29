# FloodGuard Database Models - Terrain & Elevation
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class TerrainTile(Base):
    """DEM tiles from Copernicus GLO-30, SRTM, ALOS."""
    __tablename__ = "terrain_tiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # copernicus_glo30, srtm, alos
    tile_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # e.g., "Copernicus_DSM_COG_10_S15_00_E75_00_DEM"
    resolution_m: Mapped[float] = mapped_column(Float, nullable=False)  # 30, 90
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326),
        nullable=False,
    )
    min_elevation: Mapped[float] = mapped_column(Float, nullable=True)
    max_elevation: Mapped[float] = mapped_column(Float, nullable=True)
    mean_elevation: Mapped[float] = mapped_column(Float, nullable=True)
    std_elevation: Mapped[float] = mapped_column(Float, nullable=True)
    data_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint("source", "tile_id", name="uq_terrain_tile_source_tile"),
    )


class SlopeAspect(Base):
    """Pre-computed slope and aspect from DEM."""
    __tablename__ = "slope_aspect"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    terrain_tile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("terrain_tiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slope_raster: Mapped[bytes] = mapped_column(nullable=True)
    aspect_raster: Mapped[bytes] = mapped_column(nullable=True)
    curvature_raster: Mapped[bytes] = mapped_column(nullable=True)
    flow_direction_raster: Mapped[bytes] = mapped_column(nullable=True)  # D8
    flow_accumulation_raster: Mapped[bytes] = mapped_column(nullable=True)
    twi_raster: Mapped[bytes] = mapped_column(nullable=True)  # Topographic Wetness Index
    spi_raster: Mapped[bytes] = mapped_column(nullable=True)  # Stream Power Index
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_slope_aspect_tile", "terrain_tile_id"),
    )


class Watershed(Base):
    """Delineated watersheds from flow accumulation."""
    __tablename__ = "watersheds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    pour_point_lat: Mapped[float] = mapped_column(nullable=False)
    pour_point_lon: Mapped[float] = mapped_column(nullable=False)
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True),
        nullable=False,
    )
    area_sqkm: Mapped[float] = mapped_column(Float, nullable=False)
    stream_order: Mapped[int] = mapped_column(Integer, nullable=True)  # Strahler order
    mean_slope: Mapped[float] = mapped_column(Float, nullable=True)
    mean_elevation: Mapped[float] = mapped_column(Float, nullable=True)
    hypsometric_integral: Mapped[float] = mapped_column(Float, nullable=True)
    time_of_concentration: Mapped[float] = mapped_column(Float, nullable=True)  # hours
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = ()


class RiverNetwork(Base):
    """River/stream network derived from DEM."""
    __tablename__ = "river_network"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    watershed_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("watersheds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stream_order: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326),
        nullable=False,
    )
    length_m: Mapped[float] = mapped_column(Float, nullable=False)
    slope: Mapped[float] = mapped_column(Float, nullable=True)
    drainage_area_sqkm: Mapped[float] = mapped_column(Float, nullable=True)
    bankfull_width: Mapped[float] = mapped_column(Float, nullable=True)
    bankfull_depth: Mapped[float] = mapped_column(Float, nullable=True)
    manning_n: Mapped[float] = mapped_column(Float, nullable=True)  # Manning's roughness
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("idx_river_network_order", "stream_order"),
    )