// One fixed background behind every chapter. Its mood follows the active chapter:
// paper (hero) → storm night (prologue – ch.3) → deep navy (ch.4 – ch.9) → dawn (epilogue).
// Colours are CSS variables tweened by GSAP; blobs and contours drift with CSS transforms only;
// rain is a small 2D canvas capped at 30 fps that sleeps when there is no rain.
import React, { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from './gsap';
import { storyStore, type Mood } from './storyStore';

interface MoodSpec { top: string; bottom: string; glow: string; blob1: string; blob2: string; line: string; grain: number; rain: number }

export const MOODS: Record<Mood, MoodSpec> = {
  paper: { top: '#EBE8E0', bottom: '#E2DED3', glow: 'rgba(212,248,38,0.10)', blob1: 'rgba(212,248,38,0.16)', blob2: 'rgba(160,150,190,0.16)', line: 'rgba(24,26,30,0.07)', grain: 0.05, rain: 0 },
  storm: { top: '#06080C', bottom: '#111723', glow: 'rgba(96,120,170,0.20)', blob1: 'rgba(70,90,140,0.22)', blob2: 'rgba(30,40,70,0.35)', line: 'rgba(255,255,255,0.05)', grain: 0.08, rain: 0.75 },
  navy: { top: '#081226', bottom: '#0D1B35', glow: 'rgba(212,248,38,0.08)', blob1: 'rgba(212,248,38,0.10)', blob2: 'rgba(40,80,160,0.30)', line: 'rgba(212,248,38,0.06)', grain: 0.07, rain: 0.18 },
  dawn: { top: '#F4DCC6', bottom: '#EBE8E0', glow: 'rgba(255,190,120,0.30)', blob1: 'rgba(255,200,150,0.35)', blob2: 'rgba(212,248,38,0.14)', line: 'rgba(24,26,30,0.06)', grain: 0.05, rain: 0 },
};

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function useRain(canvasRef: React.RefObject<HTMLCanvasElement>, baseRef: React.MutableRefObject<number>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let boost = 0;
    const offBoost = storyStore.onRainBoost((v) => { boost = v; });
    const mobile = window.innerWidth < 1024;
    const MAX = mobile ? 140 : 360;
    type Drop = { x: number; y: number; len: number; speed: number; alpha: number };
    const drops: Drop[] = [];
    let w = 0, h = 0;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const spawn = (anywhere: boolean): Drop => ({
      x: Math.random() * (w + 200) - 100,
      y: anywhere ? Math.random() * h : -30 - Math.random() * 100,
      len: 10 + Math.random() * 22,
      speed: 9 + Math.random() * 12,
      alpha: 0.12 + Math.random() * 0.3,
    });
    let intensity = 0, last = 0, raf = 0, cleared = true;
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (ts - last < 33 || document.hidden) return; // ~30 fps
      last = ts;
      const target = Math.min(1, baseRef.current + boost);
      intensity += (target - intensity) * 0.06;
      const want = Math.round(MAX * intensity);
      if (want < 2) {
        if (!cleared) { ctx.clearRect(0, 0, w, h); cleared = true; drops.length = 0; }
        return;
      }
      cleared = false;
      while (drops.length < want) drops.push(spawn(drops.length < want / 2));
      if (drops.length > want) drops.length = want;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (const d of drops) {
        ctx.strokeStyle = `rgba(200,215,240,${d.alpha * intensity})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * 0.22, d.y + d.len);
        ctx.stroke();
        d.y += d.speed;
        d.x -= d.speed * 0.22;
        if (d.y > h + 30) Object.assign(d, spawn(false));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); offBoost(); };
  }, [canvasRef, baseRef]);
}

export const StoryBackground: React.FC = () => {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rainBase = useRef(0);

  useRain(canvas, rainBase);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const apply = (mood: Mood, instant = false) => {
      const m = MOODS[mood];
      rainBase.current = m.rain;
      const vars = { '--sb-top': m.top, '--sb-bottom': m.bottom, '--sb-glow': m.glow, '--sb-blob1': m.blob1, '--sb-blob2': m.blob2, '--sb-line': m.line, '--sb-grain': m.grain };
      if (instant || prefersReducedMotion()) gsap.set(el, vars);
      else gsap.to(el, { ...vars, duration: 1.4, ease: 'power2.inOut', overwrite: 'auto' });
    };
    apply(storyStore.get().mood, true);
    let current = storyStore.get().mood;
    const off = storyStore.subscribe(() => {
      const next = storyStore.get().mood;
      if (next !== current) { current = next; apply(next); }
    });
    return () => { off(); gsap.killTweensOf(el); };
  }, []);

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="story-bg fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{ background: 'radial-gradient(1200px 760px at 72% 8%, var(--sb-glow), transparent 62%), linear-gradient(180deg, var(--sb-top), var(--sb-bottom))' }}
    >
      <div className="story-blob story-blob-a" style={{ background: 'var(--sb-blob1)' }} />
      <div className="story-blob story-blob-b" style={{ background: 'var(--sb-blob2)' }} />
      <svg className="story-contours" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M ${-100} ${520 - i * 46} C ${220} ${440 - i * 60}, ${420} ${640 - i * 40}, ${640} ${520 - i * 52} S ${1040} ${360 - i * 30}, ${1320} ${470 - i * 44}`}
            fill="none"
            stroke="var(--sb-line)"
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 'var(--sb-grain)' as unknown as number, mixBlendMode: 'overlay' }} />
    </div>
  );
};

export default StoryBackground;
