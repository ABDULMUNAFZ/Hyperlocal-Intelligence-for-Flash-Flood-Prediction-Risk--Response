import React, { useState } from 'react';
import { Waves, Play, Pause, RotateCcw, Loader2, Mountain, Layers3, Route, Bell } from 'lucide-react';
import { panel, Card, KV, SectionTitle, Caveat, Btn, StatusBadge, Unavailable } from './ui';
import { DepthScale } from './DepthScale';
import { DEPTH_LEGEND, frameAtTime, simDuration, type SimResult } from './simUtils';
import type { OperationalZone } from '../../types/geo';
import { X } from 'lucide-react';

export type SimKind = 'flood' | 'landslide' | 'combined';

export interface SimParams {
  kind: SimKind;
  scenario: string;
  rainfall_mm: number;
  duration_h: number;
  amc: 'auto' | 'I' | 'II' | 'III';
  landslide: { soil_depth_m: number; cohesion_kpa: number; friction_deg: number; ksat_mm_h: number; reach_angle_deg: number };
}

export const PRESETS: Array<{ name: string; rainfall_mm: number; duration_h: number; note: string }> = [
  { name: 'Heavy monsoon day', rainfall_mm: 115, duration_h: 24, note: 'IMD "very heavy" threshold (115.6 mm/24 h)' },
  { name: 'Extreme monsoon burst', rainfall_mm: 300, duration_h: 12, note: 'Multi-day extreme totals seen in Wayanad episodes' },
  { name: 'Cloudburst', rainfall_mm: 100, duration_h: 1, note: 'IMD cloudburst definition: ≥ 100 mm in 1 h' },
  { name: 'Moderate rain', rainfall_mm: 40, duration_h: 6, note: 'For comparison' },
];

export const DEFAULT_PARAMS: SimParams = {
  kind: 'combined', scenario: 'Extreme monsoon burst', rainfall_mm: 300, duration_h: 12, amc: 'auto',
  landslide: { soil_depth_m: 1.5, cohesion_kpa: 5, friction_deg: 30, ksat_mm_h: 36, reach_angle_deg: 11 },
};

interface Props {
  zone: OperationalZone | null;
  params: SimParams;
  onParams: (p: SimParams) => void;
  sim: SimResult | null;
  running: boolean;
  runSeconds: number;
  error: string | null;
  onRun: () => void;
  onClear: () => void;
  tH: number;
  onTime: (t: number) => void;
  playing: boolean;
  onPlay: (v: boolean) => void;
  speed: number;
  onSpeed: (v: number) => void;
  probe: { depth: number | null; label: string };
  onEvacuate: () => void;
  onAlert: (() => void) | null;
  onClose: () => void;
  onPresets: () => void;
}

const fmtT = (t: number) => `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;

export function SimulationPanel(p: Props) {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const s = p.sim;
  const set = (patch: Partial<SimParams>) => p.onParams({ ...p.params, ...patch });
  const setLs = (patch: Partial<SimParams['landslide']>) => p.onParams({ ...p.params, landslide: { ...p.params.landslide, ...patch } });
  const total = s ? simDuration(s) : 0;
  const frame = s?.flood ? s.flood.frames[frameAtTime(s, p.tH)] : null;
  const failed = s?.landslide && p.tH >= s.landslide.t_fail_h;

  return (
    <aside className={`${panel} pointer-events-auto flex max-h-full w-full md:w-[430px] flex-col overflow-hidden rounded-2xl`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase"><Waves className="h-4 w-4 text-sky-600" />Scenario simulation</div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wider text-amber-950">{s?.label ?? 'SIMULATION'}</span>
          <button onClick={p.onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="overflow-y-auto p-3.5 space-y-3">
        {!p.zone ? (
          <Card>
            <div className="text-[12px]"><b>Select an operational micro-zone first</b> (e.g. Mundakkai – Chooralmala valley). The model runs on that zone's real terrain, land cover, buildings and roads.</div>
            <Btn className="mt-2" onClick={p.onPresets}>Open zone selector</Btn>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-white/5 p-1">
              {(['flood', 'landslide', 'combined'] as SimKind[]).map((k) => (
                <button key={k} onClick={() => set({ kind: k })}
                  className={`rounded-md py-1.5 text-[10.5px] font-bold tracking-wider uppercase ${p.params.kind === k ? 'bg-white dark:bg-slate-800 shadow text-sky-700 dark:text-sky-300' : 'text-slate-500'}`}>
                  {k === 'flood' ? 'Flash flood' : k}
                </button>
              ))}
            </div>
            <Card>
              <SectionTitle>Inputs · {p.zone.name}</SectionTitle>
              <div className="flex flex-wrap gap-1 mb-2">
                {PRESETS.map((pr) => (
                  <button key={pr.name} title={pr.note} onClick={() => set({ scenario: pr.name, rainfall_mm: pr.rainfall_mm, duration_h: pr.duration_h })}
                    className={`rounded-full border px-2 py-0.5 text-[10.5px] ${p.params.scenario === pr.name ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 dark:border-white/10'}`}>{pr.name}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label>Rainfall <b>{p.params.rainfall_mm} mm</b><input type="range" min={10} max={600} step={5} value={p.params.rainfall_mm} onChange={(e) => set({ rainfall_mm: +e.target.value, scenario: 'Custom scenario' })} className="w-full accent-sky-600" /></label>
                <label>Duration <b>{p.params.duration_h} h</b><input type="range" min={1} max={48} step={1} value={p.params.duration_h} onChange={(e) => set({ duration_h: +e.target.value, scenario: 'Custom scenario' })} className="w-full accent-sky-600" /></label>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span>Intensity <b>{(p.params.rainfall_mm / p.params.duration_h).toFixed(1)} mm/h</b></span>
                <label className="flex items-center gap-1">Antecedent moisture
                  <select value={p.params.amc} onChange={(e) => set({ amc: e.target.value as any })} className="rounded border border-slate-200 dark:border-white/10 bg-transparent px-1 py-0.5">
                    <option value="auto">Auto (observed 72 h)</option><option value="I">I · dry</option><option value="II">II · average</option><option value="III">III · wet</option>
                  </select>
                </label>
              </div>
              {p.params.kind !== 'flood' && (
                <div className="mt-2 rounded-lg bg-amber-50/70 dark:bg-amber-500/5 p-2">
                  <div className="text-[10px] font-bold tracking-wider text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1"><Mountain className="h-3 w-3" />SOIL / SLOPE PARAMETERS — ASSUMED</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]">
                    <label>Soil depth <b>{p.params.landslide.soil_depth_m} m</b><input type="range" min={0.5} max={4} step={0.25} value={p.params.landslide.soil_depth_m} onChange={(e) => setLs({ soil_depth_m: +e.target.value })} className="w-full accent-amber-600" /></label>
                    <label>Cohesion <b>{p.params.landslide.cohesion_kpa} kPa</b><input type="range" min={0} max={20} step={0.5} value={p.params.landslide.cohesion_kpa} onChange={(e) => setLs({ cohesion_kpa: +e.target.value })} className="w-full accent-amber-600" /></label>
                    <label>Friction angle <b>{p.params.landslide.friction_deg}°</b><input type="range" min={20} max={42} step={1} value={p.params.landslide.friction_deg} onChange={(e) => setLs({ friction_deg: +e.target.value })} className="w-full accent-amber-600" /></label>
                    <label>Runout reach angle <b>{p.params.landslide.reach_angle_deg}°</b><input type="range" min={5} max={25} step={1} value={p.params.landslide.reach_angle_deg} onChange={(e) => setLs({ reach_angle_deg: +e.target.value })} className="w-full accent-amber-600" /></label>
                  </div>
                </div>
              )}
              <div className="mt-2 flex gap-1.5">
                <Btn tone="primary" className="flex-1" onClick={p.onRun} disabled={p.running}>
                  {p.running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Computing on real terrain… {p.runSeconds}s</> : <><Play className="h-3.5 w-3.5" />Run simulation</>}
                </Btn>
                {s && <Btn onClick={p.onClear}>Clear</Btn>}
              </div>
              {p.running && <div className="mt-1 text-[10.5px] text-slate-500">2D shallow-water routing on ~64 m cells typically takes 30–70 s for a 15 km² zone.</div>}
            </Card>
            {p.error && <Unavailable>{p.error}</Unavailable>}

            {s && (
              <>
                {/* Timeline */}
                <Card>
                  <div className="flex items-center justify-between">
                    <SectionTitle>Timeline</SectionTitle>
                    <div className="font-mono text-[13px] font-semibold">T+{fmtT(p.tH)} <span className="text-slate-400">/ {fmtT(total)}</span></div>
                  </div>
                  <div className="relative mt-3 mb-5">
                    <input type="range" min={0} max={total} step={total / 400} value={p.tH} onChange={(e) => { p.onPlay(false); p.onTime(+e.target.value); }} className="w-full accent-sky-600" />
                    {s.stages.filter((st) => st.t_h !== null).map((st) => (
                      <div key={st.key} className="absolute -bottom-4 -translate-x-1/2 text-[8px] font-bold tracking-wider whitespace-nowrap" style={{ left: `${(st.t_h! / total) * 100}%` }} title={`${st.label}: ${st.detail}`}>
                        <div className={`mx-auto h-1.5 w-1.5 rounded-full ${p.tH >= st.t_h! ? 'bg-rose-500' : 'bg-slate-300'}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Btn tone="primary" onClick={() => { if (p.tH >= total) p.onTime(0); p.onPlay(!p.playing); }}>{p.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{p.playing ? 'Pause' : 'Play'}</Btn>
                    <Btn onClick={() => { p.onPlay(false); p.onTime(0); }}><RotateCcw className="h-3.5 w-3.5" />Reset</Btn>
                    <div className="ml-auto flex items-center gap-0.5 text-[10.5px]">
                      {[1, 2, 4, 8].map((x) => <button key={x} onClick={() => p.onSpeed(x)} className={`rounded px-1.5 py-0.5 font-bold ${p.speed === x ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500'}`}>{x}×</button>)}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {s.stages.map((st) => (
                      <button key={st.key} disabled={st.t_h === null} onClick={() => st.t_h !== null && (p.onPlay(false), p.onTime(st.t_h))}
                        className={`rounded-md border px-2 py-1 text-left text-[10px] ${st.t_h === null ? 'opacity-40 border-dashed border-slate-300' : p.tH >= st.t_h ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/40' : 'border-slate-200 dark:border-white/10'}`} title={st.detail}>
                        <div className="font-bold tracking-wider">{st.label}</div>
                        <div className="text-slate-500">{st.t_h === null ? 'not reached' : `T+${fmtT(st.t_h)}`}</div>
                      </button>
                    ))}
                  </div>
                </Card>

                {frame && (
                  <Card>
                    <SectionTitle right={<StatusBadge status="MODEL" />}>State at T+{fmtT(frame.t_h)}</SectionTitle>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <Metric label="Rain" value={`${frame.rain_mm_h.toFixed(0)}`} unit="mm/h" />
                      <Metric label="Cumulative" value={`${frame.rain_cum_mm.toFixed(0)}`} unit="mm" />
                      <Metric label="Flooded" value={frame.flooded_km2.toFixed(2)} unit="km²" />
                      <Metric label="Max depth" value={frame.max_depth_m.toFixed(2)} unit="m" tone={frame.max_depth_m > 1 ? 'text-rose-600' : ''} />
                      <Metric label="People in water" value={Math.round(frame.people_exposed).toLocaleString()} unit="HRSL est." />
                      <Metric label="Buildings wet" value={String(frame.buildings_wet)} unit="OSM" />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
                      <span>Roads impassable (&gt;0.3 m): <b>{frame.roads_impassable}</b></span>
                      <span>Max velocity <b>{frame.max_velocity_ms} m/s</b></span>
                    </div>
                    <div className="mt-2">
                      <div className="flex h-2 overflow-hidden rounded-full">{DEPTH_LEGEND.map((d) => <div key={d.v} className="flex-1" style={{ background: d.color }} />)}</div>
                      <div className="flex justify-between text-[9px] font-mono text-slate-500">{DEPTH_LEGEND.map((d) => <span key={d.v}>{d.v}</span>)}<span>m</span></div>
                    </div>
                  </Card>
                )}
                {!s.flood && <Unavailable>Flood depth not computed in a landslide-only run.</Unavailable>}

                <DepthScale depth={s.flood ? p.probe.depth : null} label={p.probe.label} source={`${s.label} depth from the 2D model at T+${fmtT(p.tH)}.`} />

                {s.landslide && (
                  <Card>
                    <SectionTitle right={<StatusBadge status={failed ? 'MODEL' : 'HISTORICAL'} />}>Slope stability</SectionTitle>
                    <div className="grid grid-cols-2 gap-x-4">
                      <KV k="Unstable (FS<1)" v={`${s.landslide.summary.unstable_area_km2} km²`} />
                      <KV k="Marginal (1–1.25)" v={`${s.landslide.summary.marginal_area_km2} km²`} />
                      <KV k="Failure clusters" v={s.landslide.summary.failure_clusters} />
                      <KV k="Max runout" v={`${(s.landslide.summary.max_runout_m / 1000).toFixed(1)} km`} />
                      <KV k="Buildings in corridors" v={s.landslide.summary.buildings_in_corridors} />
                      <KV k="Roads blocked" v={s.landslide.summary.roads_blocked} />
                    </div>
                    <KV k="People in corridors" v={s.landslide.impacts.people_in_corridors_hrsl != null ? `${s.landslide.impacts.people_in_corridors_hrsl} (HRSL est.)` : 'unavailable'} />
                    <KV k="Failure time (soil wetting)" v={`T+${fmtT(s.landslide.t_fail_h)}`} />
                    <div className="text-[10px] text-slate-500 mt-1">{failed ? 'Failure areas and debris corridors shown on the map.' : 'Failure areas appear once the soil column saturates.'}</div>
                  </Card>
                )}

                {s.flood && (
                  <Card>
                    <SectionTitle>Peak impact</SectionTitle>
                    <KV k="Peak flooded area" v={`${s.flood.summary.peak_flooded_km2} km² at T+${fmtT(s.flood.summary.peak_time_h)}`} />
                    <KV k="People exposed (peak)" v={`${Math.round(s.flood.summary.people_exposed_peak).toLocaleString()} (HRSL, ESTIMATED)`} />
                    <KV k="Buildings ever wet (>0.1 m)" v={s.flood.summary.buildings_wet} />
                    <KV k="Road segments impassable" v={s.flood.summary.roads_impassable} />
                    <KV k="Hazard (EA/Defra HR)" v={<span className="text-[10.5px]">{Object.entries(s.flood.summary.hazard_cells).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(' · ')}</span>} />
                    {s.impacts_note && <Caveat>{s.impacts_note}</Caveat>}
                    <div className="mt-2 flex gap-1.5">
                      <Btn onClick={p.onEvacuate}><Route className="h-3.5 w-3.5" />Evacuation on this scenario</Btn>
                      {p.onAlert && <Btn tone="danger" onClick={p.onAlert}><Bell className="h-3.5 w-3.5" />Draft alert</Btn>}
                    </div>
                  </Card>
                )}

                <Card>
                  <button className="flex w-full items-center justify-between" onClick={() => setShowAssumptions((v) => !v)}>
                    <SectionTitle><span className="flex items-center gap-1"><Layers3 className="h-3.5 w-3.5" />Models & assumptions</span></SectionTitle>
                    <span className="text-[10px] text-sky-600">{showAssumptions ? 'hide' : 'show'}</span>
                  </button>
                  {Object.values(s.models).map((m) => <div key={m} className="text-[10.5px] mb-1">{m}</div>)}
                  {showAssumptions && <ul className="list-disc pl-4 text-[10.5px] text-slate-600 dark:text-slate-300 space-y-0.5">{s.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}
                  {s.flood && <div className="mt-1 text-[10px] text-slate-500">Grid {s.flood.setup.grid_resolution_m} m · HSG {s.flood.setup.hydrologic_soil_group} · AMC {s.flood.setup.amc} ({s.flood.setup.amc_note}) · mass balance error {s.flood.summary.mass_balance_error_pct}% · computed in {s.flood.summary.compute_s}s{s.record_id ? ` · saved as simulation ${s.record_id.slice(0, 8)}` : ''}</div>}
                  <Caveat tone="amber">Not validated against observed Wayanad events. This is a what-if SIMULATION on real terrain, not a forecast or warning.</Caveat>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function Metric({ label, value, unit, tone = '' }: { label: string; value: string; unit: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-white/5 py-1.5">
      <div className={`text-[16px] font-semibold leading-tight ${tone}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label} · {unit}</div>
    </div>
  );
}
