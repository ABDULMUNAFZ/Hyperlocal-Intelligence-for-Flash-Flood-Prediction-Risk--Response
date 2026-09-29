# FloodGuard API Schemas - Weather & Rainfall
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from uuid import UUID


# Rainfall
class RainfallObservationBase(BaseModel):
    station_id: str
    station_name: Optional[str] = None
    source: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation_m: Optional[float] = None
    timestamp: datetime
    rainfall_mm: float = Field(..., ge=0)
    intensity_mmhr: Optional[float] = Field(None, ge=0)
    duration_minutes: Optional[int] = Field(None, ge=0)
    quality_flag: Optional[str] = None


class RainfallObservationResponse(RainfallObservationBase):
    id: UUID
    metadata: Dict[str, Any] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RainfallGridResponse(BaseModel):
    id: UUID
    source: str
    product: str
    timestamp: datetime
    resolution_deg: float
    min_mm: Optional[float] = None
    max_mm: Optional[float] = None
    mean_mm: Optional[float] = None
    coverage_bbox: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RainfallQueryParams(BaseModel):
    source: Optional[str] = None
    start_time: datetime
    end_time: datetime
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: Optional[float] = Field(None, gt=0)
    region_id: Optional[UUID] = None
    aggregate: Optional[Literal["hourly", "daily", "monthly"]] = None


# Weather Forecast
class WeatherForecastBase(BaseModel):
    source: str
    model: str
    init_time: datetime
    valid_time: datetime
    lead_time_hours: int
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    temperature_2m: Optional[float] = None
    dewpoint_2m: Optional[float] = None
    relative_humidity_2m: Optional[float] = Field(None, ge=0, le=100)
    pressure_msl: Optional[float] = None
    wind_speed_10m: Optional[float] = Field(None, ge=0)
    wind_direction_10m: Optional[float] = Field(None, ge=0, le=360)
    wind_gust_10m: Optional[float] = Field(None, ge=0)
    precipitation: Optional[float] = Field(None, ge=0)
    precipitation_probability: Optional[float] = Field(None, ge=0, le=100)
    cloudcover: Optional[float] = Field(None, ge=0, le=100)
    cloudcover_low: Optional[float] = Field(None, ge=0, le=100)
    cloudcover_mid: Optional[float] = Field(None, ge=0, le=100)
    cloudcover_high: Optional[float] = Field(None, ge=0, le=100)
    cape: Optional[float] = None
    lifted_index: Optional[float] = None
    soil_moisture_0_7cm: Optional[float] = Field(None, ge=0, le=1)
    soil_moisture_7_28cm: Optional[float] = Field(None, ge=0, le=1)
    soil_moisture_28_100cm: Optional[float] = Field(None, ge=0, le=1)
    soil_moisture_100_255cm: Optional[float] = Field(None, ge=0, le=1)


class WeatherForecastResponse(WeatherForecastBase):
    id: UUID
    metadata: Dict[str, Any] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WeatherForecastQueryParams(BaseModel):
    source: Optional[str] = None
    model: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    init_time_after: Optional[datetime] = None
    valid_time_after: Optional[datetime] = None
    max_lead_time_hours: Optional[int] = Field(None, ge=0)
    variables: Optional[List[str]] = None


class WeatherObservationBase(BaseModel):
    station_id: str
    station_name: Optional[str] = None
    source: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation_m: Optional[float] = None
    timestamp: datetime
    temperature_2m: Optional[float] = None
    dewpoint_2m: Optional[float] = None
    relative_humidity: Optional[float] = Field(None, ge=0, le=100)
    pressure: Optional[float] = None
    wind_speed: Optional[float] = Field(None, ge=0)
    wind_direction: Optional[float] = Field(None, ge=0, le=360)
    wind_gust: Optional[float] = Field(None, ge=0)
    precipitation: Optional[float] = Field(None, ge=0)
    solar_radiation: Optional[float] = None
    soil_temperature: Optional[float] = None
    soil_moisture: Optional[float] = Field(None, ge=0, le=1)


class WeatherObservationResponse(WeatherObservationBase):
    id: UUID
    metadata: Dict[str, Any] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Current weather summary
class CurrentWeatherResponse(BaseModel):
    location: Dict[str, float]  # lat, lon
    timestamp: datetime
    source: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    pressure: Optional[float] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[float] = None
    precipitation: Optional[float] = None
    condition: Optional[str] = None
    metadata: Dict[str, Any] = {}


class ForecastSummaryResponse(BaseModel):
    location: Dict[str, float]
    generated_at: datetime
    source: str
    model: str
    hourly: List[Dict[str, Any]]
    daily: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]] = []