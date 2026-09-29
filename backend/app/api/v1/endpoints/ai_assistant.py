# FloodGuard AI Assistant Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from app.db.session import get_db
from app.models.alerts import AIConversation, AIMessage
from app.schemas.alerts import (
    AIChatRequest,
    AIChatResponse,
    AIConversationResponse,
    AIMessageResponse,
    AIQueryTypes,
)

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


# Mock AI responses for demonstration
MOCK_RESPONSES = {
    "risk_explanation": (
        "Based on the current flood risk assessment for your area, the risk level is **{risk_level}** "
        "(score: {risk_score:.1%}). This is primarily driven by:\n\n"
        "1. **Rainfall**: {rainfall_mm}mm in the last 24h ({rainfall_risk:.0%} contribution)\n"
        "2. **Terrain**: Steep slopes ({terrain_risk:.0%} contribution)\n"
        "3. **Soil**: {soil_type} with {saturation:.0%} saturation ({soil_risk:.0%} contribution)\n"
        "4. **Land cover**: {landcover_type} ({landcover_risk:.0%} contribution)\n\n"
        "**Recommendation**: {recommendation}"
    ),
    "evacuation_guidance": (
        "For your current location, here are the evacuation recommendations:\n\n"
        "**Nearest Safe Shelter**: {shelter_name} ({distance:.1f} km away)\n"
        "**Evacuation Route**: {route_description}\n"
        "**Estimated Time**: {time_minutes} minutes by {vehicle}\n"
        "**Route Status**: {route_status}\n\n"
        "**Important**: {safety_note}"
    ),
    "scenario_comparison": (
        "Comparing the requested scenarios:\n\n"
        "**Scenario A** ({scenario_a_name}):\n"
        "- Max flood depth: {depth_a:.1f}m\n"
        "- Affected area: {area_a:.1f} km²\n"
        "- Affected population: {pop_a:,}\n\n"
        "**Scenario B** ({scenario_b_name}):\n"
        "- Max flood depth: {depth_b:.1f}m\n"
        "- Affected area: {area_b:.1f} km²\n"
        "- Affected population: {pop_b:,}\n\n"
        "**Key Difference**: {difference}"
    ),
}


@router.post("/chat", response_model=AIChatResponse)
async def chat_with_ai(
    request: AIChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Chat with the AI disaster management assistant."""
    import uuid
    import time

    start_time = time.time()

    # Get or create conversation
    if request.session_id:
        conv_result = await db.execute(
            select(AIConversation).where(AIConversation.session_id == request.session_id)
        )
        conversation = conv_result.scalar_one_or_none()
    else:
        conversation = None

    if not conversation:
        conversation = AIConversation(
            session_id=request.session_id or str(uuid.uuid4()),
            user_id=None,  # Would come from auth
            language=request.language,
            context=request.context or {},
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    # Save user message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=request.message,
        content_type="text",
    )
    db.add(user_msg)

    # Determine query type and generate response
    query_type = detect_query_type(request.message, request.context)
    response_text = generate_mock_response(query_type, request.context)

    # Save assistant message
    latency_ms = int((time.time() - start_time) * 1000)
    assistant_msg = AIMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=response_text,
        content_type="markdown",
        citations=generate_citations(request.context),
        tokens_used=len(response_text) // 4,
        model="floodguard-assistant-v1",
        latency_ms=latency_ms,
    )
    db.add(assistant_msg)

    await db.commit()
    await db.refresh(assistant_msg)

    return AIChatResponse(
        message_id=assistant_msg.id,
        conversation_id=conversation.id,
        session_id=conversation.session_id,
        response=response_text,
        content_type="markdown",
        citations=assistant_msg.citations,
        tokens_used=assistant_msg.tokens_used,
        model=assistant_msg.model,
        latency_ms=latency_ms,
        suggested_actions=get_suggested_actions(query_type),
    )


@router.get("/conversations", response_model=List[AIConversationResponse])
async def list_conversations(
    user_id: Optional[UUID] = None,  # Would come from auth
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List AI conversations."""
    query = select(AIConversation).order_by(AIConversation.updated_at.desc()).limit(limit)
    if user_id:
        query = query.where(AIConversation.user_id == user_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/conversations/{conversation_id}", response_model=AIConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get conversation with messages."""
    conv = await db.get(AIConversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.get("/conversations/{conversation_id}/messages", response_model=List[AIMessageResponse])
async def get_conversation_messages(
    conversation_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get messages for a conversation."""
    result = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.created_at)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/query-types")
async def get_query_types():
    """Get supported query types."""
    return {
        "query_types": [
            {"id": "risk_explanation", "name": "Risk Explanation", "description": "Explain current flood risk and contributing factors"},
            {"id": "evacuation_guidance", "name": "Evacuation Guidance", "description": "Get evacuation routes and shelter information"},
            {"id": "scenario_comparison", "name": "Scenario Comparison", "description": "Compare different flood scenarios"},
            {"id": "historical_context", "name": "Historical Context", "description": "Compare with historical flood events"},
            {"id": "preparedness_tips", "name": "Preparedness Tips", "description": "Get flood preparedness recommendations"},
            {"id": "technical_details", "name": "Technical Details", "description": "Explain models, data sources, and methodology"},
        ]
    }


def detect_query_type(message: str, context: Optional[dict]) -> str:
    """Detect the type of query from message content."""
    message_lower = message.lower()

    if any(kw in message_lower for kw in ["evacuat", "route", "shelter", "escape", "safe path"]):
        return "evacuation_guidance"
    elif any(kw in message_lower for kw in ["scenario", "compare", "what if", "versus", "vs"]):
        return "scenario_comparison"
    elif any(kw in message_lower for kw in ["history", "historical", "past", "previous", "2018", "2019", "kerala"]):
        return "historical_context"
    elif any(kw in message_lower for kw in ["prepare", "ready", "kit", "plan", "supplies"]):
        return "preparedness_tips"
    elif any(kw in message_lower for kw in ["model", "algorithm", "data", "source", "method", "accuracy"]):
        return "technical_details"
    else:
        return "risk_explanation"


def generate_mock_response(query_type: str, context: Optional[dict]) -> str:
    """Generate a mock AI response based on query type and context."""
    ctx = context or {}
    risk = ctx.get("current_risk", 0.65)
    risk_level = "HIGH" if risk > 0.7 else "MODERATE" if risk > 0.3 else "LOW"

    if query_type == "risk_explanation":
        return MOCK_RESPONSES["risk_explanation"].format(
            risk_level=risk_level,
            risk_score=risk,
            rainfall_mm=ctx.get("rainfall_24h", 125),
            rainfall_risk=ctx.get("rainfall_risk", 0.4),
            terrain_risk=ctx.get("terrain_risk", 0.3),
            soil_type=ctx.get("soil_type", "Clay loam"),
            saturation=ctx.get("soil_saturation", 0.85),
            soil_risk=ctx.get("soil_risk", 0.2),
            landcover_type=ctx.get("landcover", "Mixed forest/agriculture"),
            landcover_risk=ctx.get("landcover_risk", 0.1),
            recommendation="Monitor conditions closely. Prepare for possible evacuation if risk increases above 0.8."
        )
    elif query_type == "evacuation_guidance":
        return MOCK_RESPONSES["evacuation_guidance"].format(
            shelter_name=ctx.get("nearest_shelter", "Community Hall, Village Center"),
            distance=ctx.get("shelter_distance_km", 3.2),
            route_description="Follow Main Road north, turn left at junction onto Highway 12",
            time_minutes=ctx.get("evac_time_min", 15),
            vehicle=ctx.get("vehicle", "car"),
            route_status="Clear - no flooding reported on route",
            safety_note="Carry essential documents, medications, and 3 days of supplies. Avoid low-lying areas."
        )
    elif query_type == "scenario_comparison":
        return MOCK_RESPONSES["scenario_comparison"].format(
            scenario_a_name="Current Forecast (72h)",
            depth_a=ctx.get("scenario_a_depth", 1.8),
            area_a=ctx.get("scenario_a_area", 12.5),
            pop_a=ctx.get("scenario_a_pop", 4200),
            scenario_b_name="Extreme Event (100yr)",
            depth_b=ctx.get("scenario_b_depth", 3.5),
            area_b=ctx.get("scenario_b_area", 28.3),
            pop_b=ctx.get("scenario_b_pop", 12800),
            difference="Extreme event would affect 3x more people and double the flood depth."
        )
    else:
        return f"I understand you're asking about {query_type.replace('_', ' ')}. Based on the current data for your area, the flood risk is **{risk_level}** ({risk:.0%}). The main factors are recent rainfall ({ctx.get('rainfall_24h', 125)}mm), terrain slope, and soil saturation. Would you like more specific information about evacuation routes, historical comparisons, or preparedness measures?"


def generate_citations(context: Optional[dict]) -> List[dict]:
    """Generate citations for the response."""
    citations = [
        {"source": "FloodGuard Risk Model v2.1", "type": "model", "url": None},
        {"source": "Open-Meteo ECMWF Forecast", "type": "weather", "url": "https://open-meteo.com"},
        {"source": "Copernicus DEM (GLO-30)", "type": "terrain", "url": "https://spacedata.copernicus.eu"},
        {"source": "SoilGrids v2.0 (ISRIC)", "type": "soil", "url": "https://soilgrids.org"},
        {"source": "ESA WorldCover 2021", "type": "landcover", "url": "https://viewer.esa-worldcover.org"},
    ]
    if context and context.get("historical_event"):
        citations.append({"source": "Dartmouth Flood Observatory", "type": "historical", "url": "https://floodobservatory.colorado.edu"})
    return citations


def get_suggested_actions(query_type: str) -> List[str]:
    """Get suggested follow-up actions."""
    actions = {
        "risk_explanation": [
            "Show evacuation routes",
            "Compare with historical events",
            "Get preparedness checklist",
        ],
        "evacuation_guidance": [
            "Show shelter details",
            "Get turn-by-turn directions",
            "Check route conditions",
        ],
        "scenario_comparison": [
            "Run what-if simulation",
            "View flood extent maps",
            "Check impact on infrastructure",
        ],
        "historical_context": [
            "View historical flood extents",
            "Compare rainfall patterns",
            "See recovery timeline",
        ],
        "preparedness_tips": [
            "Create family emergency plan",
            "Prepare emergency kit",
            "Sign up for alerts",
        ],
        "technical_details": [
            "View model documentation",
            "See data sources",
            "Check validation results",
        ],
    }
    return actions.get(query_type, ["Ask another question"])