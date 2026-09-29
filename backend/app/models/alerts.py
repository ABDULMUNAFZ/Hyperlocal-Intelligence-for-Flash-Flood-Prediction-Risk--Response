# FloodGuard Database Models - Alerts & AI Assistant
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func, Enum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
from app.models.core import TimestampMixin
import uuid
from datetime import datetime
import enum


class AlertSeverity(str, enum.Enum):
    INFO = "info"
    WATCH = "watch"
    WARNING = "warning"
    SEVERE = "severe"
    EXTREME = "extreme"


class AlertStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    UPDATED = "updated"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class AlertType(str, enum.Enum):
    FLOOD_RISK = "flood_risk"
    FLASH_FLOOD = "flash_flood"
    RIVER_FLOOD = "river_flood"
    DAM_BREAK = "dam_break"
    EVACUATION = "evacuation"
    ROAD_CLOSURE = "road_closure"
    SHELTER_OPEN = "shelter_open"
    WEATHER = "weather"
    LANDSLIDE = "landslide"
    TEST = "test"


class Alert(Base, TimestampMixin):
    """Flood alerts and warnings."""
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    alert_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)  # CAP-compatible ID
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    instruction: Mapped[str] = mapped_column(Text, nullable=True)
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False, index=True)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False, index=True)
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus), default=AlertStatus.DRAFT, nullable=False, index=True)
    urgency: Mapped[str] = mapped_column(String(20), nullable=True)  # immediate, expected, future, past
    certainty: Mapped[str] = mapped_column(String(20), nullable=True)  # observed, likely, possible, unlikely
    # Geographic
    affected_regions: Mapped[list] = mapped_column(ARRAY(UUID), default=list)  # Region IDs
    geometry: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True),
        nullable=True,
    )
    # Timing
    onset: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    expires: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # Source
    source: Mapped[str] = mapped_column(String(100), nullable=False)  # floodguard, imd, ndma, state_dma
    author: Mapped[str] = mapped_column(String(255), nullable=True)
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # CAP fields
    cap_identifier: Mapped[str] = mapped_column(String(255), nullable=True)
    cap_sender: Mapped[str] = mapped_column(String(255), nullable=True)
    cap_sent: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    cap_status: Mapped[str] = mapped_column(String(50), nullable=True)
    cap_msgType: Mapped[str] = mapped_column(String(50), nullable=True)
    cap_scope: Mapped[str] = mapped_column(String(50), nullable=True)
    # Dissemination
    channels: Mapped[list] = mapped_column(ARRAY(String), default=list)  # push, sms, email, siren, radio, tv, web
    languages: Mapped[list] = mapped_column(ARRAY(String), default=["en"])
    # Metrics
    recipients_count: Mapped[int] = mapped_column(Integer, default=0)
    acknowledged_count: Mapped[int] = mapped_column(Integer, default=0)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    subscriptions = relationship("AlertSubscription", back_populates="alert")

    __table_args__ = (
        Index("idx_alerts_status_severity", "status", "severity"),
        Index("idx_alerts_timing", "onset", "expires"),
    )


class AlertSubscription(Base):
    """User subscriptions to location-based alerts."""
    __tablename__ = "alert_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("regions.id", ondelete="CASCADE"),
        nullable=True,
    )
    min_severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), default=AlertSeverity.WATCH)
    channels: Mapped[list] = mapped_column(ARRAY(String), default=["push"])
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="alert_subscriptions")
    alert = relationship("Alert", back_populates="subscriptions")

    __table_args__ = (
        UniqueConstraint("user_id", "alert_id", name="uq_alert_sub_user_alert"),
        Index("idx_alert_sub_user_active", "user_id", "is_active"),
    )


class AlertTemplate(Base):
    """Pre-defined alert templates for common scenarios."""
    __tablename__ = "alert_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    title_template: Mapped[str] = mapped_column(String(255), nullable=False)
    description_template: Mapped[str] = mapped_column(Text, nullable=False)
    instruction_template: Mapped[str] = mapped_column(Text, nullable=True)
    default_channels: Mapped[list] = mapped_column(ARRAY(String), default=["push", "web"])
    default_languages: Mapped[list] = mapped_column(ARRAY(String), default=["en", "hi", "ta", "kn", "ml", "te"])
    parameters: Mapped[list] = mapped_column(JSONB, default=list)  # Required parameters for template
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)


class AIConversation(Base):
    """AI Assistant conversation history."""
    __tablename__ = "ai_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(10), default="en")
    context: Mapped[dict] = mapped_column(JSONB, default=dict)  # Current prediction context
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_ai_conv_user_session", "user_id", "session_id"),
    )


class AIMessage(Base):
    """Individual messages in AI conversation."""
    __tablename__ = "ai_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user, assistant, system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), default="text")  # text, markdown, geojson, chart
    citations: Mapped[list] = mapped_column(JSONB, default=list)  # Source references
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=True)
    model: Mapped[str] = mapped_column(String(100), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    conversation = relationship("AIConversation", back_populates="messages")

    __table_args__ = (
        Index("idx_ai_msg_conv_created", "conversation_id", "created_at"),
    )