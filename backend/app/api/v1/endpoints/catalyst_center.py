# Cisco Catalyst Center — read-only network-infrastructure status.
#
#   GET /api/v1/catalyst-center/status   public: connected, controller, device count, last sync
#   GET /api/v1/catalyst-center/health   public: device health bands, network health, site health
#   GET /api/v1/catalyst-center/events   public: active issues
#   GET /api/v1/catalyst-center/devices  signed-in users: full inventory incl. management IPs
#
# The public views carry aggregate status only (no management IPs) and are served from a 45 s cache, so
# dashboard traffic cannot hammer the controller. Always HTTP 200 with a "connected" flag: a Cisco outage
# is reported in the body and never raised. Every payload carries "source": "cisco_catalyst_center".
from typing import Any, Dict

from fastapi import APIRouter, Depends

from app.api.v1.endpoints.auth import get_current_active_user
from app.models.core import User
from app.services.catalyst_center import service

router = APIRouter(prefix="/catalyst-center", tags=["Cisco Catalyst Center"])


@router.get("/status")
async def catalyst_center_status() -> Dict[str, Any]:
    return await service.status()


@router.get("/devices")
async def catalyst_center_devices(_user: User = Depends(get_current_active_user)) -> Dict[str, Any]:
    return await service.devices()


@router.get("/health")
async def catalyst_center_health() -> Dict[str, Any]:
    return await service.health()


@router.get("/events")
async def catalyst_center_events() -> Dict[str, Any]:
    return await service.events()
