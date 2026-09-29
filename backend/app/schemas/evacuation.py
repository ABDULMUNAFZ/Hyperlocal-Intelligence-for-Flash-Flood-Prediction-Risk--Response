# FloodGuard API Schemas - Evacuation
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from uuid import UUID


class EvacuationZoneBase(BaseModel):
    name: str
    region_id: UUID
    zone_type: Literal["immediate", "high", "moderate", "low", "safe"]
    risk_threshold: Optional[float] = Field(None, ge=0, le=1)
    depth_threshold_m: Optional[float] = Field(None, ge=0)
    geometry: Dict[str, Any]  # GeoJSON MultiPolygon
    priority: int = Field(0, ge=0)
    estimated_evacuation_time_minutes: Optional[int] = Field(None, ge=0)
    description: Optional[str] = None


class EvacuationZoneCreate(EvacuationZoneBase):
    pass


class EvacuationZoneResponse(EvacuationZoneBase):
    id: UUID
    area_sqkm: Optional[float] = None
    population: Optional[int] = None
    vulnerable_population: Optional[int] = None
    building_count: Optional[int] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvacuationRouteBase(BaseModel):
    zone_id: UUID
    shelter_id: UUID
    name: Optional[str] = None
    geometry: Dict[str, Any]  # GeoJSON LineString
    length_km: float = Field(..., gt=0)
    estimated_time_minutes: Optional[int] = Field(None, ge=0)
    capacity_vehicles_per_hour: Optional[int] = Field(None, ge=0)
    road_types: List[str] = []
    max_flood_depth_m: Optional[float] = None
    is_viable: bool = True
    viability_notes: Optional[str] = None
    waypoints: List[Dict[str, Any]] = []


class EvacuationRouteCreate(EvacuationRouteBase):
    pass


class EvacuationRouteResponse(EvacuationRouteBase):
    id: UUID
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShelterBase(BaseModel):
    name: str
    region_id: UUID
    shelter_type: Literal["school", "community_hall", "religious", "stadium", "camp", "other"]
    geometry: Dict[str, Any]  # GeoJSON Point
    address: Optional[str] = None
    capacity: int = Field(..., gt=0)
    has_toilets: bool = False
    has_water: bool = False
    has_electricity: bool = False
    has_backup_power: bool = False
    has_medical: bool = False
    has_kitchen: bool = False
    is_accessible: bool = False
    pet_friendly: bool = False
    elevation_m: Optional[float] = None
    flood_risk_level: Optional[Literal["safe", "low", "medium", "high"]] = None
    min_flood_depth_m: Optional[float] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    manager_organization: Optional[str] = None


class ShelterCreate(ShelterBase):
    pass


class ShelterUpdate(BaseModel):
    current_occupancy: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


class ShelterResponse(ShelterBase):
    id: UUID
    current_occupancy: int
    is_active: bool
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvacuationPlanBase(BaseModel):
    region_id: UUID
    name: str
    trigger_conditions: Dict[str, Any]
    zones: List[Dict[str, Any]]
    routes: List[Dict[str, Any]]
    shelters: List[Dict[str, Any]]
    special_needs_plan: Dict[str, Any] = {}
    communication_plan: Dict[str, Any] = {}


class EvacuationPlanCreate(EvacuationPlanBase):
    pass


class EvacuationPlanResponse(EvacuationPlanBase):
    id: UUID
    version: int
    estimated_total_time_hours: Optional[float] = None
    total_population: Optional[int] = None
    total_vehicles: Optional[int] = None
    is_active: bool
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SafeRouteRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lon: float = Field(..., ge=-180, le=180)
    destination_lat: float = Field(..., ge=-90, le=90)
    destination_lon: float = Field(..., ge=-180, le=180)
    avoid_flooded: bool = True
    max_flood_depth_m: float = Field(0.3, ge=0)
    vehicle_type: Literal["car", "motorcycle", "truck", "bus", "walking"] = "car"
    departure_time: Optional[datetime] = None


class SafeRouteResponse(BaseModel):
    geometry: Dict[str, Any]  # GeoJSON LineString
    length_km: float
    estimated_time_minutes: int
    max_flood_depth_m: float
    flood_segments: List[Dict[str, Any]]  # Segments with flood info
    instructions: List[str]
    is_safe: bool
    warnings: List[str] = []