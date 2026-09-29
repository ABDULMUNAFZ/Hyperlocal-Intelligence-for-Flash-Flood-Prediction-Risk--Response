# FloodGuard Feature Engineering Pipeline
"""Feature engineering for flood risk prediction using real geospatial and meteorological data."""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@dataclass
class FeatureConfig:
    """Configuration for feature engineering."""
    # Temporal windows for rainfall accumulation
    rainfall_windows_hours: List[int] = None
    
    # Spatial resolution for grid cells (meters)
    grid_resolution_m: int = 250
    
    # Topographic features
    include_slope: bool = True
    include_aspect: bool = True
    include_curvature: bool = True
    include_flow_accumulation: bool = True
    include_twi: bool = True  # Topographic Wetness Index
    include_spi: bool = True  # Stream Power Index
    
    # Soil features
    include_soil_texture: bool = True
    include_soil_hydraulic: bool = True
    include_soil_moisture: bool = True
    
    # Land cover
    include_landcover: bool = True
    include_impervious: bool = True
    
    # Hydrology
    include_distance_to_river: bool = True
    include_drainage_density: bool = True
    include_watershed_area: bool = True
    
    # Weather
    include_forecast_precip: bool = True
    include_forecast_humidity: bool = True
    include_forecast_wind: bool = True
    include_forecast_pressure: bool = True
    
    # Historical
    include_historical_flood_freq: bool = True
    include_historical_max_depth: bool = True
    
    # Demographic
    include_population: bool = True
    include_building_density: bool = True
    include_infrastructure: bool = True
    
    def __post_init__(self):
        if self.rainfall_windows_hours is None:
            self.rainfall_windows_hours = [1, 3, 6, 12, 24, 48, 72, 168]


class FeatureEngineer:
    """Feature engineering pipeline for flood risk prediction."""
    
    def __init__(self, config: Optional[FeatureConfig] = None):
        self.config = config or FeatureConfig()
        self.feature_names: List[str] = []
        self.feature_metadata: Dict[str, Dict] = {}
        
    def get_feature_names(self) -> List[str]:
        """Return list of all feature names."""
        return self.feature_names.copy()
    
    def get_feature_metadata(self, feature_name: str) -> Optional[Dict]:
        """Get metadata for a specific feature."""
        return self.feature_metadata.get(feature_name)
    
    def extract_rainfall_features(
        self,
        rainfall_data: pd.DataFrame,
        location: Tuple[float, float],
        timestamp: datetime,
        historical_data: Optional[pd.DataFrame] = None
    ) -> Dict[str, float]:
        """
        Extract rainfall-based features for a location and time.
        
        Args:
            rainfall_data: DataFrame with columns [timestamp, latitude, longitude, rainfall_mm]
            location: (lat, lon) tuple
            timestamp: Prediction timestamp
            historical_data: Optional historical rainfall for antecedent calculation
            
        Returns:
            Dictionary of rainfall features
        """
        features = {}
        lat, lon = location
        
        # Filter data for location (with small buffer)
        buffer_deg = 0.01  # ~1km
        local_data = rainfall_data[
            (rainfall_data['latitude'].between(lat - buffer_deg, lat + buffer_deg)) &
            (rainfall_data['longitude'].between(lon - buffer_deg, lon + buffer_deg)) &
            (rainfall_data['timestamp'] <= timestamp)
        ].copy()
        
        if local_data.empty:
            logger.warning(f"No rainfall data for location {location} at {timestamp}")
            return self._empty_rainfall_features()
        
        # Sort by timestamp
        local_data = local_data.sort_values('timestamp')
        
        # Accumulation windows
        for window_h in self.config.rainfall_windows_hours:
            cutoff = timestamp - timedelta(hours=window_h)
            window_data = local_data[local_data['timestamp'] >= cutoff]
            
            if not window_data.empty:
                total_rain = window_data['rainfall_mm'].sum()
                max_intensity = window_data['rainfall_mm'].max()
                mean_intensity = window_data['rainfall_mm'].mean()
                wet_hours = (window_data['rainfall_mm'] > 0).sum()
                dry_spell = self._calculate_dry_spell(local_data, timestamp)
                
                features[f'rainfall_{window_h}h_sum_mm'] = float(total_rain)
                features[f'rainfall_{window_h}h_max_intensity_mmhr'] = float(max_intensity)
                features[f'rainfall_{window_h}h_mean_intensity_mmhr'] = float(mean_intensity)
                features[f'rainfall_{window_h}h_wet_hours'] = int(wet_hours)
                features[f'rainfall_{window_h}h_dry_spell_hours'] = dry_spell
            else:
                features[f'rainfall_{window_h}h_sum_mm'] = 0.0
                features[f'rainfall_{window_h}h_max_intensity_mmhr'] = 0.0
                features[f'rainfall_{window_h}h_mean_intensity_mmhr'] = 0.0
                features[f'rainfall_{window_h}h_wet_hours'] = 0
                features[f'rainfall_{window_h}h_dry_spell_hours'] = 0
        
        # Antecedent rainfall (7 days, 14 days, 30 days)
        for days in [7, 14, 30]:
            cutoff = timestamp - timedelta(days=days)
            if historical_data is not None:
                hist_local = historical_data[
                    (historical_data['latitude'].between(lat - 0.01, lat + 0.01)) &
                    (historical_data['longitude'].between(lon - 0.01, lon + 0.01)) &
                    (historical_data['timestamp'] >= cutoff) &
                    (historical_data['timestamp'] < timestamp)
                ]
                antecedent_sum = hist_local['rainfall_mm'].sum() if not hist_local.empty else 0.0
            else:
                antecedent_sum = 0.0
            features[f'antecedent_rainfall_{days}d_mm'] = float(antecedent_sum)
        
        # Rainfall intensity percentiles
        if not local_data.empty:
            features['rainfall_intensity_p95'] = float(local_data['rainfall_mm'].quantile(0.95))
            features['rainfall_intensity_p99'] = float(local_data['rainfall_mm'].quantile(0.99))
        
        self._register_features(features, 'rainfall')
        return features
    
    def _calculate_dry_spell(self, data: pd.DataFrame, timestamp: datetime) -> int:
        """Calculate hours since last rainfall > 0."""
        data = data[data['timestamp'] <= timestamp].sort_values('timestamp', ascending=False)
        for i, row in data.iterrows():
            if row['rainfall_mm'] > 0:
                return int((timestamp - row['timestamp']).total_seconds() / 3600)
        return 168  # Max 1 week
    
    def _empty_rainfall_features(self) -> Dict[str, float]:
        """Return empty rainfall features when no data available."""
        features = {}
        for window_h in self.config.rainfall_windows_hours:
            features[f'rainfall_{window_h}h_sum_mm'] = 0.0
            features[f'rainfall_{window_h}h_max_intensity_mmhr'] = 0.0
            features[f'rainfall_{window_h}h_mean_intensity_mmhr'] = 0.0
            features[f'rainfall_{window_h}h_wet_hours'] = 0.0
            features[f'rainfall_{window_h}h_dry_spell_hours'] = 168
        for days in [7, 14, 30]:
            features[f'antecedent_rainfall_{days}d_mm'] = 0.0
        features['rainfall_intensity_p95'] = 0.0
        features['rainfall_intensity_p99'] = 0.0
        return features
    
    def extract_weather_features(
        self,
        weather_data: pd.DataFrame,
        location: Tuple[float, float],
        timestamp: datetime
    ) -> Dict[str, float]:
        """
        Extract weather forecast features.
        
        Args:
            weather_data: DataFrame with forecast data
            location: (lat, lon) tuple
            timestamp: Prediction timestamp
            
        Returns:
            Dictionary of weather features
        """
        features = {}
        lat, lon = location
        
        # Filter for location and valid time
        buffer = 0.1
        local_data = weather_data[
            (weather_data['latitude'].between(lat - buffer, lat + buffer)) &
            (weather_data['longitude'].between(lon - buffer, lon + buffer)) &
            (weather_data['valid_time'] >= timestamp)
        ].copy()
        
        if local_data.empty:
            return self._empty_weather_features()
        
        # Sort by valid_time
        local_data = local_data.sort_values('valid_time')
        
        # Precipitation features
        if 'precipitation' in local_data.columns:
            features['forecast_precip_1h_mm'] = float(local_data['precipitation'].iloc[0])
            features['forecast_precip_6h_sum_mm'] = float(local_data['precipitation'].head(6).sum())
            features['forecast_precip_24h_sum_mm'] = float(local_data['precipitation'].head(24).sum())
            features['forecast_precip_max_mm'] = float(local_data['precipitation'].max())
        
        if 'precipitation_probability' in local_data.columns:
            features['forecast_precip_prob_max'] = float(local_data['precipitation_probability'].max())
            features['forecast_precip_prob_mean'] = float(local_data['precipitation_probability'].mean())
        
        # Temperature
        if 'temperature_2m' in local_data.columns:
            features['temp_current_c'] = float(local_data['temperature_2m'].iloc[0])
            features['temp_min_24h_c'] = float(local_data['temperature_2m'].head(24).min())
            features['temp_max_24h_c'] = float(local_data['temperature_2m'].head(24).max())
        
        # Humidity
        if 'relative_humidity_2m' in local_data.columns:
            features['humidity_current_pct'] = float(local_data['relative_humidity_2m'].iloc[0])
            features['humidity_mean_24h_pct'] = float(local_data['relative_humidity_2m'].head(24).mean())
        
        # Pressure
        if 'pressure_msl' in local_data.columns:
            features['pressure_current_hpa'] = float(local_data['pressure_msl'].iloc[0])
            features['pressure_trend_24h'] = float(
                local_data['pressure_msl'].head(24).iloc[-1] - local_data['pressure_msl'].head(24).iloc[0]
            )
        
        # Wind
        if 'wind_speed_10m' in local_data.columns:
            features['wind_speed_current_ms'] = float(local_data['wind_speed_10m'].iloc[0])
            features['wind_speed_max_24h'] = float(local_data['wind_speed_10m'].head(24).max())
        
        if 'wind_direction_10m' in local_data.columns:
            features['wind_direction_deg'] = float(local_data['wind_direction_10m'].iloc[0])
        
        # CAPE and instability
        if 'cape' in local_data.columns:
            features['cape_current_jkg'] = float(local_data['cape'].iloc[0])
            features['cape_max_24h'] = float(local_data['cape'].head(24).max())
        
        if 'lifted_index' in local_data.columns:
            features['lifted_index_current'] = float(local_data['lifted_index'].iloc[0])
            features['lifted_index_min_24h'] = float(local_data['lifted_index'].head(24).min())
        
        # Soil moisture from forecast
        for depth in ['0_7cm', '7_28cm', '28_100cm', '100_255cm']:
            col = f'soil_moisture_{depth}'
            if col in local_data.columns:
                features[f'soil_moisture_{depth}_current'] = float(local_data[col].iloc[0])
                features[f'soil_moisture_{depth}_mean_24h'] = float(local_data[col].head(24).mean())
        
        self._register_features(features, 'weather')
        return features
    
    def _empty_weather_features(self) -> Dict[str, float]:
        return {
            'forecast_precip_1h_mm': 0.0,
            'forecast_precip_6h_sum_mm': 0.0,
            'forecast_precip_24h_sum_mm': 0.0,
            'forecast_precip_max_mm': 0.0,
            'forecast_precip_prob_max': 0.0,
            'forecast_precip_prob_mean': 0.0,
            'temp_current_c': 0.0,
            'temp_min_24h_c': 0.0,
            'temp_max_24h_c': 0.0,
            'humidity_current_pct': 0.0,
            'humidity_mean_24h_pct': 0.0,
            'pressure_current_hpa': 0.0,
            'pressure_trend_24h': 0.0,
            'wind_speed_current_ms': 0.0,
            'wind_speed_max_24h': 0.0,
            'wind_direction_deg': 0.0,
            'cape_current_jkg': 0.0,
            'cape_max_24h': 0.0,
            'lifted_index_current': 0.0,
            'lifted_index_min_24h': 0.0,
        }
    
    def extract_terrain_features(
        self,
        dem_data: np.ndarray,
        location: Tuple[float, float],
        transform,
        slope_data: Optional[np.ndarray] = None,
        aspect_data: Optional[np.ndarray] = None,
        flow_accumulation: Optional[np.ndarray] = None,
        curvature_data: Optional[np.ndarray] = None
    ) -> Dict[str, float]:
        """
        Extract terrain features from DEM and derived products.
        
        Args:
            dem_data: DEM array
            location: (lat, lon) in CRS of DEM
            transform: Affine transform for DEM
            slope_data: Precomputed slope array (degrees)
            aspect_data: Precomputed aspect array (degrees)
            flow_accumulation: Precomputed flow accumulation
            curvature_data: Precomputed curvature
            
        Returns:
            Dictionary of terrain features
        """
        features = {}
        lat, lon = location
        
        # Convert lat/lon to pixel coordinates
        row, col = self._latlon_to_pixel(lat, lon, transform)
        
        if 0 <= row < dem_data.shape[0] and 0 <= col < dem_data.shape[1]:
            # Elevation
            features['elevation_m'] = float(dem_data[row, col])
            
            # Slope
            if self.config.include_slope:
                if slope_data is not None and 0 <= row < slope_data.shape[0] and 0 <= col < slope_data.shape[1]:
                    features['slope_deg'] = float(slope_data[row, col])
                else:
                    # Compute from DEM (simplified)
                    features['slope_deg'] = self._compute_slope(dem_data, row, col, transform)
                
                features['slope_pct'] = np.tan(np.radians(features.get('slope_deg', 0))) * 100
            
            # Aspect
            if self.config.include_aspect and aspect_data is not None:
                if 0 <= row < aspect_data.shape[0] and 0 <= col < aspect_data.shape[1]:
                    features['aspect_deg'] = float(aspect_data[row, col])
                    # Convert to cardinal direction
                    features['aspect_northness'] = np.cos(np.radians(aspect_data[row, col]))
                    features['aspect_eastness'] = np.sin(np.radians(aspect_data[row, col]))
            
            # Curvature
            if self.config.include_curvature and curvature_data is not None:
                if 0 <= row < curvature_data.shape[0] and 0 <= col < curvature_data.shape[1]:
                    features['curvature'] = float(curvature_data[row, col])
            
            # Flow accumulation
            if self.config.include_flow_accumulation and flow_accumulation is not None:
                if 0 <= row < flow_accumulation.shape[0] and 0 <= col < flow_accumulation.shape[1]:
                    features['flow_accumulation'] = float(flow_accumulation[row, col])
                    # Log transform for skewed distribution
                    features['log_flow_accumulation'] = np.log1p(features['flow_accumulation'])
            
            # Topographic Wetness Index (TWI)
            if self.config.include_twi:
                slope = features.get('slope_deg', 0)
                flow_acc = features.get('flow_accumulation', 1)
                if slope > 0 and flow_acc > 0:
                    # TWI = ln(flow_acc / tan(slope))
                    features['twi'] = np.log(flow_acc / np.tan(np.radians(slope)))
                else:
                    features['twi'] = 0.0
            
            # Stream Power Index (SPI)
            if self.config.include_spi:
                slope_pct = features.get('slope_pct', 0)
                flow_acc = features.get('flow_accumulation', 1)
                features['spi'] = np.log(flow_acc * np.tan(np.radians(slope_pct / 100)))
        
        # Distance to nearest stream
        if self.config.include_distance_to_river:
            features['distance_to_stream_m'] = self._compute_distance_to_stream(lat, lon)
        
        # Watershed area
        if self.config.include_watershed_area:
            features['watershed_area_sqkm'] = self._get_watershed_area(lat, lon)
        
        # Drainage density
        if self.config.include_drainage_density:
            features['drainage_density_kmkm2'] = self._compute_drainage_density(lat, lon)
        
        self._register_features(features, 'terrain')
        return features
    
    def _latlon_to_pixel(self, lat: float, lon: float, transform) -> Tuple[int, int]:
        """Convert lat/lon to pixel coordinates."""
        from rasterio.transform import rowcol
        row, col = rowcol(transform, lon, lat)
        return row, col
    
    def _compute_slope(self, dem: np.ndarray, row: int, col: int, transform) -> float:
        """Compute slope from DEM using Horn's method (3x3 window)."""
        if row <= 0 or row >= dem.shape[0] - 1 or col <= 0 or col >= dem.shape[1] - 1:
            return 0.0
        
        # 3x3 window
        z = dem[row-1:row+2, col-1:col+2]
        
        # Horn's method
        xres = transform.a
        yres = -transform.e  # negative for north-up
        
        dzdx = ((z[0,2] + 2*z[1,2] + z[2,2]) - (z[0,0] + 2*z[1,0] + z[2,0])) / (8 * xres)
        dzdy = ((z[2,0] + 2*z[2,1] + z[2,2]) - (z[0,0] + 2*z[0,1] + z[0,2])) / (8 * yres)
        
        slope_rad = np.arctan(np.sqrt(dzdx**2 + dzdy**2))
        return np.degrees(slope_rad)
    
    def _compute_distance_to_stream(self, lat: float, lon: float) -> float:
        """Compute distance to nearest stream (placeholder - would use river network data)."""
        # Placeholder - would use actual river network data
        return 1000.0  # Default 1km
    
    def _get_watershed_area(self, lat: float, lon: float) -> float:
        """Get watershed area for location (placeholder)."""
        return 10.0  # Default 10 sq km
    
    def _compute_drainage_density(self, lat: float, lon: float) -> float:
        """Compute drainage density (placeholder)."""
        return 1.5  # km/km²
    
    def _register_features(self, features: Dict[str, float], category: str):
        """Register features with metadata."""
        for name, value in features.items():
            self.feature_names.append(name)
            self.feature_metadata[name] = {
                'category': category,
                'type': type(value).__name__,
                'description': self._get_feature_description(name)
            }
    
    def _get_feature_description(self, name: str) -> str:
        """Get human-readable description for feature."""
        descriptions = {
            'elevation_m': 'Elevation above sea level (meters)',
            'slope_deg': 'Terrain slope in degrees',
            'slope_pct': 'Terrain slope as percentage',
            'aspect_deg': 'Terrain aspect (degrees from north)',
            'aspect_northness': 'North-facing component of aspect',
            'aspect_eastness': 'East-facing component of aspect',
            'curvature': 'Terrain curvature',
            'flow_accumulation': 'Number of upstream cells draining to this cell',
            'log_flow_accumulation': 'Log-transformed flow accumulation',
            'twi': 'Topographic Wetness Index (ln(flow_accumulation/tan(slope)))',
            'spi': 'Stream Power Index',
            'distance_to_stream_m': 'Distance to nearest stream (meters)',
            'watershed_area_sqkm': 'Contributing watershed area (sq km)',
            'drainage_density_kmkm2': 'Drainage density (km/km²)',
            # Rainfall features
            'rainfall_1h_sum_mm': '1-hour rainfall accumulation (mm)',
            'rainfall_24h_sum_mm': '24-hour rainfall accumulation (mm)',
            'rainfall_72h_sum_mm': '72-hour rainfall accumulation (mm)',
            'rainfall_168h_sum_mm': '168-hour (7-day) rainfall accumulation (mm)',
            'antecedent_rainfall_7d_mm': '7-day antecedent rainfall (mm)',
            'antecedent_rainfall_30d_mm': '30-day antecedent rainfall (mm)',
            'rainfall_intensity_p95': '95th percentile of rainfall intensity',
            'rainfall_intensity_p99': '99th percentile of rainfall intensity',
            # Weather features
            'forecast_precip_1h_mm': '1-hour forecast precipitation (mm)',
            'forecast_precip_24h_sum_mm': '24-hour forecast precipitation sum (mm)',
            'forecast_precip_prob_max': 'Maximum precipitation probability in forecast',
            'temp_current_c': 'Current temperature (°C)',
            'humidity_current_pct': 'Current relative humidity (%)',
            'pressure_current_hpa': 'Current pressure (hPa)',
            'cape_current_jkg': 'Convective Available Potential Energy (J/kg)',
            'lifted_index_current': 'Lifted Index (stability indicator)',
        }
        return descriptions.get(name, f'Feature: {name}')


def create_feature_vector(
    engineer: FeatureEngineer,
    rainfall_data: pd.DataFrame,
    weather_data: pd.DataFrame,
    terrain_data: Dict,
    soil_data: Optional[Dict] = None,
    landcover_data: Optional[Dict] = None,
    historical_floods: Optional[pd.DataFrame] = None,
    location: Tuple[float, float] = (0, 0),
    timestamp: datetime = None
) -> Tuple[np.ndarray, List[str]]:
    """
    Create complete feature vector for a location and time.
    
    Returns:
        Tuple of (feature_vector, feature_names)
    """
    if timestamp is None:
        timestamp = datetime.utcnow()
    
    all_features = {}
    
    # Extract all feature groups
    if rainfall_data is not None and not rainfall_data.empty:
        rain_features = engineer.extract_rainfall_features(
            rainfall_data, location, timestamp
        )
        all_features.update(rain_features)
    
    if weather_data is not None and not weather_data.empty:
        weather_features = engineer.extract_weather_features(
            weather_data, location, timestamp
        )
        all_features.update(weather_features)
    
    # Terrain features
    if 'dem' in terrain_data:
        terrain_features = engineer.extract_terrain_features(
            terrain_data['dem'],
            location,
            terrain_data.get('transform'),
            terrain_data.get('slope'),
            terrain_data.get('aspect'),
            terrain_data.get('flow_accumulation'),
            terrain_data.get('curvature')
        )
        all_features.update(terrain_features)
    
    # Soil features (placeholder)
    if soil_data:
        soil_features = extract_soil_features(soil_data, location)
        all_features.update(soil_features)
    
    # Land cover features (placeholder)
    if landcover_data:
        landcover_features = extract_landcover_features(landcover_data, location)
        all_features.update(landcover_features)
    
    # Historical flood features
    if historical_floods is not None and not historical_floods.empty:
        flood_features = extract_historical_flood_features(
            historical_floods, location
        )
        all_features.update(flood_features)
    
    # Convert to array
    feature_names = list(all_features.keys())
    feature_vector = np.array([all_features[name] for name in feature_names], dtype=np.float32)
    
    # Handle NaN/inf values
    feature_vector = np.nan_to_num(feature_vector, nan=0.0, posinf=1e6, neginf=-1e6)
    
    return feature_vector, feature_names


def extract_soil_features(soil_data: Dict, location: Tuple[float, float]) -> Dict[str, float]:
    """Extract soil features (placeholder)."""
    features = {}
    # Would query soil data at location
    features['soil_clay_pct'] = 30.0
    features['soil_sand_pct'] = 40.0
    features['soil_silt_pct'] = 30.0
    features['soil_bulk_density_gcm3'] = 1.3
    features['soil_organic_carbon_pct'] = 2.0
    features['soil_ph'] = 6.5
    features['soil_cec_cmolkg'] = 20.0
    features['soil_ksat_mmhr'] = 10.0  # Saturated hydraulic conductivity
    features['soil_field_capacity'] = 0.3
    features['soil_wilting_point'] = 0.15
    features['soil_porosity'] = 0.45
    return features


def extract_landcover_features(landcover_data: Dict, location: Tuple[float, float]) -> Dict[str, float]:
    """Extract land cover features (placeholder)."""
    features = {}
    # Would query land cover at location
    features['landcover_class'] = 10  # Tree cover
    features['impervious_fraction'] = 0.05
    features['tree_cover_pct'] = 0.6
    features['grass_cover_pct'] = 0.3
    features['crop_cover_pct'] = 0.05
    features['urban_fraction'] = 0.02
    features['forest_fraction'] = 0.6
    features['water_fraction'] = 0.0
    return features


def extract_historical_flood_features(
    historical_floods: pd.DataFrame,
    location: Tuple[float, float],
    radius_km: float = 10.0
) -> Dict[str, float]:
    """
    Extract historical flood features for a location.
    """
    lat, lon = location
    features = {}
    
    # Filter historical floods within radius
    # Simplified distance calculation
    lat_diff = np.abs(historical_floods['latitude'] - lat) * 111  # km
    lon_diff = np.abs(historical_floods['longitude'] - lon) * 111 * np.cos(np.radians(lat))
    distance = np.sqrt(lat_diff**2 + lon_diff**2)
    
    nearby = historical_floods[distance <= radius_km]
    
    if not nearby.empty:
        features['historical_flood_count'] = len(nearby)
        features['years_since_last_flood'] = (
            datetime.utcnow().year - nearby['start_date'].dt.year.max()
        )
        features['max_historical_flood_depth_m'] = nearby.get('max_depth_m', pd.Series([0])).max()
        features['historical_flood_frequency_per_year'] = len(nearby) / max(1, (
            datetime.utcnow().year - nearby['start_date'].dt.year.min()
        ))
        features['max_historical_fatalities'] = nearby['fatalities'].max()
        features['max_historical_affected_pop'] = nearby['affected_population'].max()
    else:
        features['historical_flood_count'] = 0
        features['years_since_last_flood'] = 999
        features['max_historical_flood_depth_m'] = 0.0
        features['historical_flood_frequency_per_year'] = 0.0
        features['max_historical_fatalities'] = 0
        features['max_historical_affected_pop'] = 0
    
    return features