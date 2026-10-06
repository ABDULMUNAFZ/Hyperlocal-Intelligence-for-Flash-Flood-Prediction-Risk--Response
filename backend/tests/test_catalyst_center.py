"""Offline unit tests for the Cisco Catalyst Center integration (HTTP is mocked; no network access).

Payload shapes follow the Catalyst Center Intent API. Live behaviour is checked separately against
the real sandbox; nothing here is presented as real Cisco data.
"""

import json
import logging
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-0123456789")

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import settings
from app.services.catalyst_center import normalize, service
from app.services.catalyst_center.client import CatalystCenterClient, CatalystCenterError

BASE = "https://cc.test"
USER = "unit-user"
PASSWORD = "unit-pass-DO-NOT-LEAK"
TOKEN = "unit-token-DO-NOT-LEAK"

DEVICE_HEALTH = {"response": [
    {"name": "edge-1", "ipAddress": "10.0.0.1", "deviceFamily": "Routers", "overallHealth": 10, "issueCount": 0},
    {"name": "access-1", "ipAddress": "10.0.0.2", "deviceFamily": "Switches and Hubs", "overallHealth": 6},
    {"name": "wlc-1", "ipAddress": "10.0.0.3", "deviceFamily": "Wireless Controller", "overallHealth": 2},
    {"name": "ap-1", "ipAddress": "10.0.0.4", "deviceFamily": "Unified AP", "overallHealth": 0},
]}
NETWORK_HEALTH = {"response": [{"healthScore": 75, "totalCount": 4, "goodCount": 1, "fairCount": 1, "badCount": 1, "unmonCount": 1, "timeinMillis": 1700000000000}]}
SITE_HEALTH = {"response": [{"siteName": "Global", "siteType": "area", "networkHealthAverage": 75, "healthyNetworkDevicePercentage": 50, "numberOfNetworkDevice": 4}]}


def make_handler(routes, calls):
    """routes: {path: [response, ...]} consumed in order (last one repeats)."""

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        queue = routes.get(request.url.path)
        if not queue:
            return httpx.Response(404, json={"error": "not found"})
        item = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(item, Exception):
            raise item
        return item

    return handler


def make_client(routes, calls=None):
    calls = [] if calls is None else calls
    return CatalystCenterClient(
        BASE, USER, SecretStr(PASSWORD), transport=httpx.MockTransport(make_handler(routes, calls)),
    ), calls


def token_ok():
    return httpx.Response(200, json={"Token": TOKEN})


# ------------------------------------------------------------------ client


@pytest.mark.asyncio
async def test_auth_success_sends_basic_auth_then_token_header():
    client, calls = make_client({
        "/dna/system/api/v1/auth/token": [token_ok()],
        "/dna/intent/api/v1/network-device/count": [httpx.Response(200, json={"response": 4})],
    })
    assert normalize.device_count(await client.get("network-device/count")) == 4
    assert calls[0].method == "POST" and calls[0].headers["authorization"].startswith("Basic ")
    assert calls[1].headers["x-auth-token"] == TOKEN
    await client.aclose()


@pytest.mark.asyncio
async def test_token_is_cached_between_calls():
    client, calls = make_client({
        "/dna/system/api/v1/auth/token": [token_ok()],
        "/dna/intent/api/v1/issues": [httpx.Response(200, json={"response": []})],
    })
    await client.get("issues")
    await client.get("issues")
    assert sum(c.url.path.endswith("/auth/token") for c in calls) == 1
    await client.aclose()


@pytest.mark.asyncio
async def test_401_refreshes_token_and_retries_once():
    client, calls = make_client({
        "/dna/system/api/v1/auth/token": [token_ok()],
        "/dna/intent/api/v1/issues": [httpx.Response(401), httpx.Response(200, json={"response": []})],
    })
    assert await client.get("issues") == {"response": []}
    assert sum(c.url.path.endswith("/auth/token") for c in calls) == 2
    await client.aclose()


@pytest.mark.asyncio
async def test_persistent_401_raises_safe_auth_error():
    client, _ = make_client({
        "/dna/system/api/v1/auth/token": [token_ok()],
        "/dna/intent/api/v1/issues": [httpx.Response(401)],
    })
    with pytest.raises(CatalystCenterError) as err:
        await client.get("issues")
    assert err.value.public_message == "Authentication with Catalyst Center failed"
    await client.aclose()


@pytest.mark.asyncio
async def test_bad_credentials():
    client, _ = make_client({"/dna/system/api/v1/auth/token": [httpx.Response(401, text=f"bad {PASSWORD}")]})
    with pytest.raises(CatalystCenterError) as err:
        await client.authenticate()
    assert PASSWORD not in err.value.public_message
    await client.aclose()


@pytest.mark.asyncio
async def test_timeout_is_reported_safely():
    client, _ = make_client({"/dna/system/api/v1/auth/token": [httpx.ReadTimeout("slow")]})
    with pytest.raises(CatalystCenterError) as err:
        await client.authenticate()
    assert err.value.public_message == "Catalyst Center did not respond in time"
    await client.aclose()


@pytest.mark.asyncio
async def test_unreachable_host_is_reported_safely():
    client, _ = make_client({"/dna/system/api/v1/auth/token": [httpx.ConnectError("no route")]})
    with pytest.raises(CatalystCenterError) as err:
        await client.authenticate()
    assert err.value.public_message == "Catalyst Center is unreachable"
    await client.aclose()


@pytest.mark.asyncio
async def test_429_backs_off_and_retries_once():
    client, _ = make_client({
        "/dna/system/api/v1/auth/token": [token_ok()],
        "/dna/intent/api/v1/issues": [httpx.Response(429, headers={"Retry-After": "0"}), httpx.Response(200, json={"response": []})],
    })
    assert await client.get("issues") == {"response": []}
    await client.aclose()


# ------------------------------------------------------------------ normalization


def test_health_bands_follow_catalyst_center_scores():
    assert [normalize.health_band(s) for s in (10, 8, 7, 4, 3, 1, 0, None, "x")] == [
        "healthy", "healthy", "warning", "warning", "critical", "critical", "unknown", "unknown", "unknown",
    ]


def test_device_health_counts():
    out = normalize.device_health(DEVICE_HEALTH)
    assert (out["total"], out["healthy"], out["warning"], out["critical"], out["unknown"]) == (4, 1, 1, 1, 1)
    assert out["items"][0]["name"] == "edge-1"


def test_network_and_site_health():
    net = normalize.network_health(NETWORK_HEALTH)
    assert net["health_score"] == 75 and net["bad_count"] == 1 and net["measured_at"].startswith("2023-11-14")
    assert normalize.site_health(SITE_HEALTH)[0]["name"] == "Global"


def test_missing_fields_become_none_not_errors():
    assert normalize.devices({"response": [{}]})[0]["hostname"] is None
    assert normalize.network_health({"response": []}) is None
    assert normalize.issues({"unexpected": True}) == []
    assert normalize.device_count({"response": "n/a"}) is None


# ------------------------------------------------------------------ service + route


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(settings, "CATALYST_CENTER_URL", BASE)
    monkeypatch.setattr(settings, "CATALYST_CENTER_USERNAME", USER)
    monkeypatch.setattr(settings, "CATALYST_CENTER_PASSWORD", SecretStr(PASSWORD))
    service._ok_cache._mem.clear()
    service._fail_cache._mem.clear()
    yield
    service._client = None
    service._ok_cache._mem.clear()
    service._fail_cache._mem.clear()


def use_routes(routes):
    service._client, _ = make_client(routes)


@pytest.mark.asyncio
async def test_not_configured_returns_offline_envelope(monkeypatch):
    monkeypatch.setattr(settings, "CATALYST_CENTER_URL", None)
    out = await service.status()
    assert out["connected"] is False and out["configured"] is False
    assert out["source"] == "cisco_catalyst_center"


@pytest.mark.asyncio
async def test_health_view_is_tagged_and_has_no_secrets(configured, caplog):
    caplog.set_level(logging.DEBUG)
    use_routes({
        "/dna/system/api/v1/auth/token": [token_ok()],
        "/dna/intent/api/v1/device-health": [httpx.Response(200, json=DEVICE_HEALTH)],
        "/dna/intent/api/v1/network-health": [httpx.Response(200, json=NETWORK_HEALTH)],
        "/dna/intent/api/v1/site-health": [httpx.Response(200, json=SITE_HEALTH)],
    })
    out = await service.health()
    assert out["connected"] is True and out["source"] == "cisco_catalyst_center"
    assert out["devices"]["critical"] == 1 and out["network"]["health_score"] == 75
    blob = json.dumps(out) + caplog.text
    assert PASSWORD not in blob and TOKEN not in blob


@pytest.mark.asyncio
async def test_partial_health_reports_failed_part(configured):
    use_routes({
        "/dna/system/api/v1/auth/token": [token_ok()],
        "/dna/intent/api/v1/device-health": [httpx.Response(200, json=DEVICE_HEALTH)],
        "/dna/intent/api/v1/network-health": [httpx.Response(500)],
        "/dna/intent/api/v1/site-health": [httpx.Response(200, json=SITE_HEALTH)],
    })
    out = await service.health()
    assert out["connected"] is True and out["network"] is None and "network" in out["errors"]


@pytest.mark.asyncio
async def test_outage_costs_one_auth_attempt_per_view(configured):
    calls = []
    service._client, _ = make_client({"/dna/system/api/v1/auth/token": [httpx.ConnectError("down")]}, calls)
    assert (await service.health())["connected"] is False
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_outage_returns_offline_and_is_cached_briefly(configured):
    use_routes({"/dna/system/api/v1/auth/token": [httpx.ConnectError("down")]})
    first = await service.status()
    assert first == {**first, "connected": False, "error": "Catalyst Center is unreachable"}
    use_routes({"/dna/system/api/v1/auth/token": [token_ok()]})  # recovery is not hammered within FAILURE_TTL_S
    assert (await service.status())["connected"] is False


def test_summary_routes_are_public_inventory_requires_login_and_nothing_leaks(configured):
    from app.api.v1.endpoints import auth as auth_endpoints
    from app.api.v1.endpoints import catalyst_center

    app = FastAPI()
    app.include_router(catalyst_center.router, prefix="/api/v1")
    use_routes({"/dna/system/api/v1/auth/token": [httpx.Response(401, text=PASSWORD)]})
    with TestClient(app) as http:
        assert http.get("/api/v1/catalyst-center/devices").status_code == 401
        for path in ("status", "health", "events"):
            r = http.get(f"/api/v1/catalyst-center/{path}")
            assert r.status_code == 200 and r.json()["connected"] is False
            assert PASSWORD not in r.text and TOKEN not in r.text

    app.dependency_overrides[auth_endpoints.get_current_active_user] = lambda: object()
    with TestClient(app) as http:
        r = http.get("/api/v1/catalyst-center/devices")
        assert r.status_code == 200 and PASSWORD not in r.text


@pytest.mark.asyncio
async def test_public_health_view_has_no_management_ips(configured):
    use_routes({
        "/dna/system/api/v1/auth/token": [token_ok()],
        "/dna/intent/api/v1/device-health": [httpx.Response(200, json=DEVICE_HEALTH)],
        "/dna/intent/api/v1/network-health": [httpx.Response(200, json=NETWORK_HEALTH)],
        "/dna/intent/api/v1/site-health": [httpx.Response(200, json=SITE_HEALTH)],
    })
    out = await service.health()
    assert "10.0.0." not in json.dumps(out)
