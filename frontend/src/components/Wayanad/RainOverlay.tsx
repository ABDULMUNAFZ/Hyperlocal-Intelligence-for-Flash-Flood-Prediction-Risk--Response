// Weather-driven rain: particles drawn only inside grid cells where precipitation > 0.
// One <canvas>, one rAF loop; cells are projected every frame so rain follows the 3D camera.
import { useEffect, useRef } from 'react';
import type { Map as MLMap } from 'maplibre-gl';

export interface RainCell {
  ring: [number, number][]; // lon/lat polygon
  mmPerHour: number;
}

// American Meteorological Society intensity classes (mm/h)
export function rainClass(mm: number): 0 | 1 | 2 | 3 | 4 {
  if (mm <= 0.05) return 0;
  if (mm < 2.5) return 1; // light
  if (mm < 7.6) return 2; // moderate
  if (mm < 50) return 3; // heavy
  return 4; // violent
}
export const RAIN_CLASS_LABEL = ['No rain', 'Light', 'Moderate', 'Heavy', 'Violent'];

const DENSITY = [0, 0.00005, 0.00013, 0.00028, 0.00045]; // particles per px² of raining screen area
const SPEED = [0, 9, 12, 16, 20];
const ALPHA = [0, 0.35, 0.45, 0.55, 0.65];
const MAX_PARTICLES = 3200;

interface P { x: number; y: number; v: number; l: number }

export function RainOverlay({ map, cells, dark }: { map: MLMap | null; cells: RainCell[]; dark: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !map) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const pools: P[][] = [[], [], [], [], []];
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const cs = cellsRef.current;
      if (!cs.length) return;
      const pitch = map.getPitch();
      const stretch = 1 + pitch / 45; // streaks lengthen as the camera tilts
      const slant = 0.12;
      // group projected cells by intensity class
      const groups: Array<Array<Array<{ x: number; y: number }>>> = [[], [], [], [], []];
      const bboxes = [0, 1, 2, 3, 4].map(() => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, area: 0 }));
      for (const c of cs) {
        const k = rainClass(c.mmPerHour);
        if (!k) continue;
        const pts = c.ring.map((ll) => map.project(ll as [number, number]));
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        const x0 = Math.max(0, Math.min(...xs)), x1 = Math.min(w, Math.max(...xs));
        const y0 = Math.max(0, Math.min(...ys)), y1 = Math.min(h, Math.max(...ys));
        if (x1 <= x0 || y1 <= y0) continue;
        groups[k].push(pts);
        const b = bboxes[k];
        b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0); b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1);
        b.area += (x1 - x0) * (y1 - y0);
      }
      let budget = MAX_PARTICLES;
      for (let k = 1; k <= 4; k++) {
        const g = groups[k];
        const pool = pools[k];
        if (!g.length) { pool.length = 0; continue; }
        const b = bboxes[k];
        const want = Math.min(budget, Math.round(b.area * DENSITY[k]));
        budget -= want;
        while (pool.length < want) pool.push({ x: b.x0 + Math.random() * (b.x1 - b.x0), y: b.y0 + Math.random() * (b.y1 - b.y0), v: SPEED[k] * (0.8 + Math.random() * 0.4), l: 6 + Math.random() * 8 });
        pool.length = want;

        ctx.save();
        ctx.beginPath();
        for (const pts of g) {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
        }
        ctx.clip();
        if (k >= 3) { // heavy rain darkens the scene beneath it
          ctx.fillStyle = dark ? 'rgba(10,20,40,0.18)' : 'rgba(40,55,80,0.12)';
          ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
        }
        ctx.strokeStyle = dark ? `rgba(170,210,255,${ALPHA[k]})` : `rgba(60,100,160,${ALPHA[k]})`;
        ctx.lineWidth = k >= 3 ? 1.3 : 1;
        ctx.beginPath();
        for (const p of pool) {
          const len = p.l * stretch;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - len * slant, p.y + len);
          p.y += p.v * stretch * 0.9;
          p.x -= p.v * slant * 0.9;
          if (p.y > b.y1 || p.x < b.x0) {
            p.y = b.y0 - Math.random() * 20;
            p.x = b.x0 + Math.random() * (b.x1 - b.x0);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [map, dark]);

  return <canvas ref={canvas} className="pointer-events-none absolute inset-0 z-[5] h-full w-full" />;
}
