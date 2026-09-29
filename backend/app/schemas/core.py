# FloodGuard API Schemas - Core
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "public"
    phone: Optional[str] = None
    organization: Optional[str] = None
    preferred_language: str = "en"


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    organization: Optional[str] = None
    preferred_language: Optional[str] = None
    is_active: Optional[bool] = None
    notification_preferences: Optional[Dict[str, Any]] = None


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    role: Optional[str] = None


class RegionBase(BaseModel):
    name: str
    name_local: Optional[str] = None
    level: int = Field(..., ge=1, le=4)
    parent_id: Optional[UUID] = None
    state_code: Optional[str] = None
    district_code: Optional[str] = None
    census_code: Optional[str] = None
    area_sqkm: Optional[float] = None
    population: Optional[int] = None


class RegionCreate(RegionBase):
    geometry: Dict[str, Any]  # GeoJSON


class RegionResponse(RegionBase):
    id: UUID
    centroid: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RegionTreeResponse(RegionResponse):
    children: List["RegionTreeResponse"] = []

    model_config = ConfigDict(from_attributes=True)


RegionTreeResponse.model_rebuild()


class DataSourceBase(BaseModel):
    name: str
    description: Optional[str] = None
    source_type: str
    provider: str
    api_endpoint: Optional[str] = None
    license: Optional[str] = None
    attribution: Optional[str] = None
    update_frequency: Optional[str] = None
    spatial_resolution: Optional[str] = None
    temporal_resolution: Optional[str] = None
    coverage_area: Optional[str] = None


class DataSourceResponse(DataSourceBase):
    id: UUID
    is_active: bool
    last_fetched: Optional[datetime] = None
    last_successful_fetch: Optional[datetime] = None
    fetch_error_count: int
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProcessingJobResponse(BaseModel):
    id: UUID
    job_type: str
    status: str
    data_source_id: Optional[UUID] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    records_processed: int
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Pagination
class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=500)


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(from_attributes=True)


# Health Check
class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    database: str
    redis: str
    services: Dict[str, str]