"""Emergency response core logic.

- Rescue state machine (who may move a request from which status to which)
- PostGIS spatial targeting of alert recipients
- Web Push (VAPID) sending via pywebpush
- Safe-location search (shelters table) with real routing (OSRM) and route risk vs active alert areas
- Audit logging
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.emergency import AuditLog, RescueStatus

logger = logging.getLogger(__name__)
S = RescueStatus

# ------------------------------------------------------------------------------------ state machine

# Transitions a request's OWNER may make from each state.
USER_TRANSITIONS: Dict[Optional[S], set] = {
    None: {S.SAFE, S.NEEDS_ASSISTANCE, S.LOCATION_PINNED, S.RESCUE_REQUESTED},
    S.SAFE: {S.NEEDS_ASSISTANCE, S.LOCATION_PINNED, S.RESCUE_REQUESTED, S.EVACUATING, S.EN_ROUTE_TO_SHELTER},
    S.NEEDS_ASSISTANCE: {S.SAFE, S.LOCATION_PINNED, S.RESCUE_REQUESTED, S.EVACUATING, S.EN_ROUTE_TO_SHELTER},
    S.LOCATION_PINNED: {S.SAFE, S.NEEDS_ASSISTANCE, S.RESCUE_REQUESTED, S.EVACUATING, S.EN_ROUTE_TO_SHELTER},
    S.RESCUE_REQUESTED: {S.SAFE, S.EVACUATING, S.EN_ROUTE_TO_SHELTER},
    S.RESPONDER_ASSIGNED: {S.SAFE, S.EVACUATING, S.EN_ROUTE_TO_SHELTER, S.RESCUE_REQUESTED},
    S.EVACUATING: {S.SAFE, S.EN_ROUTE_TO_SHELTER, S.RESCUE_REQUESTED},
    S.EN_ROUTE_TO_SHELTER: {S.SAFE, S.RESCUE_REQUESTED, S.EVACUATING, S.REACHED_SAFE_LOCATION},
    S.REACHED_SAFE_LOCATION: {S.SAFE, S.RESCUE_REQUESTED, S.EN_ROUTE_TO_SHELTER},
    S.RESOLVED: set(),
}
# Transitions an authorised RESPONDER may make.
RESPONDER_TRANSITIONS: Dict[S, set] = {
    s: {S.RESPONDER_ASSIGNED, S.EVACUATING, S.RESOLVED} for s in S if s != S.RESOLVED
}
RESPONDER_TRANSITIONS[S.RESOLVED] = set()

# Statuses that still need responder attention
OPEN_STATUSES = [s.value for s in S if s not in (S.RESOLVED,)]


class TransitionError(ValueError):
    pass


def check_transition(current: Optional[str], target: S, actor: str) -> None:
    cur = S(current) if current else None
    if cur == target:
        return
    allowed = USER_TRANSITIONS.get(cur, set()) if actor == "user" else RESPONDER_TRANSITIONS.get(cur, set()) if cur else set()
    if target not in allowed:
        raise TransitionError(f"{actor} cannot change status from {cur.value if cur else 'NONE'} to {target.value}")


# ------------------------------------------------------------------------------------ geometry helpers

def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bearing_deg(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def compass(deg: float) -> str:
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int(((deg + 22.5) % 360) // 45)]


def arrival_ok(distance_m: float, accuracy_m: Optional[float]) -> Tuple[bool, float]:
    """Arrival accepted within ARRIVAL_RADIUS + GPS accuracy (accuracy credit capped at 300 m)."""
    allowance = settings.EMERGENCY_ARRIVAL_RADIUS_M + min(max(accuracy_m or 0.0, 0.0), 300.0)
    return distance_m <= allowance, allowance


def location_freshness(captured_at: Optional[datetime]) -> str:
    if captured_at is None:
        return "PERMISSION_REQUIRED"
    age = (datetime.now(timezone.utc) - captured_at).total_seconds() / 60
    return "CONNECTED" if age <= settings.EMERGENCY_LOCATION_STALE_MINUTES else "STALE"


# ------------------------------------------------------------------------------------ targeting

# Users whose consented, recent location lies inside (or within buffer of) the alert area.
TARGET_SQL = """
SELECT u.id AS user_id, ul.latitude, ul.longitude, ul.captured_at,
       ST_Distance(ul.location, a.geometry::geography) AS distance_m
FROM alerts a
JOIN user_locations ul ON ST_DWithin(ul.location, a.geometry::geography, :buffer_m)
JOIN users u ON u.id = ul.user_id AND u.is_active
WHERE a.id = :alert_id
  AND ul.captured_at > now() - make_interval(hours => :max_age_h)
"""

PREVIEW_SQL = """
WITH area AS (SELECT ST_GeomFromGeoJSON(:geojson)::geography AS g)
SELECT count(*) AS users,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = ul.user_id AND ps.is_active)) AS reachable
FROM user_locations ul
JOIN users u ON u.id = ul.user_id AND u.is_active
CROSS JOIN area
WHERE ST_DWithin(ul.location, area.g, :buffer_m)
  AND ul.captured_at > now() - make_interval(hours => :max_age_h)
"""


async def preview_targets(db: AsyncSession, geojson: Dict[str, Any], buffer_m: float = 0) -> Dict[str, int]:
    row = (await db.execute(text(PREVIEW_SQL), {"geojson": json.dumps(geojson), "buffer_m": buffer_m,
                                                  "max_age_h": settings.EMERGENCY_TARGET_LOCATION_MAX_AGE_HOURS})).mappings().one()
    return {"affected_users": int(row["users"]), "reachable_by_push": int(row["reachable"])}


# ------------------------------------------------------------------------------------ web push

def push_configured() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY and settings.VAPID_SUBJECT)


def send_web_push(endpoint: str, p256dh: str, auth: str, payload: Dict[str, Any], urgency: str = "high", ttl: int = 3600) -> Tuple[str, Optional[int], Optional[str]]:
    """Returns (status, http_status, error). status: sent | expired | failed | not_configured."""
    if not push_configured():
        return "not_configured", None, "VAPID keys are not configured"
    from pywebpush import WebPushException, webpush

    try:
        resp = webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=ttl,
            headers={"Urgency": urgency},
            timeout=15,
        )
        return "sent", getattr(resp, "status_code", 201), None
    except WebPushException as exc:
        code = getattr(exc.response, "status_code", None) if exc.response is not None else None
        if code in (404, 410):
            return "expired", code, "Subscription expired or unsubscribed"
        return "failed", code, str(exc)[:500]
    except Exception as exc:  # noqa: BLE001 - network errors etc.
        return "failed", None, str(exc)[:500]


def alert_push_payload(alert: Dict[str, Any], delivery_id: Optional[str] = None) -> Dict[str, Any]:
    kind = alert.get("kind", "RESPONDER")
    demo = bool(alert.get("is_demo"))
    title = ("DEMO EMERGENCY — NOT A REAL WARNING" if demo else
             "FLOODGUARD EMERGENCY · OFFICIAL ALERT" if kind == "OFFICIAL" else "FLOODGUARD EMERGENCY")
    hazard = (alert.get("hazard") or "flash_flood").replace("_", " ").upper()
    body = f"{hazard} {alert.get('level', '')} — {alert.get('area_name', 'Wayanad')}. {alert.get('recommended_action') or 'Open FloodGuard for instructions.'}"
    return {
        "title": title,
        "body": body[:240],
        "alert_id": alert.get("id"),
        "delivery_id": delivery_id,
        "level": alert.get("level"),
        "kind": kind,
        "is_demo": demo,
        "url": f"/emergency?alert={alert.get('id')}" + (f"&d={delivery_id}" if delivery_id else ""),
        "tag": f"floodguard-{alert.get('id')}",
    }


# ------------------------------------------------------------------------------------ safe locations

NEAREST_SQL = """
SELECT s.id, s.name, s.shelter_type, s.address, s.capacity, s.current_occupancy, s.contact_phone,
       s.has_medical, s.is_accessible, s.elevation_m, s.metadata AS meta,
       ST_X(s.geometry) AS lon, ST_Y(s.geometry) AS lat,
       ST_Distance(s.geometry::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) AS distance_m
FROM shelters s
WHERE s.is_active
ORDER BY s.geometry::geography <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
LIMIT :limit
"""


async def _osrm(client, base: str, profile: str, olon: float, olat: float, dlon: float, dlat: float) -> Optional[Dict[str, Any]]:
    url = f"{base.rstrip('/')}/route/v1/{profile}/{olon},{olat};{dlon},{dlat}"
    try:
        r = await client.get(url, params={"overview": "full", "geometries": "geojson"}, timeout=12)
        r.raise_for_status()
        d = r.json()
        if d.get("code") != "Ok" or not d.get("routes"):
            return None
        rt = d["routes"][0]
        return {"geometry": rt["geometry"], "distance_m": round(rt["distance"]), "duration_s": round(rt["duration"])}
    except Exception as exc:  # noqa: BLE001
        logger.info("routing unavailable (%s %s): %s", base, profile, exc)
        return None


async def route_osrm(client, olon: float, olat: float, dlon: float, dlat: float) -> Optional[Dict[str, Any]]:
    """Real road-network route. Walking (foot profile) first — evacuation is usually on foot — then driving.
    Returns None when no routing service answers: callers must then show ROUTING DATA UNAVAILABLE."""
    if settings.ROUTING_FOOT_BASE_URL:
        rt = await _osrm(client, settings.ROUTING_FOOT_BASE_URL, "foot", olon, olat, dlon, dlat)
        if rt:
            return {**rt, "profile": "foot", "source": "OSRM foot profile (OpenStreetMap paths & roads)"}
    if settings.ROUTING_BASE_URL:
        rt = await _osrm(client, settings.ROUTING_BASE_URL, "driving", olon, olat, dlon, dlat)
        if rt:
            return {**rt, "profile": "driving", "source": "OSRM driving profile (OpenStreetMap roads)"}
    return None


ROUTE_RISK_SQL = """
SELECT max(CASE WHEN a.severity IN ('EXTREME','SEVERE') THEN 3 WHEN a.severity = 'WARNING' THEN 2 WHEN a.severity = 'WATCH' THEN 1 ELSE 0 END) AS worst,
       bool_or(coalesce((a.metadata->>'is_demo')::boolean, false)) AS any_demo
FROM alerts a
WHERE a.status = 'ACTIVE' AND a.expires > now() AND a.geometry IS NOT NULL
  AND ST_Intersects(a.geometry, ST_SetSRID(ST_GeomFromGeoJSON(:line), 4326))
"""


async def route_risk(db: AsyncSession, geometry: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Risk along a route = worst active alert area it crosses. Unknown when there is no route."""
    if not geometry:
        return {"level": "UNKNOWN", "basis": "No route geometry (routing unavailable)"}
    row = (await db.execute(text(ROUTE_RISK_SQL), {"line": json.dumps(geometry)})).mappings().one()
    worst = row["worst"]
    if worst is None:
        return {"level": "LOW", "basis": "Route crosses no active alert area"}
    level = {3: "HIGH", 2: "HIGH", 1: "MODERATE", 0: "LOW"}[int(worst)]
    return {"level": level, "basis": "Route crosses an active alert area" + (" (includes DEMO alerts)" if row["any_demo"] else "")}


# ------------------------------------------------------------------------------------ region + shelter designation

async def wayanad_region_id(db: AsyncSession) -> str:
    """The shelters table requires a region; ensure a Wayanad district row exists (from the OSM boundary)."""
    row = (await db.execute(text("SELECT id FROM regions WHERE level = 2 AND district_code = '567' LIMIT 1"))).first()
    if row:
        return str(row[0])
    from app.services.geo.common import DATA_DIR

    fc = json.loads((DATA_DIR / "wayanad_boundary.geojson").read_text())
    geom = fc["features"][0]["geometry"]
    rid = (await db.execute(text("""
        INSERT INTO regions (id, name, name_local, level, state_code, district_code, geometry, centroid, metadata, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Wayanad', 'വയനാട്', 2, 'KL', '567',
                ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:g), 4326)),
                ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON(:g), 4326))::geography,
                '{"source": "OpenStreetMap relation 2018203", "lgd_district_code": "567"}'::jsonb, now(), now())
        RETURNING id"""), {"g": json.dumps(geom)})).scalar_one()
    await db.commit()
    return str(rid)


# ------------------------------------------------------------------------------------ audit

async def audit(db: AsyncSession, actor_id, action: str, target_type: str = None, target_id: str = None,
                ip: str = None, details: Dict[str, Any] = None, commit: bool = True) -> None:
    db.add(AuditLog(actor_user_id=actor_id, action=action, target_type=target_type,
                    target_id=str(target_id) if target_id else None, ip=ip, details=details))
    if commit:
        await db.commit()
