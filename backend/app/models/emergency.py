"""Emergency response: push subscriptions, user locations, rescue requests, alert deliveries, audit log.

Existing tables are reused: `users` (identity, name, phone, role), `alerts` (responder/official
alerts), `shelters` (designated safe locations). Locations are PostGIS geography(Point, 4326)
with GIST indexes so targeting and nearest-shelter queries run in the database.
"""

import enum
import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class RescueStatus(str, enum.Enum):
    """Single source of truth for the rescue state machine (mirrored in frontend/src/emergency/status.ts)."""
    SAFE = "SAFE"
    NEEDS_ASSISTANCE = "NEEDS_ASSISTANCE"
    LOCATION_PINNED = "LOCATION_PINNED"
    RESCUE_REQUESTED = "RESCUE_REQUESTED"
    RESPONDER_ASSIGNED = "RESPONDER_ASSIGNED"
    EVACUATING = "EVACUATING"
    EN_ROUTE_TO_SHELTER = "EN_ROUTE_TO_SHELTER"
    REACHED_SAFE_LOCATION = "REACHED_SAFE_LOCATION"
    RESOLVED = "RESOLVED"


class EmergencyProfile(Base):
    """Emergency-specific profile and consent state for a registered user (1:1 with users)."""
    __tablename__ = "emergency_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    emergency_contact_name: Mapped[str] = mapped_column(String(255), nullable=True)
    emergency_contact_phone: Mapped[str] = mapped_column(String(32), nullable=True)
    location_consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    location_permission: Mapped[str] = mapped_column(String(16), nullable=True)  # granted | denied | prompt | unsupported
    push_permission: Mapped[str] = mapped_column(String(16), nullable=True)      # granted | denied | default | unsupported
    installed_pwa: Mapped[bool] = mapped_column(Boolean, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class UserLocation(Base):
    """Latest device-reported location per user (explicit, consented, from navigator.geolocation)."""
    __tablename__ = "user_locations"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    location = mapped_column(Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_m: Mapped[float] = mapped_column(Float, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(64), nullable=False)
    user_agent: Mapped[str] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_success_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RescueRequest(Base):
    __tablename__ = "rescue_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    people_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    note: Mapped[str] = mapped_column(Text, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # last pinned / updated device position
    location = mapped_column(Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_m: Mapped[float] = mapped_column(Float, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # evacuation journey
    safe_location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shelters.id", ondelete="SET NULL"), nullable=True)
    journey_status: Mapped[str] = mapped_column(String(24), nullable=True)  # NOT_STARTED | EN_ROUTE | ARRIVED
    journey_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    journey_start_lat: Mapped[float] = mapped_column(Float, nullable=True)
    journey_start_lon: Mapped[float] = mapped_column(Float, nullable=True)
    route: Mapped[dict] = mapped_column(JSONB, nullable=True)  # routing result (geometry, distance, duration, source) or null
    arrived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    arrival_distance_m: Mapped[float] = mapped_column(Float, nullable=True)
    # responder
    assigned_responder_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class RescueStatusHistory(Base):
    __tablename__ = "rescue_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rescue_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rescue_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status: Mapped[str] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AlertDelivery(Base):
    __tablename__ = "alert_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("push_subscriptions.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False)  # queued | sent | failed | expired | no_subscription | not_configured
    http_status: Mapped[int] = mapped_column(Integer, nullable=True)
    error: Mapped[str] = mapped_column(Text, nullable=True)
    distance_m: Mapped[float] = mapped_column(Float, nullable=True)  # user distance to the alert area at targeting time (0 = inside)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditLog(Base):
    """Who accessed or changed sensitive emergency data (locations, rescue requests, alerts)."""
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=True)
    target_id: Mapped[str] = mapped_column(String(64), nullable=True)
    ip: Mapped[str] = mapped_column(String(64), nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
