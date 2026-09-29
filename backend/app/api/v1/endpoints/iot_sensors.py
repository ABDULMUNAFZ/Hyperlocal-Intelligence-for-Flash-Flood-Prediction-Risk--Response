# FloodGuard IoT Sensors Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID
from app.db.session import get_db
from app.models.iot_sensor import IoTSensor, IoTSensorReading

router = APIRouter(prefix="/iot", tags=["IoT Sensors"])


@router.get("/sensors", response_model=List[dict])
async def list_sensors(
    sensor_type: Optional[str] = None,
    is_active: bool = True,
    owner: Optional[str] = None,
    bounds: Optional[str] = Query(None, description="minx,miny,maxx,maxy"),
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    """List IoT sensors."""
    query = select(IoTSensor).where(IoTSensor.is_active == is_active)

    if sensor_type:
        query = query.where(IoTSensor.sensor_type == sensor_type)
    if owner:
        query = query.where(IoTSensor.owner == owner)
    if bounds:
        try:
            minx, miny, maxx, maxy = map(float, bounds.split(","))
            from geoalchemy2.functions import ST_MakeEnvelope
            bbox = ST_MakeEnvelope(minx, miny, maxx, maxy, 4326)
            query = query.where(IoTSensor.location.ST_Within(bbox))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bounds format")

    query = query.limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "sensor_id": r.sensor_id,
            "name": r.name,
            "sensor_type": r.sensor_type,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "elevation_m": r.elevation_m,
            "owner": r.owner,
            "communication": r.communication,
            "last_seen": r.last_seen,
            "battery_level": r.battery_level,
        }
        for r in result.scalars().all()
    ]


@router.get("/sensors/{sensor_id}", response_model=dict)
async def get_sensor(
    sensor_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get sensor by ID."""
    sensor = await db.get(IoTSensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {
        "id": str(sensor.id),
        "sensor_id": sensor.sensor_id,
        "name": sensor.name,
        "sensor_type": sensor.sensor_type,
        "manufacturer": sensor.manufacturer,
        "model": sensor.model,
        "latitude": sensor.latitude,
        "longitude": sensor.longitude,
        "elevation_m": sensor.elevation_m,
        "owner": sensor.owner,
        "communication": sensor.communication,
        "transmission_interval_minutes": sensor.transmission_interval_minutes,
        "is_active": sensor.is_active,
        "last_seen": sensor.last_seen,
        "battery_level": sensor.battery_level,
        "calibration_params": sensor.calibration_params,
    }


@router.get("/sensors/{sensor_id}/readings", response_model=List[dict])
async def get_sensor_readings(
    sensor_id: UUID,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
):
    """Get readings from a sensor."""
    if not start_time:
        start_time = datetime.utcnow() - timedelta(hours=hours)
    if not end_time:
        end_time = datetime.utcnow()

    query = select(IoTSensorReading).where(
        and_(
            IoTSensorReading.sensor_id == sensor_id,
            IoTSensorReading.timestamp >= start_time,
            IoTSensorReading.timestamp <= end_time,
        )
    ).order_by(IoTSensorReading.timestamp.desc()).limit(limit)

    result = await db.execute(query)
    readings = result.scalars().all()

    return [
        {
            "timestamp": r.timestamp,
            "received_at": r.received_at,
            "rainfall_mm": r.rainfall_mm,
            "rainfall_intensity_mmhr": r.rainfall_intensity_mmhr,
            "water_level_m": r.water_level_m,
            "discharge_cms": r.discharge_cms,
            "soil_moisture_volumetric": r.soil_moisture_volumetric,
            "soil_temperature_c": r.soil_temperature_c,
            "temperature_c": r.temperature_c,
            "humidity_percent": r.humidity_percent,
            "pressure_hpa": r.pressure_hpa,
            "wind_speed_ms": r.wind_speed_ms,
            "quality_flag": r.quality_flag,
            "battery_voltage": r.battery_voltage,
        }
        for r in readings
    ]


@router.get("/readings/latest")
async def get_latest_readings(
    sensor_type: Optional[str] = None,
    bounds: Optional[str] = Query(None, description="minx,miny,maxx,maxy"),
    hours: int = Query(1, ge=1, le=24),
    limit: int = Query(1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    """Get latest readings from all sensors."""
    since = datetime.utcnow() - timedelta(hours=hours)

    # Subquery to get latest reading per sensor
    subq = select(
        IoTSensorReading.sensor_id,
        func.max(IoTSensorReading.timestamp).label("max_time")
    ).where(
        IoTSensorReading.timestamp >= since
    ).group_by(IoTSensorReading.sensor_id).subquery()

    query = select(IoTSensorReading).join(
        subq,
        and_(
            IoTSensorReading.sensor_id == subq.c.sensor_id,
            IoTSensorReading.timestamp == subq.c.max_time,
        )
    ).join(IoTSensor, IoTSensorReading.sensor_id == IoTSensor.id)

    if sensor_type:
        query = query.where(IoTSensor.sensor_type == sensor_type)
    if bounds:
        try:
            minx, miny, maxx, maxy = map(float, bounds.split(","))
            from geoalchemy2.functions import ST_MakeEnvelope
            bbox = ST_MakeEnvelope(minx, miny, maxx, maxy, 4326)
            query = query.where(IoTSensor.location.ST_Within(bbox))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bounds format")

    query = query.limit(limit)
    result = await db.execute(query)
    readings = result.scalars().all()

    return [
        {
            "sensor_id": str(r.sensor_id),
            "timestamp": r.timestamp,
            "rainfall_mm": r.rainfall_mm,
            "water_level_m": r.water_level_m,
            "soil_moisture": r.soil_moisture_volumetric,
            "temperature_c": r.temperature_c,
            "quality_flag": r.quality_flag,
        }
        for r in readings
    ]


@router.post("/sensors/{sensor_id}/ingest")
async def ingest_sensor_reading(
    sensor_id: UUID,
    reading: dict,
    db: AsyncSession = Depends(get_db),
):
    """Ingest a new sensor reading (for IoT devices)."""
    sensor = await db.get(IoTSensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    new_reading = IoTSensorReading(
        sensor_id=sensor_id,
        timestamp=reading.get("timestamp", datetime.utcnow()),
        rainfall_mm=reading.get("rainfall_mm"),
        rainfall_intensity_mmhr=reading.get("rainfall_intensity_mmhr"),
        water_level_m=reading.get("water_level_m"),
        discharge_cms=reading.get("discharge_cms"),
        soil_moisture_volumetric=reading.get("soil_moisture_volumetric"),
        soil_temperature_c=reading.get("soil_temperature_c"),
        soil_ec=reading.get("soil_ec"),
        temperature_c=reading.get("temperature_c"),
        humidity_percent=reading.get("humidity_percent"),
        pressure_hpa=reading.get("pressure_hpa"),
        wind_speed_ms=reading.get("wind_speed_ms"),
        wind_direction_deg=reading.get("wind_direction_deg"),
        solar_radiation_wm2=reading.get("solar_radiation_wm2"),
        quality_flag=reading.get("quality_flag", "good"),
        battery_voltage=reading.get("battery_voltage"),
        signal_rssi=reading.get("signal_rssi"),
    )
    db.add(new_reading)

    # Update sensor last_seen
    sensor.last_seen = datetime.utcnow()
    sensor.battery_level = reading.get("battery_voltage")
    sensor.signal_strength = reading.get("signal_rssi")

    await db.commit()

    return {"status": "ok", "reading_id": str(new_reading.id)}