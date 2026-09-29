"""
Scenario simulation API: flash flood, shallow landslide, combined; risk-aware evacuation
routing on the simulated state. Every response is labelled SIMULATION.
"""

from __future__ import annotations

import asyncio
import heapq
import json
import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from shapely.geometry import shape

from app.services.geo import osm
from app.services.geo.common import TTLCache, haversine_m, utcnow_iso, wayanad_geometry
from app.services.geo.features import soilgrids
from app.services.geo.simulation import assumptions, simulate_flood, simulate_landslide
from app.services.geo.weather import point_weather

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/geo", tags=["Geo — scenario simulation"])

_sim_cache = TTLCache("simulations", ttl_seconds=7 * 24 * 3600, persist=True, max_items=60)

MODEL_DESCRIPTION = {
    "flood": "SCS-CN runoff (USDA TR-55) + 2D local-inertial shallow-water routing (Bates et al. 2010, LISFLOOD-FP formulation) on Copernicus GLO-30; hazard rating HR = d(v+0.5)+DF (EA/Defra FD2320).",
    "landslide": "Infinite-slope factor of safety with steady-state wetness (SHALSTAB / SINMAP) on Copernicus GLO-30; D8 runout with travel-angle stop criterion (Corominas 1996).",
}


class LandslideParams(BaseModel):
    soil_depth_m: float = Field(1.5, ge=0.3, le=5)
    cohesion_kpa: float = Field(5.0, ge=0, le=30)
    friction_deg: float = Field(30.0, ge=15, le=45)
    ksat_mm_h: float = Field(36.0, ge=1, le=500)
    reach_angle_deg: float = Field(11.0, ge=4, le=30)
    infiltration_fraction: Optional[float] = Field(None, ge=0.05, le=1.0)


class SimRequest(BaseModel):
    geometry: Dict[str, Any]
    name: Optional[str] = None
    kind: Literal["flood", "landslide", "combined"] = "flood"
    rainfall_mm: float = Field(150, ge=5, le=1200)
    duration_h: float = Field(6, ge=0.5, le=48)
    amc: Literal["auto", "I", "II", "III"] = "auto"
    scenario: str = Field("Custom scenario", max_length=80)
    demo: bool = False
    landslide: LandslideParams = LandslideParams()


def _stages(flood: Optional[dict], ls: Optional[dict], zone_km2: float) -> List[Dict[str, Any]]:
    st: List[Dict[str, Any]] = [{"key": "rain", "label": "RAIN START", "t_h": 0.0, "detail": "Scenario rainfall begins"}]
    if flood:
        fr = flood["frames"]

        def first(pred, key, label, detail):
            f = next((x for x in fr if pred(x)), None)
            st.append({"key": key, "label": label, "t_h": f["t_h"] if f else None,
                       "detail": detail if f else "Not reached in this scenario"})

        first(lambda x: x["excess_cum_mm"] > 0.5, "runoff", "RUNOFF", "Rainfall exceeds initial abstraction (SCS-CN)")
        first(lambda x: x["max_depth_m"] > 0.5, "channels", "CHANNELS RISE", "Simulated depth > 0.5 m in drainage lines")
        first(lambda x: x["flooded_km2"] > max(0.02, 0.01 * zone_km2), "lowland", "LOWLAND FLOODING", "Flooded area > 1 % of zone")
        first(lambda x: x.get("buildings_wet", 0) > 0 or x["people_exposed"] > 0, "exposure", "SETTLEMENT EXPOSURE", "Mapped buildings or HRSL population in water > 0.1–0.15 m")
        first(lambda x: x.get("roads_impassable", 0) > 0, "road", "ROAD IMPASSABLE", "Road segment with depth > 0.3 m")
        st.append({"key": "peak", "label": "MAXIMUM EXTENT", "t_h": flood["summary"]["peak_time_h"], "detail": f"{flood['summary']['peak_flooded_km2']} km² flooded"})
    if ls:
        if ls["summary"]["failure_clusters"]:
            st.append({"key": "failure", "label": "SLOPE FAILURE", "t_h": ls["t_fail_h"], "detail": f"{ls['summary']['failure_clusters']} unstable clusters (FS < 1)"})
            if ls["impacts"]["roads"]:
                st.append({"key": "blocked", "label": "ROAD BLOCKED", "t_h": ls["t_fail_h"], "detail": f"{len(ls['impacts']['roads'])} road segments in debris corridors"})
        else:
            st.append({"key": "failure", "label": "SLOPE FAILURE", "t_h": None, "detail": "No cells with FS < 1 under these parameters"})
    st = [s for s in st]
    st.sort(key=lambda s: (s["t_h"] is None, s["t_h"] if s["t_h"] is not None else 0))
    return st


async def _record(req: SimRequest, result: Dict[str, Any], zone) -> Optional[str]:
    """Persist completed run in the existing flood_simulations table (real computed values only)."""
    try:
        from geoalchemy2.shape import from_shape
        from app.db.session import async_session_maker
        from app.models.simulation import FloodSimulation, SimulationStatus

        f = result.get("flood") or {}
        fsum = f.get("summary", {})
        area = zone if zone.geom_type == "Polygon" else zone.convex_hull
        async with async_session_maker() as db:
            row = FloodSimulation(
                name=(req.name or req.scenario)[:255],
                description=f"{req.kind} scenario{' (DEMO)' if req.demo else ''}",
                status=SimulationStatus.COMPLETED,
                scenario_type="demo" if req.demo else "what_if",
                rainfall_scenario={"rainfall_mm": req.rainfall_mm, "duration_h": req.duration_h, "pattern": "uniform"},
                antecedent_conditions={"amc": (f.get("setup") or {}).get("amc", req.amc)},
                simulation_area=from_shape(area, srid=4326),
                grid_resolution_m=int((f.get("setup") or {}).get("grid_resolution_m") or (result.get("landslide") or {}).get("summary", {}).get("grid_resolution_m") or 30),
                model_type="local_inertial_2d" if f else "infinite_slope",
                solver="cpu",
                simulation_duration_hours=(f.get("setup") or {}).get("simulated_hours") or req.duration_h,
                infiltration_model="scs_cn" if f else None,
                routing_method="local_inertial" if f else None,
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                compute_time_seconds=fsum.get("compute_s"),
                max_depth_m=fsum.get("max_depth_m"),
                flooded_area_sqkm=fsum.get("peak_flooded_km2"),
                affected_population=int(fsum["people_exposed_peak"]) if fsum.get("people_exposed_peak") is not None else None,
                affected_buildings=fsum.get("buildings_wet"),
                extra_metadata={"simulation_id": result["id"], "demo": req.demo, "label": "SIMULATION"},
            )
            db.add(row)
            await db.commit()
            return str(row.id)
    except Exception as exc:  # noqa: BLE001 - recording must not break the simulation response
        logger.warning("Could not record simulation: %s", exc)
        return None


@router.post("/simulate")
async def simulate(req: SimRequest):
    try:
        zone = shape(req.geometry)
    except Exception:
        raise HTTPException(400, "Invalid geometry")
    if zone.geom_type not in ("Polygon", "MultiPolygon") or not zone.intersects(wayanad_geometry().buffer(0.05)):
        raise HTTPException(400, "Zone must be a polygon inside Wayanad")
    zone_km2 = osm.geom_area_km2(zone)
    if zone_km2 > 40:
        raise HTTPException(400, f"Zone is {zone_km2:.1f} km²; simulation is limited to 40 km² micro-zones.")

    key = TTLCache.key("sim-v5", json.dumps(req.geometry, sort_keys=True), req.model_dump(exclude={"name", "geometry"}))
    cached = _sim_cache.get(key)
    if cached:
        return cached

    c = zone.centroid
    osm_data, soil, weather = await asyncio.gather(osm.zone_features(zone), soilgrids(c.x, c.y), point_weather(c.y, c.x))
    buildings = [{"osm_id": f["properties"]["osm_id"], "centroid": f["properties"]["centroid"]}
                 for f in (osm_data.get("buildings") or {}).get("features", [])] if osm_data.get("available") else []
    roads = [{"osm_id": f["properties"]["osm_id"], "name": f["properties"].get("name"), "class": f["properties"].get("class"),
              "coords": f["geometry"]["coordinates"]}
             for f in (osm_data.get("roads") or {}).get("features", [])] if osm_data.get("available") else []

    amc = req.amc
    amc_note = "User-selected antecedent moisture class"
    if amc == "auto":
        r72 = (weather.get("rainfall_recent") or {}).get("rain_72h_mm") if weather.get("available") else None
        if r72 is None:
            amc, amc_note = "II", "AUTO: antecedent rainfall unavailable → AMC II (average)"
        else:
            amc = "III" if r72 > 53 else "I" if r72 < 36 else "II"
            amc_note = f"AUTO from Open-Meteo 72 h rainfall {r72} mm (NRCS 5-day thresholds applied to 3 days)"

    flood = ls = None
    if req.kind in ("flood", "combined"):
        flood = await asyncio.to_thread(simulate_flood, req.geometry, req.rainfall_mm, req.duration_h, amc, soil, buildings, roads)
        flood["setup"]["amc_note"] = amc_note
    if req.kind in ("landslide", "combined"):
        lp = req.landslide
        infil = lp.infiltration_fraction
        if infil is None:
            if flood:
                excess = flood["frames"][-1]["excess_cum_mm"]
                infil = max(0.05, min(1.0, 1 - excess / max(req.rainfall_mm, 1)))
            else:
                infil = 0.5
        ls = await asyncio.to_thread(simulate_landslide, req.geometry, req.rainfall_mm, req.duration_h, lp.soil_depth_m,
                                     lp.cohesion_kpa, lp.friction_deg, lp.ksat_mm_h, lp.reach_angle_deg, infil, buildings, roads)
        ls["setup"]["infiltration_fraction_source"] = "user" if lp.infiltration_fraction is not None else (
            "1 − simulated SCS-CN runoff ratio" if flood else "ASSUMED 0.5")

    sim_id = key[:16]
    result: Dict[str, Any] = {
        "id": sim_id,
        "label": "DEMO / SIMULATION" if req.demo else "SIMULATION",
        "kind": req.kind,
        "scenario": req.scenario,
        "name": req.name,
        "created_at": utcnow_iso(),
        "params": req.model_dump(exclude={"geometry"}),
        "zone_area_km2": round(zone_km2, 3),
        "models": {k: v for k, v in MODEL_DESCRIPTION.items() if (k == "flood" and flood) or (k == "landslide" and ls)},
        "flood": flood,
        "landslide": ls,
        "stages": _stages(flood, ls, zone_km2),
        "impacts_available": bool(osm_data.get("available")),
        "impacts_note": None if osm_data.get("available") else f"Building/road impacts unavailable: {osm_data.get('reason')}",
        "assumptions": assumptions(req.kind, flood["setup"] if flood else None, ls["setup"] if ls else None),
        "validated": False,
    }
    result["record_id"] = await _record(req, result, zone)
    _sim_cache.set(key, result)
    _sim_cache.set(TTLCache.key("by-id", sim_id), {"key": key, "geometry": req.geometry})
    return result


# ------------------------------------------------------------------------------ evacuation on simulated state

SPEED_KMH = {"Highway": 50, "Major road": 40, "District road": 30, "Local road": 20, "Service road": 15, "Track": 10, "Path / footway": 4, "Other": 15}


class SimRouteRequest(BaseModel):
    origin: List[float] = Field(..., min_length=2, max_length=2)
    candidates: List[Dict[str, Any]] = Field(..., max_length=8)


@router.post("/simulate/{sim_id}/routes")
async def sim_routes(sim_id: str, req: SimRouteRequest):
    ref = _sim_cache.get(TTLCache.key("by-id", sim_id))
    if not ref:
        raise HTTPException(404, "Simulation not found — run it again")
    sim = _sim_cache.get(ref["key"])
    osm_data = await osm.zone_features(shape(ref["geometry"]))
    if not osm_data.get("available"):
        raise HTTPException(503, f"Road network unavailable: {osm_data.get('reason')}")
    blocked = {}
    for r in ((sim.get("flood") or {}).get("roads") or []):
        blocked[r["osm_id"]] = f"simulated depth {r['max_depth_m']} m"
    for r in ((sim.get("landslide") or {}).get("impacts", {}).get("roads") or []):
        blocked[r["osm_id"]] = "simulated debris corridor"

    graph: Dict[tuple, List[tuple]] = {}
    for f in osm_data["roads"]["features"]:
        p = f["properties"]
        if p["osm_id"] in blocked or p.get("highway") in ("steps",):
            continue
        spd = SPEED_KMH.get(p.get("class"), 15)
        cs = [tuple(round(v, 6) for v in c) for c in f["geometry"]["coordinates"]]
        for a, b in zip(cs, cs[1:]):
            d = haversine_m(a[0], a[1], b[0], b[1])
            tmin = d / 1000 / spd * 60
            graph.setdefault(a, []).append((b, d, tmin))
            graph.setdefault(b, []).append((a, d, tmin))
    if not graph:
        return {"routes": [], "caveats": ["No usable road network in the zone after removing simulated blockages."]}
    nodes = list(graph.keys())

    def nearest(lon, lat):
        best = min(nodes, key=lambda n: (n[0] - lon) ** 2 + (n[1] - lat) ** 2)
        return best, haversine_m(lon, lat, best[0], best[1])

    src, src_gap = nearest(*req.origin)
    dist = {src: 0.0}
    prev: Dict[tuple, tuple] = {}
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, math.inf):
            continue
        for v, _, tmin in graph[u]:
            nd = d + tmin
            if nd < dist.get(v, math.inf):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))

    routes = []
    for cand in req.candidates:
        tgt, gap = nearest(cand["lon"], cand["lat"])
        if tgt not in dist or gap > 400:
            routes.append({"candidate": cand, "available": False,
                           "reason": "Not reachable on the zone road network without crossing simulated blockages" if tgt not in dist else "Destination is off the zone road network"})
            continue
        path = [tgt]
        while path[-1] != src:
            path.append(prev[path[-1]])
        path.reverse()
        length = sum(haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(path, path[1:]))
        routes.append({
            "candidate": cand, "available": True,
            "distance_km": round(length / 1000, 2), "duration_min": round(dist[tgt], 1),
            "crosses_model_high_risk": False,
            "assessment": "Avoids road segments flooded > 0.3 m or in debris corridors in this SIMULATION",
            "geometry": {"type": "LineString", "coordinates": [list(p) for p in path]},
        })
    routes.sort(key=lambda r: (not r["available"], r.get("duration_min") or 1e9))
    return {
        "routes": routes,
        "blocked_segments": len(blocked),
        "caveats": [
            "SIMULATION-based routing: segments are removed only where the scenario model shows depth > 0.3 m or a debris corridor.",
            "Travel times use nominal speeds per OSM road class, not live traffic. Real conditions may differ — follow official instructions.",
            "Destinations are OSM facilities; their designation as relief camps is NOT verified.",
        ],
        "label": "SIMULATION",
    }
