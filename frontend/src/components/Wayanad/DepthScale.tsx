// Human-scale flood depth reference. Figures are SCALE REFERENCES (standard sizes), not people.
import React from 'react';
import { depthMeaning } from './simUtils';

const VIEW_M = 3.2; // metres shown vertically
const H = 170, W = 330, GROUND = 150;
const px = (m: number) => (m / VIEW_M) * (GROUND - 8);

export function DepthScale({ depth, label, source }: { depth: number | null; label: string; source: string }) {
  if (depth === null) {
    return (
      <div className="rounded-xl border border-dashed border-rose-300 dark:border-rose-500/30 px-3 py-4 text-center text-[12px] font-semibold text-rose-600">
        FLOOD DEPTH UNAVAILABLE
        <div className="text-[10.5px] font-normal text-slate-500 mt-0.5">Run a simulation to obtain depth; FloodGuard does not estimate depth otherwise.</div>
      </div>
    );
  }
  const d = Math.max(0, depth);
  const waterY = GROUND - px(Math.min(d, VIEW_M));
  const tone = d >= 1 ? '#e03131' : d >= 0.3 ? '#f76707' : '#1c7ed6';
  const ticks = [0.2, 0.5, 1.0, 1.5, 2.0, 3.0];
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-950">
      <div className="flex items-baseline justify-between px-3 pt-2">
        <div>
          <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-500">{label}</div>
          <div className="text-[22px] font-bold leading-tight" style={{ color: tone }}>≈ {d.toFixed(2)} m</div>
        </div>
        <div className="text-right text-[11px] font-semibold" style={{ color: tone }}>{depthMeaning(d)}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Water depth ${d.toFixed(2)} metres compared with a 1.7 m person, a car and a single-storey house`}>
        {/* height ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={22} x2={W - 6} y1={GROUND - px(t)} y2={GROUND - px(t)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={4} y={GROUND - px(t) + 3} fontSize={8} fill="currentColor" opacity={0.55}>{t} m</text>
          </g>
        ))}
        {/* house, 3 m eave */}
        <g opacity={0.9}>
          <rect x={232} y={GROUND - px(2.8)} width={80} height={px(2.8)} fill="#cbd5e1" stroke="#64748b" />
          <polygon points={`${226},${GROUND - px(2.8)} ${272},${GROUND - px(4.0)} ${318},${GROUND - px(2.8)}`} fill="#94a3b8" />
          <rect x={262} y={GROUND - px(2.0)} width={18} height={px(2.0)} fill="#64748b" />
          <rect x={240} y={GROUND - px(2.2)} width={14} height={14} fill="#e2e8f0" />
        </g>
        {/* tree */}
        <g>
          <rect x={196} y={GROUND - px(2.2)} width={6} height={px(2.2)} fill="#8d5524" />
          <circle cx={199} cy={GROUND - px(2.7)} r={20} fill="#2f9e44" opacity={0.85} />
        </g>
        {/* car ~1.5 m tall, 4.3 m long (drawn to height scale) */}
        <g>
          <path d={`M110,${GROUND - px(0.35)} h70 v-${px(0.55)} l-12,-${px(0.55)} h-38 l-12,${px(0.55)} z`} fill="#475569" />
          <rect x={126} y={GROUND - px(1.35)} width={34} height={px(0.42)} fill="#cbd5e1" />
          <circle cx={125} cy={GROUND - px(0.3)} r={px(0.3)} fill="#1e293b" />
          <circle cx={166} cy={GROUND - px(0.3)} r={px(0.3)} fill="#1e293b" />
        </g>
        {/* person 1.7 m */}
        <g fill="#334155">
          <circle cx={70} cy={GROUND - px(1.58)} r={px(0.11)} />
          <rect x={64} y={GROUND - px(1.45)} width={12} height={px(0.62)} rx={3} />
          <rect x={64} y={GROUND - px(0.85)} width={5} height={px(0.85)} />
          <rect x={71} y={GROUND - px(0.85)} width={5} height={px(0.85)} />
          <rect x={58} y={GROUND - px(1.4)} width={4} height={px(0.55)} />
          <rect x={78} y={GROUND - px(1.4)} width={4} height={px(0.55)} />
        </g>
        <text x={56} y={GROUND + 13} fontSize={8} fill="currentColor" opacity={0.6}>1.7 m person</text>
        <text x={122} y={GROUND + 13} fontSize={8} fill="currentColor" opacity={0.6}>car ~1.5 m</text>
        <text x={186} y={GROUND + 13} fontSize={8} fill="currentColor" opacity={0.6}>tree</text>
        <text x={244} y={GROUND + 13} fontSize={8} fill="currentColor" opacity={0.6}>1-storey house</text>
        {/* ground */}
        <line x1={20} x2={W} y1={GROUND} y2={GROUND} stroke="#8d5524" strokeWidth={2} />
        {/* water */}
        {d > 0.01 && (
          <g>
            <rect x={20} y={waterY} width={W - 20} height={GROUND - waterY} fill="#1c7ed6" opacity={0.42}>
              <animate attributeName="opacity" values="0.38;0.46;0.38" dur="3s" repeatCount="indefinite" />
            </rect>
            <path d={`M20,${waterY} q10,-3 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t10,0`} stroke="#1864ab" strokeWidth={1.6} fill="none" />
          </g>
        )}
        {d > VIEW_M && <text x={W - 8} y={14} fontSize={9} textAnchor="end" fill="#e03131" fontWeight="bold">▲ above scale ({d.toFixed(1)} m)</text>}
      </svg>
      <div className="px-3 pb-2 text-[9.5px] text-slate-500">Figures are standard-size scale references, not people. {source}</div>
    </div>
  );
}
