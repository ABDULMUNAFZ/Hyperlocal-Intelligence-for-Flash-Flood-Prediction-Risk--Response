import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap, MQ } from './story/gsap';
import {
  Video,
  AlertTriangle,
  Crosshair,
  CheckCircle2,
} from 'lucide-react';
import { DataHonestyBadge } from './DataHonestyBadge';
import ScrollHeading from './ScrollHeading';

interface CameraNode {
  id: string;
  code: string;
  name: string;
  coordinates: string;
  elevationM: number;
  fovAngle: number;
  status: 'NORMAL' | 'ALERT';
  primaryTarget: string;
  solarBatteryPct: number;
  anomalyDetected: boolean;
  detectedEvent?: string;
  waterRiseCmPerHour?: number;
  confidencePct: number;
}

const CAMERAS: CameraNode[] = [
  {
    id: 'cam-01',
    code: 'CAM-CHB-01',
    name: 'Upper Chembra Escarpment Chokepoint',
    coordinates: '11.5518° N, 76.0892° E',
    elevationM: 1420,
    fovAngle: 85,
    status: 'ALERT',
    primaryTarget: 'Upper Orographic Runoff Torrent Channel',
    solarBatteryPct: 94,
    anomalyDetected: true,
    detectedEvent: 'Torrential turbidity surge & sudden water surface expansion',
    waterRiseCmPerHour: 48,
    confidencePct: 91,
  },
  {
    id: 'cam-02',
    code: 'CAM-CHO-02',
    name: 'Chooralmala River Bridge (Bailey Site)',
    coordinates: '11.5332° N, 76.1287° E',
    elevationM: 780,
    fovAngle: 110,
    status: 'ALERT',
    primaryTarget: 'Main Riverbank Culvert & Pillar Clearance',
    solarBatteryPct: 88,
    anomalyDetected: true,
    detectedEvent: 'Freeboard clearance reduced to under 1.2 meters',
    waterRiseCmPerHour: 62,
    confidencePct: 96,
  },
  {
    id: 'cam-03',
    code: 'CAM-MUN-03',
    name: 'Mundakkai Upstream Ravine Confluence',
    coordinates: '11.5420° N, 76.1410° E',
    elevationM: 890,
    fovAngle: 90,
    status: 'ALERT',
    primaryTarget: 'Gully Erosion & Debris Flow Choke Point',
    solarBatteryPct: 92,
    anomalyDetected: true,
    detectedEvent: 'Mudflow velocity exceedance & micro-debris jam',
    waterRiseCmPerHour: 55,
    confidencePct: 89,
  },
  {
    id: 'cam-04',
    code: 'CAM-MEP-04',
    name: 'Meppadi Valley Culvert Junction',
    coordinates: '11.5540° N, 76.1280° E',
    elevationM: 760,
    fovAngle: 75,
    status: 'NORMAL',
    primaryTarget: 'Culvert Throat Drainage Capacity',
    solarBatteryPct: 98,
    anomalyDetected: false,
    waterRiseCmPerHour: 12,
    confidencePct: 94,
  },
  {
    id: 'cam-05',
    code: 'CAM-KAL-05',
    name: 'Kalpetta Outflow Gauge Station',
    coordinates: '11.6080° N, 76.0830° E',
    elevationM: 780,
    fovAngle: 80,
    status: 'NORMAL',
    primaryTarget: 'Downstream Lowland Floodplain Discharge',
    solarBatteryPct: 100,
    anomalyDetected: false,
    waterRiseCmPerHour: 8,
    confidencePct: 97,
  },
  {
    id: 'cam-06',
    code: 'CAM-VYT-06',
    name: 'Vythiri Highland Stream Monitor',
    coordinates: '11.5510° N, 76.0420° E',
    elevationM: 1050,
    fovAngle: 95,
    status: 'NORMAL',
    primaryTarget: 'High-Rainfall Ridge Drainage',
    solarBatteryPct: 91,
    anomalyDetected: false,
    waterRiseCmPerHour: 14,
    confidencePct: 93,
  },
];

export const CameraNetworkSection: React.FC = () => {
  const [activeCam, setActiveCam] = useState<CameraNode>(CAMERAS[1]);
  const mapRef = useRef<HTMLDivElement>(null);

  // Camera nodes pop onto the map one by one, each with a radar ping, as the map scrolls into view.
  useLayoutEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const build = (scrub: boolean) => {
        const nodes = el.querySelectorAll<SVGGElement>('[data-cam]');
        const tl = gsap.timeline({
          scrollTrigger: scrub
            ? { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 }
            : { trigger: el, start: 'top 80%', once: true },
        });
        tl.from('[data-river]', { opacity: 0, duration: 0.4 });
        nodes.forEach((n, i) => {
          const at = 0.3 + i * 0.35;
          tl.from(n, { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: 0.35, ease: 'back.out(2)' }, at)
            .fromTo(n.querySelector('[data-ping]'), { attr: { r: 4 }, opacity: 0.9 }, { attr: { r: 30 }, opacity: 0, duration: 0.6, ease: 'power1.out' }, at);
        });
      };
      mm.add(MQ.desktop, () => build(true));
      mm.add(MQ.mobile, () => build(false));
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative py-16 sm:py-24 text-[#FAF9F6] overflow-hidden">
      {/* CCTV Scanline Sweep Animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        <div className="w-full h-1 bg-[#D4F826] shadow-[0_0_8px_#D4F826] animate-scanline-drop" />
      </div>

      <div className="relative max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Animated Scroll Heading with Optical Viewfinder Crosshair Accent */}
        <ScrollHeading
          theme="dark"
          badge="AI SENSOR LAYER · PRODUCTION CONCEPT"
          animationVariant="crosshair"
          title="PUT EYES"
          italicWord="ON THE MOUNTAIN."
          subtitle="In production, FloodGuard is architected to integrate strategically positioned solar-powered edge AI cameras at key mountain chokepoints, river bridges, and steep escarpments to spot physical anomalies before water reaches settlements."
        />

        {/* Technical Credibility Notice */}
        <div className="p-4 rounded-2xl bg-[#1A1C23] border border-violet-500/30 mb-8 text-xs flex items-start gap-3 shadow-xs">
          <AlertTriangle className="h-4 w-4 text-violet-400 mt-0.5 flex-none" />
          <div className="text-slate-300 leading-relaxed font-sans">
            <strong className="text-white">Scientific Integrity Note:</strong> Computer vision alone cannot predict a flood. 
            Camera detections act strictly as <em>supplementary physical validation signals</em> that feed our anomaly detection pipeline, 
            which then correlates with weather, radar, and terrain models before alerting certified human administrators.
          </div>
        </div>

        {/* Interactive Camera Nodes Map & Camera Stream Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Camera Selection List & Stylized Wayanad Map (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-white/10">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D4F826] animate-pulse"></span>
                <span className="text-white font-bold tracking-wider uppercase">SECTION 04 · STRATEGIC CCTV SENSOR NODES (6 CHOKEPOINTS)</span>
              </span>
              <span className="text-[10px] text-[#D4F826] font-mono">OPTICAL HUD</span>
            </div>

            {/* Stylized Node Placement Map - Tactical CCTV Frame */}
            <div ref={mapRef} className="relative w-full aspect-[16/9] glass-dark rounded-3xl border-2 border-white/15 p-4 overflow-hidden shadow-2xl group hover:border-[#D4F826] transition-all">
              {/* Background Topo Curves */}
              <div className="absolute inset-0 light-contour-lines opacity-10 pointer-events-none" />

              <svg viewBox="0 0 600 340" className="w-full h-full relative z-10 select-none">
                {/* Elevation Contours */}
                <path d="M 50 180 Q 150 100 300 130 T 550 120" stroke="#333845" strokeWidth="1" fill="none" strokeDasharray="3 3" />
                <path d="M 30 220 Q 200 150 350 200 T 580 180" stroke="#333845" strokeWidth="1" fill="none" />
                <path d="M 60 260 Q 220 220 380 250 T 570 230" stroke="#333845" strokeWidth="1" fill="none" strokeDasharray="3 3" />

                {/* River Vector (Chaliyar Tributary) */}
                <path data-river d="M 120 70 Q 240 160 320 210 T 480 320" stroke="#0284c7" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.75" />

                {/* Camera Markers */}
                {CAMERAS.map((cam, idx) => {
                  const positions = [
                    { cx: 160, cy: 110 },
                    { cx: 270, cy: 175 },
                    { cx: 330, cy: 140 },
                    { cx: 310, cy: 220 },
                    { cx: 420, cy: 260 },
                    { cx: 120, cy: 170 },
                  ];
                  const pos = positions[idx];
                  const isSelected = activeCam.id === cam.id;

                  return (
                    <g
                      key={cam.id}
                      data-cam
                      onClick={() => setActiveCam(cam)}
                      className="cursor-pointer"
                    >
                      {/* Radar ping when the node appears */}
                      <circle data-ping cx={pos.cx} cy={pos.cy} r="4" fill="none" stroke="#D4F826" strokeWidth="1.5" opacity="0" />

                      {/* Pulse Circle for Alert */}
                      {cam.status === 'ALERT' && (
                        <circle
                          cx={pos.cx}
                          cy={pos.cy}
                          r="12"
                          fill="rgba(225, 29, 72, 0.3)"
                          className="animate-ping"
                        />
                      )}

                      {/* Marker Core */}
                      <circle
                        cx={pos.cx}
                        cy={pos.cy}
                        r={isSelected ? '7' : '5'}
                        fill={isSelected ? '#D4F826' : cam.status === 'ALERT' ? '#e11d48' : '#059669'}
                        stroke="#121316"
                        strokeWidth="2"
                      />

                      {/* Node Label */}
                      <text
                        x={pos.cx + 9}
                        y={pos.cy + 3}
                        fill={isSelected ? '#D4F826' : '#94a3b8'}
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight={isSelected ? 'bold' : 'normal'}
                      >
                        {cam.code}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="absolute bottom-2 left-4 text-[9px] font-mono text-slate-400">
                CLICK ANY CAMERA NODE TO INSPECT OPTICAL CV TELEMETRY
              </div>
            </div>

            {/* Camera Node List */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CAMERAS.map((cam) => {
                const isSelected = activeCam.id === cam.id;
                return (
                  <button
                    key={cam.id}
                    onClick={() => setActiveCam(cam)}
                    className={`p-3 rounded-2xl border text-left font-mono transition-all ${
                      isSelected
                        ? 'bg-[#1E212A] border-[#D4F826] text-white shadow-md'
                        : 'bg-[#181A22] border-[#2E3240] text-slate-300 hover:bg-[#20232E]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{cam.code}</span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          cam.status === 'ALERT'
                            ? 'bg-rose-500 animate-pulse'
                            : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    <div className="text-[10px] truncate mt-1 text-slate-300 font-sans font-medium">{cam.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Camera Telemetry & Edge Detection Inspector (6 cols) */}
          <div data-reveal className="glow-card lg:col-span-6 glass-dark rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 font-mono">
                <Video className="h-4 w-4 text-[#D4F826]" />
                <span className="font-bold text-sm text-white">{activeCam.code} FEED &amp; CV METRICS</span>
              </div>
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold ${
                  activeCam.status === 'ALERT'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {activeCam.status === 'ALERT' ? 'ANOMALY DETECTED' : 'NORMAL MONITORING'}
              </span>
            </div>

            {/* Stylized Synthetic Camera Feed Window */}
            <div className="relative aspect-[16/9] bg-[#0E1015] rounded-2xl border border-[#262A35] overflow-hidden flex items-center justify-center shadow-inner">
              {/* Camera Grid Lines & Timestamp */}
              <div className="absolute inset-0 pointer-events-none p-3.5 flex flex-col justify-between text-[10px] font-mono text-cyan-300">
                <div className="flex items-center justify-between">
                  <span className="bg-black/75 px-2 py-0.5 rounded-full text-white">
                    {activeCam.code} · {activeCam.coordinates}
                  </span>
                  <span className="bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                    ● REC (EDGE CV)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="bg-black/75 px-2 py-0.5 rounded-full text-white">
                    FOV: {activeCam.fovAngle}° · ELEV: {activeCam.elevationM}m MSL
                  </span>
                  <span className="bg-black/75 px-2 py-0.5 rounded-full text-white">
                    {new Date().toLocaleTimeString()} IST
                  </span>
                </div>
              </div>

              {/* Computer Vision Detection Bounding Box if Anomaly is true */}
              {activeCam.anomalyDetected ? (
                <div className="relative border-2 border-dashed border-rose-500 bg-rose-950/40 rounded-xl p-4 max-w-sm mx-auto text-center space-y-1 backdrop-blur-xs">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold">
                    <Crosshair className="h-3 w-3" /> ANOMALY: WATER LEVEL RAPID SURGE
                  </div>
                  <div className="text-xs text-white font-medium">
                    {activeCam.detectedEvent}
                  </div>
                  <div className="text-[11px] font-mono text-rose-300 pt-1">
                    SURGE VELOCITY: +{activeCam.waterRiseCmPerHour} CM/H · CONFIDENCE: {activeCam.confidencePct}%
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-1 p-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/40">
                    <CheckCircle2 className="h-3 w-3" /> NOMINAL CLEARANCE
                  </div>
                  <div className="text-xs text-slate-300">
                    Water velocity and culvert freeboard within baseline safety envelopes.
                  </div>
                </div>
              )}
            </div>

            {/* Edge AI Telemetry Strip */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-[#121316] border border-white/10">
                <div className="text-[10px] text-slate-400">SURFACE VELOCITY</div>
                <div className="font-bold text-white mt-0.5">
                  {activeCam.waterRiseCmPerHour ? `+${activeCam.waterRiseCmPerHour} cm/h` : 'Baseline'}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#121316] border border-white/10">
                <div className="text-[10px] text-slate-400">SOLAR BATTERY</div>
                <div className="font-bold text-[#D4F826] mt-0.5">
                  {activeCam.solarBatteryPct}%
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#121316] border border-white/10">
                <div className="text-[10px] text-slate-400">CV CONFIDENCE</div>
                <div className="font-bold text-cyan-300 mt-0.5">
                  {activeCam.confidencePct}%
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>PRIMARY TARGET: {activeCam.primaryTarget}</span>
              <DataHonestyBadge kind="PLANNED" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CameraNetworkSection;
