import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl, { Map as MLMap, MapMouseEvent, GeoJSONSource, ImageSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { applyTheme, buildStyle, OVERLAY_ANCHOR, PALETTES, type Theme } from './mapStyle';
import { registerIcons, POI_STYLE } from './icons';
import { addExtraLayers, setDebrisProgress, setGeo, setImageOverlay, startWaterFlow } from './mapExtras';
import { maskPolygon, bbox, circlePolygon, centroid, haversineKm } from './geo';
import { JOURNEY, POI_LAYER_CATEGORIES, RISK_COLORS, type CameraView, type LayerState } from './constants';
import type {
  Camera, DistrictLayer, FeatureCollection, HistoricalEvent, LngLat, OperationalZone, RouteResult, Selection,
  ZoneOsm, ZoneRisk, ZoneTerrain,
} from '../../types/geo';

export interface HoverInfo {
  x: number;
  y: number;
  title: string;
  lines: Array<[string, string]>;
}

export interface MapTelemetry {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface WayanadMapHandle {
  flyToView: (v: CameraView, duration?: number) => void;
  fitGeometry: (geometry: { type: string; coordinates: any }, opts?: { pitch?: number; bearing?: number; padding?: number }) => void;
  easeTo: (opts: maplibregl.EaseToOptions) => void;
  zoomBy: (d: number) => void;
  resetNorth: () => void;
  getMap: () => MLMap | null;
}

export interface SimLayers {
  depthUrl: string | null;
  depthCoords: number[][] | null;
  fsUrl: string | null;
  fsCoords: number[][] | null;
  unstable: FeatureCollection | null;
  debris: FeatureCollection | null;
  debrisProgress: number;
  roads: FeatureCollection | null;
}

export interface StaticData {
  boundary: FeatureCollection | null;
  taluks: FeatureCollection | null;
  places: FeatureCollection | null;
  pois: FeatureCollection | null;
  events: HistoricalEvent[];
  cameras: Camera[];
}

interface Props {
  theme: Theme;
  layers: LayerState;
  exaggeration: number;
  is3D: boolean;
  data: StaticData;
  zone: OperationalZone | null;
  zoneTerrain: ZoneTerrain | null;
  zoneBuildings: FeatureCollection | null;
  zoneOsm: ZoneOsm | null;
  zoneRisk: ZoneRisk | null;
  rainGrid: FeatureCollection | null;
  districtLayers: Record<string, DistrictLayer | undefined>;
  routes: RouteResult[] | null;
  routeOrigin: LngLat | null;
  selected: LngLat | null;
  interaction: 'select' | 'draw' | 'radius';
  radiusKm: number;
  flowAnimation: boolean;
  showImpact: boolean;
  signs: FeatureCollection | null;
  liveAlerts: FeatureCollection | null;
  reports: FeatureCollection | null;
  rescue?: FeatureCollection | null;
  rescueRoute?: FeatureCollection | null;
  safeLocations?: FeatureCollection | null;
  userLocation: LngLat | null;
  sim: SimLayers | null;
  onSelect: (s: Selection) => void;
  onHover: (h: HoverInfo | null) => void;
  onMove: (t: MapTelemetry) => void;
  onZoneDrawn: (z: OperationalZone) => void;
  onReady: () => void;
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

const BUILDING_COLORS: Record<string, string> = {
  residential: '#d9a066', apartments: '#b5651d', commercial: '#4c6ef5', industrial: '#868e96',
  school: '#1c7ed6', hospital: '#d6336c', police: '#3b5bdb', fire_station: '#e03131',
  government: '#7048e8', religious: '#a5a5a5', community: '#0c8599', agricultural: '#94b86a', roof: '#ced4da',
};

const DISTRICT_LAYERS = ['elevation', 'slope', 'landcover', 'population'] as const;

/** The map only if its style is fully loaded (guards HMR / StrictMode remounts and style reloads). */
function liveMap(ref: React.MutableRefObject<MLMap | null>, readyRef: React.MutableRefObject<boolean>): MLMap | null {
  const m = ref.current;
  return m && readyRef.current && (m as any).style?._loaded ? m : null;
}

function setVis(map: MLMap, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}

function setData(map: MLMap, id: string, data: any) {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  if (src) src.setData(data);
}

export const WayanadMap = forwardRef<WayanadMapHandle, Props>(function WayanadMap(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  const drawPts = useRef<LngLat[]>([]);
  const selectedMarker = useRef<maplibregl.Marker | null>(null);
  const animRef = useRef<number | null>(null);
  const [ready, setReady] = React.useState(false);

  /** Camera moves can fail when a high-pitch camera sits inside exaggerated terrain (screen rays miss the
   *  surface → NaN). Recover by lowering the pitch and retrying once. */
  const safeCamera = (fn: (m: MLMap) => void) => {
    const m = mapRef.current;
    if (!m) return;
    try {
      fn(m);
    } catch {
      try {
        m.jumpTo({ pitch: Math.min(m.getPitch(), 40) });
        fn(m);
      } catch (err) {
        console.warn('FloodGuard: camera move skipped', err);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    flyToView: (v, duration = 4500) => safeCamera((m) => m.flyTo({ center: v.center, zoom: v.zoom, pitch: v.pitch, bearing: v.bearing, duration, essential: true, curve: 1.6 })),
    fitGeometry: (geometry, opts = {}) => safeCamera((map) => {
      const [a, b, c, d] = bbox(geometry);
      const bearing = opts.bearing ?? map.getBearing();
      const pad = opts.padding ?? 90;
      // Solve the camera top-down, then tilt: fitBounds with a high pitch pushes the target far into the distance.
      const lat = (b + d) / 2;
      const spanM = Math.max(haversineKm([a, lat], [c, lat]), haversineKm([a, b], [a, d])) * 1000;
      const el = map.getContainer();
      const usablePx = Math.max(280, Math.min(el.clientWidth - 2 * pad - 560, el.clientHeight - 2 * pad - 120));
      const zoom = Math.max(8, Math.min(16, Math.log2((156543.03 * Math.cos((lat * Math.PI) / 180) * usablePx) / spanM)));
      map.flyTo({ center: [(a + c) / 2, (b + d) / 2], zoom, pitch: Math.min(opts.pitch ?? 66, map.getMaxPitch()), bearing, duration: 3500, essential: true, curve: 1.4 });
    }),
    easeTo: (o) => safeCamera((m) => m.easeTo({ ...o, pitch: o.pitch !== undefined ? Math.min(o.pitch, m.getMaxPitch()) : undefined })),
    zoomBy: (d) => safeCamera((m) => m.easeTo({ zoom: m.getZoom() + d, duration: 500 })),
    resetNorth: () => safeCamera((m) => m.easeTo({ bearing: 0, duration: 800 })),
    getMap: () => mapRef.current,
  }));

  // ------------------------------------------------------------------ init
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const start = JOURNEY[0];
    const map = new maplibregl.Map({
      container: container.current,
      style: buildStyle(propsRef.current.theme),
      center: start.center,
      zoom: start.zoom,
      pitch: start.pitch,
      bearing: start.bearing,
      maxPitch: 82,
      minZoom: 4,
      maxZoom: 19,
      maxBounds: [[66, 3], [99, 38.5]], // India (DEMO alerts may target a test device anywhere in India)
      attributionControl: { compact: true },
      fadeDuration: 150,
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as any).__fgMap = map; // dev-only handle for debugging / automated checks

    // Initialise overlays as soon as the style is parsed; tiles (incl. terrain) stream in afterwards.
    let initialised = false;
    let stopFlow: (() => void) | null = null;
    map.on('style.load', async () => {
      if (initialised) return;
      initialised = true;
      try {
        await registerIcons(map);
      } catch (err) {
        if (mapRef.current !== map) return; // map was replaced while icons loaded
        console.warn('FloodGuard: icon registration failed', err);
      }
      if (mapRef.current !== map) return;
      addCustomLayers(map, propsRef.current.theme);
      addExtraLayers(map);
      stopFlow = startWaterFlow(map);
      applyTheme(map, propsRef.current.theme);
      readyRef.current = true;
      setReady(true);
      propsRef.current.onReady();
    });

    const emitMove = () => {
      const c = map.getCenter();
      if (!Number.isFinite(c.lng) || !Number.isFinite(c.lat)) return;
      propsRef.current.onMove({ center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() });
    };
    map.on('moveend', emitMove);
    let moveRaf = 0;
    map.on('move', () => {
      if (moveRaf) return;
      moveRaf = requestAnimationFrame(() => { moveRaf = 0; emitMove(); });
    });

    let hoverRaf = 0;
    let lastHover: MapMouseEvent | null = null;
    map.on('mousemove', (e) => {
      lastHover = e;
      if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        if (lastHover) handleHover(map, lastHover);
      });
    });
    map.on('mouseout', () => propsRef.current.onHover(null));
    map.on('click', (e) => handleClick(map, e));
    map.on('dblclick', (e) => {
      if (propsRef.current.interaction === 'draw') {
        e.preventDefault();
        finishDraw(map);
      }
    });

    // Auto-resize observer to dynamically adapt to 55" TVs, 4K displays, ultra-wide monitors, and fullscreen transitions
    const resizeObserver = new ResizeObserver(() => {
      if (readyRef.current && mapRef.current) {
        map.resize();
      }
    });
    if (container.current) {
      resizeObserver.observe(container.current);
    }
    const handleWinResize = () => {
      if (readyRef.current && mapRef.current) {
        map.resize();
      }
    };
    window.addEventListener('resize', handleWinResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWinResize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      readyRef.current = false;
      setReady(false);
      stopFlow?.();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ custom layers
  function addCustomLayers(map: MLMap, theme: Theme) {
    const add = (id: string, data: any = EMPTY, extra: Record<string, any> = {}) => {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data, ...extra });
    };
    ['fg-mask', 'fg-boundary', 'fg-taluks', 'fg-places', 'fg-pois', 'fg-events', 'fg-cameras', 'fg-zone', 'fg-zone-pt', 'fg-risk',
      'fg-zone-buildings', 'fg-routes', 'fg-route-dest', 'fg-rain', 'fg-draw', 'fg-hover'].forEach((id) => add(id));
    add('fg-drainage', EMPTY, { lineMetrics: true });

    const beforeRoads = map.getLayer(OVERLAY_ANCHOR) ? OVERLAY_ANCHOR : undefined;

    // Rainfall / weather grid (below roads)
    map.addLayer({
      id: 'fg-rain', type: 'fill', source: 'fg-rain', layout: { visibility: 'none' },
      paint: { 'fill-color': '#1c7ed6', 'fill-opacity': 0.5, 'fill-outline-color': 'rgba(255,255,255,0.15)' },
    }, beforeRoads);

    // Model risk grid (draped on terrain, above roads so red zones stand out)
    map.addLayer({
      id: 'fg-risk-fill', type: 'fill', source: 'fg-risk',
      paint: {
        'fill-color': ['match', ['get', 'risk_level'], 'CRITICAL', RISK_COLORS.CRITICAL, 'HIGH', RISK_COLORS.HIGH, 'MODERATE', RISK_COLORS.MODERATE, 'LOW', RISK_COLORS.LOW, RISK_COLORS.VERY_LOW],
        'fill-opacity': ['match', ['get', 'risk_level'], 'CRITICAL', 0.62, 'HIGH', 0.55, 'MODERATE', 0.42, 0.26],
      },
    }, 'building-3d');
    map.addLayer({
      id: 'fg-risk-line', type: 'line', source: 'fg-risk',
      filter: ['in', ['get', 'risk_level'], ['literal', ['HIGH', 'CRITICAL']]],
      paint: { 'line-color': ['match', ['get', 'risk_level'], 'CRITICAL', '#ff4d4d', '#ff922b'], 'line-width': 2.2, 'line-blur': 0.5 },
    }, 'building-3d');

    // District mask + boundary
    map.addLayer({
      id: 'fg-mask', type: 'fill', source: 'fg-mask',
      paint: { 'fill-color': theme === 'dark' ? '#03060a' : '#f2f3ef', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5.5, 0.12, 8.5, 0.62] },
    });
    map.addLayer({
      id: 'fg-boundary-glow', type: 'line', source: 'fg-boundary',
      paint: { 'line-color': '#4dabf7', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 14], 'line-blur': 6, 'line-opacity': 0.45 },
    });
    map.addLayer({
      id: 'fg-boundary-line', type: 'line', source: 'fg-boundary',
      paint: { 'line-color': theme === 'dark' ? '#8ecbff' : '#1864ab', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 2.8] },
    });
    map.addLayer({
      id: 'fg-taluk-line', type: 'line', source: 'fg-taluks', minzoom: 8,
      paint: { 'line-color': theme === 'dark' ? '#b197fc' : '#5f3dc4', 'line-width': 1.2, 'line-dasharray': [4, 3], 'line-opacity': 0.7 },
    });
    map.addLayer({
      id: 'fg-taluk-label', type: 'symbol', source: 'fg-taluks', minzoom: 8.5, maxzoom: 11.5,
      layout: { 'text-field': ['upcase', ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-letter-spacing': 0.35 },
      paint: { 'text-color': PALETTES[theme].label as string, 'text-halo-color': PALETTES[theme].labelHalo as string, 'text-halo-width': 1.6, 'text-opacity': 0.7 },
    });

    // Drainage (D8) with animated runoff pulses
    map.addLayer({
      id: 'fg-drainage', type: 'line', source: 'fg-drainage',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#1c7ed6',
        'line-width': ['interpolate', ['linear'], ['get', 'max_contributing_area_km2'], 0.05, 1.2, 1, 2.6, 10, 6],
        'line-opacity': 0.9,
      },
    });

    // Zone OSM buildings (true footprints, height provenance in properties)
    map.addLayer({
      id: 'fg-zone-buildings', type: 'fill-extrusion', source: 'fg-zone-buildings', minzoom: 12.5,
      paint: {
        'fill-extrusion-color': ['case',
          ['>', ['coalesce', ['get', 'sim_depth'], 0], 1.5], '#7a0010',
          ['>', ['coalesce', ['get', 'sim_depth'], 0], 0.5], '#e03131',
          ['>', ['coalesce', ['get', 'sim_depth'], 0], 0.1], '#f76707',
          ['==', ['get', 'debris'], true], '#8d5524',
          ['all', ['==', ['get', 'exposed'], true], ['==', ['feature-state', 'impact'], true]], '#e03131',
          ['match', ['get', 'building_type'], ...Object.entries(BUILDING_COLORS).flat(), PALETTES[theme].building as string]] as any,
        'fill-extrusion-height': ['get', 'render_height_m'],
        'fill-extrusion-base': ['get', 'min_height_m'],
        'fill-extrusion-opacity': 0.95,
        'fill-extrusion-vertical-gradient': true,
      },
    });

    // Routes
    map.addLayer({
      id: 'fg-routes-casing', type: 'line', source: 'fg-routes', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.85 },
    });
    map.addLayer({
      id: 'fg-routes', type: 'line', source: 'fg-routes', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'status'], 'crosses', '#f76707', 'avoids', '#2b8a3e', '#1c7ed6'],
        'line-width': ['case', ['==', ['get', 'rank'], 0], 5.5, 3.5],
        'line-opacity': ['case', ['==', ['get', 'rank'], 0], 1, 0.7],
      },
    });
    map.addLayer({
      id: 'fg-route-dest', type: 'symbol', source: 'fg-route-dest',
      layout: { 'icon-image': 'icon-refuge', 'icon-size': 0.9, 'icon-allow-overlap': true, 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.6], 'text-anchor': 'top', 'text-optional': true },
      paint: { 'text-color': '#2b8a3e', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    });

    // Operational zone
    map.addLayer({ id: 'fg-zone-glow', type: 'line', source: 'fg-zone', paint: { 'line-color': '#ff6b6b', 'line-width': 16, 'line-blur': 10, 'line-opacity': 0.55 } });
    map.addLayer({ id: 'fg-zone-line', type: 'line', source: 'fg-zone', paint: { 'line-color': '#ff3b3b', 'line-width': 2.6, 'line-dasharray': [3, 1.5] } });
    map.addLayer({
      id: 'fg-zone-label', type: 'symbol', source: 'fg-zone-pt',
      layout: { 'text-field': ['concat', 'INCIDENT ZONE\n', ['upcase', ['get', 'name']]], 'text-font': ['Noto Sans Bold'], 'text-size': 12.5, 'text-letter-spacing': 0.18, 'symbol-placement': 'point', 'text-allow-overlap': true },
      paint: { 'text-color': '#c92a2a', 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 2 },
    });

    // Settlements
    const placeFilter: any = ['match', ['get', 'place'], ['city', 'town'], true, 'village', ['>=', ['zoom'], 10.2], 'suburb', ['>=', ['zoom'], 11.5], ['hamlet', 'neighbourhood', 'locality'], ['>=', ['zoom'], 12.8], ['>=', ['zoom'], 14.5]];
    map.addLayer({
      id: 'fg-place-dot', type: 'circle', source: 'fg-places', filter: placeFilter,
      paint: {
        'circle-radius': ['match', ['get', 'place'], 'town', 5, 'village', 3.5, 2.5],
        'circle-color': theme === 'dark' ? '#e9ecef' : '#212529',
        'circle-stroke-color': theme === 'dark' ? '#212529' : '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-pitch-alignment': 'viewport',
      },
    });
    map.addLayer({
      id: 'fg-place-label', type: 'symbol', source: 'fg-places', filter: placeFilter,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['match', ['get', 'place'], 'town', ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]],
        'text-size': ['match', ['get', 'place'], 'town', 14, 'village', 12, 10.5],
        'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-max-width': 8,
        'symbol-sort-key': ['match', ['get', 'place'], 'town', 0, 'village', 1, 2],
      },
      paint: { 'text-color': PALETTES[theme].label as string, 'text-halo-color': PALETTES[theme].labelHalo as string, 'text-halo-width': 1.6 },
    });

    // POIs (category icons, LOD per category)
    const zoomGate: any = ['match', ['get', 'category'], ...Object.entries(POI_STYLE).flatMap(([k, v]) => [k, ['>=', ['zoom'], v.minzoom]]), false];
    map.addLayer({
      id: 'fg-poi', type: 'symbol', source: 'fg-pois', filter: zoomGate,
      layout: {
        'icon-image': ['concat', 'poi-', ['get', 'category']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.62, 14, 0.8, 17, 0.95],
        'icon-allow-overlap': false,
        'symbol-sort-key': ['match', ['get', 'category'], 'hospital', 0, 'fire_station', 1, 'police', 2, 'dam', 3, 'peak', 4, 'school', 5, 10],
        'text-field': ['step', ['zoom'], '', 14.2, ['coalesce', ['get', 'name'], '']],
        'text-font': ['Noto Sans Regular'], 'text-size': 10.5, 'text-offset': [0, 1.35], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 9,
      },
      paint: { 'text-color': PALETTES[theme].label as string, 'text-halo-color': PALETTES[theme].labelHalo as string, 'text-halo-width': 1.4 },
    });

    map.addLayer({
      id: 'fg-events', type: 'symbol', source: 'fg-events',
      layout: { 'icon-image': 'icon-event', 'icon-size': 0.95, 'icon-allow-overlap': true, 'text-field': ['step', ['zoom'], '', 10.5, ['get', 'short']], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-optional': true },
      paint: { 'text-color': '#862e9c', 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.6 },
    });
    map.addLayer({
      id: 'fg-cameras', type: 'symbol', source: 'fg-cameras',
      layout: { 'icon-image': 'icon-camera', 'icon-size': 0.9, 'icon-allow-overlap': true, 'text-field': ['concat', '● LIVE  ', ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': 10, 'text-offset': [0, 1.5], 'text-anchor': 'top' },
      paint: { 'text-color': '#e03131', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    });

    // Hover highlight + drawing
    map.addLayer({ id: 'fg-hover-line', type: 'line', source: 'fg-hover', paint: { 'line-color': '#fab005', 'line-width': 3 } });
    map.addLayer({ id: 'fg-draw-fill', type: 'fill', source: 'fg-draw', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#ff6b6b', 'fill-opacity': 0.15 } });
    map.addLayer({ id: 'fg-draw-line', type: 'line', source: 'fg-draw', paint: { 'line-color': '#e03131', 'line-width': 2, 'line-dasharray': [2, 1] } });
    map.addLayer({ id: 'fg-draw-pts', type: 'circle', source: 'fg-draw', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#e03131', 'circle-stroke-width': 2 } });
  }

  // ------------------------------------------------------------------ hover
  function handleHover(map: MLMap, e: MapMouseEvent) {
    const p = propsRef.current;
    if (p.interaction !== 'select') {
      map.getCanvas().style.cursor = 'crosshair';
      if (p.interaction === 'draw' && drawPts.current.length) {
        renderDraw(map, [...drawPts.current, [e.lngLat.lng, e.lngLat.lat]]);
      }
      return;
    }
    const layerIds = ['fg-rescue-point', 'fg-safe-dot', 'fg-signs', 'fg-report-point', 'fg-report-cluster', 'fg-cameras', 'fg-events', 'fg-poi', 'fg-place-label', 'fg-place-dot', 'fg-zone-buildings', 'building-3d', 'fg-risk-fill', 'fg-drainage', 'waterway-river', 'waterway-stream', 'road-major', 'road-minor', 'road-track']
      .filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
    const feats = map.queryRenderedFeatures(e.point, { layers: layerIds });
    const f = feats[0];
    const ll: LngLat = [e.lngLat.lng, e.lngLat.lat];
    const lines: Array<[string, string]> = [];
    let title = '';
    const terrain = (map as any).terrain;
    let elev: number | null = null;
    let slopeAspect: [number, number] | null = null;
    if (terrain) {
      const ex = terrain.exaggeration || 1;
      const tz = (map as any).transform.tileZoom;
      const at = (lon: number, lat: number) => terrain.getElevationForLngLatZoom(new maplibregl.LngLat(lon, lat), tz) / ex;
      elev = at(e.lngLat.lng, e.lngLat.lat);
      if (elev === 0) elev = null; // terrain tile not loaded yet — show nothing rather than 0 m
      const d = 0.0004; // ≈ 44 m
      const mx = 111320 * Math.cos((e.lngLat.lat * Math.PI) / 180) * d, my = 110574 * d;
      const dzdx = (at(e.lngLat.lng + d, e.lngLat.lat) - at(e.lngLat.lng - d, e.lngLat.lat)) / (2 * mx);
      const dzdy = (at(e.lngLat.lng, e.lngLat.lat + d) - at(e.lngLat.lng, e.lngLat.lat - d)) / (2 * my);
      const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      const aspect = ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360; // downslope direction
      if (elev !== null && Number.isFinite(slope)) slopeAspect = [slope, aspect];
    }
    setData(map, 'fg-hover', EMPTY);
    if (f) {
      const pr = f.properties || {};
      switch (f.layer.id) {
        case 'fg-rescue-point': title = `${pr.people_count} ${pr.people_count === 1 ? 'person' : 'people'} · ${pr.label}`; lines.push(['Last position', pr.captured_ago ?? '—'], ['Source', 'Device GPS shared by the person']); break;
        case 'fg-safe-dot': title = `Safe location · ${pr.name}`; lines.push(['Type', pr.type], ['Designation', pr.verification ?? '—']); if (pr.is_demo) lines.push(['Status', 'DEMO']); break;
        case 'fg-signs': title = `${pr.title} · ${pr.value}`; lines.push(['Basis', pr.basis ?? '—']); if (pr.sub) lines.push(['Detail', pr.sub]); break;
        case 'fg-report-point': title = `${pr.people_count} people · ${pr.label}`; lines.push(['Status', pr.status], ['Reported', new Date(pr.created_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })], ['Source', 'Citizen report (user-provided)']); break;
        case 'fg-report-cluster': title = `${pr.point_count} citizen reports`; lines.push(['People reported', String(pr.people)], ['Critical', String(pr.critical)]); break;
        case 'fg-cameras': title = `Camera · ${pr.name}`; lines.push(['Status', 'LIVE'], ['Source', pr.source]); break;
        case 'fg-events': title = pr.title; lines.push(['Date', pr.date], ['Type', pr.event_type]); break;
        case 'fg-poi': title = pr.name || POI_STYLE[pr.category]?.label || pr.category; lines.push(['Type', POI_STYLE[pr.category]?.label ?? pr.category]); if (pr.ele) lines.push(['Elevation (OSM)', `${pr.ele} m`]); break;
        case 'fg-place-label': case 'fg-place-dot': title = pr.name; lines.push(['Settlement', pr.place]); break;
        case 'fg-zone-buildings':
          title = `Building · ${pr.building_type}`;
          lines.push(['Height', pr.height_m ? `${pr.height_m} m (${pr.height_status === 'SOURCE' ? 'OSM tag' : 'estimated'})` : 'unavailable']);
          lines.push(['Footprint', `${pr.footprint_m2} m²`]);
          if (pr.exposed) lines.push(['Model risk cell', 'HIGH/CRITICAL']);
          break;
        case 'building-3d':
          title = 'Building (OSM footprint)';
          lines.push(['Render height', `${pr.render_height ?? '—'} m`], ['Height source', 'OpenMapTiles render height — click for OSM tags']);
          break;
        case 'fg-risk-fill':
          title = `Model risk · ${pr.risk_level}`;
          lines.push(['Probability', `${Math.round(pr.probability * 100)}%`], ['Model', 'UNVALIDATED (synthetic training)'], ['Slope', `${pr.slope_deg}°`]);
          break;
        case 'fg-drainage':
          title = 'Drainage line (D8, derived)';
          lines.push(['Contributing area', `${pr.max_contributing_area_km2} km²`], ['Source', 'Copernicus GLO-30']);
          break;
        case 'waterway-river': case 'waterway-stream':
          title = pr['name:en'] || pr.name || (pr.class === 'river' ? 'River (unnamed)' : 'Stream (unnamed)');
          lines.push(['Class', pr.class], ['Source', 'OpenStreetMap']);
          if (f.geometry.type === 'LineString') setData(map, 'fg-hover', { type: 'Feature', geometry: f.geometry, properties: {} });
          break;
        default:
          title = pr['name:en'] || pr.name || pr.ref || `${pr.class} road`;
          lines.push(['Road class', pr.class], ['Surface', pr.surface ?? '—']);
          if (pr.brunnel === 'bridge') lines.push(['Structure', 'Bridge']);
          if (f.geometry.type === 'LineString') setData(map, 'fg-hover', { type: 'Feature', geometry: f.geometry, properties: {} });
      }
    } else {
      title = 'Terrain';
    }
    if (elev !== null && Number.isFinite(elev)) lines.push(['Elevation (display DEM)', `${Math.round(elev)} m`]);
    if (slopeAspect && !f) {
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      lines.push(['Slope', `${slopeAspect[0].toFixed(1)}°`], ['Aspect', `${dirs[Math.round(slopeAspect[1] / 45) % 8]} (${Math.round(slopeAspect[1])}°)`]);
      lines.push(['Terrain source', 'AWS Terrain Tiles · click for GLO-30']);
    }
    lines.push(['Coordinates', `${ll[1].toFixed(4)}, ${ll[0].toFixed(4)}`]);
    map.getCanvas().style.cursor = f ? 'pointer' : '';
    p.onHover({ x: e.point.x, y: e.point.y, title, lines });
  }

  // ------------------------------------------------------------------ click
  function handleClick(map: MLMap, e: MapMouseEvent) {
    const p = propsRef.current;
    const ll: LngLat = [e.lngLat.lng, e.lngLat.lat];
    if (p.interaction === 'draw') {
      drawPts.current.push(ll);
      renderDraw(map, drawPts.current);
      return;
    }
    if (p.interaction === 'radius') {
      const geometry = circlePolygon(ll, p.radiusKm);
      const near = nearestPlaceName(ll);
      p.onZoneDrawn({ id: `radius-${Date.now()}`, name: `${near} (${p.radiusKm} km)`, kind: 'radius', center: ll, radius_km: p.radiusKm, geometry });
      return;
    }
    const order = ['fg-rescue-point', 'fg-safe-dot', 'fg-signs', 'fg-report-cluster', 'fg-report-point', 'fg-cameras', 'fg-events', 'fg-poi', 'fg-place-label', 'fg-place-dot', 'fg-zone-buildings', 'building-3d', 'waterway-river', 'waterway-stream', 'road-major', 'road-minor', 'road-track', 'fg-live-alert-fill', 'fg-risk-fill'];
    const layers = order.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
    const feats = map.queryRenderedFeatures(e.point, { layers });
    feats.sort((a, b) => order.indexOf(a.layer.id) - order.indexOf(b.layer.id));
    const f = feats[0];
    if (!f) return p.onSelect({ kind: 'location', lngLat: ll });
    const pr = { ...(f.properties || {}) };
    switch (f.layer.id) {
      case 'fg-rescue-point': return p.onSelect({ kind: 'rescue', lngLat: (f.geometry as any).coordinates, props: pr });
      case 'fg-safe-dot': return p.onSelect({ kind: 'safe_location', lngLat: (f.geometry as any).coordinates, props: pr });
      case 'fg-signs': return p.onSelect({ kind: 'sign', lngLat: (f.geometry as any).coordinates, props: pr });
      case 'fg-report-point': return p.onSelect({ kind: 'report', lngLat: (f.geometry as any).coordinates, props: pr });
      case 'fg-report-cluster': {
        const src = map.getSource('fg-reports') as GeoJSONSource;
        src.getClusterExpansionZoom(pr.cluster_id).then((z) => map.easeTo({ center: (f.geometry as any).coordinates, zoom: z + 0.5, duration: 800 }));
        return;
      }
      case 'fg-live-alert-fill': return p.onSelect({ kind: 'live_alert', lngLat: ll, props: pr });
      case 'fg-cameras': {
        const cam = p.data.cameras.find((c) => c.id === pr.id);
        if (cam) p.onSelect({ kind: 'camera', camera: cam });
        return;
      }
      case 'fg-events': {
        const ev = p.data.events.find((x) => x.id === pr.id);
        if (ev) p.onSelect({ kind: 'event', lngLat: ev.coordinates, event: ev });
        return;
      }
      case 'fg-poi': return p.onSelect({ kind: 'poi', lngLat: (f.geometry as any).coordinates, props: pr });
      case 'fg-place-label': case 'fg-place-dot': return p.onSelect({ kind: 'place', lngLat: (f.geometry as any).coordinates, props: pr });
      case 'fg-zone-buildings': return p.onSelect({ kind: 'building', lngLat: ll, props: pr, source: 'zone' });
      case 'building-3d': return p.onSelect({ kind: 'building', lngLat: ll, props: pr, source: 'tiles' });
      case 'waterway-river': case 'waterway-stream': return p.onSelect({ kind: 'river', lngLat: ll, props: pr });
      case 'fg-risk-fill': return p.onSelect({ kind: 'risk_cell', lngLat: ll, props: pr });
      default: return p.onSelect({ kind: 'road', lngLat: ll, props: pr });
    }
  }

  function nearestPlaceName(ll: LngLat): string {
    const places = propsRef.current.data.places?.features ?? [];
    let best = 'Selected area', bd = Infinity;
    for (const f of places) {
      if (!['town', 'village', 'hamlet', 'suburb'].includes(f.properties.place)) continue;
      const d = haversineKm(ll, f.geometry.coordinates);
      if (d < bd) { bd = d; best = f.properties.name; }
    }
    return best;
  }

  function renderDraw(map: MLMap, pts: LngLat[]) {
    const features: any[] = pts.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }));
    if (pts.length >= 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } });
    if (pts.length >= 3) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } });
    setData(map, 'fg-draw', { type: 'FeatureCollection', features });
  }

  function finishDraw(map: MLMap) {
    const pts = drawPts.current;
    // dblclick also fires two clicks; drop the duplicate trailing vertices
    const uniq = pts.filter((pt, i) => i === 0 || Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]) > 1e-6);
    drawPts.current = [];
    setData(map, 'fg-draw', EMPTY);
    if (uniq.length < 3) return;
    const geometry = { type: 'Polygon' as const, coordinates: [[...uniq, uniq[0]]] };
    const c = centroid(geometry);
    propsRef.current.onZoneDrawn({ id: `poly-${Date.now()}`, name: `${nearestPlaceName(c)} micro-zone`, kind: 'polygon', center: c, geometry });
  }

  // expose finishDraw via keyboard (Enter) and cancel (Escape)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const map = mapRef.current;
      if (!map || propsRef.current.interaction !== 'draw') return;
      if (ev.key === 'Enter') finishDraw(map);
      if (ev.key === 'Escape') { drawPts.current = []; setData(map, 'fg-draw', EMPTY); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    if (props.interaction === 'draw') map.doubleClickZoom.disable();
    else { map.doubleClickZoom.enable(); drawPts.current = []; setData(map, 'fg-draw', EMPTY); }
    map.getCanvas().style.cursor = props.interaction === 'select' ? '' : 'crosshair';
  }, [props.interaction, ready]);

  // ------------------------------------------------------------------ sync: theme
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    applyTheme(map, props.theme);
    if (map.getLayer('fg-mask')) map.setPaintProperty('fg-mask', 'fill-color', props.theme === 'dark' ? '#03060a' : '#f2f3ef');
    if (map.getLayer('fg-boundary-line')) map.setPaintProperty('fg-boundary-line', 'line-color', props.theme === 'dark' ? '#8ecbff' : '#1864ab');
    if (map.getLayer('fg-place-dot')) {
      map.setPaintProperty('fg-place-dot', 'circle-color', props.theme === 'dark' ? '#e9ecef' : '#212529');
      map.setPaintProperty('fg-place-dot', 'circle-stroke-color', props.theme === 'dark' ? '#212529' : '#ffffff');
    }
    map.setPaintProperty('fg-drainage', 'line-color', props.theme === 'dark' ? '#4dabf7' : '#1c7ed6');
  }, [props.theme, ready]);

  // ------------------------------------------------------------------ sync: terrain / 3D
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    if (props.layers.terrain3d && props.is3D) map.setTerrain({ source: 'terrain-dem', exaggeration: props.exaggeration });
    else map.setTerrain(null);
    // Strong exaggeration + steep pitch can put the camera inside the mountains; limit the tilt.
    const maxPitch = props.exaggeration > 2.2 ? 60 : props.exaggeration > 1.8 ? 70 : 82;
    map.setMaxPitch(maxPitch);
  }, [props.layers.terrain3d, props.is3D, props.exaggeration, ready]);

  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    if (!props.is3D) map.easeTo({ pitch: 0, duration: 900 });
    else if (map.getPitch() < 20) map.easeTo({ pitch: 60, duration: 900 });
  }, [props.is3D, ready]);

  // ------------------------------------------------------------------ sync: static data
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    const d = props.data;
    if (d.boundary) setData(map, 'fg-boundary', d.boundary);
    if (d.taluks) setData(map, 'fg-taluks', d.taluks);
    if (d.places) setData(map, 'fg-places', d.places);
    if (d.pois) setData(map, 'fg-pois', d.pois);
    setData(map, 'fg-events', {
      type: 'FeatureCollection',
      features: d.events.map((ev) => ({ type: 'Feature', properties: { id: ev.id, title: ev.title, date: ev.date, event_type: ev.event_type, short: `${ev.date.slice(0, 4)} · ${ev.title.split(' ')[0]}` }, geometry: { type: 'Point', coordinates: ev.coordinates } })),
    });
    setData(map, 'fg-cameras', {
      type: 'FeatureCollection',
      features: d.cameras.map((c) => ({ type: 'Feature', properties: { id: c.id, name: c.name, source: c.source }, geometry: { type: 'Point', coordinates: c.location } })),
    });
  }, [props.data, ready]);

  // ------------------------------------------------------------------ sync: zone / mask / label filtering
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    const z = props.zone;
    const boundaryGeom = props.data.boundary?.features[0]?.geometry;
    if (z) {
      setData(map, 'fg-zone', { type: 'Feature', properties: { name: z.name }, geometry: z.geometry });
      const [, zb, , zt] = bbox(z.geometry);
      // label anchored just inside the northern edge of the zone
      setData(map, 'fg-zone-pt', { type: 'Feature', properties: { name: z.name }, geometry: { type: 'Point', coordinates: [z.center[0], zt - (zt - zb) * 0.06] } });
      setData(map, 'fg-mask', maskPolygon(z.geometry));
      map.setPaintProperty('fg-mask', 'fill-opacity', props.theme === 'dark' ? 0.72 : 0.76);
    } else {
      setData(map, 'fg-zone', EMPTY);
      setData(map, 'fg-zone-pt', EMPTY);
      if (boundaryGeom) setData(map, 'fg-mask', maskPolygon(boundaryGeom));
      map.setPaintProperty('fg-mask', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 5.5, 0.12, 8.5, 0.62]);
    }
    // Operational-area mode: labels/POIs only inside the zone; everything else de-emphasised
    const within: any = z ? ['within', { type: 'Feature', properties: {}, geometry: z.geometry }] : null;
    const placeBase: any = ['match', ['get', 'place'], ['city', 'town'], true, 'village', ['>=', ['zoom'], 10.2], 'suburb', ['>=', ['zoom'], 11.5], ['hamlet', 'neighbourhood', 'locality'], ['>=', ['zoom'], 12.8], ['>=', ['zoom'], 14.5]];
    map.setFilter('fg-place-label', within ? ['all', within, placeBase] : placeBase);
    map.setFilter('fg-place-dot', within ? ['all', within, placeBase] : placeBase);
    map.setFilter('label-road', within);
    map.setFilter('label-waterway', within ? ['all', ['has', 'name'], within] : ['has', 'name']);
    setVis(map, 'label-context-city', !z);
    updatePoiFilter(map);
    // detail outside the zone is reduced
    map.setPaintProperty('road-minor', 'line-opacity', 1);
  }, [props.zone, props.data.boundary, props.theme, ready]);

  function updatePoiFilter(map: MLMap) {
    const p = propsRef.current;
    const cats = Object.entries(POI_LAYER_CATEGORIES).filter(([k]) => p.layers[k as keyof LayerState]).flatMap(([, v]) => v!);
    const zoomGate: any = ['match', ['get', 'category'], ...Object.entries(POI_STYLE).flatMap(([k, v]) => [k, ['>=', ['zoom'], v.minzoom]]), false];
    const f: any[] = ['all', ['in', ['get', 'category'], ['literal', cats]], zoomGate];
    if (p.zone) f.push(['within', { type: 'Feature', properties: {}, geometry: p.zone.geometry }]);
    map.setFilter('fg-poi', f as any);
  }

  // ------------------------------------------------------------------ sync: layer visibility
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    const L = props.layers;
    setVis(map, 'hillshade', L.hillshade);
    setVis(map, 'imagery', L.imagery);
    ['waterway-river', 'label-waterway'].forEach((id) => setVis(map, id, L.rivers));
    setVis(map, 'waterway-stream', L.streams);
    setVis(map, 'water', L.waterBodies);
    ['road-casing-minor', 'road-minor', 'road-major-casing', 'road-major', 'road-track', 'label-road'].forEach((id) => setVis(map, id, L.roads));
    setVis(map, 'road-bridge', L.bridges && L.roads);
    const zoneBuildingsLoaded = !!props.zoneBuildings?.features.length;
    setVis(map, 'building-3d', L.buildings && !zoneBuildingsLoaded);
    setVis(map, 'fg-zone-buildings', L.buildings);
    ['fg-place-dot', 'fg-place-label'].forEach((id) => setVis(map, id, L.settlements));
    ['fg-taluk-line', 'fg-taluk-label'].forEach((id) => setVis(map, id, L.taluks));
    setVis(map, 'fg-events', L.historical);
    setVis(map, 'fg-cameras', L.cameras);
    ['fg-risk-fill', 'fg-risk-line'].forEach((id) => setVis(map, id, L.modelRisk));
    setVis(map, 'fg-drainage', L.drainage);
    // Imagery replaces vector land cover fills for realism
    ['landcover-wood', 'landcover-grass', 'landcover-farmland', 'landcover-wetland', 'landcover-rock', 'landuse-residential'].forEach((id) => setVis(map, id, !L.imagery));
    updatePoiFilter(map);
    // weather grid
    const rainKey = L.rainPast ? 'past_24h_mm' : L.rainForecast ? 'next_24h_mm' : L.temperature ? 'temperature_c' : L.humidity ? 'humidity_pct' : null;
    setVis(map, 'fg-rain', !!rainKey && !!props.rainGrid);
    if (rainKey) {
      if (rainKey === 'temperature_c') {
        map.setPaintProperty('fg-rain', 'fill-color', ['interpolate', ['linear'], ['coalesce', ['get', rainKey], 0], 12, '#4dabf7', 18, '#8ce99a', 24, '#ffd43b', 30, '#ff922b', 36, '#e03131']);
        map.setPaintProperty('fg-rain', 'fill-opacity', 0.45);
      } else if (rainKey === 'humidity_pct') {
        map.setPaintProperty('fg-rain', 'fill-color', ['interpolate', ['linear'], ['coalesce', ['get', rainKey], 0], 40, '#fff3bf', 70, '#a5d8ff', 100, '#1864ab']);
        map.setPaintProperty('fg-rain', 'fill-opacity', 0.45);
      } else {
        map.setPaintProperty('fg-rain', 'fill-color', ['interpolate', ['linear'], ['coalesce', ['get', rainKey], 0], 0, 'rgba(0,0,0,0)', 2.5, '#a5d8ff', 15.6, '#4dabf7', 64.5, '#1971c2', 115.6, '#5f3dc4', 204.5, '#c2255c']);
        map.setPaintProperty('fg-rain', 'fill-opacity', ['case', ['<', ['coalesce', ['get', rainKey], 0], 0.1], 0, 0.55]);
      }
    }
  }, [props.layers, props.rainGrid, props.zoneBuildings, ready]);

  // ------------------------------------------------------------------ sync: district raster layers
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    for (const name of DISTRICT_LAYERS) {
      const def = props.districtLayers[name];
      const on = props.layers[name as keyof LayerState] as boolean;
      const id = `fg-dl-${name}`;
      if (def && !map.getSource(id)) {
        map.addSource(id, { type: 'image', url: def.image_url, coordinates: def.coordinates as any });
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': name === 'population' ? 0.9 : 0.72, 'raster-resampling': name === 'landcover' ? 'nearest' : 'linear', 'raster-fade-duration': 0 } }, OVERLAY_ANCHOR);
      }
      setVis(map, id, !!def && on);
    }
  }, [props.districtLayers, props.layers, ready]);

  // ------------------------------------------------------------------ sync: zone analysis overlays
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    const t = props.zoneTerrain;
    setData(map, 'fg-drainage', t?.available && t.drainage ? t.drainage : EMPTY);
    for (const key of ['slope', 'flow_accumulation', 'twi'] as const) {
      const id = `fg-zo-${key}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      if (t?.available && t.overlays) {
        map.addSource(id, { type: 'image', url: t.overlays[key], coordinates: t.overlays.coordinates as any });
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 0 } }, OVERLAY_ANCHOR);
      }
    }
    syncZoneOverlayVis(map);
  }, [props.zoneTerrain, ready]);

  function syncZoneOverlayVis(map: MLMap) {
    const L = propsRef.current.layers;
    setVis(map, 'fg-zo-slope', L.slope);
    setVis(map, 'fg-zo-flow_accumulation', L.flowAcc);
    setVis(map, 'fg-zo-twi', L.twi);
    // When zone slope exists, hide the coarser district slope inside operational mode
    if (propsRef.current.zoneTerrain?.available) setVis(map, 'fg-dl-slope', false);
  }
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (map) syncZoneOverlayVis(map);
  }, [props.layers, ready]);

  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    setData(map, 'fg-risk', props.zoneRisk?.available && props.zoneRisk.geojson ? props.zoneRisk.geojson : EMPTY);
  }, [props.zoneRisk, ready]);

  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    setData(map, 'fg-zone-buildings', props.zoneBuildings ?? EMPTY);
  }, [props.zoneBuildings, ready]);

  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map || !props.zoneBuildings) return;
    for (const f of props.zoneBuildings.features) {
      if (f.properties.exposed) map.setFeatureState({ source: 'fg-zone-buildings', id: f.id as number }, { impact: props.showImpact });
    }
  }, [props.showImpact, props.zoneBuildings, ready]);

  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    setData(map, 'fg-rain', props.rainGrid ?? EMPTY);
  }, [props.rainGrid, ready]);

  // ------------------------------------------------------------------ sync: routes
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    const routes = (props.routes ?? []).filter((r) => r.available && r.geometry);
    setData(map, 'fg-routes', {
      type: 'FeatureCollection',
      features: routes.map((r, i) => ({
        type: 'Feature', properties: { rank: i, status: r.crosses_model_high_risk === true ? 'crosses' : r.crosses_model_high_risk === false ? 'avoids' : 'unknown' }, geometry: r.geometry,
      })).reverse(),
    });
    setData(map, 'fg-route-dest', {
      type: 'FeatureCollection',
      features: routes.map((r) => ({ type: 'Feature', properties: { name: r.candidate.name ?? r.candidate.category }, geometry: { type: 'Point', coordinates: [r.candidate.lon, r.candidate.lat] } })),
    });
  }, [props.routes, ready]);

  // ------------------------------------------------------------------ selected marker
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    selectedMarker.current?.remove();
    selectedMarker.current = null;
    if (props.selected) {
      const el = document.createElement('div');
      el.className = 'fg-selected-marker';
      el.innerHTML = '<span></span><span></span><i></i>';
      selectedMarker.current = new maplibregl.Marker({ element: el }).setLngLat(props.selected).addTo(map);
    }
  }, [props.selected, ready]);

  // ------------------------------------------------------------------ runoff animation along D8 lines
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const base = props.theme === 'dark' ? '#4dabf7' : '#1c7ed6';
    if (!props.flowAnimation || !props.zoneTerrain?.available) {
      if (map.getLayer('fg-drainage')) {
        map.setPaintProperty('fg-drainage', 'line-gradient', undefined as any);
        map.setPaintProperty('fg-drainage', 'line-color', base);
      }
      return;
    }
    let last = 0;
    const tick = (ts: number) => {
      animRef.current = requestAnimationFrame(tick);
      if (ts - last < 50) return;
      last = ts;
      const t = (ts / 2600) % 1;
      const pulses = [t, (t + 1 / 3) % 1, (t + 2 / 3) % 1].sort((a, b) => a - b);
      const stops: any[] = [0, base];
      let prev = 0;
      for (const c of pulses) {
        const a = Math.max(prev + 0.001, c - 0.06);
        const b = Math.min(0.999, c);
        if (a < b && b > prev) {
          stops.push(a, base, b, '#e7f5ff');
          prev = b;
          const after = Math.min(0.9995, b + 0.01);
          if (after > prev) { stops.push(after, base); prev = after; }
        }
      }
      stops.push(1, base);
      try {
        map.setPaintProperty('fg-drainage', 'line-gradient', ['interpolate', ['linear'], ['line-progress'], ...stops] as any);
      } catch { /* skip malformed frame */ }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [props.flowAnimation, props.zoneTerrain, props.theme, ready]);

  // ------------------------------------------------------------------ sync: signs, alerts, reports, user, simulation
  useEffect(() => { const map = liveMap(mapRef, readyRef); if (map) setGeo(map, 'fg-signs', props.signs); }, [props.signs, ready]);
  useEffect(() => { const map = liveMap(mapRef, readyRef); if (map) setGeo(map, 'fg-live-alerts', props.liveAlerts); }, [props.liveAlerts, ready]);
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    setGeo(map, 'fg-reports', props.reports);
    ['fg-report-cluster', 'fg-report-cluster-label', 'fg-report-point', 'fg-report-label'].forEach((id) => setVis(map, id, !!props.reports));
  }, [props.reports, ready]);
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    setGeo(map, 'fg-rescue', props.rescue ?? null);
    setGeo(map, 'fg-rescue-route', props.rescueRoute ?? null);
    setGeo(map, 'fg-safe', props.safeLocations ?? null);
  }, [props.rescue, props.rescueRoute, props.safeLocations, ready]);
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (map) setGeo(map, 'fg-user', props.userLocation ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: props.userLocation } } : null);
  }, [props.userLocation, ready]);
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (!map) return;
    const s = props.sim;
    setImageOverlay(map, 'fg-sim-depth', s?.depthUrl ?? null, s?.depthCoords ?? null, 0.9);
    setImageOverlay(map, 'fg-sim-fs', s?.fsUrl ?? null, s?.fsCoords ?? null, 0.75, 'fg-sim-unstable');
    setGeo(map, 'fg-sim-unstable', s?.unstable ?? null);
    setGeo(map, 'fg-sim-debris', s?.debris ?? null);
    setGeo(map, 'fg-zone-roads', s?.roads ?? null);
    if (s?.debris) setDebrisProgress(map, s.debrisProgress);
  }, [props.sim, ready]);
  useEffect(() => {
    const map = liveMap(mapRef, readyRef);
    if (map) setVis(map, 'waterway-flow', props.layers.rivers || props.layers.streams);
  }, [props.layers.rivers, props.layers.streams, ready]);

  return <div ref={container} className="absolute inset-0" />;
});
