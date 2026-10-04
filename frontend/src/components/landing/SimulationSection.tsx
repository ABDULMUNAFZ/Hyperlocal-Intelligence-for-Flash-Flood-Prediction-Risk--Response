import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap, ScrollTrigger, MQ, fitsViewport } from './story/gsap';
import { useLenis } from './story/SmoothScrollProvider';
import { Magnetic } from './story/Magnetic';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Users,
  Building,
  Droplets,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import ScrollHeading from './ScrollHeading';

interface ScenarioConfig {
  id: string;
  label: string;
  rainfallMm: number;
  durationH: number;
  inundationAreaKm2: number;
  maxDepthM: number;
  affectedBuildings: number;
  displacedPop: number;
  cutOffRoadsKm: number;
  hazardLevel: 'MODERATE' | 'HIGH' | 'CRITICAL' | 'EXTREME';
  description: string;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'sc-50',
    label: '50mm / 6h (Moderate)',
    rainfallMm: 50,
    durationH: 6,
    inundationAreaKm2: 4.2,
    maxDepthM: 0.85,
    affectedBuildings: 48,
    displacedPop: 180,
    cutOffRoadsKm: 1.4,
    hazardLevel: 'MODERATE',
    description: 'Typical heavy monsoon shower. Lowland drainage gutters flood; natural stream channels bank-full but containable.',
  },
  {
    id: 'sc-100',
    label: '100mm / 6h (High)',
    rainfallMm: 100,
    durationH: 6,
    inundationAreaKm2: 8.7,
    maxDepthM: 1.6,
    affectedBuildings: 142,
    displacedPop: 560,
    cutOffRoadsKm: 3.8,
    hazardLevel: 'HIGH',
    description: 'Sustained orographic storm. Meppadi riverbank overflows; secondary culverts silted and overtopping road surfaces.',
  },
  {
    id: 'sc-150',
    label: '150mm / 6h (Critical)',
    rainfallMm: 150,
    durationH: 6,
    inundationAreaKm2: 15.3,
    maxDepthM: 2.8,
    affectedBuildings: 320,
    displacedPop: 1280,
    cutOffRoadsKm: 8.2,
    hazardLevel: 'CRITICAL',
    description: 'Violent cloudburst sequence. Chooralmala bridge approaches submerged; rapid mud slurry downslope into residential wards.',
  },
  {
    id: 'sc-200',
    label: '200mm / 6h (Extreme)',
    rainfallMm: 200,
    durationH: 6,
    inundationAreaKm2: 24.1,
    maxDepthM: 4.2,
    affectedBuildings: 680,
    displacedPop: 2840,
    cutOffRoadsKm: 14.6,
    hazardLevel: 'EXTREME',
    description: 'Historical catastrophe intensity (Mundakkai 2024 equivalent). Massive debris flow, river severance, primary bridge structural threats.',
  },
];

/** Scenario at any rainfall between 50 and 200 mm/6h: linear interpolation between the four modelled runs. */
function scenarioAt(rain: number): ScenarioConfig & { interpolated: boolean } {
  const r = Math.max(50, Math.min(200, rain));
  const hi = SCENARIOS.findIndex((sc) => sc.rainfallMm >= r);
  const b = SCENARIOS[Math.max(0, hi)];
  const a = SCENARIOS[Math.max(0, hi - 1)];
  const t = b.rainfallMm === a.rainfallMm ? 0 : (r - a.rainfallMm) / (b.rainfallMm - a.rainfallMm);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const nearest = t < 0.5 ? a : b;
  return {
    ...nearest,
    rainfallMm: Math.round(r),
    inundationAreaKm2: Math.round(lerp(a.inundationAreaKm2, b.inundationAreaKm2) * 10) / 10,
    maxDepthM: Math.round(lerp(a.maxDepthM, b.maxDepthM) * 100) / 100,
    affectedBuildings: Math.round(lerp(a.affectedBuildings, b.affectedBuildings)),
    displacedPop: Math.round(lerp(a.displacedPop, b.displacedPop)),
    cutOffRoadsKm: Math.round(lerp(a.cutOffRoadsKm, b.cutOffRoadsKm) * 10) / 10,
    interpolated: !SCENARIOS.some((sc) => sc.rainfallMm === Math.round(r)),
  };
}

export const SimulationSection: React.FC = () => {
  const [rain, setRain] = useState(100);
  const selectedScenario = useMemo(() => scenarioAt(rain), [rain]);
  const stage = useRef<HTMLDivElement>(null);
  const stRef = useRef<ScrollTrigger | null>(null);
  const lenis = useLenis();

  // Desktop: scroll scrubs rainfall 50 → 200 mm/6h while the simulator is pinned.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.matchMedia().add(MQ.desktop, () => {
        const pin = fitsViewport(el, 100);
        let last = -1;
        stRef.current = ScrollTrigger.create({
          trigger: el,
          start: pin ? 'top top+=96' : 'top 85%',
          end: pin ? '+=180%' : 'top 20%',
          pin,
          scrub: true,
          onUpdate: (self) => {
            const r = Math.round(50 + self.progress * 150);
            if (r !== last) { last = r; setRain(r); }
          },
        });
        return () => { stRef.current = null; };
      });
    }, el);
    return () => ctx.revert();
  }, []);

  const goTo = (mm: number) => {
    const st = stRef.current;
    if (!st) { setRain(mm); return; }
    const y = st.start + (st.end - st.start) * ((mm - 50) / 150) + 1;
    if (lenis) lenis.scrollTo(y, { duration: 1 });
    else window.scrollTo({ top: y });
  };

  return (
    <section className="relative py-16 sm:py-24 text-[#FAF9F6] overflow-hidden">
      <div className="max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Animated Scroll Heading with Scenario Simulation Accent */}
        <ScrollHeading
          theme="dark"
          badge="WHAT-IF FLOOD SIMULATION & HUMAN IMPACT"
          animationVariant="depth"
          title="WHAT HAPPENS"
          italicWord="IF THE RAIN KEEPS FALLING?"
          subtitle="Flash flood defense requires proactive foresight. FloodGuard allows emergency managers to simulate synthetic precipitation scenarios before cloudbursts occur, identifying exactly which bridges will be severed and which shelters to pre-activate."
        />

        <div ref={stage}>
        {/* Scenario Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl glass-dark mb-6 shadow-2xl">
          <div className="flex items-center gap-2 text-xs font-mono text-white font-bold">
            <span className="h-2 w-2 rounded-full bg-[#D4F826] animate-pulse"></span>
            <span className="tracking-wider uppercase">SECTION 07 · SELECT HYDRAULIC WAVEFRONT SCENARIO:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((sc) => {
              const isActive = selectedScenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => goTo(sc.rainfallMm)}
                  className={`px-4 py-2 rounded-full text-xs font-mono font-bold transition-all ${
                    isActive
                      ? 'bg-[#D4F826] text-[#181A1E] shadow-md shadow-[#D4F826]/20'
                      : 'bg-[#121316] text-slate-300 hover:bg-[#20232E] border border-white/10'
                  }`}
                >
                  {sc.label}
                </button>
              );
            })}
          </div>

          <span className="text-[10px] font-mono text-slate-400 bg-[#121316] px-3 py-1 rounded-full border border-white/10">
            SOLVER: Manning Kinematic Wave 2D
          </span>
        </div>

        {/* Inundation Simulation Result Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Simulation Readout (7 cols) - Dark Tactical Card */}
          <div className="glow-card lg:col-span-7 glass-dark rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <div className="text-xs font-mono text-slate-400">ACTIVE SCENARIO</div>
                <div className="text-xl font-display font-extrabold text-white mt-0.5">
                  {selectedScenario.rainfallMm} mm / {selectedScenario.durationH} Hours Monsoonal Deluge
                </div>
              </div>

              <span
                className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                  selectedScenario.hazardLevel === 'EXTREME'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : selectedScenario.hazardLevel === 'CRITICAL'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                HAZARD: {selectedScenario.hazardLevel}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {selectedScenario.description}
            </p>

            {/* Rainfall + peak-depth gauges (follow the scroll on desktop) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#121317]/80 border border-white/10 p-3">
                <div className="flex justify-between text-[10px] font-mono text-slate-400"><span>RAINFALL / 6 H</span><span className="text-[#D4F826] font-bold">{selectedScenario.rainfallMm} mm</span></div>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-500 transition-[width] duration-150" style={{ width: `${((selectedScenario.rainfallMm - 50) / 150) * 100}%` }} /></div>
              </div>
              <div className="rounded-2xl bg-[#121317]/80 border border-white/10 p-3">
                <div className="flex justify-between text-[10px] font-mono text-slate-400"><span>VALLEY WATER LEVEL</span><span className="text-sky-300 font-bold">{selectedScenario.maxDepthM} m</span></div>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-sky-400 transition-[width] duration-150" style={{ width: `${(selectedScenario.maxDepthM / 4.2) * 100}%` }} /></div>
              </div>
            </div>
            {selectedScenario.interpolated && (
              <div className="text-[10px] font-mono text-slate-500">Values between the four modelled scenarios are linearly interpolated.</div>
            )}

            {/* 4 Impact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#121317] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Compass className="h-3 w-3 text-cyan-400" /> FLOOD EXTENT
                </div>
                <div className="text-lg font-mono font-bold text-white mt-1">
                  {selectedScenario.inundationAreaKm2} <span className="text-xs text-slate-400">km²</span>
                </div>
                <div className="text-[9px] text-slate-500">Surface footprint</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#121317] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Droplets className="h-3 w-3 text-sky-400" /> PEAK DEPTH
                </div>
                <div className="text-lg font-mono font-bold text-sky-400 mt-1">
                  {selectedScenario.maxDepthM} <span className="text-xs text-slate-400">m</span>
                </div>
                <div className="text-[9px] text-slate-500">Valley channel max</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#121317] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Building className="h-3 w-3 text-amber-400" /> AFFECTED HOMES
                </div>
                <div className="text-lg font-mono font-bold text-amber-400 mt-1">
                  {selectedScenario.affectedBuildings}
                </div>
                <div className="text-[9px] text-slate-500">Buildings in plain</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#121317] border border-white/10">
                <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Users className="h-3 w-3 text-rose-400" /> DISPLACED POP
                </div>
                <div className="text-lg font-mono font-bold text-rose-400 mt-1">
                  {selectedScenario.displacedPop.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-500">Exposed residents</div>
              </div>
            </div>

            {/* Road Severance Warning */}
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-rose-300">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <span>ISOLATED TRANSPORT ARTERIES: {selectedScenario.cutOffRoadsKm} km of roads severed</span>
              </div>
              <span className="text-rose-300 font-bold">REROUTING ENGAGED</span>
            </div>

            {/* Launch Full Simulation Page */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono text-slate-400">
                Run parameter grid on the live 3D map:
              </span>
              <Magnetic>
                <Link
                  to="/app/map"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D4F826] hover:bg-[#c2e420] text-[#181A1E] font-mono text-xs font-bold transition-all shadow-md"
                >
                  <span>OPEN WHAT-IF SIMULATOR IN 3D</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Magnetic>
            </div>
          </div>

          {/* Human Story Callout Box (5 cols) */}
          <div className="lg:col-span-5 glass-dark rounded-3xl p-6 space-y-5 shadow-2xl text-white">
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-[#D4F826] font-bold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>THE HUMAN IMPACT</span>
            </div>

            <h3 className="font-display font-extrabold text-2xl text-white leading-tight">
              THE MODEL SEES A ZONE. <br />
              <span className="italic font-serif font-normal text-slate-300 underline decoration-[#D4F826] decoration-2">A PERSON SEES HOME.</span>
            </h3>

            <p className="font-sans text-sm text-slate-300 leading-relaxed">
              Behind every shaded pixel on our risk grid is a tea plantation worker’s cottage, a school bus on a morning run, 
              or an elder who cannot walk without assistance.
            </p>

            <div className="space-y-3 pt-2 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-[#121317] border border-white/10 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-violet-400 flex-none" />
                <div className="text-slate-300">
                  <strong className="text-white">GIS Point:</strong> Translates to a family in Chooralmala tea estate.
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#121317] border border-white/10 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-sky-400 flex-none" />
                <div className="text-slate-300">
                  <strong className="text-white">Road Vector:</strong> Translates to the only lifeline ambulance route to WIMS Hospital.
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#121317] border border-white/10 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-400 flex-none" />
                <div className="text-slate-300">
                  <strong className="text-white">Safe Polygon:</strong> Translates to warm food, dry bedding, and safety at St. Joseph School relief camp.
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#121317] border border-white/10 text-xs text-slate-300 font-medium leading-relaxed">
              Early action is not an academic KPI. A 45-minute advance warning is the difference between an orderly evacuation and a midnight rescue.
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
};

export default SimulationSection;
