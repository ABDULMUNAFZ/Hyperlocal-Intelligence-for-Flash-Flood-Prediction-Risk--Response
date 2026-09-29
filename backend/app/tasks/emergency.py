"""Emergency Celery tasks: targeted Web Push delivery, official alert ingestion, data retention.

Runs in the existing celery-worker / celery-beat containers (Redis broker). Uses a synchronous
SQLAlchemy engine (psycopg2) because Celery workers are not asyncio processes.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, Optional

from sqlalchemy import create_engine, text

from app.core.celery_app import celery_app
from app.core.config import settings
from app.services.emergency.core import TARGET_SQL, alert_push_payload, push_configured, send_web_push

logger = logging.getLogger(__name__)


def sync_database_url() -> str:
    # Derived from DATABASE_URL (what the API itself uses) so worker, beat and API always hit the same database.
    return str(settings.DATABASE_URL).replace("postgresql+asyncpg://", "postgresql://")


@lru_cache(maxsize=1)
def engine():
    return create_engine(sync_database_url(), pool_pre_ping=True, pool_size=3, max_overflow=2)


def publish(channel: str, event: str, data: Dict[str, Any]) -> None:
    try:
        import redis

        r = redis.Redis.from_url(settings.REDIS_URL or f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0")
        r.publish(channel, json.dumps({"event": event, "data": data}, default=str))
    except Exception as exc:  # noqa: BLE001
        logger.error("redis publish failed: %s", exc)


def load_alert(conn, alert_id: str) -> Optional[Dict[str, Any]]:
    row = conn.execute(text("""
        SELECT id, title, description, instruction, metadata, status, expires, source
        FROM alerts WHERE id = :id"""), {"id": alert_id}).mappings().first()
    if not row:
        return None
    meta = row["metadata"] or {}
    return {"id": str(row["id"]), "title": row["title"], "message": row["description"], "recommended_action": row["instruction"],
            "hazard": meta.get("hazard"), "level": meta.get("level"), "area_name": meta.get("area_name"),
            "is_demo": bool(meta.get("is_demo")), "kind": meta.get("kind", "RESPONDER"), "buffer_m": float(meta.get("buffer_m", 0) or 0),
            "status": row["status"], "expires": row["expires"]}


def dispatch_alert_push_sync(alert_id: str) -> Dict[str, Any]:
    """Target users inside the alert area and send Web Push; every attempt is recorded in alert_deliveries."""
    counts = {"targeted_users": 0, "sent": 0, "failed": 0, "expired": 0, "no_subscription": 0, "not_configured": 0}
    with engine().begin() as conn:
        alert = load_alert(conn, alert_id)
        if not alert or alert["status"] != "ACTIVE":
            return {"alert_id": alert_id, "skipped": "alert not active", **counts}
        targets = conn.execute(text(TARGET_SQL), {"alert_id": alert_id, "buffer_m": alert["buffer_m"],
                                                   "max_age_h": settings.EMERGENCY_TARGET_LOCATION_MAX_AGE_HOURS}).mappings().all()
    counts["targeted_users"] = len(targets)
    for t in targets:
        with engine().begin() as conn:
            subs = conn.execute(text("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = :u AND is_active"),
                                {"u": t["user_id"]}).mappings().all()
            if not subs:
                conn.execute(text("""INSERT INTO alert_deliveries (id, alert_id, user_id, status, distance_m, error)
                                     VALUES (:id, :a, :u, 'no_subscription', :d, 'User has no active push subscription')"""),
                             {"id": uuid.uuid4(), "a": alert_id, "u": t["user_id"], "d": t["distance_m"]})
                counts["no_subscription"] += 1
                continue
        for sub in subs:
            did = uuid.uuid4()
            with engine().begin() as conn:
                conn.execute(text("""INSERT INTO alert_deliveries (id, alert_id, user_id, subscription_id, status, distance_m)
                                     VALUES (:id, :a, :u, :s, 'queued', :d)"""),
                             {"id": did, "a": alert_id, "u": t["user_id"], "s": sub["id"], "d": t["distance_m"]})
            status, code, err = send_web_push(sub["endpoint"], sub["p256dh"], sub["auth"], alert_push_payload(alert, str(did)),
                                              urgency="high", ttl=6 * 3600)
            counts[status] = counts.get(status, 0) + 1
            with engine().begin() as conn:
                conn.execute(text("""UPDATE alert_deliveries SET status = :st, http_status = :c, error = :e,
                                     sent_at = CASE WHEN :st = 'sent' THEN now() ELSE NULL END WHERE id = :id"""),
                             {"st": status, "c": code, "e": err, "id": did})
                if status == "sent":
                    conn.execute(text("UPDATE push_subscriptions SET last_success_at = now(), failure_count = 0, last_error = NULL WHERE id = :s"), {"s": sub["id"]})
                elif status == "expired":
                    conn.execute(text("UPDATE push_subscriptions SET is_active = false, last_error = :e WHERE id = :s"), {"s": sub["id"], "e": err})
                elif status == "failed":
                    conn.execute(text("UPDATE push_subscriptions SET failure_count = failure_count + 1, last_error = :e WHERE id = :s"), {"s": sub["id"], "e": err})
    summary = {"alert_id": alert_id, "push_configured": push_configured(), **counts}
    publish("fg:responders", "alert.delivery", summary)
    logger.info("alert %s push summary: %s", alert_id, summary)
    return summary


@celery_app.task(name="emergency.dispatch_alert_push", bind=True, max_retries=2, default_retry_delay=20)
def dispatch_alert_push(self, alert_id: str) -> Dict[str, Any]:
    try:
        return dispatch_alert_push_sync(alert_id)
    except Exception as exc:  # noqa: BLE001 - transient DB/network errors are retried
        logger.exception("dispatch failed")
        raise self.retry(exc=exc)


SEVERITY_LEVEL = {"Extreme": ("EXTREME", "CRITICAL"), "Severe": ("SEVERE", "WARNING")}


def poll_official_alerts_sync() -> Dict[str, Any]:
    """Ingest NDMA SACHET CAP alerts that cover Wayanad with Severe/Extreme severity as OFFICIAL alerts."""
    if not settings.EMERGENCY_AUTO_OFFICIAL_ALERTS:
        return {"enabled": False}
    from app.services.geo import common
    from app.services.geo.alerts import wayanad_alerts

    common._client = None  # fresh HTTP client for this event loop
    data = asyncio.run(wayanad_alerts(include_expired=False))
    if not data.get("available"):
        return {"available": False}
    created = []
    boundary = json.loads((common.DATA_DIR / "wayanad_boundary.geojson").read_text())["features"][0]["geometry"]
    for a in data["alerts"]:
        if a.get("severity") not in SEVERITY_LEVEL or not a.get("identifier"):
            continue
        sev, level = SEVERITY_LEVEL[a["severity"]]
        with engine().begin() as conn:
            exists = conn.execute(text("SELECT 1 FROM alerts WHERE cap_identifier = :i"), {"i": a["identifier"]}).first()
            if exists:
                continue
            aid = uuid.uuid4()
            event = (a.get("event") or "").lower()
            hazard = "landslide" if "landslide" in event else "flash_flood" if "flood" in event else "weather"
            meta = {"kind": "OFFICIAL", "hazard": hazard, "level": level, "area_name": "Wayanad (district)",
                    "basis": f"NDMA SACHET CAP {a['identifier']} from {a.get('sender')} — matched by {a.get('match_reason')}",
                    "is_demo": False, "cap_link": a.get("link")}
            conn.execute(text("""
                INSERT INTO alerts (id, alert_id, title, description, instruction, alert_type, severity, status, urgency, certainty,
                                    geometry, onset, expires, sent_at, source, author, cap_identifier, cap_sender, channels, languages,
                                    recipients_count, acknowledged_count, metadata, affected_regions, created_at, updated_at)
                VALUES (:id, :aid, :title, :desc, :instr, CAST(:atype AS alerttype), CAST(:sev AS alertseverity), 'ACTIVE', :urg, :cert,
                        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:g), 4326)), :onset, :expires, now(), 'ndma_sachet', :sender, :ident, :sender,
                        ARRAY['web','push'], ARRAY['en'], 0, 0, CAST(:meta AS jsonb), ARRAY[]::uuid[], now(), now())"""),
                {"id": aid, "aid": f"SACHET-{a['identifier']}"[:100], "title": (a.get("headline") or a.get("event") or "Official alert")[:255],
                 "desc": a.get("description") or a.get("headline") or "", "instr": a.get("instruction"),
                 "atype": "LANDSLIDE" if hazard == "landslide" else "FLASH_FLOOD" if hazard == "flash_flood" else "WEATHER",
                 "sev": sev, "urg": (a.get("urgency") or "")[:20], "cert": (a.get("certainty") or "")[:20], "g": json.dumps(boundary),
                 "onset": a.get("onset") or a.get("effective"), "expires": a.get("expires"), "sender": a.get("sender"),
                 "ident": a["identifier"], "meta": json.dumps(meta)})
        created.append(str(aid))
        publish("fg:public", "alert.published", {"id": str(aid), "title": a.get("headline"), "level": level, "kind": "OFFICIAL",
                                                  "area_name": "Wayanad (district)", "is_demo": False, "hazard": hazard, "basis": meta["basis"]})
        dispatch_alert_push_sync(str(aid))
    return {"scanned": data.get("scanned_messages"), "created": created}


@celery_app.task(name="emergency.poll_official_alerts")
def poll_official_alerts() -> Dict[str, Any]:
    return poll_official_alerts_sync()


@celery_app.task(name="emergency.purge_expired_data")
def purge_expired_data() -> Dict[str, int]:
    """Retention: raw locations after N hours; resolved rescue requests after N days; expired anonymous reports."""
    with engine().begin() as conn:
        loc = conn.execute(text("DELETE FROM user_locations WHERE captured_at < now() - make_interval(hours => :h)"),
                           {"h": settings.EMERGENCY_LOCATION_RETENTION_HOURS}).rowcount
        res = conn.execute(text("DELETE FROM rescue_requests WHERE status = 'RESOLVED' AND resolved_at < now() - make_interval(days => :d)"),
                           {"d": settings.EMERGENCY_RESCUE_RETENTION_DAYS}).rowcount
        rep = conn.execute(text("DELETE FROM citizen_reports WHERE expires_at < now()")).rowcount
    return {"user_locations": loc, "rescue_requests": res, "citizen_reports": rep}
