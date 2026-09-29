# FloodGuard Feature Store
"""Real-time feature store with caching and materialized views."""

import asyncio
import logging
import time
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import numpy as np
import json

from app.core.config import settings
from app.db.session import get_db
from sqlalchemy import text, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class FeatureVector:
    """Feature vector with metadata."""
    feature_id: str
    entity_id: str  # location hash or grid cell ID
    entity_type: str  # "point", "grid", "polygon"
    features: Dict[str, float]
    feature_names: List[str]
    timestamp: datetime
    data_sources: List[str]
    data_quality: str
    validity_start: datetime
    validity_end: datetime
    version: int = 1


@dataclass
class FeatureDefinition:
    """Feature definition with metadata."""
    name: str
    description: str
    data_type: str  # "numeric", "categorical", "boolean"
    source: str  # "rainfall", "weather", "terrain", "soil", "landcover", "population", "historical"
    computation: str  # "raw", "aggregated", "derived", "ml"
    unit: str
    update_frequency: str  # "real-time", "hourly", "daily", "static"
    dependencies: List[str] = field(default_factory=list)
    valid_range: Optional[Tuple[float, float]] = None
    default_value: Optional[float] = None


class FeatureStore:
    """Feature store for managing and serving ML features."""
    
    def __init__(self, cache_ttl: int = 3600, max_cache_size: int = 100000):
        self.cache_ttl = cache_ttl
        self.max_cache_size = max_cache_size
        self._cache: Dict[str, Tuple[FeatureVector, float]] = {}
        self._cache_lock = asyncio.Lock()
        self._definitions: Dict[str, FeatureDefinition] = {}
        self._materialized_views: Dict[str, Any] = {}
        self._register_default_features()
    
    def _register_default_features(self):
        """Register default feature definitions."""
        features = [
            # Rainfall features
            FeatureDefinition(
                name="rainfall_1h_mm",
                description="1-hour accumulated rainfall",
                data_type="numeric",
                source="rainfall",
                computation="raw",
                unit="mm",
                update_frequency="real-time",
                valid_range=(0, 500)
            ),
            FeatureDefinition(
                name="rainfall_6h_mm",
                description="6-hour accumulated rainfall",
                data_type="numeric",
                source="rainfall",
                computation="aggregated",
                unit="mm",
                update_frequency="hourly",
                valid_range=(0, 500)
            ),
            FeatureDefinition(
                name="rainfall_24h_mm",
                description="24-hour accumulated rainfall",
                data_type="numeric",
                source="rainfall",
                computation="aggregated",
                unit="mm",
                update_frequency="hourly",
                valid_range=(0, 1000)
            ),
            FeatureDefinition(
                name="rainfall_72h_mm",
                description="72-hour accumulated rainfall",
                data_type="numeric",
                source="rainfall",
                computation="aggregated",
                unit="mm",
                update_frequency="hourly",
                valid_range=(0, 2000)
            ),
            FeatureDefinition(
                name="rainfall_intensity_mm_per_h",
                description="Rainfall intensity",
                data_type="numeric",
                source="rainfall",
                computation="derived",
                unit="mm/h",
                update_frequency="hourly",
                dependencies=["rainfall_1h_mm"]
            ),
            FeatureDefinition(
                name="rainfall_anomaly",
                description="Rainfall anomaly vs climatology",
                data_type="numeric",
                source="rainfall",
                computation="derived",
                unit="mm",
                update_frequency="daily",
                dependencies=["rainfall_24h_mm"]
            ),
            
            # Weather features
            FeatureDefinition(
                name="temperature_c",
                description="Air temperature",
                data_type="numeric",
                source="weather",
                computation="raw",
                unit="°C",
                update_frequency="real-time",
                valid_range=(-10, 50)
            ),
            FeatureDefinition(
                name="humidity_percent",
                description="Relative humidity",
                data_type="numeric",
                source="weather",
                computation="raw",
                unit="%",
                update_frequency="real-time",
                valid_range=(0, 100)
            ),
            FeatureDefinition(
                name="wind_speed_kmh",
                description="Wind speed",
                data_type="numeric",
                source="weather",
                computation="raw",
                unit="km/h",
                update_frequency="real-time",
                valid_range=(0, 200)
            ),
            FeatureDefinition(
                name="pressure_hpa",
                description="Atmospheric pressure",
                data_type="numeric",
                source="weather",
                computation="raw",
                unit="hPa",
                update_frequency="real-time",
                valid_range=(850, 1080)
            ),
            FeatureDefinition(
                name="cape_j_kg",
                description="Convective Available Potential Energy",
                data_type="numeric",
                source="weather",
                computation="raw",
                unit="J/kg",
                update_frequency="hourly",
                valid_range=(0, 5000)
            ),
            
            # Terrain features
            FeatureDefinition(
                name="elevation_m",
                description="Elevation above sea level",
                data_type="numeric",
                source="terrain",
                computation="raw",
                unit="m",
                update_frequency="static",
                valid_range=(0, 3000)
            ),
            FeatureDefinition(
                name="slope_deg",
                description="Terrain slope",
                data_type="numeric",
                source="terrain",
                computation="derived",
                unit="degrees",
                update_frequency="static",
                valid_range=(0, 90),
                dependencies=["elevation_m"]
            ),
            FeatureDefinition(
                name="aspect_deg",
                description="Terrain aspect",
                data_type="numeric",
                source="terrain",
                computation="derived",
                unit="degrees",
                update_frequency="static",
                valid_range=(0, 360),
                dependencies=["elevation_m"]
            ),
            FeatureDefinition(
                name="curvature",
                description="Terrain curvature",
                data_type="numeric",
                source="terrain",
                computation="derived",
                unit="1/m",
                update_frequency="static",
                dependencies=["elevation_m"]
            ),
            FeatureDefinition(
                name="twi",
                description="Topographic Wetness Index",
                data_type="numeric",
                source="terrain",
                computation="derived",
                unit="",
                update_frequency="static",
                dependencies=["slope_deg", "curvature"]
            ),
            FeatureDefinition(
                name="spi",
                description="Stream Power Index",
                data_type="numeric",
                source="terrain",
                computation="derived",
                unit="",
                update_frequency="static",
                dependencies=["slope_deg", "curvature"]
            ),
            FeatureDefinition(
                name="flow_accumulation",
                description="Flow accumulation",
                data_type="numeric",
                source="terrain",
                computation="derived",
                unit="cells",
                update_frequency="static",
                dependencies=["elevation_m"]
            ),
            FeatureDefinition(
                name="distance_to_stream_m",
                description="Distance to nearest stream",
                data_type="numeric",
                source="terrain",
                computation="derived",
                unit="m",
                update_frequency="static",
                dependencies=["flow_accumulation"]
            ),
            FeatureDefinition(
                name="drainage_density_km_km2",
                description="Drainage density",
                data_type="numeric",
                source="terrain",
                computation="derived",
                unit="km/km²",
                update_frequency="static",
                dependencies=["flow_accumulation"]
            ),
            
            # Soil features
            FeatureDefinition(
                name="soil_clay_percent",
                description="Clay content",
                data_type="numeric",
                source="soil",
                computation="raw",
                unit="%",
                update_frequency="static",
                valid_range=(0, 100)
            ),
            FeatureDefinition(
                name="soil_sand_percent",
                description="Sand content",
                data_type="numeric",
                source="soil",
                computation="raw",
                unit="%",
                update_frequency="static",
                valid_range=(0, 100)
            ),
            FeatureDefinition(
                name="soil_silt_percent",
                description="Silt content",
                data_type="numeric",
                source="soil",
                computation="raw",
                unit="%",
                update_frequency="static",
                valid_range=(0, 100)
            ),
            FeatureDefinition(
                name="soil_organic_carbon_percent",
                description="Organic carbon content",
                data_type="numeric",
                source="soil",
                computation="raw",
                unit="%",
                update_frequency="static",
                valid_range=(0, 50)
            ),
            FeatureDefinition(
                name="soil_bulk_density_g_cm3",
                description="Bulk density",
                data_type="numeric",
                source="soil",
                computation="raw",
                unit="g/cm³",
                update_frequency="static",
                valid_range=(0.5, 2.0)
            ),
            FeatureDefinition(
                name="soil_ph",
                description="Soil pH",
                data_type="numeric",
                source="soil",
                computation="raw",
                unit="",
                update_frequency="static",
                valid_range=(3, 10)
            ),
            FeatureDefinition(
                name="soil_cation_exchange_capacity",
                description="Cation exchange capacity",
                data_type="numeric",
                source="soil",
                computation="raw",
                unit="cmol/kg",
                update_frequency="static",
                valid_range=(0, 100)
            ),
            FeatureDefinition(
                name="soil_saturated_conductivity_mm_h",
                description="Saturated hydraulic conductivity",
                data_type="numeric",
                source="soil",
                computation="derived",
                unit="mm/h",
                update_frequency="static",
                dependencies=["soil_clay_percent", "soil_sand_percent", "soil_bulk_density_g_cm3"]
            ),
            FeatureDefinition(
                name="soil_available_water_capacity",
                description="Available water capacity",
                data_type="numeric",
                source="soil",
                computation="derived",
                unit="mm",
                update_frequency="static",
                dependencies=["soil_clay_percent", "soil_sand_percent", "soil_organic_carbon_percent"]
            ),
            FeatureDefinition(
                name="soil_erodibility_k",
                description="Soil erodibility factor (K)",
                data_type="numeric",
                source="soil",
                computation="derived",
                unit="",
                update_frequency="static",
                dependencies=["soil_clay_percent", "soil_sand_percent", "soil_silt_percent", "soil_organic_carbon_percent"]
            ),
            
            # Land cover features
            FeatureDefinition(
                name="landcover_class",
                description="ESA WorldCover land cover class",
                data_type="categorical",
                source="landcover",
                computation="raw",
                unit="",
                update_frequency="annual",
                valid_range=(10, 100)
            ),
            FeatureDefinition(
                name="impervious_surface_percent",
                description="Impervious surface percentage",
                data_type="numeric",
                source="landcover",
                computation="derived",
                unit="%",
                update_frequency="annual",
                valid_range=(0, 100),
                dependencies=["landcover_class"]
            ),
            FeatureDefinition(
                name="vegetation_fraction",
                description="Vegetation fraction",
                data_type="numeric",
                source="landcover",
                computation="derived",
                unit="",
                update_frequency="annual",
                valid_range=(0, 1),
                dependencies=["landcover_class"]
            ),
            FeatureDefinition(
                name="forest_cover_percent",
                description="Forest cover percentage",
                data_type="numeric",
                source="landcover",
                computation="derived",
                unit="%",
                update_frequency="annual",
                valid_range=(0, 100),
                dependencies=["landcover_class"]
            ),
            FeatureDefinition(
                name="urban_cover_percent",
                description="Urban cover percentage",
                data_type="numeric",
                source="landcover",
                computation="derived",
                unit="%",
                update_frequency="annual",
                valid_range=(0, 100),
                dependencies=["landcover_class"]
            ),
            FeatureDefinition(
                name="water_cover_percent",
                description="Water cover percentage",
                data_type="numeric",
                source="landcover",
                computation="derived",
                unit="%",
                update_frequency="annual",
                valid_range=(0, 100),
                dependencies=["landcover_class"]
            ),
            FeatureDefinition(
                name="crop_cover_percent",
                description="Crop cover percentage",
                data_type="numeric",
                source="landcover",
                computation="derived",
                unit="%",
                update_frequency="annual",
                valid_range=(0, 100),
                dependencies=["landcover_class"]
            ),
            FeatureDefinition(
                name="ndvi",
                description="Normalized Difference Vegetation Index",
                data_type="numeric",
                source="landcover",
                computation="derived",
                unit="",
                update_frequency="weekly",
                valid_range=(-1, 1)
            ),
            FeatureDefinition(
                name="ndwi",
                description="Normalized Difference Water Index",
                data_type="numeric",
                source="landcover",
                computation="derived",
                unit="",
                update_frequency="weekly",
                valid_range=(-1, 1)
            ),
            
            # Population features
            FeatureDefinition(
                name="population_density_per_km2",
                description="Population density",
                data_type="numeric",
                source="population",
                computation="raw",
                unit="people/km²",
                update_frequency="annual",
                valid_range=(0, 100000)
            ),
            FeatureDefinition(
                name="population_total",
                description="Total population in area",
                data_type="numeric",
                source="population",
                computation="aggregated",
                unit="people",
                update_frequency="annual",
                valid_range=(0, 1000000)
            ),
            FeatureDefinition(
                name="vulnerable_population_percent",
                description="Vulnerable population percentage",
                data_type="numeric",
                source="population",
                computation="derived",
                unit="%",
                update_frequency="annual",
                valid_range=(0, 100)
            ),
            FeatureDefinition(
                name="building_density_per_km2",
                description="Building density",
                data_type="numeric",
                source="population",
                computation="derived",
                unit="buildings/km²",
                update_frequency="annual",
                dependencies=["population_density_per_km2"]
            ),
            FeatureDefinition(
                name="critical_infrastructure_count",
                description="Critical infrastructure count",
                data_type="numeric",
                source="population",
                computation="aggregated",
                unit="count",
                update_frequency="annual",
                valid_range=(0, 1000)
            ),
            
            # Historical flood features
            FeatureDefinition(
                name="historical_flood_count",
                description="Number of historical flood events",
                data_type="numeric",
                source="historical",
                computation="aggregated",
                unit="count",
                update_frequency="annual",
                valid_range=(0, 100)
            ),
            FeatureDefinition(
                name="years_since_last_flood",
                description="Years since last flood event",
                data_type="numeric",
                source="historical",
                computation="derived",
                unit="years",
                update_frequency="annual",
                valid_range=(0, 100)
            ),
            FeatureDefinition(
                name="max_historical_flood_depth_m",
                description="Maximum historical flood depth",
                data_type="numeric",
                source="historical",
                computation="aggregated",
                unit="m",
                update_frequency="annual",
                valid_range=(0, 10)
            ),
            FeatureDefinition(
                name="flood_frequency_per_decade",
                description="Flood frequency per decade",
                data_type="numeric",
                source="historical",
                computation="derived",
                unit="events/decade",
                update_frequency="annual",
                dependencies=["historical_flood_count"]
            ),
            FeatureDefinition(
                name="historical_flood_duration_days",
                description="Average historical flood duration",
                data_type="numeric",
                source="historical",
                computation="aggregated",
                unit="days",
                update_frequency="annual",
                valid_range=(0, 365)
            ),
            
            # IoT sensor features
            FeatureDefinition(
                name="sensor_rainfall_mm",
                description="IoT sensor rainfall reading",
                data_type="numeric",
                source="iot",
                computation="raw",
                unit="mm",
                update_frequency="real-time",
                valid_range=(0, 500)
            ),
            FeatureDefinition(
                name="sensor_water_level_m",
                description="IoT sensor water level",
                data_type="numeric",
                source="iot",
                computation="raw",
                unit="m",
                update_frequency="real-time",
                valid_range=(0, 10)
            ),
            FeatureDefinition(
                name="sensor_soil_moisture_percent",
                description="IoT sensor soil moisture",
                data_type="numeric",
                source="iot",
                computation="raw",
                unit="%",
                update_frequency="real-time",
                valid_range=(0, 100)
            ),
        ]
        
        for feat in features:
            self._definitions[feat.name] = feat
    
    def get_feature_definition(self, name: str) -> Optional[FeatureDefinition]:
        """Get feature definition by name."""
        return self._definitions.get(name)
    
    def list_features(
        self,
        source: Optional[str] = None,
        update_frequency: Optional[str] = None
    ) -> List[FeatureDefinition]:
        """List features with optional filters."""
        features = list(self._definitions.values())
        
        if source:
            features = [f for f in features if f.source == source]
        if update_frequency:
            features = [f for f in features if f.update_frequency == update_frequency]
        
        return features
    
    def _make_cache_key(self, entity_id: str, entity_type: str, feature_names: List[str]) -> str:
        """Create cache key for feature vector."""
        key_str = f"{entity_type}:{entity_id}:{':'.join(sorted(feature_names))}"
        return hashlib.sha256(key_str.encode()).hexdigest()[:32]
    
    async def get_features(
        self,
        entity_id: str,
        entity_type: str,
        feature_names: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> Optional[FeatureVector]:
        """Get feature vector for an entity."""
        if feature_names is None:
            feature_names = list(self._definitions.keys())
        
        cache_key = self._make_cache_key(entity_id, entity_type, feature_names)
        
        # Check cache
        if use_cache:
            async with self._cache_lock:
                if cache_key in self._cache:
                    feature_vector, timestamp = self._cache[cache_key]
                    if time.time() - timestamp < self.cache_ttl:
                        return feature_vector
                    else:
                        del self._cache[cache_key]
        
        # Fetch from database
        feature_vector = await self._fetch_features_from_db(entity_id, entity_type, feature_names)
        
        if feature_vector:
            # Cache it
            async with self._cache_lock:
                if len(self._cache) >= self.max_cache_size:
                    # Remove oldest
                    oldest_key = min(self._cache, key=lambda k: self._cache[k][1])
                    del self._cache[oldest_key]
                
                self._cache[cache_key] = (feature_vector, time.time())
        
        return feature_vector
    
    async def _fetch_features_from_db(
        self,
        entity_id: str,
        entity_type: str,
        feature_names: List[str]
    ) -> Optional[FeatureVector]:
        """Fetch features from database."""
        # This would query the feature tables in PostgreSQL
        # For now, return mock data
        
        features = {}
        data_sources = []
        
        for name in feature_names:
            definition = self._definitions.get(name)
            if definition:
                # Mock value based on feature type
                if definition.data_type == "numeric":
                    if definition.valid_range:
                        features[name] = np.random.uniform(
                            definition.valid_range[0],
                            definition.valid_range[1]
                        )
                    else:
                        features[name] = np.random.randn()
                elif definition.data_type == "categorical":
                    features[name] = np.random.randint(10, 100)
                elif definition.data_type == "boolean":
                    features[name] = float(np.random.choice([0, 1]))
                
                if definition.source not in data_sources:
                    data_sources.append(definition.source)
        
        now = datetime.utcnow()
        return FeatureVector(
            feature_id=hashlib.sha256(f"{entity_id}:{now.isoformat()}".encode()).hexdigest()[:16],
            entity_id=entity_id,
            entity_type=entity_type,
            features=features,
            feature_names=feature_names,
            timestamp=now,
            data_sources=data_sources,
            data_quality="GOOD",
            validity_start=now,
            validity_end=now + timedelta(hours=1),
            version=1
        )
    
    async def get_features_batch(
        self,
        entity_ids: List[str],
        entity_type: str,
        feature_names: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> Dict[str, FeatureVector]:
        """Get feature vectors for multiple entities."""
        results = {}
        
        # Process in parallel
        tasks = [
            self.get_features(eid, entity_type, feature_names, use_cache)
            for eid in entity_ids
        ]
        
        feature_vectors = await asyncio.gather(*tasks, return_exceptions=True)
        
        for eid, fv in zip(entity_ids, feature_vectors):
            if isinstance(fv, Exception):
                logger.error(f"Failed to get features for {eid}: {fv}")
            elif fv:
                results[eid] = fv
        
        return results
    
    async def store_features(self, feature_vector: FeatureVector) -> bool:
        """Store feature vector to database."""
        # This would upsert to PostgreSQL feature tables
        # For now, just cache it
        cache_key = self._make_cache_key(
            feature_vector.entity_id,
            feature_vector.entity_type,
            feature_vector.feature_names
        )
        
        async with self._cache_lock:
            if len(self._cache) >= self.max_cache_size:
                oldest_key = min(self._cache, key=lambda k: self._cache[k][1])
                del self._cache[oldest_key]
            
            self._cache[cache_key] = (feature_vector, time.time())
        
        return True
    
    async def compute_derived_features(
        self,
        base_features: Dict[str, float],
        feature_names: List[str]
    ) -> Dict[str, float]:
        """Compute derived features from base features."""
        derived = {}
        
        for name in feature_names:
            definition = self._definitions.get(name)
            if not definition or definition.computation != "derived":
                continue
            
            # Check if all dependencies are available
            deps_available = all(dep in base_features for dep in definition.dependencies)
            if not deps_available:
                continue
            
            # Compute derived feature
            if name == "rainfall_intensity_mm_per_h":
                derived[name] = base_features.get("rainfall_1h_mm", 0)
            
            elif name == "rainfall_anomaly":
                # Would compare to climatology
                derived[name] = base_features.get("rainfall_24h_mm", 0) - 5.0  # mock climatology
            
            elif name == "slope_deg":
                # Would compute from DEM
                derived[name] = np.random.uniform(0, 45)
            
            elif name == "aspect_deg":
                derived[name] = np.random.uniform(0, 360)
            
            elif name == "curvature":
                derived[name] = np.random.uniform(-1, 1)
            
            elif name == "twi":
                slope = base_features.get("slope_deg", 10)
                derived[name] = np.log(100 / max(np.tan(np.radians(slope)), 0.01))
            
            elif name == "spi":
                slope = base_features.get("slope_deg", 10)
                derived[name] = np.tan(np.radians(slope)) * np.random.uniform(1, 100)
            
            elif name == "flow_accumulation":
                derived[name] = np.random.uniform(1, 10000)
            
            elif name == "distance_to_stream_m":
                flow_acc = base_features.get("flow_accumulation", 100)
                derived[name] = max(10, 1000 / np.sqrt(flow_acc))
            
            elif name == "drainage_density_km_km2":
                flow_acc = base_features.get("flow_accumulation", 100)
                derived[name] = np.sqrt(flow_acc) / 100
            
            elif name == "soil_saturated_conductivity_mm_h":
                clay = base_features.get("soil_clay_percent", 30)
                sand = base_features.get("soil_sand_percent", 40)
                bulk = base_features.get("soil_bulk_density_g_cm3", 1.3)
                # Simplified pedotransfer function
                derived[name] = max(0.1, 100 * np.exp(-0.1 * clay) * (sand / 100) / bulk)
            
            elif name == "soil_available_water_capacity":
                clay = base_features.get("soil_clay_percent", 30)
                sand = base_features.get("soil_sand_percent", 40)
                oc = base_features.get("soil_organic_carbon_percent", 2)
                derived[name] = 0.1 * clay + 0.05 * sand + 0.2 * oc
            
            elif name == "soil_erodibility_k":
                clay = base_features.get("soil_clay_percent", 30)
                sand = base_features.get("soil_sand_percent", 40)
                silt = base_features.get("soil_silt_percent", 30)
                oc = base_features.get("soil_organic_carbon_percent", 2)
                # Simplified K factor
                derived[name] = 0.01 * (1 - 0.01 * oc) * (sand / 100) * (1 - silt / 100)
            
            elif name == "impervious_surface_percent":
                lc = base_features.get("landcover_class", 50)
                # Urban classes have high impervious
                derived[name] = 80 if lc in [50, 51, 52] else 10
            
            elif name == "vegetation_fraction":
                lc = base_features.get("landcover_class", 50)
                if lc in [10, 20, 30, 40, 60, 70, 80, 90]:  # vegetation classes
                    derived[name] = 0.8
                elif lc in [50, 51, 52]:  # urban
                    derived[name] = 0.1
                else:
                    derived[name] = 0.3
            
            elif name == "forest_cover_percent":
                lc = base_features.get("landcover_class", 50)
                derived[name] = 70 if lc in [10, 20] else 10
            
            elif name == "urban_cover_percent":
                lc = base_features.get("landcover_class", 50)
                derived[name] = 80 if lc in [50, 51, 52] else 5
            
            elif name == "water_cover_percent":
                lc = base_features.get("landcover_class", 50)
                derived[name] = 90 if lc in [80] else 0
            
            elif name == "crop_cover_percent":
                lc = base_features.get("landcover_class", 50)
                derived[name] = 60 if lc in [40] else 5
            
            elif name == "building_density_per_km2":
                pop_dens = base_features.get("population_density_per_km2", 100)
                derived[name] = pop_dens * 0.3
            
            elif name == "flood_frequency_per_decade":
                flood_count = base_features.get("historical_flood_count", 0)
                derived[name] = flood_count / 10
        
        return derived
    
    async def create_feature_vector(
        self,
        latitude: float,
        longitude: float,
        feature_names: Optional[List[str]] = None,
        include_derived: bool = True
    ) -> FeatureVector:
        """Create feature vector for a geographic point."""
        # Generate entity ID from coordinates
        entity_id = f"point_{latitude:.6f}_{longitude:.6f}"
        entity_id = hashlib.sha256(entity_id.encode()).hexdigest()[:16]
        
        if feature_names is None:
            feature_names = list(self._definitions.keys())
        
        # Get base features
        base_fv = await self.get_features(entity_id, "point", feature_names)
        
        if not base_fv:
            raise ValueError(f"Could not fetch base features for {latitude}, {longitude}")
        
        # Compute derived features
        if include_derived:
            derived = await self.compute_derived_features(base_fv.features, feature_names)
            base_fv.features.update(derived)
            base_fv.feature_names = list(base_fv.features.keys())
        
        return base_fv
    
    async def create_grid_features(
        self,
        bbox: Tuple[float, float, float, float],
        resolution: int = 250,
        feature_names: Optional[List[str]] = None
    ) -> List[FeatureVector]:
        """Create feature vectors for a grid."""
        min_lon, min_lat, max_lon, max_lat = bbox
        
        # Calculate grid size
        lat_step = resolution / 111000  # degrees per meter at equator
        lon_step = resolution / (111000 * np.cos(np.radians(min_lat)))
        
        n_lat = int((max_lat - min_lat) / lat_step) + 1
        n_lon = int((max_lon - min_lon) / lon_step) + 1
        
        # Limit grid size
        max_cells = 10000
        if n_lat * n_lon > max_cells:
            scale = np.sqrt(max_cells / (n_lat * n_lon))
            n_lat = int(n_lat * scale)
            n_lon = int(n_lon * scale)
            lat_step = (max_lat - min_lat) / n_lat
            lon_step = (max_lon - min_lon) / n_lon
        
        # Generate grid points
        entity_ids = []
        coordinates = []
        
        for i in range(n_lat):
            for j in range(n_lon):
                lat = min_lat + i * lat_step
                lon = min_lon + j * lon_step
                
                entity_id = f"grid_{lat:.6f}_{lon:.6f}"
                entity_id = hashlib.sha256(entity_id.encode()).hexdigest()[:16]
                
                entity_ids.append(entity_id)
                coordinates.append((lat, lon))
        
        # Fetch features for all grid cells
        feature_vectors = await self.get_features_batch(entity_ids, "grid", feature_names)
        
        # Add coordinates
        result = []
        for entity_id, (lat, lon) in zip(entity_ids, coordinates):
            if entity_id in feature_vectors:
                fv = feature_vectors[entity_id]
                fv.features["latitude"] = lat
                fv.features["longitude"] = lon
                result.append(fv)
        
        return result
    
    async def get_feature_statistics(
        self,
        feature_names: List[str],
        bbox: Optional[Tuple[float, float, float, float]] = None,
        time_range: Optional[Tuple[datetime, datetime]] = None
    ) -> Dict[str, Dict[str, float]]:
        """Get statistics for features over a region/time range."""
        stats = {}
        
        for name in feature_names:
            # Would query database for statistics
            # For now, return mock stats
            definition = self._definitions.get(name)
            if definition and definition.valid_range:
                stats[name] = {
                    "min": definition.valid_range[0],
                    "max": definition.valid_range[1],
                    "mean": (definition.valid_range[0] + definition.valid_range[1]) / 2,
                    "std": (definition.valid_range[1] - definition.valid_range[0]) / 4,
                    "count": 10000
                }
            else:
                stats[name] = {
                    "min": -10,
                    "max": 10,
                    "mean": 0,
                    "std": 1,
                    "count": 10000
                }
        
        return stats
    
    async def validate_features(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Validate feature values against definitions."""
        results = {
            "valid": True,
            "warnings": [],
            "errors": [],
            "feature_status": {}
        }
        
        for name, value in features.items():
            definition = self._definitions.get(name)
            if not definition:
                results["warnings"].append(f"Unknown feature: {name}")
                results["feature_status"][name] = "unknown"
                continue
            
            if definition.valid_range:
                min_val, max_val = definition.valid_range
                if value < min_val or value > max_val:
                    results["errors"].append(
                        f"Feature {name} value {value} outside valid range [{min_val}, {max_val}]"
                    )
                    results["feature_status"][name] = "invalid"
                    results["valid"] = False
                else:
                    results["feature_status"][name] = "valid"
            else:
                results["feature_status"][name] = "valid"
        
        return results
    
    async def get_data_quality_report(
        self,
        entity_ids: List[str],
        entity_type: str,
        feature_names: List[str]
    ) -> Dict[str, Any]:
        """Get data quality report for features."""
        feature_vectors = await self.get_features_batch(entity_ids, entity_type, feature_names)
        
        report = {
            "total_entities": len(entity_ids),
            "entities_with_features": len(feature_vectors),
            "coverage": len(feature_vectors) / len(entity_ids) if entity_ids else 0,
            "feature_quality": {},
            "data_sources": set()
        }
        
        for name in feature_names:
            values = []
            for fv in feature_vectors.values():
                if name in fv.features:
                    values.append(fv.features[name])
                    report["data_sources"].extend(fv.data_sources)
            
            if values:
                report["feature_quality"][name] = {
                    "completeness": len(values) / len(entity_ids),
                    "mean": float(np.mean(values)),
                    "std": float(np.std(values)),
                    "min": float(np.min(values)),
                    "max": float(np.max(values)),
                    "null_count": len(entity_ids) - len(values)
                }
            else:
                report["feature_quality"][name] = {
                    "completeness": 0,
                    "null_count": len(entity_ids)
                }
        
        report["data_sources"] = list(report["data_sources"])
        return report
    
    async def refresh_cache(self, entity_ids: Optional[List[str]] = None):
        """Refresh feature cache."""
        async with self._cache_lock:
            if entity_ids:
                # Remove specific entities from cache
                keys_to_remove = []
                for key in self._cache:
                    for eid in entity_ids:
                        if eid in key:
                            keys_to_remove.append(key)
                            break
                for key in keys_to_remove:
                    del self._cache[key]
            else:
                # Clear all cache
                self._cache.clear()
        
        logger.info("Feature cache refreshed")
    
    async def export_feature_schema(self, output_path: Path):
        """Export feature schema as JSON."""
        schema = {
            "features": [
                {
                    "name": f.name,
                    "description": f.description,
                    "data_type": f.data_type,
                    "source": f.source,
                    "computation": f.computation,
                    "unit": f.unit,
                    "update_frequency": f.update_frequency,
                    "dependencies": f.dependencies,
                    "valid_range": f.valid_range,
                    "default_value": f.default_value
                }
                for f in self._definitions.values()
            ],
            "exported_at": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }
        
        with open(output_path, 'w') as f:
            json.dump(schema, f, indent=2, default=str)
        
        logger.info(f"Feature schema exported to {output_path}")
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get feature store metrics."""
        async with self._cache_lock:
            return {
                "cache_size": len(self._cache),
                "cache_hit_rate": 0,  # Would track separately
                "total_features": len(self._definitions),
                "features_by_source": {
                    src: len([f for f in self._definitions.values() if f.source == src])
                    for src in set(f.source for f in self._definitions.values())
                },
                "features_by_frequency": {
                    freq: len([f for f in self._definitions.values() if f.update_frequency == freq])
                    for freq in set(f.update_frequency for f in self._definitions.values())
                }
            }


# Global feature store instance
_feature_store: Optional[FeatureStore] = None


def get_feature_store() -> FeatureStore:
    """Get or create global feature store."""
    global _feature_store
    if _feature_store is None:
        _feature_store = FeatureStore()
    return _feature_store


async def close_feature_store():
    """Close feature store."""
    global _feature_store
    _feature_store = None