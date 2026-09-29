import type { LngLat, OperationalZone } from '../../types/geo';
import { circlePolygon } from './geo';

export interface CameraView {
  id: string;
  label: string;
  level: 'REGIONAL' | 'STATE' | 'DISTRICT' | 'TOWN' | 'HILL' | 'VILLAGE';
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

// Camera journey: South India → Kerala → Wayanad → towns → hill areas.
// Town/village centres are OpenStreetMap place nodes (see public/data/wayanad/places.geojson).
export const JOURNEY: CameraView[] = [
  { id: 'south-india', label: 'South India', level: 'REGIONAL', center: [77.6, 11.4], zoom: 5.4, pitch: 0, bearing: 0 },
  { id: 'kerala', label: 'Kerala', level: 'STATE', center: [76.35, 10.55], zoom: 6.9, pitch: 30, bearing: 0 },
  { id: 'wayanad', label: 'Wayanad', level: 'DISTRICT', center: [76.11, 11.66], zoom: 9.55, pitch: 60, bearing: -18 },
  { id: 'kalpetta', label: 'Kalpetta', level: 'TOWN', center: [76.08281, 11.610278], zoom: 13.4, pitch: 64, bearing: -25 },
  { id: 'meppadi', label: 'Meppadi', level: 'TOWN', center: [76.1320079, 11.5529455], zoom: 13.6, pitch: 66, bearing: 20 },
  { id: 'vythiri', label: 'Vythiri', level: 'TOWN', center: [76.038922, 11.5560885], zoom: 13.6, pitch: 66, bearing: -10 },
  { id: 'mananthavady', label: 'Mananthavady', level: 'TOWN', center: [76.0056565, 11.8010338], zoom: 13.4, pitch: 62, bearing: 0 },
  { id: 'sulthan-bathery', label: 'Sulthan Bathery', level: 'TOWN', center: [76.259553, 11.6631885], zoom: 13.4, pitch: 62, bearing: 15 },
  { id: 'lakkidi', label: 'Lakkidi', level: 'HILL', center: [76.0203502, 11.5205672], zoom: 13.8, pitch: 72, bearing: -40 },
  { id: 'chembra', label: 'Chembra Peak', level: 'HILL', center: [76.0896399, 11.5122716], zoom: 13.2, pitch: 74, bearing: 160 },
  { id: 'mundakkai', label: 'Mundakkai valley', level: 'VILLAGE', center: [76.1557245, 11.486475], zoom: 13.9, pitch: 74, bearing: 25 },
];

export const MERCATOR_START: CameraView = JOURNEY[0];

const MEPPADI: LngLat = [76.1320079, 11.5529455];
const KALPETTA: LngLat = [76.08281, 11.610278];
const VYTHIRI: LngLat = [76.038922, 11.5560885];
const LAKKIDI: LngLat = [76.0203502, 11.5205672];

export const ZONE_PRESETS: OperationalZone[] = [
  {
    id: 'mundakkai-chooralmala',
    name: 'Mundakkai – Chooralmala valley',
    kind: 'preset',
    center: [76.155, 11.4925],
    geometry: { type: 'Polygon', coordinates: [[[76.135, 11.475], [76.175, 11.475], [76.175, 11.51], [76.135, 11.51], [76.135, 11.475]]] },
  },
  { id: 'meppadi-2km', name: 'Meppadi town (2 km)', kind: 'radius', center: MEPPADI, radius_km: 2, geometry: circlePolygon(MEPPADI, 2) },
  { id: 'kalpetta-1_5km', name: 'Kalpetta town (1.5 km)', kind: 'radius', center: KALPETTA, radius_km: 1.5, geometry: circlePolygon(KALPETTA, 1.5) },
  { id: 'vythiri-1_5km', name: 'Vythiri (1.5 km)', kind: 'radius', center: VYTHIRI, radius_km: 1.5, geometry: circlePolygon(VYTHIRI, 1.5) },
  { id: 'lakkidi-1_5km', name: 'Lakkidi ghat top (1.5 km)', kind: 'radius', center: LAKKIDI, radius_km: 1.5, geometry: circlePolygon(LAKKIDI, 1.5) },
];

export type CameraMode = 'REGIONAL' | 'DISTRICT' | 'TOWN' | 'VILLAGE' | 'MICRO-ZONE' | 'BUILDING' | 'SIMULATION';

export const CAMERA_MODE_PRESETS: Record<CameraMode, { zoom: number; pitch: number }> = {
  REGIONAL: { zoom: 6.5, pitch: 20 },
  DISTRICT: { zoom: 9.6, pitch: 60 },
  TOWN: { zoom: 12.6, pitch: 62 },
  VILLAGE: { zoom: 14, pitch: 68 },
  'MICRO-ZONE': { zoom: 14.6, pitch: 70 },
  BUILDING: { zoom: 17.2, pitch: 70 },
  SIMULATION: { zoom: 14.2, pitch: 74 },
};

export function modeForZoom(z: number): CameraMode {
  if (z < 7.8) return 'REGIONAL';
  if (z < 11) return 'DISTRICT';
  if (z < 13) return 'TOWN';
  if (z < 14.5) return 'VILLAGE';
  if (z < 16.5) return 'MICRO-ZONE';
  return 'BUILDING';
}

export type LayerKey =
  | 'terrain3d' | 'hillshade' | 'imagery' | 'elevation' | 'slope' | 'flowAcc' | 'twi'
  | 'rainLive' | 'rainPast' | 'rainForecast' | 'temperature' | 'humidity' | 'climate'
  | 'rivers' | 'streams' | 'waterBodies' | 'drainage' | 'catchments' | 'dams'
  | 'modelRisk' | 'historical' | 'simulation' | 'floodDepth' | 'landslide'
  | 'population' | 'buildings' | 'settlements'
  | 'roads' | 'bridges' | 'hospitals' | 'schools' | 'police' | 'fire' | 'government' | 'community' | 'power'
  | 'tourism' | 'peaks' | 'cameras' | 'landcover' | 'alerts' | 'taluks';

export type LayerState = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: LayerState = {
  terrain3d: true, hillshade: true, imagery: false, elevation: false, slope: false, flowAcc: false, twi: false,
  rainLive: true, rainPast: false, rainForecast: false, temperature: false, humidity: false, climate: false,
  rivers: true, streams: true, waterBodies: true, drainage: true, catchments: false, dams: true,
  modelRisk: true, historical: true, simulation: false, floodDepth: false, landslide: false,
  population: false, buildings: true, settlements: true,
  roads: true, bridges: true, hospitals: true, schools: true, police: true, fire: true, government: false, community: false, power: false,
  tourism: true, peaks: true, cameras: true, landcover: false, alerts: true, taluks: true,
};

export type LayerStatus = 'LIVE' | 'RECENT' | 'HISTORICAL' | 'DERIVED' | 'MODEL' | 'ZONE' | 'UNAVAILABLE' | 'POINT';

export interface LayerDef {
  key: LayerKey;
  label: string;
  status: LayerStatus;
  source: string;
  note?: string;
}

export const LAYER_GROUPS: Array<{ id: string; label: string; layers: LayerDef[] }> = [
  {
    id: 'terrain', label: 'Terrain', layers: [
      { key: 'terrain3d', label: '3D terrain', status: 'HISTORICAL', source: 'Terrain Tiles on AWS (SRTM/GMTED/NED)', note: 'Vertical exaggeration is visual only.' },
      { key: 'hillshade', label: 'Hillshade', status: 'HISTORICAL', source: 'Terrain Tiles on AWS' },
      { key: 'elevation', label: 'Elevation', status: 'HISTORICAL', source: 'Copernicus DEM GLO-30 (~100 m render)' },
      { key: 'slope', label: 'Slope', status: 'HISTORICAL', source: 'Copernicus DEM GLO-30 (Horn)' },
      { key: 'flowAcc', label: 'Flow accumulation', status: 'ZONE', source: 'D8 on Copernicus GLO-30', note: 'Computed for the selected micro-zone.' },
      { key: 'twi', label: 'Wetness index (TWI)', status: 'ZONE', source: 'ln(a/tanβ) on Copernicus GLO-30' },
      { key: 'imagery', label: 'Satellite imagery', status: 'HISTORICAL', source: 'Esri World Imagery' },
    ],
  },
  {
    id: 'weather', label: 'Weather & climate', layers: [
      { key: 'rainLive', label: 'Rain animation (where raining now)', status: 'LIVE', source: 'Open-Meteo model analysis', note: 'Animates only grid cells with current precipitation > 0; intensity follows mm/h.' },
      { key: 'rainPast', label: 'Rainfall — past 24 h', status: 'LIVE', source: 'Open-Meteo NWP analysis', note: 'Model analysis, not rain-gauge observations.' },
      { key: 'rainForecast', label: 'Rainfall — next 24 h', status: 'LIVE', source: 'Open-Meteo forecast (FORECAST)' },
      { key: 'temperature', label: 'Temperature', status: 'LIVE', source: 'Open-Meteo' },
      { key: 'humidity', label: 'Humidity', status: 'LIVE', source: 'Open-Meteo' },
      { key: 'climate', label: 'Climate normals', status: 'POINT', source: 'ERA5 1991–2020', note: 'Click any location — shown in the context panel.' },
    ],
  },
  {
    id: 'hydrology', label: 'Hydrology', layers: [
      { key: 'rivers', label: 'Rivers', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'streams', label: 'Streams & drains', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'waterBodies', label: 'Lakes & reservoirs', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'dams', label: 'Dams & weirs', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'drainage', label: 'Drainage lines (D8)', status: 'ZONE', source: 'Derived from Copernicus GLO-30' },
      { key: 'catchments', label: 'Catchments', status: 'UNAVAILABLE', source: '—', note: 'No catchment dataset connected.' },
    ],
  },
  {
    id: 'flood', label: 'Flood & hazard', layers: [
      { key: 'modelRisk', label: 'Model risk grid', status: 'MODEL', source: 'FloodGuard ensemble v1.0.0', note: 'UNVALIDATED — trained on synthetic data; fails rainfall sanity check.' },
      { key: 'historical', label: 'Historical events', status: 'HISTORICAL', source: 'Curated, sourced list' },
      { key: 'simulation', label: 'Flood simulation', status: 'UNAVAILABLE', source: '—', note: 'No hydrodynamic engine configured.' },
      { key: 'floodDepth', label: 'Flood depth', status: 'UNAVAILABLE', source: '—', note: 'Flood depth data unavailable.' },
      { key: 'landslide', label: 'Landslide susceptibility', status: 'UNAVAILABLE', source: '—', note: 'No authoritative dataset connected (e.g. GSI NLSM).' },
    ],
  },
  {
    id: 'human', label: 'People & settlements', layers: [
      { key: 'population', label: 'Population density', status: 'HISTORICAL', source: 'HRSL v1.5 (Meta/CIESIN)', note: 'Modelled residential population; reference year not encoded.' },
      { key: 'buildings', label: '3D buildings', status: 'RECENT', source: 'OpenStreetMap footprints' },
      { key: 'settlements', label: 'Settlements', status: 'RECENT', source: 'OpenStreetMap place nodes' },
      { key: 'taluks', label: 'Taluk boundaries', status: 'RECENT', source: 'OpenStreetMap' },
    ],
  },
  {
    id: 'infra', label: 'Infrastructure', layers: [
      { key: 'roads', label: 'Roads', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'bridges', label: 'Bridges', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'hospitals', label: 'Hospitals & clinics', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'schools', label: 'Schools & colleges', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'police', label: 'Police', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'fire', label: 'Fire & rescue', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'government', label: 'Government offices', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'community', label: 'Community facilities', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'power', label: 'Power', status: 'RECENT', source: 'OpenStreetMap' },
    ],
  },
  {
    id: 'places', label: 'Hill stations & tourism', layers: [
      { key: 'tourism', label: 'Tourist locations', status: 'RECENT', source: 'OpenStreetMap' },
      { key: 'peaks', label: 'Peaks', status: 'RECENT', source: 'OpenStreetMap (ele tag)' },
    ],
  },
  {
    id: 'ops', label: 'Alerts & cameras', layers: [
      { key: 'alerts', label: 'Official alerts', status: 'LIVE', source: 'NDMA SACHET (CAP)' },
      { key: 'cameras', label: 'Live cameras', status: 'UNAVAILABLE', source: 'Camera registry', note: 'No legitimate public camera found in Wayanad.' },
    ],
  },
  {
    id: 'env', label: 'Environment', layers: [
      { key: 'landcover', label: 'Land cover', status: 'HISTORICAL', source: 'ESA WorldCover 2021 (10 m)' },
    ],
  },
];

export const POI_LAYER_CATEGORIES: Partial<Record<LayerKey, string[]>> = {
  hospitals: ['hospital', 'clinic', 'emergency_service'],
  schools: ['school', 'college'],
  police: ['police'],
  fire: ['fire_station'],
  government: ['government'],
  community: ['community', 'emergency_refuge'],
  power: ['power'],
  dams: ['dam', 'weir'],
  tourism: ['tourism'],
  peaks: ['peak'],
  bridges: ['bridge'],
};

export const RISK_COLORS: Record<string, string> = {
  VERY_LOW: '#2f9e8f',
  LOW: '#74c476',
  MODERATE: '#fcc419',
  HIGH: '#fd7e14',
  CRITICAL: '#e03131',
};

export const STATUS_STYLE: Record<string, string> = {
  LIVE: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  RECENT: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  HISTORICAL: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-slate-500/30',
  DERIVED: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 ring-indigo-500/30',
  MODEL: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  ZONE: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-violet-500/30',
  POINT: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-cyan-500/30',
  STALE: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30',
  UNAVAILABLE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/30',
};
