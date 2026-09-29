"""
Wayanad situational-awareness geo API.

All endpoints return real data (or derived computations on real data) with a
`provenance` block. Unavailable sources are reported as UNAVAILABLE.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from shapely.geometry import shape

from app.ml.inference import InferenceEngine, get_inference_service
from app.ml.registry import ModelStage, get_model_registry
from app.services.geo import analysis, osm, rasters
from app.services.geo.alerts import wayanad_alerts
from app.services.geo.common import (
    DATA_DIR, WAYANAD_BBOX, TTLCache, get_client, haversine_m, provenance, utcnow_iso, wayanad_geometry,
)
from app.services.geo.features import FEATURE_NAMES, load_historical_events, point_rasters
from app.services.geo.weather import climate_normals, point_weather, rainfall_grid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/geo", tags=["Geo — Wayanad situational awareness"])


async def get_engine() -> InferenceEngine:
    return (await get_inference_service()).engine


def model_provenance() -> Dict[str, Any]:
    """Describe the production model honestly, including how it was trained."""
    registry = get_model_registry()
    prod = registry.get_models_by_stage(ModelStage.PRODUCTION)
    m = next((x for x in prod if x.name == "flood_ensemble"), prod[0] if prod else None)
    if m is None:
        return {"available": False, "warning": "No production model registered."}
    return {
        "available": True,
        "model_id": m.model_id,
        "name": m.name,
        "version": m.version,
        "stage": getattr(m.stage, "value", m.stage),
        "training_date": m.training_date,
        "training_samples": m.training_samples,
        "positive_samples": m.positive_samples,
        "metrics": {k: round(v, 4) for k, v in (m.metrics or {}).items() if isinstance(v, (int, float))},
        "metrics_note": "Metrics were computed on held-out synthetic data and say nothing about real-world skill.",
        "training_data": "SYNTHETIC",
        "validated": False,
        "warning": (
            f"This model was trained on {m.training_samples:,} synthetic samples (the training_samples table is empty, "
            "so the pipeline fell back to generated data). Its outputs demonstrate the pipeline on real inputs; "
            "they are NOT validated flash-flood probabilities for Wayanad."
        ),
    }


_sanity: Dict[str, Any] = {}


async def model_sanity(engine: InferenceEngine) -> Dict[str, Any]:
    """Physical plausibility check: at a fixed real feature vector (Mundakai, Meppadi), predicted
    probability should not decrease as 24 h rainfall increases. Cached per process."""
    if _sanity:
        return _sanity
    from app.services.geo.features import build_point_features

    base = await build_point_features(11.486475, 76.1557245)
    idx = {n: i for i, n in enumerate(FEATURE_NAMES)}
    curve = []
    for mm in (0, 25, 50, 100, 200, 400):
        X = base["vector"].copy()
        X[0, idx["rainfall_1h_mm"]] = mm / 24
        X[0, idx["rainfall_6h_mm"]] = mm / 4
        X[0, idx["rainfall_24h_mm"]] = mm
        X[0, idx["rainfall_72h_mm"]] = max(X[0, idx["rainfall_72h_mm"]], mm)
        res = await engine.predict(X, FEATURE_NAMES, use_ensemble=True)
        p = res["probabilities"][0]
        curve.append({"rainfall_24h_mm": mm, "probability": round(float(p[1] if isinstance(p, list) and len(p) > 1 else p), 4)})
    probs = [c["probability"] for c in curve]
    monotonic = all(b >= a - 0.01 for a, b in zip(probs, probs[1:]))
    _sanity.update({
        "checked_at": utcnow_iso(),
        "reference_location": "Mundakai, Meppadi (OSM node)",
        "rainfall_response": curve,
        "rainfall_monotonic": monotonic,
        "passed": monotonic,
        "message": ("Model probability rises with rainfall as expected." if monotonic else
                    "FAILED: model probability decreases as rainfall increases — physically implausible. "
                    "Model risk layers are shown for transparency only and must not be used for decisions."),
    })
    return _sanity


@router.get("/model/sanity")
async def model_sanity_endpoint(engine: InferenceEngine = Depends(get_engine)):
    return {**await model_sanity(engine), "model": model_provenance()}


# --------------------------------------------------------------------------- reference data

@router.get("/manifest")
async def manifest(engine: InferenceEngine = Depends(get_engine)):
    """Data sources, their status semantics and what is unavailable."""
    return {
        "region": {"name": "Wayanad", "state": "Kerala", "bbox": WAYANAD_BBOX, "osm_relation": 2018203, "lgd_district_code": "567"},
        "datasets": [
            {"layer": "terrain", "source": rasters.DEM_SOURCE, "kind": "STATIC_DATASET"},
            {"layer": "landcover", "source": rasters.WORLDCOVER_SOURCE, "kind": "STATIC_DATASET"},
            {"layer": "population", "source": rasters.HRSL_SOURCE, "kind": "STATIC_DATASET"},
            {"layer": "population_crosscheck", "source": "WorldPop Global 2000–2020, year 2020 (api.worldpop.org)", "kind": "STATIC_DATASET"},
            {"layer": "weather", "source": "Open-Meteo Forecast API", "kind": "MODEL_ANALYSIS / FORECAST"},
            {"layer": "climate", "source": "ERA5 via Open-Meteo Archive API (1991–2020)", "kind": "HISTORICAL"},
            {"layer": "alerts", "source": "NDMA SACHET CAP feed", "kind": "OBSERVED"},
            {"layer": "osm", "source": "OpenStreetMap (ODbL)", "kind": "STATIC_DATASET"},
            {"layer": "routing", "source": "OSRM demo server on OpenStreetMap", "kind": "DERIVED"},
        ],
        "unavailable": [
            {"layer": "live_flood_depth", "reason": "Flood depth exists only for user-run SIMULATION scenarios (uncalibrated 2D model); there is no real-time inundation feed."},
            {"layer": "landslide_susceptibility", "reason": "No authoritative susceptibility dataset (e.g. GSI NLSM) is connected."},
            {"layer": "designated_relief_camps", "reason": "No official relief-camp dataset; OSM has no designated emergency shelters in Wayanad."},
            {"layer": "live_cameras", "reason": "No legitimate public continuous camera feed found for Wayanad (see /geo/cameras)."},
            {"layer": "rain_gauges", "reason": "No IMD/KSDMA gauge feed connected; rainfall is NWP model analysis."},
        ],
        "model": {**model_provenance(), "sanity": await model_sanity(engine)},
    }


@router.get("/historical-events")
async def historical_events():
    data = json.loads((DATA_DIR / "historical_events.json").read_text())
    return {**data, "provenance": provenance("FloodGuard curated list (sources per event)", kind="HISTORICAL", status="HISTORICAL")}


@router.get("/cameras")
async def cameras():
    data = json.loads((DATA_DIR / "cameras.json").read_text())
    return {
        **data,
        "provenance": provenance("FloodGuard camera registry", kind="OBSERVED",
                                 status="LIVE" if data["cameras"] else "UNAVAILABLE",
                                 notes=None if data["cameras"] else "No public live camera available in Wayanad."),
    }


# --------------------------------------------------------------------------- point queries

@router.get("/weather")
async def weather(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return await point_weather(lat, lon)


@router.get("/climate")
async def climate(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return await climate_normals(lat, lon)


@router.get("/terrain")
async def terrain(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    r = await point_rasters(lon, lat)
    t = r.get("terrain") or {"available": False}
    return {
        **t,
        "twi": round(r["twi"], 2) if r.get("twi") is not None else None,
        "landcover": r.get("landcover"),
        "population_density_per_km2": round(r["population_density"], 1) if r.get("population_density") is not None else None,
        "provenance": provenance(rasters.DEM_SOURCE, kind="STATIC_DATASET", status="HISTORICAL", url=rasters.DEM_URL,
                                 notes="Elevation at 30 m; slope/aspect by Horn's method; landcover ESA WorldCover 2021; density HRSL v1.5 in a 1 km² window."),
    }


@router.get("/building")
async def building(lat: float = Query(...), lon: float = Query(...)):
    return await osm.building_at(lon, lat)


@router.get("/rainfall-grid")
async def rain_grid(step: float = Query(0.07, ge=0.03, le=0.25)):
    return await rainfall_grid(WAYANAD_BBOX, step)


@router.get("/alerts")
async def alerts(include_expired: bool = False):
    return await wayanad_alerts(include_expired=include_expired)


# --------------------------------------------------------------------------- district layers

@router.get("/layers/{name}")
async def layer(name: str):
    if name.endswith(".png"):
        key = name[:-4]
        if key not in analysis.LAYER_META:
            raise HTTPException(404, "Unknown layer")
        await analysis.district_layer(key)
        return FileResponse(analysis.district_layer_path(key), media_type="image/png",
                            headers={"Cache-Control": "public, max-age=86400"})
    try:
        return await analysis.district_layer(name)
    except ValueError:
        raise HTTPException(404, "Unknown layer")
    except Exception as exc:  # noqa: BLE001
        logger.exception("layer %s failed", name)
        return {"name": name, "available": False, "provenance": provenance(name, kind="STATIC_DATASET", status="UNAVAILABLE", notes=str(exc))}


# --------------------------------------------------------------------------- zones

class RainScenario(BaseModel):
    rainfall_mm: float = Field(..., ge=0, le=1500)
    duration_hours: int = Field(..., ge=1, le=72)


class ZoneRequest(BaseModel):
    geometry: Dict[str, Any] = Field(..., description="GeoJSON Polygon/MultiPolygon in WGS84")
    name: Optional[str] = None
    scenario: Optional[RainScenario] = None


def _validate_zone(req: ZoneRequest) -> Dict[str, Any]:
    try:
        g = shape(req.geometry)
    except Exception:
        raise HTTPException(400, "Invalid GeoJSON geometry")
    if g.geom_type not in ("Polygon", "MultiPolygon") or g.is_empty:
        raise HTTPException(400, "Zone must be a Polygon or MultiPolygon")
    if not g.intersects(wayanad_geometry().buffer(0.05)):
        raise HTTPException(400, "Zone is outside Wayanad district")
    return req.geometry


@router.post("/zone/terrain")
async def zone_terrain(req: ZoneRequest):
    geom = _validate_zone(req)
    try:
        return await analysis.zone_terrain(geom)
    except Exception as exc:  # noqa: BLE001
        logger.exception("zone terrain failed")
        return {"available": False, "reason": f"Terrain analysis failed: {exc}"}


@router.post("/zone/osm")
async def zone_osm(req: ZoneRequest):
    geom = _validate_zone(req)
    return await osm.zone_features(shape(geom))


@router.post("/zone/risk")
async def zone_risk(req: ZoneRequest, engine: InferenceEngine = Depends(get_engine)):
    geom = _validate_zone(req)
    try:
        return await analysis.zone_risk(geom, engine, model_provenance(),
                                        req.scenario.model_dump() if req.scenario else None)
    except Exception as exc:  # noqa: BLE001
        logger.exception("zone risk failed")
        return {"available": False, "reason": f"Model risk grid failed: {exc}"}


@router.post("/zone/impact")
async def zone_impact(req: ZoneRequest, engine: InferenceEngine = Depends(get_engine)):
    geom = _validate_zone(req)
    terrain = await analysis.zone_terrain(geom)
    osm_data = await osm.zone_features(shape(geom))
    try:
        risk = await analysis.zone_risk(geom, engine, model_provenance(),
                                        req.scenario.model_dump() if req.scenario else None)
    except Exception as exc:  # noqa: BLE001
        risk = {"available": False, "reason": str(exc)}
    out = analysis.zone_impact(geom, risk, osm_data, terrain)
    out["mode"] = risk.get("mode", "CURRENT")
    out["scenario"] = risk.get("scenario")
    return out


_worldpop_cache = TTLCache("worldpop", ttl_seconds=180 * 24 * 3600, persist=True)


@router.post("/zone/worldpop")
async def zone_worldpop(req: ZoneRequest):
    """WorldPop 2020 population estimate for the zone (independent cross-check of HRSL)."""
    geom = _validate_zone(req)
    fc = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": geom}]}
    key = TTLCache.key(json.dumps(geom, sort_keys=True))

    async def fetch():
        r = await get_client().get(
            "https://api.worldpop.org/v1/services/stats",
            params={"dataset": "wpgppop", "year": 2020, "geojson": json.dumps(fc), "runasync": "false"},
            timeout=150,
        )
        r.raise_for_status()
        d = r.json()
        if d.get("error"):
            raise RuntimeError(d.get("error_message"))
        return {"total_population": d["data"]["total_population"], "retrieved_at": utcnow_iso()}

    try:
        d = await _worldpop_cache.get_or_create(key, fetch)
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "provenance": provenance("WorldPop", kind="STATIC_DATASET", status="UNAVAILABLE", notes=str(exc))}
    return {
        "available": True,
        "population": round(d["total_population"]),
        "reference_year": 2020,
        "provenance": provenance("WorldPop Global Project Population, 100 m unconstrained (University of Southampton), CC BY 4.0",
                                 kind="STATIC_DATASET", status="HISTORICAL", retrieved_at=d["retrieved_at"],
                                 reference="Reference year 2020", url="https://www.worldpop.org/"),
    }


# --------------------------------------------------------------------------- evacuation

class RouteOption(BaseModel):
    id: str
    name: Optional[str] = None
    category: Optional[str] = None
    lon: float
    lat: float


class EvacuationRequest(BaseModel):
    origin: List[float] = Field(..., min_length=2, max_length=2, description="[lon, lat]")
    candidates: List[RouteOption] = Field(..., max_length=6)
    risk_geojson: Optional[Dict[str, Any]] = None


@router.post("/evacuation/routes")
async def evacuation_routes(req: EvacuationRequest):
    """Road routes (OSRM, OpenStreetMap) from an origin to candidate facilities.

    A route is never labelled 'safe'. It is reported as avoiding or crossing
    model HIGH/CRITICAL cells when a risk grid is supplied; inundation and
    road-blockage status are not known to FloodGuard.
    """
    from shapely.geometry import LineString
    from shapely.ops import unary_union

    hot = None
    if req.risk_geojson:
        polys = [shape(f["geometry"]) for f in req.risk_geojson.get("features", [])
                 if f.get("properties", {}).get("risk_level") in ("HIGH", "CRITICAL")]
        hot = unary_union(polys) if polys else None

    olon, olat = req.origin
    out = []
    for c in req.candidates:
        url = f"https://router.project-osrm.org/route/v1/driving/{olon},{olat};{c.lon},{c.lat}"
        try:
            r = await get_client().get(url, params={"overview": "full", "geometries": "geojson"}, timeout=20)
            r.raise_for_status()
            data = r.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                raise RuntimeError(data.get("code"))
            route = data["routes"][0]
        except Exception as exc:  # noqa: BLE001
            out.append({"candidate": c.model_dump(), "available": False, "reason": f"Routing unavailable: {exc}"})
            continue
        line = LineString(route["geometry"]["coordinates"])
        crosses = None
        if hot is not None:
            crosses = bool(line.intersects(hot))
        dest_elev = None
        try:
            r2 = await point_rasters(c.lon, c.lat)
            dest_elev = (r2.get("terrain") or {}).get("elevation_m")
        except Exception:  # noqa: BLE001
            pass
        out.append({
            "candidate": c.model_dump(),
            "available": True,
            "distance_km": round(route["distance"] / 1000, 2),
            "duration_min": round(route["duration"] / 60, 1),
            "straight_line_km": round(haversine_m(olon, olat, c.lon, c.lat) / 1000, 2),
            "destination_elevation_m": dest_elev,
            "crosses_model_high_risk": crosses,
            "assessment": (
                "Route crosses model HIGH/CRITICAL cells" if crosses else
                "Route avoids model HIGH/CRITICAL cells in the analysed zone" if crosses is False else
                "No risk grid supplied — route not assessed"
            ),
            "geometry": route["geometry"],
        })
    out.sort(key=lambda o: (not o.get("available"), bool(o.get("crosses_model_high_risk")), o.get("duration_min") or 1e9))
    return {
        "routes": out,
        "caveats": [
            "Candidate destinations are OSM facilities (schools, community halls, government buildings). Their designation as official relief camps is NOT verified.",
            "Travel times assume normal road conditions (OSRM). Road closures, landslides and inundation are not known to FloodGuard.",
            "No route is certified safe. 'Avoids model HIGH/CRITICAL cells' refers only to the unvalidated model grid for the analysed zone.",
        ],
        "provenance": provenance("OSRM (router.project-osrm.org) on OpenStreetMap data", kind="DERIVED", status="LIVE",
                                 url="https://project-osrm.org/"),
    }


# --------------------------------------------------------------------------- simulation

@router.get("/simulation/capabilities")
async def simulation_capabilities():
    from app.api.v1.endpoints.geo_sim import MODEL_DESCRIPTION

    return {
        "hydrodynamic_engine": {"available": True, "label": "SIMULATION", "description": MODEL_DESCRIPTION["flood"],
                                "limitations": "Uncalibrated; 30 m surface model (includes canopy); channel geometry not resolved."},
        "landslide_engine": {"available": True, "label": "SIMULATION", "description": MODEL_DESCRIPTION["landslide"],
                             "limitations": "Soil parameters are assumed/user inputs; not a validated susceptibility map."},
        "terrain_flow_routing": {"available": True, "description": "D8 flow routing on Copernicus GLO-30 (POST /geo/zone/terrain)."},
        "model_sensitivity": {"available": True, "description": "Re-run the unvalidated ML ensemble with scenario rainfall (POST /geo/predict/scenario)."},
    }


class ScenarioRequest(BaseModel):
    latitude: float
    longitude: float
    rainfall_mm: float = Field(..., ge=0, le=1500, description="Scenario rainfall total")
    duration_hours: int = Field(..., ge=1, le=72)


@router.post("/predict/scenario")
async def predict_scenario(req: ScenarioRequest, engine: InferenceEngine = Depends(get_engine)):
    """Model sensitivity: replace rainfall inputs with a scenario (uniform intensity) and re-run the model."""
    from app.services.geo.features import build_point_features

    base = await build_point_features(req.latitude, req.longitude)
    X = base["vector"].copy()
    intensity = req.rainfall_mm / req.duration_hours
    idx = {n: i for i, n in enumerate(FEATURE_NAMES)}
    observed_72 = X[0, idx["rainfall_72h_mm"]]
    X[0, idx["rainfall_1h_mm"]] = intensity
    X[0, idx["rainfall_6h_mm"]] = intensity * min(6, req.duration_hours)
    X[0, idx["rainfall_24h_mm"]] = intensity * min(24, req.duration_hours)
    X[0, idx["rainfall_72h_mm"]] = max(observed_72, intensity * min(72, req.duration_hours))
    baseline = await engine.predict(base["vector"], FEATURE_NAMES, use_ensemble=True)
    scen = await engine.predict(X, FEATURE_NAMES, use_ensemble=True)

    def prob(res):
        p = res["probabilities"][0]
        return float(p[1] if isinstance(p, list) and len(p) > 1 else p)

    pb, ps = prob(baseline), prob(scen)
    return {
        "scenario": req.model_dump(),
        "baseline_probability": round(pb, 4),
        "scenario_probability": round(ps, 4),
        "baseline_level": analysis.risk_level(pb),
        "scenario_level": analysis.risk_level(ps),
        "scenario_inputs": {n: round(float(X[0, i]), 2) for n, i in idx.items() if n.startswith("rainfall")},
        "imputed_features": base["imputed"],
        "model": model_provenance(),
        "note": "Model sensitivity only: same location, rainfall features replaced by the scenario. No inundation, depth or impact is simulated.",
    }


# --------------------------------------------------------------------------- assistant

class AssistantRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    context: Dict[str, Any] = Field(default_factory=dict)


def _fmt(v: Any, unit: str = "") -> str:
    if v is None:
        return "unavailable"
    if isinstance(v, float):
        v = round(v, 1)
    return f"{v}{(' ' + unit) if unit else ''}"


def grounded_answer(q: str, ctx: Dict[str, Any], scenario: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Deterministic explainer. Every sentence is built from fields present in ctx."""
    ql = q.lower()
    pred = ctx.get("prediction") or {}
    zone = ctx.get("zone") or {}
    impact = ctx.get("impact") or {}
    weather = ctx.get("weather") or {}
    alerts_ctx = ctx.get("alerts")
    facilities = ctx.get("nearby_facilities") or []
    lines: List[str] = []
    used: List[str] = []

    def model_caveat():
        m = pred.get("model_provenance") or (zone.get("risk") or {}).get("model") or {}
        if m.get("warning"):
            lines.append(f"**Caveat:** {m['warning']}")

    wants_why = any(k in ql for k in ("why", "factor", "cause", "driv", "explain", "risk"))
    wants_people = any(k in ql for k in ("people", "population", "exposed", "expos", "how many", "impact", "building"))
    wants_shelter = any(k in ql for k in ("shelter", "evacu", "hospital", "school", "refuge", "safe"))
    wants_rain_up = any(k in ql for k in ("rain", "increase", "what if", "what happens", "more rain", "scenario"))
    wants_areas = any(k in ql for k in ("high-risk", "high risk", "show", "where", "areas", "zones"))

    if pred and (wants_why or not any([wants_people, wants_shelter, wants_rain_up, wants_areas])):
        used.append("prediction")
        loc = pred.get("location", {})
        lines.append(
            f"The FloodGuard model returned **{pred.get('risk_level')}** (probability {_fmt(pred.get('risk_probability'))}, "
            f"score {pred.get('risk_score')}/100) for {loc.get('latitude', 0):.4f}, {loc.get('longitude', 0):.4f} "
            f"at {pred.get('timestamp', '')[:16]} UTC. Data quality: **{pred.get('data_quality')}**."
        )
        if "high" in ql and pred.get("risk_level") not in ("HIGH", "CRITICAL"):
            lines.append(f"**This location is not rated high risk by the model ({pred.get('risk_level')})**, so the premise of the question is not supported by FloodGuard's data.")
        feats = {f["name"]: f for f in pred.get("features", [])}
        if feats:
            parts = []
            for n in ("rainfall_24h_mm", "rainfall_72h_mm", "slope_deg", "elevation_m", "twi", "landcover_class", "population_density_per_km2"):
                f = feats.get(n)
                if f:
                    val = f["value"] if f["value"] is not None else f"imputed {f['model_input']}"
                    parts.append(f"{f['label']}: {val}{(' ' + f['unit']) if f['unit'] and f['value'] is not None else ''}")
            lines.append("Inputs used: " + "; ".join(parts) + ".")
        cf = pred.get("contributing_factors") or []
        if cf:
            top = ", ".join(f"{c.get('label') or c.get('feature')} ({c.get('importance', 0):.2f})" for c in cf[:5])
            lines.append(f"Most influential inputs for this model overall ({pred.get('explanation_method', 'global feature importance')}): {top}. "
                         "These are model-wide importances, not a per-location attribution.")
        if pred.get("imputed_features"):
            lines.append(f"Imputed (source unavailable): {', '.join(pred['imputed_features'])}.")
        model_caveat()

    zr = zone.get("risk") or {}
    if (wants_areas or wants_why) and zr.get("available"):
        used.append("zone_risk")
        dist = zr.get("distribution", {})
        hot = dist.get("HIGH", 0) + dist.get("CRITICAL", 0)
        mode = " under the rainfall scenario" if zr.get("mode") == "SCENARIO" else ""
        lines.append(f"Across the operational zone **{zone.get('name', 'selected zone')}**, the model grid{mode} has "
                     + ", ".join(f"{v} {k}" for k, v in sorted(dist.items(), key=lambda kv: -kv[1]))
                     + f" cells (max probability {_fmt(zr.get('max_probability'))}).")
        if hot:
            lines.append(f"{hot} cell(s) are HIGH/CRITICAL; they are outlined orange/red on the map.")
        elif "high" in ql:
            if ctx.get("simulation"):
                lines.append("The (unvalidated) ML risk grid does not rate any cell HIGH or CRITICAL; the hazard picture below comes from the scenario SIMULATION instead.")
            else:
                lines.append("**The current model output does not rate any part of this zone as HIGH or CRITICAL**, so the premise of the question is not supported by FloodGuard's data.")
        warn = (zr.get("model") or {}).get("warning")
        if warn and "prediction" not in used:
            lines.append(f"**Caveat:** {warn}")
    zt = zone.get("terrain") or {}
    if wants_why and zt.get("stats"):
        s = zt["stats"]
        used.append("zone_terrain")
        lines.append(f"Terrain in the zone (Copernicus GLO-30): elevation {_fmt(s.get('elevation_min_m'))}–{_fmt(s.get('elevation_max_m'), 'm')}, "
                     f"relief {_fmt(s.get('relief_m'), 'm')}, mean slope {_fmt(s.get('slope_mean_deg'), '°')}, "
                     f"{_fmt(s.get('area_steeper_than_30deg_pct'), '%')} of the area steeper than 30°, largest contributing drainage area "
                     f"{_fmt(s.get('max_contributing_area_km2'), 'km²')}. Steep, high-relief catchments concentrate runoff quickly — a terrain fact, independent of the model.")

    if wants_people:
        z = impact.get("zone") or {}
        hr = impact.get("high_risk") or {}
        if z or hr:
            used.append("impact")
            if z:
                lines.append(f"Within the zone: HRSL population ≈ {_fmt(z.get('population_hrsl'))}, "
                             f"{_fmt(z.get('buildings'))} mapped OSM buildings, {_fmt(z.get('road_length_km'), 'km')} of roads, {_fmt(z.get('bridges'))} mapped bridges.")
            if hr.get("cells"):
                lines.append(f"Inside model HIGH/CRITICAL cells ({_fmt(hr.get('area_km2'), 'km²')}): ≈ {_fmt(hr.get('population_hrsl'))} people (HRSL), "
                             f"{_fmt(hr.get('buildings'))} buildings, {_fmt(hr.get('road_length_km'), 'km')} of road, {_fmt(hr.get('bridges'))} bridges, "
                             f"{len(hr.get('facilities') or [])} facilities.")
            elif hr.get("note"):
                lines.append(hr["note"])
            if zone.get("worldpop"):
                lines.append(f"WorldPop 2020 cross-check for the zone: ≈ {_fmt(zone['worldpop'])} people.")
            lines.append("These are modelled residential population estimates, not a live head-count, and exposure is to modelled risk — no flood extent is simulated.")
        else:
            lines.append("No exposure figures are available yet — select an operational zone and run the analysis first.")

    if wants_shelter:
        if facilities:
            used.append("facilities")
            lines.append("Nearest mapped facilities (OpenStreetMap): " + "; ".join(
                f"{f.get('name') or f.get('category')} ({f.get('category')}, {_fmt(f.get('distance_km'), 'km')})" for f in facilities[:6]) + ".")
        lines.append("FloodGuard has no official relief-camp list for Wayanad; none of these are verified as designated shelters. Follow instructions from the District Emergency Operations Centre (dial 1077) and KSDMA.")

    if wants_rain_up and scenario:
        used.append("scenario")
        lines.append(f"Model sensitivity: with {scenario['scenario']['rainfall_mm']} mm over {scenario['scenario']['duration_hours']} h at this point, "
                     f"the model output moves from {scenario['baseline_probability']} ({scenario['baseline_level']}) to "
                     f"{scenario['scenario_probability']} ({scenario['scenario_level']}). {scenario['note']}")
        if scenario["scenario_probability"] < scenario["baseline_probability"]:
            lines.append("**Warning:** the model's probability *falls* as rainfall rises. That is physically implausible and is why the model "
                         "fails FloodGuard's rainfall sanity check — do not use this output for decisions.")
    elif wants_rain_up:
        rr = (weather.get("rainfall_recent") or {})
        rf = (weather.get("rainfall_forecast") or {})
        if rr or rf:
            used.append("weather")
            lines.append(f"Rainfall (Open-Meteo model): last 24 h {_fmt(rr.get('rain_24h_mm'), 'mm')}, last 72 h {_fmt(rr.get('rain_72h_mm'), 'mm')}; "
                         f"forecast next 24 h {_fmt(rf.get('next_24h_mm'), 'mm')} ({rf.get('imd_category_24h') or 'n/a'}).")
        lines.append("Select a location to run a rainfall scenario through the model.")

    simc = ctx.get("simulation") or {}
    if simc and (wants_why or wants_people or wants_rain_up or wants_areas):
        used.append("simulation")
        fl = simc.get("flood") or {}
        ls = simc.get("landslide") or {}
        p = simc.get("params") or {}
        parts = [f"**{simc.get('label', 'SIMULATION')}** — scenario “{simc.get('scenario')}”: {p.get('rainfall_mm')} mm over {p.get('duration_h')} h on this zone's real terrain."]
        if fl:
            parts.append(f"The 2D flood model gives a peak flooded area of {_fmt(fl.get('peak_flooded_km2'), 'km²')} at T+{_fmt(fl.get('peak_time_h'), 'h')}, "
                         f"maximum simulated depth {_fmt(fl.get('max_depth_m'), 'm')}, about {_fmt(fl.get('people_exposed_peak'))} people (HRSL estimate) in water deeper than 0.15 m, "
                         f"{_fmt(fl.get('buildings_wet'))} mapped buildings wetted and {_fmt(fl.get('roads_impassable'))} road segments deeper than 0.3 m.")
        if ls:
            parts.append(f"The slope-stability model marks {_fmt(ls.get('unstable_area_km2'), 'km²')} as unstable (factor of safety < 1) in {_fmt(ls.get('failure_clusters'))} clusters, "
                         f"with debris runout up to {_fmt((ls.get('max_runout_m') or 0) / 1000, 'km')} and {_fmt(ls.get('roads_blocked'))} road segments in debris corridors.")
        parts.append("Why: steep, high-relief catchments concentrate runoff quickly into narrow valley floors where settlements and roads sit; saturated soils on steep slopes lose strength. "
                     "These numbers come from an uncalibrated what-if simulation with assumed soil parameters — not a forecast.")
        lines.extend(parts)

    if alerts_ctx is not None:
        used.append("alerts")
        if alerts_ctx:
            lines.append(f"{len(alerts_ctx)} active official SACHET alert(s) cover Wayanad: " + "; ".join(a.get("event") or a.get("headline", "")[:60] for a in alerts_ctx[:3]) + ".")
        else:
            lines.append("No active official SACHET (NDMA) alert covers Wayanad right now — that is not a statement that conditions are safe.")

    if not lines:
        lines.append("I don't have structured data for that yet. Select a location (prediction) or an operational zone (terrain, risk, exposure) and ask again.")
    return {"answer": "\n\n".join(lines), "grounded_on": sorted(set(used)), "engine": "floodguard-grounded-explainer"}


async def claude_answer(q: str, ctx: Dict[str, Any], fallback: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Optional: phrase the answer with Claude, strictly from the supplied JSON. Needs ANTHROPIC_API_KEY + anthropic SDK."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic
    except ImportError:
        logger.info("anthropic SDK not installed; using grounded explainer")
        return None
    client = anthropic.AsyncAnthropic()
    system = (
        "You are the FloodGuard Wayanad situational-awareness assistant. Answer ONLY from the JSON context provided. "
        "Never invent numbers, locations, alerts, shelters or predictions. If the context lacks the data, say it is unavailable. "
        "Always keep caveats that appear in the context (e.g. model trained on synthetic data, estimated populations, "
        "no simulated flood extent). Be concise and operational; use markdown bullets where helpful."
    )
    try:
        resp = await client.beta.messages.create(
            model="claude-opus-5-5",
            max_tokens=4000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium"},
            system=system,
            messages=[{"role": "user", "content": f"Context JSON:\n```json\n{json.dumps(ctx, default=str)[:150000]}\n```\n\n"
                                                  f"Deterministic summary already computed from this context:\n{fallback['answer']}\n\nQuestion: {q}"}],
        )
    except anthropic.APIStatusError as exc:
        logger.warning("Claude API error %s: %s", exc.status_code, exc.message)
        return None
    except anthropic.APIConnectionError as exc:
        logger.warning("Claude API connection error: %s", exc)
        return None
    except Exception as exc:  # noqa: BLE001 - optional path; e.g. an SDK version without these params
        logger.warning("Claude phrasing unavailable, using grounded explainer: %s", exc)
        return None
    if resp.stop_reason == "refusal":
        return None
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    if not text:
        return None
    return {"answer": text, "grounded_on": fallback["grounded_on"], "engine": resp.model}


@router.post("/assistant")
async def assistant(req: AssistantRequest, engine: InferenceEngine = Depends(get_engine)):
    ctx = req.context
    scenario = None
    ql = req.question.lower()
    loc = (ctx.get("prediction") or {}).get("location")
    if loc and any(k in ql for k in ("increase", "what if", "what happens", "more rain", "scenario")):
        import re

        m = re.search(r"(\d{2,4})\s*mm", ql)
        h = re.search(r"(\d{1,2})\s*(h|hr|hour)", ql)
        try:
            scenario = await predict_scenario(ScenarioRequest(
                latitude=loc["latitude"], longitude=loc["longitude"],
                rainfall_mm=float(m.group(1)) if m else 100.0, duration_hours=int(h.group(1)) if h else 6,
            ), engine)
        except Exception as exc:  # noqa: BLE001
            logger.info("scenario in assistant failed: %s", exc)
    base = grounded_answer(req.question, ctx, scenario)
    llm = await claude_answer(req.question, {**ctx, "scenario": scenario}, base)
    result = llm or base
    return {**result, "scenario": scenario, "generated_at": utcnow_iso(),
            "disclaimer": "Explains FloodGuard's structured data only. It does not make independent flood predictions. For emergencies call 1077 (District EOC) / 112."}


# --------------------------------------------------------------------------- risk signs (model at places)

class SignPoint(BaseModel):
    id: str
    name: str
    lon: float
    lat: float


class SignsRequest(BaseModel):
    points: List[SignPoint] = Field(..., max_length=24)


@router.post("/risk-signs")
async def risk_signs(req: SignsRequest, engine: InferenceEngine = Depends(get_engine)):
    """Run the production model at named places (real inputs) for map-anchored risk signs."""
    import asyncio

    from app.services.geo.features import build_point_features

    sem = asyncio.Semaphore(4)

    async def one(p: SignPoint):
        async with sem:
            try:
                built = await build_point_features(p.lat, p.lon)
                res = await engine.predict(built["vector"], FEATURE_NAMES, use_ensemble=True)
                pr = res["probabilities"][0]
                prob = float(pr[1] if isinstance(pr, list) and len(pr) > 1 else pr)
                return {"id": p.id, "name": p.name, "lon": p.lon, "lat": p.lat, "probability": round(prob, 4),
                        "risk_level": analysis.risk_level(prob), "data_quality": built["data_quality"],
                        "rain_24h_mm": next((f["value"] for f in built["features"] if f["name"] == "rainfall_24h_mm"), None),
                        "timestamp": utcnow_iso()}
            except Exception as exc:  # noqa: BLE001
                return {"id": p.id, "name": p.name, "lon": p.lon, "lat": p.lat, "error": str(exc)}

    results = await asyncio.gather(*(one(p) for p in req.points))
    return {"signs": results, "horizon_hours": 24, "model": model_provenance(),
            "label": "MODEL · UNVALIDATED", "generated_at": utcnow_iso()}
