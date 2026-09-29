// Decoding and rendering helpers for FloodGuard simulation output (/geo/simulate).
import type { FeatureCollection, LngLat } from '../../types/geo';
import type { SimLayers } from './WayanadMap';
import { haversineKm, pointInGeometry } from './geo';

export interface SimFrame {
  t_h: number; rain_mm_h: number; rain_cum_mm: number; excess_cum_mm: number; flooded_km2: number; max_depth_m: number;
  volume_m3: number; people_exposed: number; max_velocity_ms: number; buildings_wet: number; roads_impassable: number; depth_b64: string;
}
export interface SimResult {
  id: string; label: string; kind: 'flood' | 'landslide' | 'combined'; scenario: string; created_at: string; params: any;
  zone_area_km2: number; models: Record<string, string>; stages: Array<{ key: string; label: string; t_h: number | null; detail: string }>;
  assumptions: string[]; validated: boolean; impacts_available: boolean; impacts_note: string | null; record_id: string | null;
  flood: null | {
    grid: { bounds: number[]; nx: number; ny: number; dx_m: number; dy_m: number; coordinates: number[][]; res_deg: number };
    zone_mask_b64: string; frames: SimFrame[]; max_depth_b64: string; hazard_b64: string; hazard_classes: string[];
    buildings: Record<string, { max_depth_m: number; first_wet_h: number | null; depths: number[] }>;
    roads: Array<{ osm_id: number; name: string | null; class: string | null; max_depth_m: number; t_impassable_h: number | null; depths: number[] }>;
    summary: Record<string, any>; setup: Record<string, any>;
  };
  landslide: null | {
    fs_png: string; coordinates: number[][]; unstable: FeatureCollection; sources: FeatureCollection; debris: FeatureCollection; t_fail_h: number;
    impacts: { buildings: number[]; roads: Array<{ osm_id: number; name: string | null; class: string | null; t_blocked_h: number }>; people_in_corridors_hrsl: number | null };
    summary: Record<string, any>; setup: Record<string, any>;
  };
}

const b64cache = new Map<string, ArrayBuffer>();
function bytes(b64: string): ArrayBuffer {
  let buf = b64cache.get(b64);
  if (!buf) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    buf = u8.buffer;
    if (b64cache.size > 80) b64cache.clear();
    b64cache.set(b64, buf);
  }
  return buf;
}
export const depthGrid = (b64: string) => new Uint16Array(bytes(b64)); // centimetres
export const u8Grid = (b64: string) => new Uint8Array(bytes(b64));

export function cellIndex(sim: SimResult, ll: LngLat): number | null {
  const g = sim.flood?.grid;
  if (!g) return null;
  const [w, s, e, n] = g.bounds;
  const c = Math.floor(((ll[0] - w) / (e - w)) * g.nx);
  const r = Math.floor(((n - ll[1]) / (n - s)) * g.ny);
  if (c < 0 || r < 0 || c >= g.nx || r >= g.ny) return null;
  return r * g.nx + c;
}

export function depthAt(sim: SimResult, frame: number, ll: LngLat): number | null {
  const i = cellIndex(sim, ll);
  if (i === null || !sim.flood) return null;
  return depthGrid(sim.flood.frames[frame].depth_b64)[i] / 100;
}

/** Max depth within radius (m) of a point for a frame. */
export function maxDepthNear(sim: SimResult, frame: number, ll: LngLat, radiusM: number): { depth: number; at: LngLat } {
  const g = sim.flood!.grid;
  const d = depthGrid(sim.flood!.frames[frame].depth_b64);
  const [w, s, e, n] = g.bounds;
  const cw = (e - w) / g.nx, ch = (n - s) / g.ny;
  const rc = Math.ceil(radiusM / Math.min(g.dx_m, g.dy_m));
  const c0 = Math.floor((ll[0] - w) / cw), r0 = Math.floor((n - ll[1]) / ch);
  let best = 0, at: LngLat = ll;
  for (let r = r0 - rc; r <= r0 + rc; r++) for (let c = c0 - rc; c <= c0 + rc; c++) {
    if (r < 0 || c < 0 || r >= g.ny || c >= g.nx) continue;
    const v = d[r * g.nx + c] / 100;
    if (v > best) { best = v; at = [w + (c + 0.5) * cw, n - (r + 0.5) * ch]; }
  }
  return { depth: best, at };
}

export function deepestCell(sim: SimResult, frame: number): { depth: number; at: LngLat } | null {
  if (!sim.flood) return null;
  const g = sim.flood.grid;
  const d = depthGrid(sim.flood.frames[frame].depth_b64);
  let bi = -1, bv = 0;
  for (let i = 0; i < d.length; i++) if (d[i] > bv) { bv = d[i]; bi = i; }
  if (bi < 0) return null;
  const [w, s, e, n] = g.bounds;
  const r = Math.floor(bi / g.nx), c = bi % g.nx;
  return { depth: bv / 100, at: [w + ((c + 0.5) * (e - w)) / g.nx, n - ((r + 0.5) * (n - s)) / g.ny] };
}

const DEPTH_STOPS: Array<[number, [number, number, number, number]]> = [
  [0.05, [140, 210, 255, 0]], [0.1, [140, 210, 255, 150]], [0.3, [70, 165, 240, 190]], [0.5, [35, 115, 220, 210]],
  [1.0, [20, 65, 185, 225]], [1.5, [60, 30, 150, 235]], [2.0, [120, 10, 90, 240]],
];
function ramp(v: number): [number, number, number, number] {
  if (v <= DEPTH_STOPS[0][0]) return [0, 0, 0, 0];
  for (let i = 1; i < DEPTH_STOPS.length; i++) {
    const [x1, c1] = DEPTH_STOPS[i];
    const [x0, c0] = DEPTH_STOPS[i - 1];
    if (v <= x1) {
      const t = (v - x0) / (x1 - x0);
      return [0, 1, 2, 3].map((k) => c0[k] + (c1[k] - c0[k]) * t) as any;
    }
  }
  return DEPTH_STOPS[DEPTH_STOPS.length - 1][1];
}
export const DEPTH_LEGEND = DEPTH_STOPS.slice(1).map(([v, c]) => ({ v, color: `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})` }));

const imgCache = new Map<string, string>();
export function depthImage(sim: SimResult, frame: number): string | null {
  if (!sim.flood) return null;
  const key = `${sim.id}:${frame}`;
  const hit = imgCache.get(key);
  if (hit) return hit;
  const g = sim.flood.grid;
  const d = depthGrid(sim.flood.frames[frame].depth_b64);
  const mask = u8Grid(sim.flood.zone_mask_b64);
  const cv = document.createElement('canvas');
  cv.width = g.nx; cv.height = g.ny;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(g.nx, g.ny);
  for (let i = 0; i < d.length; i++) {
    if (!mask[i]) continue;
    const [r, gg, b, a] = ramp(d[i] / 100);
    img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  // upscale with smoothing for a less blocky water surface
  const up = document.createElement('canvas');
  up.width = g.nx * 4; up.height = g.ny * 4;
  const uctx = up.getContext('2d')!;
  uctx.imageSmoothingEnabled = true;
  uctx.imageSmoothingQuality = 'high';
  uctx.drawImage(cv, 0, 0, up.width, up.height);
  const url = up.toDataURL('image/png');
  if (imgCache.size > 120) imgCache.clear();
  imgCache.set(key, url);
  return url;
}

export function frameAtTime(sim: SimResult, tH: number): number {
  const fr = sim.flood?.frames;
  if (!fr) return 0;
  let best = 0;
  for (let i = 0; i < fr.length; i++) if (fr[i].t_h <= tH + 1e-6) best = i;
  return best;
}

export function simDuration(sim: SimResult): number {
  if (sim.flood) return sim.flood.frames[sim.flood.frames.length - 1].t_h;
  return (sim.params?.duration_h ?? 6) + 2;
}

/** Map layers for the simulation state at time tH. */
export function simLayersAt(sim: SimResult, tH: number, zoneRoads: FeatureCollection | null): SimLayers {
  const frame = frameAtTime(sim, tH);
  const ls = sim.landslide;
  const failed = !!ls && tH >= ls.t_fail_h;
  const debrisProgress = failed ? Math.min(1, (tH - ls!.t_fail_h) / 1.0) : 0; // illustrative 1 h reveal
  const blocked = new Set((ls && failed ? ls.impacts.roads : []).map((r) => r.osm_id));
  const impassable = new Set((sim.flood?.roads ?? []).filter((r) => r.depths[frame] > 0.3).map((r) => r.osm_id));
  const roads: FeatureCollection | null = zoneRoads ? {
    type: 'FeatureCollection',
    features: zoneRoads.features
      .filter((f) => blocked.has(f.properties.osm_id) || impassable.has(f.properties.osm_id))
      .map((f) => ({ ...f, properties: { ...f.properties, state: blocked.has(f.properties.osm_id) ? 'blocked' : 'impassable' } })),
  } : null;
  return {
    depthUrl: sim.flood ? depthImage(sim, frame) : null,
    depthCoords: sim.flood?.grid.coordinates ?? null,
    fsUrl: ls ? ls.fs_png : null,
    fsCoords: ls ? ls.coordinates : null,
    unstable: ls && failed ? ls.unstable : null,
    debris: ls && failed ? ls.debris : null,
    debrisProgress,
    roads,
  };
}

/** Buildings annotated with simulated depth (and debris impact) at time tH. */
export function simBuildings(sim: SimResult, tH: number, buildings: FeatureCollection | null): FeatureCollection | null {
  if (!buildings) return null;
  const frame = frameAtTime(sim, tH);
  const hitDebris = new Set(sim.landslide && tH >= sim.landslide.t_fail_h ? sim.landslide.impacts.buildings : []);
  const fb = sim.flood?.buildings ?? {};
  return {
    type: 'FeatureCollection',
    features: buildings.features.map((f) => {
      const id = String(f.properties.osm_id);
      const b = fb[id];
      return { ...f, properties: { ...f.properties, sim_depth: b ? b.depths[frame] : 0, debris: hitDebris.has(f.properties.osm_id) } };
    }),
  };
}

function waterColor(d: number) { return d >= 1 ? 'red' : d >= 0.3 ? 'orange' : 'yellow'; }

/** Floating information signs derived only from simulation output. */
export function simSigns(sim: SimResult, tH: number, zone: { geometry: any; center: LngLat }, places: FeatureCollection | null, zoneRoads: FeatureCollection | null): FeatureCollection {
  const feats: any[] = [];
  const frame = frameAtTime(sim, tH);
  const f = sim.flood?.frames[frame];
  const hh = (t: number) => `T+${Math.floor(t)}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;
  const base = { status: 'SIMULATION', time: hh(tH), note: `${sim.label} — ${sim.scenario}. Uncalibrated physically-based model; not a forecast.` };
  if (f && f.rain_mm_h > 0) {
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: zone.center }, properties: { ...base, priority: 0, color: 'blue', color_hex: '#1971c2',
      title: '💧 RAIN · SCENARIO', value: `${f.rain_mm_h.toFixed(0)} mm/h`, sub: `${f.rain_cum_mm.toFixed(0)} mm cumulative`, basis: 'Scenario rainfall input (uniform)' } });
  }
  if (f && f.people_exposed > 0) {
    const c = [zone.center[0] + 0.004, zone.center[1] - 0.003];
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { ...base, priority: 0, color: f.people_exposed > 200 ? 'red' : 'orange', color_hex: '#e03131',
      title: '👥 PEOPLE EXPOSED', value: Math.round(f.people_exposed).toLocaleString(), sub: `HRSL estimate in water > 0.15 m`, basis: 'HRSL v1.5 population × simulated depth (ESTIMATED)' } });
  }
  if (sim.flood && places) {
    const inZone = places.features.filter((p) => ['village', 'hamlet', 'town', 'suburb', 'neighbourhood', 'locality'].includes(p.properties.place) && pointInGeometry(p.geometry.coordinates, zone.geometry));
    for (const p of inZone) {
      const { depth, at } = maxDepthNear(sim, frame, p.geometry.coordinates, 250);
      if (depth < 0.1) continue;
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: at }, properties: { ...base, priority: 1, color: waterColor(depth), color_hex: '#1c7ed6',
        title: `🌊 WATER · ${p.properties.name}`, value: `${depth.toFixed(1)} m`, sub: depthMeaning(depth), basis: 'Simulated depth (max within 250 m of settlement node)' } });
    }
  }
  if (sim.landslide && tH >= sim.landslide.t_fail_h) {
    const src = [...sim.landslide.sources.features].sort((a, b) => b.properties.failed_area_m2 - a.properties.failed_area_m2).slice(0, 3);
    for (const s of src) {
      feats.push({ type: 'Feature', geometry: s.geometry, properties: { ...base, priority: 1, color: 'purple', color_hex: '#7048e8',
        title: '⛰ SLOPE FAILURE', value: `FS ${s.properties.min_fs}`, sub: `${(s.properties.failed_area_m2 / 10000).toFixed(1)} ha unstable`, basis: 'Infinite-slope FS < 1 with ASSUMED soil parameters' } });
    }
  }
  if (zoneRoads) {
    const blockedIds = new Set(sim.landslide && tH >= sim.landslide.t_fail_h ? sim.landslide.impacts.roads.map((r) => r.osm_id) : []);
    const wetIds = new Set((sim.flood?.roads ?? []).filter((r) => r.depths[frame] > 0.3).map((r) => r.osm_id));
    const affected = zoneRoads.features
      .filter((r) => (blockedIds.has(r.properties.osm_id) || wetIds.has(r.properties.osm_id)) && ['Highway', 'Major road', 'District road', 'Local road'].includes(r.properties.class))
      .sort((a, b) => b.properties.length_in_zone_m - a.properties.length_in_zone_m)
      .slice(0, 4);
    for (const r of affected) {
      const cs = r.geometry.coordinates;
      const mid = cs[Math.floor(cs.length / 2)];
      const debris = blockedIds.has(r.properties.osm_id);
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: mid }, properties: { ...base, priority: 2, color: 'red', color_hex: '#c92a2a',
        title: '🚧 ROAD', value: debris ? 'BLOCKED' : 'IMPASSABLE', sub: `${r.properties.name ?? r.properties.class}${debris ? ' · debris' : ' · > 0.3 m water'}`, basis: debris ? 'Simulated debris corridor' : 'Simulated depth > 0.3 m' } });
    }
  }
  return { type: 'FeatureCollection', features: feats };
}

export function depthMeaning(d: number): string {
  if (d < 0.15) return 'ankle-deep · shallow';
  if (d < 0.3) return 'shin-deep · unsafe to drive fast';
  if (d < 0.6) return 'knee-level · cars can float';
  if (d < 1.0) return 'waist-level · serious vehicle impact';
  if (d < 1.5) return 'chest-level · severe exposure';
  if (d < 2.0) return 'above head for many · life-threatening';
  return 'major flood depth · ground floors submerged';
}

export function nearestKm(a: LngLat, b: LngLat) { return haversineKm(a, b); }
