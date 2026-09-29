import React from 'react';
import { AlertTriangle, ShieldCheck, AlertOctagon, Heart, X, Droplets, Navigation } from 'lucide-react';

export interface FloodHazardDetail {
  locationName: string;
  district: string;
  state: string;
  depthCm: number;
  hazardLevel: 'safe' | 'caution' | 'danger' | 'extreme';
  timestamp: string;
  sourceType: 'OBSERVED SENSOR' | 'MODEL PREDICTION' | 'SIMULATION' | 'CITIZEN REPORT';
  sourceName: string;
  waterVelocityMs?: number;
  roadName?: string;
  onClose?: () => void;
  onNavigateEvacuation?: () => void;
}

export const WaterDepthCard: React.FC<{
  hazard: FloodHazardDetail;
  onClose: () => void;
  onNavigateEvacuation?: () => void;
}> = ({ hazard, onClose, onNavigateEvacuation }) => {
  const [hasVotedThank, setHasVotedThank] = React.useState(false);

  // Depth in cm clamped for visual presentation (0 to 140cm)
  const depth = hazard.depthCm || 60;
  const maxVisualHeight = 140;
  // Normalized 0 to 1
  const waterRatio = Math.min(Math.max(depth / maxVisualHeight, 0.05), 0.95);
  // SVG coordinate calculation (height 160, water line Y from top)
  const svgHeight = 160;
  const waterLineY = svgHeight - (waterRatio * (svgHeight - 30));

  // Determine qualitative depth label
  const getDepthLabel = (cm: number) => {
    if (cm < 15) return 'Ankle-deep (Passable with caution)';
    if (cm < 35) return 'Knee-deep (Small cars stall)';
    if (cm < 65) return 'Waist-deep (Cars lose traction & float)';
    if (cm < 100) return 'Chest-deep (Severe structural hazard)';
    return 'Submerged (Life-threatening torrent)';
  };

  const badgeColor = {
    safe: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    caution: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    danger: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    extreme: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  }[hazard.hazardLevel];

  const levelIcon = {
    safe: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    caution: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    danger: <AlertOctagon className="w-4 h-4 text-orange-400" />,
    extreme: <AlertOctagon className="w-4 h-4 text-rose-400" />,
  }[hazard.hazardLevel];

  return (
    <div className="w-[360px] sm:w-[410px] bg-slate-950/90 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
      {/* Top Header */}
      <div className="p-4 pb-3 flex items-start justify-between border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              {levelIcon}
            </span>
            <div>
              <h3 className="font-semibold text-base text-white tracking-wide flex items-center gap-1.5 capitalize">
                {hazard.hazardLevel === 'caution' ? 'Caution: Water on Route' : `${hazard.hazardLevel} Hazard`}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono tracking-tight">
                {hazard.sourceType} · {hazard.timestamp} · {hazard.locationName}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title="Close card"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Status Pills */}
      <div className="px-4 pt-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          <span className={`px-2.5 py-0.5 rounded-md font-medium border text-[11px] ${badgeColor}`}>
            {hazard.hazardLevel.toUpperCase()}
          </span>
          <span className="px-2.5 py-0.5 rounded-md font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-800/50 text-[11px] flex items-center gap-1">
            <Droplets className="w-3 h-3" />
            ~{depth} cm
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {hazard.district}, {hazard.state}
        </span>
      </div>

      {/* Warning Box */}
      <div className="p-4 pt-3">
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-amber-300">
              {hazard.hazardLevel === 'caution' ? 'Take care — water or debris on the road' : 'Critical Flood Wave Active'}
            </span>
            Walking through flowing water &gt;15 cm poses loss of footing. Vehicles float and lose steering control at &gt;30–60 cm depth.
          </div>
        </div>
      </div>

      {/* Visual Car & Human Submergence Infographic (Exact Reference Feature) */}
      <div className="px-4 pb-2">
        <div className="relative rounded-xl bg-slate-900/90 border border-slate-800/80 p-3 overflow-hidden">
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between mb-2">
            <span className="text-cyan-400 font-semibold">= {depth} cm · {getDepthLabel(depth).split('(')[0]}</span>
            <span className="text-slate-500">Hydrostatic Watermark</span>
          </div>

          {/* SVG Vehicle & Human Silhouettes in Flood Depth */}
          <div className="relative w-full h-[150px] bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg overflow-hidden border border-slate-800">
            <svg
              viewBox="0 0 340 160"
              className="w-full h-full select-none"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Water Gradient */}
                <linearGradient id="floodWaterGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
                </linearGradient>
                {/* Wave Pattern */}
                <linearGradient id="waveSurface" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#67e8f9" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>

              {/* Ground Line */}
              <line x1="0" y1="145" x2="340" y2="145" stroke="#475569" strokeWidth="2" strokeDasharray="3 3" />
              <text x="8" y="155" fill="#64748b" fontSize="8" fontFamily="monospace">SURFACE LEVEL 0 cm</text>

              {/* Measurement Ticks on Right */}
              <g opacity="0.6">
                <line x1="310" y1="145" x2="330" y2="145" stroke="#94a3b8" strokeWidth="1" />
                <text x="315" y="142" fill="#94a3b8" fontSize="7" fontFamily="monospace">0cm</text>
                
                <line x1="310" y1="125" x2="330" y2="125" stroke="#94a3b8" strokeWidth="1" />
                <text x="315" y="122" fill="#94a3b8" fontSize="7" fontFamily="monospace">20cm Ankle</text>
                
                <line x1="310" y1="100" x2="330" y2="100" stroke="#94a3b8" strokeWidth="1" />
                <text x="315" y="97" fill="#94a3b8" fontSize="7" fontFamily="monospace">50cm Knee</text>
                
                <line x1="310" y1="75" x2="330" y2="75" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                <text x="315" y="72" fill="#f59e0b" fontSize="7" fontFamily="monospace">70cm Waist</text>
                
                <line x1="310" y1="40" x2="330" y2="40" stroke="#ef4444" strokeWidth="1" />
                <text x="315" y="37" fill="#ef4444" fontSize="7" fontFamily="monospace">110cm Float</text>
              </g>

              {/* Car Silhouette (Center Left) */}
              <g transform="translate(25, 45)">
                {/* Wheels */}
                <circle cx="32" cy="95" r="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                <circle cx="32" cy="95" r="7" fill="#475569" />
                <circle cx="112" cy="95" r="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                <circle cx="112" cy="95" r="7" fill="#475569" />

                {/* Car Chassis Body */}
                <path
                  d="M 10 88 
                     L 15 72 
                     Q 22 68, 38 68 
                     L 48 50 
                     Q 52 46, 68 46 
                     L 105 46 
                     Q 118 46, 126 56 
                     L 138 70 
                     Q 145 74, 148 85 
                     L 145 92 
                     L 128 92 
                     A 16 16 0 0 0 96 92 
                     L 48 92 
                     A 16 16 0 0 0 16 92 
                     Z"
                  fill="#94a3b8"
                  opacity="0.9"
                />

                {/* Windows */}
                <path
                  d="M 52 52 L 68 50 L 80 50 L 80 66 L 46 66 Z"
                  fill="#0f172a"
                  opacity="0.8"
                />
                <path
                  d="M 84 50 L 102 50 L 120 66 L 84 66 Z"
                  fill="#0f172a"
                  opacity="0.8"
                />
              </g>

              {/* Human Female Silhouette (Center Right) */}
              <g transform="translate(195, 30)">
                {/* Head */}
                <circle cx="12" cy="14" r="7" fill="#cbd5e1" />
                {/* Hair bun */}
                <circle cx="6" cy="12" r="3.5" fill="#94a3b8" />
                {/* Torso & Dress */}
                <path
                  d="M 8 23 
                     Q 12 21, 16 23 
                     L 22 55 
                     L 2 55 
                     Z"
                  fill="#cbd5e1"
                />
                {/* Legs */}
                <line x1="8" y1="55" x2="8" y2="115" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                <line x1="16" y1="55" x2="16" y2="115" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
              </g>

              {/* Human Male Silhouette (Far Right) */}
              <g transform="translate(230, 24)">
                {/* Head */}
                <circle cx="14" cy="13" r="7.5" fill="#cbd5e1" />
                {/* Neck & Shoulders */}
                <path
                  d="M 6 22 
                     L 22 22 
                     L 20 60 
                     L 8 60 
                     Z"
                  fill="#cbd5e1"
                />
                {/* Arms */}
                <line x1="5" y1="23" x2="3" y2="58" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="23" y1="23" x2="25" y2="58" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
                {/* Legs */}
                <line x1="11" y1="60" x2="11" y2="121" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="17" y1="60" x2="17" y2="121" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
              </g>

              {/* Animated Flood Water Volume (Rises with depthCm) */}
              <rect
                x="0"
                y={waterLineY}
                width="340"
                height={160 - waterLineY}
                fill="url(#floodWaterGrad)"
              />

              {/* Wavy Surface Line */}
              <path
                d={`M 0 ${waterLineY} 
                    Q 40 ${waterLineY - 3}, 80 ${waterLineY} 
                    T 160 ${waterLineY} 
                    T 240 ${waterLineY} 
                    T 320 ${waterLineY} 
                    L 340 ${waterLineY}`}
                fill="none"
                stroke="url(#waveSurface)"
                strokeWidth="2.5"
              />

              {/* Dynamic Watermark Indicator Tag */}
              <g transform={`translate(150, ${Math.max(waterLineY - 14, 10)})`}>
                <rect x="-35" y="-10" width="70" height="15" rx="4" fill="#0f172a" stroke="#00f0ff" strokeWidth="1" />
                <text x="0" y="1" fill="#38bdf8" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                  {depth} CM WATER
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80">
        <button
          onClick={() => setHasVotedThank(!hasVotedThank)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            hasVotedThank
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700/80'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${hasVotedThank ? 'fill-rose-400 text-rose-400' : 'text-slate-400'}`} />
          {hasVotedThank ? 'Verified by You' : 'Verify Condition'}
        </button>

        {onNavigateEvacuation && (
          <button
            onClick={onNavigateEvacuation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white shadow-md transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
            Evacuation Route
          </button>
        )}
      </div>
    </div>
  );
};

export default WaterDepthCard;
