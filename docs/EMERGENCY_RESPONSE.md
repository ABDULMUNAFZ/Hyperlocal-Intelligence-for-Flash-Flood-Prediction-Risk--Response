# FloodGuard — Emergency user + rescue response system

Citizen PWA at **`/emergency`**; responder tools inside the Wayanad command center at **`/`**.
Everything runs on the existing stack: FastAPI · PostgreSQL/PostGIS · Redis (SSE + Celery broker) · Celery worker/beat · nginx · Vite.

## 1. How it works

```
citizen phone (PWA)                    backend (FastAPI)                         responders (command center)
─────────────────────                  ─────────────────                         ───────────────────────────
navigator.geolocation ──POST fix──▶  user_locations (geography, GIST)
PIN / I NEED RESCUE ────────────▶  rescue_requests + status history ──SSE fg:responders──▶ red/orange/yellow/green markers
                                     audit_logs (every responder access)        RESCUE PERSON panel (assign / resolve)
Web Push subscription ──────────▶  push_subscriptions
                                     alerts ──Celery: PostGIS targeting──▶ alert_deliveries (one row per attempt)
  ◀── Web Push (VAPID, aes128gcm) ──  pywebpush                               SEND EMERGENCY ALERT (preview → confirm)
  ◀── SSE fg:user:<id> (own status)
FIND SAFE LOCATION ─────────────▶  shelters (responder-designated only) + OSRM foot/driving route + route risk
I'M GOING / REACHED HERE ───────▶  journey + GPS-verified arrival (200 m + min(accuracy, 300 m))
```

Alert sources: **OFFICIAL** (NDMA SACHET CAP feed, Severe/Extreme covering Wayanad, polled by beat every 5 min),
**RESPONDER** (published by an authenticated admin/disaster_manager), **DEMO** (explicitly labelled
"DEMO EMERGENCY — NOT A REAL WARNING"). The ML model is unvalidated and never triggers alerts.

## 2. Database (migration `7c1e5a2b9d40_emergency_response`)

| table | purpose |
|---|---|
| `emergency_profiles` | emergency contact, consent time, location/push permission state, installed-PWA flag |
| `user_locations` | last device fix per user — `geography(Point,4326)` + GIST `idx_user_locations_geog` |
| `push_subscriptions` | Web Push endpoint + keys, active flag, failure count, last error |
| `rescue_requests` | status, people count, location (geography, GIST), destination, journey, route, responder |
| `rescue_status_history` | every transition with actor and position |
| `alert_deliveries` | one row per alert × user × subscription: queued / sent / failed / expired / no_subscription / not_configured, HTTP status, error, distance, opened_at |
| `audit_logs` | responder access to personal data and all responder actions |
| `citizen_reports`, `alert_acknowledgements` | (pre-existing live tables, now migrated) |

Also: GIST index `idx_shelters_geography` on `shelters(geometry::geography)`, and `alerttype` gains `LANDSLIDE`.
Retention (beat, hourly): locations older than `EMERGENCY_LOCATION_RETENTION_HOURS`, resolved requests older than `EMERGENCY_RESCUE_RETENTION_DAYS`.

## 3. API (all under `/api/v1`)

Citizen (authenticated; own data only; coordinates only in request bodies):

| method | path | |
|---|---|---|
| GET | `/push/config` | `{configured, public_key, message}` — public |
| POST | `/push/subscribe` · `/push/unsubscribe` | browser PushSubscription (503 if VAPID not configured) |
| POST | `/push/test` | TEST notification to the caller's own devices, returns per-device result |
| POST | `/push/opened` | mark a delivery opened (notification click) |
| GET | `/emergency/me` | profile, permission state, location freshness, push status, active request, alerts within 20 km |
| PUT | `/emergency/profile` | name, phone, emergency contact, permission states |
| POST | `/emergency/location` | store a device fix |
| POST | `/emergency/request` | PIN MY LOCATION / I NEED RESCUE / I AM SAFE (creates or updates) |
| POST | `/emergency/{id}/people` · `/emergency/{id}/status` | people count · SAFE / NEEDS_ASSISTANCE / RESCUE_REQUESTED / EVACUATING |
| POST | `/emergency/nearby-safe-locations` | nearest designated safe locations with distance, bearing, route, ETA, route risk |
| POST | `/emergency/{id}/start-evacuation` | I'M GOING (route or `ROUTING DATA UNAVAILABLE`) |
| POST | `/emergency/{id}/reached` | REACHED HERE — 409 with real distance if too far |

Responders (`admin` / `disaster_manager`; audited):

| method | path | |
|---|---|---|
| GET | `/rescue/active` · `/rescue/summary` · `/rescue/responders` | people list (with contact), counts, assignable responders |
| GET | `/rescue/{id}` · `/rescue/{id}/route` | detail + history · route to chosen/nearest safe location |
| POST | `/rescue/{id}/assign` · `/rescue/{id}/status` | assign responder · EVACUATING / RESOLVED |
| POST | `/live/alerts/preview` | affected users + reachable-by-push for an area (PostGIS) |
| POST | `/live/alerts` | publish (queues targeted push on Celery for WARNING/CRITICAL or DEMO) |
| GET | `/live/alerts/{id}/deliveries` | delivery breakdown |
| GET/POST | `/safe-locations` · `/safe-locations/{id}/deactivate` | list (public) · designate (requires `verification`) · deactivate |

Real time: `GET /live/stream?token=…` (SSE). Channels: `fg:public`, `fg:responders`, `fg:user:<id>`.
Events: `alert.*`, `rescue.created|updated|location|journey|reached|assigned`, `alert.delivery`, `safe_location.changed`.

Status model (identical in `backend/app/models/emergency.py` and `frontend/src/emergency/status.ts`; a test enforces parity):
`SAFE, NEEDS_ASSISTANCE, LOCATION_PINNED, RESCUE_REQUESTED, RESPONDER_ASSIGNED, EVACUATING, EN_ROUTE_TO_SHELTER, REACHED_SAFE_LOCATION, RESOLVED`.
Citizens cannot resolve; REACHED is only reachable from EN_ROUTE via the GPS check.

## 4. Configuration

| variable | default | |
|---|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | — | required for push; generate with `docker compose exec backend python scripts/generate_vapid_keys.py --subject mailto:you@agency` |
| `EMERGENCY_LOCATION_STALE_MINUTES` | 15 | CONNECTED → STALE |
| `EMERGENCY_TARGET_LOCATION_MAX_AGE_HOURS` | 24 | older locations are not targeted |
| `EMERGENCY_ARRIVAL_RADIUS_M` | 200 | arrival allowance (+ GPS accuracy, capped at 300 m) |
| `EMERGENCY_LOCATION_RETENTION_HOURS` / `EMERGENCY_RESCUE_RETENTION_DAYS` | 72 / 30 | retention |
| `EMERGENCY_AUTO_OFFICIAL_ALERTS` | true | push official SACHET Severe/Extreme alerts for Wayanad |
| `ROUTING_FOOT_BASE_URL` / `ROUTING_BASE_URL` | FOSSGIS OSRM foot / OSRM demo driving | public demo servers — use your own OSRM in production |
| `VITE_ALLOWED_HOSTS` | — | extra dev-server hostnames (HTTPS tunnel for phone testing) |

Responder accounts are never self-registered: `docker compose exec backend python scripts/create_responder.py --email … --role disaster_manager`.

## 5. Install the PWA

Web Push, service workers and geolocation require **HTTPS** (or `localhost` on the same machine). A phone on the LAN over `http://192.168…` will not work.

* **Android (Chrome/Edge):** open `https://<host>/emergency` → **INSTALL FLOODGUARD** (or browser menu → *Install app*) → open from the home screen.
* **iPhone/iPad (iOS 16.4+):** Safari → Share → **Add to Home Screen** → open FloodGuard *from the Home Screen*. Push only works in the installed app on iOS.
* **Desktop Chrome/Edge:** install icon in the address bar.

Phone testing from a dev machine (your choice of tunnel; this publishes the dev site on a public URL while it runs):

```
cloudflared tunnel --url http://localhost:80
VITE_ALLOWED_HOSTS=.trycloudflare.com docker compose up -d frontend
```

## 6. Emergency notifications

1. VAPID keys in `.env` → `docker compose up -d backend celery-worker celery-beat`. `GET /api/v1/push/config` must report `configured: true`.
2. In the app: sign in → **ALLOW EMERGENCY ALERTS** (the permission prompt appears only on this tap) → **SEND TEST NOTIFICATION**.
3. Share location (**SHARE MY LOCATION** / **PIN MY LOCATION**) — alerts are targeted with `ST_DWithin(user location, alert area)` on locations ≤ 24 h old.
4. The OS decides how the notification is shown: silent mode, Do Not Disturb/Focus, battery savers and per-app notification settings apply and cannot be overridden by a web app. `requireInteraction` + vibration pattern are requested for WARNING/CRITICAL; the in-app alarm plays only while the app is open.

## 7. Demo procedure

1. `docker compose up -d` — all 7 services healthy (`docker compose ps`).
2. Responder: open `/` on a laptop → **Responder** → sign in (dev credentials: `backend/.cache/dev_responder.json`).
3. Responder: **RESCUE PEOPLE** → *Safe loc.* → click a real school / hall on the map → name, capacity, verification (tick **DEMO** for exercises) → **Designate**.
4. Citizen (phone via HTTPS): open `/emergency` → Register → install → **ALLOW EMERGENCY ALERTS** → **SEND TEST NOTIFICATION** → **SHARE MY LOCATION** (real GPS).
5. Responder: select the citizen's area on the map (or any point) → **Command → Create alert** → Radius 0.5–2 km, tick **DEMO / SIMULATION** → **Send DEMO emergency alert…** → review area, risk, affected users → **SEND ALERT**.
6. Phone: push notification "DEMO EMERGENCY — NOT A REAL WARNING" → tap → Emergency Response Mode.
7. Phone: choose people count → **I NEED RESCUE** → responder map shows a red marker; **RESCUE PERSON** → *View location*, *Show route*, **Assign** (phone shows "Responder assigned" live).
8. Phone: **FIND SAFE LOCATION** → **GO HERE** → **I'M GOING** → journey map with the real route (or ROUTING DATA UNAVAILABLE); marker moves only with the phone's real GPS.
9. Walk to the location → **REACHED HERE** → GPS check → **✓ YOU ARE SAFE**; responder marker turns green → **Mark resolved**.
10. Clean up: cancel the DEMO alert (Command → Alerts → Cancel alert); deactivate DEMO safe locations.

Automated equivalents: `docker compose exec backend pytest -q tests/` and `docker compose exec backend python scripts/emergency_smoke.py`.

## 8. Known limitations (browser / OS)

* No background GPS in browsers: location is shared when a button is pressed or while the journey screen is open (`watchPosition`, foreground only). Responders see the last position and its age.
* iOS: push only for Home-Screen-installed PWAs (iOS 16.4+); no `beforeinstallprompt` (manual Add to Home Screen); vibration API unsupported.
* Notification sound/vibration obey OS settings (silent, DND/Focus, per-app); delivery by push services (FCM/APNs/Mozilla) is best-effort and may be delayed on battery-saving devices. "sent" in `alert_deliveries` means *accepted by the push service*, not *seen*; `opened_at` records a tap.
* Embedded/in-app browsers (e.g. IDE preview panes, some social-app webviews) may block service workers, notifications and geolocation; the app reports the exact reason.
* Routing uses public OSRM demo servers (fair-use, no SLA, no live road closures). Route risk = worst active alert area crossed; it does not model live flooding on the road.
* Safe locations exist only when responders designate them (OpenStreetMap has no mapped relief camps for Wayanad).
