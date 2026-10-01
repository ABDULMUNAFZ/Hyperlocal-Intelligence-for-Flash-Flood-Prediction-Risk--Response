// Active evacuation journey: real route (or ROUTING DATA UNAVAILABLE), live device position while open, REACHED HERE.
import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type * as Leaflet from 'leaflet';
import { buildStyle } from '../components/Wayanad/mapStyle';
import { detectWebGL } from '../components/Wayanad/webgl';
import { emergencyApi, apiError, type MeDTO, type RescueRequestDTO } from './api';
import { bearing, compass, distanceM, fmtDistance, getFix, watchFix, type DeviceFix, ago } from './device';
import { BigButton, ErrorNote, InfoNote } from './ui';

const POST_EVERY_MS = 15000;
const POST_EVERY_M = 25;
const WALK_MPS = 1.2; // fallback walking speed when no routed duration exists (labelled as an estimate)

export function Journey({ me, r, onUpdate, onRescue }: { me: MeDTO; r: RescueRequestDTO; onUpdate: (r: RescueRequestDTO) => void; onRescue: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  // 2D fallback (Leaflet, canvas) when this device has no WebGL
  const [lite, setLite] = useState(() => !detectWebGL().ok);
  const liteMap = useRef<{ map: Leaflet.Map; me: Leaflet.CircleMarker; acc: Leaflet.Circle } | null>(null);
  const [liteReady, setLiteReady] = useState(false);
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [reachBusy, setReachBusy] = useState(false);
  const [reachErr, setReachErr] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const lastPost = useRef<{ t: number; ll: [number, number] } | null>(null);
  const dest = r.safe_location!;
  const destLL: [number, number] = [dest.lon, dest.lat];
  const route = r.journey.route;
  const routeOk = !!route?.geometry;

  // map
  useEffect(() => {
    if (!box.current) return;
    const start = r.journey.start ?? [r.location.longitude, r.location.latitude];
    if (lite) {
      let gone = false;
      let lm: Leaflet.Map | null = null;
      Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
        if (gone || !box.current) return;
        const L = mod.default;
        lm = L.map(box.current, { zoomControl: true, preferCanvas: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(lm);
        const line: [number, number][] = routeOk ? route!.geometry!.coordinates.map((c) => [c[1], c[0]] as [number, number]) : [];
        if (line.length) {
          L.polyline(line, { color: '#fff', weight: 9 }).addTo(lm);
          L.polyline(line, { color: '#1971c2', weight: 5.5 }).addTo(lm);
        }
        L.circleMarker([destLL[1], destLL[0]], { radius: 11, color: '#fff', weight: 3, fillColor: '#2f9e44', fillOpacity: 1 })
          .bindTooltip(`SAFE: ${dest.name}`, { permanent: true, direction: 'top', offset: [0, -12] }).addTo(lm);
        const acc = L.circle([start[1], start[0]], { radius: 0, stroke: false, fillColor: '#1c7ed6', fillOpacity: 0.15 }).addTo(lm);
        const me = L.circleMarker([start[1], start[0]], { radius: 8, color: '#fff', weight: 3, fillColor: '#1c7ed6', fillOpacity: 0 }).addTo(lm);
        lm.fitBounds(L.latLngBounds([[start[1], start[0]], [destLL[1], destLL[0]], ...line]), { padding: [40, 40], maxZoom: 17 });
        lm.on('dragstart', () => setFollow(false));
        liteMap.current = { map: lm, me, acc };
        setLiteReady(true); // re-applies the latest GPS fix
      });
      return () => { gone = true; lm?.remove(); liteMap.current = null; setLiteReady(false); };
    }
    let m: MLMap;
    try {
      m = new maplibregl.Map({ container: box.current, style: buildStyle('light'), center: start, zoom: 14, attributionControl: { compact: true } });
    } catch (err) {
      console.warn('FloodGuard: WebGL map unavailable, using 2D map', err);
      setLite(true);
      return;
    }
    map.current = m;
    m.on('load', () => {
      m.setTerrain(null as any);
      m.addSource('route', { type: 'geojson', data: routeOk ? { type: 'Feature', properties: {}, geometry: route!.geometry as any } : { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#fff', 'line-width': 9 } });
      m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1971c2', 'line-width': 5.5 } });
      m.addSource('dest', { type: 'geojson', data: { type: 'Feature', properties: { name: dest.name }, geometry: { type: 'Point', coordinates: destLL } } });
      m.addLayer({ id: 'dest', type: 'circle', source: 'dest', paint: { 'circle-radius': 11, 'circle-color': '#2f9e44', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      m.addLayer({ id: 'dest-label', type: 'symbol', source: 'dest', layout: { 'text-field': ['concat', 'SAFE: ', ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top' }, paint: { 'text-color': '#1b5e20', 'text-halo-color': '#fff', 'text-halo-width': 2 } });
      m.addSource('me', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'me-acc', type: 'circle', source: 'me', paint: { 'circle-radius': ['get', 'px'], 'circle-color': '#1c7ed6', 'circle-opacity': 0.15 } });
      m.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 8, 'circle-color': '#1c7ed6', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      const b = new maplibregl.LngLatBounds(start as any, start as any);
      b.extend(destLL);
      (routeOk ? route!.geometry!.coordinates : []).forEach((c) => b.extend(c as any));
      m.fitBounds(b, { padding: 50, duration: 0, maxZoom: 16 });
    });
    m.on('dragstart', () => setFollow(false));
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id, r.journey.started_at, lite]);

  // live device position while this screen is open (foreground only)
  useEffect(() => {
    const stop = watchFix((f) => { setFix(f); setGpsErr(null); }, (e) => setGpsErr(e.message));
    return stop;
  }, []);

  useEffect(() => {
    if (!fix) return;
    const m = map.current;
    const src = m?.getSource('me') as GeoJSONSource | undefined;
    if (m && src) {
      const mpp = (40075016 * Math.cos((fix.latitude * Math.PI) / 180)) / (512 * 2 ** m.getZoom());
      src.setData({ type: 'Feature', properties: { px: Math.min(120, Math.max(8, fix.accuracy_m / mpp)) }, geometry: { type: 'Point', coordinates: [fix.longitude, fix.latitude] } });
      if (follow) m.easeTo({ center: [fix.longitude, fix.latitude], duration: 600 });
    }
    const lm = liteMap.current;
    if (lm) {
      lm.me.setLatLng([fix.latitude, fix.longitude]).setStyle({ fillOpacity: 1 });
      lm.acc.setLatLng([fix.latitude, fix.longitude]).setRadius(Math.min(fix.accuracy_m, 1000));
      if (follow) lm.map.panTo([fix.latitude, fix.longitude]);
    }
    // share the real position with responders (throttled)
    const now = Date.now();
    const ll: [number, number] = [fix.longitude, fix.latitude];
    const lp = lastPost.current;
    if (!lp || now - lp.t > POST_EVERY_MS || distanceM(lp.ll, ll) > POST_EVERY_M) {
      lastPost.current = { t: now, ll };
      emergencyApi.location(fix).catch(() => { lastPost.current = null; });
    }
  }, [fix, follow, liteReady]);

  const remaining = fix ? distanceM([fix.longitude, fix.latitude], destLL) : null;
  const allowance = me.limits.arrival_radius_m + Math.min(fix?.accuracy_m ?? 0, 300);
  const near = remaining !== null && remaining <= allowance;
  const speed = routeOk && route?.duration_s && route?.distance_m ? route.distance_m / route.duration_s : WALK_MPS;
  // detour factor of the real route vs. the straight line from the journey start (1.3 when no route exists)
  const startLL = r.journey.start ?? destLL;
  const detour = routeOk && route?.distance_m ? Math.max(1, route.distance_m / Math.max(distanceM(startLL, destLL), 1)) : 1.3;
  const eta = remaining !== null ? (remaining * detour) / speed : null;

  const reached = async () => {
    setReachBusy(true); setReachErr(null);
    try {
      // Prefer the live watchPosition fix when it is fresh (instant, same real device GPS); request a
      // new one-shot fix only if the watch has gone quiet. The server verifies the distance either way.
      const fresh = fix && Date.now() - new Date(fix.captured_at).getTime() < 20000;
      const f = fresh ? fix : await getFix();
      onUpdate(await emergencyApi.reached(r.id, f));
    } catch (e: any) {
      setReachErr(e?.code ? e.message : apiError(e, 'Could not confirm arrival.'));
    } finally { setReachBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[#0d2b59] p-4 text-white shadow-lg">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-sky-200">En route to safe location</div>
        <div className="text-[20px] font-black leading-tight">{dest.name}</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[20px] font-black">{remaining !== null ? fmtDistance(remaining) : '—'}</div><div className="text-[9.5px] font-bold uppercase tracking-wider text-sky-200">remaining (straight)</div></div>
          <div><div className="text-[20px] font-black">{fix ? compass(bearing([fix.longitude, fix.latitude], destLL)) : '—'}</div><div className="text-[9.5px] font-bold uppercase tracking-wider text-sky-200">direction</div></div>
          <div><div className="text-[20px] font-black">{eta !== null ? `${Math.max(1, Math.round(eta / 60))} min` : '—'}</div><div className="text-[9.5px] font-bold uppercase tracking-wider text-sky-200">ETA (estimate)</div></div>
        </div>
      </div>

      <div className="relative h-[46vh] overflow-hidden rounded-2xl ring-1 ring-slate-300">
        <div ref={box} className="absolute inset-0" style={{ position: 'absolute', inset: 0 }} />{/* inline: MapLibre CSS sets position:relative */}
        {!routeOk && (
          <div className="absolute inset-x-2 top-2 rounded-xl bg-slate-900/90 px-3 py-2 text-center text-white">
            <div className="text-[13px] font-black tracking-wider">ROUTING DATA UNAVAILABLE</div>
            <div className="text-[11px]">No route could be computed. Head {fix ? compass(bearing([fix.longitude, fix.latitude], destLL)) : 'towards the green marker'} using safe, known paths; avoid streams and slopes.</div>
          </div>
        )}
        {!follow && <button onClick={() => setFollow(true)} className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-2 text-[12px] font-bold shadow">◎ Follow me</button>}
      </div>

      <div className="rounded-2xl bg-white p-3 text-[12px] text-slate-600 ring-1 ring-slate-200">
        {fix ? <>GPS ±{Math.round(fix.accuracy_m)} m · updated {ago(fix.captured_at)} · shared with responders while this screen is open</> : gpsErr ? <span className="font-bold text-rose-700">{gpsErr}</span> : 'Waiting for GPS…'}
        {routeOk && <div className="mt-1">Route: {fmtDistance(route!.distance_m!)} · {route!.source}{route!.risk ? ` · risk ${route!.risk.level}` : ''}</div>}
      </div>

      <BigButton tone={near ? 'green' : 'white'} busy={reachBusy} onClick={reached} className="min-h-[62px] text-[18px]">✓ REACHED HERE</BigButton>
      {!near && remaining !== null && <div className="text-center text-[11.5px] text-slate-500">Arrival is confirmed by GPS within {Math.round(allowance)} m of the safe location.</div>}
      <ErrorNote>{reachErr}</ErrorNote>
      <BigButton tone="red" onClick={onRescue}>🆘 I NEED RESCUE</BigButton>
      <a className="block text-center text-[12.5px] font-bold text-[#0d2b59] underline" target="_blank" rel="noreferrer"
        href={`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=walking`}>Open destination in a navigation app</a>
      <InfoNote>Keep this screen open during the journey. Browsers pause location updates when the app is in the background or the phone is locked — responders will see your last shared position and its time.</InfoNote>
    </div>
  );
}
