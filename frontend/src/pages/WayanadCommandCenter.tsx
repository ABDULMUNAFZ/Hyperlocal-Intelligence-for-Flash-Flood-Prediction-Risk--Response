// FloodGuard — Wayanad 3D situational-awareness command center.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Target } from 'lucide-react';
import { WayanadMap, type WayanadMapHandle, type HoverInfo, type MapTelemetry, type StaticData } from '../components/Wayanad/WayanadMap';
import { TopBar, type PanelId, type SearchItem } from '../components/Wayanad/TopBar';
import { LayerPanel } from '../components/Wayanad/LayerPanel';
import { ContextPanel, nearestFacilities } from '../components/Wayanad/ContextPanel';
import {
  RiskPanel, EvacuationPanel, AlertsPanel, CamerasPanel, CameraWindow, WeatherPanel, AssistantPanel, DataPanel,
  type ZoneState, type ChatMsg,
} from '../components/Wayanad/OpsPanels';
import { SimulationPanel, DEFAULT_PARAMS, type SimParams } from '../components/Wayanad/SimulationPanel';
import { AdminPanel, CitizenPanel, AboutPanel, AlertBanner } from '../components/Wayanad/EmergencyPanels';
import { RainOverlay, rainClass, RAIN_CLASS_LABEL, type RainCell } from '../components/Wayanad/RainOverlay';
import { useEmergency } from '../components/Wayanad/useEmergency';
import { useRescue } from '../components/Wayanad/useRescue';
import { RescuePersonPanel, SafeLocationPanel, EmergencyControlPanel } from '../components/Wayanad/RescuePanels';
import { statusTone } from '../emergency/status';
import type { StreamEvent } from '../services/liveApi';
import { useSimulation } from '../components/Wayanad/useSimulation';
import { simLayersAt, simBuildings, simSigns, depthAt, deepestCell, frameAtTime, cellIndex } from '../components/Wayanad/simUtils';
import { LEVEL_COLOR, SIGN_COLORS } from '../components/Wayanad/mapExtras';
import { sound } from '../components/Wayanad/sound';
import { liveApi, type LiveAlert } from '../services/liveApi';
import type { Map as MLMap } from 'maplibre-gl';
import { JourneyBar, ModeRail, NavControls, HoverTooltip } from '../components/Wayanad/MapHud';
import { CAMERA_MODE_PRESETS, DEFAULT_LAYERS, JOURNEY, ZONE_PRESETS, modeForZoom, type CameraMode, type LayerKey, type LayerState, type CameraView } from '../components/Wayanad/constants';
import { POI_STYLE } from '../components/Wayanad/icons';
import { bbox, centroid, circlePolygon, haversineKm, pointInGeometry, rings } from '../components/Wayanad/geo';
import { panel } from '../components/Wayanad/ui';
import type { Theme } from '../components/Wayanad/mapStyle';
import { geoApi } from '../services/geoApi';
import type {
  AlertsResponse, Camera, CamerasResponse, DistrictLayer, FeatureCollection, LngLat, Manifest, ModelSanity, OperationalZone,
  PointWeather, Prediction, RouteResult, ScenarioResult, Selection,
} from '../types/geo';

type Scenario = { rainfall_mm: number; duration_hours: number } | null;

const EMPTY_ZS: ZoneState = { zone: null, terrain: null, osm: null, risk: null, impact: null, worldpop: null, loading: {} };
const DISTRICT_LAYER_KEYS = ['elevation', 'slope', 'landcover', 'population'] as const;
const WEATHER_KEYS: LayerKey[] = ['rainPast', 'rainForecast', 'temperature', 'humidity'];
const DEMO_PARAMS: SimParams = { ...DEFAULT_PARAMS, kind: 'combined', scenario: 'Extreme monsoon burst', rainfall_mm: 300, duration_h: 12, amc: 'III' };
const CHOORALMALA: LngLat = [76.1598711, 11.4992319]; // OSM place node
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadJson<T>(url: string): Promise<T | null> {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
}

export default function WayanadCommandCenter() {
  const mapRef = useRef<WayanadMapHandle>(null);
  const userActed = useRef(false); // suppresses the cinematic entry once the user has navigated
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('fg-theme') as Theme) || 'light');
  const [is3D, setIs3D] = useState(true);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [exaggeration, setExaggeration] = useState(1.4);
  const [layersOpen, setLayersOpen] = useState(!isMobile);
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  // On narrower screens only one right-hand panel fits: the most recently opened one wins.
  const [rightFocus, setRightFocus] = useState<'context' | 'ops'>('context');
  const [cameraWin, setCameraWin] = useState<Camera | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [tele, setTele] = useState<MapTelemetry>({ center: JOURNEY[0].center, zoom: JOURNEY[0].zoom, pitch: 0, bearing: 0 });
  const [journeyId, setJourneyId] = useState<string | null>('south-india');
  const [mapReady, setMapReady] = useState(false);

  const [data, setData] = useState<StaticData>({ boundary: null, taluks: null, places: null, pois: null, events: [], cameras: [] });
  const [camerasResp, setCamerasResp] = useState<CamerasResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [sanity, setSanity] = useState<ModelSanity | null>(null);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [centreWeather, setCentreWeather] = useState<PointWeather | null>(null);
  const [districtLayers, setDistrictLayers] = useState<Record<string, DistrictLayer | undefined>>({});
  const [loadingLayers, setLoadingLayers] = useState<Record<string, boolean>>({});
  const [rainGrid, setRainGrid] = useState<{ available: boolean; geojson: FeatureCollection; provenance: any } | null>(null);

  const [zs, setZs] = useState<ZoneState>(EMPTY_ZS);
  const [scenario, setScenario] = useState<Scenario>(null);
  const [showImpact, setShowImpact] = useState(true);
  const [flowAnimation, setFlowAnimation] = useState(false);
  const [interaction, setInteraction] = useState<'select' | 'draw' | 'radius'>('select');
  const [radiusKm, setRadiusKm] = useState(1.5);

  const [routes, setRoutes] = useState<RouteResult[] | null>(null);
  const [routeCaveats, setRouteCaveats] = useState<string[]>([]);
  const [routeOrigin, setRouteOrigin] = useState<LngLat | null>(null);
  const [routing, setRouting] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [pointScenario, setPointScenario] = useState<ScenarioResult | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([{ role: 'assistant', text: 'Select a location or an operational zone, then ask. I explain FloodGuard\'s structured data — prediction inputs, terrain hydrology, exposure, weather and official alerts — and state what is unavailable.' }]);
  const [chatBusy, setChatBusy] = useState(false);

  // ------------------------------------------------------------ simulation, live emergency, demo
  const [mapObj, setMapObj] = useState<MLMap | null>(null);
  const sim = useSimulation();
  const tHRef = useRef(0);
  tHRef.current = sim.tH;
  const focusAlert = useCallback((a: LiveAlert) => {
    if (a.geometry) mapRef.current?.fitGeometry(a.geometry, { pitch: 60, padding: 140 });
  }, []);
  const rescueEvent = useRef<((e: StreamEvent) => void) | null>(null);
  const em = useEmergency({ onFocusAlert: focusAlert, onOtherEvent: (e) => rescueEvent.current?.(e) });
  const rescue = useRescue(!!em.me?.responder);
  rescueEvent.current = rescue.onEvent;
  const [rescueRoute, setRescueRoute] = useState<FeatureCollection | null>(null);
  const showRescueRoute = useCallback((fc: FeatureCollection | null, fit?: boolean) => {
    setRescueRoute(fc);
    const g = fc?.features[0]?.geometry as any;
    if (fit && g?.type === 'LineString') mapRef.current?.fitGeometry({ type: 'Polygon', coordinates: [g.coordinates] }, { pitch: 55, padding: 120 });
  }, []);
  const [draftBasis, setDraftBasis] = useState<string | null>(null);
  const [modelSigns, setModelSigns] = useState<Record<string, any>>({});
  const [demo, setDemo] = useState<{ n: number; total: number; step: string; done?: boolean; note?: string } | null>(null);
  const demoCancel = useRef(false);

  // ------------------------------------------------------------ theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('fg-theme', theme);
  }, [theme]);

  // ------------------------------------------------------------ bootstrap data
  useEffect(() => {
    (async () => {
      const [boundary, taluks, places, pois] = await Promise.all([
        loadJson<FeatureCollection>('/data/wayanad/boundary.geojson'),
        loadJson<FeatureCollection>('/data/wayanad/admin_areas.geojson'),
        loadJson<FeatureCollection>('/data/wayanad/places.geojson'),
        loadJson<FeatureCollection>('/data/wayanad/pois.geojson'),
      ]);
      setData((d) => ({ ...d, boundary, taluks, places, pois }));
    })();
    geoApi.health().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false));
    geoApi.historicalEvents().then((r) => setData((d) => ({ ...d, events: r.events }))).catch(() => undefined);
    geoApi.cameras().then((r) => { setCamerasResp(r); setData((d) => ({ ...d, cameras: r.cameras })); }).catch(() => undefined);
    const loadAlerts = () => geoApi.alerts().then(setAlerts).catch(() => setAlerts({ available: false, alerts: [], provenance: { source: 'NDMA SACHET', kind: 'OBSERVED', status: 'UNAVAILABLE', retrieved_at: '' } })).finally(() => setAlertsLoading(false));
    loadAlerts();
    const t = setInterval(loadAlerts, 5 * 60_000);
    geoApi.manifest().then((m) => { setManifest(m); if (m.model.sanity) setSanity(m.model.sanity); }).catch(() => undefined);
    geoApi.simulationCapabilities().then(setCapabilities).catch(() => undefined);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = () => geoApi.rainfallGrid().then(setRainGrid).catch(() => setRainGrid({ available: false, geojson: { type: 'FeatureCollection', features: [] }, provenance: null }));
    load();
    const t = setInterval(load, 15 * 60_000);
    return () => clearInterval(t);
  }, []);

  // ------------------------------------------------------------ cinematic entry: South India → Wayanad
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    const mark = () => { userActed.current = true; };
    map?.on('dragstart', mark);
    map?.on('wheel', mark);
    const t = setTimeout(() => {
      if (userActed.current) return;
      mapRef.current?.flyToView(JOURNEY[2], 7000);
      setJourneyId('wayanad');
    }, 900);
    return () => clearTimeout(t);
  }, [mapReady]);

  // ------------------------------------------------------------ district raster layers (lazy)
  useEffect(() => {
    for (const k of DISTRICT_LAYER_KEYS) {
      if (layers[k] && !districtLayers[k] && !loadingLayers[k]) {
        setLoadingLayers((l) => ({ ...l, [k]: true }));
        geoApi.districtLayer(k)
          .then((d) => setDistrictLayers((x) => ({ ...x, [k]: d })))
          .catch(() => undefined)
          .finally(() => setLoadingLayers((l) => ({ ...l, [k]: false })));
      }
    }
    if (WEATHER_KEYS.some((k) => layers[k]) && !rainGrid && !loadingLayers.rainPast) {
      setLoadingLayers((l) => ({ ...l, rainPast: true }));
      geoApi.rainfallGrid().then(setRainGrid).catch(() => setRainGrid({ available: false, geojson: { type: 'FeatureCollection', features: [] }, provenance: null }))
        .finally(() => setLoadingLayers((l) => ({ ...l, rainPast: false })));
    }
  }, [layers, districtLayers, rainGrid, loadingLayers]);

  // ------------------------------------------------------------ centre weather (debounced)
  const weatherKey = `${tele.center[0].toFixed(2)},${tele.center[1].toFixed(2)}`;
  useEffect(() => {
    if (tele.zoom < 7.5) return;
    const t = setTimeout(() => { geoApi.weather(tele.center[1], tele.center[0]).then(setCentreWeather).catch(() => undefined); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherKey]);

  const centreName = useMemo(() => {
    const places = data.places?.features ?? [];
    let best = '—', bd = Infinity;
    for (const f of places) {
      if (!['town', 'village'].includes(f.properties.place)) continue;
      const d = haversineKm(tele.center, f.geometry.coordinates);
      if (d < bd) { bd = d; best = f.properties.name; }
    }
    return bd < 15 ? best : tele.zoom < 8 ? 'South India' : 'Wayanad';
  }, [tele.center, tele.zoom, data.places]);

  const cameraMode: CameraMode = flowAnimation || openPanel === 'simulation' ? 'SIMULATION' : zs.zone && tele.zoom >= 13 && tele.zoom < 16.5 ? 'MICRO-ZONE' : modeForZoom(tele.zoom);

  // ------------------------------------------------------------ zone lifecycle
  const zoneKey = zs.zone?.id;
  const runZone = useCallback(async (zone: OperationalZone, sc: Scenario) => {
    const g = zone.geometry;
    setZs((s) => ({ ...s, loading: { ...s.loading, terrain: !s.terrain, osm: !s.osm, risk: true, impact: true, worldpop: !s.worldpop } }));
    const terrainP = geoApi.zoneTerrain(g).catch((e) => ({ available: false, reason: String(e.message) }));
    const osmP = geoApi.zoneOsm(g).catch((e) => ({ available: false, reason: String(e.message) }));
    terrainP.then((terrain: any) => setZs((s) => (s.zone?.id === zone.id ? { ...s, terrain, loading: { ...s.loading, terrain: false } } : s)));
    osmP.then((osm: any) => setZs((s) => (s.zone?.id === zone.id ? { ...s, osm, loading: { ...s.loading, osm: false } } : s)));
    geoApi.zoneWorldPop(g).then((worldpop) => setZs((s) => (s.zone?.id === zone.id ? { ...s, worldpop, loading: { ...s.loading, worldpop: false } } : s)))
      .catch(() => setZs((s) => ({ ...s, worldpop: { available: false, provenance: null }, loading: { ...s.loading, worldpop: false } })));
    await terrainP;
    const risk = await geoApi.zoneRisk(g, sc).catch((e) => ({ available: false, reason: String(e.message) }) as any);
    setZs((s) => (s.zone?.id === zone.id ? { ...s, risk, loading: { ...s.loading, risk: false } } : s));
    await osmP;
    const impact = await geoApi.zoneImpact(g, sc).catch(() => null);
    setZs((s) => (s.zone?.id === zone.id ? { ...s, impact, loading: { ...s.loading, impact: false } } : s));
  }, []);

  const setZone = useCallback((z: OperationalZone | null) => {
    userActed.current = true;
    setInteraction('select');
    setRoutes(null);
    setFlowAnimation(false);
    setScenario(null);
    if (!z) { setZs(EMPTY_ZS); return; }
    const zone = { ...z, center: z.center && (z.center[0] !== 0 || z.center[1] !== 0) ? z.center : centroid(z.geometry) };
    setZs({ ...EMPTY_ZS, zone });
    const [a, b, c, d] = bbox(zone.geometry);
    const big = haversineKm([a, b], [c, d]) > 15;
    mapRef.current?.fitGeometry(zone.geometry, { pitch: big ? 55 : 68, padding: isMobile ? 40 : 140 });
    setLayers((l) => ({ ...l, drainage: true, modelRisk: true, buildings: true }));
    setJourneyId(null);
  }, [isMobile]);

  useEffect(() => {
    if (zs.zone) runZone(zs.zone, scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneKey, scenario]);

  // Buildings marked as exposed when their centroid lies in a HIGH/CRITICAL model cell
  const zoneBuildings = useMemo<FeatureCollection | null>(() => {
    const b = zs.osm?.available ? zs.osm.buildings : null;
    if (!b) return null;
    const hot = (zs.risk?.available ? zs.risk.geojson?.features ?? [] : []).filter((f) => ['HIGH', 'CRITICAL'].includes(f.properties.risk_level));
    return {
      type: 'FeatureCollection',
      features: b.features.map((f) => ({ ...f, properties: { ...f.properties, exposed: hot.some((h) => pointInGeometry(f.properties.centroid, h.geometry)) } })),
    };
  }, [zs.osm, zs.risk]);

  // ------------------------------------------------------------ interactions
  const onSelect = useCallback((s: Selection) => {
    if (s.kind === 'camera') { setCameraWin(s.camera); return; }
    setSelection(s);
    setRightFocus('context');
  }, []);

  useEffect(() => { if (openPanel) setRightFocus('ops'); }, [openPanel]);

  const flyTo = (ll: LngLat, zoom: number) => { userActed.current = true; mapRef.current?.easeTo({ center: ll, zoom, pitch: Math.max(55, Number.isFinite(tele.pitch) ? tele.pitch : 55), duration: 2200 }); };

  const goJourney = (v: CameraView) => {
    userActed.current = true;
    setJourneyId(v.id);
    mapRef.current?.flyToView(v, v.level === 'REGIONAL' || v.level === 'STATE' ? 4000 : 5200);
  };

  const onCameraMode = (m: CameraMode) => {
    if (m === 'SIMULATION') { setOpenPanel('simulation'); setRightFocus('ops'); if (zs.terrain?.available) setFlowAnimation(true); }
    const p = CAMERA_MODE_PRESETS[m];
    let center = (m === 'MICRO-ZONE' || m === 'SIMULATION') && zs.zone ? zs.zone.center : m === 'REGIONAL' ? JOURNEY[0].center : m === 'DISTRICT' ? JOURNEY[2].center : tele.center;
    if (!center.every(Number.isFinite)) center = JOURNEY[2].center;
    mapRef.current?.easeTo({ center, zoom: p.zoom, pitch: p.pitch, duration: 2400 });
  };

  const toggleLayer = (k: LayerKey) => setLayers((l) => {
    const next = { ...l, [k]: !l[k] };
    if (WEATHER_KEYS.includes(k) && next[k]) WEATHER_KEYS.filter((x) => x !== k).forEach((x) => { next[x] = false; });
    return next;
  });

  const togglePanel = (p: PanelId) => { setOpenPanel((cur) => (cur === p ? null : p)); setRightFocus('ops'); };

  const makeZone = (center: LngLat, r: number, name: string) =>
    setZone({ id: `radius-${center[0].toFixed(4)}-${center[1].toFixed(4)}-${r}`, name, kind: 'radius', center, radius_km: r, geometry: circlePolygon(center, r) });

  // ------------------------------------------------------------ search
  const searchIndex = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    ZONE_PRESETS.forEach((z) => items.push({ id: `preset-${z.id}`, name: z.name, type: 'preset', lngLat: z.center, zoom: 14, geometry: z.geometry }));
    data.taluks?.features.forEach((f) => items.push({ id: f.properties.id, name: `${f.properties.name} taluk`, type: 'taluk', lngLat: centroid(f.geometry), zoom: 11, geometry: f.geometry }));
    data.places?.features.forEach((f) => items.push({ id: f.properties.id, name: f.properties.name, type: f.properties.place, lngLat: f.geometry.coordinates, zoom: f.properties.place === 'town' ? 14 : 15, props: f.properties }));
    data.pois?.features.forEach((f) => {
      if (f.properties.name && f.properties.category !== 'shelter_structure') items.push({ id: f.properties.id, name: f.properties.name, type: f.properties.category, lngLat: f.geometry.coordinates, zoom: 16.5, props: f.properties });
    });
    return items;
  }, [data.places, data.pois, data.taluks]);

  const onSearchPick = (it: SearchItem) => {
    if (it.type === 'preset') { const z = ZONE_PRESETS.find((p) => `preset-${p.id}` === it.id); if (z) setZone(z); return; }
    if (it.type === 'taluk') { setZone({ id: it.id, name: it.name, kind: 'taluk', center: it.lngLat, geometry: it.geometry }); return; }
    flyTo(it.lngLat, it.zoom);
    if (it.props?.place) setSelection({ kind: 'place', lngLat: it.lngLat, props: it.props });
    else if (it.props?.category) setSelection({ kind: 'poi', lngLat: it.lngLat, props: it.props });
    else setSelection({ kind: 'location', lngLat: it.lngLat });
  };

  // ------------------------------------------------------------ evacuation
  const computeRoutes = async (origin?: LngLat) => {
    const o = origin ?? routeOrigin ?? zs.zone?.center ?? (selection && 'lngLat' in selection ? selection.lngLat : null);
    if (!o) return;
    setRouteOrigin(o);
    setOpenPanel('evacuation');
    setRouting(true);
    const hot = (zs.risk?.available ? zs.risk.geojson?.features ?? [] : []).filter((f) => ['HIGH', 'CRITICAL'].includes(f.properties.risk_level));
    const candidates = nearestFacilities(data.pois, o, 40, ['school', 'college', 'community', 'government'])
      .filter((f) => f.distance_km > 0.2 && f.distance_km < 12 && !hot.some((h) => pointInGeometry(f.lngLat, h.geometry)))
      .slice(0, 5)
      .map((f) => ({ id: f.id, name: f.name ?? POI_STYLE[f.category]?.label, category: f.category, lon: f.lngLat[0], lat: f.lngLat[1] }));
    try {
      const r = sim.sim && zs.zone && pointInGeometry(o, zs.zone.geometry)
        ? await liveApi.simRoutes(sim.sim.id, o, candidates)
        : await geoApi.evacuationRoutes(o, candidates, zs.risk?.available ? zs.risk.geojson : undefined);
      setRoutes(r.routes);
      setRouteCaveats(r.caveats);
      const coords = (r.routes as any[]).flatMap((x: any) => x.geometry?.coordinates ?? []);
      if (coords.length) mapRef.current?.fitGeometry({ type: 'Polygon', coordinates: [coords] }, { pitch: 55, padding: 120 });
    } catch (e) {
      setRoutes([]);
      setRouteCaveats([`Routing failed: ${(e as Error).message}`]);
    } finally {
      setRouting(false);
    }
  };

  // ------------------------------------------------------------ AI assistant
  const ask = async (question: string) => {
    setOpenPanel('ai');
    setRightFocus('ops');
    setChat((c) => [...c, { role: 'user', text: question }]);
    const ql = question.toLowerCase();
    if (ql.includes('show high-risk') || ql.includes('show high risk')) {
      setLayers((l) => ({ ...l, modelRisk: true }));
      if (zs.zone) mapRef.current?.fitGeometry(zs.zone.geometry, { pitch: 65 });
    }
    if (ql.includes('shelter')) setLayers((l) => ({ ...l, schools: true, community: true, government: true }));
    setChatBusy(true);
    const ll: LngLat | null = selection && 'lngLat' in selection ? selection.lngLat : zs.zone?.center ?? null;
    const ctx: Record<string, any> = {
      prediction: prediction ?? undefined,
      zone: zs.zone ? {
        name: zs.zone.name,
        terrain: zs.terrain?.available ? { stats: zs.terrain.stats, population: zs.terrain.population?.hrsl_total, landcover: zs.terrain.landcover?.classes } : undefined,
        risk: zs.risk?.available ? { available: true, distribution: zs.risk.distribution, max_probability: zs.risk.max_probability, mode: zs.risk.mode, scenario: zs.risk.scenario, model: zs.risk.model } : undefined,
        worldpop: zs.worldpop?.available ? zs.worldpop.population : undefined,
      } : undefined,
      impact: zs.impact ?? undefined,
      weather: centreWeather?.available ? { rainfall_recent: centreWeather.rainfall_recent, rainfall_forecast: centreWeather.rainfall_forecast, current: centreWeather.current } : undefined,
      alerts: alerts?.available ? alerts.alerts.filter((a) => a.active).map((a) => ({ event: a.event, severity: a.severity, headline: a.headline, expires: a.expires })) : undefined,
      nearby_facilities: ll ? nearestFacilities(data.pois, ll, 6).map((f) => ({ name: f.name, category: f.category, distance_km: +f.distance_km.toFixed(2) })) : undefined,
      model_sanity: sanity ?? undefined,
      simulation: sim.sim ? {
        label: sim.sim.label, scenario: sim.sim.scenario, params: { rainfall_mm: sim.sim.params.rainfall_mm, duration_h: sim.sim.params.duration_h, kind: sim.sim.kind },
        flood: sim.sim.flood?.summary, landslide: sim.sim.landslide?.summary, stages: sim.sim.stages, assumptions: sim.sim.assumptions, validated: false,
      } : undefined,
    };
    try {
      const r = await geoApi.assistant(question, ctx);
      setChat((c) => [...c, { role: 'assistant', text: r.answer, meta: `${r.engine} · grounded on: ${r.grounded_on.join(', ') || 'no data'} · ${r.disclaimer}` }]);
    } catch (e) {
      setChat((c) => [...c, { role: 'assistant', text: `Assistant unavailable: ${(e as Error).message}` }]);
    } finally {
      setChatBusy(false);
    }
  };

  // ------------------------------------------------------------ derived
  const poiCounts = useMemo(() => {
    const c: Record<string, number> = {};
    data.pois?.features.forEach((f) => { c[f.properties.category] = (c[f.properties.category] ?? 0) + 1; });
    return c;
  }, [data.pois]);
  const activeAlerts = alerts?.available ? alerts.alerts.filter((a) => a.active).length : null;
  const dataStatuses = [
    { label: 'FloodGuard backend', status: backendOnline ? 'LIVE' : backendOnline === false ? 'UNAVAILABLE' : 'RECENT' },
    { label: 'Weather (Open-Meteo)', status: centreWeather?.provenance.status ?? 'RECENT', detail: centreWeather?.current?.time_local?.slice(11) },
    { label: 'Official alerts (SACHET)', status: alerts?.provenance.status ?? 'RECENT', detail: alerts?.scanned_messages ? `${alerts.scanned_messages} msgs` : undefined },
    { label: 'OSM reference snapshot', status: data.pois ? 'RECENT' : 'UNAVAILABLE', detail: `${data.pois?.features.length ?? 0} POIs` },
    { label: 'Model sanity check', status: sanity ? (sanity.passed ? 'LIVE' : 'UNAVAILABLE') : 'RECENT', detail: sanity ? (sanity.passed ? 'passed' : 'failed') : '…' },
    { label: 'Live cameras', status: data.cameras.length ? 'LIVE' : 'UNAVAILABLE', detail: `${data.cameras.length}` },
    { label: 'Scenario simulation engine', status: 'LIVE', detail: 'uncalibrated' },
    { label: 'Real-time alert channel', status: em.stream.connected ? 'LIVE' : 'UNAVAILABLE', detail: em.stream.responder ? 'responder' : 'public' },
  ];

  const selectedLL: LngLat | null = selection && 'lngLat' in selection ? selection.lngLat : null;

  // ---- simulation-derived layers (quantised in time to limit map updates)
  const simFrame = sim.sim ? frameAtTime(sim.sim, sim.tH) : 0;
  const tQ = Math.round(sim.tH * 20) / 20;
  const zoneRoadsFC = zs.osm?.available ? zs.osm.roads ?? null : null;
  const simLayers = useMemo(() => (sim.sim ? simLayersAt(sim.sim, tQ, zoneRoadsFC) : null), [sim.sim, tQ, zoneRoadsFC]);
  const displayBuildings = useMemo(() => (sim.sim ? simBuildings(sim.sim, simFrame > 0 ? sim.sim.flood?.frames[simFrame]?.t_h ?? tQ : tQ, zoneBuildings) : zoneBuildings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim.sim, simFrame, zoneBuildings, sim.sim?.landslide && tQ >= sim.sim.landslide.t_fail_h]);
  const probe = useMemo(() => {
    if (!sim.sim?.flood) return { depth: null as number | null, label: 'Depth' };
    if (selectedLL && cellIndex(sim.sim, selectedLL) !== null) return { depth: depthAt(sim.sim, simFrame, selectedLL), label: 'Selected point' };
    const d = deepestCell(sim.sim, simFrame);
    return d ? { depth: d.depth, label: `Deepest cell · ${d.at[1].toFixed(4)}, ${d.at[0].toFixed(4)}` } : { depth: 0, label: 'Zone (dry)' };
  }, [sim.sim, simFrame, selectedLL]);

  // ---- rain: simulation rain over the zone during a scenario, otherwise real current precipitation cells
  const simRainMm = sim.sim?.flood ? sim.sim.flood.frames[simFrame].rain_mm_h : sim.sim && sim.tH < (sim.sim.params?.duration_h ?? 0) ? sim.sim.params.rainfall_mm / sim.sim.params.duration_h : 0;
  const liveRainCells = useMemo<RainCell[]>(() => (rainGrid?.available ? rainGrid.geojson.features
    .filter((f) => (f.properties.current_mm_h ?? 0) > 0)
    .map((f) => ({ ring: f.geometry.coordinates[0], mmPerHour: f.properties.current_mm_h })) : []), [rainGrid]);
  const rainMode: 'SIMULATION' | 'LIVE' = sim.sim && simRainMm > 0 ? 'SIMULATION' : 'LIVE';
  const rainCells = useMemo<RainCell[]>(() => {
    if (rainMode === 'SIMULATION' && zs.zone) return rings(zs.zone.geometry).map((r) => ({ ring: r as [number, number][], mmPerHour: simRainMm }));
    return layers.rainLive ? liveRainCells : [];
  }, [rainMode, zs.zone, simRainMm, layers.rainLive, liveRainCells]);
  const liveMaxMm = liveRainCells.reduce((m, c) => Math.max(m, c.mmPerHour), 0);
  const rainTime = rainGrid?.available ? (rainGrid.geojson.features[0]?.properties.time_local as string | undefined)?.slice(11) : undefined;

  useEffect(() => { sound.setRain(rainCells.reduce((m, c) => Math.max(m, c.mmPerHour), 0)); }, [rainCells]);
  useEffect(() => {
    const d = sim.sim?.flood ? sim.sim.flood.frames[simFrame].max_depth_m : 0;
    sound.setWater(Math.min(1, d / 1.5));
  }, [sim.sim, simFrame]);

  // ---- model risk signs at towns (+ settlements inside the zone): real model output, unvalidated
  useEffect(() => {
    if (!data.places) return;
    const towns = data.places.features.filter((f) => f.properties.place === 'town');
    const inZone = zs.zone ? data.places.features.filter((f) => ['village', 'hamlet'].includes(f.properties.place) && pointInGeometry(f.geometry.coordinates, zs.zone!.geometry)).slice(0, 8) : [];
    const pts = [...towns, ...inZone].filter((f) => !modelSigns[f.properties.id])
      .map((f) => ({ id: f.properties.id, name: f.properties.name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], town: f.properties.place === 'town' }));
    if (!pts.length) return;
    liveApi.riskSigns(pts.slice(0, 20).map(({ town, ...p }) => p)).then((r) => {
      setModelSigns((m) => {
        const next = { ...m };
        for (const s of r.signs) next[s.id] = { ...s, town: pts.find((p) => p.id === s.id)?.town, warning: r.model?.warning };
        return next;
      });
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.places, zs.zone?.id]);

  const signs = useMemo<FeatureCollection>(() => {
    const feats: any[] = [];
    if (sim.sim && zs.zone) {
      feats.push(...simSigns(sim.sim, tQ, { geometry: zs.zone.geometry, center: zs.zone.center }, data.places, zoneRoadsFC).features);
    } else if (layers.modelRisk) {
      for (const s of Object.values(modelSigns)) {
        if (s.error || s.probability == null) continue;
        const color = LEVEL_COLOR[s.risk_level] ?? 'slate';
        feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: {
          priority: s.town ? 0 : 1, color, color_hex: SIGN_COLORS[color], status: 'MODEL',
          title: `⚠ FLASH FLOOD RISK · ${s.name}`, value: `${Math.round(s.probability * 100)}%`, sub: `${String(s.risk_level).replace('_', ' ')} · model, unvalidated`,
          basis: `FloodGuard ensemble, ${s.data_quality} inputs, ${new Date(s.timestamp).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })} IST`, note: s.warning } });
      }
    }
    for (const a of em.alerts) {
      if (!a.geometry) continue;
      const c = centroid(a.geometry as any);
      const color = LEVEL_COLOR[a.level] ?? 'orange';
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { priority: 0, color, color_hex: SIGN_COLORS[color], status: a.is_demo ? 'MODEL' : 'LIVE',
        title: `⚠ ${(a.hazard ?? 'alert').replace('_', ' ').toUpperCase()} ALERT${a.is_demo ? ' · DEMO' : ''}`, value: a.level, sub: a.area_name, basis: a.basis, note: a.recommended_action ?? '' } });
    }
    if (!sim.sim && layers.rainLive) {
      [...liveRainCells].sort((x, y) => y.mmPerHour - x.mmPerHour).slice(0, 3).forEach((c) => {
        const ctr = c.ring.reduce((acc, q) => [acc[0] + q[0] / c.ring.length, acc[1] + q[1] / c.ring.length], [0, 0]);
        feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: ctr }, properties: { priority: 1, color: 'blue', color_hex: SIGN_COLORS.blue, status: 'LIVE',
          title: '💧 RAIN NOW · model analysis', value: `${c.mmPerHour.toFixed(1)} mm/h`, sub: RAIN_CLASS_LABEL[rainClass(c.mmPerHour)], basis: `Open-Meteo grid cell, ${rainTime ?? ''} IST`, note: 'NWP model analysis, not a gauge observation.' } });
      });
    }
    return { type: 'FeatureCollection', features: feats };
  }, [sim.sim, tQ, zs.zone, data.places, zoneRoadsFC, layers.modelRisk, layers.rainLive, modelSigns, em.alerts, liveRainCells, rainTime]);

  // ------------------------------------------------------------ deterministic DEMO scenario (clearly labelled)
  // The demo is a long async script: always call the latest render's functions/state via refs.
  const latest = useRef({ ask: null as any, computeRoutes: null as any, em, sim });
  latest.current = { ask, computeRoutes, em, sim };

  const stopDemo = () => { demoCancel.current = true; sim.setPlaying(false); setDemo((d) => (d ? { ...d, done: true, step: 'Stopped' } : d)); };
  const runDemo = async () => {
    const TOTAL = 12;
    demoCancel.current = false;
    userActed.current = true;
    const step = async (n: number, label: string, fn?: () => Promise<void> | void, note?: string) => {
      if (demoCancel.current) throw new Error('cancelled');
      setDemo({ n, total: TOTAL, step: label, note });
      await fn?.();
    };
    const waitT = async (t: number, maxMs = 30000) => {
      const start = Date.now();
      while (tHRef.current < t && Date.now() - start < maxMs && !demoCancel.current) await sleep(200);
    };
    const zone = { ...ZONE_PRESETS[0] };
    try {
      await step(1, 'South India context', async () => { setSelection(null); mapRef.current?.flyToView(JOURNEY[0], 2500); await sleep(3000); });
      await step(2, 'Kerala', async () => { mapRef.current?.flyToView(JOURNEY[1], 3500); await sleep(4000); });
      await step(3, 'Wayanad — real terrain', async () => { mapRef.current?.flyToView(JOURNEY[2], 4500); await sleep(5200); });
      await step(4, 'Incident zone: Mundakkai – Chooralmala valley', async () => { setZone(zone); await sleep(5500); });
      await step(5, 'Running combined flash-flood + landslide model (fixed inputs: 300 mm / 12 h, AMC III)', async () => {
        setOpenPanel('simulation'); setRightFocus('ops'); sim.setParams(DEMO_PARAMS); setLayers((l) => ({ ...l, modelRisk: false }));
        const r = await sim.run(zone, { ...DEMO_PARAMS, demo: true, name: 'DEMO — Extreme monsoon burst · Mundakkai–Chooralmala' });
        if (!r) throw new Error('simulation failed');
      });
      await step(6, 'Rain intensifies → runoff → channels rise', async () => {
        setFlowAnimation(true); sim.setSpeed(4); sim.setTH(0); sim.setPlaying(true);
        mapRef.current?.easeTo({ pitch: 70, bearing: 25, duration: 3000 });
        await waitT(5);
      });
      await step(7, 'Flood propagates through simulated pathways · people exposure', async () => { await waitT(9); });
      await step(8, 'Slope failure · debris blocks roads', async () => {
        const tf = latest.current.sim.sim?.landslide?.t_fail_h ?? 10;
        await waitT(tf + 1.2);
      });
      await step(9, 'Responder alert', async () => {
        const f = latest.current.sim.sim?.flood?.summary;
        const body = {
          hazard: 'flash_flood', level: 'CRITICAL', title: 'Flash flood & landslide emergency — Mundakkai–Chooralmala', area_name: 'Mundakkai – Chooralmala, Meppadi',
          message: 'DEMO / SIMULATION: extreme-rainfall scenario shows flash flooding along the valley and slope failures blocking roads.',
          recommended_action: 'Move away from the river and steep slopes to designated higher ground. Do not cross flowing water.',
          geometry: zone.geometry, expires: new Date(Date.now() + 2 * 3600_000).toISOString(), is_demo: true,
          basis: `DEMO / SIMULATION: 300 mm / 12 h scenario${f ? ` — max depth ${f.max_depth_m} m, ~${Math.round(f.people_exposed_peak)} people in water (HRSL est.)` : ''}`,
        };
        if (latest.current.em.me?.responder) {
          await latest.current.em.publish(body);
        } else {
          const now = new Date().toISOString();
          latest.current.em.deliver({ id: `demo-local-${Date.now()}`, alert_id: 'DEMO', title: '[DEMO] ' + body.title, message: body.message, recommended_action: body.recommended_action,
            hazard: body.hazard, level: 'CRITICAL', severity: 'extreme', status: 'active', area_name: body.area_name, basis: body.basis, is_demo: true,
            onset: now, expires: body.expires, sent_at: now, author: null, acknowledged_count: 0, geometry: zone.geometry as any,
            source: 'DEMO — local preview only (sign in as responder to broadcast)' });
        }
        await sleep(6000);
      }, latest.current.em.me?.responder ? 'Broadcast to connected devices (DEMO)' : 'Local preview — sign in as responder to broadcast');
      await step(10, 'Citizen report: 4 people · need rescue (DEMO)', async () => {
        try {
          await liveApi.createReport({ latitude: CHOORALMALA[1], longitude: CHOORALMALA[0], accuracy_m: 25, report_type: 'NEED_RESCUE', people_count: 4, message: 'DEMO report', is_demo: true });
          latest.current.em.refreshReports();
        } catch { /* reporting may be rate-limited; the demo continues */ }
        if (latest.current.em.me?.responder) { setOpenPanel('admin'); }
        mapRef.current?.easeTo({ center: CHOORALMALA, zoom: 15.5, pitch: 65, duration: 2500 });
        await sleep(5000);
      }, latest.current.em.me?.responder ? 'Visible on the responder map' : 'Stored as DEMO; visible to signed-in responders');
      await step(11, 'Evacuation on the simulated state', async () => { await latest.current.computeRoutes(CHOORALMALA); await sleep(6000); });
      await step(12, 'AI explanation from structured data', async () => { await latest.current.ask('Why is this area at high flash-flood risk?'); });
      setDemo({ n: TOTAL, total: TOTAL, step: 'All values shown are DEMO / SIMULATION', done: true });
    } catch {
      setDemo((d) => (d ? { ...d, done: true, step: demoCancel.current ? 'Stopped' : 'Demo interrupted' } : d));
    }
  };

  // ------------------------------------------------------------ ops panel content
  const opsPanel = (() => {
    const close = () => setOpenPanel(null);
    const presets = () => setLayersOpen(true);
    switch (openPanel) {
      case 'risk': return <RiskPanel zs={zs} sanity={sanity} onClose={close} onPresets={presets} scenario={scenario} onScenario={setScenario} showImpact={showImpact} onShowImpact={setShowImpact} onAskAI={ask} />;
      case 'simulation': return (
        <SimulationPanel zone={zs.zone} params={sim.params} onParams={sim.setParams} sim={sim.sim} running={sim.running} runSeconds={sim.runSeconds}
          error={sim.error} onRun={() => zs.zone && sim.run(zs.zone).then((r) => { if (r) { setFlowAnimation(true); setLayers((l) => ({ ...l, modelRisk: false })); sim.setPlaying(true); } })}
          onClear={() => { sim.clear(); setFlowAnimation(false); }} tH={sim.tH} onTime={sim.setTH} playing={sim.playing} onPlay={sim.setPlaying}
          speed={sim.speed} onSpeed={sim.setSpeed} probe={probe} onEvacuate={() => computeRoutes()} onClose={close} onPresets={presets}
          onAlert={em.me?.responder && sim.sim ? () => {
            const f = sim.sim!.flood?.summary; const l = sim.sim!.landslide?.summary;
            setDraftBasis(`${sim.sim!.label}: ${sim.sim!.scenario} (${sim.sim!.params.rainfall_mm} mm / ${sim.sim!.params.duration_h} h)${f ? ` — max depth ${f.max_depth_m} m, ~${Math.round(f.people_exposed_peak)} people in water (HRSL est.), ${f.roads_impassable} roads impassable` : ''}${l ? `, ${l.failure_clusters} slope-failure clusters` : ''}`);
            setOpenPanel('admin');
          } : null} />
      );
      case 'admin': return (
        <AdminPanel me={em.me} onLogin={em.login} onLogout={em.logout} alerts={em.alerts} reports={em.reports} zone={zs.zone}
          pointOfInterest={selectedLL ? { lngLat: selectedLL, name: centreName } : null} draftBasis={draftBasis} demo={!!demo}
          onPublish={em.publish} onCancel={em.cancel} onFocus={(ll, z) => flyTo(ll, z ?? 15)} onReportStatus={em.setReportStatus}
          riskSummary={sim.sim?.flood ? `Current scenario (${sim.sim.label}): peak ${sim.sim.flood.summary.peak_flooded_km2} km² flooded, ~${Math.round(sim.sim.flood.summary.people_exposed_peak)} people exposed (HRSL est.).` : sanity && !sanity.passed ? 'ML risk layer is unvalidated (fails rainfall sanity check) — base alerts on official warnings, observations and simulations.' : null}
          onClose={close} />
      );
      case 'citizen': return (
        <CitizenPanel location={em.location} onLocate={em.locate} onForget={() => em.setLocation(null)} locError={em.locError} alerts={em.alerts}
          myReports={em.myReports} onSend={em.sendReport} onDelete={em.deleteReport} demo={!!demo} notifyPermission={em.notifyPermission}
          onEnableNotify={em.enableNotify} onClose={close} onViewAlert={focusAlert} />
      );
      case 'about': return <AboutPanel onClose={close} />;
      case 'rescue': return (
        <EmergencyControlPanel summary={rescue.summary} requests={rescue.requests} deliveries={rescue.deliveries} safe={rescue.safe} error={rescue.error}
          selectedLL={selectedLL} selectedName={centreName} demo={!!demo} onRefresh={rescue.refresh} onSafeChanged={rescue.loadSafe}
          onSelectPerson={(r) => { onSelect({ kind: 'rescue', lngLat: [r.location.longitude, r.location.latitude], props: { id: r.id } }); flyTo([r.location.longitude, r.location.latitude], 16.5); }}
          onFocus={(ll, z) => flyTo(ll, z ?? 16)} onOpenCompose={() => setOpenPanel('admin')} onClose={close} />
      );
      case 'evacuation': return <EvacuationPanel zs={zs} origin={routeOrigin} routes={routes} caveats={routeCaveats} loading={routing} onCompute={() => computeRoutes()} onClose={close} onPresets={presets}
        onFocusRoute={(r) => r.geometry && mapRef.current?.fitGeometry({ type: 'Polygon', coordinates: [r.geometry.coordinates] }, { pitch: 60, padding: 120 })} />;
      case 'alerts': return <AlertsPanel data={alerts} loading={alertsLoading} onClose={close} onViewArea={() => goJourney(JOURNEY[2])} onSimulate={() => setOpenPanel('simulation')} onEvacuate={() => setOpenPanel('evacuation')} />;
      case 'cameras': return <CamerasPanel data={camerasResp} onClose={close} onOpen={setCameraWin} />;
      case 'weather': return <WeatherPanel grid={rainGrid} centreWeather={centreWeather} onClose={close} layers={layers} onToggle={(k) => toggleLayer(k)} />;
      case 'ai': return <AssistantPanel messages={chat} busy={chatBusy} onAsk={ask} onClose={close} />;
      case 'data': return <DataPanel manifest={manifest} onClose={close} statuses={dataStatuses} />;
      default: return null;
    }
  })();

  useEffect(() => {
    if (openPanel === 'weather' && !WEATHER_KEYS.some((k) => layers[k])) setLayers((l) => ({ ...l, rainPast: true }));
    if (openPanel === 'cameras') setLayers((l) => ({ ...l, cameras: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel]);

  return (
    <div className={`fixed inset-0 overflow-hidden ${theme === 'dark' ? 'bg-[#0b1117]' : 'bg-[#eceee6]'}`}>
      <WayanadMap
        ref={mapRef}
        theme={theme} layers={layers} exaggeration={exaggeration} is3D={is3D} data={data}
        zone={zs.zone} zoneTerrain={zs.terrain} zoneBuildings={displayBuildings} zoneOsm={zs.osm} zoneRisk={zs.risk}
        rainGrid={rainGrid?.available ? rainGrid.geojson : null} districtLayers={districtLayers}
        routes={routes} routeOrigin={routeOrigin} selected={selectedLL}
        interaction={interaction} radiusKm={radiusKm} flowAnimation={flowAnimation} showImpact={showImpact}
        onSelect={onSelect} onHover={setHover} onMove={setTele}
        onZoneDrawn={(z) => setZone(z)} onReady={() => { setMapReady(true); setMapObj(mapRef.current?.getMap() ?? null); }}
        signs={signs} liveAlerts={em.alertsFC} reports={em.reportsFC} userLocation={em.location?.lngLat ?? null} sim={simLayers}
        rescue={rescue.rescueFC} rescueRoute={rescueRoute} safeLocations={rescue.safeFC}
      />

      <HoverTooltip info={interaction === 'select' ? hover : null} />

      <TopBar
        theme={theme} onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        is3D={is3D} on3D={() => setIs3D((v) => !v)}
        openPanel={openPanel} onPanel={togglePanel} layersOpen={layersOpen} onLayers={() => setLayersOpen((v) => !v)}
        backendOnline={backendOnline} alertCount={activeAlerts} modelSanityPassed={sanity ? sanity.passed : null}
        centreWeather={centreWeather} centreName={centreName} centre={tele.center} cameraMode={cameraMode}
        searchIndex={searchIndex} onSearchPick={onSearchPick}
        responder={!!em.me?.responder} liveConnected={em.stream.connected} demoActive={!!demo && !demo.done} onDemo={() => (demo && !demo.done ? stopDemo() : runDemo())}
        rescueCount={rescue.requests.filter((r) => statusTone(r.status) === 'red').length}
        precipitationNow={rainGrid?.available ? { maxMmH: +liveMaxMm.toFixed(1), label: `Open-Meteo model analysis${rainTime ? ` · ${rainTime} IST` : ''}` } : null}
      />

      <RainOverlay map={mapObj} cells={rainCells} dark={theme === 'dark'} />
      {rainCells.length > 0 && (
        <div className="pointer-events-none absolute right-[70px] top-[118px] z-20 hidden md:block">
          <div className={`rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider ${rainMode === 'SIMULATION' ? 'bg-amber-400 text-amber-950' : 'bg-sky-600 text-white'}`}>
            💧 RAIN · {rainMode === 'SIMULATION' ? `SIMULATION · ${simRainMm.toFixed(0)} mm/h` : `CURRENT (MODEL ANALYSIS) · max ${liveMaxMm.toFixed(1)} mm/h${rainTime ? ` · ${rainTime} IST` : ''}`}
          </div>
        </div>
      )}

      {em.banner && (
        <div className="pointer-events-none absolute left-1/2 top-[150px] z-40 -translate-x-1/2">
          <AlertBanner alert={em.banner} distanceKm={em.bannerDistance} onView={() => focusAlert(em.banner!)} onAck={() => em.acknowledge(em.banner!)} onDismiss={() => { sound.stopAlarm(); em.setBanner(null); }} />
        </div>
      )}

      {demo && (
        <div className="pointer-events-none absolute left-1/2 bottom-[100px] z-30 -translate-x-1/2 max-md:bottom-16">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-amber-400/95 px-4 py-2 text-amber-950 shadow-xl">
            <span className="text-[10px] font-extrabold tracking-[0.2em]">DEMO / SIMULATION</span>
            <span className="text-[12px] font-semibold">{demo.done ? 'Demo complete' : `Step ${demo.n}/${demo.total}`} · {demo.step}</span>
            {demo.note && <span className="text-[10.5px]">{demo.note}</span>}
            <button onClick={() => (demo.done ? setDemo(null) : stopDemo())} className="rounded bg-amber-950/15 px-2 py-0.5 text-[10.5px] font-bold hover:bg-amber-950/25">{demo.done ? 'Close' : 'Stop'}</button>
          </div>
        </div>
      )}

      {/* Operational-area banner */}
      {zs.zone && (
        <div className="pointer-events-none absolute left-1/2 top-[76px] md:top-[112px] z-20 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-rose-600/95 px-3.5 py-1.5 text-white shadow-lg">
            <Target className="h-3.5 w-3.5" />
            <span className="text-[10.5px] font-bold tracking-[0.18em] uppercase">Operational area</span>
            <span className="text-[12px] font-semibold">{zs.zone.name}</span>
            {(zs.loading.terrain || zs.loading.osm || zs.loading.risk) && <span className="h-2 w-2 rounded-full bg-white animate-ping" />}
            <button onClick={() => setZone(null)} className="ml-1 rounded-full p-0.5 hover:bg-white/20"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {/* Left column: operations & layers */}
      <div className={`pointer-events-none absolute z-20 left-2 md:left-3 top-[76px] md:top-[112px] bottom-24 md:bottom-[92px] flex ${layersOpen ? '' : 'hidden'} max-md:inset-x-2 max-md:top-auto max-md:bottom-2 max-md:h-[55vh]`}>
        <LayerPanel
          open={layersOpen} onClose={() => setLayersOpen(false)} layers={layers} onToggle={toggleLayer}
          exaggeration={exaggeration} onExaggeration={setExaggeration} zone={zs.zone} onZone={setZone} taluks={data.taluks}
          interaction={interaction} onInteraction={setInteraction} radiusKm={radiusKm} onRadius={setRadiusKm}
          loadingLayers={loadingLayers} poiCounts={poiCounts} cameraCount={data.cameras.length}
        />
      </div>

      {/* Right column: context + operations panels */}
      <div className="pointer-events-none absolute z-20 right-2 md:right-[64px] top-[76px] md:top-[112px] bottom-16 md:bottom-[92px] flex flex-row-reverse items-start gap-2 max-md:inset-x-2 max-md:top-auto max-md:bottom-2 max-md:h-[60vh] max-md:flex-col">
        {selection && selection.kind === 'rescue' && em.me?.responder && (
          <div className={`flex max-h-full max-md:w-full ${opsPanel && rightFocus === 'ops' ? 'max-2xl:hidden' : ''}`}>
            <RescuePersonPanel id={selection.props.id} responders={rescue.responders} onClose={() => { setSelection(null); setRescueRoute(null); }}
              onFocus={(ll, z) => flyTo(ll, z ?? 17)} onRoute={showRescueRoute} onChanged={rescue.replace} />
          </div>
        )}
        {selection && selection.kind === 'safe_location' && (
          <div className={`flex max-h-full max-md:w-full ${opsPanel && rightFocus === 'ops' ? 'max-2xl:hidden' : ''}`}>
            <SafeLocationPanel props={selection.props} responder={!!em.me?.responder} onClose={() => setSelection(null)} onChanged={rescue.loadSafe} />
          </div>
        )}
        {selection && selection.kind !== 'camera' && selection.kind !== 'rescue' && selection.kind !== 'safe_location' && (
          <div className={`flex max-h-full max-md:w-full ${opsPanel && rightFocus === 'ops' ? 'max-2xl:hidden' : ''}`}>
            <ContextPanel
              selection={selection} onClose={() => { setSelection(null); setPrediction(null); }}
              pois={data.pois} places={data.places} cameras={data.cameras}
              zoneRisk={zs.risk} zoneTerrain={zs.terrain} zoneOsm={zs.osm} climateOn={layers.climate}
              onMakeZone={makeZone} onAskAI={ask} onEvacuateFrom={(ll) => computeRoutes(ll)}
              onPrediction={setPrediction} onOpenCamera={setCameraWin} onFlyTo={flyTo}
              responder={!!em.me?.responder} onReportStatus={(id, st) => { em.setReportStatus(id, st); setSelection((s) => (s && s.kind === 'report' ? { ...s, props: { ...s.props, status: st } } : s)); }}
            />
          </div>
        )}
        {opsPanel && <div className={`flex max-h-full max-md:w-full ${selection && rightFocus === 'context' ? 'max-2xl:hidden' : ''}`}>{opsPanel}</div>}
      </div>

      {/* Right rail */}
      <div className="pointer-events-none absolute z-20 right-2 md:right-3 top-[76px] md:top-[112px] flex flex-col gap-2 max-md:top-[64px]">
        <NavControls bearing={tele.bearing} pitch={tele.pitch} onZoom={(d) => mapRef.current?.zoomBy(d)} onNorth={() => mapRef.current?.resetNorth()}
          onPitch={(d) => mapRef.current?.easeTo({ pitch: Math.max(0, Math.min(82, tele.pitch + d)), duration: 400 })} onLayers={() => setLayersOpen((v) => !v)} />
      </div>

      {/* Bottom: journey + disclaimer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-7 z-20 flex flex-col items-center gap-1.5 px-2 max-md:hidden">
        <ModeRail mode={cameraMode} onMode={onCameraMode} />
        <JourneyBar current={journeyId} onGo={goJourney} />
      </div>
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 px-3 py-1 text-[9.5px] tracking-wide ${theme === 'dark' ? 'text-slate-400 bg-black/40' : 'text-slate-600 bg-white/60'} backdrop-blur-sm max-md:hidden`}>
        <span>FloodGuard · Wayanad situational awareness · Map © OpenStreetMap contributors (ODbL) · OpenFreeMap · Copernicus DEM · ESA WorldCover · HRSL · Open-Meteo · NDMA SACHET</span>
        <span className="text-rose-600 dark:text-rose-400 font-semibold">For situational awareness only — not an official warning. Emergencies: 112 · District EOC 1077</span>
      </div>

      {/* Mobile quick bar */}
      <div className={`${panel} md:hidden pointer-events-auto absolute left-2 right-2 bottom-2 z-10 flex justify-around rounded-xl py-1.5 text-[10px] font-semibold ${layersOpen || selection || openPanel ? 'hidden' : ''}`}>
        <button onClick={() => setLayersOpen(true)}>Layers</button>
        <button onClick={() => togglePanel('risk')}>Risk</button>
        <button onClick={() => togglePanel('alerts')}>Alerts</button>
        <button onClick={() => togglePanel('evacuation')}>Evacuate</button>
        <button onClick={() => togglePanel('ai')}>AI</button>
      </div>

      {cameraWin && <CameraWindow camera={cameraWin} onClose={() => setCameraWin(null)} />}

      {interaction !== 'select' && (
        <div className="pointer-events-none absolute left-1/2 top-[150px] z-30 -translate-x-1/2">
          <div className="rounded-full bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-white">
            {interaction === 'draw' ? 'Drawing incident zone — click vertices, double-click / Enter to finish, Esc to cancel' : `Click the map to place a ${radiusKm} km incident zone`}
          </div>
        </div>
      )}

      {!mapReady && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-slate-950 text-white">
          <div className="text-center">
            <div className="text-[13px] font-extrabold tracking-[0.35em]">FLOODGUARD</div>
            <div className="mt-1 text-[10px] tracking-[0.3em] text-slate-400">WAYANAD SITUATIONAL AWARENESS</div>
            <div className="mt-6 mx-auto h-0.5 w-40 overflow-hidden rounded bg-white/10"><div className="h-full w-1/3 animate-[slideUp_1.2s_ease-in-out_infinite] bg-sky-400" /></div>
            <div className="mt-3 text-[10.5px] text-slate-500">Loading terrain, vector tiles and reference data…</div>
          </div>
        </div>
      )}
    </div>
  );
}
