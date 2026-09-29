# FloodGuard Database Models - Training Samples
"""Training samples table for ML model training with spatial/temporal features."""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, Float, UniqueConstraint, func, BigInteger
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry, Geography
from app.db.session import Base
import uuid
from datetime import datetime


class TrainingSample(Base):
    """Training samples for flood prediction models.
    
    Each row represents a spatio-temporal point with features and a flood label.
    Positive samples come from historical flood events (EM-DAT, Dartmouth, satellite).
    Negative samples are generated from non-flood locations/times with spatial/temporal separation.
    """
    __tablename__ = "training_samples"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # Spatial identifiers
    grid_cell_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[Geography] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )
    
    # Temporal identifiers
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    forecast_horizon_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=72)
    
    # Target label
    flood_occurred: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # 0 or 1
    label_source: Mapped[str] = mapped_column(String(50), nullable=False)  # 'emdat', 'dartmouth', 'satellite', 'negative_sampling'
    label_confidence: Mapped[float] = mapped_column(Float, nullable=True)  # 0-1 confidence in label
    
    # Rainfall features
    rainfall_1h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_3h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_6h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_12h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_24h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_48h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_72h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_168h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_intensity_mmh: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_max_intensity_24h: Mapped[float] = mapped_column(Float, nullable=True)
    antecedent_rainfall_7d_mm: Mapped[float] = mapped_column(Float, nullable=True)
    antecedent_rainfall_14d_mm: Mapped[float] = mapped_column(Float, nullable=True)
    antecedent_rainfall_30d_mm: Mapped[float] = mapped_column(Float, nullable=True)
    dry_spell_hours: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Weather features
    temperature_c: Mapped[float] = mapped_column(Float, nullable=True)
    humidity_percent: Mapped[float] = mapped_column(Float, nullable=True)
    wind_speed_kmh: Mapped[float] = mapped_column(Float, nullable=True)
    wind_direction_deg: Mapped[float] = mapped_column(Float, nullable=True)
    pressure_hpa: Mapped[float] = mapped_column(Float, nullable=True)
    cape_jkg: Mapped[float] = mapped_column(Float, nullable=True)
    lifted_index: Mapped[float] = mapped_column(Float, nullable=True)
    soil_moisture_0_7cm: Mapped[float] = mapped_column(Float, nullable=True)
    soil_moisture_7_28cm: Mapped[float] = mapped_column(Float, nullable=True)
    soil_moisture_28_100cm: Mapped[float] = mapped_column(Float, nullable=True)
    precipitable_water_mm: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Forecast features (at prediction time)
    forecast_precip_1h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_precip_6h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_precip_24h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_precip_72h_mm: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_precip_prob_max: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_temp_min_24h: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_temp_max_24h: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_wind_max_24h: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_cape_max_24h: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Terrain features
    elevation_m: Mapped[float] = mapped_column(Float, nullable=True)
    slope_deg: Mapped[float] = mapped_column(Float, nullable=True)
    slope_pct: Mapped[float] = mapped_column(Float, nullable=True)
    aspect_deg: Mapped[float] = mapped_column(Float, nullable=True)
    aspect_northness: Mapped[float] = mapped_column(Float, nullable=True)
    aspect_eastness: Mapped[float] = mapped_column(Float, nullable=True)
    curvature: Mapped[float] = mapped_column(Float, nullable=True)
    profile_curvature: Mapped[float] = mapped_column(Float, nullable=True)
    plan_curvature: Mapped[float] = mapped_column(Float, nullable=True)
    flow_accumulation: Mapped[float] = mapped_column(Float, nullable=True)
    log_flow_accumulation: Mapped[float] = mapped_column(Float, nullable=True)
    twi: Mapped[float] = mapped_column(Float, nullable=True)
    spi: Mapped[float] = mapped_column(Float, nullable=True)
    distance_to_stream_m: Mapped[float] = mapped_column(Float, nullable=True)
    distance_to_river_m: Mapped[float] = mapped_column(Float, nullable=True)
    watershed_area_sqkm: Mapped[float] = mapped_column(Float, nullable=True)
    drainage_density_kmkm2: Mapped[float] = mapped_column(Float, nullable=True)
    stream_order: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Soil features
    soil_clay_percent: Mapped[float] = mapped_column(Float, nullable=True)
    soil_sand_percent: Mapped[float] = mapped_column(Float, nullable=True)
    soil_silt_percent: Mapped[float] = mapped_column(Float, nullable=True)
    soil_organic_carbon_percent: Mapped[float] = mapped_column(Float, nullable=True)
    soil_bulk_density_gcm3: Mapped[float] = mapped_column(Float, nullable=True)
    soil_ph: Mapped[float] = mapped_column(Float, nullable=True)
    soil_cec_cmolkg: Mapped[float] = mapped_column(Float, nullable=True)
    soil_ksat_mmhr: Mapped[float] = mapped_column(Float, nullable=True)
    soil_field_capacity: Mapped[float] = mapped_column(Float, nullable=True)
    soil_wilting_point: Mapped[float] = mapped_column(Float, nullable=True)
    soil_porosity: Mapped[float] = mapped_column(Float, nullable=True)
    soil_awc_mm: Mapped[float] = mapped_column(Float, nullable=True)
    soil_k_factor: Mapped[float] = mapped_column(Float, nullable=True)
    hydrologic_soil_group: Mapped[str] = mapped_column(String(10), nullable=True)
    
    # Land cover features
    landcover_class: Mapped[int] = mapped_column(Integer, nullable=True)
    impervious_fraction: Mapped[float] = mapped_column(Float, nullable=True)
    tree_cover_pct: Mapped[float] = mapped_column(Float, nullable=True)
    grass_cover_pct: Mapped[float] = mapped_column(Float, nullable=True)
    crop_cover_pct: Mapped[float] = mapped_column(Float, nullable=True)
    urban_fraction: Mapped[float] = mapped_column(Float, nullable=True)
    forest_fraction: Mapped[float] = mapped_column(Float, nullable=True)
    water_fraction: Mapped[float] = mapped_column(Float, nullable=True)
    wetland_fraction: Mapped[float] = mapped_column(Float, nullable=True)
    vegetation_fraction: Mapped[float] = mapped_column(Float, nullable=True)
    ndvi: Mapped[float] = mapped_column(Float, nullable=True)
    ndwi: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Population & infrastructure
    population_density_per_km2: Mapped[float] = mapped_column(Float, nullable=True)
    population_total: Mapped[int] = mapped_column(Integer, nullable=True)
    vulnerable_population_pct: Mapped[float] = mapped_column(Float, nullable=True)
    building_density_per_km2: Mapped[float] = mapped_column(Float, nullable=True)
    critical_infrastructure_count: Mapped[int] = mapped_column(Integer, nullable=True)
    road_density_kmkm2: Mapped[float] = mapped_column(Float, nullable=True)
    hospital_count: Mapped[int] = mapped_column(Integer, nullable=True)
    school_count: Mapped[int] = mapped_column(Integer, nullable=True)
    shelter_count: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Historical flood features
    historical_flood_count: Mapped[int] = mapped_column(Integer, nullable=True)
    years_since_last_flood: Mapped[int] = mapped_column(Integer, nullable=True)
    max_historical_flood_depth_m: Mapped[float] = mapped_column(Float, nullable=True)
    historical_flood_frequency_per_year: Mapped[float] = mapped_column(Float, nullable=True)
    max_historical_fatalities: Mapped[int] = mapped_column(Integer, nullable=True)
    max_historical_affected_pop: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # IoT sensor features (if available)
    sensor_rainfall_mm: Mapped[float] = mapped_column(Float, nullable=True)
    sensor_water_level_m: Mapped[float] = mapped_column(Float, nullable=True)
    sensor_soil_moisture_pct: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Data quality & metadata
    data_quality_score: Mapped[float] = mapped_column(Float, nullable=True)  # 0-1
    feature_completeness: Mapped[float] = mapped_column(Float, nullable=True)  # fraction of non-null features
    data_sources: Mapped[list] = mapped_column(ARRAY(String), nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    
    # Versioning for reproducibility
    feature_version: Mapped[str] = mapped_column(String(20), nullable=False, default="1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_training_samples_spatial_temporal", "grid_cell_id", "event_date"),
        Index("idx_training_samples_label_date", "flood_occurred", "event_date"),
        Index("idx_training_samples_label_source", "label_source"),
        Index("idx_training_samples_location", "location"),
        UniqueConstraint("grid_cell_id", "event_date", "forecast_horizon_hours", name="uq_training_sample_unique"),
    )


class TrainingDataset(Base):
    """Versioned training datasets for reproducibility."""
    __tablename__ = "training_datasets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Dataset composition
    total_samples: Mapped[int] = mapped_column(Integer, nullable=False)
    positive_samples: Mapped[int] = mapped_column(Integer, nullable=False)
    negative_samples: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Spatial extent
    min_lat: Mapped[float] = mapped_column(Float, nullable=True)
    max_lat: Mapped[float] = mapped_column(Float, nullable=True)
    min_lon: Mapped[float] = mapped_column(Float, nullable=True)
    max_lon: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Temporal extent
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Feature configuration
    feature_version: Mapped[str] = mapped_column(String(20), nullable=False)
    feature_names: Mapped[list] = mapped_column(ARRAY(String), nullable=False)
    feature_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    
    # Data sources used
    data_sources: Mapped[list] = mapped_column(ARRAY(String), nullable=True)
    positive_sources: Mapped[list] = mapped_column(ARRAY(String), nullable=True)
    
    # Quality metrics
    avg_data_quality: Mapped[float] = mapped_column(Float, nullable=True)
    feature_completeness: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Split configuration
    split_strategy: Mapped[str] = mapped_column(String(50), nullable=False, default="spatial_temporal")
    test_size: Mapped[float] = mapped_column(Float, nullable=False, default=0.2)
    val_size: Mapped[float] = mapped_column(Float, nullable=False, default=0.1)
    n_splits: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    spatial_buffer_km: Mapped[float] = mapped_column(Float, nullable=True)
    temporal_buffer_days: Mapped[int] = mapped_column(Integer, nullable=True)
    random_state: Mapped[int] = mapped_column(Integer, nullable=False, default=42)
    
    # File references
    parquet_path: Mapped[str] = mapped_column(String(500), nullable=True)
    csv_path: Mapped[str] = mapped_column(String(500), nullable=True)
    
    # Metadata
    created_by: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("name", "version", name="uq_training_dataset_version"),
        Index("idx_training_datasets_active", "is_active"),
    )