"""
Weather, rainfall and climate from Open-Meteo.

  • /v1/forecast  — current conditions, hourly past (model analysis) and forecast.
                    Open-Meteo "best match" blends national/global NWP models. These are
                    MODEL values on a ~1–11 km grid, not rain-gauge observations.
  • /v1/archive   — ERA5 reanalysis, used for 1991–2020 climate normals.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from app.services.geo.common import TTLCache, freshness, get_client, provenance, utcnow_iso

logger = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_SOURCE = "Open-Meteo Forecast API (best-match NWP blend)"
ERA5_SOURCE = "ERA5 reanalysis (Copernicus Climate Change Service) via Open-Meteo Archive API"

_weather_cache = TTLCache("weather", ttl_seconds=10 * 60)
_grid_cache = TTLCache("rain_grid_v2", ttl_seconds=30 * 60, persist=True)
_climate_cache = TTLCache("climate", ttl_seconds=180 * 24 * 3600, persist=True)

WMO_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Dense freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
}

# IMD rainfall intensity categories for 24 h accumulations (mm)
IMD_24H = [
    (0.1, "No rain"), (2.5, "Very light rain"), (15.6, "Light rain"), (64.5, "Moderate rain"),
    (115.6, "Heavy rain"), (204.5, "Very heavy rain"), (float("inf"), "Extremely heavy rain"),
]


def imd_category(mm_24h: Optional[float]) -> Optional[str]:
    if mm_24h is None:
        return None
    for limit, label in IMD_24H:
        if mm_24h < limit:
            return label
    return IMD_24H[-1][1]


def _sum_window(times: List[str], values: List[Optional[float]], end_idx: int, hours: int) -> Optional[float]:
    start = max(0, end_idx - hours + 1)
    window = [v for v in values[start : end_idx + 1] if v is not None]
    if not window:
        return None
    return round(float(sum(window)), 1)


async def point_weather(lat: float, lon: float) -> Dict[str, Any]:
    key = TTLCache.key(round(lat, 3), round(lon, 3))

    async def fetch() -> Dict[str, Any]:
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": ",".join([
                "temperature_2m", "relative_humidity_2m", "apparent_temperature", "precipitation",
                "rain", "weather_code", "cloud_cover", "surface_pressure", "pressure_msl",
                "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
            ]),
            "hourly": "precipitation,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl",
            "past_days": 3,
            "forecast_days": 3,
            "timezone": "Asia/Kolkata",
        }
        r = await get_client().get(FORECAST_URL, params=params)
        r.raise_for_status()
        return r.json()

    try:
        data = await _weather_cache.get_or_create(key, fetch)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Open-Meteo point weather failed: %s", exc)
        return {"available": False, "provenance": provenance(OPEN_METEO_SOURCE, kind="MODEL_ANALYSIS", status="UNAVAILABLE", notes=str(exc))}

    cur = data.get("current", {})
    hourly = data.get("hourly", {})
    times: List[str] = hourly.get("time", [])
    precip: List[Optional[float]] = hourly.get("precipitation", [])
    # index of the current hour in the hourly series
    cur_time = cur.get("time", "")
    now_idx = 0
    for i, t in enumerate(times):
        if t <= cur_time:
            now_idx = i
    past = {
        "rain_1h_mm": _sum_window(times, precip, now_idx, 1),
        "rain_3h_mm": _sum_window(times, precip, now_idx, 3),
        "rain_6h_mm": _sum_window(times, precip, now_idx, 6),
        "rain_24h_mm": _sum_window(times, precip, now_idx, 24),
        "rain_72h_mm": _sum_window(times, precip, now_idx, 72),
    }
    future_slice = slice(now_idx + 1, now_idx + 1 + 24)
    fut_vals = [v for v in precip[future_slice] if v is not None]
    prob = [v for v in hourly.get("precipitation_probability", [])[future_slice] if v is not None]
    forecast_series = [
        {
            "time": times[i],
            "precipitation_mm": precip[i] if i < len(precip) else None,
            "precipitation_probability": (hourly.get("precipitation_probability") or [None] * len(times))[i],
            "temperature_c": (hourly.get("temperature_2m") or [None] * len(times))[i],
        }
        for i in range(now_idx + 1, min(len(times), now_idx + 1 + 48))
    ]
    past_series = [
        {"time": times[i], "precipitation_mm": precip[i]}
        for i in range(max(0, now_idx - 71), now_idx + 1)
    ]
    # Open-Meteo "current" is local time (Asia/Kolkata); convert to UTC ISO for freshness
    observed_utc = None
    if cur_time:
        try:
            local = datetime.fromisoformat(cur_time).replace(tzinfo=timezone.utc)
            offset = data.get("utc_offset_seconds", 0)
            observed_utc = datetime.fromtimestamp(local.timestamp() - offset, tz=timezone.utc).isoformat()
        except ValueError:
            pass

    return {
        "available": True,
        "location": {"latitude": data.get("latitude"), "longitude": data.get("longitude"), "grid_elevation_m": data.get("elevation")},
        "current": {
            "time_local": cur_time,
            "temperature_c": cur.get("temperature_2m"),
            "apparent_temperature_c": cur.get("apparent_temperature"),
            "relative_humidity_pct": cur.get("relative_humidity_2m"),
            "precipitation_mm": cur.get("precipitation"),
            "weather_code": cur.get("weather_code"),
            "condition": WMO_CODES.get(cur.get("weather_code")),
            "cloud_cover_pct": cur.get("cloud_cover"),
            "pressure_msl_hpa": cur.get("pressure_msl"),
            "surface_pressure_hpa": cur.get("surface_pressure"),
            "wind_speed_kmh": cur.get("wind_speed_10m"),
            "wind_direction_deg": cur.get("wind_direction_10m"),
            "wind_gusts_kmh": cur.get("wind_gusts_10m"),
        },
        "rainfall_recent": {**past, "imd_category_24h": imd_category(past["rain_24h_mm"])},
        "rainfall_forecast": {
            "next_24h_mm": round(float(sum(fut_vals)), 1) if fut_vals else None,
            "max_hourly_mm": round(float(max(fut_vals)), 1) if fut_vals else None,
            "max_probability_pct": max(prob) if prob else None,
            "imd_category_24h": imd_category(round(float(sum(fut_vals)), 1) if fut_vals else None),
        },
        "series": {"past_72h": past_series, "next_48h": forecast_series},
        "provenance": provenance(
            OPEN_METEO_SOURCE,
            kind="MODEL_ANALYSIS",
            status=freshness(observed_utc),
            reference=f"Model time {cur_time} IST",
            url="https://open-meteo.com/",
            notes="Recent rainfall = NWP model analysis on the Open-Meteo grid, not a rain-gauge observation. Forecast values are FORECAST.",
        ),
    }


def district_grid_points(bounds: tuple, step: float) -> List[tuple]:
    min_lon, min_lat, max_lon, max_lat = bounds
    lons = np.arange(min_lon + step / 2, max_lon, step)
    lats = np.arange(min_lat + step / 2, max_lat, step)
    return [(round(float(la), 4), round(float(lo), 4)) for la in lats for lo in lons]


async def rainfall_grid(bounds: tuple, step: float = 0.07) -> Dict[str, Any]:
    """Recent (past 24 h) and forecast (next 24 h) rainfall on a regular grid."""
    pts = district_grid_points(bounds, step)
    key = TTLCache.key("grid", bounds, step)

    async def fetch() -> Dict[str, Any]:
        results: List[Dict[str, Any]] = []
        for i in range(0, len(pts), 100):
            chunk = pts[i : i + 100]
            params = {
                "latitude": ",".join(str(p[0]) for p in chunk),
                "longitude": ",".join(str(p[1]) for p in chunk),
                "hourly": "precipitation",
                "current": "precipitation,temperature_2m,relative_humidity_2m",
                "past_days": 1,
                "forecast_days": 2,
                "timezone": "Asia/Kolkata",
            }
            r = await get_client().get(FORECAST_URL, params=params)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict):
                data = [data]
            for (lat, lon), d in zip(chunk, data):
                times = d["hourly"]["time"]
                pr = d["hourly"]["precipitation"]
                cur_time = d.get("current", {}).get("time", "")
                idx = max((j for j, t in enumerate(times) if t <= cur_time), default=0)
                past = [v for v in pr[max(0, idx - 23) : idx + 1] if v is not None]
                fut = [v for v in pr[idx + 1 : idx + 25] if v is not None]
                results.append({
                    "lat": lat, "lon": lon,
                    "current_mm_h": d.get("current", {}).get("precipitation"),
                    "temperature_c": d.get("current", {}).get("temperature_2m"),
                    "humidity_pct": d.get("current", {}).get("relative_humidity_2m"),
                    "past_24h_mm": round(sum(past), 1) if past else None,
                    "next_24h_mm": round(sum(fut), 1) if fut else None,
                    "time_local": cur_time,
                })
        return {"retrieved_at": utcnow_iso(), "points": results}

    try:
        data = await _grid_cache.get_or_create(key, fetch)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Open-Meteo rainfall grid failed: %s", exc)
        return {"available": False, "provenance": provenance(OPEN_METEO_SOURCE, kind="MODEL_ANALYSIS", status="UNAVAILABLE", notes=str(exc))}

    half = step / 2
    features = []
    for p in data["points"]:
        features.append({
            "type": "Feature",
            "properties": {k: v for k, v in p.items() if k not in ("lat", "lon")},
            "geometry": {"type": "Polygon", "coordinates": [[
                [p["lon"] - half, p["lat"] - half], [p["lon"] + half, p["lat"] - half],
                [p["lon"] + half, p["lat"] + half], [p["lon"] - half, p["lat"] + half],
                [p["lon"] - half, p["lat"] - half],
            ]]},
        })
    return {
        "available": True,
        "grid_step_deg": step,
        "geojson": {"type": "FeatureCollection", "features": features},
        "provenance": provenance(
            OPEN_METEO_SOURCE, kind="MODEL_ANALYSIS", status=freshness(data["retrieved_at"], live_minutes=45),
            retrieved_at=data["retrieved_at"], url="https://open-meteo.com/",
            notes=f"Sampled at grid-cell centres every {step}°. past_24h = model analysis; next_24h = FORECAST.",
        ),
    }


async def climate_normals(lat: float, lon: float) -> Dict[str, Any]:
    """Monthly 1991–2020 normals from ERA5 (rounded to 0.1° to share cache)."""
    rlat, rlon = round(lat, 1), round(lon, 1)
    key = TTLCache.key("normals", rlat, rlon)

    async def fetch() -> Dict[str, Any]:
        params = {
            "latitude": rlat, "longitude": rlon,
            "start_date": "1991-01-01", "end_date": "2020-12-31",
            "daily": "precipitation_sum,temperature_2m_mean,temperature_2m_max,temperature_2m_min",
            "timezone": "Asia/Kolkata",
        }
        r = await get_client().get(ARCHIVE_URL, params=params, timeout=120)
        r.raise_for_status()
        return r.json()

    try:
        data = await _climate_cache.get_or_create(key, fetch)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ERA5 climate normals failed: %s", exc)
        return {"available": False, "provenance": provenance(ERA5_SOURCE, kind="HISTORICAL", status="UNAVAILABLE", notes=str(exc))}

    d = data["daily"]
    months = np.array([int(t[5:7]) for t in d["time"]])
    years = np.array([int(t[:4]) for t in d["time"]])
    pr = np.array([v if v is not None else np.nan for v in d["precipitation_sum"]], dtype=float)
    tm = np.array([v if v is not None else np.nan for v in d["temperature_2m_mean"]], dtype=float)
    tx = np.array([v if v is not None else np.nan for v in d["temperature_2m_max"]], dtype=float)
    tn = np.array([v if v is not None else np.nan for v in d["temperature_2m_min"]], dtype=float)
    n_years = len(set(years.tolist()))
    monthly = []
    names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for m in range(1, 13):
        sel = months == m
        monthly.append({
            "month": names[m - 1],
            "precipitation_mm": round(float(np.nansum(pr[sel])) / n_years, 1),
            "temperature_mean_c": round(float(np.nanmean(tm[sel])), 1),
            "temperature_max_c": round(float(np.nanmean(tx[sel])), 1),
            "temperature_min_c": round(float(np.nanmean(tn[sel])), 1),
        })
    annual = round(sum(m["precipitation_mm"] for m in monthly), 0)
    sw = sum(m["precipitation_mm"] for m in monthly[5:9])  # Jun–Sep
    ne = sum(m["precipitation_mm"] for m in monthly[9:12])  # Oct–Dec
    wettest = max(monthly, key=lambda m: m["precipitation_mm"])
    yearly = [float(np.nansum(pr[years == y])) for y in sorted(set(years.tolist()))]
    daily_max_idx = int(np.nanargmax(pr))
    return {
        "available": True,
        "period": "1991–2020",
        "grid_point": {"latitude": data.get("latitude"), "longitude": data.get("longitude"), "elevation_m": data.get("elevation")},
        "monthly": monthly,
        "summary": {
            "annual_precipitation_mm": annual,
            "southwest_monsoon_share_pct": round(100 * sw / annual, 1) if annual else None,
            "northeast_monsoon_share_pct": round(100 * ne / annual, 1) if annual else None,
            "wettest_month": wettest["month"],
            "mean_temperature_c": round(float(np.nanmean(tm)), 1),
            "annual_precipitation_min_mm": round(min(yearly), 0),
            "annual_precipitation_max_mm": round(max(yearly), 0),
            "max_daily_precipitation_mm": round(float(pr[daily_max_idx]), 1),
            "max_daily_precipitation_date": d["time"][daily_max_idx],
        },
        "provenance": provenance(
            ERA5_SOURCE, kind="HISTORICAL", status="HISTORICAL", reference="Normals 1991–2020 (WMO standard period)",
            url="https://open-meteo.com/en/docs/historical-weather-api",
            notes="ERA5 is a ~25 km reanalysis; it smooths orographic rainfall peaks on the Western Ghats and typically underestimates local extremes.",
        ),
    }
