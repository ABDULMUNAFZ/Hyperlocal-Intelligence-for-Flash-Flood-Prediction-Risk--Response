// Types for the Wayanad situational-awareness geo API (/api/v1/geo/*)

export type DataKind =
  | 'OBSERVED'
  | 'MODEL_ANALYSIS'
  | 'FORECAST'
  | 'HISTORICAL'
  | 'STATIC_DATASET'
  | 'DERIVED'
  | 'MODEL_PREDICTION';

export type DataStatus = 'LIVE' | 'RECENT' | 'HISTORICAL' | 'STALE' | 'UNAVAILABLE';

export interface Provenance {
  source: string;
  kind: DataKind;
  status: DataStatus;
  retrieved_at: string;
  reference?: string | null;
  url?: string | null;
  notes?: string | null;
}

export type LngLat = [number, number];

export interface FeatureCollection<P = Record<string, any>> {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; id?: number | string; properties: P; geometry: any }>;
}

export interface PointWeather {
  available: boolean;
  location?: { latitude: number; longitude: number; grid_elevation_m: number };
  current?: {
    time_local: string;
    temperature_c: number | null;
    apparent_temperature_c: number | null;
    relative_humidity_pct: number | null;
    precipitation_mm: number | null;
    weather_code: number | null;
    condition: string | null;
    cloud_cover_pct: number | null;
    pressure_msl_hpa: number | null;
    surface_pressure_hpa: number | null;
    wind_speed_kmh: number | null;
    wind_direction_deg: number | null;
    wind_gusts_kmh: number | null;
  };
  rainfall_recent?: {
    rain_1h_mm: number | null;
    rain_3h_mm: number | null;
    rain_6h_mm: number | null;
    rain_24h_mm: number | null;
    rain_72h_mm: number | null;
    imd_category_24h: string | null;
  };
  rainfall_forecast?: {
    next_24h_mm: number | null;
    max_hourly_mm: number | null;
    max_probability_pct: number | null;
    imd_category_24h: string | null;
  };
  series?: {
    past_72h: Array<{ time: string; precipitation_mm: number | null }>;
    next_48h: Array<{ time: string; precipitation_mm: number | null; precipitation_probability: number | null; temperature_c: number | null }>;
  };
  provenance: Provenance;
}

export interface ClimateNormals {
  available: boolean;
  period?: string;
  grid_point?: { latitude: number; longitude: number; elevation_m: number };
  monthly?: Array<{ month: string; precipitation_mm: number; temperature_mean_c: number; temperature_max_c: number; temperature_min_c: number }>;
  summary?: {
    annual_precipitation_mm: number;
    southwest_monsoon_share_pct: number | null;
    northeast_monsoon_share_pct: number | null;
    wettest_month: string;
    mean_temperature_c: number;
    annual_precipitation_min_mm: number;
    annual_precipitation_max_mm: number;
    max_daily_precipitation_mm: number;
    max_daily_precipitation_date: string;
  };
  provenance: Provenance;
}

export interface TerrainPoint {
  available: boolean;
  elevation_m?: number;
  slope_deg?: number;
  aspect_deg?: number;
  aspect?: string;
  terrain_class?: string;
  resolution_m?: number;
  twi?: number | null;
  landcover?: { code: number; label: string } | null;
  population_density_per_km2?: number | null;
  error?: string;
  provenance: Provenance;
}

export interface FeatureRow {
  name: string;
  label: string;
  unit: string;
  value: number | null;
  model_input: number;
  status: string;
  source: string | null;
}

export interface ModelProvenance {
  available: boolean;
  model_id?: string;
  name?: string;
  version?: string;
  stage?: string;
  training_samples?: number;
  training_data?: string;
  validated?: boolean;
  warning?: string;
  metrics?: Record<string, number>;
  metrics_note?: string;
  sanity?: ModelSanity;
}

export interface ModelSanity {
  checked_at: string;
  reference_location: string;
  rainfall_response: Array<{ rainfall_24h_mm: number; probability: number }>;
  rainfall_monotonic: boolean;
  passed: boolean;
  message: string;
}

export interface Prediction {
  request_id: string;
  location: { latitude: number; longitude: number };
  timestamp: string;
  prediction_horizon_hours: number;
  risk_probability: number;
  risk_level: string;
  risk_score: number;
  model_version: string;
  data_quality: string;
  uncertainty: number | null;
  contributing_factors: Array<{ feature: string; label?: string; importance?: number; value?: number | null; unit?: string; status?: string }>;
  data_sources: string[];
  prediction_timestamp: string;
  features: FeatureRow[];
  imputed_features: string[];
  explanation_method: string | null;
  model_provenance: ModelProvenance;
}

export interface ZoneTerrain {
  available: boolean;
  reason?: string;
  computed_at?: string;
  zone_area_km2?: number;
  stats?: {
    elevation_min_m: number;
    elevation_max_m: number;
    elevation_mean_m: number;
    relief_m: number;
    slope_mean_deg: number;
    slope_p90_deg: number;
    area_steeper_than_30deg_pct: number;
    dem_resolution_m: number;
    channel_threshold_km2: number;
    max_contributing_area_km2: number;
  };
  drainage?: FeatureCollection<{ max_contributing_area_km2: number; min_contributing_area_km2: number; length_cells: number; head_elevation_m: number }>;
  overlays?: { bounds: number[]; coordinates: number[][]; slope: string; flow_accumulation: string; twi: string };
  population?: { hrsl_total: number | null; error?: string | null; provenance: Provenance };
  landcover?: { classes?: Array<{ code: number; label: string; fraction: number }>; pixels?: number; error?: string; provenance: Provenance };
  provenance?: Provenance;
}

export interface ZoneRisk {
  available: boolean;
  reason?: string;
  computed_at?: string;
  geojson?: FeatureCollection<{ probability: number; risk_level: string; risk_score: number; elevation_m: number; slope_deg: number; twi: number; landcover: string | null; population_hrsl: number; center: LngLat }>;
  distribution?: Record<string, number>;
  max_probability?: number;
  imputed_features?: string[];
  shared_inputs?: any;
  mode?: 'CURRENT' | 'SCENARIO';
  scenario?: { rainfall_mm: number; duration_hours: number } | null;
  model?: ModelProvenance;
  provenance?: Provenance;
}

export interface ZoneOsm {
  available: boolean;
  reason?: string;
  zone_area_km2?: number;
  buildings?: FeatureCollection;
  roads?: FeatureCollection;
  bridges?: FeatureCollection;
  waterways?: FeatureCollection;
  facilities?: FeatureCollection;
  summary?: {
    building_count: number;
    building_types: Record<string, number>;
    building_height_status: Record<string, number>;
    road_length_km: Record<string, number>;
    road_length_total_km: number;
    bridge_count: number;
    facility_counts: Record<string, number>;
    waterway_count: number;
  };
  provenance?: Provenance;
}

export interface ZoneImpact {
  computed_at: string;
  mode?: string;
  scenario?: { rainfall_mm: number; duration_hours: number } | null;
  zone: { population_hrsl?: number | null; buildings?: number; road_length_km?: number; bridges?: number; facilities?: Record<string, number> };
  high_risk: null | {
    cells: number;
    note?: string;
    area_km2?: number;
    population_hrsl?: number;
    buildings?: number;
    building_types?: Record<string, number>;
    road_length_km?: number;
    bridges?: number;
    bridge_names?: string[];
    facilities?: Array<Record<string, any>>;
  };
  high_risk_reason?: string;
  method?: string;
}

export interface CapAlert {
  identifier: string;
  sender: string;
  sent: string;
  event: string;
  urgency: string;
  severity: string;
  certainty: string;
  effective: string;
  onset: string;
  expires: string;
  headline: string;
  description: string | null;
  instruction: string | null;
  areas: string[];
  link: string;
  active: boolean;
  match_reason: string;
  language?: string;
  category?: string;
}

export interface AlertsResponse {
  available: boolean;
  scanned_messages?: number;
  alerts: CapAlert[];
  provenance: Provenance;
}

export interface Camera {
  id: string;
  name: string;
  location: LngLat;
  type: 'hls' | 'mjpeg' | 'image' | 'youtube_live';
  url: string;
  source: string;
  source_url?: string;
  verified_live_at?: string;
  refresh_seconds?: number;
}

export interface CamerasResponse {
  reviewed_at: string;
  review_summary: string;
  how_to_add: string;
  cameras: Camera[];
  provenance: Provenance;
}

export interface HistoricalEvent {
  id: string;
  title: string;
  event_type: string;
  date: string;
  time_local: string | null;
  location: string;
  rivers: string[];
  rainfall_reported: string;
  impact: string;
  coordinates: LngLat;
  position_basis: string;
  related_places: Array<{ name: string; coordinates: LngLat }>;
  sources: Array<{ label: string; url: string }>;
}

export interface DistrictLayer {
  name: string;
  available?: boolean;
  coordinates: number[][];
  image_url: string;
  provenance: Provenance;
}

export interface RouteResult {
  candidate: { id: string; name?: string; category?: string; lon: number; lat: number };
  available: boolean;
  reason?: string;
  distance_km?: number;
  duration_min?: number;
  straight_line_km?: number;
  destination_elevation_m?: number | null;
  crosses_model_high_risk?: boolean | null;
  assessment?: string;
  geometry?: { type: 'LineString'; coordinates: LngLat[] };
}

export interface ScenarioResult {
  scenario: { latitude: number; longitude: number; rainfall_mm: number; duration_hours: number };
  baseline_probability: number;
  scenario_probability: number;
  baseline_level: string;
  scenario_level: string;
  scenario_inputs: Record<string, number>;
  imputed_features: string[];
  model: ModelProvenance;
  note: string;
}

export interface Manifest {
  region: { name: string; state: string; bbox: number[]; osm_relation: number; lgd_district_code: string };
  datasets: Array<{ layer: string; source: string; kind: string }>;
  unavailable: Array<{ layer: string; reason: string }>;
  model: ModelProvenance;
}

export interface OperationalZone {
  id: string;
  name: string;
  kind: 'taluk' | 'radius' | 'polygon' | 'preset';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
  center: LngLat;
  radius_km?: number;
}

export type Selection =
  | { kind: 'location'; lngLat: LngLat }
  | { kind: 'building'; lngLat: LngLat; props: Record<string, any>; source: 'tiles' | 'zone' }
  | { kind: 'river'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'road'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'poi'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'place'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'risk_cell'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'event'; lngLat: LngLat; event: HistoricalEvent }
  | { kind: 'camera'; camera: Camera }
  | { kind: 'sign'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'report'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'live_alert'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'rescue'; lngLat: LngLat; props: Record<string, any> }
  | { kind: 'safe_location'; lngLat: LngLat; props: Record<string, any> };
