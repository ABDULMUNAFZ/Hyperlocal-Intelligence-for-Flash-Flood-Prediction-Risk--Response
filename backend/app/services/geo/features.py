"""
Assemble the 17-feature vector expected by the FloodGuard ensemble model from
real data sources, with per-feature provenance.

If a source is unreachable the feature is IMPUTED with the median of the model's
training distribution and flagged — the response's data_quality degrades
accordingly. Nothing is silently substituted.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from shapely.geometry import box

from app.services.geo import rasters
from app.services.geo.common import DATA_DIR, TTLCache, get_client, haversine_m
from app.services.geo.hydrology import d8_accumulation, priority_flood, twi as twi_index
from app.services.geo.weather import point_weather

logger = logging.getLogger(__name__)

FEATURE_NAMES = [
    "rainfall_1h_mm", "rainfall_6h_mm", "rainfall_24h_mm", "rainfall_72h_mm",
    "temperature_c", "humidity_percent", "wind_speed_kmh", "pressure_hpa",
    "elevation_m", "slope_deg", "twi",
    "soil_clay_percent", "soil_sand_percent", "soil_saturated_conductivity_mm_h",
    "landcover_class", "population_density_per_km2", "historical_flood_count",
]

FEATURE_META: Dict[str, Tuple[str, str]] = {
    "rainfall_1h_mm": ("Rainfall, last 1 h", "mm"),
    "rainfall_6h_mm": ("Rainfall, last 6 h", "mm"),
    "rainfall_24h_mm": ("Rainfall, last 24 h", "mm"),
    "rainfall_72h_mm": ("Rainfall, last 72 h", "mm"),
    "temperature_c": ("Air temperature", "°C"),
    "humidity_percent": ("Relative humidity", "%"),
    "wind_speed_kmh": ("Wind speed", "km/h"),
    "pressure_hpa": ("Mean sea-level pressure", "hPa"),
    "elevation_m": ("Elevation", "m"),
    "slope_deg": ("Slope", "°"),
    "twi": ("Topographic wetness index", ""),
    "soil_clay_percent": ("Soil clay (0–5 cm)", "%"),
    "soil_sand_percent": ("Soil sand (0–5 cm)", "%"),
    "soil_saturated_conductivity_mm_h": ("Soil saturated hydraulic conductivity", "mm/h"),
    "landcover_class": ("Land cover (ESA WorldCover class)", ""),
    "population_density_per_km2": ("Population density", "people/km²"),
    "historical_flood_count": ("Recorded flood/landslide events within 5 km", "events"),
}

# Medians of the distributions the current model was trained on
# (see app/ml/training/pipeline.py::_generate_synthetic_data). Used ONLY for imputation.
TRAINING_MEDIANS = {
    "rainfall_1h_mm": 3.47, "rainfall_6h_mm": 10.4, "rainfall_24h_mm": 20.8, "rainfall_72h_mm": 34.7,
    "temperature_c": 25.0, "humidity_percent": 70.0, "wind_speed_kmh": 6.93, "pressure_hpa": 1013.0,
    "elevation_m": 1250.0, "slope_deg": 22.5, "twi": 10.0,
    "soil_clay_percent": 30.0, "soil_sand_percent": 40.0, "soil_saturated_conductivity_mm_h": 50.0,
    "landcover_class": 40.0, "population_density_per_km2": 69.3, "historical_flood_count": 2.0,
}

_soil_cache = TTLCache("soilgrids", ttl_seconds=90 * 24 * 3600, persist=True)
_terrain_cache = TTLCache("terrain_point", ttl_seconds=90 * 24 * 3600, persist=True)
_raster_point_cache = TTLCache("raster_point", ttl_seconds=90 * 24 * 3600, persist=True)


def load_historical_events() -> List[Dict[str, Any]]:
    return json.loads((DATA_DIR / "historical_events.json").read_text())["events"]


def historical_count(lon: float, lat: float, radius_m: float = 5000) -> int:
    n = 0
    for ev in load_historical_events():
        if ev["id"].startswith("kerala-2018"):  # district-wide, no location
            continue
        pts = [ev["coordinates"]] + [p["coordinates"] for p in ev.get("related_places", [])]
        if any(haversine_m(lon, lat, p[0], p[1]) <= radius_m for p in pts):
            n += 1
    return n


_soil_down_until = 0.0


async def soilgrids(lon: float, lat: float) -> Optional[Dict[str, float]]:
    """ISRIC SoilGrids point query with a 10-minute circuit breaker when the service is down."""
    global _soil_down_until
    import time as _time

    key = TTLCache.key(round(lon, 3), round(lat, 3))
    cached = _soil_cache.get(key)
    if cached is not None:
        return cached
    if _time.time() < _soil_down_until:
        return None

    async def fetch():
        r = await get_client().get(
            "https://rest.isric.org/soilgrids/v2.0/properties/query",
            params={"lon": lon, "lat": lat, "property": ["clay", "sand"], "depth": "0-5cm", "value": "mean"},
            timeout=6,
        )
        r.raise_for_status()
        out = {}
        for layer in r.json()["properties"]["layers"]:
            val = layer["depths"][0]["values"]["mean"]
            d = layer["unit_measure"]["d_factor"]
            if val is not None:
                out[layer["name"]] = val / d  # mapped g/kg ÷ d_factor(10) → %
        return out or None

    try:
        return await _soil_cache.get_or_create(key, fetch)
    except Exception as exc:  # noqa: BLE001
        _soil_down_until = _time.time() + 600
        logger.info("SoilGrids unavailable (skipping for 10 min): %s", exc)
        return None


def local_twi(lon: float, lat: float, half_deg: float = 0.01) -> Optional[float]:
    dem, transform = rasters.read_dem((lon - half_deg, lat - half_deg, lon + half_deg, lat + half_deg))
    if np.isnan(dem).all():
        return None
    dx, dy = rasters.cell_size_m(lat, 1 / 3600)
    filled = priority_flood(dem)
    _, acc = d8_accumulation(filled, dx, dy)
    slope, _ = rasters.slope_aspect(dem, dx, dy)
    t = twi_index(acc, slope, (dx + dy) / 2)
    r, c = dem.shape[0] // 2, dem.shape[1] // 2
    return float(t[r, c])


def _point_rasters(lon: float, lat: float) -> Dict[str, Any]:
    """Read DEM/TWI, WorldCover and HRSL for a point concurrently (independent COG reads)."""
    from concurrent.futures import ThreadPoolExecutor

    def terrain():
        return rasters.sample_terrain(lon, lat)

    def twi():
        return local_twi(lon, lat)

    def landcover():
        return rasters.worldcover_point(lon, lat)

    def density():
        d = 0.0045  # ~1 km box
        pop = rasters.hrsl_population(box(lon - d, lat - d, lon + d, lat + d))
        area = (2 * d * 111.32 * math.cos(math.radians(lat))) * (2 * d * 111.32)
        return pop["population"] / area

    jobs = {"terrain": terrain, "twi": twi, "landcover": landcover, "population_density": density}
    out: Dict[str, Any] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {k: pool.submit(fn) for k, fn in jobs.items()}
        for k, fut in futures.items():
            try:
                out[k] = fut.result(timeout=60)
            except Exception as exc:  # noqa: BLE001 - reported as unavailable / imputed downstream
                logger.info("point raster %s failed: %s", k, exc)
                out[k] = {"available": False, "error": str(exc)} if k == "terrain" else None
    return out


async def point_rasters(lon: float, lat: float) -> Dict[str, Any]:
    key = TTLCache.key(round(lon, 4), round(lat, 4))

    cached = _raster_point_cache.get(key)
    if cached is not None:
        return cached
    value = await asyncio.to_thread(_point_rasters, lon, lat)
    # Only cache complete reads so transient network failures are retried next time
    if (value.get("terrain") or {}).get("available") and value.get("landcover") and value.get("population_density") is not None:
        _raster_point_cache.set(key, value)
    return value


async def build_point_features(lat: float, lon: float) -> Dict[str, Any]:
    weather, rast, soil = await asyncio.gather(point_weather(lat, lon), point_rasters(lon, lat), soilgrids(lon, lat))

    values: Dict[str, Optional[float]] = {n: None for n in FEATURE_NAMES}
    sources: Dict[str, str] = {}
    kinds: Dict[str, str] = {}

    if weather.get("available"):
        rr = weather["rainfall_recent"]
        cur = weather["current"]
        for fname, v in [("rainfall_1h_mm", rr["rain_1h_mm"]), ("rainfall_6h_mm", rr["rain_6h_mm"]),
                         ("rainfall_24h_mm", rr["rain_24h_mm"]), ("rainfall_72h_mm", rr["rain_72h_mm"]),
                         ("temperature_c", cur["temperature_c"]), ("humidity_percent", cur["relative_humidity_pct"]),
                         ("wind_speed_kmh", cur["wind_speed_kmh"]), ("pressure_hpa", cur["pressure_msl_hpa"])]:
            values[fname] = v
            sources[fname] = "Open-Meteo (NWP model analysis)"
            kinds[fname] = "MODEL_ANALYSIS"

    t = rast.get("terrain") or {}
    if t.get("available"):
        values["elevation_m"] = t["elevation_m"]
        values["slope_deg"] = t["slope_deg"]
        sources["elevation_m"] = sources["slope_deg"] = "Copernicus DEM GLO-30"
        kinds["elevation_m"] = kinds["slope_deg"] = "STATIC_DATASET"
    if rast.get("twi") is not None:
        values["twi"] = round(rast["twi"], 2)
        sources["twi"] = "Derived: D8 flow accumulation on Copernicus GLO-30 (2.2 km window)"
        kinds["twi"] = "DERIVED"
    if soil:
        if "clay" in soil:
            values["soil_clay_percent"] = round(soil["clay"], 1)
            sources["soil_clay_percent"] = "ISRIC SoilGrids 2.0"
            kinds["soil_clay_percent"] = "STATIC_DATASET"
        if "sand" in soil:
            values["soil_sand_percent"] = round(soil["sand"], 1)
            sources["soil_sand_percent"] = "ISRIC SoilGrids 2.0"
            kinds["soil_sand_percent"] = "STATIC_DATASET"
    lc = rast.get("landcover")
    if lc:
        values["landcover_class"] = float(lc["code"])
        sources["landcover_class"] = f"ESA WorldCover 2021 — {lc['label']}"
        kinds["landcover_class"] = "STATIC_DATASET"
    if rast.get("population_density") is not None:
        values["population_density_per_km2"] = round(rast["population_density"], 1)
        sources["population_density_per_km2"] = "HRSL v1.5 (Meta/CIESIN), 1 km² window"
        kinds["population_density_per_km2"] = "STATIC_DATASET"
    values["historical_flood_count"] = float(historical_count(lon, lat))
    sources["historical_flood_count"] = "FloodGuard curated event list (sourced)"
    kinds["historical_flood_count"] = "HISTORICAL"

    feature_rows = []
    vector = []
    imputed = []
    for n in FEATURE_NAMES:
        v = values[n]
        label, unit = FEATURE_META[n]
        if v is None:
            imputed.append(n)
            vector.append(TRAINING_MEDIANS[n])
            feature_rows.append({"name": n, "label": label, "unit": unit, "value": None,
                                 "model_input": TRAINING_MEDIANS[n], "status": "IMPUTED",
                                 "source": "Unavailable — imputed with training-distribution median"})
        else:
            vector.append(float(v))
            feature_rows.append({"name": n, "label": label, "unit": unit, "value": v, "model_input": float(v),
                                 "status": kinds.get(n, "OBSERVED"), "source": sources.get(n)})

    if len(imputed) == 0:
        quality = "GOOD"
    elif len(imputed) <= 3:
        quality = "PARTIAL"
    else:
        quality = "POOR"

    return {
        "vector": np.array(vector, dtype=float).reshape(1, -1),
        "features": feature_rows,
        "imputed": imputed,
        "data_quality": quality,
        "weather": weather,
        "terrain": t,
        "landcover": lc,
    }
