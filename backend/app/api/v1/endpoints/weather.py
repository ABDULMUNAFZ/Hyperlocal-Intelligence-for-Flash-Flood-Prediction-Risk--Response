# FloodGuard Weather & Rainfall Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from app.db.session import get_db
from app.models.rainfall import RainfallObservation, RainfallGrid, WeatherForecast, WeatherObservation
from app.schemas.weather import (
    RainfallObservationResponse,
    RainfallGridResponse,
    RainfallQueryParams,
    WeatherForecastResponse,
    WeatherForecastQueryParams,
    WeatherObservationResponse,
    CurrentWeatherResponse,
    ForecastSummaryResponse,
)

router = APIRouter(prefix="/rainfall", tags=["Rainfall"])


@router.get("/observations", response_model=List[RainfallObservationResponse])
async def get_rainfall_observations(
    params: RainfallQueryParams = Depends(),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
):
    """Get point rainfall observations."""
    query = select(RainfallObservation).where(
        and_(
            RainfallObservation.timestamp >= params.start_time,
            RainfallObservation.timestamp <= params.end_time,
        )
    )

    if params.source:
        query = query.where(RainfallObservation.source == params.source)

    if params.latitude and params.longitude and params.radius_km:
        point = ST_SetSRID(ST_MakePoint(params.longitude, params.latitude), 4326)
        query = query.where(ST_DWithin(RainfallObservation.location, point, params.radius_km * 1000))

    if params.region_id:
        # Join with regions to filter by region geometry
        from app.models.core import Region
        query = query.join(Region, ST_DWithin(RainfallObservation.location, Region.centroid, 0))

    query = query.order_by(RainfallObservation.timestamp.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/grids", response_model=List[RainfallGridResponse])
async def get_rainfall_grids(
    params: RainfallQueryParams = Depends(),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get gridded rainfall products."""
    query = select(RainfallGrid).where(
        and_(
            RainfallGrid.timestamp >= params.start_time,
            RainfallGrid.timestamp <= params.end_time,
        )
    )

    if params.source:
        query = query.where(RainfallGrid.source == params.source)

    query = query.order_by(RainfallGrid.timestamp.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/latest")
async def get_latest_rainfall(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50, gt=0, le=200),
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """Get latest rainfall observations near a point."""
    since = datetime.utcnow() - timedelta(hours=hours)
    point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

    query = select(RainfallObservation).where(
        and_(
            RainfallObservation.timestamp >= since,
            ST_DWithin(RainfallObservation.location, point, radius_km * 1000),
        )
    ).order_by(RainfallObservation.timestamp.desc())

    result = await db.execute(query)
    observations = result.scalars().all()

    # Group by station and get latest
    latest_by_station = {}
    for obs in observations:
        if obs.station_id not in latest_by_station:
            latest_by_station[obs.station_id] = obs

    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km,
        "since": since,
        "stations": list(latest_by_station.values()),
        "count": len(latest_by_station),
    }


# Weather Forecast Router
weather_router = APIRouter(prefix="/weather", tags=["Weather Forecast"])


@weather_router.get("/forecast", response_model=List[WeatherForecastResponse])
async def get_weather_forecast(
    params: WeatherForecastQueryParams = Depends(),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
):
    """Get weather forecasts."""
    query = select(WeatherForecast).where(
        and_(
            WeatherForecast.latitude == params.latitude,
            WeatherForecast.longitude == params.longitude,
        )
    )

    if params.source:
        query = query.where(WeatherForecast.source == params.source)
    if params.model:
        query = query.where(WeatherForecast.model == params.model)
    if params.init_time_after:
        query = query.where(WeatherForecast.init_time >= params.init_time_after)
    if params.valid_time_after:
        query = query.where(WeatherForecast.valid_time >= params.valid_time_after)
    if params.max_lead_time_hours:
        query = query.where(WeatherForecast.lead_time_hours <= params.max_lead_time_hours)

    query = query.order_by(WeatherForecast.init_time.desc(), WeatherForecast.valid_time).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@weather_router.get("/forecast/summary", response_model=ForecastSummaryResponse)
async def get_forecast_summary(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    source: str = Query("open_meteo"),
    model: Optional[str] = None,
    hours: int = Query(168, ge=1, le=336),
    db: AsyncSession = Depends(get_db),
):
    """Get summarized forecast for a location."""
    since = datetime.utcnow()
    until = since + timedelta(hours=hours)

    query = select(WeatherForecast).where(
        and_(
            WeatherForecast.latitude == latitude,
            WeatherForecast.longitude == longitude,
            WeatherForecast.source == source,
            WeatherForecast.valid_time >= since,
            WeatherForecast.valid_time <= until,
        )
    )

    if model:
        query = query.where(WeatherForecast.model == model)

    query = query.order_by(WeatherForecast.init_time.desc(), WeatherForecast.valid_time)
    result = await db.execute(query)
    forecasts = result.scalars().all()

    # Group by valid_time and take latest init_time
    by_valid_time = {}
    for fc in forecasts:
        key = fc.valid_time
        if key not in by_valid_time or fc.init_time > by_valid_time[key].init_time:
            by_valid_time[key] = fc

    hourly = []
    for valid_time in sorted(by_valid_time.keys()):
        fc = by_valid_time[valid_time]
        hourly.append({
            "time": valid_time.isoformat(),
            "temperature": fc.temperature_2m,
            "humidity": fc.relative_humidity_2m,
            "wind_speed": fc.wind_speed_10m,
            "wind_direction": fc.wind_direction_10m,
            "precipitation": fc.precipitation,
            "precipitation_probability": fc.precipitation_probability,
            "cloudcover": fc.cloudcover,
            "cape": fc.cape,
            "soil_moisture_0_7cm": fc.soil_moisture_0_7cm,
        })

    return ForecastSummaryResponse(
        location={"latitude": latitude, "longitude": longitude},
        generated_at=datetime.utcnow(),
        source=source,
        model=model or "best_available",
        hourly=hourly,
        daily=[],  # Aggregate hourly to daily
        alerts=[],
    )


@weather_router.get("/current", response_model=CurrentWeatherResponse)
async def get_current_weather(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    source: str = Query("open_meteo"),
    db: AsyncSession = Depends(get_db),
):
    """Get current weather observations."""
    point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

    # Get latest observation within 50km
    query = select(WeatherObservation).where(
        ST_DWithin(WeatherObservation.location, point, 50000)
    ).order_by(WeatherObservation.timestamp.desc()).limit(1)

    result = await db.execute(query)
    obs = result.scalar_one_or_none()

    if not obs:
        # Try forecast with lead_time = 0 or 1
        fc_query = select(WeatherForecast).where(
            and_(
                WeatherForecast.latitude == latitude,
                WeatherForecast.longitude == longitude,
                WeatherForecast.source == source,
                WeatherForecast.lead_time_hours <= 1,
            )
        ).order_by(WeatherForecast.init_time.desc()).limit(1)

        fc_result = await db.execute(fc_query)
        fc = fc_result.scalar_one_or_none()

        if fc:
            return CurrentWeatherResponse(
                location={"latitude": latitude, "longitude": longitude},
                timestamp=fc.valid_time,
                source=source,
                temperature=fc.temperature_2m,
                humidity=fc.relative_humidity_2m,
                pressure=fc.pressure_msl,
                wind_speed=fc.wind_speed_10m,
                wind_direction=fc.wind_direction_10m,
                precipitation=fc.precipitation,
                condition="forecast",
            )

        raise HTTPException(status_code=404, detail="No current weather data available")

    return CurrentWeatherResponse(
        location={"latitude": obs.latitude, "longitude": obs.longitude},
        timestamp=obs.timestamp,
        source=obs.source,
        temperature=obs.temperature_2m,
        humidity=obs.relative_humidity,
        pressure=obs.pressure,
        wind_speed=obs.wind_speed,
        wind_direction=obs.wind_direction,
        precipitation=obs.precipitation,
        condition="observed",
    )


@weather_router.get("/observations", response_model=List[WeatherObservationResponse])
async def get_weather_observations(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50, gt=0, le=200),
    hours: int = Query(24, ge=1, le=168),
    source: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Get recent weather observations near a point."""
    since = datetime.utcnow() - timedelta(hours=hours)
    point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

    query = select(WeatherObservation).where(
        and_(
            WeatherObservation.timestamp >= since,
            ST_DWithin(WeatherObservation.location, point, radius_km * 1000),
        )
    )

    if source:
        query = query.where(WeatherObservation.source == source)

    query = query.order_by(WeatherObservation.timestamp.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()