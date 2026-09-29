# FloodGuard API Schemas - Flood Simulation
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from uuid import UUID


class FloodSimulationBase(BaseModel):
    name: str
    description: Optional[str] = None
    scenario_type: Literal["forecast", "historical", "what_if", "design_storm"]
    rainfall_scenario: Dict[str, Any]
    antecedent_conditions: Dict[str, Any] = {}
    simulation_area: Dict[str, Any]  # GeoJSON Polygon
    grid_resolution_m: int = Field(..., ge=5, le=500)
    model_type: Literal["shallow_water_2d", "kinematic_wave", "diffusive_wave"]
    solver: Optional[Literal["gpu", "cpu"]] = "cpu"
    timestep_seconds: Optional[float] = Field(None, gt=0)
    simulation_duration_hours: float = Field(..., gt=0, le=168)
    infiltration_model: Optional[Literal["green_ampt", "horton", "scs_cn"]] = None
    routing_method: Optional[Literal["muskingum", "kinematic_wave"]] = None


class FloodSimulationCreate(FloodSimulationBase):
    pass


class FloodSimulationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class FloodSimulationResponse(FloodSimulationBase):
    id: UUID
    created_by: Optional[UUID] = None
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    compute_time_seconds: Optional[float] = None
    error_message: Optional[str] = None
    max_depth_m: Optional[float] = None
    max_velocity_ms: Optional[float] = None
    flooded_area_sqkm: Optional[float] = None
    flooded_volume_m3: Optional[float] = None
    affected_population: Optional[int] = None
    affected_buildings: Optional[int] = None
    affected_roads_km: Optional[float] = None
    output_directory: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FloodSimulationStatusResponse(BaseModel):
    id: UUID
    status: str
    progress_percent: Optional[float] = None
    current_timestep: Optional[int] = None
    total_timesteps: Optional[int] = None
    estimated_remaining_seconds: Optional[float] = None
    error_message: Optional[str] = None


class FloodSimulationResultResponse(BaseModel):
    simulation_id: UUID
    max_depth: Dict[str, Any]  # Raster info + stats
    max_velocity: Dict[str, Any]
    arrival_time: Dict[str, Any]
    flood_extent: Dict[str, Any]
    time_series: List[Dict[str, Any]]
    summary: Dict[str, Any]


class WhatIfScenarioBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    region_id: Optional[UUID] = None
    parameters: Dict[str, Any]
    is_template: bool = False
    is_public: bool = True


class WhatIfScenarioCreate(WhatIfScenarioBase):
    pass


class WhatIfScenarioResponse(WhatIfScenarioBase):
    id: UUID
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SimulationQueryParams(BaseModel):
    status: Optional[str] = None
    scenario_type: Optional[str] = None
    created_by: Optional[UUID] = None
    region_id: Optional[UUID] = None
    since: Optional[datetime] = None
    limit: int = Field(50, ge=1, le=200)