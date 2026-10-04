import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap, MQ } from './story/gsap';
import {
  CloudRain,
  Radio,
  Satellite,
  Mountain,
  Droplet,
  Compass,
  TreePine,
  Layers,
  Building,
  Video,
  Cpu,
  ShieldAlert,
  Users,
  Compass as CompassIcon,
} from 'lucide-react';
import { DataHonestyBadge, DataHonestyKind } from './DataHonestyBadge';
import ScrollHeading from './ScrollHeading';

interface SignalItem {
  id: string;
  name: string;
  source: string;
  category: string;
  status: DataHonestyKind;
  description: string;
  resolution: string;
  freq: string;
  icon: any;
}

const SIGNALS: SignalItem[] = [
  {
    id: 'rain-imd',
    name: 'Automatic Weather Stations (AWS)',
    source: 'IMD & Kerala State Disaster Management',
    category: 'ATMOSPHERE',
    status: 'OBSERVED',
    description: 'Hourly rainfall accumulation, 15-minute peak intensity spikes, and tipping bucket telemetry.',
    resolution: 'Station point',
    freq: 'Every 15 min',
    icon: CloudRain,
  },
  {
    id: 'open-meteo',
    name: 'Numerical Weather Prediction (NWP)',
    source: 'Open-Meteo High-Res + ECMWF IFS',
    category: 'ATMOSPHERE',
    status: 'OBSERVED',
    description: 'Convective precipitation probability, cloud cover depth, and atmospheric instability indices.',
    resolution: '1 km mesh',
    freq: 'Hourly',
    icon: Radio,
  },
  {
    id: 'radar',
    name: 'Doppler Weather Radar (DWR)',
    source: 'IMD Kochi Radar Telemetry',
    category: 'ATMOSPHERE',
    status: 'OBSERVED',
    description: 'Radar reflectivity factor (dBZ) capturing localized cloudburst cores tracking east over Ghats.',
    resolution: '250 m radial',
    freq: 'Every 10 min',
    icon: Satellite,
  },
  {
    id: 'elevation',
    name: 'Digital Elevation Model (DEM)',
    source: 'Copernicus GLO-30 / CartoDEM',
    category: 'TERRAIN',
    status: 'OBSERVED',
    description: 'High-precision topography, ridge vectors, escarpments and catchment pour-point delineation.',
    resolution: '30 meters',
    freq: 'Static baseline',
    icon: Mountain,
  },
  {
    id: 'slope',
    name: 'Slope Gradient & Flow Direction',
    source: 'Hydrological Surface Analysis',
    category: 'TERRAIN',
    status: 'DERIVED',
    description: 'Steepness calculation (0° to 62°) dictating overland kinetic energy and micro-drainage velocity.',
    resolution: '30 meters',
    freq: 'Static derived',
    icon: Compass,
  },
  {
    id: 'soil',
    name: 'Soil Moisture & Antecedent Saturation (AMC)',
    source: 'SMAP Satellite + Agricultural Soil Grid',
    category: 'HYDROLOGY',
    status: 'DERIVED',
    description: 'Pre-existing soil water retention level. High saturation (AMC III) converts 90%+ rain to instant runoff.',
    resolution: '1 km raster',
    freq: 'Daily refresh',
    icon: Droplet,
  },
  {
    id: 'landcover',
    name: 'Land Use & Infiltration Cover',
    source: 'ESA WorldCover 10m',
    category: 'TERRAIN',
    status: 'OBSERVED',
    description: 'Tea plantation vs dense forest vs impervious road surface influencing water retention capacity.',
    resolution: '10 meters',
    freq: 'Annual update',
    icon: TreePine,
  },
  {
    id: 'stream',
    name: 'River & Stream Drainage Channels',
    source: 'OpenStreetMap Hydrographic Vectors',
    category: 'HYDROLOGY',
    status: 'OBSERVED',
    description: 'Chaliyar, Kabini and tributary stream centrelines, natural ravines, and culvert choke points.',
    resolution: 'Vector paths',
    freq: 'Continuous edit',
    icon: Layers,
  },
  {
    id: 'assets',
    name: 'Buildings & Critical Infrastructure',
    source: 'OSM + Local Panchayath Geoportal',
    category: 'VULNERABILITY',
    status: 'OBSERVED',
    description: 'Hospitals, relief camps, bridges, schools, and vulnerable valley settlement clusters.',
    resolution: 'Building footprints',
    freq: 'Weekly sync',
    icon: Building,
  },
  {
    id: 'cameras',
    name: 'Bridge & Chokepoint Edge AI Cameras',
    source: 'FloodGuard Planned Sensor Mesh',
    category: 'VISION',
    status: 'PLANNED',
    description: 'Optical computer vision measuring water surface level rise and torrent velocity at key bridges.',
    resolution: '1080p Optical',
    freq: 'Sub-second edge',
    icon: Video,
  },
  {
    id: 'iot',
    name: 'Culvert & Stream Ultrasonic Depth Nodes',
    source: 'FloodGuard IoT Pilot Hardware',
    category: 'IOT',
    status: 'PLANNED',
    description: 'Solar micro-sensors mounted under mountain road culverts logging surge water height.',
    resolution: '± 2 cm depth',
    freq: 'Every 60 sec',
    icon: Cpu,
  },
];

export const SignalsConvergenceSection: React.FC = () => {
  const [selectedSignal, setSelectedSignal] = useState<SignalItem>(SIGNALS[0]);
  const grid = useRef<HTMLDivElement>(null);

  // Convergence: source cards fly in from the left, outputs from the right, connectors draw into the engine.
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(MQ.desktop, () => {
        el.querySelectorAll<SVGPathElement>('[data-connector]').forEach((p) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        });
        const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 30%', scrub: 0.8 } });
        tl.from('[data-signal]', { x: -160, opacity: 0, rotate: -3, stagger: 0.06, duration: 0.6 })
          .from('[data-output]', { x: 160, opacity: 0, rotate: 3, stagger: 0.12, duration: 0.6 }, '<0.2')
          .to('[data-connector]', { strokeDashoffset: 0, duration: 0.8, stagger: 0.1 }, '<0.3')
          .from('[data-engine]', { scale: 0.82, opacity: 0, duration: 0.6 }, '<0.2')
          .to('[data-engine]', { boxShadow: '0 0 80px -10px rgba(212,248,38,0.45)', duration: 0.4 });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative py-16 sm:py-24 text-[#FAF9F6] overflow-hidden">
      <div className="relative max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Animated Scroll Heading with Multi-Sensor Convergence Accent */}
        <ScrollHeading
          theme="dark"
          badge="MULTI-SOURCE INTELLIGENCE CONVERGENCE"
          animationVariant="crosshair"
          title="ONE FLOOD."
          italicWord="MANY SIGNALS."
          subtitle="No single sensor or satellite image can predict a flash flood. FloodGuard fuses atmospheric, geospatial, hydrological, structural and edge telemetry into a singular real-time risk model."
        />

        {/* Convergence Architecture Flow */}
        <div ref={grid} className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* connector lines from the sources into the engine and out to the outputs (desktop) */}
          <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {[22, 38, 50, 62, 78].map((y, i) => (
              <path key={`l${i}`} data-connector d={`M 40 ${y} C 46 ${y}, 44 50, 50 50`} fill="none" stroke="#D4F826" strokeOpacity="0.45" strokeWidth="0.25" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
            ))}
            {[30, 50, 70].map((y, i) => (
              <path key={`r${i}`} data-connector d={`M 70 50 C 74 50, 72 ${y}, 76 ${y}`} fill="none" stroke="#D4F826" strokeOpacity="0.45" strokeWidth="0.25" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {/* Signal Stream Chips (5 cols) - Telemetry Rack Architecture */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-mono text-slate-400 flex items-center justify-between pb-2 border-b border-white/10">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D4F826] animate-pulse"></span>
                <span className="font-bold tracking-wider text-white">SECTION 02 · SENSOR TELEMETRY RACK (11 BUS CHANNELS)</span>
              </span>
              <span className="text-[10px] text-[#D4F826] font-mono">LIVE FEED</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 max-h-[540px] overflow-y-auto pr-1 no-scrollbar">
              {SIGNALS.map((sig, idx) => {
                const Icon = sig.icon;
                const isSelected = selectedSignal.id === sig.id;
                return (
                  <button
                    key={sig.id}
                    data-signal
                    onClick={() => setSelectedSignal(sig)}
                    className={`group relative flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#1E2028] border-[#D4F826] shadow-xl shadow-black/50 text-white translate-x-1'
                        : 'bg-[#15171C]/90 border-[#2A2E39] hover:border-white/30 hover:bg-[#1C1F26] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl transition-all ${
                          isSelected ? 'bg-[#D4F826] text-[#181A1E] shadow-[0_0_12px_rgba(212,248,38,0.4)]' : 'bg-white/10 text-white group-hover:scale-110'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold leading-tight">{sig.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-400">CH-0{idx + 1}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{sig.source} · <span className="text-[#D4F826]/80">{sig.freq}</span></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Mini Oscilloscope Waveform on Hover / Select */}
                      <div className="hidden sm:flex items-center gap-0.5 h-4 w-8 px-1">
                        <span className={`w-1 rounded-full bg-[#D4F826] ${isSelected ? 'h-3 animate-pulse' : 'h-1 group-hover:h-2'}`} />
                        <span className={`w-1 rounded-full bg-[#D4F826] ${isSelected ? 'h-4 animate-pulse' : 'h-1.5 group-hover:h-3'}`} />
                        <span className={`w-1 rounded-full bg-[#D4F826] ${isSelected ? 'h-2 animate-pulse' : 'h-1 group-hover:h-1.5'}`} />
                      </div>
                      <DataHonestyBadge kind={sig.status} size="sm" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Central Convergence Engine Box (4 cols) - Deep Obsidian Card */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div data-engine className="glow-card w-full relative p-6 rounded-3xl glass-dark shadow-2xl text-center space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[#D4F826] text-[10px] font-mono font-bold tracking-wider uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D4F826] animate-pulse"></span>
                <span>CENTRAL RISK ENGINE</span>
              </div>

              <div className="mx-auto w-16 h-16 rounded-2xl bg-[#121317] border border-[#2E323D] text-[#D4F826] flex items-center justify-center shadow-inner">
                <Cpu className="h-8 w-8 text-[#D4F826]" />
              </div>

              <div>
                <h3 className="font-display font-bold text-lg text-white">
                  FLOODGUARD ML RISK ENGINE
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Calibrated Cell Infiltration &amp; Dynamic Inundation Solver
                </p>
              </div>

              {/* Active Inspector card for selected signal */}
              <div className="p-4 rounded-2xl bg-[#121317] border border-white/10 text-left space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white font-bold">{selectedSignal.name}</span>
                  <span className="text-[#D4F826] font-semibold">{selectedSignal.resolution}</span>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed font-sans">
                  {selectedSignal.description}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono text-slate-400">
                  <span>FREQ: {selectedSignal.freq}</span>
                  <DataHonestyBadge kind={selectedSignal.status} size="sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Three Operational Outputs (3 cols) */}
          <div className="lg:col-span-3 space-y-3.5">
            <div className="text-xs font-mono text-slate-400 pb-2 border-b border-white/10">
              OPERATIONAL OUTPUTS
            </div>

            {/* Output 1: Risk */}
            <div data-output className="hover-lift p-4 rounded-3xl glass-dark border-rose-500/30 shadow-xs space-y-1.5 hover:border-rose-400 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-rose-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-rose-400" /> 1. HYPERLOCAL RISK
                </span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full font-bold">
                  REAL-TIME
                </span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                Probability scores (0.00 – 1.00) assigned across 100m terrain cells with calibrated confidence intervals.
              </div>
            </div>

            {/* Output 2: Impact */}
            <div data-output className="hover-lift p-4 rounded-3xl glass-dark border-amber-500/30 shadow-xs space-y-1.5 hover:border-amber-400 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-amber-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-amber-400" /> 2. POPULATION AT RISK
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                  OVERLAY
                </span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                Estimated residents, cut off access corridors, and healthcare facilities threatened within 60 minutes.
              </div>
            </div>

            {/* Output 3: Route */}
            <div data-output className="hover-lift p-4 rounded-3xl glass-dark border-emerald-500/30 shadow-xs space-y-1.5 hover:border-emerald-400 transition-colors">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <CompassIcon className="h-4 w-4 text-emerald-400" /> 3. SAFE CORRIDORS
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  ACTIVE
                </span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                Turn-by-turn uphill routes to pre-verified panchayath relief camps avoiding flooded culverts.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignalsConvergenceSection;
