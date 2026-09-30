import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sliders,
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

export const SimulationSection: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioConfig>(SCENARIOS[1]);

  return (
    <section id="simulation" className="relative py-20 sm:py-28 bg-[#0E1015] border-t border-[#262830] text-[#FAF9F6] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Animated Scroll Heading with Scenario Simulation Accent */}
        <ScrollHeading
          theme="dark"
          badge="WHAT-IF FLOOD SIMULATION & HUMAN IMPACT"
          animationVariant="depth"
          title="WHAT HAPPENS"
          italicWord="IF THE RAIN KEEPS FALLING?"
          subtitle="Flash flood defense requires proactive foresight. FloodGuard allows emergency managers to simulate synthetic precipitation scenarios before cloudbursts occur, identifying exactly which bridges will be severed and which shelters to pre-activate."
        />

        {/* Scenario Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-[#181A22] border border-[#2E3240] mb-8 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-mono text-white font-bold">
            <Sliders className="h-4 w-4 text-[#D4F826]" />
            <span>SELECT SIMULATION SCENARIO:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((sc) => {
              const isActive = selectedScenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc)}
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
          <div className="lg:col-span-7 bg-[#1A1C23] rounded-3xl border border-[#2E3240] p-6 space-y-6 shadow-2xl">
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
              <Link
                to="/app/map"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D4F826] hover:bg-[#c2e420] text-[#181A1E] font-mono text-xs font-bold transition-all shadow-md"
              >
                <span>OPEN WHAT-IF SIMULATOR IN 3D</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Human Story Callout Box (5 cols) */}
          <div className="lg:col-span-5 bg-[#181A22] rounded-3xl border border-[#2E3240] p-6 space-y-5 shadow-2xl text-white">
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
    </section>
  );
};

export default SimulationSection;
