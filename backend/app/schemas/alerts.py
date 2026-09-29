# FloodGuard API Schemas - Alerts & AI Assistant
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal, ClassVar
from datetime import datetime
from uuid import UUID


class AlertBase(BaseModel):
    title: str
    description: str
    instruction: Optional[str] = None
    alert_type: Literal["flood_risk", "flash_flood", "river_flood", "dam_break", "evacuation", "road_closure", "shelter_open", "weather", "test"]
    severity: Literal["info", "watch", "warning", "severe", "extreme"]
    urgency: Optional[Literal["immediate", "expected", "future", "past"]] = None
    certainty: Optional[Literal["observed", "likely", "possible", "unlikely"]] = None
    affected_regions: List[UUID] = []
    geometry: Optional[Dict[str, Any]] = None
    onset: Optional[datetime] = None
    expires: Optional[datetime] = None
    source: str = "floodguard"
    channels: List[str] = ["push", "web"]
    languages: List[str] = ["en"]


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    instruction: Optional[str] = None
    severity: Optional[Literal["info", "watch", "warning", "severe", "extreme"]] = None
    status: Optional[Literal["draft", "active", "updated", "cancelled", "expired"]] = None
    expires: Optional[datetime] = None
    channels: Optional[List[str]] = None


class AlertResponse(AlertBase):
    id: UUID
    alert_id: str
    status: str
    author: Optional[str] = None
    author_id: Optional[UUID] = None
    sent_at: Optional[datetime] = None
    cap_identifier: Optional[str] = None
    cap_sender: Optional[str] = None
    cap_status: Optional[str] = None
    cap_msgType: Optional[str] = None
    cap_scope: Optional[str] = None
    recipients_count: int
    acknowledged_count: int
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertQueryParams(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    alert_type: Optional[str] = None
    region_id: Optional[UUID] = None
    since: Optional[datetime] = None
    until: Optional[datetime] = None
    limit: int = Field(50, ge=1, le=200)


class AlertSubscriptionBase(BaseModel):
    region_id: Optional[UUID] = None
    min_severity: Literal["info", "watch", "warning", "severe", "extreme"] = "watch"
    channels: List[str] = ["push"]


class AlertSubscriptionCreate(AlertSubscriptionBase):
    pass


class AlertSubscriptionResponse(AlertSubscriptionBase):
    id: UUID
    user_id: UUID
    alert_id: Optional[UUID] = None
    is_active: bool
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertTemplateResponse(BaseModel):
    id: UUID
    name: str
    alert_type: str
    severity: str
    title_template: str
    description_template: str
    instruction_template: Optional[str] = None
    default_channels: List[str]
    default_languages: List[str]
    parameters: List[Dict[str, Any]]
    is_active: bool
    metadata: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)


# AI Assistant
class AIChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: str = "en"
    context: Optional[Dict[str, Any]] = None  # Prediction context
    include_citations: bool = True


class AIChatResponse(BaseModel):
    message_id: UUID
    conversation_id: UUID
    session_id: str
    response: str
    content_type: str = "text"
    citations: List[Dict[str, Any]] = []
    tokens_used: Optional[int] = None
    model: Optional[str] = None
    latency_ms: Optional[int] = None
    suggested_actions: List[str] = []


class AIConversationResponse(BaseModel):
    id: UUID
    session_id: str
    language: str
    context: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AIMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    content_type: str
    citations: List[Dict[str, Any]] = []
    tokens_used: Optional[int] = None
    model: Optional[str] = None
    latency_ms: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AIQueryTypes(BaseModel):
    """Supported query types for the AI assistant."""
    RISK_EXPLANATION: ClassVar[str] = "risk_explanation"
    EVACUATION_GUIDANCE: ClassVar[str] = "evacuation_guidance"
    SCENARIO_COMPARISON: ClassVar[str] = "scenario_comparison"
    HISTORICAL_CONTEXT: ClassVar[str] = "historical_context"
    PREPAREDNESS_TIPS: ClassVar[str] = "preparedness_tips"
    TECHNICAL_DETAILS: ClassVar[str] = "technical_details"