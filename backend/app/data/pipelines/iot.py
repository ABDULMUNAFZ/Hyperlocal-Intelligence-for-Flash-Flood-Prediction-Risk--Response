# FloodGuard IoT Sensor Ingestion Interface
"""IoT sensor data ingestion interface for real-time monitoring."""

import asyncio
import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel, Field, validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.iot_sensor import IoTSensor, IoTSensorReading
from app.models.core import DataSource, ProcessingJob, User
from app.services.data_sources import DATA_SOURCES, DataSourceType
from app.api.v1.endpoints.auth import get_current_active_user

logger = logging.getLogger(__name__)

# API Router for IoT ingestion
iot_router = APIRouter(prefix="/iot", tags=["IoT Ingestion"])


class SensorType(str, Enum):
    RAINFALL = "rainfall"
    WATER_LEVEL = "water_level"
    SOIL_MOISTURE = "soil_moisture"
    WEATHER_STATION = "weather_station"
    GROUNDWATER = "groundwater"


class SensorReadingBase(BaseModel):
    """Base sensor reading model."""
    sensor_id: str
    timestamp: datetime
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    # Rainfall sensor
    rainfall_mm: Optional[float] = Field(None, ge=0)
    rainfall_intensity_mmhr: Optional[float] = Field(None, ge=0)

    # Water level sensor
    water_level_m: Optional[float] = None
    discharge_cms: Optional[float] = Field(None, ge=0)

    # Soil moisture sensor
    soil_moisture_volumetric: Optional[float] = Field(None, ge=0, le=1)
    soil_temperature_c: Optional[float] = None
    soil_ec: Optional[float] = Field(None, ge=0)

    # Weather station
    temperature_c: Optional[float] = None
    humidity_percent: Optional[float] = Field(None, ge=0, le=100)
    pressure_hpa: Optional[float] = Field(None, ge=800, le=1100)
    wind_speed_ms: Optional[float] = Field(None, ge=0)
    wind_direction_deg: Optional[float] = Field(None, ge=0, le=360)
    solar_radiation_wm2: Optional[float] = Field(None, ge=0)

    # Quality
    quality_flag: str = "good"
    battery_voltage: Optional[float] = None
    signal_rssi: Optional[float] = None


class SensorReadingCreate(SensorReadingBase):
    """Create sensor reading (with API key auth)."""
    api_key: str


class SensorReadingResponse(BaseModel):
    """Response for sensor reading ingestion."""
    status: str
    reading_id: str
    message: str


class SensorRegistration(BaseModel):
    """Register a new IoT sensor."""
    sensor_id: str = Field(..., min_length=3, max_length=100)
    name: Optional[str] = None
    sensor_type: SensorType
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation_m: Optional[float] = None
    owner: Optional[str] = None
    communication: Optional[str] = None  # lora, gsm, wifi, satellite
    transmission_interval_minutes: Optional[int] = Field(None, ge=1)
    calibration_params: Dict[str, Any] = {}


class SensorRegistrationResponse(BaseModel):
    """Response for sensor registration."""
    sensor_id: str
    api_key: str
    message: str


class SensorStatus(BaseModel):
    """Sensor status response."""
    sensor_id: str
    name: Optional[str]
    sensor_type: str
    is_active: bool
    last_seen: Optional[datetime]
    battery_level: Optional[float]
    signal_strength: Optional[float]
    total_readings: int


# In-memory API key store (in production, use database)
_sensor_api_keys: Dict[str, str] = {}  # sensor_id -> api_key_hash


def hash_api_key(api_key: str) -> str:
    """Hash API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(sensor_id: str, api_key: str) -> bool:
    """Verify API key for sensor."""
    stored_hash = _sensor_api_keys.get(sensor_id)
    if not stored_hash:
        return False
    return stored_hash == hash_api_key(api_key)


@iot_router.post("/register", response_model=SensorRegistrationResponse)
async def register_sensor(
    registration: SensorRegistration,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Register a new IoT sensor (requires authentication)."""
    # Check if sensor already exists
    existing = await db.execute(
        select(IoTSensor).where(IoTSensor.sensor_id == registration.sensor_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Sensor ID already registered")

    # Generate API key
    api_key = f"fg_iot_{secrets.token_urlsafe(32)}"
    api_key_hash = hash_api_key(api_key)
    _sensor_api_keys[registration.sensor_id] = api_key_hash

    # Create sensor record
    sensor = IoTSensor(
        sensor_id=registration.sensor_id,
        name=registration.name,
        sensor_type=registration.sensor_type.value,
        manufacturer=registration.manufacturer,
        model=registration.model,
        latitude=registration.latitude,
        longitude=registration.longitude,
        elevation_m=registration.elevation_m,
        owner=registration.owner or current_user.email,
        communication=registration.communication,
        transmission_interval_minutes=registration.transmission_interval_minutes,
        calibration_params=registration.calibration_params,
        is_active=True,
    )
    db.add(sensor)

    # Create data source record
    source = DataSource(
        name=f"IoT Sensor: {registration.sensor_id}",
        description=f"Registered by {current_user.email}",
        source_type=DataSourceType.IOT,
        provider="floodguard_iot",
        license="Internal",
        attribution=f"FloodGuard IoT Sensor {registration.sensor_id}",
        update_frequency="realtime",
        spatial_resolution="point",
        temporal_resolution=str(registration.transmission_interval_minutes or 15) + "min",
        coverage_area="local",
        is_active=True,
        metadata={
            "sensor_id": registration.sensor_id,
            "sensor_type": registration.sensor_type.value,
            "owner": current_user.email,
        },
    )
    db.add(source)

    await db.commit()

    logger.info(f"Registered IoT sensor {registration.sensor_id} for user {current_user.email}")

    return SensorRegistrationResponse(
        sensor_id=registration.sensor_id,
        api_key=api_key,
        message="Sensor registered successfully. Save the API key securely.",
    )


@iot_router.post("/observations", response_model=SensorReadingResponse)
async def ingest_sensor_reading(
    reading: SensorReadingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Ingest a sensor reading (uses API key authentication)."""
    # Verify API key
    if not verify_api_key(reading.sensor_id, reading.api_key):
        raise HTTPException(status_code=401, detail="Invalid API key for sensor")

    # Get sensor
    sensor_result = await db.execute(
        select(IoTSensor).where(IoTSensor.sensor_id == reading.sensor_id)
    )
    sensor = sensor_result.scalar_one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    if not sensor.is_active:
        raise HTTPException(status_code=400, detail="Sensor is inactive")

    # Validate location matches registered location (allow small drift)
    lat_diff = abs(reading.latitude - sensor.latitude)
    lon_diff = abs(reading.longitude - sensor.longitude)
    if lat_diff > 0.01 or lon_diff > 0.01:  # ~1km
        logger.warning(f"Sensor {reading.sensor_id} location drift detected")

    # Create reading
    sensor_reading = IoTSensorReading(
        sensor_id=sensor.id,
        timestamp=reading.timestamp,
        rainfall_mm=reading.rainfall_mm,
        rainfall_intensity_mmhr=reading.rainfall_intensity_mmhr,
        water_level_m=reading.water_level_m,
        discharge_cms=reading.discharge_cms,
        soil_moisture_volumetric=reading.soil_moisture_volumetric,
        soil_temperature_c=reading.soil_temperature_c,
        soil_ec=reading.soil_ec,
        temperature_c=reading.temperature_c,
        humidity_percent=reading.humidity_percent,
        pressure_hpa=reading.pressure_hpa,
        wind_speed_ms=reading.wind_speed_ms,
        wind_direction_deg=reading.wind_direction_deg,
        solar_radiation_wm2=reading.solar_radiation_wm2,
        quality_flag=reading.quality_flag,
        battery_voltage=reading.battery_voltage,
        signal_rssi=reading.signal_rssi,
    )
    db.add(sensor_reading)

    # Update sensor last_seen
    sensor.last_seen = datetime.utcnow()
    sensor.battery_level = reading.battery_voltage
    sensor.signal_strength = reading.signal_rssi

    await db.commit()
    await db.refresh(sensor_reading)

    logger.debug(f"Ingested reading from sensor {reading.sensor_id}")

    return SensorReadingResponse(
        status="ok",
        reading_id=str(sensor_reading.id),
        message="Reading ingested successfully",
    )


@iot_router.post("/observations/batch", response_model=SensorReadingResponse)
async def ingest_batch_readings(
    readings: List[SensorReadingCreate],
    db: AsyncSession = Depends(get_db),
):
    """Ingest multiple sensor readings in batch."""
    if len(readings) > 1000:
        raise HTTPException(status_code=400, detail="Batch size limited to 1000 readings")

    results = {"success": 0, "failed": 0, "errors": []}

    for reading in readings:
        try:
            if not verify_api_key(reading.sensor_id, reading.api_key):
                results["failed"] += 1
                results["errors"].append(f"{reading.sensor_id}: Invalid API key")
                continue

            sensor_result = await db.execute(
                select(IoTSensor).where(IoTSensor.sensor_id == reading.sensor_id)
            )
            sensor = sensor_result.scalar_one_or_none()
            if not sensor or not sensor.is_active:
                results["failed"] += 1
                results["errors"].append(f"{reading.sensor_id}: Sensor not found or inactive")
                continue

            sensor_reading = IoTSensorReading(
                sensor_id=sensor.id,
                timestamp=reading.timestamp,
                rainfall_mm=reading.rainfall_mm,
                rainfall_intensity_mmhr=reading.rainfall_intensity_mmhr,
                water_level_m=reading.water_level_m,
                discharge_cms=reading.discharge_cms,
                soil_moisture_volumetric=reading.soil_moisture_volumetric,
                soil_temperature_c=reading.soil_temperature_c,
                soil_ec=reading.soil_ec,
                temperature_c=reading.temperature_c,
                humidity_percent=reading.humidity_percent,
                pressure_hpa=reading.pressure_hpa,
                wind_speed_ms=reading.wind_speed_ms,
                wind_direction_deg=reading.wind_direction_deg,
                solar_radiation_wm2=reading.solar_radiation_wm2,
                quality_flag=reading.quality_flag,
                battery_voltage=reading.battery_voltage,
                signal_rssi=reading.signal_rssi,
            )
            db.add(sensor_reading)
            sensor.last_seen = datetime.utcnow()
            results["success"] += 1

        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{reading.sensor_id}: {str(e)}")

    await db.commit()

    return SensorReadingResponse(
        status="completed" if results["failed"] == 0 else "partial",
        reading_id=f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        message=f"Processed {results['success']} readings, {results['failed']} failed",
    )


@iot_router.get("/sensors", response_model=List[SensorStatus])
async def list_sensors(
    sensor_type: Optional[SensorType] = None,
    is_active: Optional[bool] = None,
    owner: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """List registered sensors (admin or owner)."""
    query = select(IoTSensor)

    if sensor_type:
        query = query.where(IoTSensor.sensor_type == sensor_type.value)
    if is_active is not None:
        query = query.where(IoTSensor.is_active == is_active)
    if owner:
        query = query.where(IoTSensor.owner == owner)
    elif current_user.role != "admin":
        query = query.where(IoTSensor.owner == current_user.email)

    # Get reading counts
    sensors = (await db.execute(query)).scalars().all()

    result = []
    for sensor in sensors:
        reading_count = await db.scalar(
            select(func.count(IoTSensorReading.id)).where(
                IoTSensorReading.sensor_id == sensor.id
            )
        )
        result.append(SensorStatus(
            sensor_id=sensor.sensor_id,
            name=sensor.name,
            sensor_type=sensor.sensor_type,
            is_active=sensor.is_active,
            last_seen=sensor.last_seen,
            battery_level=sensor.battery_level,
            signal_strength=sensor.signal_strength,
            total_readings=reading_count or 0,
        ))

    return result


@iot_router.get("/sensors/{sensor_id}", response_model=SensorStatus)
async def get_sensor(
    sensor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get sensor details."""
    sensor = await db.get(IoTSensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    if current_user.role != "admin" and sensor.owner != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized")

    reading_count = await db.scalar(
        select(func.count(IoTSensorReading.id)).where(
            IoTSensorReading.sensor_id == sensor.id
        )
    )

    return SensorStatus(
        sensor_id=sensor.sensor_id,
        name=sensor.name,
        sensor_type=sensor.sensor_type,
        is_active=sensor.is_active,
        last_seen=sensor.last_seen,
        battery_level=sensor.battery_level,
        signal_strength=sensor.signal_strength,
        total_readings=reading_count or 0,
    )


@iot_router.get("/sensors/{sensor_id}/readings")
async def get_sensor_readings(
    sensor_id: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    hours: int = 24,
    limit: int = 1000,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get readings for a sensor."""
    sensor = await db.get(IoTSensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    if current_user.role != "admin" and sensor.owner != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not start_time:
        start_time = datetime.utcnow() - timedelta(hours=hours)
    if not end_time:
        end_time = datetime.utcnow()

    query = select(IoTSensorReading).where(
        IoTSensorReading.sensor_id == sensor.id,
        IoTSensorReading.timestamp >= start_time,
        IoTSensorReading.timestamp <= end_time,
    ).order_by(IoTSensorReading.timestamp.desc()).limit(limit)

    result = await db.execute(query)
    readings = result.scalars().all()

    return {
        "sensor_id": sensor_id,
        "count": len(readings),
        "readings": [
            {
                "timestamp": r.timestamp,
                "rainfall_mm": r.rainfall_mm,
                "water_level_m": r.water_level_m,
                "soil_moisture": r.soil_moisture_volumetric,
                "temperature_c": r.temperature_c,
                "humidity_percent": r.humidity_percent,
                "quality_flag": r.quality_flag,
            }
            for r in readings
        ],
    }


# Simulated sensor data generator for testing
class SimulatedSensorGenerator:
    """Generate simulated sensor data for testing (CLEARLY MARKED AS SIMULATED)."""

    def __init__(self):
        self.sensors = {}

    def register_simulated_sensor(self, sensor_id: str, sensor_type: SensorType,
                                   lat: float, lon: float, base_values: Dict = None):
        """Register a simulated sensor."""
        self.sensors[sensor_id] = {
            "type": sensor_type,
            "lat": lat,
            "lon": lon,
            "base_values": base_values or {},
            "last_values": {},
        }

    async def generate_reading(self, sensor_id: str) -> Optional[Dict]:
        """Generate a simulated reading (MARKED AS SIMULATED)."""
        if sensor_id not in self.sensors:
            return None

        sensor = self.sensors[sensor_id]
        import random

        base = sensor["base_values"]
        last = sensor["last_values"]

        reading = {
            "sensor_id": sensor_id,
            "timestamp": datetime.utcnow(),
            "latitude": sensor["lat"] + random.uniform(-0.001, 0.001),
            "longitude": sensor["lon"] + random.uniform(-0.001, 0.001),
            "quality_flag": "simulated",
            "battery_voltage": round(3.7 + random.uniform(-0.2, 0.2), 2),
            "signal_rssi": round(-80 + random.uniform(-10, 10), 1),
        }

        sensor_type = sensor["type"]

        if sensor_type == SensorType.RAINFALL:
            # Simulate rainfall with occasional events
            if random.random() < 0.1:  # 10% chance of rain
                rain = random.uniform(0.5, 50)
            else:
                rain = 0
            reading["rainfall_mm"] = round(rain, 2)
            reading["rainfall_intensity_mmhr"] = round(rain, 2)
            reading["quality_flag"] = "simulated"

        elif sensor_type == SensorType.WATER_LEVEL:
            # Simulate water level with daily variation
            base_level = base.get("water_level_m", 2.0)
            variation = random.uniform(-0.5, 0.5)
            reading["water_level_m"] = round(base_level + variation, 2)
            reading["discharge_cms"] = round(max(0, base_level * 10 + random.uniform(-5, 5)), 2)

        elif sensor_type == SensorType.SOIL_MOISTURE:
            # Simulate soil moisture with slow variation
            base_moist = base.get("soil_moisture", 0.3)
            reading["soil_moisture_volumetric"] = round(
                min(1, max(0, base_moist + random.uniform(-0.05, 0.05))), 3
            )
            reading["soil_temperature_c"] = round(25 + random.uniform(-5, 5), 1)

        elif sensor_type == SensorType.WEATHER_STATION:
            reading["temperature_c"] = round(base.get("temp", 28) + random.uniform(-3, 3), 1)
            reading["humidity_percent"] = round(base.get("humidity", 70) + random.uniform(-10, 10), 1)
            reading["pressure_hpa"] = round(1013 + random.uniform(-10, 10), 1)
            reading["wind_speed_ms"] = round(random.uniform(0, 10), 1)
            reading["wind_direction_deg"] = round(random.uniform(0, 360), 1)

        sensor["last_values"] = reading
        return reading


# Demo simulated sensors for South India
SIMULATED_SENSORS = {
    "SIM_KA_BLR_001": {
        "sensor_id": "SIM_KA_BLR_001",
        "name": "Bangalore AWS (SIMULATED)",
        "sensor_type": SensorType.WEATHER_STATION,
        "latitude": 12.9716,
        "longitude": 77.5946,
        "base_values": {"temp": 26, "humidity": 70},
    },
    "SIM_KL_KOC_001": {
        "sensor_id": "SIM_KL_KOC_001",
        "name": "Kochi Rain Gauge (SIMULATED)",
        "sensor_type": SensorType.RAINFALL,
        "latitude": 9.9312,
        "longitude": 76.2673,
        "base_values": {},
    },
    "SIM_TN_CBE_001": {
        "sensor_id": "SIM_TN_CBE_001",
        "name": "Coimbatore Soil Sensor (SIMULATED)",
        "sensor_type": SensorType.SOIL_MOISTURE,
        "latitude": 11.0168,
        "longitude": 76.9558,
        "base_values": {"soil_moisture": 0.35},
    },
    "SIM_AP_VJA_001": {
        "sensor_id": "SIM_AP_VJA_001",
        "name": "Vijayawada Water Level (SIMULATED)",
        "sensor_type": SensorType.WATER_LEVEL,
        "latitude": 16.5062,
        "longitude": 80.6480,
        "base_values": {"water_level_m": 3.0},
    },
    "SIM_TG_HYD_001": {
        "sensor_id": "SIM_TG_HYD_001",
        "name": "Hyderabad Weather (SIMULATED)",
        "sensor_type": SensorType.WEATHER_STATION,
        "latitude": 17.3850,
        "longitude": 78.4867,
        "base_values": {"temp": 30, "humidity": 60},
    },
}


def create_demo_sensors(db: AsyncSession) -> List[IoTSensor]:
    """Create demo simulated sensors in database (clearly marked)."""
    sensors = []
    for sim_id, sim_data in SIMULATED_SENSORS.items():
        sensor = IoTSensor(
            sensor_id=sim_id,
            name=sim_data["name"],
            sensor_type=sim_data["sensor_type"].value,
            manufacturer="FloodGuard Demo",
            model="Simulated-v1",
            latitude=sim_data["latitude"],
            longitude=sim_data["longitude"],
            elevation_m=500,
            owner="demo@floodguard.in",
            communication="simulated",
            transmission_interval_minutes=15,
            is_active=True,
            metadata={"simulated": True, "base_values": sim_data.get("base_values", {})},
        )
        sensors.append(sensor)
        db.add(sensor)

    db.commit()
    return sensors