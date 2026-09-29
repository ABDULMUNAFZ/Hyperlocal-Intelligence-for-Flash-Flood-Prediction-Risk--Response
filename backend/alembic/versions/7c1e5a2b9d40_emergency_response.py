"""emergency response: push subscriptions, user locations, rescue requests, deliveries, audit log

Revision ID: 7c1e5a2b9d40
Revises: d3d67eeca885
Create Date: 2026-09-30 09:00:00

Idempotent (IF NOT EXISTS) because app.db.session.init_db also creates missing tables.
Also records the live-ops tables added earlier (citizen_reports, alert_acknowledgements)
and the LANDSLIDE alert type.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "7c1e5a2b9d40"
down_revision: Union[str, None] = "d3d67eeca885"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("ALTER TYPE alerttype ADD VALUE IF NOT EXISTS 'LANDSLIDE'")

    op.execute("""
    CREATE TABLE IF NOT EXISTS citizen_reports (
        id UUID PRIMARY KEY,
        session_hash VARCHAR(64) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        accuracy_m DOUBLE PRECISION,
        report_type VARCHAR(32) NOT NULL,
        people_count INTEGER NOT NULL DEFAULT 1,
        severity VARCHAR(16) NOT NULL DEFAULT 'warning',
        message TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'new',
        is_demo BOOLEAN NOT NULL DEFAULT false,
        handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute("""
    CREATE TABLE IF NOT EXISTS alert_acknowledgements (
        id UUID PRIMARY KEY,
        alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
        session_hash VARCHAR(64) NOT NULL,
        acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")

    op.execute("""
    CREATE TABLE IF NOT EXISTS emergency_profiles (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(32),
        location_consent_at TIMESTAMPTZ,
        location_permission VARCHAR(16),
        push_permission VARCHAR(16),
        installed_pwa BOOLEAN,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute("""
    CREATE TABLE IF NOT EXISTS user_locations (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        location geography(Point, 4326) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        accuracy_m DOUBLE PRECISION,
        captured_at TIMESTAMPTZ NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute("""
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(64) NOT NULL,
        user_agent VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_success_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute("""
    CREATE TABLE IF NOT EXISTS rescue_requests (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
        status VARCHAR(32) NOT NULL,
        people_count INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        risk_level VARCHAR(16),
        is_demo BOOLEAN NOT NULL DEFAULT false,
        location geography(Point, 4326) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        accuracy_m DOUBLE PRECISION,
        captured_at TIMESTAMPTZ NOT NULL,
        safe_location_id UUID REFERENCES shelters(id) ON DELETE SET NULL,
        journey_status VARCHAR(24),
        journey_started_at TIMESTAMPTZ,
        journey_start_lat DOUBLE PRECISION,
        journey_start_lon DOUBLE PRECISION,
        route JSONB,
        arrived_at TIMESTAMPTZ,
        arrival_distance_m DOUBLE PRECISION,
        assigned_responder_id UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute("""
    CREATE TABLE IF NOT EXISTS rescue_status_history (
        id UUID PRIMARY KEY,
        rescue_request_id UUID NOT NULL REFERENCES rescue_requests(id) ON DELETE CASCADE,
        from_status VARCHAR(32),
        to_status VARCHAR(32) NOT NULL,
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        note TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute("""
    CREATE TABLE IF NOT EXISTS alert_deliveries (
        id UUID PRIMARY KEY,
        alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
        status VARCHAR(24) NOT NULL,
        http_status INTEGER,
        error TEXT,
        distance_m DOUBLE PRECISION,
        sent_at TIMESTAMPTZ,
        opened_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(64) NOT NULL,
        target_type VARCHAR(32),
        target_id VARCHAR(64),
        ip VARCHAR(64),
        details JSONB,
        at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")

    for stmt in [
        "CREATE INDEX IF NOT EXISTS idx_user_locations_geog ON user_locations USING gist (location)",
        "CREATE INDEX IF NOT EXISTS idx_user_locations_captured ON user_locations (captured_at)",
        "CREATE INDEX IF NOT EXISTS idx_rescue_requests_geog ON rescue_requests USING gist (location)",
        "CREATE INDEX IF NOT EXISTS idx_rescue_requests_status ON rescue_requests (status)",
        "CREATE INDEX IF NOT EXISTS idx_rescue_requests_user ON rescue_requests (user_id)",
        "CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id)",
        "CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert ON alert_deliveries (alert_id)",
        "CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user ON alert_deliveries (user_id)",
        "CREATE INDEX IF NOT EXISTS idx_rescue_history_request ON rescue_status_history (rescue_request_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs (at)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)",
        "CREATE INDEX IF NOT EXISTS idx_citizen_reports_session ON citizen_reports (session_hash)",
        "CREATE INDEX IF NOT EXISTS idx_citizen_reports_expires ON citizen_reports (expires_at)",
        "CREATE INDEX IF NOT EXISTS idx_shelters_geography ON shelters USING gist ((geometry::geography))",
    ]:
        op.execute(stmt)


def downgrade() -> None:
    for t in ["audit_logs", "alert_deliveries", "rescue_status_history", "rescue_requests", "push_subscriptions",
              "user_locations", "emergency_profiles"]:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
