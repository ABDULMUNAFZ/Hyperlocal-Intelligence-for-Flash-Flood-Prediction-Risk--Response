#!/usr/bin/env python3
"""
End-to-end smoke test of the emergency system against a RUNNING stack (through nginx), including the
Celery worker's targeted push dispatch. Creates a throw-away citizen, uses the dev responder from
.cache/dev_responder.json, publishes a clearly labelled DEMO alert (0.4 km radius), then cancels it and
deletes everything it created.

  docker compose exec backend python scripts/emergency_smoke.py [--base http://nginx]

The citizen's "device position" here is a fixed point supplied by this operator script, not a GPS
fix — real device GPS is exercised in the browser app. The push subscription endpoint is a
non-routable test URL, so delivery is expected to be recorded as FAILED (proving the worker attempted
it and recorded the outcome honestly).
"""

import argparse
import asyncio
import json
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sqlalchemy import text  # noqa: E402

from app.db.session import async_session_maker  # noqa: E402

POINT = (76.0830, 11.6100)  # Kalpetta town (OSM place node, rounded)


def step(msg, ok=True, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {msg}{('  — ' + detail) if detail else ''}")
    if not ok:
        raise SystemExit(1)


async def sql(q, **p):
    async with async_session_maker() as db:
        r = await db.execute(text(q), p)
        await db.commit()
        try:
            return r.mappings().all()
        except Exception:  # noqa: BLE001
            return None


def load_creds(secret_id):
    if secret_id:  # production: responder credentials from AWS Secrets Manager (never printed)
        import boto3

        return json.loads(boto3.client("secretsmanager").get_secret_value(SecretId=secret_id)["SecretString"])
    return json.loads((Path(__file__).resolve().parent.parent / ".cache" / "dev_responder.json").read_text())


async def main(base: str, secret_id=None, full=False):
    creds = load_creds(secret_id)
    now = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731
    fix = {"longitude": POINT[0], "latitude": POINT[1], "accuracy_m": 15, "captured_at": now()}
    email = f"fgsmoke-{uuid.uuid4().hex[:8]}@example.org"
    alert_id = uid = shelter_id = None
    async with httpx.AsyncClient(base_url=f"{base}/api/v1", timeout=60) as c:
        try:
            r = await c.get("/push/config")
            step("push configured (VAPID from env)", r.json()["configured"], f"public key {r.json()['public_key'][:12]}…" if r.json()["public_key"] else "")
            pw = "smoke-" + uuid.uuid4().hex[:12]
            r = await c.post("/auth/register", json={"email": email, "password": pw, "full_name": "Smoke Citizen", "phone": "+91 90000 11111", "role": "admin"})
            step("citizen registration (role forced to public)", r.status_code == 201 and r.json()["role"] == "public")
            uid = r.json()["id"]
            r = await c.post("/auth/login", data={"username": email, "password": pw})
            cit = {"Authorization": f"Bearer {r.json()['access_token']}"}
            r = await c.post("/auth/login", data={"username": creds["email"], "password": creds["password"]})
            step("responder login", r.status_code == 200)
            resp = {"Authorization": f"Bearer {r.json()['access_token']}"}

            step("citizen blocked from /rescue/active", (await c.get("/rescue/active", headers=cit)).status_code == 403)
            r = await c.post("/emergency/location", headers=cit, json=fix)
            step("location stored", r.status_code == 200 and r.json()["freshness"] == "CONNECTED")
            sub = {"endpoint": f"https://push.invalid/fg-smoke/{uuid.uuid4().hex}",
                   "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", "auth": "tBHItJI5svbpez7KI4CCXg"}}
            step("push subscription stored", (await c.post("/push/subscribe", headers=cit, json=sub)).status_code == 200)
            r = await c.post("/emergency/request", headers=cit, json={"fix": fix, "status": "RESCUE_REQUESTED", "people_count": 3})
            step("rescue requested", r.status_code == 200 and r.json()["status"] == "RESCUE_REQUESTED")
            rid = r.json()["id"]
            r = await c.get("/rescue/active", headers=resp)
            me = next((x for x in r.json()["requests"] if x["id"] == rid), None)
            step("responder sees the request with contact details", bool(me and me["person"]["phone"]))
            r = await c.post(f"/rescue/{rid}/assign", headers=resp, json={})
            step("responder assigned", r.json()["status"] == "RESPONDER_ASSIGNED")
            r = await c.get(f"/rescue/{rid}/route", headers=resp)
            step("route to nearest safe location", r.status_code == 200, "available" if r.json().get("available") else r.json().get("message", ""))
            area = {"center": list(POINT), "radius_km": 0.4, "is_demo": True}
            r = await c.post("/live/alerts/preview", headers=resp, json=area)
            step("alert preview counts the citizen", r.json()["affected_users"] >= 1 and r.json()["reachable_by_push"] >= 1, json.dumps(r.json()))
            r = await c.post("/live/alerts", headers=resp, json={**area, "hazard": "flash_flood", "level": "WARNING", "title": "SMOKE TEST — DEMO",
                                                              "message": "Automated smoke test", "area_name": "Kalpetta (smoke test)", "basis": "emergency_smoke.py",
                                                              "expires": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()})
            step("DEMO alert published and queued on Celery", r.status_code == 200 and r.json()["kind"] == "DEMO" and r.json()["push_dispatch"] == "celery")
            alert_id = r.json()["id"]
            rows = []
            for _ in range(30):
                rows = await sql("SELECT status, error FROM alert_deliveries WHERE alert_id = :a AND user_id = :u", a=alert_id, u=uid)
                if rows and rows[0]["status"] != "queued":
                    break
                time.sleep(1)
            step("worker targeted the citizen and recorded the attempt", bool(rows), f"status={rows[0]['status'] if rows else None}")
            r = await c.get("/emergency/me", headers=cit)
            step("citizen sees the DEMO alert as nearby", any(a["id"] == alert_id and a["kind"] == "DEMO" for a in r.json()["alerts_nearby"]))
            if full:
                # safe destination → I'M GOING → REACHED HERE (GPS-distance verified)
                dest = (POINT[0] + 0.004, POINT[1])  # ≈ 436 m east of the test position
                r = await c.post("/safe-locations", headers=resp, json={"name": "SMOKE TEST safe location (DEMO)", "longitude": dest[0], "latitude": dest[1],
                                                                       "shelter_type": "school", "capacity": 50, "verification": "emergency_smoke.py automated test", "is_demo": True})
                step("responder designates a safe location", r.status_code == 200)
                shelter_id = r.json()["id"]
                r = await c.post("/emergency/nearby-safe-locations", headers=cit, json={"fix": {**fix, "captured_at": now()}, "limit": 5})
                near = next((x for x in r.json()["safe_locations"] if x["id"] == shelter_id), None)
                step("nearest safe location found with distance/bearing", bool(near) and 380 < near["distance_m"] < 500 and near["bearing"] == "E",
                     f"{near['distance_m']} m {near['bearing']}, routing {near['routing']}" if near else "")
                r = await c.post(f"/emergency/{rid}/start-evacuation", headers=cit, json={"safe_location_id": shelter_id, "fix": {**fix, "captured_at": now()}})
                route = r.json()["journey"]["route"] or {}
                step("I'M GOING — journey started", r.status_code == 200 and r.json()["status"] == "EN_ROUTE_TO_SHELTER",
                     f"route {route.get('distance_m')} m via {route.get('source')}" if route.get("geometry") else route.get("message", ""))
                r = await c.post(f"/emergency/{rid}/reached", headers=cit, json={**fix, "captured_at": now()})
                step("REACHED HERE refused when too far", r.status_code == 409, r.json()["detail"]["message"] if r.status_code == 409 else str(r.status_code))
                r = await c.post(f"/emergency/{rid}/reached", headers=cit, json={"longitude": dest[0], "latitude": dest[1] + 0.0003, "accuracy_m": 10, "captured_at": now()})
                step("REACHED HERE accepted at the destination", r.status_code == 200 and r.json()["status"] == "REACHED_SAFE_LOCATION",
                     f"{r.json()['journey']['arrival_distance_m']} m from destination" if r.status_code == 200 else r.text[:200])
                r = await c.get("/rescue/summary", headers=resp)
                step("admin summary counts the person as safe", r.json()["people_safe"] >= 3, json.dumps({k: r.json()[k] for k in ("people_safe", "people_needing_rescue", "unresolved_requests")}))
        finally:
            if shelter_id:
                await sql("DELETE FROM shelters WHERE id = :s", s=shelter_id)
            if alert_id and "resp" in locals():
                await c.post(f"/live/alerts/{alert_id}/cancel", headers=resp)  # tells open clients to drop the banner
            if alert_id:
                await sql("DELETE FROM alert_deliveries WHERE alert_id = :a", a=alert_id)
                await sql("DELETE FROM alerts WHERE id = :a", a=alert_id)
            if uid:
                await sql("DELETE FROM rescue_status_history WHERE rescue_request_id IN (SELECT id FROM rescue_requests WHERE user_id = :u)", u=uid)
                for t in ("rescue_requests", "push_subscriptions", "user_locations", "emergency_profiles", "alert_deliveries"):
                    await sql(f"DELETE FROM {t} WHERE user_id = :u", u=uid)
                await sql("DELETE FROM users WHERE id = :u", u=uid)
            print("cleanup done")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://nginx")
    ap.add_argument("--responder-secret", help="AWS Secrets Manager secret id with responder email/password (production)")
    ap.add_argument("--full", action="store_true", help="also test safe destination, journey and REACHED HERE")
    a = ap.parse_args()
    asyncio.run(main(a.base, a.responder_secret, a.full))
