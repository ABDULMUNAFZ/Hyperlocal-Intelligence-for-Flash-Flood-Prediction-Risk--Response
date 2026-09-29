-- FloodGuard Database Initialization
-- This script runs on first database creation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TimescaleDB is not required by the current application.
-- Do NOT enable it because the PostgreSQL image does not include it.

-- Set timezone
SET timezone = 'UTC';

-- Grant permissions
GRANT ALL ON SCHEMA public TO floodguard;

-- Grant permissions on tables/sequences that will be created later
-- by Alembic migrations.
-- These statements are intentionally omitted here because the tables
-- do not exist yet during PostgreSQL initialization.

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;