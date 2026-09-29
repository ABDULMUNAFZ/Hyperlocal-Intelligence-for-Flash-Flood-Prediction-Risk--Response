# FloodGuard Celery Application
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "floodguard",
    broker=str(settings.REDIS_URL),
    backend=str(settings.REDIS_URL),
    include=["app.tasks.emergency"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

celery_app.conf.beat_schedule = {
    # Official NDMA SACHET alerts covering Wayanad (Severe/Extreme) → targeted emergency push
    "poll-official-alerts": {"task": "emergency.poll_official_alerts", "schedule": 300.0},
    # Data retention for locations, resolved rescue requests and anonymous reports
    "purge-expired-emergency-data": {"task": "emergency.purge_expired_data", "schedule": 3600.0},
}
