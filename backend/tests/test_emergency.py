"""
Integration tests for the emergency user + rescue response system.

Run inside the backend container against the real PostgreSQL/PostGIS + Redis:
    docker compose exec backend pytest -q tests/test_emergency.py

Every row created here belongs to throw-away users (fgtest-…@example.org) and is deleted afterwards.
External services are never contacted: routing is stubbed and Web Push HTTP is intercepted at the
transport layer (the VAPID signing and RFC 8291 payload encryption still run for real).
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import text

from app.api.v1.endpoints import live as live_ep
from app.api.v1.endpoints.auth import create_access_token, get_password_hash
from app.core.config import settings
from app.db.session import async_session_maker
from app.main import app
from app.models.core import User
from app.services.emergency import core as ec

LOOP = asyncio.new_event_loop()  # one loop for the whole module (async engine pool is loop-bound)
RUN = LOOP.run_until_complete

# Real places in Wayanad (OSM place nodes, rounded) — test users "stand" here.
MEPPADI = (76.1330, 11.5560)
KALPETTA = (76.0830, 11.6100)
CHOORALMALA = (76.1599, 11.4992)


# ----------------------------------------------------------------------------- helpers

def fix(lonlat, acc=12.0, age_s=5):
    return {"longitude": lonlat[0], "latitude": lonlat[1], "accuracy_m": acc,
            "captured_at": (datetime.now(timezone.utc) - timedelta(seconds=age_s)).isoformat()}


def offset(lonlat, north_m=0.0, east_m=0.0):
    import math
    return (lonlat[0] + east_m / (111320 * math.cos(math.radians(lonlat[1]))), lonlat[1] + north_m / 110574)


async def _mk_user(role: str) -> tuple[str, str]:
    async with async_session_maker() as db:
        u = User(email=f"fgtest-{uuid.uuid4().hex[:10]}@example.org", hashed_password=get_password_hash("x" * 12),
                 full_name=f"Test {role}", phone="+91 90000 00000", role=role, is_active=True)
        db.add(u)
        await db.commit()
        await db.refresh(u)
        return str(u.id), create_access_token({"sub": str(u.id)})


CREATED_USERS: list[str] = []
CREATED_SHELTERS: list[str] = []
CREATED_ALERTS: list[str] = []


def user(role="public"):
    uid, tok = RUN(_mk_user(role))
    CREATED_USERS.append(uid)
    return uid, {"Authorization": f"Bearer {tok}"}


async def _req(method, url, headers=None, **kw):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        return await c.request(method, f"/api/v1{url}", headers=headers, **kw)


def call(method, url, headers=None, **kw) -> httpx.Response:
    return RUN(_req(method, url, headers, **kw))


def sql(q, **p):
    async def go():
        async with async_session_maker() as db:
            r = await db.execute(text(q), p)
            await db.commit()
            try:
                return r.mappings().all()
            except Exception:  # noqa: BLE001
                return None
    return RUN(go())


def vapid_keys():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec as cec

    k = cec.generate_private_key(cec.SECP256R1())
    priv = base64.urlsafe_b64encode(k.private_numbers().private_value.to_bytes(32, "big")).rstrip(b"=").decode()
    pub = base64.urlsafe_b64encode(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)).rstrip(b"=").decode()
    return pub, priv


def browser_subscription():
    """A cryptographically valid subscription, as a browser would create (P-256 key + 16-byte auth secret)."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec as cec

    k = cec.generate_private_key(cec.SECP256R1())
    p256dh = base64.urlsafe_b64encode(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)).rstrip(b"=").decode()
    auth = base64.urlsafe_b64encode(os.urandom(16)).rstrip(b"=").decode()
    return {"endpoint": f"https://push.example.test/send/{uuid.uuid4().hex}", "keys": {"p256dh": p256dh, "auth": auth}}, k, auth


@pytest.fixture(autouse=True)
def vapid(monkeypatch):
    pub, priv = vapid_keys()
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", pub)
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", priv)
    monkeypatch.setattr(settings, "VAPID_SUBJECT", "mailto:tests@floodguard.test")
    # no external routing in tests
    async def no_route(*a, **k):
        return None
    monkeypatch.setattr(ec, "route_osrm", no_route)
    # never hand test alerts to the real Celery worker
    monkeypatch.setattr(live_ep, "_queue_dispatch", lambda alert_id: "test-suppressed")
    yield


def teardown_module(_m):
    ids = CREATED_USERS
    if ids:
        sql("DELETE FROM alert_deliveries WHERE user_id = ANY(CAST(:ids AS uuid[]))", ids=ids)
        sql("DELETE FROM rescue_status_history WHERE rescue_request_id IN (SELECT id FROM rescue_requests WHERE user_id = ANY(CAST(:ids AS uuid[])))", ids=ids)
        sql("DELETE FROM rescue_requests WHERE user_id = ANY(CAST(:ids AS uuid[]))", ids=ids)
    if CREATED_ALERTS:
        sql("DELETE FROM alert_deliveries WHERE alert_id = ANY(CAST(:ids AS uuid[]))", ids=CREATED_ALERTS)
        sql("DELETE FROM alert_acknowledgements WHERE alert_id = ANY(CAST(:ids AS uuid[]))", ids=CREATED_ALERTS)
        sql("DELETE FROM alerts WHERE id = ANY(CAST(:ids AS uuid[]))", ids=CREATED_ALERTS)
    if CREATED_SHELTERS:
        sql("DELETE FROM shelters WHERE id = ANY(CAST(:ids AS uuid[]))", ids=CREATED_SHELTERS)
    if ids:
        for t in ("push_subscriptions", "user_locations", "emergency_profiles"):
            sql(f"DELETE FROM {t} WHERE user_id = ANY(CAST(:ids AS uuid[]))", ids=ids)
        sql("DELETE FROM audit_logs WHERE actor_user_id = ANY(CAST(:ids AS uuid[]))", ids=ids)
        sql("DELETE FROM users WHERE id = ANY(CAST(:ids AS uuid[]))", ids=ids)


def designate(headers, name, lonlat, demo=True):
    r = call("POST", "/safe-locations", headers, json={"name": name, "longitude": lonlat[0], "latitude": lonlat[1], "shelter_type": "school",
                                                      "capacity": 200, "verification": "TEST designation (pytest)", "is_demo": demo})
    assert r.status_code == 200, r.text
    CREATED_SHELTERS.append(r.json()["id"])
    return r.json()["id"]


# ----------------------------------------------------------------------------- push

def test_push_config_honestly_reports_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", None)
    r = call("GET", "/push/config").json()
    assert r == {"configured": False, "public_key": None, "message": "Emergency push notifications are not configured."}
    _, h = user()
    sub, _, _ = browser_subscription()
    assert call("POST", "/push/subscribe", h, json=sub).status_code == 503


def test_push_subscription_requires_auth_and_is_stored():
    sub, _, _ = browser_subscription()
    assert call("POST", "/push/subscribe", json=sub).status_code == 401
    uid, h = user()
    r = call("POST", "/push/subscribe", h, json=sub)
    assert r.status_code == 200 and r.json()["subscribed"]
    call("POST", "/push/subscribe", h, json=sub)  # idempotent upsert on endpoint
    rows = sql("SELECT user_id, p256dh, auth, is_active FROM push_subscriptions WHERE endpoint = :e", e=sub["endpoint"])
    assert len(rows) == 1 and str(rows[0]["user_id"]) == uid and rows[0]["is_active"]
    assert call("POST", "/push/subscribe", h, json={**sub, "endpoint": "http://insecure.example/x"}).status_code == 400


def test_web_push_is_really_signed_and_encrypted(monkeypatch):
    """send_web_push produces a VAPID-signed, aes128gcm-encrypted request the subscriber can decrypt."""
    import http_ece
    import requests

    sub, client_key, auth = browser_subscription()
    captured = {}

    def fake_post(url, data=None, headers=None, timeout=None, **kw):
        captured.update(url=url, data=data, headers=headers)
        resp = requests.Response()
        resp.status_code = 201
        return resp

    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr(requests.Session, "post", lambda self, *a, **k: fake_post(*a, **k))
    payload = {"title": "FloodGuard TEST", "body": "hello", "level": "INFO"}
    status, code, err = ec.send_web_push(sub["endpoint"], sub["keys"]["p256dh"], sub["keys"]["auth"], payload, "high", 60)
    assert (status, code, err) == ("sent", 201, None)
    h = {k.lower(): v for k, v in captured["headers"].items()}
    assert h["content-encoding"] == "aes128gcm" and h["urgency"] == "high" and h["ttl"] == "60"
    assert h["authorization"].startswith("vapid t=") and "k=" + settings.VAPID_PUBLIC_KEY in h["authorization"]
    pad = lambda s: s + "=" * (-len(s) % 4)  # noqa: E731
    plain = http_ece.decrypt(captured["data"], private_key=client_key, auth_secret=base64.urlsafe_b64decode(pad(auth)), version="aes128gcm")
    assert json.loads(plain) == payload


def test_expired_subscription_is_reported(monkeypatch):
    import requests

    sub, _, _ = browser_subscription()

    def gone(*a, **k):
        resp = requests.Response()
        resp.status_code = 410
        resp._content = b"gone"
        return resp

    monkeypatch.setattr(requests, "post", gone)
    monkeypatch.setattr(requests.Session, "post", lambda self, *a, **k: gone())
    status, code, _ = ec.send_web_push(sub["endpoint"], sub["keys"]["p256dh"], sub["keys"]["auth"], {"t": 1})
    assert status == "expired" and code == 410


# ----------------------------------------------------------------------------- emergency creation + PostGIS

def test_emergency_creation_stores_postgis_points():
    uid, h = user()
    r = call("POST", "/emergency/request", h, json={"fix": fix(MEPPADI, acc=8), "status": "RESCUE_REQUESTED", "people_count": 4})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "RESCUE_REQUESTED" and body["people_count"] == 4
    assert "person" not in body  # citizen responses never echo PII-bearing responder view
    row = sql("""SELECT ST_AsText(location::geometry) wkt, ST_SRID(location::geometry) srid, GeometryType(location::geometry) gt
                 FROM rescue_requests WHERE id = :id""", id=body["id"])[0]
    assert row["srid"] == 4326 and row["gt"] == "POINT"
    lon, lat = (float(v) for v in row["wkt"][6:-1].split())
    assert (round(lon, 4), round(lat, 4)) == MEPPADI
    loc = sql("SELECT ST_SRID(location::geometry) srid, accuracy_m FROM user_locations WHERE user_id = :u", u=uid)[0]
    assert loc["srid"] == 4326 and loc["accuracy_m"] == 8
    hist = sql("SELECT to_status FROM rescue_status_history WHERE rescue_request_id = :id", id=body["id"])
    assert [x["to_status"] for x in hist] == ["RESCUE_REQUESTED"]
    idx = sql("SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_user_locations_geog','idx_rescue_requests_geog','idx_shelters_geography')")
    assert len(idx) == 3


def test_location_validation_rejects_bad_fixes():
    _, h = user()
    future = fix(MEPPADI)
    future["captured_at"] = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    assert call("POST", "/emergency/location", h, json=future).status_code == 422
    assert call("POST", "/emergency/location", h, json=fix((2.35, 48.85))).status_code == 400  # outside India
    assert call("POST", "/emergency/location", h, json={**fix(MEPPADI), "latitude": 123}).status_code == 422
    assert call("POST", "/emergency/location", json=fix(MEPPADI)).status_code == 401


# ----------------------------------------------------------------------------- authorization

def test_citizens_cannot_reach_responder_data():
    _, pub = user("public")
    for m, u, kw in [("GET", "/rescue/active", {}), ("GET", "/rescue/summary", {}), ("GET", "/rescue/responders", {}),
                     ("GET", f"/rescue/{uuid.uuid4()}", {}), ("GET", f"/rescue/{uuid.uuid4()}/route", {}),
                     ("POST", f"/rescue/{uuid.uuid4()}/assign", {"json": {}}), ("POST", f"/rescue/{uuid.uuid4()}/status", {"json": {"status": "RESOLVED"}}),
                     ("POST", "/safe-locations", {"json": {}}), ("POST", "/live/alerts/preview", {"json": {}}),
                     ("POST", "/live/alerts", {"json": {}})]:
        assert call(m, u, **kw).status_code == 401, u           # anonymous
        assert call(m, u, pub, **kw).status_code == 403, u      # ordinary user


def test_users_only_touch_their_own_request():
    _, a = user()
    _, b = user()
    rid = call("POST", "/emergency/request", a, json={"fix": fix(MEPPADI), "status": "LOCATION_PINNED"}).json()["id"]
    assert call("POST", f"/emergency/{rid}/people", b, json={"people_count": 9}).status_code == 404
    assert call("POST", f"/emergency/{rid}/status", b, json={"status": "SAFE"}).status_code == 404


def test_self_registration_cannot_escalate_role():
    email = f"fgtest-{uuid.uuid4().hex[:10]}@example.org"
    r = call("POST", "/auth/register", json={"email": email, "password": "correct-horse-1", "role": "admin", "full_name": "Mallory"})
    assert r.status_code == 201 and r.json()["role"] == "public"
    CREATED_USERS.append(r.json()["id"])


# ----------------------------------------------------------------------------- status machine

def test_state_machine_rules():
    S = ec.S
    ec.check_transition(None, S.RESCUE_REQUESTED, "user")
    ec.check_transition(S.EN_ROUTE_TO_SHELTER.value, S.REACHED_SAFE_LOCATION, "user")
    for cur, tgt, actor in [(S.RESCUE_REQUESTED.value, S.LOCATION_PINNED, "user"), (S.LOCATION_PINNED.value, S.REACHED_SAFE_LOCATION, "user"),
                            (S.RESCUE_REQUESTED.value, S.RESOLVED, "user"), (S.RESOLVED.value, S.RESCUE_REQUESTED, "user"),
                            (S.RESOLVED.value, S.EVACUATING, "responder"), (None, S.RESOLVED, "responder")]:
        with pytest.raises(ec.TransitionError):
            ec.check_transition(cur, tgt, actor)
    assert {s.value for s in S} == {"SAFE", "NEEDS_ASSISTANCE", "LOCATION_PINNED", "RESCUE_REQUESTED", "RESPONDER_ASSIGNED",
                                   "EVACUATING", "EN_ROUTE_TO_SHELTER", "REACHED_SAFE_LOCATION", "RESOLVED"}


def test_status_transitions_through_the_api():
    _, u = user()
    _, resp = user("disaster_manager")
    rid = call("POST", "/emergency/request", u, json={"fix": fix(MEPPADI), "status": "RESCUE_REQUESTED", "people_count": 2}).json()["id"]
    # a citizen cannot downgrade a rescue request to "pinned", nor resolve it
    assert call("POST", "/emergency/request", u, json={"fix": fix(MEPPADI), "status": "LOCATION_PINNED"}).status_code == 409
    assert call("POST", f"/emergency/{rid}/status", u, json={"status": "RESOLVED"}).status_code == 422
    a = call("POST", f"/rescue/{rid}/assign", resp, json={})
    assert a.status_code == 200 and a.json()["status"] == "RESPONDER_ASSIGNED" and a.json()["person"]["phone"]
    assert call("POST", f"/rescue/{rid}/status", resp, json={"status": "EVACUATING"}).json()["status"] == "EVACUATING"
    assert call("POST", f"/rescue/{rid}/status", resp, json={"status": "RESOLVED"}).json()["status"] == "RESOLVED"
    assert call("POST", f"/rescue/{rid}/status", resp, json={"status": "EVACUATING"}).status_code == 409
    hist = [x["to_status"] for x in sql("SELECT to_status FROM rescue_status_history WHERE rescue_request_id = :id ORDER BY at", id=rid)]
    assert hist == ["RESCUE_REQUESTED", "RESPONDER_ASSIGNED", "EVACUATING", "RESOLVED"]
    audits = sql("SELECT action FROM audit_logs WHERE target_id = :id", id=rid)
    assert {"rescue.assign", "rescue.status.evacuating", "rescue.status.resolved"} <= {x["action"] for x in audits}


# ----------------------------------------------------------------------------- safe locations + journey

def test_nearby_safe_locations_are_ordered_by_real_distance():
    _, resp = user("admin")
    _, u = user()
    near = designate(resp, "TEST near school", offset(KALPETTA, north_m=400))
    far = designate(resp, "TEST far hall", offset(KALPETTA, north_m=-3000))
    r = call("POST", "/emergency/nearby-safe-locations", u, json={"fix": fix(KALPETTA), "limit": 10})
    assert r.status_code == 200
    ids = [s["id"] for s in r.json()["safe_locations"]]
    assert ids.index(near) < ids.index(far)
    first = next(s for s in r.json()["safe_locations"] if s["id"] == near)
    assert 390 <= first["distance_m"] <= 410 and first["bearing"] == "N"
    assert first["routing"] == "UNAVAILABLE" and first["route"] is None and first["route_risk"]["level"] == "UNKNOWN"
    assert first["is_demo"] is True and first["verification"] == "TEST designation (pytest)"
    public = call("GET", "/safe-locations").json()["safe_locations"]
    assert any(s["id"] == near for s in public) and "designated_by" not in next(s for s in public if s["id"] == near)


def test_journey_and_reached_validation():
    _, resp = user("admin")
    _, u = user()
    dest = offset(CHOORALMALA, east_m=1500)
    sid = designate(resp, "TEST relief camp", dest)
    rid = call("POST", "/emergency/request", u, json={"fix": fix(CHOORALMALA), "status": "LOCATION_PINNED", "people_count": 3}).json()["id"]
    j = call("POST", f"/emergency/{rid}/start-evacuation", u, json={"safe_location_id": sid, "fix": fix(CHOORALMALA)})
    assert j.status_code == 200, j.text
    jb = j.json()
    assert jb["status"] == "EN_ROUTE_TO_SHELTER" and jb["journey"]["status"] == "EN_ROUTE"
    assert jb["journey"]["route"]["available"] is False and jb["journey"]["route"]["message"] == "ROUTING DATA UNAVAILABLE"
    # 1.5 km away → refused, with the real distance
    far = call("POST", f"/emergency/{rid}/reached", u, json=fix(CHOORALMALA))
    assert far.status_code == 409 and 1450 <= far.json()["detail"]["distance_m"] <= 1550
    # poor accuracy does not stretch the allowance without limit (200 m + min(acc, 300))
    blurry = call("POST", f"/emergency/{rid}/reached", u, json=fix(offset(dest, east_m=-700), acc=5000))
    assert blurry.status_code == 409 and blurry.json()["detail"]["allowance_m"] == 500
    ok = call("POST", f"/emergency/{rid}/reached", u, json=fix(offset(dest, north_m=60), acc=10))
    assert ok.status_code == 200 and ok.json()["status"] == "REACHED_SAFE_LOCATION"
    assert 55 <= ok.json()["journey"]["arrival_distance_m"] <= 65 and ok.json()["journey"]["status"] == "ARRIVED"


# ----------------------------------------------------------------------------- targeting

def _alert(resp_headers, center, radius_km, demo=True, level="WARNING"):
    r = call("POST", "/live/alerts", resp_headers, json={
        "hazard": "flash_flood", "level": level, "title": "TEST alert (pytest)", "message": "test", "recommended_action": "test",
        "area_name": "Test area", "center": list(center), "radius_km": radius_km,
        "expires": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "basis": "pytest", "is_demo": demo})
    assert r.status_code == 200, r.text
    CREATED_ALERTS.append(r.json()["id"])
    return r.json()


def test_nearby_user_query_and_alert_preview():
    _, resp = user("disaster_manager")
    inside, hi = user()
    outside, ho = user()
    stale, hs = user()
    call("POST", "/emergency/location", hi, json=fix(offset(MEPPADI, north_m=300)))
    call("POST", "/emergency/location", ho, json=fix(offset(MEPPADI, north_m=5000)))
    call("POST", "/emergency/location", hs, json=fix(offset(MEPPADI, east_m=200)))
    sql("UPDATE user_locations SET captured_at = now() - interval '3 days' WHERE user_id = :u", u=stale)
    sub, _, _ = browser_subscription()
    call("POST", "/push/subscribe", hi, json=sub)
    area = {"center": list(MEPPADI), "radius_km": 1, "is_demo": True}
    pv = call("POST", "/live/alerts/preview", resp, json=area).json()
    # other (real) users may exist near Meppadi; ours must be counted exactly once each
    rows = sql("""SELECT ul.user_id FROM user_locations ul WHERE ST_DWithin(ul.location, ST_SetSRID(ST_MakePoint(:x,:y),4326)::geography, 1000)
                  AND ul.captured_at > now() - interval '24 hours'""", x=MEPPADI[0], y=MEPPADI[1])
    ids = {str(r["user_id"]) for r in rows}
    assert inside in ids and outside not in ids and stale not in ids
    assert pv["affected_users"] >= 1 and pv["reachable_by_push"] >= 1 and pv["push_configured"] is True


def test_alert_targeting_and_delivery_records(monkeypatch):
    from app.tasks import emergency as tasks

    sent = []
    monkeypatch.setattr(tasks, "send_web_push", lambda ep, p, a, payload, urgency, ttl: (sent.append((ep, payload)) or ("sent", 201, None)))
    monkeypatch.setattr(tasks, "publish", lambda *a, **k: None)
    _, resp = user("admin")
    in_sub, hin = user()
    in_nosub, hnos = user()
    out, hout = user()
    call("POST", "/emergency/location", hin, json=fix(offset(KALPETTA, north_m=200)))
    call("POST", "/emergency/location", hnos, json=fix(offset(KALPETTA, east_m=-300)))
    call("POST", "/emergency/location", hout, json=fix(offset(KALPETTA, north_m=8000)))
    s1, _, _ = browser_subscription()
    s2, _, _ = browser_subscription()
    call("POST", "/push/subscribe", hin, json=s1)
    call("POST", "/push/subscribe", hout, json=s2)
    a = _alert(resp, KALPETTA, 1.0, demo=True)
    assert a["kind"] == "DEMO" and a["is_demo"] and a["push_dispatch"] == "test-suppressed"
    summary = tasks.dispatch_alert_push_sync(a["id"])
    deliveries = sql("SELECT user_id, status, subscription_id, distance_m FROM alert_deliveries WHERE alert_id = :a", a=a["id"])
    by_user = {str(d["user_id"]): d for d in deliveries}
    assert by_user[in_sub]["status"] == "sent" and by_user[in_sub]["subscription_id"] is not None and by_user[in_sub]["distance_m"] == 0
    assert by_user[in_nosub]["status"] == "no_subscription"
    assert out not in by_user
    assert s2["endpoint"] not in [e for e, _ in sent] and s1["endpoint"] in [e for e, _ in sent]
    payload = next(p for e, p in sent if e == s1["endpoint"])
    assert payload["title"] == "DEMO EMERGENCY — NOT A REAL WARNING" and payload["is_demo"] is True
    assert payload["url"].startswith(f"/emergency?alert={a['id']}&d=")
    assert summary["targeted_users"] >= 2 and summary["sent"] >= 1
    # the recipient can mark the delivery opened; others cannot
    did = sql("SELECT id FROM alert_deliveries WHERE alert_id = :a AND user_id = :u", a=a["id"], u=in_sub)[0]["id"]
    call("POST", "/push/opened", hout, json={"delivery_id": str(did)})
    assert sql("SELECT opened_at FROM alert_deliveries WHERE id = :d", d=did)[0]["opened_at"] is None
    call("POST", "/push/opened", hin, json={"delivery_id": str(did)})
    assert sql("SELECT opened_at FROM alert_deliveries WHERE id = :d", d=did)[0]["opened_at"] is not None


def test_real_alerts_must_cover_wayanad_and_simulations_stay_labelled():
    _, resp = user("admin")
    r = call("POST", "/live/alerts", resp, json={
        "hazard": "flash_flood", "level": "WARNING", "title": "TEST alert", "message": "test message", "area_name": "Chennai", "center": [80.27, 13.08], "radius_km": 2,
        "expires": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), "basis": "pytest", "is_demo": False})
    assert r.status_code == 400  # a non-demo FloodGuard alert outside Wayanad is refused
    d = _alert(resp, (80.27, 13.08), 2, demo=True)  # DEMO may target a test device anywhere in India
    assert d["kind"] == "DEMO" and "DEMO" in d["source"]
    payload = ec.alert_push_payload({**d, "kind": "DEMO"})
    assert payload["title"] == "DEMO EMERGENCY — NOT A REAL WARNING"
    official = ec.alert_push_payload({"id": "x", "kind": "OFFICIAL", "is_demo": False, "level": "CRITICAL"})
    assert official["title"] == "FLOODGUARD EMERGENCY · OFFICIAL ALERT"


def test_citizen_me_shows_only_nearby_alerts_without_other_users():
    _, resp = user("admin")
    _, u = user()
    call("POST", "/emergency/location", u, json=fix(offset(KALPETTA, north_m=100)))
    a = _alert(resp, KALPETTA, 0.5, demo=True)
    me = call("GET", "/emergency/me", u).json()
    assert any(x["id"] == a["id"] and x["distance_m"] == 0 and x["kind"] == "DEMO" for x in me["alerts_nearby"])
    assert me["location"]["freshness"] == "CONNECTED" and me["push"]["configured"] is True
    assert set(me) == {"user", "emergency_contact", "permissions", "location", "push", "active_request", "alerts_nearby", "limits"}

