# FloodGuard API Schemas - Risk Prediction
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from uuid import UUID


class FloodRiskBase(BaseModel):
    region_id: UUID
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    grid_resolution_m: int = Field(..., ge=50, le=1000)
    current_risk: float = Field(..., ge=0, le=1)
    forecast_24h_risk: Optional[float] = Field(None, ge=0, le=1)
    forecast_48h_risk: Optional[float] = Field(None, ge=0, le=1)
    forecast_72h_risk: Optional[float] = Field(None, ge=0, le=1)
    rainfall_risk: Optional[float] = Field(None, ge=0, le=1)
    terrain_risk: Optional[float] = Field(None, ge=0, le=1)
    soil_risk: Optional[float] = Field(None, ge=0, le=1)
    landcover_risk: Optional[float] = Field(None, ge=0, le=1)
    antecedent_risk: Optional[float] = Field(None, ge=0, le=1)
    uncertainty: Optional[float] = Field(None, ge=0, le=1)
    model_version: str
    valid_until: Optional[datetime] = None
    feature_contributions: Dict[str, float] = {}


class FloodRiskResponse(FloodRiskBase):
    id: UUID
    computed_at: datetime
    metadata: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)


class FloodRiskQueryParams(BaseModel):
    region_id: Optional[UUID] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: Optional[float] = Field(None, gt=0)
    min_risk: Optional[float] = Field(None, ge=0, le=1)
    max_risk: Optional[float] = Field(None, ge=0, le=1)
    grid_resolution_m: Optional[int] = None
    model_version: Optional[str] = None
    forecast_hours: Optional[int] = Field(None, ge=0, le=168)
    since: Optional[datetime] = None
    limit: int = Field(1000, ge=1, le=10000)


class FloodRiskSummaryResponse(BaseModel):
    region_id: UUID
    region_name: str
    total_cells: int
    high_risk_cells: int  # risk > 0.7
    moderate_risk_cells: int  # 0.3 < risk <= 0.7
    low_risk_cells: int  # risk <= 0.3
    max_risk: float
    mean_risk: float
    high_risk_area_sqkm: float
    affected_population: int
    affected_buildings: int
    computed_at: datetime
    model_version: str


class RiskPredictionRequest(BaseModel):
    region_id: UUID
    forecast_hours: int = Field(72, ge=1, le=168)
    grid_resolution_m: int = Field(250, ge=50, le=1000)
    include_components: bool = True
    include_uncertainty: bool = True
    scenario: Optional[str] = None  # Custom scenario name


class RiskPredictionResponse(BaseModel):
    prediction_id: UUID
    region_id: UUID
    status: str
    estimated_completion_seconds: int
    message: str