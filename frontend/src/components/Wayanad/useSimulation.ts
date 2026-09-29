// Simulation run + timeline playback state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { liveApi } from '../../services/liveApi';
import { DEFAULT_PARAMS, type SimParams } from './SimulationPanel';
import { simDuration, type SimResult } from './simUtils';
import type { OperationalZone } from '../../types/geo';

const BASE_H_PER_S = 0.4; // simulated hours per real second at 1×

export function useSimulation() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runSeconds, setRunSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tH, setTH] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!running) return;
    setRunSeconds(0);
    const t = setInterval(() => setRunSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!playing || !sim) return;
    const total = simDuration(sim);
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTH((t) => {
        const next = t + dt * BASE_H_PER_S * speedRef.current;
        if (next >= total) { setPlaying(false); return total; }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, sim]);

  const run = useCallback(async (zone: OperationalZone, override?: Partial<SimParams> & { demo?: boolean; name?: string }) => {
    const p = { ...params, ...override };
    setRunning(true);
    setError(null);
    setPlaying(false);
    try {
      const r: SimResult = await liveApi.simulate({
        geometry: zone.geometry, name: override?.name ?? `${p.scenario} · ${zone.name}`, kind: p.kind, rainfall_mm: p.rainfall_mm,
        duration_h: p.duration_h, amc: p.amc, scenario: p.scenario, demo: !!override?.demo, landslide: p.landslide,
      });
      setSim(r);
      setTH(0);
      return r;
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? `Simulation failed: ${e?.message ?? e}`);
      return null;
    } finally {
      setRunning(false);
    }
  }, [params]);

  const clear = () => { setSim(null); setPlaying(false); setTH(0); setError(null); };

  return { params, setParams, sim, running, runSeconds, error, run, clear, tH, setTH, playing, setPlaying, speed, setSpeed };
}
