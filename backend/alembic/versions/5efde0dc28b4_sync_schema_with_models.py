"""sync schema with models: alerts timestamps + ML training tables

Brings a database built purely from migrations (e.g. Amazon RDS) in line with the models.
Idempotent: databases previously created with Base.metadata.create_all already have these
objects, so every step checks first.

Revision ID: 5efde0dc28b4
Revises: 7c1e5a2b9d40
Create Date: 2026-09-29 23:32:05.084800

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5efde0dc28b4'
down_revision: Union[str, None] = '7c1e5a2b9d40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
import geoalchemy2


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    # alerts.created_at / updated_at (TimestampMixin) were missing from the initial migration
    op.execute("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()")
    op.execute("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()")

    if not _has_table("training_datasets"):
        op.create_table('training_datasets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('version', sa.String(length=20), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('total_samples', sa.Integer(), nullable=False),
        sa.Column('positive_samples', sa.Integer(), nullable=False),
        sa.Column('negative_samples', sa.Integer(), nullable=False),
        sa.Column('min_lat', sa.Float(), nullable=True),
        sa.Column('max_lat', sa.Float(), nullable=True),
        sa.Column('min_lon', sa.Float(), nullable=True),
        sa.Column('max_lon', sa.Float(), nullable=True),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('feature_version', sa.String(length=20), nullable=False),
        sa.Column('feature_names', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('feature_hash', sa.String(length=64), nullable=False),
        sa.Column('data_sources', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('positive_sources', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('avg_data_quality', sa.Float(), nullable=True),
        sa.Column('feature_completeness', sa.Float(), nullable=True),
        sa.Column('split_strategy', sa.String(length=50), nullable=False),
        sa.Column('test_size', sa.Float(), nullable=False),
        sa.Column('val_size', sa.Float(), nullable=False),
        sa.Column('n_splits', sa.Integer(), nullable=False),
        sa.Column('spatial_buffer_km', sa.Float(), nullable=True),
        sa.Column('temporal_buffer_days', sa.Integer(), nullable=True),
        sa.Column('random_state', sa.Integer(), nullable=False),
        sa.Column('parquet_path', sa.String(length=500), nullable=True),
        sa.Column('csv_path', sa.String(length=500), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_training_datasets')),
        sa.UniqueConstraint('name', 'version', name='uq_training_dataset_version'),
        sa.UniqueConstraint('name', name=op.f('uq_training_datasets_name'))
        )
        op.create_index('idx_training_datasets_active', 'training_datasets', ['is_active'], unique=False)

    if not _has_table("training_samples"):
        op.create_table('training_samples',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grid_cell_id', sa.String(length=64), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location', geoalchemy2.types.Geography(geometry_type='POINT', srid=4326, spatial_index=False, from_text='ST_GeogFromText', name='geography', nullable=False), nullable=False),
        sa.Column('event_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('forecast_horizon_hours', sa.Integer(), nullable=False),
        sa.Column('flood_occurred', sa.Integer(), nullable=False),
        sa.Column('label_source', sa.String(length=50), nullable=False),
        sa.Column('label_confidence', sa.Float(), nullable=True),
        sa.Column('rainfall_1h_mm', sa.Float(), nullable=True),
        sa.Column('rainfall_3h_mm', sa.Float(), nullable=True),
        sa.Column('rainfall_6h_mm', sa.Float(), nullable=True),
        sa.Column('rainfall_12h_mm', sa.Float(), nullable=True),
        sa.Column('rainfall_24h_mm', sa.Float(), nullable=True),
        sa.Column('rainfall_48h_mm', sa.Float(), nullable=True),
        sa.Column('rainfall_72h_mm', sa.Float(), nullable=True),
        sa.Column('rainfall_168h_mm', sa.Float(), nullable=True),
        sa.Column('rainfall_intensity_mmh', sa.Float(), nullable=True),
        sa.Column('rainfall_max_intensity_24h', sa.Float(), nullable=True),
        sa.Column('antecedent_rainfall_7d_mm', sa.Float(), nullable=True),
        sa.Column('antecedent_rainfall_14d_mm', sa.Float(), nullable=True),
        sa.Column('antecedent_rainfall_30d_mm', sa.Float(), nullable=True),
        sa.Column('dry_spell_hours', sa.Integer(), nullable=True),
        sa.Column('temperature_c', sa.Float(), nullable=True),
        sa.Column('humidity_percent', sa.Float(), nullable=True),
        sa.Column('wind_speed_kmh', sa.Float(), nullable=True),
        sa.Column('wind_direction_deg', sa.Float(), nullable=True),
        sa.Column('pressure_hpa', sa.Float(), nullable=True),
        sa.Column('cape_jkg', sa.Float(), nullable=True),
        sa.Column('lifted_index', sa.Float(), nullable=True),
        sa.Column('soil_moisture_0_7cm', sa.Float(), nullable=True),
        sa.Column('soil_moisture_7_28cm', sa.Float(), nullable=True),
        sa.Column('soil_moisture_28_100cm', sa.Float(), nullable=True),
        sa.Column('precipitable_water_mm', sa.Float(), nullable=True),
        sa.Column('forecast_precip_1h_mm', sa.Float(), nullable=True),
        sa.Column('forecast_precip_6h_mm', sa.Float(), nullable=True),
        sa.Column('forecast_precip_24h_mm', sa.Float(), nullable=True),
        sa.Column('forecast_precip_72h_mm', sa.Float(), nullable=True),
        sa.Column('forecast_precip_prob_max', sa.Float(), nullable=True),
        sa.Column('forecast_temp_min_24h', sa.Float(), nullable=True),
        sa.Column('forecast_temp_max_24h', sa.Float(), nullable=True),
        sa.Column('forecast_wind_max_24h', sa.Float(), nullable=True),
        sa.Column('forecast_cape_max_24h', sa.Float(), nullable=True),
        sa.Column('elevation_m', sa.Float(), nullable=True),
        sa.Column('slope_deg', sa.Float(), nullable=True),
        sa.Column('slope_pct', sa.Float(), nullable=True),
        sa.Column('aspect_deg', sa.Float(), nullable=True),
        sa.Column('aspect_northness', sa.Float(), nullable=True),
        sa.Column('aspect_eastness', sa.Float(), nullable=True),
        sa.Column('curvature', sa.Float(), nullable=True),
        sa.Column('profile_curvature', sa.Float(), nullable=True),
        sa.Column('plan_curvature', sa.Float(), nullable=True),
        sa.Column('flow_accumulation', sa.Float(), nullable=True),
        sa.Column('log_flow_accumulation', sa.Float(), nullable=True),
        sa.Column('twi', sa.Float(), nullable=True),
        sa.Column('spi', sa.Float(), nullable=True),
        sa.Column('distance_to_stream_m', sa.Float(), nullable=True),
        sa.Column('distance_to_river_m', sa.Float(), nullable=True),
        sa.Column('watershed_area_sqkm', sa.Float(), nullable=True),
        sa.Column('drainage_density_kmkm2', sa.Float(), nullable=True),
        sa.Column('stream_order', sa.Integer(), nullable=True),
        sa.Column('soil_clay_percent', sa.Float(), nullable=True),
        sa.Column('soil_sand_percent', sa.Float(), nullable=True),
        sa.Column('soil_silt_percent', sa.Float(), nullable=True),
        sa.Column('soil_organic_carbon_percent', sa.Float(), nullable=True),
        sa.Column('soil_bulk_density_gcm3', sa.Float(), nullable=True),
        sa.Column('soil_ph', sa.Float(), nullable=True),
        sa.Column('soil_cec_cmolkg', sa.Float(), nullable=True),
        sa.Column('soil_ksat_mmhr', sa.Float(), nullable=True),
        sa.Column('soil_field_capacity', sa.Float(), nullable=True),
        sa.Column('soil_wilting_point', sa.Float(), nullable=True),
        sa.Column('soil_porosity', sa.Float(), nullable=True),
        sa.Column('soil_awc_mm', sa.Float(), nullable=True),
        sa.Column('soil_k_factor', sa.Float(), nullable=True),
        sa.Column('hydrologic_soil_group', sa.String(length=10), nullable=True),
        sa.Column('landcover_class', sa.Integer(), nullable=True),
        sa.Column('impervious_fraction', sa.Float(), nullable=True),
        sa.Column('tree_cover_pct', sa.Float(), nullable=True),
        sa.Column('grass_cover_pct', sa.Float(), nullable=True),
        sa.Column('crop_cover_pct', sa.Float(), nullable=True),
        sa.Column('urban_fraction', sa.Float(), nullable=True),
        sa.Column('forest_fraction', sa.Float(), nullable=True),
        sa.Column('water_fraction', sa.Float(), nullable=True),
        sa.Column('wetland_fraction', sa.Float(), nullable=True),
        sa.Column('vegetation_fraction', sa.Float(), nullable=True),
        sa.Column('ndvi', sa.Float(), nullable=True),
        sa.Column('ndwi', sa.Float(), nullable=True),
        sa.Column('population_density_per_km2', sa.Float(), nullable=True),
        sa.Column('population_total', sa.Integer(), nullable=True),
        sa.Column('vulnerable_population_pct', sa.Float(), nullable=True),
        sa.Column('building_density_per_km2', sa.Float(), nullable=True),
        sa.Column('critical_infrastructure_count', sa.Integer(), nullable=True),
        sa.Column('road_density_kmkm2', sa.Float(), nullable=True),
        sa.Column('hospital_count', sa.Integer(), nullable=True),
        sa.Column('school_count', sa.Integer(), nullable=True),
        sa.Column('shelter_count', sa.Integer(), nullable=True),
        sa.Column('historical_flood_count', sa.Integer(), nullable=True),
        sa.Column('years_since_last_flood', sa.Integer(), nullable=True),
        sa.Column('max_historical_flood_depth_m', sa.Float(), nullable=True),
        sa.Column('historical_flood_frequency_per_year', sa.Float(), nullable=True),
        sa.Column('max_historical_fatalities', sa.Integer(), nullable=True),
        sa.Column('max_historical_affected_pop', sa.Integer(), nullable=True),
        sa.Column('sensor_rainfall_mm', sa.Float(), nullable=True),
        sa.Column('sensor_water_level_m', sa.Float(), nullable=True),
        sa.Column('sensor_soil_moisture_pct', sa.Float(), nullable=True),
        sa.Column('data_quality_score', sa.Float(), nullable=True),
        sa.Column('feature_completeness', sa.Float(), nullable=True),
        sa.Column('data_sources', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('feature_version', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_training_samples')),
        sa.UniqueConstraint('grid_cell_id', 'event_date', 'forecast_horizon_hours', name='uq_training_sample_unique')
        )
        op.create_index('idx_training_samples_label_date', 'training_samples', ['flood_occurred', 'event_date'], unique=False)
        op.create_index('idx_training_samples_label_source', 'training_samples', ['label_source'], unique=False)
        op.create_index('idx_training_samples_location', 'training_samples', ['location'], unique=False)
        op.create_index('idx_training_samples_spatial_temporal', 'training_samples', ['grid_cell_id', 'event_date'], unique=False)
        op.create_index(op.f('ix_training_samples_event_date'), 'training_samples', ['event_date'], unique=False)
        op.create_index(op.f('ix_training_samples_flood_occurred'), 'training_samples', ['flood_occurred'], unique=False)
        op.create_index(op.f('ix_training_samples_grid_cell_id'), 'training_samples', ['grid_cell_id'], unique=False)


def downgrade() -> None:
    op.drop_table("training_samples")
    op.drop_table("training_datasets")
    op.execute("ALTER TABLE alerts DROP COLUMN IF EXISTS updated_at")
    op.execute("ALTER TABLE alerts DROP COLUMN IF EXISTS created_at")
