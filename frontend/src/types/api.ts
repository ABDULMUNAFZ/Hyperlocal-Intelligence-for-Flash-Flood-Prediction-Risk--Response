// FloodGuard Frontend Type Definitions

// Risk Prediction Types
export interface PredictionRequest {
  latitude: number;
  longitude: number;
  prediction_horizon_hours?: number;
  model_name?: string;
  use_ensemble?: boolean;
  return_uncertainty?: boolean;
  return_explanations?: boolean;
  top_k_features?: number;
}

export interface BatchPredictionRequest {
  locations: Array<{ latitude: number; longitude: number }>;
  prediction_horizon_hours?: number;
  model_name?: string;
  use_ensemble?: boolean;
  return_uncertainty?: boolean;
  return_explanations?: boolean;
  top_k_features?: number;
}

export interface PredictionResponse {
  request_id: string;
  location: { latitude: number; longitude: number };
  timestamp: string;
  prediction_horizon_hours: number;
  risk_probability: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW';
  risk_score: number;
  model_version: string;
  data_quality: string;
  uncertainty?: number;
  contributing_factors: Array<{
    feature: string;
    importance: number;
    value?: number;
    impact?: 'increases' | 'decreases';
  }>;
  data_sources: string[];
  prediction_timestamp: string;
}

export interface BatchPredictionRequest {
  locations: Array<{ latitude: number; longitude: number }>;
  prediction_horizon_hours?: number;
  model_name?: string;
  use_ensemble?: boolean;
  return_uncertainty?: boolean;
  return_explanations?: boolean;
  top_k_features?: number;
}

export interface BatchPredictionResponse {
  batch_id: string;
  timestamp: string;
  predictions: PredictionResponse[];
  summary: {
    total_locations: number;
    risk_distribution: Record<string, number>;
    avg_risk_probability: number;
    max_risk_probability: number;
  };
}

export interface ModelInfoResponse {
  model_id: string;
  name: string;
  version: string;
  stage: string;
  model_type: string;
  training_date: string;
  training_samples: number;
  positive_samples: number;
  negative_samples: number;
  feature_count: number;
  metrics: Record<string, number>;
  hyperparameters: Record<string, any>;
  feature_importance: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResponse {
  status: string;
  models_loaded: string[];
  models_fitted: Record<string, boolean>;
  cache_size: number;
  metrics: Record<string, any>;
  uptime_seconds: number;
}

// Weather Types
export interface WeatherForecast {
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    surface_pressure: number[];
    cape?: number[];
    soil_temperature_0_to_7cm?: number[];
    soil_moisture_0_to_7cm?: number[];
  };
  hourly_units: Record<string, string>;
}

export interface WeatherObservation {
  latitude: number;
  longitude: number;
  timestamp: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  surface_pressure: number;
  precipitation: number;
}

// Rainfall
export interface RainfallObservation {
  latitude: number;
  longitude: number;
  timestamp: string;
  rainfall_mm: number;
  intensity_mmhr?: number;
  duration_minutes?: number;
  quality_flag?: string;
}

export interface RainfallGrid {
  source: string;
  product: string;
  timestamp: string;
  resolution_deg: number;
  min_mm: number;
  max_mm: number;
  mean_mm: number;
  coverage_bbox: GeoJSON.Polygon;
}

// Terrain
export interface ElevationData {
  elevation_m: number;
  slope_deg?: number;
  aspect_deg?: number;
  curvature?: number;
  twi?: number;
  spi?: number;
  flow_accumulation?: number;
  distance_to_stream_m?: number;
  watershed_area_sqkm?: number;
  drainage_density_kmkm2?: number;
}

// Soil
export interface SoilProfile {
  clay_percent: number;
  sand_percent: number;
  silt_percent: number;
  organic_carbon_percent: number;
  bulk_density_gcm3: number;
  ph: number;
  cec_cmolkg: number;
  ksat_mmhr: number;
  field_capacity: number;
  wilting_point: number;
  porosity: number;
  awc_mm: number;
  k_factor: number;
  hydrologic_group: string;
}

// Land Cover
export interface LandCoverData {
  class: number;
  class_name: string;
  impervious_fraction: number;
  tree_cover_pct: number;
  grass_cover_pct: number;
  crop_cover_pct: number;
  urban_fraction: number;
  forest_fraction: number;
  water_fraction: number;
  wetland_fraction: number;
  vegetation_fraction: number;
  ndvi?: number;
  ndwi?: number;
}

// Population
export interface PopulationData {
  density_per_km2: number;
  total: number;
  vulnerable_population_pct?: number;
  building_density_per_km2?: number;
  critical_infrastructure_count?: number;
}

// Historical Flood
export interface HistoricalFloodEvent {
  id: string;
  event_id: string;
  name: string;
  source: string;
  flood_type: string;
  cause: string;
  start_date: string;
  end_date?: string;
  duration_days: number;
  latitude: number;
  longitude: number;
  affected_area_sqkm: number;
  fatalities: number;
  injured: number;
  displaced: number;
  affected_population: number;
  max_rainfall_mm: number;
  max_rainfall_duration_hours: number;
  antecedent_rainfall_mm: number;
  is_verified: boolean;
  verification_source?: string;
}

export interface HistoricalFloodExtent {
  event_id: string;
  observation_date: string;
  satellite: string;
  sensor: string;
  geometry: GeoJSON.MultiPolygon;
  area_sqkm: number;
  confidence: string;
  processing_level: string;
}

// Risk
export interface FloodRisk {
  id: string;
  region_id: string;
  latitude: number;
  longitude: number;
  location: GeoJSON.Point;
  risk_probability: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW';
  risk_score: number;
  forecast_hours: number;
  model_version: string;
  computed_at: string;
  uncertainty?: number;
  contributing_factors: Array<{
    feature: string;
    importance: number;
    value: number;
    impact: 'increases' | 'decreases';
  }>;
  data_sources: string[];
  data_quality: string;
}

export interface FloodRiskSummary {
  region_id: string;
  max_risk: number;
  mean_risk: number;
  high_risk_percentage: number;
  total_population_at_risk: number;
  forecast_hours: number;
}

// Simulation
export interface FloodSimulation {
  id: string;
  name: string;
  description: string;
  created_by?: string;
  status?: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  scenario_type: 'historical' | 'forecast' | 'what_if';
  rainfall_scenario: any;
  antecedent_conditions: any;
  simulation_area: GeoJSON.Polygon;
  grid_resolution_m: number;
  model_type: string;
  solver: string;
  timestep_seconds: number;
  simulation_duration_hours: number;
  infiltration_model: string;
  routing_method: string;
  started_at?: string;
  completed_at?: string;
  compute_time_seconds: number;
  max_depth_raster?: string;
  max_velocity_raster?: string;
  arrival_time_raster?: string;
  flood_extent_raster?: string;
  max_depth_m: number;
  max_velocity_ms: number;
  flooded_area_sqkm: number;
  flooded_volume_m3: number;
  affected_population: number;
  affected_buildings: number;
  affected_roads_km: number;
  output_directory: string;
}

export interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  region_id: string;
  parameters: Record<string, any>;
  is_template: boolean;
  is_public: boolean;
  created_by: string;
}

// Evacuation
export interface EvacuationZone {
  id: string;
  name: string;
  region_id: string;
  zone_type: string;
  risk_threshold: number;
  depth_threshold_m: number;
  geometry: GeoJSON.MultiPolygon;
  area_sqkm: number;
  population: number;
  vulnerable_population: number;
  building_count: number;
  priority: number;
  estimated_evacuation_time_minutes: number;
  description: string;
}

export interface EvacuationRoute {
  id: string;
  zone_id: string;
  shelter_id: string;
  name: string;
  geometry: GeoJSON.LineString;
  length_km: number;
  estimated_time_minutes: number;
  capacity_vehicles_per_hour: number;
  road_types: string[];
  max_flood_depth_m: number;
  is_viable: boolean;
  viability_notes: string;
  waypoints: any[];
}

export interface Shelter {
  id: string;
  name: string;
  region_id: string;
  shelter_type: string;
  geometry: GeoJSON.Point;
  address: string;
  capacity: number;
  current_occupancy: number;
  has_toilets: boolean;
  has_water: boolean;
  has_electricity: boolean;
  has_backup_power: boolean;
  has_medical: boolean;
  has_kitchen: boolean;
  is_accessible: boolean;
  pet_friendly: boolean;
  elevation_m: number;
  flood_risk_level: string;
  min_flood_depth_m: number;
  contact_person: string;
  contact_phone: string;
  manager_organization: string;
  is_active: boolean;
}

export interface EvacuationPlan {
  id: string;
  region_id: string;
  name: string;
  version: number;
  trigger_conditions: any;
  zones: any[];
  routes: any[];
  shelters: any[];
  estimated_total_time_hours: number;
  total_population: number;
  total_vehicles: number;
  special_needs_plan: any;
  communication_plan: any;
  is_active: boolean;
  approved_by: string;
  approved_at: string;
}


// Alerts
export interface Alert {
  id: string;
  alert_id: string;
  title: string;
  description: string;
  instruction: string;
  alert_type: 'FLOOD_RISK' | 'FLASH_FLOOD' | 'RIVER_FLOOD' | 'DAM_BREAK' | 'EVACUATION' | 'ROAD_CLOSURE' | 'SHELTER_OPEN' | 'WEATHER' | 'TEST';
  severity: 'INFO' | 'WATCH' | 'WARNING' | 'SEVERE' | 'EXTREME';
  status: 'DRAFT' | 'ACTIVE' | 'UPDATED' | 'CANCELLED' | 'EXPIRED';
  urgency: string;
  certainty: string;
  affected_regions: string[];
  geometry?: GeoJSON.MultiPolygon;
  onset: string;
  expires: string;
  sent_at?: string;
  source: string;
  author: string;
  author_id: string;
  cap_identifier: string;
  cap_sender: string;
  cap_sent: string;
  cap_status: string;
  cap_msgType: string;
  cap_scope: string;
  channels: string[];
  languages: string[];
  recipients_count: number;
  acknowledged_count: number;
}

export interface AlertSubscription {
  id: string;
  user_id: string;
  alert_id: string;
  region_id: string;
  min_severity: string;
  channels: string[];
  is_active: boolean;
  created_at: string;
  acknowledged_at?: string;
}

// AI Assistant
export interface AIConversation {
  id: string;
  user_id: string;
  session_id: string;
  language: string;
  context: Record<string, any>;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  content_type: string;
  citations: any[];
  tokens_used?: number;
  model: string;
  latency_ms: number;
}

// Data Quality
export interface DataQualityReport {
  source: string;
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  last_updated: string;
  issues: Array<{ field: string; issue: string; severity: string }>;
}

export interface HealthSummary {
  total_sources: number;
  active_sources: number;
  failed_sources: number;
  avg_completeness: number;
  avg_accuracy: number;
  avg_timeliness: number;
  last_updated: string;
}

// Map/GeoJSON types
// eslint-disable-next-line @typescript-eslint/no-namespace -- ambient GeoJSON declarations
declare namespace GeoJSON {
  interface Point {
    type: 'Point';
    coordinates: [number, number];
  }
  interface LineString {
    type: 'LineString';
    coordinates: number[][];
  }
  interface Polygon {
    type: 'Polygon';
    coordinates: number[][][];
  }
  interface MultiPolygon {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  }
  interface MultiLineString {
    type: 'MultiLineString';
    coordinates: number[][][][];
  }
  interface GeometryCollection {
    type: 'GeometryCollection';
    geometries: any[];
  }
  interface Feature<G = any> {
    type: 'Feature';
    geometry: G;
    properties: any;
  }
  interface FeatureCollection<G = any> {
    type: 'FeatureCollection';
    features: Feature<G>[];
  }
  interface MultiPolygon {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  }
}
