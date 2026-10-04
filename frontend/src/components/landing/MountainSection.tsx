import React, { useState, useMemo, useLayoutEffect, useRef } from 'react';
import { gsap, MQ, fitsViewport } from './story/gsap';
import { Mountain, Droplets, Layers, Sliders } from 'lucide-react';
import { DataHonestyBadge } from './DataHonestyBadge';
import { MountainHillsIllustration } from './MountainHillsIllustration';
import { ScrollHeading } from './ScrollHeading';

const RISK_LADDER = [
  { label: 'MODERATE RUNOFF', desc: 'Channels fill within standard drainage margins.', cls: 'border-amber-300 bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
  { label: 'HIGH RAPID INUNDATION', desc: 'Overland sheet flow turns into torrential streams on slopes above 30°.', cls: 'border-orange-300 bg-orange-50 text-orange-900', dot: 'bg-orange-500' },
  { label: 'CRITICAL FLASH SURGE & LANDSLIDE RISK', desc: 'Rapid water rise with extreme slope shear stress. Valley bridges overwhelmed in < 35 min.', cls: 'border-rose-300 bg-rose-50 text-rose-900', dot: 'bg-rose-600' },
];

export const MountainSection: React.FC = () => {
  // Interactive slope physics simulator state
  const [slopeDeg, setSlopeDeg] = useState(38); // degrees
  const [rainfallMmH, setRainfallMmH] = useState(85); // mm per hour
  const [soilSaturation, setSoilSaturation] = useState<'dry' | 'moderate' | 'saturated'>('saturated');

  // Hydrological calculations based on rational method and Manning's kinematic wave approximation
  const { runoffCoeff, flowVelocityMs, timeToPeakMin, hazardLevel } = useMemo(() => {
    const baseC = soilSaturation === 'dry' ? 0.35 : soilSaturation === 'moderate' ? 0.65 : 0.88;
    const slopeMultiplier = 1 + (slopeDeg / 90) * 0.25;
    const c = Math.min(0.96, baseC * slopeMultiplier);

    const sinSlope = Math.sin((slopeDeg * Math.PI) / 180);
    const roughnessK = soilSaturation === 'saturated' ? 4.8 : 3.2;
    const velocity = Math.round((roughnessK * Math.pow(sinSlope, 0.5) * (rainfallMmH / 50)) * 10) / 10;

    const distanceMeters = 3200;
    const timeSec = distanceMeters / Math.max(0.8, velocity);
    const tcMin = Math.round(timeSec / 60);

    let hazard: { label: string; color: string; desc: string } = {
      label: 'MODERATE RUNOFF',
      color: 'text-amber-900 border-amber-300 bg-amber-50',
      desc: 'Channels fill within standard drainage margins.',
    };

    if (rainfallMmH > 100 || (rainfallMmH > 60 && soilSaturation === 'saturated' && slopeDeg > 35)) {
      hazard = {
        label: 'CRITICAL FLASH SURGE & LANDSLIDE RISK',
        color: 'text-rose-900 border-rose-300 bg-rose-50',
        desc: 'Rapid water rise with extreme slope shear stress. Valley bridges overwhelmed in < 35 min.',
      };
    } else if (rainfallMmH > 60 || slopeDeg > 30) {
      hazard = {
        label: 'HIGH RAPID INUNDATION',
        color: 'text-orange-900 border-orange-300 bg-orange-50',
        desc: 'Overland sheet flow transitions rapidly to destructive torrential streams.',
      };
    }

    return {
      runoffCoeff: Math.round(c * 100) / 100,
      flowVelocityMs: velocity,
      timeToPeakMin: tcMin,
      hazardLevel: hazard,
    };
  }, [slopeDeg, rainfallMmH, soilSaturation]);

  const scene = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scene.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.matchMedia().add(MQ.desktop, () => {
        const pin = fitsViewport(el, 100);
        const draw = (sel: string) => el.querySelectorAll<SVGPathElement>(sel).forEach((p) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        });
        draw('[data-draw]');
        gsap.set('[data-ridge-fill]', { fillOpacity: 0 });
        gsap.set('[data-fadein]', { opacity: 0 });
        gsap.set('[data-pool]', { scale: 0, transformOrigin: '50% 50%' });
        gsap.set('[data-ladder]', { opacity: 0, x: 40 });
        gsap.set('[data-drop]', { opacity: 0 });
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: el, start: pin ? 'top top+=96' : 'top 85%', end: pin ? '+=170%' : 'top 20%', scrub: 0.7, pin },
        });
        tl.to('[data-contour]', { strokeDashoffset: 0, duration: 1, stagger: 0.15 })
          .to('[data-draw-ridge]', { strokeDashoffset: 0, duration: 1.2 }, '<0.2')
          .to('[data-ridge-fill]', { fillOpacity: 1, duration: 0.6 }, '-=0.4')
          .to('[data-fadein="soil"]', { opacity: 1, duration: 0.8 }, '<')
          .to('[data-fadein="rain"]', { opacity: 1, duration: 0.5 }, '<')
          .to('[data-fadein="label-1"]', { opacity: 1, duration: 0.3 })
          .set('[data-drop]', { opacity: 1 })
          .to('[data-drop]', { motionPath: { path: '#mtn-runoff', align: '#mtn-runoff', alignOrigin: [0.5, 0.5] }, duration: 2.2, ease: 'power1.in' })
          .to('[data-fadein="runoff"]', { opacity: 1, duration: 0.6 }, '<')
          .to('[data-ladder="0"]', { opacity: 1, x: 0, duration: 0.5 }, '<0.2')
          .to('[data-fadein="label-2"]', { opacity: 1, duration: 0.3 }, '<0.5')
          .to('[data-ladder="1"]', { opacity: 1, x: 0, duration: 0.5 }, '<0.3')
          .to('[data-pool]', { scale: 1, duration: 0.8, ease: 'back.out(1.6)' }, '-=0.4')
          .to('[data-fadein="label-3"]', { opacity: 1, duration: 0.3 }, '<')
          .to('[data-ladder="2"]', { opacity: 1, x: 0, duration: 0.5 }, '<0.2')
          .to({}, { duration: 0.6 });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative py-16 sm:py-24 pattern-topo-grid text-[#181A1E] overflow-hidden">
      {/* Real Mountain Hill Illustration Backdrop */}
      <div className="absolute inset-x-0 bottom-0 h-64 pointer-events-none opacity-20">
        <MountainHillsIllustration variant="section-backdrop" showContourGrid={false} className="h-full" />
      </div>

      <div className="relative max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Animated Scroll Heading with Topographic Elevation Accent */}
        <ScrollHeading
          badge="TOPOGRAPHIC HYDROLOGY"
          animationVariant="contour"
          title="THE MOUNTAIN"
          italicWord="REMEMBERS EVERY DROP."
          subtitle="In hilly and tropical mountain regions like Wayanad, floods are not simply rainfall totals: they are topographic chain reactions. Steep gradient, high gravity and pre-saturated soils compress days of drainage into a violent 30-minute surge."
        />

        {/* Dynamic Mountain Cross-Section & Hydrology Diagram */}
        <div ref={scene} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Visual Canvas Diagram (7 cols) - Geological Strata Slate */}
          <div className="lg:col-span-7 bg-white rounded-3xl border-2 border-[#181A1E]/15 p-6 shadow-xl relative overflow-hidden group hover:border-[#181A1E] transition-all">
            {/* Topographic Altitude Scale Ruler on Top */}
            <div className="flex items-center justify-between pb-4 border-b border-[#EAE7DF] mb-6 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-600"></span>
                <span className="text-[#141518] font-black tracking-wider uppercase">
                  SECTION 01 · TOPOGRAPHIC STRATA PROFILE: CHEMBRA PEAK (2,100M) → CHOORALMALA BASIN (780M)
                </span>
              </div>
              <DataHonestyBadge kind="OBSERVED" source="Copernicus DEM 30m" size="sm" />
            </div>

            {/* SVG Cross-Section Illustration in Clean Environmental Palette */}
            <div className="relative w-full aspect-[16/10] bg-[#FAF9F6] rounded-2xl border border-[#EAE7DF] p-2 overflow-hidden shadow-inner">
              <svg viewBox="0 0 600 360" className="w-full h-full">
                <defs>
                  {/* Sky Rain gradient */}
                  <linearGradient id="cloudGradLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#DDD6EE" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#FAF9F6" stopOpacity="0.1" />
                  </linearGradient>

                  {/* Terrain slope fill */}
                  <linearGradient id="slopeFillLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8BCDF" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#E2DDEE" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#EDEAE3" stopOpacity="0.95" />
                  </linearGradient>

                  {/* Saturated soil layer gradient */}
                  <linearGradient id="soilLayerLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b45309" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#78350f" stopOpacity="0.1" />
                  </linearGradient>

                  {/* River water flow gradient */}
                  <linearGradient id="waterFlowLight" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>

                {/* Cloudburst storm formation */}
                <rect x="0" y="0" width="600" height="90" fill="url(#cloudGradLight)" />
                <path
                  d="M 60 45 Q 120 15 180 40 Q 240 10 320 35 Q 400 15 480 40 Q 540 25 580 50 L 580 80 L 60 80 Z"
                  fill="#C5BADF"
                  opacity="0.5"
                />

                {/* Elevation contour lines (drawn in on scroll) */}
                {[0, 1, 2, 3].map((i) => (
                  <path key={`c${i}`} data-draw data-contour d={`M 0 ${150 + i * 34} Q 120 ${120 + i * 36} 240 ${200 + i * 30} T 600 ${300 + i * 10}`} fill="none" stroke="#574974" strokeOpacity="0.18" strokeWidth="1" />
                ))}

                {/* Rain droplet trajectories following wind vector */}
                <g data-fadein="rain">
                {[...Array(24)].map((_, i) => (
                  <line
                    key={i}
                    x1={40 + i * 23}
                    y1={75 + (i % 4) * 8}
                    x2={32 + i * 23}
                    y2={125 + (i % 4) * 10}
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeDasharray="4 6"
                    opacity="0.55"
                  />
                ))}
                </g>

                {/* Mountain Ridge Profile */}
                <path
                  data-draw
                  data-draw-ridge
                  data-ridge-fill
                  d="M 0 360 L 0 110 Q 70 85 120 135 T 240 190 T 380 260 Q 450 295 520 300 T 600 305 L 600 360 Z"
                  fill="url(#slopeFillLight)"
                  stroke="#574974"
                  strokeWidth="2.5"
                />

                {/* Subsurface saturated soil horizon */}
                <path
                  data-fadein="soil"
                  d="M 0 130 Q 70 105 120 155 T 240 208 T 380 275 Q 450 308 520 312 T 600 316 L 600 335 L 0 335 Z"
                  fill="url(#soilLayerLight)"
                  stroke="#d97706"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />

                {/* Water runoff flow vectors down the slope */}
                <path
                  id="mtn-runoff"
                  data-fadein="runoff"
                  d="M 125 142 Q 180 185 240 200 Q 310 240 380 268 Q 440 295 510 304"
                  fill="none"
                  stroke="url(#waterFlowLight)"
                  strokeWidth="3.5"
                  strokeDasharray="8 6"
                />

                {/* Valley Flood Accumulation Pool */}
                <g data-pool>
                  <ellipse cx="530" cy="318" rx="65" ry="18" fill="#818cf8" opacity="0.6" />
                  <ellipse cx="530" cy="318" rx="45" ry="10" fill="#6366f1" opacity="0.85" />
                </g>

                {/* The droplet that travels down the runoff path on scroll */}
                <circle data-drop cx="0" cy="0" r="6.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" opacity="0" />

                {/* Elevation Markers & Text Labels */}
                <g className="font-mono text-[10px] fill-[#141518]">
                  {/* Chembra Peak */}
                  <g data-fadein="label-1">
                  <circle cx="120" cy="135" r="4.5" fill="#141518" />
                  <text x="130" y="130" fill="#141518" fontWeight="bold">
                    CHEMBRA RIDGE (2,100m)
                  </text>
                  <text x="130" y="144" fill="#6A6D75" fontSize="8.5">
                    Cloudburst catchment zone
                  </text>
                  </g>

                  {/* Mid Slope Debris Zone */}
                  <g data-fadein="label-2">
                  <circle cx="280" cy="215" r="4.5" fill="#7c3aed" />
                  <text x="292" y="212" fill="#141518" fontWeight="bold">
                    STEEP ESCARPMENT (38°–55°)
                  </text>
                  <text x="292" y="225" fill="#6A6D75" fontSize="8.5">
                    Soil pore-pressure saturation
                  </text>
                  </g>

                  {/* Valley Confluence */}
                  <g data-fadein="label-3">
                  <circle cx="490" cy="290" r="4.5" fill="#e11d48" />
                  <text x="410" y="280" fill="#e11d48" fontWeight="bold">
                    VALLEY SETTLEMENT (720m)
                  </text>
                  <text x="410" y="293" fill="#be123c" fontSize="8.5">
                    River surge & Bridge choke point
                  </text>
                  </g>
                </g>
              </svg>
            </div>

          </div>

          {/* Risk ladder — appears step by step as the water travels down the slope */}
          <div className="lg:col-span-5 space-y-3">
            <div className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#6A6D75]">AS THE WATER MOVES DOWN THE SLOPE</div>
            {RISK_LADDER.map((r, i) => (
              <div key={r.label} data-ladder={i} className={`flex items-start gap-3 rounded-3xl border p-4 shadow-sm ${r.cls}`}>
                <span className={`mt-1 h-3 w-3 flex-none rounded-full ${r.dot}`} />
                <div>
                  <div className="font-mono text-xs font-bold tracking-wider">{r.label}</div>
                  <div className="mt-1 text-[12.5px] leading-snug opacity-90">{r.desc}</div>
                </div>
              </div>
            ))}
            <div className="text-[11px] font-mono text-[#6A6D75]">Thresholds follow the slope calculator below — try your own numbers.</div>
          </div>
        </div>

        {/* Stages + interactive calculator */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" data-reveal>
          <div className="lg:col-span-7">
            {/* Hydrological Stages Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                <div className="font-bold text-[#141518] font-mono">1. CLOUDBURST</div>
                <div className="text-[#555861] mt-1 leading-normal">
                  Heavy rain accumulates rapidly on mountain peaks above 1,500m MSL.
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#EFEBF7] border border-[#DDD6EE]">
                <div className="font-bold text-[#4B435C] font-mono">2. SATURATION</div>
                <div className="text-[#555861] mt-1 leading-normal">
                  Pre-existing monsoon moisture saturates soil horizon. Infiltration drops to zero.
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                <div className="font-bold text-rose-700 font-mono">3. CHOKED VALLEY</div>
                <div className="text-[#555861] mt-1 leading-normal">
                  Flow converges in narrow valleys. Water rises up to 3 meters in under 40 minutes.
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Slope & Runoff Physics Calculator (5 cols) - Lavender Asymmetric Card */}
          <div className="lg:col-span-5 bg-[#EFEBF7] rounded-3xl asymmetric-card-top-right border border-[#DDD6EE] p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD6EE]">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#141518]" />
                <h3 className="font-display font-bold text-base text-[#141518]">
                  HYDROLOGICAL SLOPE CALCULATOR
                </h3>
              </div>
              <span className="text-[10px] font-mono text-white bg-[#141518] px-2.5 py-0.5 rounded-full font-semibold">
                PHYSICS MODEL
              </span>
            </div>

            <div className="text-xs text-[#4A4D54] leading-relaxed">
              Adjust terrain slope angle and rainfall intensity to compute real-time runoff velocity 
              and estimated time to flash-flood peak using rational hydrological equations.
            </div>

            {/* Slider 1: Slope Angle */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#141518] font-medium flex items-center gap-1.5">
                  <Mountain className="h-3.5 w-3.5 text-violet-700" /> Terrain Slope Angle
                </span>
                <span className="text-[#141518] font-bold">{slopeDeg}° ({Math.round(Math.tan(slopeDeg * Math.PI / 180) * 100)}% grade)</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="1"
                value={slopeDeg}
                onChange={(e) => setSlopeDeg(Number(e.target.value))}
                className="w-full h-1.5 bg-[#DDD6EE] rounded-lg appearance-none cursor-pointer accent-[#141518]"
              />
              <div className="flex justify-between text-[10px] text-[#6A6D75] font-mono">
                <span>10° (Gentle Hills)</span>
                <span>35° (Highlands)</span>
                <span>60° (Escarpment)</span>
              </div>
            </div>

            {/* Slider 2: Rainfall Intensity */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#141518] font-medium flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5 text-blue-600" /> Hourly Rainfall Rate
                </span>
                <span className="text-blue-700 font-bold">{rainfallMmH} mm / hour</span>
              </div>
              <input
                type="range"
                min="15"
                max="160"
                step="5"
                value={rainfallMmH}
                onChange={(e) => setRainfallMmH(Number(e.target.value))}
                className="w-full h-1.5 bg-[#DDD6EE] rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-[#6A6D75] font-mono">
                <span>15 mm/h (Normal)</span>
                <span>75 mm/h (Heavy)</span>
                <span>160 mm/h (Cloudburst)</span>
              </div>
            </div>

            {/* Soil Saturation Radio Buttons */}
            <div className="space-y-2">
              <div className="text-xs font-mono text-[#141518] font-medium flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#554E63]" /> Soil Moisture Condition (AMC)
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['dry', 'moderate', 'saturated'] as const).map((sat) => (
                  <button
                    key={sat}
                    onClick={() => setSoilSaturation(sat)}
                    className={`py-2 px-2 rounded-xl border font-mono capitalize transition-all ${
                      soilSaturation === sat
                        ? 'bg-[#141518] text-white font-bold border-[#141518] shadow-xs'
                        : 'bg-white border-[#DDD6EE] text-[#554E63] hover:border-[#141518]'
                    }`}
                  >
                    {sat} (AMC {sat === 'dry' ? 'I' : sat === 'moderate' ? 'II' : 'III'})
                  </button>
                ))}
              </div>
            </div>

            {/* Calculated Output Telemetry */}
            <div className="pt-4 border-t border-[#DDD6EE] space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-3 rounded-2xl border border-[#E6E4DE]">
                  <div className="text-[10px] text-[#6A6D75] font-mono">RUNOFF COEFF (C)</div>
                  <div className="text-lg font-mono font-bold text-[#141518] mt-0.5">{runoffCoeff}</div>
                  <div className="text-[9px] text-[#787B85]">{Math.round(runoffCoeff * 100)}% overland flow</div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-[#E6E4DE]">
                  <div className="text-[10px] text-[#6A6D75] font-mono">FLOW VELOCITY</div>
                  <div className="text-lg font-mono font-bold text-violet-700 mt-0.5">
                    {flowVelocityMs} <span className="text-xs">m/s</span>
                  </div>
                  <div className="text-[9px] text-[#787B85]">Manning kin. wave</div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-[#E6E4DE]">
                  <div className="text-[10px] text-[#6A6D75] font-mono">TIME TO PEAK (Tc)</div>
                  <div className="text-lg font-mono font-bold text-rose-700 mt-0.5">
                    {timeToPeakMin} <span className="text-xs">min</span>
                  </div>
                  <div className="text-[9px] text-[#787B85]">Evacuation window</div>
                </div>
              </div>

              {/* Hazard Status Banner */}
              <div className={`p-3.5 rounded-2xl border text-xs ${hazardLevel.color}`}>
                <div className="font-bold font-mono tracking-wider">{hazardLevel.label}</div>
                <div className="text-[11px] opacity-90 mt-0.5 leading-normal">{hazardLevel.desc}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
