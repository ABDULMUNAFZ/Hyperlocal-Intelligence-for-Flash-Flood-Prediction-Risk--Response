// Client for the Wayanad situational-awareness geo API and the prediction API.
import { api, API_BASE_URL } from './api';
import type {
  AlertsResponse, CamerasResponse, ClimateNormals, DistrictLayer, HistoricalEvent, Manifest, ModelSanity,
  PointWeather, Prediction, RouteResult, ScenarioResult, TerrainPoint, ZoneImpact, ZoneOsm, ZoneRisk, ZoneTerrain,
  FeatureCollection, LngLat,
} from '../types/geo';

type Geometry = { type: string; coordinates: any };
type Scenario = { rainfall_mm: number; duration_hours: number } | null | undefined;

const LONG = { timeout: 180_000 };

export const geoApi = {
  manifest: async () => (await api.get<Manifest>('/geo/manifest', LONG)).data,
  sanity: async () => (await api.get<ModelSanity>('/geo/model/sanity', LONG)).data,
  weather: async (lat: number, lon: number) => (await api.get<PointWeather>('/geo/weather', { params: { lat, lon } })).data,
  climate: async (lat: number, lon: number) => (await api.get<ClimateNormals>('/geo/climate', { params: { lat, lon }, ...LONG })).data,
  terrain: async (lat: number, lon: number) => (await api.get<TerrainPoint>('/geo/terrain', { params: { lat, lon }, ...LONG })).data,
  building: async (lat: number, lon: number) => (await api.get<any>('/geo/building', { params: { lat, lon } })).data,
  rainfallGrid: async () =>
    (await api.get<{ available: boolean; grid_step_deg: number; geojson: FeatureCollection; provenance: any }>('/geo/rainfall-grid', LONG)).data,
  alerts: async () => (await api.get<AlertsResponse>('/geo/alerts', LONG)).data,
  cameras: async () => (await api.get<CamerasResponse>('/geo/cameras')).data,
  historicalEvents: async () =>
    (await api.get<{ events: HistoricalEvent[]; note: string; curated_at: string }>('/geo/historical-events')).data,
  districtLayer: async (name: string) => {
    const d = (await api.get<DistrictLayer>(`/geo/layers/${name}`, LONG)).data;
    return { ...d, image_url: `${API_BASE_URL}/geo/layers/${name}.png` };
  },
  zoneTerrain: async (geometry: Geometry) => (await api.post<ZoneTerrain>('/geo/zone/terrain', { geometry }, LONG)).data,
  zoneOsm: async (geometry: Geometry) => (await api.post<ZoneOsm>('/geo/zone/osm', { geometry }, LONG)).data,
  zoneRisk: async (geometry: Geometry, scenario?: Scenario) =>
    (await api.post<ZoneRisk>('/geo/zone/risk', { geometry, scenario: scenario ?? undefined }, LONG)).data,
  zoneImpact: async (geometry: Geometry, scenario?: Scenario) =>
    (await api.post<ZoneImpact>('/geo/zone/impact', { geometry, scenario: scenario ?? undefined }, LONG)).data,
  zoneWorldPop: async (geometry: Geometry) =>
    (await api.post<{ available: boolean; population?: number; reference_year?: number; provenance: any }>('/geo/zone/worldpop', { geometry }, LONG)).data,
  evacuationRoutes: async (origin: LngLat, candidates: Array<{ id: string; name?: string; category?: string; lon: number; lat: number }>, risk_geojson?: any) =>
    (await api.post<{ routes: RouteResult[]; caveats: string[]; provenance: any }>('/geo/evacuation/routes', { origin, candidates, risk_geojson }, LONG)).data,
  simulationCapabilities: async () => (await api.get<any>('/geo/simulation/capabilities')).data,
  scenario: async (latitude: number, longitude: number, rainfall_mm: number, duration_hours: number) =>
    (await api.post<ScenarioResult>('/geo/predict/scenario', { latitude, longitude, rainfall_mm, duration_hours }, LONG)).data,
  assistant: async (question: string, context: Record<string, any>) =>
    (await api.post<{ answer: string; grounded_on: string[]; engine: string; disclaimer: string; scenario: ScenarioResult | null }>(
      '/geo/assistant', { question, context }, LONG)).data,
  predict: async (latitude: number, longitude: number) =>
    (await api.post<Prediction>('/prediction/predict', { latitude, longitude, prediction_horizon_hours: 24 }, LONG)).data,
  health: async () => (await api.get<{ status: string }>('/health')).data,
};
