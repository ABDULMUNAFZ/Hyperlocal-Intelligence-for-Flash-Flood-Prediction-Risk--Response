"""
Official alerts from NDMA SACHET — India's Common Alerting Protocol (CAP) platform.

Feed: https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml
Each RSS item links to a CAP 1.2 XML message. An alert is treated as covering
Wayanad when any of the following hold:
  • a <geocode> "LGD District Code" equals 567 (Wayanad), or
  • <areaDesc>/<headline> names Wayanad (English or Malayalam), or
  • an inline CAP <polygon>/<circle> intersects the Wayanad district boundary.
FloodGuard never creates alerts itself; this module only relays issued alerts.
"""

from __future__ import annotations

import asyncio
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from shapely.geometry import Point, Polygon

from app.services.geo.common import (
    WAYANAD_LGD_DISTRICT_CODE, TTLCache, get_client, provenance, utcnow_iso, wayanad_geometry,
)

logger = logging.getLogger(__name__)

RSS_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
SOURCE = "NDMA SACHET — Common Alerting Protocol feed (Govt. of India)"
NS = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}
WAYANAD_NAMES = ("wayanad", "wynad", "വയനാട്")

_feed_cache = TTLCache("cap_feed", ttl_seconds=5 * 60)
_msg_cache = TTLCache("cap_msg", ttl_seconds=3 * 24 * 3600, persist=True, max_items=5000)


def _txt(el: Optional[ET.Element], path: str) -> Optional[str]:
    if el is None:
        return None
    found = el.find(path, NS)
    return found.text.strip() if found is not None and found.text else None


def _parse_cap(xml_text: str) -> Optional[Dict[str, Any]]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None
    info = root.find("cap:info", NS)
    areas = []
    geocodes: List[str] = []
    polygons: List[List[List[float]]] = []
    circles: List[List[float]] = []
    if info is not None:
        for area in info.findall("cap:area", NS):
            desc = _txt(area, "cap:areaDesc")
            if desc:
                areas.append(desc)
            for gc in area.findall("cap:geocode", NS):
                name = _txt(gc, "cap:valueName") or ""
                val = _txt(gc, "cap:value")
                if val and "district" in name.lower():
                    geocodes.append(val.strip())
            for pg in area.findall("cap:polygon", NS):
                if pg.text:
                    pts = []
                    for pair in pg.text.strip().split():
                        try:
                            la, lo = pair.split(",")[:2]
                            pts.append([float(lo), float(la)])
                        except ValueError:
                            continue
                    if len(pts) >= 3:
                        polygons.append(pts)
            for cc in area.findall("cap:circle", NS):
                if cc.text:
                    try:
                        center, radius = cc.text.strip().split()
                        la, lo = center.split(",")
                        circles.append([float(lo), float(la), float(radius)])
                    except ValueError:
                        continue
    return {
        "identifier": _txt(root, "cap:identifier"),
        "sender": _txt(root, "cap:sender"),
        "sent": _txt(root, "cap:sent"),
        "status": _txt(root, "cap:status"),
        "msg_type": _txt(root, "cap:msgType"),
        "language": _txt(info, "cap:language"),
        "category": _txt(info, "cap:category"),
        "event": _txt(info, "cap:event"),
        "urgency": _txt(info, "cap:urgency"),
        "severity": _txt(info, "cap:severity"),
        "certainty": _txt(info, "cap:certainty"),
        "effective": _txt(info, "cap:effective"),
        "onset": _txt(info, "cap:onset"),
        "expires": _txt(info, "cap:expires"),
        "headline": _txt(info, "cap:headline"),
        "description": _txt(info, "cap:description"),
        "instruction": _txt(info, "cap:instruction"),
        "sender_name": _txt(info, "cap:senderName"),
        "areas": areas,
        "lgd_district_codes": geocodes,
        "polygons": polygons,
        "circles": circles,
    }


def _covers_wayanad(msg: Dict[str, Any]) -> Optional[str]:
    if WAYANAD_LGD_DISTRICT_CODE in msg["lgd_district_codes"]:
        return "LGD district code 567"
    text = " ".join([*(msg["areas"] or []), msg.get("headline") or ""]).lower()
    if any(n in text for n in WAYANAD_NAMES):
        return "area description names Wayanad"
    w = wayanad_geometry()
    for pts in msg["polygons"]:
        try:
            if Polygon(pts).buffer(0).intersects(w):
                return "alert polygon intersects Wayanad"
        except Exception:  # noqa: BLE001
            continue
    for lo, la, rkm in msg["circles"]:
        if Point(lo, la).buffer(rkm / 111.0).intersects(w):
            return "alert circle intersects Wayanad"
    return None


def _is_active(expires: Optional[str]) -> bool:
    if not expires:
        return True
    try:
        return datetime.fromisoformat(expires) > datetime.now(timezone.utc)
    except ValueError:
        return True


async def _fetch_message(link: str, ident: str) -> Optional[Dict[str, Any]]:
    async def fetch() -> Optional[Dict[str, Any]]:
        r = await get_client().get(link, timeout=20)
        r.raise_for_status()
        parsed = _parse_cap(r.text)
        if parsed:
            parsed["link"] = link
        return parsed

    try:
        return await _msg_cache.get_or_create(TTLCache.key("cap", ident), fetch)
    except Exception as exc:  # noqa: BLE001
        logger.info("CAP message %s failed: %s", ident, exc)
        return None


async def wayanad_alerts(include_expired: bool = False) -> Dict[str, Any]:
    async def fetch_feed() -> Dict[str, Any]:
        r = await get_client().get(RSS_URL, timeout=30)
        r.raise_for_status()
        return {"xml": r.text, "retrieved_at": utcnow_iso()}

    try:
        feed = await _feed_cache.get_or_create("rss", fetch_feed)
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "alerts": [], "provenance": provenance(SOURCE, kind="OBSERVED", status="UNAVAILABLE", url=RSS_URL, notes=str(exc))}

    items = re.findall(r"<item>(.*?)</item>", feed["xml"], re.S)
    entries = []
    for it in items:
        link = re.search(r"<link>(.*?)</link>", it)
        guid = re.search(r"<guid[^>]*>(.*?)</guid>", it)
        if link and guid:
            entries.append((link.group(1).replace("&amp;", "&"), guid.group(1)))

    sem = asyncio.Semaphore(8)

    async def bounded(link: str, ident: str):
        async with sem:
            return await _fetch_message(link, ident)

    messages = await asyncio.gather(*(bounded(l, g) for l, g in entries))
    alerts = []
    for msg in messages:
        if not msg:
            continue
        reason = _covers_wayanad(msg)
        if not reason:
            continue
        active = _is_active(msg.get("expires"))
        if not active and not include_expired:
            continue
        alerts.append({**{k: v for k, v in msg.items() if k not in ("polygons", "circles")}, "active": active, "match_reason": reason})
    alerts.sort(key=lambda a: a.get("sent") or "", reverse=True)
    return {
        "available": True,
        "scanned_messages": len(entries),
        "alerts": alerts,
        "provenance": provenance(SOURCE, kind="OBSERVED", status="LIVE", retrieved_at=feed["retrieved_at"], url=RSS_URL,
                                 notes="Only alerts issued by authorities through SACHET are shown. An empty list means no current SACHET alert covers Wayanad — not that conditions are safe."),
    }
