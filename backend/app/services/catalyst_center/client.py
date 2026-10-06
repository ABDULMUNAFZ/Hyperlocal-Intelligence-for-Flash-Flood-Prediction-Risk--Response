"""Cisco Catalyst Center REST client (server-side only).

Auth: POST /dna/system/api/v1/auth/token with HTTP Basic -> {"Token": ...}; the token is sent as
X-Auth-Token on Intent API calls. The token lives only in this process's memory and is never logged
or returned to callers. Every failure is raised as CatalystCenterError with a fixed, safe message
(no upstream bodies, which can echo request details).
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional

import httpx
from pydantic import SecretStr

logger = logging.getLogger(__name__)

TOKEN_PATH = "/dna/system/api/v1/auth/token"
INTENT_PREFIX = "/dna/intent/api/v1"
# Catalyst Center tokens are valid for 60 minutes; refresh a little early.
TOKEN_MAX_AGE_S = 50 * 60
MAX_RETRY_AFTER_S = 5.0


class CatalystCenterError(Exception):
    """A Catalyst Center call failed. `public_message` is safe to show to API clients."""

    def __init__(self, public_message: str, *, status: Optional[int] = None):
        super().__init__(public_message)
        self.public_message = public_message
        self.status = status


class CatalystCenterClient:
    def __init__(
        self,
        base_url: str,
        username: str,
        password: SecretStr,
        *,
        verify_ssl: bool = True,
        timeout: float = 15.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._username = username
        self._password = password
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            verify=verify_ssl,
            timeout=httpx.Timeout(timeout, connect=min(timeout, 10.0)),
            headers={"Accept": "application/json"},
            transport=transport,
        )
        self._token: Optional[str] = None
        self._token_at = 0.0
        self._token_lock = asyncio.Lock()

    async def aclose(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------ transport

    async def _send(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        """One HTTP exchange with logging (endpoint, status, latency only) and safe error mapping."""
        started = time.perf_counter()
        try:
            resp = await self._client.request(method, path, **kwargs)
        except httpx.TimeoutException as exc:
            logger.warning("catalyst_center %s %s -> timeout after %.0f ms", method, path, (time.perf_counter() - started) * 1000)
            raise CatalystCenterError("Catalyst Center did not respond in time") from exc
        except httpx.TransportError as exc:
            logger.warning("catalyst_center %s %s -> unreachable (%s)", method, path, type(exc).__name__)
            raise CatalystCenterError("Catalyst Center is unreachable") from exc
        logger.info("catalyst_center %s %s -> %s in %.0f ms", method, path, resp.status_code, (time.perf_counter() - started) * 1000)
        return resp

    async def _token_value(self, *, force: bool = False) -> str:
        async with self._token_lock:
            if not force and self._token is not None and (time.monotonic() - self._token_at) < TOKEN_MAX_AGE_S:
                return self._token
            resp = await self._send(
                "POST", TOKEN_PATH, auth=(self._username, self._password.get_secret_value()),
            )
            if resp.status_code in (401, 403):
                raise CatalystCenterError("Authentication with Catalyst Center failed", status=resp.status_code)
            if resp.status_code != 200:
                raise CatalystCenterError(f"Catalyst Center authentication returned HTTP {resp.status_code}", status=resp.status_code)
            try:
                token = resp.json().get("Token")
            except ValueError:
                token = None
            if not token:
                raise CatalystCenterError("Catalyst Center authentication returned no token", status=resp.status_code)
            self._token, self._token_at = token, time.monotonic()
            return token

    # ------------------------------------------------------------------ API

    async def authenticate(self) -> None:
        """Force a fresh token (used by the status check)."""
        await self._token_value(force=True)

    async def ensure_authenticated(self) -> None:
        """Get a token before fanning out parallel calls, so an outage costs one auth attempt, not one per call."""
        await self._token_value()

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """GET an Intent API resource (path relative to /dna/intent/api/v1) and return its JSON."""
        url = f"{INTENT_PREFIX}/{path.lstrip('/')}"
        refreshed = backed_off = False
        while True:
            token = await self._token_value()
            resp = await self._send("GET", url, params=params, headers={"X-Auth-Token": token})
            if resp.status_code == 401 and not refreshed:
                refreshed = True  # token expired or revoked: re-authenticate once
                await self._token_value(force=True)
                continue
            if resp.status_code == 429 and not backed_off:
                backed_off = True
                try:
                    wait = float(resp.headers.get("Retry-After", "1"))
                except ValueError:
                    wait = 1.0
                await asyncio.sleep(max(0.0, min(wait, MAX_RETRY_AFTER_S)))
                continue
            break
        if resp.status_code == 401:
            raise CatalystCenterError("Authentication with Catalyst Center failed", status=401)
        if resp.status_code == 429:
            raise CatalystCenterError("Catalyst Center rate limit reached; try again shortly", status=429)
        if resp.status_code in (403, 404):
            raise CatalystCenterError(f"This Catalyst Center API is not available (HTTP {resp.status_code})", status=resp.status_code)
        if resp.status_code != 200:
            raise CatalystCenterError(f"Catalyst Center returned HTTP {resp.status_code}", status=resp.status_code)
        try:
            return resp.json()
        except ValueError as exc:
            raise CatalystCenterError("Catalyst Center returned an unreadable response", status=resp.status_code) from exc
