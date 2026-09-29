// Additional FloodGuard map layers: floating signs, waterway flow, simulation, live alerts, reports.
import type { Map as MLMap, GeoJSONSource, ImageSource } from 'maplibre-gl';
import type { FeatureCollection } from '../../types/geo';

export const SIGN_COLORS: Record<string, string> = {
  green: '#2f9e44', yellow: '#f5b700', orange: '#f76707', red: '#e03131', blue: '#1971c2', purple: '#7048e8', slate: '#495057', cyan: '#0c8599',
};
export const LEVEL_COLOR: Record<string, keyof typeof SIGN_COLORS> = {
  VERY_LOW: 'green', LOW: 'green', MODERATE: 'yellow', HIGH: 'orange', CRITICAL: 'red',
  INFO: 'blue', WATCH: 'yellow', WARNING: 'orange',
  NONE: 'green', SIGNIFICANT: 'orange', EXTREME: 'red',
};

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Stretchable rounded badge with a bottom pointer (content area stretches with the text). */
function signImage(color: string): ImageData {
  const W = 64, H = 76, R = 12, P = 12; // P = pointer height (image px, pixelRatio 2)
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  c.fillStyle = 'rgba(8,12,18,0.88)';
  c.strokeStyle = color;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(R, 2); c.lineTo(W - R, 2); c.quadraticCurveTo(W - 2, 2, W - 2, R);
  c.lineTo(W - 2, H - P - R); c.quadraticCurveTo(W - 2, H - P, W - R, H - P);
  c.lineTo(W / 2 + 8, H - P); c.lineTo(W / 2, H - 2); c.lineTo(W / 2 - 8, H - P);
  c.lineTo(R, H - P); c.quadraticCurveTo(2, H - P, 2, H - P - R);
  c.lineTo(2, R); c.quadraticCurveTo(2, 2, R, 2);
  c.closePath();
  c.fill(); c.stroke();
  c.fillStyle = color;
  c.fillRect(6, 6, 6, H - P - 12); // severity bar on the left edge
  return c.getImageData(0, 0, W, H);
}

export function registerSignImages(map: MLMap) {
  for (const [name, color] of Object.entries(SIGN_COLORS)) {
    const id = `sign-${name}`;
    if (map.hasImage(id)) continue;
    map.addImage(id, signImage(color), {
      pixelRatio: 2,
      stretchX: [[20, 44]],
      stretchY: [[20, 40]],
      content: [16, 10, 56, 54],
    });
  }
}

export function addExtraLayers(map: MLMap) {
  registerSignImages(map);
  const src = (id: string, extra: Record<string, any> = {}) => {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY, ...extra });
  };
  ['fg-signs', 'fg-sim-unstable', 'fg-zone-roads', 'fg-live-alerts', 'fg-user', 'fg-safe', 'fg-rescue', 'fg-rescue-route'].forEach((id) => src(id));
  src('fg-sim-debris', { lineMetrics: true });
  src('fg-reports', { cluster: true, clusterRadius: 46, clusterMaxZoom: 15, clusterProperties: {
    people: ['+', ['get', 'people_count']],
    critical: ['+', ['case', ['==', ['get', 'severity'], 'critical'], 1, 0]],
  } });

  // Waterway flow: OSM waterways are drawn in the downstream direction, so dashes move with the flow.
  if (!map.getLayer('waterway-flow')) {
    map.addLayer({
      id: 'waterway-flow', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 10,
      filter: ['in', ['get', 'class'], ['literal', ['river', 'stream', 'canal']]],
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': '#e7f5ff', 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 1.4, 17, 2.6], 'line-dasharray': [0, 4, 3] },
    }, 'road-casing-minor');
  }

  // Live responder alerts (FloodGuard-issued)
  map.addLayer({
    id: 'fg-live-alert-fill', type: 'fill', source: 'fg-live-alerts',
    paint: { 'fill-color': ['match', ['get', 'level'], 'CRITICAL', '#e03131', 'WARNING', '#f76707', 'WATCH', '#f5b700', '#1971c2'], 'fill-opacity': 0.16 },
  }, 'building-3d');
  map.addLayer({
    id: 'fg-live-alert-line', type: 'line', source: 'fg-live-alerts',
    paint: { 'line-color': ['match', ['get', 'level'], 'CRITICAL', '#e03131', 'WARNING', '#f76707', 'WATCH', '#f5b700', '#1971c2'], 'line-width': 3, 'line-dasharray': [2, 1.2] },
  });

  // Simulation: landslide failure areas + debris runout
  map.addLayer({ id: 'fg-sim-unstable', type: 'fill', source: 'fg-sim-unstable', paint: { 'fill-color': '#862e1c', 'fill-opacity': 0.55 } }, 'building-3d');
  map.addLayer({
    id: 'fg-sim-debris', type: 'line', source: 'fg-sim-debris', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#8d5524', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 15, 7], 'line-opacity': 0.9 },
  }, 'building-3d');

  // Roads affected in the simulation (only affected segments are drawn)
  map.addLayer({
    id: 'fg-zone-roads', type: 'line', source: 'fg-zone-roads', layout: { 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get', 'state'], 'blocked', '#c92a2a', 'impassable', '#f76707', 'rgba(0,0,0,0)'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 8],
      'line-dasharray': [1.5, 0.8],
    },
  });

  // Citizen reports (responders only) — clustered
  map.addLayer({
    id: 'fg-report-cluster', type: 'circle', source: 'fg-reports', filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['case', ['>', ['get', 'critical'], 0], '#e03131', '#f76707'],
      'circle-radius': ['interpolate', ['linear'], ['get', 'people'], 1, 14, 20, 20, 100, 28],
      'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5, 'circle-opacity': 0.92,
    },
  });
  map.addLayer({
    id: 'fg-report-cluster-label', type: 'symbol', source: 'fg-reports', filter: ['has', 'point_count'],
    layout: { 'text-field': ['concat', ['to-string', ['get', 'people']], ' 👥'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true },
    paint: { 'text-color': '#fff' },
  });
  map.addLayer({
    id: 'fg-report-point', type: 'circle', source: 'fg-reports', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['match', ['get', 'severity'], 'critical', '#e03131', 'warning', '#f76707', 'watch', '#f5b700', '#2f9e44'],
      'circle-radius': 9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5,
    },
  });
  map.addLayer({
    id: 'fg-report-label', type: 'symbol', source: 'fg-reports', filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['concat', ['to-string', ['get', 'people_count']], ' PEOPLE\n', ['get', 'label']],
      'text-font': ['Noto Sans Bold'], 'text-size': 10.5, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-allow-overlap': false,
    },
    paint: { 'text-color': '#c92a2a', 'text-halo-color': '#fff', 'text-halo-width': 1.6 },
  });

  // Designated safe locations (public)
  map.addLayer({
    id: 'fg-safe-dot', type: 'circle', source: 'fg-safe',
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 10], 'circle-color': '#2f9e44', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 },
  });
  map.addLayer({
    id: 'fg-safe-label', type: 'symbol', source: 'fg-safe', minzoom: 10,
    layout: { 'text-field': ['concat', '✚ SAFE: ', ['get', 'name'], ['case', ['get', 'is_demo'], ' (DEMO)', '']], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top' },
    paint: { 'text-color': '#1b5e20', 'text-halo-color': '#fff', 'text-halo-width': 1.8 },
  });

  // Rescue people (responders only): route of the selected person, then status-coloured markers
  map.addLayer({ id: 'fg-rescue-route-casing', type: 'line', source: 'fg-rescue-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 8 } });
  map.addLayer({
    id: 'fg-rescue-route', type: 'line', source: 'fg-rescue-route', filter: ['!', ['get', 'unavailable']], layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#e8590c', 'line-width': 4.5 },
  });
  // routing unavailable: straight line to the destination, dashed grey (explicitly NOT a route)
  map.addLayer({
    id: 'fg-rescue-route-none', type: 'line', source: 'fg-rescue-route', filter: ['get', 'unavailable'],
    paint: { 'line-color': '#868e96', 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
  });
  map.addLayer({
    id: 'fg-rescue-halo', type: 'circle', source: 'fg-rescue', filter: ['==', ['get', 'tone'], 'red'],
    paint: { 'circle-radius': 22, 'circle-color': '#e03131', 'circle-opacity': 0.22, 'circle-blur': 0.4 },
  });
  map.addLayer({
    id: 'fg-rescue-point', type: 'circle', source: 'fg-rescue',
    paint: {
      'circle-color': ['match', ['get', 'tone'], 'red', '#e03131', 'orange', '#f76707', 'yellow', '#f5b700', 'green', '#2f9e44', '#868e96'],
      'circle-radius': ['interpolate', ['linear'], ['get', 'people_count'], 1, 10, 5, 13, 20, 17],
      'circle-stroke-color': '#fff', 'circle-stroke-width': 3,
    },
  });
  map.addLayer({
    id: 'fg-rescue-count', type: 'symbol', source: 'fg-rescue',
    layout: { 'text-field': ['to-string', ['get', 'people_count']], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': '#fff' },
  });
  map.addLayer({
    id: 'fg-rescue-label', type: 'symbol', source: 'fg-rescue',
    layout: {
      'text-field': ['concat', ['to-string', ['get', 'people_count']], ['case', ['==', ['get', 'people_count'], 1], ' PERSON\n', ' PEOPLE\n'], ['get', 'label']],
      'text-font': ['Noto Sans Bold'], 'text-size': 10.5, 'text-offset': [0, 1.6], 'text-anchor': 'top',
    },
    paint: {
      'text-color': ['match', ['get', 'tone'], 'red', '#c92a2a', 'orange', '#d9480f', 'yellow', '#8a6d00', 'green', '#2b8a3e', '#495057'],
      'text-halo-color': '#fff', 'text-halo-width': 1.8,
    },
  });

  // Citizen's own shared location
  map.addLayer({ id: 'fg-user-halo', type: 'circle', source: 'fg-user', paint: { 'circle-radius': 16, 'circle-color': '#1c7ed6', 'circle-opacity': 0.2 } });
  map.addLayer({ id: 'fg-user-dot', type: 'circle', source: 'fg-user', paint: { 'circle-radius': 6, 'circle-color': '#1c7ed6', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });

  // Floating geographic signs (risk %, water depth, people, road, landslide, rain)
  map.addLayer({
    id: 'fg-sign-anchor', type: 'circle', source: 'fg-signs', filter: signZoomFilter(),
    paint: { 'circle-radius': 3.5, 'circle-color': ['get', 'color_hex'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
  });
  map.addLayer({
    id: 'fg-signs', type: 'symbol', source: 'fg-signs', filter: signZoomFilter(),
    layout: {
      'icon-image': ['concat', 'sign-', ['get', 'color']],
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [3, 6, 3, 9],
      'icon-anchor': 'bottom',
      'text-anchor': 'bottom',
      'text-offset': [0, -1.1],
      'text-field': ['format',
        ['get', 'title'], { 'font-scale': 0.72, 'text-font': ['literal', ['Noto Sans Bold']] },
        '\n', {},
        ['get', 'value'], { 'font-scale': 1.3, 'text-font': ['literal', ['Noto Sans Bold']] },
        '\n', {},
        ['get', 'sub'], { 'font-scale': 0.68 },
      ],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-justify': 'left',
      'text-line-height': 1.15,
      'symbol-sort-key': ['get', 'priority'],
      'icon-allow-overlap': false,
      'text-allow-overlap': false,
      'symbol-z-order': 'source',
    },
    paint: { 'text-color': '#ffffff' },
  });
}

function signZoomFilter(): any {
  return ['any', ['==', ['get', 'priority'], 0], ['all', ['==', ['get', 'priority'], 1], ['>=', ['zoom'], 10.5]], ['all', ['>=', ['get', 'priority'], 2], ['>=', ['zoom'], 13]]];
}

export function setGeo(map: MLMap, id: string, data: any) {
  const s = map.getSource(id) as GeoJSONSource | undefined;
  if (s) s.setData(data ?? EMPTY);
}

/** Image overlay that can be updated in place (simulation depth frames, FS raster). */
export function setImageOverlay(map: MLMap, id: string, url: string | null, coords: number[][] | null, opacity = 0.85, before = 'building-3d') {
  const s = map.getSource(id) as ImageSource | undefined;
  if (!url || !coords) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    return;
  }
  if (!s) {
    map.addSource(id, { type: 'image', url, coordinates: coords as any });
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, map.getLayer(before) ? before : undefined);
  } else {
    s.updateImage({ url, coordinates: coords as any });
    map.setLayoutProperty(id, 'visibility', 'visible');
  }
}

// MapLibre "animate a line" dash sequence — shifts the dash pattern along the line direction.
const DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

export function startWaterFlow(map: MLMap): () => void {
  let step = 0;
  let last = 0;
  let raf = 0;
  const tick = (ts: number) => {
    raf = requestAnimationFrame(tick);
    if (ts - last < 90) return;
    last = ts;
    step = (step + 1) % DASH_SEQ.length;
    if (map.getLayer('waterway-flow') && map.getLayoutProperty('waterway-flow', 'visibility') !== 'none') {
      map.setPaintProperty('waterway-flow', 'line-dasharray', DASH_SEQ[step]);
    }
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** Reveal debris paths progressively (0..1) along their length. */
export function setDebrisProgress(map: MLMap, p: number) {
  if (!map.getLayer('fg-sim-debris')) return;
  const q = Math.max(0.001, Math.min(0.999, p));
  map.setPaintProperty('fg-sim-debris', 'line-gradient', ['interpolate', ['linear'], ['line-progress'],
    0, '#5c3a1a', q, '#a0522d', Math.min(0.9999, q + 0.0005), 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)'] as any);
}
