# FloodGuard Training Data Materialization
"""Pipeline to create training samples from historical flood events and negative sampling."""

import asyncio
import logging
import hashlib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import uuid

from sqlalchemy import text, select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID, ST_Distance

from app.db.session import async_session_maker
from app.models.training import TrainingSample, TrainingDataset
from app.models.population import HistoricalFloodEvent
from app.ml.features.engineering import FeatureEngineer, FeatureConfig, create_feature_vector
from app.ml.data.ingestion import get_ingestion_pipeline, close_ingestion_pipeline
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MaterializationConfig:
    """Configuration for training data materialization."""
    # Spatial grid
    grid_resolution_m: int = 250
    grid_cell_size_deg: float = 0.0025  # ~250m at equator
    
    # Temporal windows
    forecast_horizons_hours: List[int] = field(default_factory=lambda: [6, 12, 24, 48, 72])
    
    # Positive samples
    positive_sources: List[str] = field(default_factory=lambda: ['dartmouth', 'emdat', 'satellite', 'nidm'])
    min_positive_confidence: float = 0.7
    
    # Negative sampling
    negative_sampling_ratio: float = 5.0  # negatives per positive
    spatial_buffer_km: float = 50.0  # minimum distance from positive samples
    temporal_buffer_days: int = 30  # minimum time gap from positive samples
    max_negative_attempts: int = 100000
    
    # Geographic bounds (South India)
    min_lat: float = 8.0
    max_lat: float = 18.0
    min_lon: float = 74.0
    max_lon: float = 82.0
    
    # Date range
    start_date: Optional[str] = "2015-01-01"
    end_date: Optional[str] = None  # None = now
    
    # Feature engineering
    feature_version: str = "1.0"
    
    # Quality thresholds
    min_feature_completeness: float = 0.7
    min_data_quality: float = 0.5


class TrainingDataMaterializer:
    """Materialize training samples from historical events and negative sampling."""
    
    def __init__(self, config: Optional[MaterializationConfig] = None):
        self.config = config or MaterializationConfig()
        self.feature_engineer = FeatureEngineer(FeatureConfig())
        self.ingestion_pipeline = None
        
    async def initialize(self):
        """Initialize data clients."""
        self.ingestion_pipeline = await get_ingestion_pipeline()
        logger.info("Training data materializer initialized")
    
    async def close(self):
        """Close connections."""
        if self.ingestion_pipeline:
            await close_ingestion_pipeline()
    
    def _latlon_to_grid_id(self, lat: float, lon: float) -> str:
        """Convert lat/lon to grid cell ID."""
        grid_lat = int(lat / self.config.grid_cell_size_deg)
        grid_lon = int(lon / self.config.grid_cell_size_deg)
        return f"grid_{grid_lat}_{grid_lon}"
    
    def _grid_id_to_centroid(self, grid_id: str) -> Tuple[float, float]:
        """Convert grid cell ID to centroid lat/lon."""
        parts = grid_id.split('_')
        if len(parts) >= 3:
            grid_lat = int(parts[1])
            grid_lon = int(parts[2])
            lat = (grid_lat + 0.5) * self.config.grid_cell_size_deg
            lon = (grid_lon + 0.5) * self.config.grid_cell_size_deg
            return lat, lon
        return 0.0, 0.0
    
    async def fetch_positive_events(
        self,
        session: AsyncSession
    ) -> List[HistoricalFloodEvent]:
        """Fetch historical flood events for positive samples."""
        conditions = []
        params = {}
        
        if self.config.start_date:
            conditions.append("start_date >= :start_date")
            params["start_date"] = self.config.start_date
        if self.config.end_date:
            conditions.append("start_date <= :end_date")
            params["end_date"] = self.config.end_date
        else:
            conditions.append("start_date <= :now")
            params["now"] = datetime.utcnow()
        
        # Geographic bounds for South India - use centroid
        conditions.append("ST_Y(centroid::geometry) BETWEEN :min_lat AND :max_lat")
        conditions.append("ST_X(centroid::geometry) BETWEEN :min_lon AND :max_lon")
        params.update({
            "min_lat": self.config.min_lat,
            "max_lat": self.config.max_lat,
            "min_lon": self.config.min_lon,
            "max_lon": self.config.max_lon,
        })
        
        # Filter by source and confidence
        if self.config.positive_sources:
            placeholders = ','.join([f':source_{i}' for i in range(len(self.config.positive_sources))])
            conditions.append(f"source IN ({placeholders})")
            for i, src in enumerate(self.config.positive_sources):
                params[f"source_{i}"] = src
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        query = f"""
            SELECT id, event_id, name, source, flood_type, cause,
                   start_date, end_date, duration_days,
                   ST_Y(centroid::geometry) as latitude,
                   ST_X(centroid::geometry) as longitude,
                   geometry, centroid,
                   fatalities, injured, displaced, affected_population,
                   max_rainfall_mm, max_rainfall_duration_hours, antecedent_rainfall_mm,
                   is_verified, verification_source, metadata
            FROM historical_flood_events
            {where_clause}
            ORDER BY start_date
        """
        
        result = await session.execute(text(query), params)
        rows = result.fetchall()
        
        events = []
        for row in rows:
            event = HistoricalFloodEvent()
            event.id = row.id
            event.event_id = row.event_id
            event.name = row.name
            event.source = row.source
            event.flood_type = row.flood_type
            event.cause = row.cause
            event.start_date = row.start_date
            event.end_date = row.end_date
            event.duration_days = row.duration_days
            event.latitude = row.latitude
            event.longitude = row.longitude
            event.geometry = row.geometry
            event.centroid = row.centroid
            event.fatalities = row.fatalities
            event.injured = row.injured
            event.displaced = row.displaced
            event.affected_population = row.affected_population
            event.max_rainfall_mm = row.max_rainfall_mm
            event.max_rainfall_duration_hours = row.max_rainfall_duration_hours
            event.antecedent_rainfall_mm = row.antecedent_rainfall_mm
            event.is_verified = row.is_verified
            event.verification_source = row.verification_source
            event.metadata = row.metadata
            events.append(event)
        
        logger.info(f"Fetched {len(events)} positive flood events")
        return events
    
    async def generate_negative_samples(
        self,
        session: AsyncSession,
        positive_events: List[HistoricalFloodEvent],
        n_negatives: int
    ) -> List[Dict[str, Any]]:
        """Generate negative samples with spatial/temporal separation from positives."""
        negatives = []
        
        # Extract positive locations and times
        positive_locations = [(e.latitude, e.longitude) for e in positive_events if e.latitude and e.longitude]
        positive_times = [e.start_date for e in positive_events if e.start_date]
        
        if not positive_locations or not positive_times:
            logger.warning("No valid positive locations/times for negative sampling")
            return []
        
        # Ensure timezone-naive comparison
        positive_times_naive = []
        for t in positive_times:
            if t.tzinfo is not None:
                positive_times_naive.append(t.replace(tzinfo=None))
            else:
                positive_times_naive.append(t)
        
        # Create spatial index for efficient distance queries
        # We'll use a simple approach: random sampling with rejection
        attempts = 0
        max_attempts = min(self.config.max_negative_attempts, n_negatives * 20)
        
        # Parse date bounds
        if isinstance(self.config.start_date, str):
            start_date = datetime.fromisoformat(self.config.start_date)
        elif isinstance(self.config.start_date, datetime):
            start_date = self.config.start_date
        else:
            start_date = datetime(2015, 1, 1)
        
        if isinstance(self.config.end_date, str):
            end_date = datetime.fromisoformat(self.config.end_date)
        elif isinstance(self.config.end_date, datetime):
            end_date = self.config.end_date
        else:
            end_date = datetime.utcnow()
        
        while len(negatives) < n_negatives and attempts < max_attempts:
            attempts += 1
            
            # Random location within bounds
            lat = np.random.uniform(self.config.min_lat, self.config.max_lat)
            lon = np.random.uniform(self.config.min_lon, self.config.max_lon)
            
            # Random time within range
            random_time = start_date + timedelta(
                seconds=np.random.uniform(0, (end_date - start_date).total_seconds())
            )
            
            # Check spatial separation
            min_spatial_dist = float('inf')
            for pos_lat, pos_lon in positive_locations:
                dist = self._haversine_distance(lat, lon, pos_lat, pos_lon)
                min_spatial_dist = min(min_spatial_dist, dist)
            
            if min_spatial_dist < self.config.spatial_buffer_km:
                continue
            
            # Check temporal separation
            min_temporal_dist = float('inf')
            for pos_time in positive_times_naive:
                dist_days = abs((random_time - pos_time).total_seconds() / 86400)
                min_temporal_dist = min(min_temporal_dist, dist_days)
            
            if min_temporal_dist < self.config.temporal_buffer_days:
                continue
            
            # Check if grid cell already has a sample at this time
            grid_id = self._latlon_to_grid_id(lat, lon)
            existing = await session.execute(
                text("SELECT 1 FROM training_samples WHERE grid_cell_id = :gid AND event_date = :edt"),
                {"gid": grid_id, "edt": random_time}
            )
            if existing.scalar():
                continue
            
            negatives.append({
                "latitude": lat,
                "longitude": lon,
                "event_date": random_time,
                "grid_cell_id": grid_id,
                "label_source": "negative_sampling",
                "label_confidence": 0.9,
            })
        
        logger.info(f"Generated {len(negatives)} negative samples after {attempts} attempts")
        return negatives
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate haversine distance in km."""
        R = 6371.0
        lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
        return 2 * R * np.arcsin(np.sqrt(a))
    
    async def fetch_features_for_location(
        self,
        lat: float,
        lon: float,
        timestamp: datetime
    ) -> Dict[str, Any]:
        """Fetch all features for a location and time using ingestion pipeline."""
        try:
            data = await self.ingestion_pipeline.ingest_point_data(
                latitude=lat,
                longitude=lon,
                forecast_hours=72
            )
            return data  # Return full response including data_quality
        except Exception as e:
            logger.warning(f"Feature fetch failed for {lat}, {lon}: {e}")
            return {}
    
    def _extract_features_from_ingestion(
        self,
        ingestion_data: Dict,
        lat: float,
        lon: float,
        timestamp: datetime,
        forecast_horizon: int
    ) -> Tuple[Dict[str, Any], Dict[str, str]]:
        """Extract and flatten features from ingestion pipeline output.
        
        Returns:
            Tuple of (features dict, data_quality dict)
        """
        # The ingestion pipeline returns data under "data" key and quality under "data_quality"
        data = ingestion_data.get("data", ingestion_data)  # Handle both formats
        data_quality_meta = ingestion_data.get("data_quality", {})
        
        features = {}
        data_quality = {}
        
        # Copy over the data quality metadata
        for key, value in data_quality_meta.items():
            data_quality[key] = value
        
        # Weather features
        weather = data.get("weather", {})
        if weather and "hourly" in weather:
            hourly = weather["hourly"]
            idx = 0  # Current time index
            
            if "temperature_2m" in hourly:
                features["temperature_c"] = hourly["temperature_2m"][idx] if idx < len(hourly["temperature_2m"]) else None
                features["forecast_temp_min_24h"] = min(hourly["temperature_2m"][:24]) if len(hourly["temperature_2m"]) >= 24 else None
                features["forecast_temp_max_24h"] = max(hourly["temperature_2m"][:24]) if len(hourly["temperature_2m"]) >= 24 else None
                data_quality["temperature_c"] = "OBSERVED"
                data_quality["forecast_temp_min_24h"] = "OBSERVED"
                data_quality["forecast_temp_max_24h"] = "OBSERVED"
            
            if "relative_humidity_2m" in hourly:
                features["humidity_percent"] = hourly["relative_humidity_2m"][idx] if idx < len(hourly["relative_humidity_2m"]) else None
                data_quality["humidity_percent"] = "OBSERVED"
            
            if "wind_speed_10m" in hourly:
                features["wind_speed_kmh"] = hourly["wind_speed_10m"][idx] * 3.6 if idx < len(hourly["wind_speed_10m"]) else None
                features["forecast_wind_max_24h"] = max(hourly["wind_speed_10m"][:24]) * 3.6 if len(hourly["wind_speed_10m"]) >= 24 else None
                data_quality["wind_speed_kmh"] = "OBSERVED"
                data_quality["forecast_wind_max_24h"] = "OBSERVED"
            
            if "wind_direction_10m" in hourly:
                features["wind_direction_deg"] = hourly["wind_direction_10m"][idx] if idx < len(hourly["wind_direction_10m"]) else None
                data_quality["wind_direction_deg"] = "OBSERVED"
            
            if "surface_pressure" in hourly:
                features["pressure_hpa"] = hourly["surface_pressure"][idx] / 100 if idx < len(hourly["surface_pressure"]) else None
                data_quality["pressure_hpa"] = "OBSERVED"
            
            if "cape" in hourly:
                features["cape_jkg"] = hourly["cape"][idx] if idx < len(hourly["cape"]) else None
                features["forecast_cape_max_24h"] = max(hourly["cape"][:24]) if len(hourly["cape"]) >= 24 else None
                data_quality["cape_jkg"] = "OBSERVED"
                data_quality["forecast_cape_max_24h"] = "OBSERVED"
            
            if "precipitation" in hourly:
                features["forecast_precip_1h_mm"] = hourly["precipitation"][idx] if idx < len(hourly["precipitation"]) else None
                features["forecast_precip_6h_mm"] = sum(hourly["precipitation"][:6]) if len(hourly["precipitation"]) >= 6 else None
                features["forecast_precip_24h_mm"] = sum(hourly["precipitation"][:24]) if len(hourly["precipitation"]) >= 24 else None
                features["forecast_precip_72h_mm"] = sum(hourly["precipitation"][:72]) if len(hourly["precipitation"]) >= 72 else None
                data_quality["forecast_precip_1h_mm"] = "OBSERVED"
                data_quality["forecast_precip_6h_mm"] = "OBSERVED"
                data_quality["forecast_precip_24h_mm"] = "OBSERVED"
                data_quality["forecast_precip_72h_mm"] = "OBSERVED"
            
            if "precipitation_probability" in hourly:
                features["forecast_precip_prob_max"] = max(hourly["precipitation_probability"][:24]) if len(hourly["precipitation_probability"]) >= 24 else None
                data_quality["forecast_precip_prob_max"] = "OBSERVED"
            
            if "soil_moisture_0_to_7cm" in hourly:
                features["soil_moisture_0_7cm"] = hourly["soil_moisture_0_to_7cm"][idx] if idx < len(hourly["soil_moisture_0_to_7cm"]) else None
                data_quality["soil_moisture_0_7cm"] = "OBSERVED"
            
            if "soil_moisture_7_to_28cm" in hourly:
                features["soil_moisture_7_28cm"] = hourly["soil_moisture_7_to_28cm"][idx] if idx < len(hourly["soil_moisture_7_to_28cm"]) else None
                data_quality["soil_moisture_7_28cm"] = "OBSERVED"
        
        # Soil features
        soil = data.get("soil", {})
        if soil and "derived" in soil:
            derived = soil["derived"]
            if derived.get("ksat_mm_h") is not None:
                features["soil_ksat_mmhr"] = derived.get("ksat_mm_h")
                data_quality["soil_ksat_mmhr"] = "DERIVED_FROM_OBSERVED"
            if derived.get("awc_mm") is not None:
                features["soil_awc_mm"] = derived.get("awc_mm")
                data_quality["soil_awc_mm"] = "DERIVED_FROM_OBSERVED"
            if derived.get("k_factor") is not None:
                features["soil_k_factor"] = derived.get("k_factor")
                data_quality["soil_k_factor"] = "DERIVED_FROM_OBSERVED"
            if derived.get("hydrologic_group") is not None:
                features["hydrologic_soil_group"] = derived.get("hydrologic_group")
                data_quality["hydrologic_soil_group"] = "DERIVED_FROM_OBSERVED"
        
        if soil:
            soil_status = soil.get("data_status", "UNKNOWN")
            for prop, depths in soil.items():
                if prop != "derived" and isinstance(depths, dict):
                    surface_val = depths.get("0-5cm")
                    if surface_val is not None:
                        if prop == "clay":
                            features["soil_clay_percent"] = surface_val * 100
                            data_quality["soil_clay_percent"] = "OBSERVED"
                        elif prop == "sand":
                            features["soil_sand_percent"] = surface_val * 100
                            data_quality["soil_sand_percent"] = "OBSERVED"
                        elif prop == "silt":
                            features["soil_silt_percent"] = surface_val * 100
                            data_quality["soil_silt_percent"] = "OBSERVED"
                        elif prop == "ocd":
                            features["soil_organic_carbon_percent"] = surface_val
                            data_quality["soil_organic_carbon_percent"] = "OBSERVED"
                        elif prop == "bdod":
                            features["soil_bulk_density_gcm3"] = surface_val
                            data_quality["soil_bulk_density_gcm3"] = "OBSERVED"
                        elif prop == "phh2o":
                            features["soil_ph"] = surface_val / 10
                            data_quality["soil_ph"] = "OBSERVED"
                        elif prop == "cec":
                            features["soil_cec_cmolkg"] = surface_val
                            data_quality["soil_cec_cmolkg"] = "OBSERVED"
            # Track soil data status
            if "soil" in data:
                data_quality["soil_overall"] = soil.get("data_status", "UNKNOWN")
        
        # Terrain features
        terrain = data.get("terrain", {})
        if terrain:
            features["elevation_m"] = terrain.get("elevation_m")
            features["slope_deg"] = terrain.get("slope_deg")
            features["aspect_deg"] = terrain.get("aspect_deg")
            features["twi"] = terrain.get("twi")
            features["spi"] = terrain.get("spi")
            features["flow_accumulation"] = terrain.get("flow_accumulation")
            if features.get("slope_deg"):
                features["slope_pct"] = np.tan(np.radians(features["slope_deg"])) * 100
                features["aspect_northness"] = np.cos(np.radians(features["aspect_deg"])) if features.get("aspect_deg") else None
                features["aspect_eastness"] = np.sin(np.radians(features["aspect_deg"])) if features.get("aspect_deg") else None
            data_quality["elevation_m"] = "OBSERVED"
            data_quality["slope_deg"] = "OBSERVED"
            data_quality["twi"] = "OBSERVED"
            data_quality["spi"] = "OBSERVED"
            data_quality["flow_accumulation"] = "OBSERVED"
        
        # Land cover features
        landcover = data.get("landcover", {})
        if landcover:
            features["landcover_class"] = landcover.get("class")
            features["impervious_fraction"] = landcover.get("impervious_percent", 0) / 100
            features["vegetation_fraction"] = landcover.get("vegetation_fraction", 0)
            data_quality["landcover_class"] = "OBSERVED"
            data_quality["impervious_fraction"] = "OBSERVED"
            data_quality["vegetation_fraction"] = "OBSERVED"
        
        # Population features
        population = data.get("population", {})
        if population:
            features["population_density_per_km2"] = population.get("density_per_km2")
            features["population_total"] = population.get("total")
            data_quality["population_density_per_km2"] = "OBSERVED"
            data_quality["population_total"] = "OBSERVED"
        
        # Infrastructure features
        infra = data.get("infrastructure", {})
        if infra:
            infra_status = infra.get("data_status", "UNKNOWN")
            features["hospital_count"] = infra.get("hospitals")
            features["school_count"] = infra.get("schools")
            features["shelter_count"] = infra.get("emergency_shelters")
            if infra.get("hospitals") is not None:
                data_quality["hospital_count"] = "OBSERVED"
            if infra.get("schools") is not None:
                data_quality["school_count"] = "OBSERVED"
            if infra.get("emergency_shelters") is not None:
                data_quality["shelter_count"] = "OBSERVED"
            data_quality["infrastructure_overall"] = infra_status
        
        # CHIRPS - mark as unavailable
        chirps = data.get("chirps", {})
        if chirps:
            data_quality["chirps_rainfall_mm"] = chirps.get("data_status", "UNAVAILABLE")
        
        # Track data sources
        data_quality["data_sources"] = list(data.keys())
        
        return features, data_quality
    
    async def create_training_sample(
        self,
        session: AsyncSession,
        lat: float,
        lon: float,
        event_date: datetime,
        grid_cell_id: str,
        flood_occurred: int,
        label_source: str,
        label_confidence: float,
        forecast_horizon: int = 72
    ) -> Optional[TrainingSample]:
        """Create a single training sample with all features."""
        try:
            # Check if sample already exists
            existing = await session.execute(
                text("SELECT 1 FROM training_samples WHERE grid_cell_id = :gid AND event_date = :edt AND forecast_horizon_hours = :fh"),
                {"gid": grid_cell_id, "edt": event_date, "fh": forecast_horizon}
            )
            if existing.scalar():
                logger.debug(f"Sample already exists for {grid_cell_id} at {event_date}")
                return None
            
            # Fetch features from ingestion pipeline
            ingestion_data = await self.fetch_features_for_location(lat, lon, event_date)
            
            # Extract features with data quality tracking
            features, data_quality = self._extract_features_from_ingestion(
                ingestion_data, lat, lon, event_date, forecast_horizon
            )
            
            # Calculate data quality metrics
            non_null = sum(1 for v in features.values() if v is not None)
            total = len(features)
            feature_completeness = non_null / total if total > 0 else 0
            
            # Overall data quality score based on source quality
            quality_scores = []
            for source, status in data_quality.items():
                if status == "OBSERVED":
                    quality_scores.append(1.0)
                elif status == "DERIVED_FROM_OBSERVED":
                    quality_scores.append(0.8)
                elif status == "ESTIMATED":
                    quality_scores.append(0.5)
                elif status == "UNAVAILABLE":
                    quality_scores.append(0.0)
            overall_quality = np.mean(quality_scores) if quality_scores else 0.0
            
            if feature_completeness < self.config.min_feature_completeness:
                logger.warning(f"Low feature completeness ({feature_completeness:.2f}) for {lat}, {lon}")
            
            # Create sample
            sample = TrainingSample(
                grid_cell_id=grid_cell_id,
                latitude=lat,
                longitude=lon,
                location=func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                event_date=event_date,
                forecast_horizon_hours=forecast_horizon,
                flood_occurred=flood_occurred,
                label_source=label_source,
                label_confidence=label_confidence,
                feature_version=self.config.feature_version,
                data_quality_score=overall_quality,
                feature_completeness=feature_completeness,
                data_sources=data_quality.get("data_sources", []),
                **{k: v for k, v in features.items() if v is not None}
            )
            
            session.add(sample)
            return sample
            
        except Exception as e:
            logger.error(f"Failed to create training sample for {lat}, {lon}: {e}")
            return None
    
    async def materialize(
        self,
        dataset_name: str = "floodguard_south_india",
        version: str = "1.0",
        description: str = "Training dataset for South India flash flood prediction"
    ) -> TrainingDataset:
        """Run the complete materialization pipeline."""
        logger.info(f"Starting training data materialization for {dataset_name} v{version}")
        
        async with async_session_maker() as session:
            # Fetch positive events
            positive_events = await self.fetch_positive_events(session)
            
            if not positive_events:
                logger.warning("No positive events found, cannot create training dataset")
                return None
            
            # Create positive samples (one per forecast horizon per event)
            positive_samples = []
            for event in positive_events:
                if not event.latitude or not event.longitude or not event.start_date:
                    continue
                
                grid_id = self._latlon_to_grid_id(event.latitude, event.longitude)
                
                for horizon in self.config.forecast_horizons_hours:
                    sample = await self.create_training_sample(
                        session=session,
                        lat=event.latitude,
                        lon=event.longitude,
                        event_date=event.start_date,
                        grid_cell_id=grid_id,
                        flood_occurred=1,
                        label_source=event.source,
                        label_confidence=0.9 if event.is_verified else 0.7,
                        forecast_horizon=horizon
                    )
                    if sample:
                        positive_samples.append(sample)
            
            logger.info(f"Created {len(positive_samples)} positive samples")
            
            # Generate negative samples
            n_negatives_needed = int(len(positive_samples) * self.config.negative_sampling_ratio)
            negative_configs = await self.generate_negative_samples(
                session, positive_events, n_negatives_needed
            )
            
            negative_samples = []
            for neg_config in negative_configs:
                for horizon in self.config.forecast_horizons_hours:
                    sample = await self.create_training_sample(
                        session=session,
                        lat=neg_config["latitude"],
                        lon=neg_config["longitude"],
                        event_date=neg_config["event_date"],
                        grid_cell_id=neg_config["grid_cell_id"],
                        flood_occurred=0,
                        label_source=neg_config["label_source"],
                        label_confidence=neg_config["label_confidence"],
                        forecast_horizon=horizon
                    )
                    if sample:
                        negative_samples.append(sample)
            
            logger.info(f"Created {len(negative_samples)} negative samples")
            
            # Commit all samples
            await session.commit()
            
            # Create dataset record
            all_samples = positive_samples + negative_samples
            feature_names = [
                "rainfall_1h_mm", "rainfall_6h_mm", "rainfall_24h_mm", "rainfall_72h_mm",
                "temperature_c", "humidity_percent", "wind_speed_kmh", "pressure_hpa",
                "elevation_m", "slope_deg", "twi",
                "soil_clay_percent", "soil_sand_percent", "soil_ksat_mmhr",
                "landcover_class", "population_density_per_km2", "historical_flood_count"
            ]
            
            feature_str = ','.join(sorted(feature_names))
            feature_hash = hashlib.sha256(feature_str.encode()).hexdigest()[:16]
            
            dataset = TrainingDataset(
                name=dataset_name,
                version=version,
                description=description,
                total_samples=len(all_samples),
                positive_samples=len(positive_samples),
                negative_samples=len(negative_samples),
                min_lat=self.config.min_lat,
                max_lat=self.config.max_lat,
                min_lon=self.config.min_lon,
                max_lon=self.config.max_lon,
start_date=self.config.start_date if isinstance(self.config.start_date, datetime) else (datetime.fromisoformat(self.config.start_date) if self.config.start_date else None),
            end_date=self.config.end_date if isinstance(self.config.end_date, datetime) else (datetime.fromisoformat(self.config.end_date) if self.config.end_date else datetime.utcnow()),
                feature_version=self.config.feature_version,
                feature_names=feature_names,
                feature_hash=feature_hash,
                data_sources=["open_meteo", "chirps", "copernicus_dem", "soilgrids", "esa_worldcover", "osm", "worldpop"],
                positive_sources=self.config.positive_sources,
                split_strategy="spatial_temporal",
                test_size=self.config.negative_sampling_ratio / (1 + self.config.negative_sampling_ratio),
                val_size=0.1,
                n_splits=5,
                spatial_buffer_km=self.config.spatial_buffer_km,
                temporal_buffer_days=self.config.temporal_buffer_days,
                random_state=42,
                created_by="materializer",
                is_active=True
            )
            
            session.add(dataset)
            await session.commit()
            
            logger.info(f"Materialization complete: {len(all_samples)} total samples "
                       f"({len(positive_samples)} positive, {len(negative_samples)} negative)")
            
            return dataset


async def run_materialization(
    dataset_name: str = "floodguard_south_india",
    version: str = "1.0",
    config: Optional[MaterializationConfig] = None
) -> TrainingDataset:
    """Run the complete materialization pipeline."""
    materializer = TrainingDataMaterializer(config)
    await materializer.initialize()
    
    try:
        dataset = await materializer.materialize(dataset_name, version)
        return dataset
    finally:
        await materializer.close()


# For running as script
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_materialization())