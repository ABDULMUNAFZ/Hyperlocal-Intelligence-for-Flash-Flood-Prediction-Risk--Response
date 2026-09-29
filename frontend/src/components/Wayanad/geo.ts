// Small geometry helpers (WGS84). Kept dependency-free on purpose.
import type { LngLat } from '../../types/geo';

const R = 6371008.8;

export function haversineKm(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / 1000;
}

export function circlePolygon(center: LngLat, radiusKm: number, steps = 72) {
  const [lon, lat] = center;
  const coords: LngLat[] = [];
  const dy = radiusKm / 110.574;
  const dx = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    coords.push([+(lon + dx * Math.cos(t)).toFixed(6), +(lat + dy * Math.sin(t)).toFixed(6)]);
  }
  return { type: 'Polygon' as const, coordinates: [coords] };
}

export function rings(geometry: { type: string; coordinates: any }): LngLat[][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p: any) => p[0]);
  return [];
}

/** A world polygon with the given geometry cut out — used to dim everything outside an area. */
export function maskPolygon(geometry: { type: string; coordinates: any }) {
  const world: LngLat[] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [world, ...rings(geometry).map((r) => [...r].reverse())] },
  };
}

export function bbox(geometry: { type: string; coordinates: any }): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings(geometry)) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

export function pointInRing(pt: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(pt: LngLat, geometry: { type: string; coordinates: any }): boolean {
  if (geometry.type === 'Polygon') return pointInRing(pt, geometry.coordinates[0]);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((p: any) => pointInRing(pt, p[0]));
  return false;
}

export function centroid(geometry: { type: string; coordinates: any }): LngLat {
  const [a, b, c, d] = bbox(geometry);
  return [(a + c) / 2, (b + d) / 2];
}

/** Approximate area (km²) using a local equirectangular projection. */
export function areaKm2(geometry: { type: string; coordinates: any }): number {
  let total = 0;
  for (const ring of rings(geometry)) {
    const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110.574;
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      a += ring[i][0] * kx * ring[i + 1][1] * ky - ring[i + 1][0] * kx * ring[i][1] * ky;
    }
    total += Math.abs(a) / 2;
  }
  return total;
}

/** Minimum distance (km) from a point to a LineString, via local projection. */
export function distanceToLineKm(pt: LngLat, line: LngLat[]): number {
  const kx = 111.32 * Math.cos((pt[1] * Math.PI) / 180);
  const ky = 110.574;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][0] - pt[0]) * kx, ay = (line[i][1] - pt[1]) * ky;
    const bx = (line[i + 1][0] - pt[0]) * kx, by = (line[i + 1][1] - pt[1]) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const x = ax + t * dx, y = ay + t * dy;
    best = Math.min(best, Math.hypot(x, y));
  }
  return best;
}

export function fmt(v: number | null | undefined, digits = 1, unit = ''): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
}

export function fmtCoord(ll: LngLat): string {
  return `${ll[1].toFixed(4)}° N, ${ll[0].toFixed(4)}° E`;
}
