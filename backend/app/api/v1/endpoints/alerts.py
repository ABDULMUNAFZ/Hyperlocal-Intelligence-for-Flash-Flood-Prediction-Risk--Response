# FloodGuard Alerts Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID
from app.db.session import get_db
from app.models.alerts import Alert, AlertSubscription, AlertTemplate, AlertSeverity, AlertStatus, AlertType
from app.models.core import User
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from app.schemas.alerts import (
    AlertCreate,
    AlertUpdate,
    AlertResponse,
    AlertQueryParams,
    AlertSubscriptionCreate,
    AlertSubscriptionResponse,
    AlertTemplateResponse,
)

router = APIRouter(prefix="/alerts", tags=["Alerts"])


def alert_to_response(alert: Alert) -> AlertResponse:
    geo = None
    if alert.geometry is not None:
        try:
            geo = mapping(to_shape(alert.geometry))
        except Exception:
            geo = None

    return AlertResponse(
        id=alert.id,
        alert_id=alert.alert_id,
        title=alert.title,
        description=alert.description,
        instruction=alert.instruction,
        alert_type=alert.alert_type.value if hasattr(alert.alert_type, "value") else str(alert.alert_type),
        severity=alert.severity.value if hasattr(alert.severity, "value") else str(alert.severity),
        status=alert.status.value if hasattr(alert.status, "value") else str(alert.status),
        urgency=alert.urgency,
        certainty=alert.certainty,
        affected_regions=alert.affected_regions or [],
        geometry=geo,
        onset=alert.onset,
        expires=alert.expires,
        source=alert.source,
        author=alert.author,
        author_id=alert.author_id,
        sent_at=alert.sent_at,
        cap_identifier=alert.cap_identifier,
        cap_sender=alert.cap_sender,
        cap_status=alert.cap_status,
        cap_msgType=alert.cap_msgType,
        cap_scope=alert.cap_scope,
        channels=alert.channels or [],
        languages=alert.languages or ["en"],
        recipients_count=alert.recipients_count or 0,
        acknowledged_count=alert.acknowledged_count or 0,
        metadata=alert.extra_metadata or {},
        created_at=getattr(alert, "created_at", None) or alert.sent_at or datetime.utcnow(),
        updated_at=getattr(alert, "updated_at", None) or alert.sent_at or datetime.utcnow(),
    )


@router.post("", response_model=AlertResponse, status_code=201)
async def create_alert(
    alert_in: AlertCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new alert."""
    import uuid
    alert = Alert(
        **alert_in.model_dump(),
        alert_id=f"FLDG-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
        author_id=None,  # Would come from auth
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert_to_response(alert)


@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    params: AlertQueryParams = Depends(),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List alerts with filters."""
    query = select(Alert)

    if params.status:
        query = query.where(Alert.status == params.status)
    if params.severity:
        query = query.where(Alert.severity == params.severity)
    if params.alert_type:
        query = query.where(Alert.alert_type == params.alert_type)
    if params.region_id:
        query = query.where(Alert.affected_regions.contains([params.region_id]))
    if params.since:
        query = query.where(Alert.created_at >= params.since)
    if params.until:
        query = query.where(Alert.created_at <= params.until)

    query = query.order_by(Alert.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return [alert_to_response(a) for a in result.scalars().all()]


@router.get("/active", response_model=List[AlertResponse])
async def get_active_alerts(
    region_id: Optional[UUID] = None,
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: float = Query(50, gt=0, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get currently active alerts for a location or region."""
    now = datetime.utcnow()
    query = select(Alert).where(
        and_(
            Alert.status == AlertStatus.ACTIVE,
            or_(Alert.expires.is_(None), Alert.expires > now),
            Alert.onset <= now,
        )
    )

    if region_id:
        query = query.where(Alert.affected_regions.contains([region_id]))

    if latitude and longitude:
        from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_DWithin
        point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        query = query.where(
            or_(
                Alert.geometry.ST_DWithin(point, radius_km * 1000),
                Alert.geometry.is_(None),  # Include region-wide alerts
            )
        )

    query = query.order_by(Alert.severity.desc(), Alert.created_at.desc())
    result = await db.execute(query.limit(20))
    return [alert_to_response(a) for a in result.scalars().all()]


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get alert by ID."""
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert_to_response(alert)


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: UUID,
    alert_update: AlertUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an alert."""
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    update_data = alert_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(alert, field, value)

    if alert.status == AlertStatus.ACTIVE and not alert.sent_at:
        alert.sent_at = datetime.utcnow()

    await db.commit()
    await db.refresh(alert)
    return alert_to_response(alert)


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Acknowledge an alert."""
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Update subscription
    sub_result = await db.execute(
        select(AlertSubscription).where(
            and_(
                AlertSubscription.alert_id == alert_id,
                AlertSubscription.user_id == user_id,
            )
        )
    )
    sub = sub_result.scalar_one_or_none()
    if sub:
        sub.acknowledged_at = datetime.utcnow()
        await db.commit()

    alert.acknowledged_count += 1
    await db.commit()

    return {"message": "Alert acknowledged"}


@router.post("/subscriptions", response_model=AlertSubscriptionResponse, status_code=201)
async def create_alert_subscription(
    sub_in: AlertSubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Query(...),  # Would come from auth
):
    """Create an alert subscription."""
    sub = AlertSubscription(
        **sub_in.model_dump(),
        user_id=user_id,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.get("/subscriptions", response_model=List[AlertSubscriptionResponse])
async def list_alert_subscriptions(
    user_id: UUID = Query(...),  # Would come from auth
    db: AsyncSession = Depends(get_db),
):
    """List user's alert subscriptions."""
    result = await db.execute(
        select(AlertSubscription).where(
            and_(AlertSubscription.user_id == user_id, AlertSubscription.is_active == True)
        )
    )
    return result.scalars().all()


@router.delete("/subscriptions/{sub_id}", status_code=204)
async def delete_alert_subscription(
    sub_id: UUID,
    user_id: UUID = Query(...),  # Would come from auth
    db: AsyncSession = Depends(get_db),
):
    """Delete an alert subscription."""
    result = await db.execute(
        select(AlertSubscription).where(
            and_(AlertSubscription.id == sub_id, AlertSubscription.user_id == user_id)
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.delete(sub)
    await db.commit()


# Alert Templates
@router.get("/templates", response_model=List[AlertTemplateResponse])
async def list_alert_templates(
    alert_type: Optional[str] = None,
    severity: Optional[str] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """List alert templates."""
    query = select(AlertTemplate).where(AlertTemplate.is_active == is_active)
    if alert_type:
        query = query.where(AlertTemplate.alert_type == alert_type)
    if severity:
        query = query.where(AlertTemplate.severity == severity)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/templates/{template_id}", response_model=AlertTemplateResponse)
async def get_alert_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get alert template by ID."""
    template = await db.get(AlertTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/templates/{template_id}/render", response_model=AlertCreate)
async def render_alert_template(
    template_id: UUID,
    parameters: dict,
    db: AsyncSession = Depends(get_db),
):
    """Render an alert template with parameters."""
    template = await db.get(AlertTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Simple template rendering (in production, use Jinja2)
    title = template.title_template
    description = template.description_template
    instruction = template.instruction_template

    for key, value in parameters.items():
        placeholder = f"{{{key}}}"
        title = title.replace(placeholder, str(value))
        description = description.replace(placeholder, str(value))
        if instruction:
            instruction = instruction.replace(placeholder, str(value))

    return AlertCreate(
        title=title,
        description=description,
        instruction=instruction,
        alert_type=template.alert_type,
        severity=template.severity,
        default_channels=template.default_channels,
        default_languages=template.default_languages,
    )