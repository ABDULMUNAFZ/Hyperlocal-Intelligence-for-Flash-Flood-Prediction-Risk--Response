"""
OpenStreetMap feature extraction for an operational zone (Overpass API).

Building heights are reported with explicit provenance:
  SOURCE     — OSM `height` tag (as mapped by contributors; not independently verified)
  ESTIMATED  — derived from `building:levels` × 3.0 m
  UNAVAILABLE— no height information; a 3.5 m placeholder is used only for 3D display
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry

from app.services.geo.common import TTLCache, get_client, haversine_m, provenance, utcnow_iso

logger = logging.getLogger(__name__)

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
OSM_SOURCE = "OpenStreetMap contributors (ODbL) via Overpass API"
LEVEL_HEIGHT_M = 3.0
PLACEHOLDER_HEIGHT_M = 3.5
MAX_ZONE_KM2 = 40.0

_zone_cache = TTLCache("osm_zone", ttl_seconds=7 * 24 * 3600, persist=True, max_items=200)

RESIDENTIAL = {"house", "residential", "detached", "bungalow", "semidetached_house", "terrace", "hut", "cabin", "dormitory", "static_caravan"}
APARTMENTS = {"apartments", "flats"}
COMMERCIAL = {"commercial", "retail", "shop", "office", "hotel", "supermarket", "kiosk", "mall", "restaurant"}
INDUSTRIAL = {"industrial", "warehouse", "factory", "manufacture", "storage_tank", "service"}
EDUCATION = {"school", "college", "university", "kindergarten"}
HEALTH = {"hospital", "clinic"}
RELIGIOUS = {"church", "mosque", "temple", "religious", "chapel", "shrine", "cathedral"}
GOVERNMENT = {"government", "public", "civic", "townhall", "police", "fire_station", "military", "courthouse", "post_office"}
AGRICULTURE = {"farm", "farm_auxiliary", "barn", "shed", "greenhouse", "cowshed", "stable", "sty"}


def classify_building(tags: Dict[str, str]) -> str:
    b = (tags.get("building") or "").lower()
    amenity = (tags.get("amenity") or "").lower()
    if amenity in ("hospital", "clinic") or b in HEALTH:
        return "hospital"
    if amenity in ("school", "college", "university", "kindergarten") or b in EDUCATION:
        return "school"
    if amenity == "police" or b == "police":
        return "police"
    if amenity == "fire_station" or b == "fire_station":
        return "fire_station"
    if amenity == "place_of_worship" or b in RELIGIOUS:
        return "religious"
    if b in GOVERNMENT or amenity in ("townhall", "courthouse", "post_office"):
        return "government"
    if amenity in ("community_centre", "social_facility") or b in ("community_centre",):
        return "community"
    if b in APARTMENTS:
        return "apartments"
    if b in RESIDENTIAL:
        return "residential"
    if b in COMMERCIAL or "shop" in tags:
        return "commercial"
    if b in INDUSTRIAL:
        return "industrial"
    if b in AGRICULTURE:
        return "agricultural"
    if b == "roof":
        return "roof"
    return "unclassified"


_NUM = re.compile(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*(m|metre|meter|meters|metres)?\s*$", re.I)


def parse_height(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    m = _NUM.match(value)
    if not m:
        return None
    h = float(m.group(1))
    return h if 0 < h < 300 else None


def building_height(tags: Dict[str, str]) -> Dict[str, Any]:
    h = parse_height(tags.get("height"))
    levels_raw = tags.get("building:levels")
    try:
        levels = float(levels_raw) if levels_raw else None
        if levels is not None and not (0 < levels < 100):
            levels = None
    except ValueError:
        levels = None
    min_h = parse_height(tags.get("min_height")) or 0.0
    if h is not None:
        return {"height_m": h, "render_height_m": h, "min_height_m": min_h, "levels": levels,
                "height_status": "SOURCE", "height_source": "OSM height tag"}
    if levels is not None:
        est = round(levels * LEVEL_HEIGHT_M, 1)
        return {"height_m": est, "render_height_m": est, "min_height_m": min_h, "levels": levels,
                "height_status": "ESTIMATED", "height_source": f"Estimated: building:levels ({levels:g}) × {LEVEL_HEIGHT_M} m"}
    return {"height_m": None, "render_height_m": PLACEHOLDER_HEIGHT_M, "min_height_m": 0.0, "levels": None,
            "height_status": "UNAVAILABLE", "height_source": f"No height or levels in OSM — drawn at {PLACEHOLDER_HEIGHT_M} m placeholder"}


async def overpass(query: str, timeout: int = 90) -> Dict[str, Any]:
    last: Optional[Exception] = None
    for url in OVERPASS_URLS:
        try:
            r = await get_client().post(url, data={"data": query}, timeout=timeout + 15)
            if r.status_code == 200:
                return r.json()
            last = RuntimeError(f"{url} HTTP {r.status_code}")
        except Exception as exc:  # noqa: BLE001
            last = exc
        logger.info("Overpass mirror failed: %s", last)
    raise RuntimeError(f"Overpass unavailable: {last}")


def _line_length_in(geom: BaseGeometry, coords: List[Tuple[float, float]]) -> float:
    line = LineString(coords)
    clipped = line.intersection(geom)
    total = 0.0
    parts = getattr(clipped, "geoms", [clipped])
    for part in parts:
        if part.is_empty or part.geom_type != "LineString":
            continue
        cs = list(part.coords)
        for (x1, y1), (x2, y2) in zip(cs, cs[1:]):
            total += haversine_m(x1, y1, x2, y2)
    return total


ROAD_GROUPS = {
    "motorway": "Highway", "trunk": "Highway", "primary": "Major road", "secondary": "Major road",
    "tertiary": "District road", "unclassified": "Local road", "residential": "Local road",
    "service": "Service road", "living_street": "Local road", "track": "Track",
    "path": "Path / footway", "footway": "Path / footway", "steps": "Path / footway", "bridleway": "Path / footway",
}

FACILITY_AMENITIES = {
    "hospital": "hospital", "clinic": "clinic", "doctors": "clinic", "school": "school",
    "college": "school", "kindergarten": "school", "university": "school",
    "police": "police", "fire_station": "fire_station", "townhall": "government",
    "community_centre": "community",
}


async def zone_features(geom: BaseGeometry) -> Dict[str, Any]:
    """Fetch buildings, roads, bridges, waterways and facilities intersecting the zone."""
    area_km2 = geom_area_km2(geom)
    if area_km2 > MAX_ZONE_KM2:
        return {"available": False, "reason": f"Zone is {area_km2:.1f} km²; building-level extraction is limited to {MAX_ZONE_KM2:.0f} km². Draw a smaller micro-zone."}
    min_lon, min_lat, max_lon, max_lat = geom.bounds
    bbox = f"{min_lat:.6f},{min_lon:.6f},{max_lat:.6f},{max_lon:.6f}"
    query = f"""
[out:json][timeout:90];
(
  way["building"]({bbox});
  way["highway"]({bbox});
  way["waterway"]({bbox});
  nwr["amenity"~"^(hospital|clinic|doctors|school|college|kindergarten|university|police|fire_station|townhall|community_centre)$"]({bbox});
);
out geom tags qt;
"""
    key = TTLCache.key("zone", round(min_lon, 5), round(min_lat, 5), round(max_lon, 5), round(max_lat, 5))

    async def fetch() -> Dict[str, Any]:
        data = await overpass(query)
        return {"retrieved_at": utcnow_iso(), "osm_base": data.get("osm3s", {}).get("timestamp_osm_base"), "elements": data.get("elements", [])}

    try:
        raw = await _zone_cache.get_or_create(key, fetch)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Overpass zone fetch failed: %s", exc)
        return {"available": False, "reason": f"OpenStreetMap Overpass API unavailable: {exc}",
                "provenance": provenance(OSM_SOURCE, kind="STATIC_DATASET", status="UNAVAILABLE")}

    prepared = geom
    buildings, roads, waterways, facilities = [], [], [], []
    type_counts: Dict[str, int] = {}
    height_counts = {"SOURCE": 0, "ESTIMATED": 0, "UNAVAILABLE": 0}
    road_len: Dict[str, float] = {}
    bridges = []
    for el in raw["elements"]:
        tags = el.get("tags", {})
        if el["type"] == "way" and "geometry" in el:
            coords = [(p["lon"], p["lat"]) for p in el["geometry"]]
            if "building" in tags and len(coords) >= 4 and coords[0] == coords[-1]:
                poly = Polygon(coords)
                if not poly.is_valid:
                    poly = poly.buffer(0)
                if poly.is_empty or not prepared.intersects(poly.centroid):
                    continue
                btype = classify_building(tags)
                h = building_height(tags)
                type_counts[btype] = type_counts.get(btype, 0) + 1
                height_counts[h["height_status"]] += 1
                c = poly.centroid
                buildings.append({
                    "type": "Feature", "id": el["id"],
                    "properties": {
                        "osm_id": el["id"], "osm_type": "way", "building_type": btype,
                        "building_tag": tags.get("building"), "name": tags.get("name"),
                        "amenity": tags.get("amenity"), "footprint_m2": round(geom_area_m2(poly), 1),
                        "centroid": [round(c.x, 6), round(c.y, 6)], **h,
                    },
                    "geometry": mapping(poly),
                })
            elif "highway" in tags and len(coords) >= 2:
                length = _line_length_in(prepared, coords)
                if length <= 0:
                    continue
                group = ROAD_GROUPS.get(tags["highway"], "Other")
                road_len[group] = road_len.get(group, 0.0) + length
                props = {"osm_id": el["id"], "highway": tags["highway"], "class": group, "name": tags.get("name"),
                         "ref": tags.get("ref"), "surface": tags.get("surface"), "bridge": tags.get("bridge") == "yes",
                         "length_in_zone_m": round(length, 1)}
                roads.append({"type": "Feature", "id": el["id"], "properties": props, "geometry": {"type": "LineString", "coordinates": coords}})
                if tags.get("bridge") == "yes":
                    mid = coords[len(coords) // 2]
                    bridges.append({"type": "Feature", "id": el["id"], "properties": {**props, "category": "bridge"},
                                    "geometry": {"type": "Point", "coordinates": list(mid)}})
            elif "waterway" in tags and len(coords) >= 2:
                if not prepared.intersects(LineString(coords)):
                    continue
                waterways.append({"type": "Feature", "id": el["id"],
                                  "properties": {"osm_id": el["id"], "waterway": tags["waterway"], "name": tags.get("name"),
                                                 "intermittent": tags.get("intermittent")},
                                  "geometry": {"type": "LineString", "coordinates": coords}})
        amen = tags.get("amenity")
        if amen in FACILITY_AMENITIES:
            if el["type"] == "node":
                pt = (el["lon"], el["lat"])
            elif "geometry" in el and el["geometry"]:
                xs = [p["lon"] for p in el["geometry"]]
                ys = [p["lat"] for p in el["geometry"]]
                pt = (sum(xs) / len(xs), sum(ys) / len(ys))
            elif "bounds" in el:
                b = el["bounds"]
                pt = ((b["minlon"] + b["maxlon"]) / 2, (b["minlat"] + b["maxlat"]) / 2)
            else:
                continue
            if not prepared.contains(Point(pt)):
                continue
            facilities.append({"type": "Feature", "id": el["id"],
                               "properties": {"osm_id": el["id"], "osm_type": el["type"], "category": FACILITY_AMENITIES[amen],
                                              "amenity": amen, "name": tags.get("name"), "operator": tags.get("operator")},
                               "geometry": {"type": "Point", "coordinates": list(pt)}})

    fac_counts: Dict[str, int] = {}
    for f in facilities:
        fac_counts[f["properties"]["category"]] = fac_counts.get(f["properties"]["category"], 0) + 1

    return {
        "available": True,
        "zone_area_km2": round(area_km2, 3),
        "buildings": {"type": "FeatureCollection", "features": buildings},
        "roads": {"type": "FeatureCollection", "features": roads},
        "bridges": {"type": "FeatureCollection", "features": bridges},
        "waterways": {"type": "FeatureCollection", "features": waterways},
        "facilities": {"type": "FeatureCollection", "features": facilities},
        "summary": {
            "building_count": len(buildings),
            "building_types": dict(sorted(type_counts.items(), key=lambda kv: -kv[1])),
            "building_height_status": height_counts,
            "road_length_km": {k: round(v / 1000, 2) for k, v in sorted(road_len.items(), key=lambda kv: -kv[1])},
            "road_length_total_km": round(sum(road_len.values()) / 1000, 2),
            "bridge_count": len(bridges),
            "facility_counts": fac_counts,
            "waterway_count": len(waterways),
        },
        "provenance": provenance(OSM_SOURCE, kind="STATIC_DATASET", status="RECENT", retrieved_at=raw["retrieved_at"],
                                 reference=f"OSM database timestamp {raw.get('osm_base')}",
                                 url="https://www.openstreetmap.org/copyright",
                                 notes="Counts reflect what is mapped in OpenStreetMap; unmapped buildings are not included."),
    }


def geom_area_m2(geom: BaseGeometry) -> float:
    """Approximate geodesic area using a local equirectangular projection (adequate for < 50 km zones)."""
    import math

    c = geom.centroid
    kx = 111_320.0 * math.cos(math.radians(c.y))
    ky = 110_574.0
    from shapely.affinity import scale

    return float(scale(geom, xfact=kx, yfact=ky, origin=(0, 0)).area)


def geom_area_km2(geom: BaseGeometry) -> float:
    return geom_area_m2(geom) / 1e6


async def building_at(lon: float, lat: float) -> Dict[str, Any]:
    """Look up the OSM building containing a point (OSM API map call on a ~40 m box)."""
    d = 0.0002
    url = f"https://api.openstreetmap.org/api/0.6/map.json?bbox={lon - d},{lat - d},{lon + d},{lat + d}"
    try:
        r = await get_client().get(url, timeout=20)
        r.raise_for_status()
        data = r.json()
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "reason": f"OSM API unavailable: {exc}"}
    nodes = {e["id"]: (e["lon"], e["lat"]) for e in data.get("elements", []) if e["type"] == "node"}
    pt = Point(lon, lat)
    best = None
    for e in data.get("elements", []):
        if e["type"] != "way" or "building" not in e.get("tags", {}):
            continue
        coords = [nodes[n] for n in e.get("nodes", []) if n in nodes]
        if len(coords) < 4:
            continue
        poly = Polygon(coords)
        if poly.is_valid and poly.buffer(0.00001).contains(pt):
            best = (e, poly)
            break
    if not best:
        return {"available": False, "reason": "No mapped OSM building at this location."}
    e, poly = best
    tags = e.get("tags", {})
    c = poly.centroid
    return {
        "available": True,
        "osm_id": e["id"],
        "osm_url": f"https://www.openstreetmap.org/way/{e['id']}",
        "building_type": classify_building(tags),
        "building_tag": tags.get("building"),
        "name": tags.get("name"),
        "tags": tags,
        "footprint_m2": round(geom_area_m2(poly), 1),
        "centroid": [round(c.x, 6), round(c.y, 6)],
        "last_edit": e.get("timestamp"),
        **building_height(tags),
        "provenance": provenance("OpenStreetMap contributors (ODbL) via OSM API", kind="STATIC_DATASET", status="LIVE",
                                 url=f"https://www.openstreetmap.org/way/{e['id']}"),
    }
