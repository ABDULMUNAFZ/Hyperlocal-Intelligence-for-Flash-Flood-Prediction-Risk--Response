# FloodGuard API Schemas - Terrain & Soil
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from uuid import UUID


# Terrain
class TerrainTileResponse(BaseModel):
    id: UUID
    source: str
    tile_id: str
    resolution_m: float
    geometry: Dict[str, Any]
    min_elevation: Optional[float] = None
    max_elevation: Optional[float] = None
    mean_elevation: Optional[float] = None
    std_elevation: Optional[float] = None
    data_date: Optional[datetime] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ElevationQueryParams(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    source: Optional[str] = None


class ElevationResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_m: float
    source: str
    resolution_m: float


class ElevationProfileParams(BaseModel):
    coordinates: List[List[float]]  # [[lon, lat], ...]
    source: Optional[str] = None
    num_points: int = Field(100, ge=10, le=1000)


class ElevationProfileResponse(BaseModel):
    distances_m: List[float]
    elevations_m: List[float]
    coordinates: List[List[float]]


class SlopeAspectQueryParams(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_m: float = Field(1000, gt=0, le=10000)


class SlopeAspectResponse(BaseModel):
    latitude: float
    longitude: float
    slope_degrees: float
    aspect_degrees: float
    curvature: Optional[float] = None
    flow_direction: Optional[int] = None
    flow_accumulation: Optional[float] = None
    twi: Optional[float] = None
    spi: Optional[float] = None


class WatershedResponse(BaseModel):
    id: UUID
    name: Optional[str] = None
    pour_point: Dict[str, float]
    geometry: Dict[str, Any]
    area_sqkm: float
    stream_order: Optional[int] = None
    mean_slope: Optional[float] = None
    mean_elevation: Optional[float] = None
    time_of_concentration_hours: Optional[float] = None
    metadata: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)


# Soil
class SoilPropertyResponse(BaseModel):
    id: UUID
    property_name: str
    depth_interval: str
    unit: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    mean_value: Optional[float] = None
    source_version: str
    metadata: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)


class SoilQueryParams(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    properties: Optional[List[str]] = None
    depths: Optional[List[str]] = None


class SoilProfileResponse(BaseModel):
    latitude: float
    longitude: float
    properties: Dict[str, Dict[str, float]]  # property -> {depth: value}
    hydraulic_properties: Optional[Dict[str, Any]] = None
    taxonomy: Optional[str] = None
    drainage_class: Optional[str] = None


class SoilHydraulicResponse(BaseModel):
    saturated_hydraulic_conductivity: Optional[float] = None  # mm/hr
    wetting_front_suction: Optional[float] = None  # mm
    porosity: Optional[float] = None
    field_capacity: Optional[float] = None
    wilting_point: Optional[float] = None
    curve_number_amc2: Optional[int] = None
    initial_infiltration_rate: Optional[float] = None  # mm/hr
    final_infiltration_rate: Optional[float] = None  # mm/hr
    decay_constant: Optional[float] = None  # 1/hr