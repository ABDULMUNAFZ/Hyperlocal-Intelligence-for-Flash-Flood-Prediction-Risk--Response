#!/usr/bin/env python3
"""
Fetch real geographic reference data for the FloodGuard Wayanad command center.

Everything written by this script comes from OpenStreetMap (ODbL) via the
Overpass API and Nominatim. Nothing is invented: features that do not exist
in OSM are simply absent from the output.

Output directory: frontend/public/data/wayanad/
  boundary.geojson        Wayanad district polygon (OSM relation 2018203)
  admin_areas.geojson     Taluk / municipality / grama panchayat polygons inside Wayanad
  places.geojson          Named settlements (town, village, hamlet, suburb, locality)
  pois.geojson            Critical infrastructure & points of interest
  manifest.json           Retrieval timestamp, sources, feature counts

Usage (stdlib only):
  python3 scripts/fetch_wayanad_geodata.py            # reuse boundary/admin files if present
  python3 scripts/fetch_wayanad_geodata.py --refresh  # re-download everything
"""

from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WAYANAD_RELATION_ID = 2018203
UA = "FloodGuard/1.0 (flood situational awareness; open-data research)"
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
NOMINATIM_LOOKUP = "https://nominatim.openstreetmap.org/lookup"

OUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data" / "wayanad"


def _http(url: str, data: bytes | None = None, timeout: int = 180) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    last_err: Exception | None = None
    for attempt in range(3):
        for url in OVERPASS_URLS:
            try:
                raw = _http(url, body)
                return json.loads(raw)
            except Exception as exc:  # noqa: BLE001 - try next mirror
                last_err = exc
                print(f"  overpass {url} failed: {exc!r}", file=sys.stderr)
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"All Overpass mirrors failed: {last_err!r}")


def nominatim_polygons(relation_ids: list[int]) -> dict[int, dict]:
    """Return {relation_id: geojson geometry} using Nominatim lookup (max 50 ids/request)."""
    out: dict[int, dict] = {}
    for i in range(0, len(relation_ids), 40):
        chunk = relation_ids[i : i + 40]
        params = urllib.parse.urlencode(
            {
                "osm_ids": ",".join(f"R{r}" for r in chunk),
                "format": "geojson",
                "polygon_geojson": 1,
                "polygon_threshold": 0.0002,
            }
        )
        data = json.loads(_http(f"{NOMINATIM_LOOKUP}?{params}"))
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            if props.get("osm_type") == "relation":
                out[int(props["osm_id"])] = feat["geometry"]
        time.sleep(1.2)  # Nominatim usage policy: max 1 request / second
    return out


AREA = f"rel({WAYANAD_RELATION_ID});map_to_area->.w;"

POI_QUERY = f"""
[out:json][timeout:180];
{AREA}
(
  nwr["amenity"~"^(hospital|clinic|doctors|health_post)$"](area.w);
  nwr["healthcare"~"^(hospital|clinic|centre|doctor)$"](area.w);
  nwr["amenity"~"^(school|college|university|kindergarten)$"](area.w);
  nwr["amenity"="police"](area.w);
  nwr["amenity"="fire_station"](area.w);
  nwr["amenity"~"^(townhall|community_centre|shelter|social_facility)$"](area.w);
  nwr["emergency"~"^(assembly_point|ambulance_station|disaster_response)$"](area.w);
  nwr["office"="government"](area.w);
  nwr["government"](area.w);
  nwr["amenity"~"^(place_of_worship)$"]["name"](area.w);
  nwr["waterway"~"^(dam|weir)$"](area.w);
  nwr["man_made"~"^(dam|water_tower|reservoir_covered)$"](area.w);
  nwr["power"~"^(substation|plant|generator)$"]["name"](area.w);
  nwr["tourism"~"^(attraction|viewpoint)$"]["name"](area.w);
  node["natural"="peak"]["name"](area.w);
  way["bridge"="yes"]["highway"]["name"](area.w);
  way["bridge"="yes"]["highway"~"^(trunk|primary|secondary|tertiary)$"](area.w);
);
out center tags;
"""

PLACES_QUERY = f"""
[out:json][timeout:120];
{AREA}
(
  node["place"~"^(city|town|village|hamlet|suburb|neighbourhood|locality|isolated_dwelling)$"]["name"](area.w);
);
out body;
"""

ADMIN_QUERY = f"""
[out:json][timeout:120];
{AREA}
(
  relation["boundary"="administrative"]["admin_level"~"^(6|7|8|9|10)$"](area.w);
);
out tags;
"""


def classify_poi(tags: dict) -> str | None:
    a = tags.get("amenity", "")
    hc = tags.get("healthcare", "")
    if a in ("hospital",) or hc == "hospital":
        return "hospital"
    if a in ("clinic", "doctors", "health_post") or hc in ("clinic", "centre", "doctor"):
        return "clinic"
    if a in ("school", "kindergarten"):
        return "school"
    if a in ("college", "university"):
        return "college"
    if a == "police":
        return "police"
    if a == "fire_station":
        return "fire_station"
    # Designated emergency refuges only. amenity=shelter is usually a bus/rain shelter,
    # so it is kept as a separate, non-emergency category.
    if tags.get("emergency") == "assembly_point" or tags.get("social_facility") == "shelter":
        return "emergency_refuge"
    if a == "shelter":
        return "shelter_structure"
    if tags.get("emergency") in ("ambulance_station", "disaster_response"):
        return "emergency_service"
    if a in ("townhall", "community_centre", "social_facility"):
        return "community"
    if tags.get("office") == "government" or "government" in tags:
        return "government"
    if a == "place_of_worship":
        return "religious"
    if tags.get("waterway") == "weir":
        return "weir"
    if tags.get("waterway") == "dam" or tags.get("man_made") == "dam":
        return "dam"
    if tags.get("man_made") in ("water_tower", "reservoir_covered"):
        return "water_infrastructure"
    if "power" in tags:
        return "power"
    if tags.get("tourism") in ("attraction", "viewpoint"):
        return "tourism"
    if tags.get("natural") == "peak":
        return "peak"
    if tags.get("bridge") == "yes":
        return "bridge"
    return None


KEEP_TAGS = {
    "name", "name:en", "name:ml", "amenity", "healthcare", "operator", "operator:type",
    "beds", "emergency", "office", "government", "waterway", "man_made", "power",
    "tourism", "natural", "ele", "bridge", "highway", "building", "building:levels",
    "height", "addr:city", "addr:village", "addr:district", "phone", "website",
    "wikidata", "wikipedia", "religion", "school:type", "isced:level", "capacity",
    "shelter_type", "layer", "bridge:name",
}


def element_point(el: dict) -> tuple[float, float] | None:
    if el["type"] == "node":
        return el["lon"], el["lat"]
    c = el.get("center")
    if c:
        return c["lon"], c["lat"]
    return None


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    retrieved = datetime.now(timezone.utc).isoformat(timespec="seconds")

    skip_existing = "--refresh" not in sys.argv

    print("1/4 Wayanad district boundary (Nominatim)…")
    polys = (
        {WAYANAD_RELATION_ID: json.loads((OUT_DIR / "boundary.geojson").read_text())["features"][0]["geometry"]}
        if skip_existing and (OUT_DIR / "boundary.geojson").exists()
        else nominatim_polygons([WAYANAD_RELATION_ID])
    )
    if WAYANAD_RELATION_ID not in polys:
        print("Could not fetch Wayanad boundary", file=sys.stderr)
        return 1
    boundary = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": WAYANAD_RELATION_ID,
                "properties": {
                    "name": "Wayanad",
                    "official_name": "Wayanad District",
                    "state": "Kerala",
                    "osm_relation": WAYANAD_RELATION_ID,
                    "lgd_district_code": "567",
                    "source": "OpenStreetMap (ODbL)",
                },
                "geometry": polys[WAYANAD_RELATION_ID],
            }
        ],
    }
    (OUT_DIR / "boundary.geojson").write_text(json.dumps(boundary))

    print("2/4 Administrative subdivisions (Overpass + Nominatim)…")
    admin_path = OUT_DIR / "admin_areas.geojson"
    if skip_existing and admin_path.exists():
        admin_features = json.loads(admin_path.read_text())["features"]
        rels = {}
        geoms = {}
    else:
        admin = overpass(ADMIN_QUERY)
        rels = {e["id"]: e.get("tags", {}) for e in admin.get("elements", []) if e["type"] == "relation"}
        geoms = nominatim_polygons(sorted(rels)) if rels else {}
        admin_features = []
    for rid, tags in rels.items():
        g = geoms.get(rid)
        if not g or g.get("type") not in ("Polygon", "MultiPolygon"):
            continue
        admin_features.append(
            {
                "type": "Feature",
                "id": rid,
                "properties": {
                    "id": f"osm-rel-{rid}",
                    "name": tags.get("name:en") or tags.get("name"),
                    "name_ml": tags.get("name:ml"),
                    "admin_level": int(tags.get("admin_level", 0) or 0),
                    "designation": tags.get("designation"),
                    "lgd": tags.get("ref:LGD") or tags.get("ref:LGD:subdistrict") or tags.get("ref:LGD:local_body"),
                    "wikidata": tags.get("wikidata"),
                    "osm_relation": rid,
                    "source": "OpenStreetMap (ODbL)",
                },
                "geometry": g,
            }
        )
    admin_path.write_text(
        json.dumps({"type": "FeatureCollection", "features": admin_features})
    )

    print("3/4 Settlements (Overpass)…")
    places = overpass(PLACES_QUERY)
    place_features = []
    for el in places.get("elements", []):
        t = el.get("tags", {})
        place_features.append(
            {
                "type": "Feature",
                "id": el["id"],
                "properties": {
                    "id": f"osm-node-{el['id']}",
                    "name": t.get("name:en") or t.get("name"),
                    "name_ml": t.get("name:ml"),
                    "place": t.get("place"),
                    "population_osm": t.get("population"),
                    "population_osm_date": t.get("population:date") or t.get("source:population"),
                    "ele_osm": t.get("ele"),
                    "wikidata": t.get("wikidata"),
                    "source": "OpenStreetMap (ODbL)",
                },
                "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
            }
        )
    (OUT_DIR / "places.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": place_features})
    )

    print("4/4 Infrastructure & POIs (Overpass)…")
    pois = overpass(POI_QUERY)
    poi_features = []
    seen: set[str] = set()
    for el in pois.get("elements", []):
        tags = el.get("tags", {})
        cat = classify_poi(tags)
        pt = element_point(el)
        if not cat or not pt:
            continue
        key = f"{el['type']}-{el['id']}"
        if key in seen:
            continue
        seen.add(key)
        props = {k: v for k, v in tags.items() if k in KEEP_TAGS}
        props.update(
            {
                "id": f"osm-{key}",
                "osm_type": el["type"],
                "osm_id": el["id"],
                "category": cat,
                "source": "OpenStreetMap (ODbL)",
            }
        )
        poi_features.append(
            {"type": "Feature", "id": el["id"], "properties": props,
             "geometry": {"type": "Point", "coordinates": [pt[0], pt[1]]}}
        )
    (OUT_DIR / "pois.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": poi_features})
    )

    counts: dict[str, int] = {}
    for f in poi_features:
        counts[f["properties"]["category"]] = counts.get(f["properties"]["category"], 0) + 1

    manifest = {
        "retrieved_at": retrieved,
        "osm_relation": WAYANAD_RELATION_ID,
        "license": "Open Database License (ODbL) 1.0 — © OpenStreetMap contributors",
        "sources": {
            "boundary": "Nominatim lookup of OSM relation 2018203",
            "admin_areas": "Overpass API (admin_level 6–10 within Wayanad) + Nominatim polygons",
            "places": "Overpass API place=* nodes within Wayanad",
            "pois": "Overpass API amenity/emergency/office/waterway/power/tourism/natural/bridge within Wayanad",
        },
        "counts": {
            "admin_areas": len(admin_features),
            "places": len(place_features),
            "pois": len(poi_features),
            "pois_by_category": counts,
        },
        "notes": "Completeness reflects OpenStreetMap coverage on the retrieval date. Absent features are not mapped in OSM, not absent on the ground.",
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest["counts"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
