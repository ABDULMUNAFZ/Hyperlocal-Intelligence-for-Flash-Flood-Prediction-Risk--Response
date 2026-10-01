// 2D fallback map for browsers without WebGL (hardware acceleration off, GPU blocklisted, remote desktop…).
// Leaflet draws with Canvas 2D, so it works everywhere. It shows the same operational data as the 3D map
// (risk signs, live alerts, rescue requests, safe locations, routes, zones, simulation depth) and keeps
// selection, radius and polygon zone tools working, so the command center stays usable.
// Loaded lazily — browsers with WebGL never download it.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { WayanadMapHandle, WayanadMapProps } from './WayanadMap';
import { bbox, centroid, circlePolygon, haversineKm } from './geo';
import { JOURNEY, RISK_COLORS } from './constants';
import type { LngLat, Selection } from '../../types/geo';

type Props = WayanadMapProps & { reason: string };

// MapLibre zoom levels are for 512 px tiles; Leaflet uses 256 px tiles (one level higher for the same scale).
const toL = (z: number) => z + 1;
const fromL = (z: number) => z - 1;
const ll = (c: LngLat): L.LatLngExpression => [c[1], c[0]];

const ALERT_COLOR: Record<string, string> = { CRITICAL: '#e03131', WARNING: '#f76707', WATCH: '#f5b700' };
const TONE_COLOR: Record<string, string> = { red: '#e03131', orange: '#f76707', yellow: '#f5b700', green: '#2f9e44' };
const REPORT_COLOR: Record<string, string> = { critical: '#e03131', warning: '#f76707', watch: '#f5b700' };

const STYLE_ID = 'fg-lite-style';
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    .fg-lite-dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6); }
    .fg-lite .leaflet-container { font: inherit; }
    .fg-lite-tip { font-size: 11px; font-weight: 600; }`;
  document.head.appendChild(s);
}

const LiteMap = forwardRef<WayanadMapHandle, Props>(function LiteMap(props, ref) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const layers = useRef<Record<string, L.Layer | undefined>>({});
  const featureHit = useRef<Selection | null>(null);
  const drawPts = useRef<LngLat[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(true);
  const [help, setHelp] = useState(false);

  /** Replace a named overlay. */
  const put = (name: string, layer: L.Layer | null) => {
    const map = mapRef.current;
    if (!map) return;
    layers.current[name]?.remove();
    layers.current[name] = layer ?? undefined;
    layer?.addTo(map);
  };

  /** Clicking a feature records what was hit; the map click handler then decides what to do with it. */
  const pick = (layer: L.Layer, sel: () => Selection | null) => layer.on('click', () => { featureHit.current = sel(); });

  useImperativeHandle(ref, () => ({
    flyToView: (v, duration = 4500) => mapRef.current?.flyTo(ll(v.center), toL(v.zoom), { duration: Math.min(3, duration / 1000) }),
    fitGeometry: (geometry, opts = {}) => {
      const [a, b, c, d] = bbox(geometry);
      if (!Number.isFinite(a)) return;
      const pad = Math.min(opts.padding ?? 60, 60);
      mapRef.current?.flyToBounds([[b, a], [d, c]], { padding: [pad, pad], maxZoom: 17, duration: 1.5 });
    },
    easeTo: (o) => {
      const map = mapRef.current;
      if (!map || (o.center === undefined && o.zoom === undefined)) return;
      const c = o.center ? L.latLng((o.center as any)[1] ?? (o.center as any).lat, (o.center as any)[0] ?? (o.center as any).lng) : map.getCenter();
      map.flyTo(c, o.zoom !== undefined ? toL(o.zoom) : map.getZoom(), { duration: 1 });
    },
    zoomBy: (d) => mapRef.current?.setZoom(mapRef.current.getZoom() + d),
    resetNorth: () => undefined, // 2D map is always north-up
    getMap: () => null,
  }));

  // ------------------------------------------------------------------ init
  useEffect(() => {
    if (!box.current || mapRef.current) return;
    injectStyle();
    const start = JOURNEY[0];
    const map = L.map(box.current, {
      center: ll(start.center), zoom: toL(start.zoom), minZoom: 5, maxZoom: 19,
      maxBounds: [[3, 66], [38.5, 99]], preferCanvas: true, zoomControl: false, worldCopyJump: false,
    });
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.createPane('fg-areas').style.zIndex = '405';
    map.createPane('fg-lines').style.zIndex = '415';
    map.createPane('fg-points').style.zIndex = '425';

    const emitMove = () => {
      const c = map.getCenter();
      propsRef.current.onMove({ center: [c.lng, c.lat], zoom: fromL(map.getZoom()), pitch: 0, bearing: 0 });
    };
    map.on('moveend', emitMove);
    map.on('click', (e: L.LeafletMouseEvent) => {
      const p = propsRef.current;
      const at: LngLat = [e.latlng.lng, e.latlng.lat];
      const hit = featureHit.current;
      featureHit.current = null;
      if (p.interaction === 'draw') {
        drawPts.current.push(at);
        renderDraw();
        return;
      }
      if (p.interaction === 'radius') {
        p.onZoneDrawn({ id: `radius-${Date.now()}`, name: `${nearestPlaceName(at)} (${p.radiusKm} km)`, kind: 'radius', center: at, radius_km: p.radiusKm, geometry: circlePolygon(at, p.radiusKm) as any });
        return;
      }
      p.onSelect(hit ?? { kind: 'location', lngLat: at });
    });
    map.on('dblclick', () => { if (propsRef.current.interaction === 'draw') finishDraw(); });

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(box.current);
    emitMove();
    setReady(true);
    const t = window.setTimeout(() => propsRef.current.onReady(), 0);
    return () => { window.clearTimeout(t); ro.disconnect(); map.remove(); mapRef.current = null; layers.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nearestPlaceName(at: LngLat): string {
    let best = 'Selected area', bd = Infinity;
    for (const f of propsRef.current.data.places?.features ?? []) {
      if (!['town', 'village', 'hamlet', 'suburb'].includes(f.properties.place)) continue;
      const d = haversineKm(at, f.geometry.coordinates);
      if (d < bd) { bd = d; best = f.properties.name; }
    }
    return best;
  }

  function renderDraw() {
    const pts = drawPts.current;
    if (!pts.length) return put('draw', null);
    const g = L.layerGroup();
    pts.forEach((p) => L.circleMarker(ll(p), { pane: 'fg-points', radius: 5, color: '#fff', weight: 2, fillColor: '#e03131', fillOpacity: 1 }).addTo(g));
    if (pts.length >= 2) L.polygon(pts.map(ll), { pane: 'fg-lines', color: '#e03131', weight: 2, dashArray: '6 4', fillOpacity: pts.length >= 3 ? 0.12 : 0 }).addTo(g);
    put('draw', g);
  }

  function finishDraw() {
    const pts = drawPts.current;
    const uniq = pts.filter((pt, i) => i === 0 || Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]) > 1e-6);
    drawPts.current = [];
    put('draw', null);
    if (uniq.length < 3) return;
    const geometry = { type: 'Polygon' as const, coordinates: [[...uniq, uniq[0]]] };
    const c = centroid(geometry);
    propsRef.current.onZoneDrawn({ id: `poly-${Date.now()}`, name: `${nearestPlaceName(c)} micro-zone`, kind: 'polygon', center: c, geometry });
  }

  // draw mode: Enter finishes, Escape cancels; no double-click zoom while drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (props.interaction === 'draw') map.doubleClickZoom.disable();
    else { map.doubleClickZoom.enable(); drawPts.current = []; put('draw', null); }
    const onKey = (ev: KeyboardEvent) => {
      if (propsRef.current.interaction !== 'draw') return;
      if (ev.key === 'Enter') finishDraw();
      if (ev.key === 'Escape') { drawPts.current = []; put('draw', null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.interaction, ready]);

  // theme: darken the base tiles
  useEffect(() => { box.current?.classList.toggle('fg-lite-dark', props.theme === 'dark'); }, [props.theme]);

  // ------------------------------------------------------------------ overlays
  useEffect(() => {
    if (!ready) return;
    const { boundary, taluks } = props.data;
    const g = L.layerGroup();
    if (props.layers.taluks && taluks) L.geoJSON(taluks as any, { pane: 'fg-lines', interactive: false, style: { color: '#495057', weight: 1, dashArray: '4 4', fill: false } }).addTo(g);
    if (boundary) L.geoJSON(boundary as any, { pane: 'fg-lines', interactive: false, style: { color: '#1c7ed6', weight: 2.5, fill: false } }).addTo(g);
    put('boundary', g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.data.boundary, props.data.taluks, props.layers.taluks]);

  useEffect(() => {
    if (!ready) return;
    put('zone', props.zone ? L.geoJSON(props.zone.geometry as any, { pane: 'fg-areas', interactive: false, style: { color: '#e03131', weight: 2.5, fillColor: '#e03131', fillOpacity: 0.06 } }) : null);
  }, [ready, props.zone]);

  useEffect(() => {
    if (!ready) return;
    const fc = props.layers.modelRisk && props.zoneRisk?.available ? props.zoneRisk.geojson : null;
    put('risk', fc ? L.geoJSON(fc as any, {
      pane: 'fg-areas',
      style: (f) => ({ stroke: false, fillColor: RISK_COLORS[f?.properties?.risk_level] ?? '#868e96', fillOpacity: 0.45 }),
      onEachFeature: (f, layer) => pick(layer, () => ({ kind: 'risk_cell', lngLat: f.properties.center, props: { ...f.properties } })),
    }) : null);
  }, [ready, props.zoneRisk, props.layers.modelRisk]);

  useEffect(() => {
    if (!ready) return;
    const s = props.sim;
    const g = L.layerGroup();
    const corners = (coords: number[][]): L.LatLngBoundsExpression => {
      const xs = coords.map((c) => c[0]), ys = coords.map((c) => c[1]);
      return [[Math.min(...ys), Math.min(...xs)], [Math.max(...ys), Math.max(...xs)]];
    };
    if (s?.depthUrl && s.depthCoords) L.imageOverlay(s.depthUrl, corners(s.depthCoords), { pane: 'fg-areas', opacity: 0.8 }).addTo(g);
    if (s?.fsUrl && s.fsCoords) L.imageOverlay(s.fsUrl, corners(s.fsCoords), { pane: 'fg-areas', opacity: 0.6 }).addTo(g);
    if (s?.unstable) L.geoJSON(s.unstable as any, { pane: 'fg-areas', interactive: false, style: { stroke: false, fillColor: '#862e1c', fillOpacity: 0.55 } }).addTo(g);
    if (s?.debris) L.geoJSON(s.debris as any, { pane: 'fg-lines', interactive: false, style: { color: '#8d5524', weight: 4, opacity: 0.9 } }).addTo(g);
    if (s?.roads) L.geoJSON(s.roads as any, {
      pane: 'fg-lines', interactive: false,
      filter: (f) => ['blocked', 'impassable'].includes(f.properties?.state),
      style: (f) => ({ color: f?.properties?.state === 'blocked' ? '#c92a2a' : '#f76707', weight: 4 }),
    }).addTo(g);
    put('sim', g);
  }, [ready, props.sim]);

  useEffect(() => {
    if (!ready) return;
    put('alerts', props.liveAlerts ? L.geoJSON(props.liveAlerts as any, {
      pane: 'fg-areas',
      style: (f) => { const c = ALERT_COLOR[f?.properties?.level] ?? '#1971c2'; return { color: c, weight: 3, dashArray: '8 5', fillColor: c, fillOpacity: 0.16 }; },
      onEachFeature: (f, layer) => {
        if (f.properties?.title) layer.bindTooltip(String(f.properties.title), { sticky: true, className: 'fg-lite-tip' });
        pick(layer, () => ({ kind: 'live_alert', lngLat: centroid(f.geometry as any), props: { ...f.properties } }));
      },
    }) : null);
  }, [ready, props.liveAlerts]);

  useEffect(() => {
    if (!ready) return;
    const g = L.layerGroup();
    (props.routes ?? []).forEach((r) => {
      if (!r.available || !r.geometry) return;
      L.polyline(r.geometry.coordinates.map(ll), { pane: 'fg-lines', color: '#fff', weight: 9, interactive: false }).addTo(g);
      L.polyline(r.geometry.coordinates.map(ll), { pane: 'fg-lines', color: r.crosses_model_high_risk ? '#f76707' : '#1971c2', weight: 5 })
        .bindTooltip(`${r.candidate.name ?? 'Destination'} · ${r.distance_km?.toFixed(1) ?? '—'} km`, { sticky: true, className: 'fg-lite-tip' }).addTo(g);
      L.circleMarker(ll([r.candidate.lon, r.candidate.lat]), { pane: 'fg-points', radius: 7, color: '#fff', weight: 2.5, fillColor: '#1971c2', fillOpacity: 1 }).addTo(g);
    });
    const rr = props.rescueRoute;
    if (rr) L.geoJSON(rr as any, {
      pane: 'fg-lines', interactive: false,
      style: (f) => (f?.properties?.unavailable ? { color: '#868e96', weight: 3, dashArray: '5 5' } : { color: '#e8590c', weight: 5 }),
    }).addTo(g);
    put('routes', g);
  }, [ready, props.routes, props.rescueRoute]);

  useEffect(() => {
    if (!ready) return;
    const g = L.layerGroup();
    const p = props;
    const dot = (c: LngLat, color: string, r: number, tip: string, sel: () => Selection | null) => {
      const m = L.circleMarker(ll(c), { pane: 'fg-points', radius: r, color: '#fff', weight: 2.5, fillColor: color, fillOpacity: 1 });
      if (tip) m.bindTooltip(tip, { className: 'fg-lite-tip' });
      pick(m, sel);
      m.addTo(g);
    };
    if (p.layers.historical) p.data.events.forEach((ev) => dot(ev.coordinates, '#5f3dc4', 6, ev.title, () => ({ kind: 'event', lngLat: ev.coordinates, event: ev })));
    if (p.layers.cameras) p.data.cameras.forEach((cam) => dot(cam.location, '#343a40', 5, `Camera · ${cam.name}`, () => ({ kind: 'camera', camera: cam })));
    (p.signs?.features ?? []).forEach((f: any) => dot(f.geometry.coordinates, f.properties.color_hex ?? '#f76707', 7, `${f.properties.title ?? ''} · ${f.properties.value ?? ''}`,
      () => ({ kind: 'sign', lngLat: f.geometry.coordinates, props: { ...f.properties } })));
    (p.reports?.features ?? []).forEach((f: any) => dot(f.geometry.coordinates, REPORT_COLOR[f.properties.severity] ?? '#2f9e44', 8, `${f.properties.people_count ?? ''} people · ${f.properties.label ?? 'Report'}`,
      () => ({ kind: 'report', lngLat: f.geometry.coordinates, props: { ...f.properties } })));
    (p.safeLocations?.features ?? []).forEach((f: any) => dot(f.geometry.coordinates, '#2f9e44', 8, `Safe location · ${f.properties.name ?? ''}`,
      () => ({ kind: 'safe_location', lngLat: f.geometry.coordinates, props: { ...f.properties } })));
    (p.rescue?.features ?? []).forEach((f: any) => dot(f.geometry.coordinates, TONE_COLOR[f.properties.tone] ?? '#868e96', 9,
      `${f.properties.people_count ?? ''} ${f.properties.people_count === 1 ? 'person' : 'people'} · ${f.properties.label ?? ''}`,
      () => ({ kind: 'rescue', lngLat: f.geometry.coordinates, props: { ...f.properties } })));
    if (p.userLocation) L.circleMarker(ll(p.userLocation), { pane: 'fg-points', radius: 7, color: '#fff', weight: 3, fillColor: '#1c7ed6', fillOpacity: 1, interactive: false }).addTo(g);
    if (p.selected) L.circleMarker(ll(p.selected), { pane: 'fg-points', radius: 9, color: '#212529', weight: 3, fill: false, interactive: false }).addTo(g);
    put('points', g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.signs, props.reports, props.safeLocations, props.rescue, props.userLocation, props.selected, props.data.events, props.data.cameras, props.layers.historical, props.layers.cameras]);

  return (
    <>
      <div ref={box} className="fg-lite absolute inset-0" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      {notice && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[104px] z-30 w-[min(380px,calc(100vw-16px))] rounded-xl bg-amber-50/95 p-3 text-[11.5px] text-amber-950 shadow-xl ring-1 ring-amber-300 max-md:bottom-16">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-[10px] font-extrabold tracking-[0.18em]">2D MAP MODE</div>
              <div className="mt-1">This browser has 3D graphics (WebGL) turned off, so FloodGuard is showing a 2D map. All data, alerts and rescue tools still work.</div>
            </div>
            <button onClick={() => setNotice(false)} className="rounded px-1.5 text-[13px] font-bold hover:bg-amber-200" aria-label="Dismiss">×</button>
          </div>
          {help ? (
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li><b>Chrome / Edge:</b> Settings → System → turn on <i>Use graphics acceleration when available</i> → Relaunch.</li>
              <li>Open <code>chrome://gpu</code> (or <code>edge://gpu</code>): <i>WebGL</i> should say <i>Hardware accelerated</i>.</li>
              <li>Still disabled? Update the graphics driver, or try Firefox.</li>
              <li>Remote Desktop / virtual machines often have no GPU — open FloodGuard on the laptop directly.</li>
            </ol>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button onClick={() => setHelp((v) => !v)} className="rounded-md bg-amber-200 px-2 py-1 text-[10.5px] font-bold hover:bg-amber-300">{help ? 'Hide steps' : 'How to enable 3D'}</button>
            <button onClick={() => location.reload()} className="rounded-md bg-amber-900 px-2 py-1 text-[10.5px] font-bold text-white hover:bg-amber-950">Try 3D again</button>
          </div>
          <div className="mt-1.5 truncate text-[9.5px] text-amber-800/80" title={props.reason}>Reason: {props.reason}</div>
        </div>
      )}
    </>
  );
});

export default LiteMap;
