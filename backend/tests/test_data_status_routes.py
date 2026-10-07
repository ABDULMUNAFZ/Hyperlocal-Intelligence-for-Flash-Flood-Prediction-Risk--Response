"""Route-order regression: /data-sources/status must not be captured by /data-sources/{source_id}."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-0123456789")

from starlette.routing import Match

from app.main import app


def first_route_for(path: str, method: str = "GET"):
    scope = {"type": "http", "path": path, "method": method}
    for route in app.routes:
        match, _ = route.matches(scope)
        if match == Match.FULL:
            return route
    return None


def test_status_routes_resolve_to_data_status_handlers():
    assert first_route_for("/api/v1/data-sources/status").name == "get_data_source_status"
    assert first_route_for("/api/v1/data-sources/health-summary").endpoint.__module__.endswith("data_status")


def test_source_id_route_still_reachable():
    route = first_route_for("/api/v1/data-sources/00000000-0000-0000-0000-000000000000")
    assert route is not None and route.endpoint.__module__.endswith("data_sources")
