"""Catalyst Center Intent API payloads -> FloodGuard shapes.

Pure functions, no I/O. Every field is read defensively: a missing or null upstream field becomes
None instead of an error, and nothing is invented. Device health uses Catalyst Center's own score
bands (overallHealth 1-10): 8-10 good, 4-7 fair, 1-3 poor; 0 or missing means no data.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

SOURCE = "cisco_catalyst_center"
SOURCE_LABEL = "Cisco Catalyst Center"


def _response(payload: Any) -> Any:
    return payload.get("response") if isinstance(payload, dict) else None


def _items(payload: Any) -> List[Dict[str, Any]]:
    data = _response(payload)
    return [d for d in data if isinstance(d, dict)] if isinstance(data, list) else []


def _num(value: Any) -> Optional[float]:
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value: Any) -> Optional[int]:
    n = _num(value)
    return int(n) if n is not None else None


def _str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _epoch_ms_iso(value: Any) -> Optional[str]:
    n = _num(value)
    if n is None or n <= 0:
        return _str(value)  # some fields are already ISO strings
    return datetime.fromtimestamp(n / 1000, tz=timezone.utc).isoformat(timespec="seconds")


def health_band(score: Any) -> str:
    """Map a Catalyst Center device health score to healthy | warning | critical | unknown."""
    n = _num(score)
    if n is None or n <= 0:
        return "unknown"
    if n >= 8:
        return "healthy"
    if n >= 4:
        return "warning"
    return "critical"


def device_count(payload: Any) -> Optional[int]:
    return _int(_response(payload))


def devices(payload: Any) -> List[Dict[str, Any]]:
    return [
        {
            "id": _str(d.get("id")),
            "hostname": _str(d.get("hostname")),
            "management_ip": _str(d.get("managementIpAddress")),
            "platform": _str(d.get("platformId")),
            "family": _str(d.get("family")),
            "role": _str(d.get("role")),
            "software_version": _str(d.get("softwareVersion")),
            "reachability": _str(d.get("reachabilityStatus")),
            "up_time": _str(d.get("upTime")),
        }
        for d in _items(payload)
    ]


def device_health(payload: Any) -> Dict[str, Any]:
    items = []
    counts = {"healthy": 0, "warning": 0, "critical": 0, "unknown": 0}
    for d in _items(payload):
        band = health_band(d.get("overallHealth"))
        counts[band] += 1
        items.append(
            {
                "name": _str(d.get("name")),
                "ip": _str(d.get("ipAddress")),
                "family": _str(d.get("deviceFamily")),
                "location": _str(d.get("location")),
                "health_score": _num(d.get("overallHealth")),
                "status": band,
                "reachability": _str(d.get("reachabilityHealth")),
                "issue_count": _int(d.get("issueCount")),
            }
        )
    return {"total": len(items), **counts, "items": items}


def network_health(payload: Any) -> Optional[Dict[str, Any]]:
    rows = _items(payload)
    if not rows:
        return None
    latest = rows[-1]
    return {
        "health_score": _num(latest.get("healthScore")),
        "total_count": _int(latest.get("totalCount")),
        "good_count": _int(latest.get("goodCount")),
        "fair_count": _int(latest.get("fairCount")),
        "bad_count": _int(latest.get("badCount")),
        "unmonitored_count": _int(latest.get("unmonCount")),
        "measured_at": _epoch_ms_iso(latest.get("timeinMillis")) or _str(latest.get("time")),
    }


def site_health(payload: Any) -> List[Dict[str, Any]]:
    return [
        {
            "name": _str(s.get("siteName")),
            "site_type": _str(s.get("siteType")),
            "network_health_score": _num(s.get("networkHealthAverage")),
            "healthy_network_device_pct": _num(s.get("healthyNetworkDevicePercentage")),
            "healthy_client_pct": _num(s.get("healthyClientsPercentage")),
            "network_device_count": _int(s.get("numberOfNetworkDevice")),
            "client_count": _int(s.get("numberOfClients")),
        }
        for s in _items(payload)
    ]


def issues(payload: Any) -> List[Dict[str, Any]]:
    return [
        {
            "id": _str(i.get("issueId")),
            "name": _str(i.get("name")),
            "priority": _str(i.get("priority")),
            "status": _str(i.get("status")),
            "category": _str(i.get("category")),
            "device_id": _str(i.get("deviceId")),
            "site_id": _str(i.get("siteId")),
            "last_occurred_at": _epoch_ms_iso(i.get("last_occurence_time")),
        }
        for i in _items(payload)
    ]
