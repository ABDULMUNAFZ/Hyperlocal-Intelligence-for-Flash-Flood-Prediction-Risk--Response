"""
Operational-zone analysis and district raster layers.

zone_terrain()  — Copernicus GLO-30 terrain + D8 hydrology inside a zone, plus
                  per-cell aggregates (elevation, slope, TWI, WorldCover, HRSL population)
zone_risk()     — runs the FloodGuard ensemble on those real per-cell features
zone_impact()   — counts OSM buildings/roads/facilities and HRSL population inside
                  model cells at HIGH or CRITICAL level
district_layer_png() — district-wide PNG overlays (slope, elevation, land cover, population)
"""

from __future__ import annotations

import asyncio
import base64
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from rasterio.features import geometry_mask
from rasterio.transform import from_origin
from shapely.geometry import Point, box, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from app.services.geo import rasters
from app.services.geo.common import CACHE_DIR, TTLCache, WAYANAD_BBOX, provenance, utcnow_iso, wayanad_geometry
from app.services.geo.features import FEATURE_NAMES, TRAINING_MEDIANS, historical_count, soilgrids
from app.services.geo.hydrology import d8_accumulation, extract_channels, priority_flood, twi as twi_index
from app.services.geo.osm import geom_area_km2
from app.services.geo.weather import point_weather

logger = logging.getLogger(__name__)

MAX_ZONE_CELLS = 260  # max DEM cells along one side
RISK_CELLS = 14       # model grid cells along the longer side
_zone_cache = TTLCache("zone_terrain", ttl_seconds=30 * 24 * 3600, persist=True, max_items=100)
_risk_cache = TTLCache("zone_risk", ttl_seconds=20 * 60, max_items=100)

RISK_LEVELS = [(0.8, "CRITICAL"), (0.6, "HIGH"), (0.4, "MODERATE"), (0.2, "LOW"), (0.0, "VERY_LOW")]


def risk_level(p: float) -> str:
    for thr, name in RISK_LEVELS:
        if p >= thr:
            return name
    return "VERY_LOW"


def _png_data_url(rgba: np.ndarray) -> str:
    return "data:image/png;base64," + base64.b64encode(rasters.to_png(rgba)).decode()


def _image_coords(bounds: Tuple[float, float, float, float]) -> List[List[float]]:
    w, s, e, n = bounds
    return [[w, n], [e, n], [e, s], [w, s]]


def _zone_terrain_sync(geojson_geom: Dict[str, Any]) -> Dict[str, Any]:
    geom = shape(geojson_geom)
    w, s, e, n = geom.bounds
    pad = 0.002
    bounds = (w - pad, s - pad, e + pad, n + pad)
    base_res = 1 / 3600
    span = max(bounds[2] - bounds[0], bounds[3] - bounds[1])
    res = max(base_res, span / MAX_ZONE_CELLS)
    dem, transform = rasters.read_dem(bounds, res_deg=res)
    lat_c = (s + n) / 2
    dx, dy = rasters.cell_size_m(lat_c, res)
    slope, aspect = rasters.slope_aspect(dem, dx, dy)
    filled = priority_flood(dem)
    direction, acc = d8_accumulation(filled, dx, dy)
    cell_area = dx * dy
    twi = twi_index(acc, slope, (dx + dy) / 2)
    inside = geometry_mask([mapping(geom)], out_shape=dem.shape, transform=transform, invert=True)

    threshold_cells = max(8, int(0.05e6 / cell_area))  # channel initiation at 0.05 km² contributing area
    channels = extract_channels(direction, acc, filled, transform, cell_area, threshold_cells)
    channels = [f for f in channels if geom.buffer(0.001).intersects(shape(f["geometry"]))]

    # Overlays masked to the zone
    def masked(a: np.ndarray) -> np.ndarray:
        out = a.astype("float64").copy()
        out[~inside] = np.nan
        return out

    img_bounds = (transform.c, transform.f + transform.e * dem.shape[0], transform.c + transform.a * dem.shape[1], transform.f)
    slope_png = _png_data_url(rasters.colorize(masked(slope), rasters.SLOPE_STOPS))
    acc_log = np.log10(acc * cell_area / 1e6 + 1e-6)  # log10 km²
    acc_png = _png_data_url(rasters.colorize(masked(acc_log), [
        (-3.0, (40, 120, 220, 0)), (-2.0, (60, 150, 235, 70)), (-1.0, (40, 130, 230, 170)),
        (0.0, (20, 90, 210, 220)), (1.0, (10, 40, 160, 245)),
    ]))
    twi_png = _png_data_url(rasters.colorize(masked(twi), [
        (4, (240, 240, 200, 0)), (7, (160, 210, 220, 90)), (10, (70, 150, 210, 170)), (14, (20, 60, 160, 230)),
    ]))

    ev = dem[inside]
    sv = slope[inside]
    stats = {
        "elevation_min_m": round(float(np.nanmin(ev)), 1) if ev.size else None,
        "elevation_max_m": round(float(np.nanmax(ev)), 1) if ev.size else None,
        "elevation_mean_m": round(float(np.nanmean(ev)), 1) if ev.size else None,
        "relief_m": round(float(np.nanmax(ev) - np.nanmin(ev)), 1) if ev.size else None,
        "slope_mean_deg": round(float(np.nanmean(sv)), 1) if sv.size else None,
        "slope_p90_deg": round(float(np.nanpercentile(sv, 90)), 1) if sv.size else None,
        "area_steeper_than_30deg_pct": round(100 * float(np.mean(sv > 30)), 1) if sv.size else None,
        "dem_resolution_m": round((dx + dy) / 2, 1),
        "channel_threshold_km2": round(threshold_cells * cell_area / 1e6, 3),
        "max_contributing_area_km2": round(float(np.nanmax(acc[inside])) * cell_area / 1e6, 2) if inside.any() else None,
    }

    # ---- per-cell aggregates for the model grid
    gw, gs, ge, gn = geom.bounds
    step = max(max(ge - gw, gn - gs) / RISK_CELLS, 0.0015)
    ncols = max(1, int(math.ceil((ge - gw) / step)))
    nrows = max(1, int(math.ceil((gn - gs) / step)))
    lc = rasters.worldcover_window((gw, gn - nrows * step, gw + ncols * step, gn), (nrows * 10, ncols * 10))
    hrsl_bounds = (gw, gn - nrows * step, gw + ncols * step, gn)
    pop_cells = rasters.hrsl_grid(hrsl_bounds, step / 6)
    cells = []
    inv = ~transform
    for r in range(nrows):
        for c in range(ncols):
            cb = (gw + c * step, gn - (r + 1) * step, gw + (c + 1) * step, gn - r * step)
            cpoly = box(*cb)
            clip = cpoly.intersection(geom)
            if clip.is_empty or clip.area < 0.15 * cpoly.area:
                continue
            col0, row0 = inv * (cb[0], cb[3])
            col1, row1 = inv * (cb[2], cb[1])
            r0, r1 = max(0, int(row0)), min(dem.shape[0], int(math.ceil(row1)))
            c0, c1 = max(0, int(col0)), min(dem.shape[1], int(math.ceil(col1)))
            sub_e = dem[r0:r1, c0:c1]
            sub_s = slope[r0:r1, c0:c1]
            sub_t = twi[r0:r1, c0:c1]
            if sub_e.size == 0 or np.isnan(sub_e).all():
                continue
            blk = lc[r * 10:(r + 1) * 10, c * 10:(c + 1) * 10].ravel()
            blk = blk[np.isin(blk, list(rasters.WORLDCOVER_CLASSES))]
            lc_mode = int(np.bincount(blk).argmax()) if blk.size else None
            pop = sum(pc["population"] for pc in pop_cells["cells"]
                      if cb[0] <= (pc["bbox"][0] + pc["bbox"][2]) / 2 < cb[2] and cb[1] <= (pc["bbox"][1] + pc["bbox"][3]) / 2 < cb[3])
            cell_km2 = geom_area_km2(cpoly)
            ctr = cpoly.centroid
            cells.append({
                "row": r, "col": c,
                "geometry": mapping(clip),
                "center": [round(ctr.x, 5), round(ctr.y, 5)],
                "elevation_m": round(float(np.nanmean(sub_e)), 1),
                "slope_deg": round(float(np.nanmean(sub_s)), 1),
                "twi": round(float(np.nanpercentile(sub_t, 75)), 2),
                "landcover_class": lc_mode,
                "landcover_label": rasters.WORLDCOVER_CLASSES[lc_mode][0] if lc_mode else None,
                "population_hrsl": round(pop, 1),
                "population_density_per_km2": round(pop / cell_km2, 1) if cell_km2 else None,
                "historical_flood_count": historical_count(ctr.x, ctr.y),
            })

    try:
        pop_total = rasters.hrsl_population(geom)
    except Exception as exc:  # noqa: BLE001
        pop_total = {"error": str(exc)}
    try:
        landcover = rasters.worldcover_fractions(geom)
    except Exception as exc:  # noqa: BLE001
        landcover = {"error": str(exc)}

    return {
        "available": True,
        "computed_at": utcnow_iso(),
        "zone_area_km2": round(geom_area_km2(geom), 3),
        "stats": stats,
        "drainage": {"type": "FeatureCollection", "features": channels},
        "overlays": {
            "bounds": img_bounds,
            "coordinates": _image_coords(img_bounds),
            "slope": slope_png,
            "flow_accumulation": acc_png,
            "twi": twi_png,
        },
        "cells": cells,
        "cell_step_deg": step,
        "population": {
            "hrsl_total": round(pop_total.get("population", 0.0), 0) if "population" in pop_total else None,
            "error": pop_total.get("error"),
            "provenance": provenance(rasters.HRSL_SOURCE, kind="STATIC_DATASET", status="HISTORICAL", url=rasters.HRSL_URL,
                                     reference="Reference year not encoded in the HRSL v1.5 tiles",
                                     notes="Modelled residential population from satellite-detected settlements; not a live head-count."),
        },
        "landcover": {**landcover, "provenance": provenance(rasters.WORLDCOVER_SOURCE, kind="STATIC_DATASET", status="HISTORICAL",
                                                              reference="2021", url=rasters.WORLDCOVER_URL)},
        "provenance": provenance(rasters.DEM_SOURCE, kind="DERIVED", status="HISTORICAL", url=rasters.DEM_URL,
                                 notes="Slope (Horn), D8 flow routing after Priority-Flood filling, TWI = ln(a/tanβ). Terrain analysis only — not a flood-inundation model."),
    }


async def zone_terrain(geojson_geom: Dict[str, Any]) -> Dict[str, Any]:
    geom = shape(geojson_geom)
    if geom_area_km2(geom) > 60:
        return {"available": False, "reason": "Zone larger than 60 km² — select a smaller operational micro-zone for terrain analysis."}
    key = TTLCache.key("zt", [round(v, 5) for v in geom.bounds], round(geom.area, 10))
    return await _zone_cache.get_or_create(key, lambda: asyncio.to_thread(_zone_terrain_sync, geojson_geom))


async def zone_risk(geojson_geom: Dict[str, Any], engine: Any, model_info: Dict[str, Any],
                    scenario: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Model risk grid. With `scenario` ({rainfall_mm, duration_hours}) the rainfall inputs are replaced
    by a uniform-intensity scenario (model sensitivity, not a forecast)."""
    terrain = await zone_terrain(geojson_geom)
    if not terrain.get("available"):
        return terrain
    geom = shape(geojson_geom)
    c = geom.centroid
    key = TTLCache.key("zr", terrain["computed_at"], [round(v, 5) for v in geom.bounds], scenario)

    async def compute():
        weather, soil = await asyncio.gather(point_weather(c.y, c.x), soilgrids(c.x, c.y))
        imputed = set()
        met = {}
        if weather.get("available"):
            rr, cur = weather["rainfall_recent"], weather["current"]
            met = {
                "rainfall_1h_mm": rr["rain_1h_mm"], "rainfall_6h_mm": rr["rain_6h_mm"],
                "rainfall_24h_mm": rr["rain_24h_mm"], "rainfall_72h_mm": rr["rain_72h_mm"],
                "temperature_c": cur["temperature_c"], "humidity_percent": cur["relative_humidity_pct"],
                "wind_speed_kmh": cur["wind_speed_kmh"], "pressure_hpa": cur["pressure_msl_hpa"],
            }
        if scenario:
            i = scenario["rainfall_mm"] / scenario["duration_hours"]
            d = scenario["duration_hours"]
            met.update({
                "rainfall_1h_mm": i, "rainfall_6h_mm": i * min(6, d), "rainfall_24h_mm": i * min(24, d),
                "rainfall_72h_mm": max(met.get("rainfall_72h_mm") or 0.0, i * min(72, d)),
            })
        soil_vals = {"soil_clay_percent": (soil or {}).get("clay"), "soil_sand_percent": (soil or {}).get("sand"),
                     "soil_saturated_conductivity_mm_h": None}
        rows = []
        for cell in terrain["cells"]:
            v = {**met, **soil_vals,
                 "elevation_m": cell["elevation_m"], "slope_deg": cell["slope_deg"], "twi": cell["twi"],
                 "landcover_class": cell["landcover_class"], "population_density_per_km2": cell["population_density_per_km2"],
                 "historical_flood_count": cell["historical_flood_count"]}
            row = []
            for fname in FEATURE_NAMES:
                val = v.get(fname)
                if val is None:
                    imputed.add(fname)
                    val = TRAINING_MEDIANS[fname]
                row.append(float(val))
            rows.append(row)
        if not rows:
            return {"available": False, "reason": "No DEM cells inside the zone."}
        X = np.array(rows)
        result = await engine.predict_batch(X, FEATURE_NAMES)
        features = []
        for cell, pred in zip(terrain["cells"], result["predictions"]):
            p = float(pred["probability"])
            features.append({
                "type": "Feature",
                "properties": {
                    "probability": round(p, 4), "risk_level": risk_level(p), "risk_score": int(round(p * 100)),
                    "elevation_m": cell["elevation_m"], "slope_deg": cell["slope_deg"], "twi": cell["twi"],
                    "landcover": cell["landcover_label"], "population_hrsl": cell["population_hrsl"],
                    "center": cell["center"],
                },
                "geometry": cell["geometry"],
            })
        dist: Dict[str, int] = {}
        for f in features:
            dist[f["properties"]["risk_level"]] = dist.get(f["properties"]["risk_level"], 0) + 1
        return {
            "available": True,
            "computed_at": utcnow_iso(),
            "geojson": {"type": "FeatureCollection", "features": features},
            "distribution": dist,
            "max_probability": round(max(f["properties"]["probability"] for f in features), 4),
            "imputed_features": sorted(imputed),
            "shared_inputs": {"weather_point": [c.x, c.y], "weather": {k: met.get(k) for k in met},
                              "soil": soil_vals},
            "mode": "SCENARIO" if scenario else "CURRENT",
            "scenario": scenario,
            "model": model_info,
            "provenance": provenance("FloodGuard ensemble model", kind="MODEL_PREDICTION", status="LIVE",
                                     notes="Per-cell terrain/land-cover/population inputs; weather and soil sampled once at the zone centre. "
                                           + (model_info.get("warning") or "")),
        }

    return await _risk_cache.get_or_create(key, compute)


def zone_impact(geojson_geom: Dict[str, Any], risk: Dict[str, Any], osm: Dict[str, Any], terrain: Dict[str, Any]) -> Dict[str, Any]:
    geom = shape(geojson_geom)
    out: Dict[str, Any] = {"computed_at": utcnow_iso(), "zone": {}, "high_risk": None}
    if terrain.get("available"):
        out["zone"]["population_hrsl"] = terrain["population"]["hrsl_total"]
    if osm.get("available"):
        s = osm["summary"]
        out["zone"].update({
            "buildings": s["building_count"], "road_length_km": s["road_length_total_km"],
            "bridges": s["bridge_count"], "facilities": s["facility_counts"],
        })
    if not risk.get("available"):
        out["high_risk_reason"] = risk.get("reason", "Model risk grid unavailable")
        return out
    hot = [shape(f["geometry"]) for f in risk["geojson"]["features"] if f["properties"]["risk_level"] in ("HIGH", "CRITICAL")]
    if not hot:
        out["high_risk"] = {"cells": 0, "note": "No model cells at HIGH or CRITICAL level in this zone."}
        return out
    region = unary_union(hot)
    hr: Dict[str, Any] = {"cells": len(hot), "area_km2": round(geom_area_km2(region), 3)}
    hr["population_hrsl"] = round(sum(f["properties"]["population_hrsl"] or 0 for f in risk["geojson"]["features"]
                                      if f["properties"]["risk_level"] in ("HIGH", "CRITICAL")), 0)
    if osm.get("available"):
        b_in = [f for f in osm["buildings"]["features"] if region.contains(Point(f["properties"]["centroid"]))]
        types: Dict[str, int] = {}
        for f in b_in:
            types[f["properties"]["building_type"]] = types.get(f["properties"]["building_type"], 0) + 1
        from app.services.geo.osm import _line_length_in

        road_m = sum(_line_length_in(region, [tuple(p) for p in f["geometry"]["coordinates"]]) for f in osm["roads"]["features"])
        fac = [f["properties"] for f in osm["facilities"]["features"] if region.contains(Point(f["geometry"]["coordinates"]))]
        br = [f["properties"] for f in osm["bridges"]["features"] if region.contains(Point(f["geometry"]["coordinates"]))]
        hr.update({
            "buildings": len(b_in), "building_types": types,
            "road_length_km": round(road_m / 1000, 2),
            "bridges": len(br), "bridge_names": [b.get("name") for b in br if b.get("name")][:10],
            "facilities": fac,
        })
    out["high_risk"] = hr
    out["method"] = ("Exposure = features whose centroid/segments fall inside model cells at HIGH (p≥0.6) or CRITICAL (p≥0.8). "
                     "This is exposure to modelled risk, not to a simulated flood extent.")
    return out


# --------------------------------------------------------------------------- district PNG layers

def _district_png_sync(name: str) -> Tuple[bytes, List[List[float]]]:
    w, s, e, n = WAYANAD_BBOX
    pad = 0.02
    bounds = (w - pad, s - pad, e + pad, n + pad)
    dist = wayanad_geometry()
    if name in ("slope", "elevation"):
        res = 0.0009
        dem, transform = rasters.read_dem(bounds, res_deg=res)
        mask = geometry_mask([mapping(dist)], out_shape=dem.shape, transform=transform, invert=True)
        if name == "slope":
            dx, dy = rasters.cell_size_m((s + n) / 2, res)
            val, _ = rasters.slope_aspect(dem, dx, dy)
            stops = rasters.SLOPE_STOPS
        else:
            val, stops = dem, rasters.ELEVATION_STOPS
        val = val.astype("float64")
        val[~mask] = np.nan
        rgba = rasters.colorize(val, stops)
    elif name == "landcover":
        rows, cols = int((bounds[3] - bounds[1]) / 0.0005), int((bounds[2] - bounds[0]) / 0.0005)
        arr = rasters.worldcover_window(bounds, (rows, cols))
        transform = from_origin(bounds[0], bounds[3], (bounds[2] - bounds[0]) / cols, (bounds[3] - bounds[1]) / rows)
        mask = geometry_mask([mapping(dist)], out_shape=arr.shape, transform=transform, invert=True)
        arr = arr.copy()
        arr[~mask] = 0
        rgba = rasters.worldcover_rgba(arr, alpha=190)
    elif name == "population":
        cell = 0.0025
        grid = rasters.hrsl_grid(bounds, cell)
        step = grid["cell_deg"]
        cols, rows = int((bounds[2] - bounds[0]) / step) + 1, int((bounds[3] - bounds[1]) / step) + 1
        dens = np.full((rows, cols), np.nan)
        km2 = (step * 111.32 * math.cos(math.radians((s + n) / 2))) * (step * 111.32)
        for c in grid["cells"]:
            ci = int(round((c["bbox"][0] - bounds[0]) / step))
            ri = int(round((bounds[3] - c["bbox"][3]) / step))
            if 0 <= ri < rows and 0 <= ci < cols:
                dens[ri, ci] = c["population"] / km2
        transform = from_origin(bounds[0], bounds[3], step, step)
        mask = geometry_mask([mapping(dist)], out_shape=dens.shape, transform=transform, invert=True)
        dens[~mask] = np.nan
        rgba = rasters.colorize(np.log10(np.maximum(dens, 1e-3)), [
            (0.0, (255, 245, 200, 0)), (1.0, (255, 220, 120, 120)), (2.0, (250, 160, 60, 180)),
            (3.0, (220, 70, 40, 220)), (4.0, (140, 0, 60, 240)),
        ])
        bounds = (bounds[0], bounds[3] - rows * step, bounds[0] + cols * step, bounds[3])
    else:
        raise ValueError(name)
    return rasters.to_png(rgba), _image_coords(bounds)


LAYER_META = {
    "slope": (rasters.DEM_SOURCE, "Slope (°) from Copernicus GLO-30 resampled to ≈100 m"),
    "elevation": (rasters.DEM_SOURCE, "Elevation (m) from Copernicus GLO-30 resampled to ≈100 m"),
    "landcover": (rasters.WORLDCOVER_SOURCE, "ESA WorldCover 2021 resampled to ≈55 m (majority)"),
    "population": (rasters.HRSL_SOURCE, "HRSL v1.5 people/km² in ≈275 m cells (log scale); reference year not encoded"),
}


async def district_layer(name: str) -> Dict[str, Any]:
    if name not in LAYER_META:
        raise ValueError(name)
    path = CACHE_DIR / "layers" / f"{name}.png"
    meta_path = CACHE_DIR / "layers" / f"{name}.json"
    import json

    if not path.exists() or not meta_path.exists():
        png, coords = await asyncio.to_thread(_district_png_sync, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png)
        meta_path.write_text(json.dumps({"coordinates": coords, "generated_at": utcnow_iso()}))
    meta = json.loads(meta_path.read_text())
    src, note = LAYER_META[name]
    return {
        "name": name,
        "coordinates": meta["coordinates"],
        "image_url": f"/api/v1/geo/layers/{name}.png",
        "provenance": provenance(src, kind="STATIC_DATASET", status="HISTORICAL", retrieved_at=meta["generated_at"], notes=note),
    }


def district_layer_path(name: str):
    return CACHE_DIR / "layers" / f"{name}.png"
