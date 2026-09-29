"""
Emergency user + rescue response API.

Citizen (authenticated user) endpoints operate only on the caller's own data.
Responder endpoints (/rescue/*, safe-location management) require role admin or
disaster_manager, and every access to personal data is written to audit_logs.
Locations are only ever sent in request bodies (never in URLs).
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_active_user
from app.api.v1.endpoints.live import PUBLIC, RESPONDER_ROLES, RESPONDERS, broker, require_responder
from app.core.config import settings
from app.db.session import get_db
from app.models.core import User
from app.models.emergency import (
    EmergencyProfile, PushSubscription, RescueRequest, RescueStatus, RescueStatusHistory, UserLocation,
)
from app.services.emergency import core as ec
from app.services.geo.common import get_client

logger = logging.getLogger(__name__)
S = RescueStatus

push_router = APIRouter(prefix="/push", tags=["Emergency — Web Push"])
router = APIRouter(prefix="/emergency", tags=["Emergency — citizen"])
rescue_router = APIRouter(prefix="/rescue", tags=["Emergency — responders"])
safe_router = APIRouter(prefix="/safe-locations", tags=["Emergency — safe locations"])

INDIA_BOUNDS = (68.0, 6.0, 98.0, 37.5)


def require_secure(request: Request) -> None:
    """In production, location endpoints must be reached over HTTPS (directly or via TLS-terminating proxy)."""
    if settings.ENVIRONMENT == "production":
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if proto != "https":
            raise HTTPException(403, "HTTPS is required for location data")


def client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()


class Fix(BaseModel):
    """A device position from navigator.geolocation (never generated server-side)."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy_m: float = Field(..., ge=0, le=100000)
    captured_at: datetime

    @field_validator("captured_at")
    @classmethod
    def not_future(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v > datetime.now(timezone.utc) + timedelta(minutes=2):
            raise ValueError("captured_at is in the future")
        return v

    def check_region(self) -> None:
        w, s, e, n = INDIA_BOUNDS
        if not (w <= self.longitude <= e and s <= self.latitude <= n):
            raise HTTPException(400, "FloodGuard currently serves locations in India only")


def point_sql(fix: Fix) -> str:
    return f"SRID=4326;POINT({fix.longitude} {fix.latitude})"


# ============================================================================ serializers

async def _shelter_brief(db: AsyncSession, shelter_id, lon: float, lat: float) -> Optional[Dict[str, Any]]:
    if not shelter_id:
        return None
    row = (await db.execute(text("""SELECT id, name, shelter_type, address, metadata AS meta, ST_X(geometry) lon, ST_Y(geometry) lat
                                     FROM shelters WHERE id = :id"""), {"id": shelter_id})).mappings().first()
    if not row:
        return None
    d = ec.haversine_m(lon, lat, row["lon"], row["lat"])
    return {"id": str(row["id"]), "name": row["name"], "type": row["shelter_type"], "address": row["address"],
            "lon": row["lon"], "lat": row["lat"], "distance_m": round(d), "bearing": ec.compass(ec.bearing_deg(lon, lat, row["lon"], row["lat"])),
            "is_demo": bool((row["meta"] or {}).get("is_demo")), "verification": (row["meta"] or {}).get("verification")}


async def serialize_request(db: AsyncSession, r: RescueRequest, include_pii: bool, owner: Optional[User] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": str(r.id), "status": r.status, "people_count": r.people_count, "note": r.note, "risk_level": r.risk_level,
        "is_demo": r.is_demo, "alert_id": str(r.alert_id) if r.alert_id else None,
        "location": {"latitude": r.latitude, "longitude": r.longitude, "accuracy_m": r.accuracy_m, "captured_at": r.captured_at,
                     "freshness": ec.location_freshness(r.captured_at)},
        "safe_location": await _shelter_brief(db, r.safe_location_id, r.longitude, r.latitude),
        "journey": {"status": r.journey_status, "started_at": r.journey_started_at, "route": r.route,
                    "start": [r.journey_start_lon, r.journey_start_lat] if r.journey_start_lat is not None else None,
                    "arrived_at": r.arrived_at, "arrival_distance_m": r.arrival_distance_m},
        "assigned_at": r.assigned_at, "resolved_at": r.resolved_at, "created_at": r.created_at, "updated_at": r.updated_at,
    }
    if r.assigned_responder_id:
        resp = await db.get(User, r.assigned_responder_id)
        out["responder"] = {"id": str(resp.id), "name": resp.full_name or resp.email.split("@")[0], "phone": resp.phone if include_pii else None} if resp else None
    if include_pii:
        u = owner or await db.get(User, r.user_id)
        prof = await db.get(EmergencyProfile, r.user_id)
        out["person"] = {"user_id": str(u.id), "name": u.full_name, "phone": u.phone,
                         "emergency_contact": {"name": prof.emergency_contact_name, "phone": prof.emergency_contact_phone} if prof else None}
    return out


async def transition(db: AsyncSession, r: RescueRequest, target: S, actor: User, actor_kind: str, note: str = None,
                     lat: float = None, lon: float = None) -> None:
    try:
        ec.check_transition(r.status, target, actor_kind)
    except ec.TransitionError as exc:
        raise HTTPException(409, str(exc))
    if r.status != target.value:
        db.add(RescueStatusHistory(rescue_request_id=r.id, from_status=r.status, to_status=target.value,
                                   actor_user_id=actor.id, note=note, latitude=lat, longitude=lon))
        r.status = target.value
        if target == S.RESOLVED:
            r.resolved_at = datetime.now(timezone.utc)


async def broadcast(db: AsyncSession, r: RescueRequest, event: str) -> None:
    await broker.publish(RESPONDERS, event, await serialize_request(db, r, include_pii=True))
    await broker.publish(f"fg:user:{r.user_id}", event, await serialize_request(db, r, include_pii=False))


async def active_request(db: AsyncSession, user_id) -> Optional[RescueRequest]:
    return (await db.execute(select(RescueRequest).where(RescueRequest.user_id == user_id, RescueRequest.status != S.RESOLVED.value)
                             .order_by(RescueRequest.created_at.desc()).limit(1))).scalar_one_or_none()


# ============================================================================ push

@push_router.get("/config")
async def push_config():
    return {"configured": ec.push_configured(), "public_key": settings.VAPID_PUBLIC_KEY if ec.push_configured() else None,
            "message": None if ec.push_configured() else "Emergency push notifications are not configured."}


class SubscribeBody(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=2000)
    keys: Dict[str, str]
    user_agent: Optional[str] = Field(None, max_length=255)


@push_router.post("/subscribe")
async def subscribe(body: SubscribeBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_active_user)):
    if not ec.push_configured():
        raise HTTPException(503, "Emergency push notifications are not configured.")
    if not body.endpoint.startswith("https://"):
        raise HTTPException(400, "Invalid push endpoint")
    p256dh, auth = body.keys.get("p256dh"), body.keys.get("auth")
    if not p256dh or not auth:
        raise HTTPException(400, "Subscription keys missing")
    sub = (await db.execute(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))).scalar_one_or_none()
    if sub:
        sub.user_id, sub.p256dh, sub.auth, sub.is_active, sub.failure_count, sub.last_error = user.id, p256dh, auth, True, 0, None
        sub.user_agent = body.user_agent
    else:
        sub = PushSubscription(user_id=user.id, endpoint=body.endpoint, p256dh=p256dh, auth=auth, user_agent=body.user_agent)
        db.add(sub)
    prof = await db.get(EmergencyProfile, user.id) or EmergencyProfile(user_id=user.id)
    prof.push_permission = "granted"
    db.add(prof)
    await db.commit()
    return {"subscribed": True, "subscription_id": str(sub.id)}


class UnsubscribeBody(BaseModel):
    endpoint: str


@push_router.post("/unsubscribe")
async def unsubscribe(body: UnsubscribeBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_active_user)):
    sub = (await db.execute(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint, PushSubscription.user_id == user.id))).scalar_one_or_none()
    if sub:
        sub.is_active = False
        await db.commit()
    return {"subscribed": False}


@push_router.post("/test")
async def push_test(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Send a clearly labelled TEST notification to the caller's own devices (verifies the full push path)."""
    subs = (await db.execute(select(PushSubscription).where(PushSubscription.user_id == user.id, PushSubscription.is_active))).scalars().all()
    if not ec.push_configured():
        return {"configured": False, "results": [], "message": "Emergency push notifications are not configured."}
    if not subs:
        return {"configured": True, "results": [], "message": "No active push subscription on this account."}
    payload = {"title": "FloodGuard TEST notification", "body": "This is a test. Emergency alerts will look like this.",
               "url": "/emergency", "tag": "floodguard-test", "level": "INFO", "kind": "TEST", "is_demo": True}
    results = []
    for s in subs:
        st, code, err = await asyncio.to_thread(ec.send_web_push, s.endpoint, s.p256dh, s.auth, payload, "normal", 600)
        if st == "sent":
            s.last_success_at, s.failure_count, s.last_error = datetime.now(timezone.utc), 0, None
        elif st == "expired":
            s.is_active, s.last_error = False, err
        else:
            s.failure_count, s.last_error = (s.failure_count or 0) + 1, err
        results.append({"subscription_id": str(s.id), "status": st, "http_status": code, "error": err})
    await db.commit()
    return {"configured": True, "results": results}


class OpenedBody(BaseModel):
    delivery_id: uuid.UUID


@push_router.post("/opened")
async def push_opened(body: OpenedBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_active_user)):
    await db.execute(text("UPDATE alert_deliveries SET opened_at = coalesce(opened_at, now()) WHERE id = :id AND user_id = :u"),
                     {"id": body.delivery_id, "u": user.id})
    await db.commit()
    return {"ok": True}


# ============================================================================ citizen profile / location

class ProfileBody(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20, pattern=r"^\+?[0-9 \-]{7,20}$")
    emergency_contact_name: Optional[str] = Field(None, max_length=255)
    emergency_contact_phone: Optional[str] = Field(None, max_length=32, pattern=r"^\+?[0-9 \-]{7,20}$")
    location_permission: Optional[Literal["granted", "denied", "prompt", "unsupported"]] = None
    push_permission: Optional[Literal["granted", "denied", "default", "unsupported"]] = None
    installed_pwa: Optional[bool] = None


@router.put("/profile")
async def update_profile(body: ProfileBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_active_user)):
    if body.full_name is not None:
        user.full_name = body.full_name.strip() or None
    if body.phone is not None:
        user.phone = body.phone.strip() or None
    prof = await db.get(EmergencyProfile, user.id) or EmergencyProfile(user_id=user.id)
    for f in ("emergency_contact_name", "emergency_contact_phone", "location_permission", "push_permission", "installed_pwa"):
        v = getattr(body, f)
        if v is not None:
            setattr(prof, f, v)
    db.add(prof)
    await db.commit()
    return await me(db=db, user=user)


@router.post("/location")
async def report_location(fix: Fix, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_active_user)):
    """Store the caller's device position (explicit action or active journey screen)."""
    require_secure(request)
    fix.check_region()
    now = datetime.now(timezone.utc)
    loc = await db.get(UserLocation, user.id)
    if loc:
        loc.location, loc.latitude, loc.longitude, loc.accuracy_m, loc.captured_at, loc.received_at = (
            point_sql(fix), fix.latitude, fix.longitude, fix.accuracy_m, fix.captured_at, now)
    else:
        db.add(UserLocation(user_id=user.id, location=point_sql(fix), latitude=fix.latitude, longitude=fix.longitude,
                            accuracy_m=fix.accuracy_m, captured_at=fix.captured_at))
    prof = await db.get(EmergencyProfile, user.id) or EmergencyProfile(user_id=user.id)
    prof.location_permission = "granted"
    prof.location_consent_at = prof.location_consent_at or now
    db.add(prof)
    r = await active_request(db, user.id)
    if r and r.status in (S.EN_ROUTE_TO_SHELTER.value, S.EVACUATING.value, S.RESCUE_REQUESTED.value, S.RESPONDER_ASSIGNED.value,
                          S.LOCATION_PINNED.value, S.NEEDS_ASSISTANCE.value):
        r.location, r.latitude, r.longitude, r.accuracy_m, r.captured_at = point_sql(fix), fix.latitude, fix.longitude, fix.accuracy_m, fix.captured_at
    await db.commit()
    if r:
        await db.refresh(r)
        await broadcast(db, r, "rescue.location")
    return {"stored": True, "freshness": ec.location_freshness(fix.captured_at), "captured_at": fix.captured_at}


@router.get("/me")
async def me(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_active_user)):
    prof = await db.get(EmergencyProfile, user.id)
    loc = await db.get(UserLocation, user.id)
    subs = (await db.execute(select(PushSubscription).where(PushSubscription.user_id == user.id, PushSubscription.is_active))).scalars().all()
    r = await active_request(db, user.id)
    alerts = []
    if loc:
        rows = (await db.execute(text("""
            SELECT a.id, a.title, a.description, a.instruction, a.metadata AS meta, a.sent_at, a.expires, a.source,
                   ST_Distance(ul.location, a.geometry::geography) AS distance_m
            FROM alerts a JOIN user_locations ul ON ul.user_id = :u
            WHERE a.status = 'ACTIVE' AND a.expires > now() AND a.geometry IS NOT NULL
              AND ST_DWithin(ul.location, a.geometry::geography, 20000)
            ORDER BY distance_m LIMIT 5"""), {"u": user.id})).mappings().all()
        for a in rows:
            m = a["meta"] or {}
            alerts.append({"id": str(a["id"]), "title": a["title"], "message": a["description"], "recommended_action": a["instruction"],
                           "level": m.get("level"), "hazard": m.get("hazard"), "area_name": m.get("area_name"), "is_demo": bool(m.get("is_demo")),
                           "kind": m.get("kind", "OFFICIAL" if a["source"] == "ndma_sachet" else "RESPONDER"), "basis": m.get("basis"),
                           "sent_at": a["sent_at"], "expires": a["expires"], "distance_m": round(a["distance_m"])})
    return {
        "user": {"id": str(user.id), "name": user.full_name, "email": user.email, "phone": user.phone, "role": user.role,
                 "responder": user.role in RESPONDER_ROLES},
        "emergency_contact": {"name": prof.emergency_contact_name, "phone": prof.emergency_contact_phone} if prof else None,
        "permissions": {"location": prof.location_permission if prof else None, "push": prof.push_permission if prof else None,
                        "installed_pwa": prof.installed_pwa if prof else None},
        "location": {"latitude": loc.latitude, "longitude": loc.longitude, "accuracy_m": loc.accuracy_m, "captured_at": loc.captured_at,
                     "freshness": ec.location_freshness(loc.captured_at)} if loc else {"freshness": "PERMISSION_REQUIRED"},
        "push": {"configured": ec.push_configured(), "active_subscriptions": len(subs)},
        "active_request": await serialize_request(db, r, include_pii=False) if r else None,
        "alerts_nearby": alerts,
        "limits": {"stale_minutes": settings.EMERGENCY_LOCATION_STALE_MINUTES, "arrival_radius_m": settings.EMERGENCY_ARRIVAL_RADIUS_M},
    }


# ============================================================================ rescue request (citizen)

class RequestBody(BaseModel):
    fix: Fix
    status: Literal["SAFE", "NEEDS_ASSISTANCE", "LOCATION_PINNED", "RESCUE_REQUESTED"] = "LOCATION_PINNED"
    people_count: int = Field(1, ge=1, le=500)
    note: Optional[str] = Field(None, max_length=500)
    alert_id: Optional[uuid.UUID] = None


@router.post("/request")
async def create_or_update_request(body: RequestBody, request: Request, db: AsyncSession = Depends(get_db),
                                   user: User = Depends(get_current_active_user)):
    """PIN MY LOCATION / I NEED RESCUE / I AM SAFE — creates or updates the caller's active request."""
    require_secure(request)
    body.fix.check_region()
    await report_location(body.fix, request, db, user)
    r = await active_request(db, user.id)
    risk, is_demo = None, False
    if body.alert_id:
        a = (await db.execute(text("SELECT metadata FROM alerts WHERE id = :id"), {"id": body.alert_id})).first()
        if a:
            is_demo = bool((a[0] or {}).get("is_demo"))
            risk = (a[0] or {}).get("level")
    target = S(body.status)
    event = "rescue.updated"
    if r is None:
        try:
            ec.check_transition(None, target, "user")
        except ec.TransitionError as exc:
            raise HTTPException(409, str(exc))
        r = RescueRequest(user_id=user.id, alert_id=body.alert_id, status=target.value, people_count=body.people_count, note=body.note,
                          risk_level=risk, is_demo=is_demo, location=point_sql(body.fix), latitude=body.fix.latitude,
                          longitude=body.fix.longitude, accuracy_m=body.fix.accuracy_m, captured_at=body.fix.captured_at,
                          journey_status="NOT_STARTED")
        db.add(r)
        await db.flush()
        db.add(RescueStatusHistory(rescue_request_id=r.id, from_status=None, to_status=target.value, actor_user_id=user.id,
                                   latitude=body.fix.latitude, longitude=body.fix.longitude, note="created"))
        event = "rescue.created"
    else:
        await transition(db, r, target, user, "user", lat=body.fix.latitude, lon=body.fix.longitude)
        r.people_count = body.people_count
        if body.note is not None:
            r.note = body.note
        if body.alert_id and not r.alert_id:
            r.alert_id, r.risk_level, r.is_demo = body.alert_id, risk, is_demo
        r.location, r.latitude, r.longitude, r.accuracy_m, r.captured_at = (point_sql(body.fix), body.fix.latitude, body.fix.longitude,
                                                                            body.fix.accuracy_m, body.fix.captured_at)
    await db.commit()
    await db.refresh(r)
    await broadcast(db, r, event)
    return await serialize_request(db, r, include_pii=False)


async def _own(db: AsyncSession, rid: uuid.UUID, user: User) -> RescueRequest:
    r = await db.get(RescueRequest, rid)
    if not r or r.user_id != user.id:
        raise HTTPException(404, "Request not found")
    return r


class PeopleBody(BaseModel):
    people_count: int = Field(..., ge=1, le=500)


@router.post("/{rid}/people")
async def set_people(rid: uuid.UUID, body: PeopleBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_active_user)):
    r = await _own(db, rid, user)
    r.people_count = body.people_count
    await db.commit()
    await db.refresh(r)
    await broadcast(db, r, "rescue.updated")
    return await serialize_request(db, r, include_pii=False)


class StatusBody(BaseModel):
    status: Literal["SAFE", "NEEDS_ASSISTANCE", "RESCUE_REQUESTED", "EVACUATING"]
    fix: Optional[Fix] = None


@router.post("/{rid}/status")
async def set_status(rid: uuid.UUID, body: StatusBody, request: Request, db: AsyncSession = Depends(get_db),
                     user: User = Depends(get_current_active_user)):
    r = await _own(db, rid, user)
    if body.fix:
        require_secure(request)
        r.location, r.latitude, r.longitude, r.accuracy_m, r.captured_at = (point_sql(body.fix), body.fix.latitude, body.fix.longitude,
                                                                            body.fix.accuracy_m, body.fix.captured_at)
    await transition(db, r, S(body.status), user, "user", lat=r.latitude, lon=r.longitude)
    await db.commit()
    await db.refresh(r)
    await broadcast(db, r, "rescue.updated")
    return await serialize_request(db, r, include_pii=False)


class NearbyBody(BaseModel):
    fix: Fix
    limit: int = Field(5, ge=1, le=10)


@router.post("/nearby-safe-locations")
async def nearby_safe_locations(body: NearbyBody, request: Request, db: AsyncSession = Depends(get_db),
                                user: User = Depends(get_current_active_user)):
    """Nearest designated safe locations (shelters table) with real routing + route risk when available."""
    require_secure(request)
    rows = (await db.execute(text(ec.NEAREST_SQL), {"lon": body.fix.longitude, "lat": body.fix.latitude, "limit": body.limit})).mappings().all()
    if not rows:
        return {"safe_locations": [], "message": "No designated safe location is registered yet. Follow official instructions and call 112."}
    client = get_client()
    routes = await asyncio.gather(*(ec.route_osrm(client, body.fix.longitude, body.fix.latitude, r["lon"], r["lat"]) for r in rows[:3]))
    out = []
    for i, r in enumerate(rows):
        route = routes[i] if i < len(routes) else None
        meta = r["meta"] or {}
        out.append({
            "id": str(r["id"]), "name": r["name"], "type": r["shelter_type"], "address": r["address"], "capacity": r["capacity"],
            "occupancy": r["current_occupancy"], "contact_phone": r["contact_phone"], "has_medical": r["has_medical"],
            "lon": r["lon"], "lat": r["lat"], "distance_m": round(r["distance_m"]),
            "bearing_deg": round(ec.bearing_deg(body.fix.longitude, body.fix.latitude, r["lon"], r["lat"])),
            "bearing": ec.compass(ec.bearing_deg(body.fix.longitude, body.fix.latitude, r["lon"], r["lat"])),
            "route": {"distance_m": route["distance_m"], "duration_s": route["duration_s"], "source": route["source"]} if route else None,
            "routing": "AVAILABLE" if route else ("UNAVAILABLE" if i < 3 else "NOT_REQUESTED"),
            "route_risk": await ec.route_risk(db, route["geometry"] if route else None),
            "is_demo": bool(meta.get("is_demo")), "verification": meta.get("verification"),
            "designated_by": meta.get("designated_by"), "designated_at": meta.get("designated_at"),
        })
    return {"safe_locations": out}


class StartBody(BaseModel):
    safe_location_id: uuid.UUID
    fix: Fix


@router.post("/{rid}/start-evacuation")
async def start_evacuation(rid: uuid.UUID, body: StartBody, request: Request, db: AsyncSession = Depends(get_db),
                           user: User = Depends(get_current_active_user)):
    """I'M GOING — record the journey start and compute a real route (or report routing unavailable)."""
    require_secure(request)
    r = await _own(db, rid, user)
    sh = (await db.execute(text("SELECT id, name, ST_X(geometry) lon, ST_Y(geometry) lat FROM shelters WHERE id = :id AND is_active"),
                           {"id": body.safe_location_id})).mappings().first()
    if not sh:
        raise HTTPException(404, "Safe location not found or inactive")
    await transition(db, r, S.EN_ROUTE_TO_SHELTER, user, "user", lat=body.fix.latitude, lon=body.fix.longitude, note=f"to {sh['name']}")
    route = await ec.route_osrm(get_client(), body.fix.longitude, body.fix.latitude, sh["lon"], sh["lat"])
    risk = await ec.route_risk(db, route["geometry"] if route else None)
    now = datetime.now(timezone.utc)
    r.safe_location_id = sh["id"]
    r.journey_status = "EN_ROUTE"
    r.journey_started_at = now
    r.journey_start_lat, r.journey_start_lon = body.fix.latitude, body.fix.longitude
    r.location, r.latitude, r.longitude, r.accuracy_m, r.captured_at = (point_sql(body.fix), body.fix.latitude, body.fix.longitude,
                                                                        body.fix.accuracy_m, body.fix.captured_at)
    r.route = ({**route, "risk": risk, "computed_at": now.isoformat()} if route else
               {"available": False, "message": "ROUTING DATA UNAVAILABLE", "destination": [sh["lon"], sh["lat"]], "computed_at": now.isoformat()})
    await db.commit()
    await db.refresh(r)
    await broadcast(db, r, "rescue.journey")
    return await serialize_request(db, r, include_pii=False)


@router.post("/{rid}/reached")
async def reached(rid: uuid.UUID, fix: Fix, request: Request, db: AsyncSession = Depends(get_db),
                  user: User = Depends(get_current_active_user)):
    """REACHED HERE — verified against the destination with the device's current GPS fix."""
    require_secure(request)
    r = await _own(db, rid, user)
    if not r.safe_location_id:
        raise HTTPException(409, "No destination selected")
    sh = (await db.execute(text("SELECT name, ST_X(geometry) lon, ST_Y(geometry) lat FROM shelters WHERE id = :id"),
                           {"id": r.safe_location_id})).mappings().first()
    dist = ec.haversine_m(fix.longitude, fix.latitude, sh["lon"], sh["lat"])
    ok, allowance = ec.arrival_ok(dist, fix.accuracy_m)
    r.location, r.latitude, r.longitude, r.accuracy_m, r.captured_at = point_sql(fix), fix.latitude, fix.longitude, fix.accuracy_m, fix.captured_at
    if not ok:
        await db.commit()
        raise HTTPException(409, {"message": f"You are {round(dist)} m from {sh['name']}. Arrival is confirmed within {round(allowance)} m.",
                                  "distance_m": round(dist), "allowance_m": round(allowance)})
    await transition(db, r, S.REACHED_SAFE_LOCATION, user, "user", lat=fix.latitude, lon=fix.longitude, note=f"arrived {round(dist)} m from {sh['name']}")
    r.journey_status = "ARRIVED"
    r.arrived_at = datetime.now(timezone.utc)
    r.arrival_distance_m = round(dist, 1)
    await db.commit()
    await db.refresh(r)
    await broadcast(db, r, "rescue.reached")
    return await serialize_request(db, r, include_pii=False)


# ============================================================================ responders

@rescue_router.get("/active")
async def rescue_active(request: Request, include_resolved: bool = False, db: AsyncSession = Depends(get_db),
                        user: User = Depends(require_responder)):
    q = select(RescueRequest).order_by(RescueRequest.updated_at.desc()).limit(1000)
    if not include_resolved:
        q = q.where(RescueRequest.status != S.RESOLVED.value)
    rows = (await db.execute(q)).scalars().all()
    await ec.audit(db, user.id, "rescue.list", "rescue_request", None, client_ip(request), {"count": len(rows)})
    return {"requests": [await serialize_request(db, r, include_pii=True) for r in rows]}


@rescue_router.get("/summary")
async def rescue_summary(db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    rows = (await db.execute(text("""SELECT status, count(*) n, coalesce(sum(people_count), 0) people FROM rescue_requests
                                      WHERE status <> 'RESOLVED' GROUP BY status"""))).mappings().all()
    by = {r["status"]: {"requests": r["n"], "people": int(r["people"])} for r in rows}
    need = sum(by.get(s, {}).get("people", 0) for s in ("RESCUE_REQUESTED", "NEEDS_ASSISTANCE", "RESPONDER_ASSIGNED"))
    evac = sum(by.get(s, {}).get("people", 0) for s in ("EVACUATING", "EN_ROUTE_TO_SHELTER"))
    safe = sum(by.get(s, {}).get("people", 0) for s in ("REACHED_SAFE_LOCATION", "SAFE"))
    alerts = (await db.execute(text("SELECT count(*) FROM alerts WHERE status='ACTIVE' AND expires > now() AND source IN ('floodguard','ndma_sachet')"))).scalar()
    return {"by_status": by, "people_needing_rescue": need, "people_evacuating": evac, "people_safe": safe,
            "unresolved_requests": sum(v["requests"] for v in by.values()), "active_emergencies": alerts}


@rescue_router.get("/responders")
async def responders(db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    rows = (await db.execute(select(User).where(User.role.in_(list(RESPONDER_ROLES)), User.is_active))).scalars().all()
    return {"responders": [{"id": str(u.id), "name": u.full_name or u.email.split("@")[0], "role": u.role} for u in rows]}


@rescue_router.get("/{rid}")
async def rescue_detail(rid: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    r = await db.get(RescueRequest, rid)
    if not r:
        raise HTTPException(404, "Not found")
    hist = (await db.execute(select(RescueStatusHistory).where(RescueStatusHistory.rescue_request_id == rid)
                             .order_by(RescueStatusHistory.at))).scalars().all()
    await ec.audit(db, user.id, "rescue.view", "rescue_request", rid, client_ip(request))
    out = await serialize_request(db, r, include_pii=True)
    out["history"] = [{"from": h.from_status, "to": h.to_status, "at": h.at, "note": h.note} for h in hist]
    nearest = (await db.execute(text(ec.NEAREST_SQL), {"lon": r.longitude, "lat": r.latitude, "limit": 1})).mappings().first()
    out["nearest_safe_location"] = {"id": str(nearest["id"]), "name": nearest["name"], "distance_m": round(nearest["distance_m"])} if nearest else None
    return out


@rescue_router.get("/{rid}/route")
async def rescue_route(rid: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    """Route from the person's last device position to their chosen (or the nearest) designated safe location."""
    r = await db.get(RescueRequest, rid)
    if not r:
        raise HTTPException(404, "Not found")
    await ec.audit(db, user.id, "rescue.route", "rescue_request", rid, client_ip(request))
    if r.safe_location_id:
        dest = (await db.execute(text("SELECT id, name, ST_X(geometry) lon, ST_Y(geometry) lat FROM shelters WHERE id = :id"),
                                 {"id": r.safe_location_id})).mappings().first()
    else:
        dest = (await db.execute(text(ec.NEAREST_SQL), {"lon": r.longitude, "lat": r.latitude, "limit": 1})).mappings().first()
    if not dest:
        return {"available": False, "message": "No designated safe location is registered.", "origin": [r.longitude, r.latitude], "destination": None}
    route = await ec.route_osrm(get_client(), r.longitude, r.latitude, dest["lon"], dest["lat"])
    out = {"origin": [r.longitude, r.latitude], "destination": {"id": str(dest["id"]), "name": dest["name"], "lon": dest["lon"], "lat": dest["lat"]},
           "chosen_by_person": bool(r.safe_location_id)}
    if not route:
        return {**out, "available": False, "message": "ROUTING DATA UNAVAILABLE"}
    return {**out, "available": True, **route, "risk": await ec.route_risk(db, route["geometry"])}


class AssignBody(BaseModel):
    responder_id: Optional[uuid.UUID] = None


@rescue_router.post("/{rid}/assign")
async def assign(rid: uuid.UUID, body: AssignBody, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    r = await db.get(RescueRequest, rid)
    if not r:
        raise HTTPException(404, "Not found")
    resp = await db.get(User, body.responder_id or user.id)
    if not resp or resp.role not in RESPONDER_ROLES or not resp.is_active:
        raise HTTPException(400, "Assignee must be an active responder")
    r.assigned_responder_id, r.assigned_at = resp.id, datetime.now(timezone.utc)
    if r.status in (S.NEEDS_ASSISTANCE.value, S.LOCATION_PINNED.value, S.RESCUE_REQUESTED.value):
        await transition(db, r, S.RESPONDER_ASSIGNED, user, "responder", note=f"assigned {resp.email}")
    else:
        db.add(RescueStatusHistory(rescue_request_id=r.id, from_status=r.status, to_status=r.status, actor_user_id=user.id, note=f"assigned {resp.email}"))
    await ec.audit(db, user.id, "rescue.assign", "rescue_request", rid, client_ip(request), {"responder": str(resp.id)}, commit=False)
    await db.commit()
    await db.refresh(r)
    await broadcast(db, r, "rescue.assigned")
    return await serialize_request(db, r, include_pii=True)


class ResponderStatusBody(BaseModel):
    status: Literal["EVACUATING", "RESOLVED"]
    note: Optional[str] = Field(None, max_length=500)


@rescue_router.post("/{rid}/status")
async def responder_status(rid: uuid.UUID, body: ResponderStatusBody, request: Request, db: AsyncSession = Depends(get_db),
                           user: User = Depends(require_responder)):
    r = await db.get(RescueRequest, rid)
    if not r:
        raise HTTPException(404, "Not found")
    await transition(db, r, S(body.status), user, "responder", note=body.note)
    await ec.audit(db, user.id, f"rescue.status.{body.status.lower()}", "rescue_request", rid, client_ip(request), commit=False)
    await db.commit()
    await db.refresh(r)
    await broadcast(db, r, "rescue.updated")
    return await serialize_request(db, r, include_pii=True)


# ============================================================================ safe locations

@safe_router.get("")
async def list_safe_locations(db: AsyncSession = Depends(get_db)):
    """Designated safe locations are public information (name + position only)."""
    rows = (await db.execute(text("""SELECT id, name, shelter_type, address, capacity, metadata AS meta, ST_X(geometry) lon, ST_Y(geometry) lat
                                      FROM shelters WHERE is_active ORDER BY name"""))).mappings().all()
    return {"safe_locations": [{"id": str(r["id"]), "name": r["name"], "type": r["shelter_type"], "address": r["address"],
                                "capacity": r["capacity"], "lon": r["lon"], "lat": r["lat"],
                                "is_demo": bool((r["meta"] or {}).get("is_demo")), "verification": (r["meta"] or {}).get("verification")}
                               for r in rows]}


class SafeLocationBody(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)
    shelter_type: Literal["relief_camp", "school", "community_hall", "government_building", "religious", "assembly_point", "other"] = "relief_camp"
    capacity: int = Field(..., ge=1, le=100000)
    address: Optional[str] = Field(None, max_length=500)
    contact_phone: Optional[str] = Field(None, max_length=20)
    verification: str = Field(..., min_length=5, max_length=500, description="Who designated it and on what authority")
    osm_ref: Optional[str] = Field(None, max_length=64)
    has_medical: bool = False
    is_demo: bool = False


@safe_router.post("")
async def designate_safe_location(body: SafeLocationBody, request: Request, db: AsyncSession = Depends(get_db),
                                  user: User = Depends(require_responder)):
    region_id = await ec.wayanad_region_id(db)
    sid = uuid.uuid4()
    import json as _json

    meta = {"verification": body.verification, "designated_by": user.email, "designated_at": datetime.now(timezone.utc).isoformat(),
            "osm_ref": body.osm_ref, "is_demo": body.is_demo}
    await db.execute(text("""
        INSERT INTO shelters (id, name, region_id, shelter_type, geometry, address, capacity, current_occupancy, has_toilets, has_water,
                              has_electricity, has_backup_power, has_medical, has_kitchen, is_accessible, pet_friendly, contact_phone,
                              manager_organization, is_active, metadata)
        VALUES (:id, :name, :rid, :type, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :addr, :cap, 0, false, false, false, false, :med,
                false, false, false, :phone, :org, true, CAST(:meta AS jsonb))"""),
        {"id": sid, "name": body.name, "rid": region_id, "type": body.shelter_type, "lon": body.longitude, "lat": body.latitude,
         "addr": body.address, "cap": body.capacity, "med": body.has_medical, "phone": body.contact_phone,
         "org": "FloodGuard responders", "meta": _json.dumps(meta)})
    await ec.audit(db, user.id, "safe_location.designate", "shelter", sid, client_ip(request), meta, commit=False)
    await db.commit()
    await broker.publish(PUBLIC, "safe_location.changed", {"id": str(sid)})
    return {"id": str(sid), "name": body.name, **meta}


@safe_router.post("/{sid}/deactivate")
async def deactivate_safe_location(sid: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    res = await db.execute(text("UPDATE shelters SET is_active = false WHERE id = :id"), {"id": sid})
    if not res.rowcount:
        raise HTTPException(404, "Not found")
    await ec.audit(db, user.id, "safe_location.deactivate", "shelter", sid, client_ip(request), commit=False)
    await db.commit()
    await broker.publish(PUBLIC, "safe_location.changed", {"id": str(sid)})
    return {"id": str(sid), "active": False}
