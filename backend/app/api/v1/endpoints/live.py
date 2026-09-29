"""
Live emergency operations: admin alert broadcast, citizen reports, real-time stream (SSE).

Transport: Server-Sent Events backed by Redis pub/sub, so every connected browser (and every
backend worker) receives events without polling.
  channel fg:public      → alerts published / cancelled (everyone)
  channel fg:responders  → citizen reports created / updated (authorised responders only)

Authorisation: publishing alerts and reading citizen reports requires a JWT for a user whose
role is admin or disaster_manager (existing auth system). Citizens need no account; their
reports are linked to a hashed random session token so they can see and delete their own.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from shapely.geometry import MultiPolygon, Point, mapping, shape
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_active_user
from app.core.config import settings
from app.db.session import async_session_maker, get_db
from app.models.alerts import Alert, AlertSeverity, AlertStatus, AlertType
from app.models.core import User
from app.models.live import AlertAcknowledgement, CitizenReport
from app.services.geo.common import wayanad_geometry

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/live", tags=["Live emergency operations"])

RESPONDER_ROLES = {"admin", "disaster_manager"}
PUBLIC = "fg:public"
RESPONDERS = "fg:responders"
REPORT_RETENTION_H = 72


# ------------------------------------------------------------------------------------ broker

class Broker:
    def __init__(self) -> None:
        self._redis = None

    async def redis(self):
        if self._redis is None:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(settings.REDIS_URL or f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0", decode_responses=True)
        return self._redis

    async def publish(self, channel: str, event: str, data: Dict[str, Any]) -> None:
        try:
            r = await self.redis()
            await r.publish(channel, json.dumps({"event": event, "data": data}, default=str))
        except Exception as exc:  # noqa: BLE001
            logger.error("live publish failed: %s", exc)

    async def listen(self, channels: List[str]) -> AsyncIterator[Dict[str, Any]]:
        r = await self.redis()
        pubsub = r.pubsub()
        await pubsub.subscribe(*channels)
        try:
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                if msg is None:
                    yield {"event": "heartbeat", "data": {"t": datetime.now(timezone.utc).isoformat()}}
                    continue
                if msg.get("type") == "message":
                    yield json.loads(msg["data"])
        finally:
            await pubsub.unsubscribe(*channels)
            await pubsub.close()


broker = Broker()


def session_hash(token: str) -> str:
    if not token or len(token) < 16:
        raise HTTPException(400, "Invalid session token")
    return hashlib.sha256(token.encode()).hexdigest()


async def require_responder(user: User = Depends(get_current_active_user)) -> User:
    if user.role not in RESPONDER_ROLES:
        raise HTTPException(403, "Responder role (admin or disaster_manager) required")
    return user


async def _user_from_token(token: Optional[str]) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    async with async_session_maker() as db:
        return (await db.execute(select(User).where(User.id == payload.get("sub")))).scalar_one_or_none()


# ------------------------------------------------------------------------------------ stream

@router.get("/stream")
async def stream(request: Request, token: Optional[str] = Query(None)):
    """SSE stream. Responders (valid JWT via ?token=) additionally receive citizen-report events."""
    user = await _user_from_token(token)
    channels = [PUBLIC] + ([RESPONDERS] if user and user.role in RESPONDER_ROLES and user.is_active else [])
    if user and user.is_active:
        channels.append(f"fg:user:{user.id}")  # the user's own rescue-request updates

    async def gen():
        yield f"event: hello\ndata: {json.dumps({'channels': channels, 'responder': RESPONDERS in channels})}\n\n"
        try:
            async for msg in broker.listen(channels):
                if await request.is_disconnected():
                    break
                yield f"event: {msg['event']}\ndata: {json.dumps(msg['data'], default=str)}\n\n"
        except asyncio.CancelledError:
            pass
        except Exception as exc:  # noqa: BLE001
            logger.warning("SSE stream ended: %s", exc)
            yield f"event: error\ndata: {json.dumps({'message': 'stream unavailable'})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


# ------------------------------------------------------------------------------------ alerts

LEVEL_TO_SEVERITY = {"INFO": AlertSeverity.INFO, "WATCH": AlertSeverity.WATCH, "WARNING": AlertSeverity.WARNING, "CRITICAL": AlertSeverity.EXTREME}
HAZARD_TO_TYPE = {"flash_flood": AlertType.FLASH_FLOOD, "landslide": AlertType.LANDSLIDE, "flood": AlertType.FLOOD_RISK,
                  "evacuation": AlertType.EVACUATION, "road_closure": AlertType.ROAD_CLOSURE, "weather": AlertType.WEATHER}


class AlertCreate(BaseModel):
    hazard: Literal["flash_flood", "landslide", "flood", "evacuation", "road_closure", "weather"] = "flash_flood"
    level: Literal["INFO", "WATCH", "WARNING", "CRITICAL"] = "WARNING"
    title: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=3, max_length=2000)
    recommended_action: str = Field("Move to higher ground and follow official instructions.", max_length=500)
    area_name: str = Field(..., max_length=200)
    geometry: Optional[Dict[str, Any]] = None
    center: Optional[List[float]] = Field(None, min_length=2, max_length=2)
    radius_km: Optional[float] = Field(None, gt=0, le=30)
    onset: Optional[datetime] = None
    expires: datetime
    basis: str = Field("Responder assessment", max_length=300)
    is_demo: bool = False


def _alert_out(a: Alert) -> Dict[str, Any]:
    from geoalchemy2.shape import to_shape

    meta = a.extra_metadata or {}
    return {
        "id": str(a.id), "alert_id": a.alert_id, "title": a.title, "message": a.description,
        "recommended_action": a.instruction, "hazard": meta.get("hazard"), "level": meta.get("level"),
        "severity": a.severity.value if a.severity else None, "status": a.status.value if a.status else None,
        "area_name": meta.get("area_name"), "basis": meta.get("basis"), "is_demo": bool(meta.get("is_demo")),
        "kind": meta.get("kind", "OFFICIAL" if a.source == "ndma_sachet" else "RESPONDER"),
        "onset": a.onset, "expires": a.expires, "sent_at": a.sent_at, "author": a.author,
        "acknowledged_count": a.acknowledged_count or 0,
        "geometry": mapping(to_shape(a.geometry)) if a.geometry is not None else None,
        "source": ("NDMA SACHET (official)" if a.source == "ndma_sachet" else "FloodGuard responders") + (" · DEMO" if meta.get("is_demo") else ""),
    }


def _alert_area(geometry: Optional[Dict[str, Any]], center: Optional[List[float]], radius_km: Optional[float], is_demo: bool):
    if geometry:
        g = shape(geometry)
    elif center and radius_km:
        lon, lat = center
        # buffer in metres via a local projection so the circle is true-radius at this latitude
        import math

        from shapely.affinity import scale

        kx = 111320.0 * math.cos(math.radians(lat))
        g = scale(Point(0, 0).buffer(radius_km * 1000, resolution=32), xfact=1 / kx, yfact=1 / 110574.0, origin=(0, 0))
        from shapely.affinity import translate

        g = translate(g, lon, lat)
    else:
        raise HTTPException(400, "Provide an affected area: geometry or center + radius_km")
    if not g.is_valid:
        g = g.buffer(0)
    if is_demo:
        w, s, e, n = g.bounds
        if not (68 <= w and e <= 98 and 6 <= s and n <= 37.5):
            raise HTTPException(400, "DEMO area must be in India")
    elif not g.intersects(wayanad_geometry().buffer(0.05)):
        raise HTTPException(400, "Affected area must be in Wayanad (use DEMO mode for a test area elsewhere)")
    return g if isinstance(g, MultiPolygon) else MultiPolygon([g])


class AreaPreview(BaseModel):
    geometry: Optional[Dict[str, Any]] = None
    center: Optional[List[float]] = Field(None, min_length=2, max_length=2)
    radius_km: Optional[float] = Field(None, gt=0, le=30)
    is_demo: bool = False


@router.post("/alerts/preview")
async def preview_alert(body: AreaPreview, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    """How many registered users (with a recent consented location) are inside the area — shown before sending."""
    from app.services.emergency.core import preview_targets, push_configured

    mp = _alert_area(body.geometry, body.center, body.radius_km, body.is_demo)
    counts = await preview_targets(db, mapping(mp))
    return {**counts, "push_configured": push_configured(), "area_km2": None}


def _queue_dispatch(alert_id: str) -> str:
    """Queue targeted push delivery on Celery; fall back to an in-process thread if the broker is down."""
    try:
        from app.tasks.emergency import dispatch_alert_push

        dispatch_alert_push.apply_async(args=[alert_id], retry=False)
        return "celery"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Celery unavailable (%s); dispatching in-process", exc)
        from app.tasks.emergency import dispatch_alert_push_sync

        asyncio.get_running_loop().run_in_executor(None, dispatch_alert_push_sync, alert_id)
        return "in-process"


@router.post("/alerts")
async def publish_alert(body: AlertCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    from geoalchemy2.shape import from_shape

    from app.services.emergency.core import audit

    mp = _alert_area(body.geometry, body.center, body.radius_km, body.is_demo)
    now = datetime.now(timezone.utc)
    if body.expires <= now:
        raise HTTPException(400, "Expiry must be in the future")
    a = Alert(
        alert_id=f"FG-{uuid.uuid4().hex[:12].upper()}",
        title=("[DEMO] " if body.is_demo else "") + body.title,
        description=body.message,
        instruction=body.recommended_action,
        alert_type=HAZARD_TO_TYPE[body.hazard],
        severity=LEVEL_TO_SEVERITY[body.level],
        status=AlertStatus.ACTIVE,
        urgency="immediate" if body.level == "CRITICAL" else "expected",
        certainty="possible",
        geometry=from_shape(mp, srid=4326),
        onset=body.onset or now,
        expires=body.expires,
        sent_at=now,
        source="floodguard",
        author=user.email,
        author_id=user.id,
        channels=["web", "push"],
        extra_metadata={"hazard": body.hazard, "level": body.level, "area_name": body.area_name, "basis": body.basis,
                        "is_demo": body.is_demo, "kind": "DEMO" if body.is_demo else "RESPONDER"},
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    await audit(db, user.id, "alert.publish", "alert", a.id, None, {"level": body.level, "demo": body.is_demo, "area": body.area_name})
    out = _alert_out(a)
    await broker.publish(PUBLIC, "alert.published", out)
    out["push_dispatch"] = _queue_dispatch(str(a.id)) if body.level in ("WARNING", "CRITICAL") or body.is_demo else "not_sent_for_level"
    return out


@router.get("/alerts/{alert_id}/deliveries")
async def alert_deliveries(alert_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    from sqlalchemy import text as _t

    rows = (await db.execute(_t("""SELECT status, count(*) n, count(opened_at) opened FROM alert_deliveries
                                   WHERE alert_id = :a GROUP BY status"""), {"a": alert_id})).mappings().all()
    return {"alert_id": str(alert_id), "by_status": {r["status"]: {"count": r["n"], "opened": r["opened"]} for r in rows}}


@router.get("/alerts/active")
async def active_alerts(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    rows = (await db.execute(
        select(Alert).where(Alert.source.in_(["floodguard", "ndma_sachet"]), Alert.status == AlertStatus.ACTIVE, Alert.expires > now)
        .order_by(Alert.sent_at.desc())
    )).scalars().all()
    return {"alerts": [_alert_out(a) for a in rows], "retrieved_at": now}


@router.post("/alerts/{alert_id}/cancel")
async def cancel_alert(alert_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    a = await db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    a.status = AlertStatus.CANCELLED
    await db.commit()
    await broker.publish(PUBLIC, "alert.cancelled", {"id": str(a.id), "by": user.email})
    return {"id": str(a.id), "status": "cancelled"}


class AckBody(BaseModel):
    session_token: str


@router.post("/alerts/{alert_id}/ack")
async def acknowledge_alert(alert_id: uuid.UUID, body: AckBody, db: AsyncSession = Depends(get_db)):
    h = session_hash(body.session_token)
    a = await db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    exists = (await db.execute(select(AlertAcknowledgement).where(AlertAcknowledgement.alert_id == alert_id, AlertAcknowledgement.session_hash == h))).scalar_one_or_none()
    if not exists:
        db.add(AlertAcknowledgement(alert_id=alert_id, session_hash=h))
        a.acknowledged_count = (a.acknowledged_count or 0) + 1
        await db.commit()
        await broker.publish(RESPONDERS, "alert.acknowledged", {"id": str(alert_id), "count": a.acknowledged_count})
    return {"id": str(alert_id), "acknowledged": True, "count": a.acknowledged_count}


# ------------------------------------------------------------------------------------ citizen reports

REPORT_TYPES = ["NEED_RESCUE", "TRAPPED", "FLOODING", "ROAD_BLOCKED", "LANDSLIDE", "MEDICAL", "SAFE", "EVACUATING", "OTHER"]
SEVERITY = {"NEED_RESCUE": "critical", "TRAPPED": "critical", "MEDICAL": "critical", "LANDSLIDE": "warning",
            "FLOODING": "warning", "ROAD_BLOCKED": "watch", "EVACUATING": "watch", "OTHER": "watch", "SAFE": "info"}


class ReportCreate(BaseModel):
    session_token: str = Field(..., min_length=16, max_length=128)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = Field(None, ge=0, le=100000)
    report_type: Literal["NEED_RESCUE", "TRAPPED", "FLOODING", "ROAD_BLOCKED", "LANDSLIDE", "MEDICAL", "SAFE", "EVACUATING", "OTHER"]
    people_count: int = Field(1, ge=1, le=500)
    message: Optional[str] = Field(None, max_length=500)
    is_demo: bool = False


def _report_out(r: CitizenReport, include_session: bool = False) -> Dict[str, Any]:
    return {
        "id": str(r.id), "latitude": r.latitude, "longitude": r.longitude, "accuracy_m": r.accuracy_m,
        "report_type": r.report_type, "people_count": r.people_count, "severity": r.severity, "message": r.message,
        "status": r.status, "is_demo": r.is_demo, "created_at": r.created_at, "updated_at": r.updated_at, "expires_at": r.expires_at,
    }


async def _purge(db: AsyncSession) -> None:
    await db.execute(delete(CitizenReport).where(CitizenReport.expires_at < datetime.now(timezone.utc)))


@router.post("/reports")
async def create_report(body: ReportCreate, db: AsyncSession = Depends(get_db)):
    if not wayanad_geometry().buffer(0.1).contains(Point(body.longitude, body.latitude)):
        raise HTTPException(400, "FloodGuard currently accepts reports inside Wayanad district only.")
    h = session_hash(body.session_token)
    since = datetime.now(timezone.utc) - timedelta(minutes=10)
    recent = (await db.execute(select(func.count()).select_from(CitizenReport).where(CitizenReport.session_hash == h, CitizenReport.created_at > since))).scalar()
    if recent and recent >= 5:
        raise HTTPException(429, "Too many reports from this device in 10 minutes.")
    r = CitizenReport(
        session_hash=h, latitude=round(body.latitude, 6), longitude=round(body.longitude, 6), accuracy_m=body.accuracy_m,
        report_type=body.report_type, people_count=body.people_count, severity=SEVERITY[body.report_type],
        message=(body.message or "").strip() or None, status="new", is_demo=body.is_demo,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=REPORT_RETENTION_H),
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    out = _report_out(r)
    await broker.publish(RESPONDERS, "report.created", out)
    return out


@router.get("/reports/mine")
async def my_reports(session_token: str = Query(...), db: AsyncSession = Depends(get_db)):
    await _purge(db)
    await db.commit()
    rows = (await db.execute(select(CitizenReport).where(CitizenReport.session_hash == session_hash(session_token)).order_by(CitizenReport.created_at.desc()))).scalars().all()
    return {"reports": [_report_out(r) for r in rows], "retention_hours": REPORT_RETENTION_H}


@router.delete("/reports/{report_id}")
async def delete_my_report(report_id: uuid.UUID, session_token: str = Query(...), db: AsyncSession = Depends(get_db)):
    r = await db.get(CitizenReport, report_id)
    if not r or r.session_hash != session_hash(session_token):
        raise HTTPException(404, "Report not found")
    await db.delete(r)
    await db.commit()
    await broker.publish(RESPONDERS, "report.deleted", {"id": str(report_id)})
    return {"deleted": True}


@router.get("/reports")
async def list_reports(db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    await _purge(db)
    await db.commit()
    rows = (await db.execute(select(CitizenReport).order_by(CitizenReport.created_at.desc()).limit(2000))).scalars().all()
    return {"reports": [_report_out(r) for r in rows], "retention_hours": REPORT_RETENTION_H}


class ReportUpdate(BaseModel):
    status: Literal["new", "acknowledged", "dispatched", "resolved"]


@router.patch("/reports/{report_id}")
async def update_report(report_id: uuid.UUID, body: ReportUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_responder)):
    r = await db.get(CitizenReport, report_id)
    if not r:
        raise HTTPException(404, "Report not found")
    r.status = body.status
    r.handled_by = user.id
    await db.commit()
    await db.refresh(r)
    out = _report_out(r)
    await broker.publish(RESPONDERS, "report.updated", out)
    return out


@router.get("/me")
async def whoami(user: User = Depends(get_current_active_user)):
    return {"email": user.email, "role": user.role, "responder": user.role in RESPONDER_ROLES}
