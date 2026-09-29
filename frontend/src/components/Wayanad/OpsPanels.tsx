import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Route, Bell, Video, Bot, Database, CloudRain, ShieldAlert, Waves, Send, ExternalLink, Target, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { panel, Card, KV, SectionTitle, Spinner, Unavailable, Caveat, ProvenanceLine, Btn, riskTone, StatusBadge, MiniMarkdown, Bars } from './ui';
import { RISK_COLORS } from './constants';
import { fmt } from './geo';
import type {
  AlertsResponse, CamerasResponse, Camera, Manifest, ModelSanity, OperationalZone, RouteResult, ZoneImpact, ZoneOsm, ZoneRisk, ZoneTerrain,
  PointWeather, FeatureCollection, ScenarioResult,
} from '../../types/geo';
import type { PanelId } from './TopBar';

function Shell({ title, icon: Icon, onClose, children, wide }: { title: string; icon: any; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <aside className={`${panel} pointer-events-auto flex max-h-full w-full ${wide ? 'md:w-[420px]' : 'md:w-[380px]'} flex-col overflow-hidden rounded-2xl`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase"><Icon className="h-4 w-4 text-sky-600 dark:text-sky-400" />{title}</div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
      <div className="overflow-y-auto p-3.5 space-y-3">{children}</div>
    </aside>
  );
}

function NeedZone({ onPresets }: { onPresets: () => void }) {
  return (
    <Card>
      <div className="flex items-start gap-2 text-[12px]">
        <Target className="h-4 w-4 text-rose-500 mt-0.5" />
        <div>
          <b>Select an operational micro-zone first.</b>
          <div className="text-slate-500 mt-0.5">Use a preset (e.g. Mundakkai – Chooralmala valley), a radius, or draw a polygon in the left panel. Terrain hydrology, the model risk grid, buildings and exposure are computed for that zone.</div>
          <Btn className="mt-2" onClick={onPresets}>Open zone selector</Btn>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------- Risk / zone analysis

export interface ZoneState {
  zone: OperationalZone | null;
  terrain: ZoneTerrain | null;
  osm: ZoneOsm | null;
  risk: ZoneRisk | null;
  impact: ZoneImpact | null;
  worldpop: { available: boolean; population?: number; reference_year?: number; provenance: any } | null;
  loading: Record<string, boolean>;
}

export function RiskPanel({ zs, sanity, onClose, onPresets, scenario, onScenario, showImpact, onShowImpact, onAskAI }: {
  zs: ZoneState; sanity: ModelSanity | null; onClose: () => void; onPresets: () => void;
  scenario: { rainfall_mm: number; duration_hours: number } | null; onScenario: (s: { rainfall_mm: number; duration_hours: number } | null) => void;
  showImpact: boolean; onShowImpact: (v: boolean) => void; onAskAI: (q: string) => void;
}) {
  const [mm, setMm] = useState(scenario?.rainfall_mm ?? 150);
  const [hrs, setHrs] = useState(scenario?.duration_hours ?? 6);
  const r = zs.risk;
  const t = zs.terrain;
  return (
    <Shell title="Flash-flood risk & impact" icon={ShieldAlert} onClose={onClose} wide>
      <SanityCard sanity={sanity} />
      {!zs.zone ? <NeedZone onPresets={onPresets} /> : (
        <>
          <Card>
            <SectionTitle right={t?.available ? <StatusBadge status="DERIVED" /> : null}>Zone · {zs.zone.name}</SectionTitle>
            {zs.loading.terrain && <Spinner label="Reading Copernicus GLO-30, running D8 hydrology…" />}
            {t && !t.available && <Unavailable>{t.reason}</Unavailable>}
            {t?.available && t.stats && (
              <>
                <div className="grid grid-cols-2 gap-x-4">
                  <KV k="Area" v={`${fmt(t.zone_area_km2, 2)} km²`} />
                  <KV k="Relief" v={`${fmt(t.stats.relief_m, 0)} m`} />
                  <KV k="Elevation" v={`${fmt(t.stats.elevation_min_m, 0)}–${fmt(t.stats.elevation_max_m, 0)} m`} />
                  <KV k="Mean slope" v={`${t.stats.slope_mean_deg}°`} />
                  <KV k="Slope > 30°" v={`${t.stats.area_steeper_than_30deg_pct}% of area`} />
                  <KV k="Max drainage area" v={`${t.stats.max_contributing_area_km2} km²`} />
                </div>
                <KV k="Drainage lines (D8)" v={`${t.drainage?.features.length ?? 0} · channel ≥ ${t.stats.channel_threshold_km2} km²`} />
                {t.landcover?.classes && (
                  <div className="mt-2">
                    <div className="flex h-2 overflow-hidden rounded-full">
                      {t.landcover.classes.map((c) => <div key={c.code} title={`${c.label} ${(c.fraction * 100).toFixed(1)}%`} style={{ width: `${c.fraction * 100}%`, background: LC[c.code] ?? '#999' }} />)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                      {t.landcover.classes.slice(0, 4).map((c) => <span key={c.code}>{c.label} {(c.fraction * 100).toFixed(1)}%</span>)}
                    </div>
                  </div>
                )}
                <ProvenanceLine p={t.provenance} />
              </>
            )}
          </Card>

          <Card>
            <SectionTitle right={<StatusBadge status={r?.mode === 'SCENARIO' ? 'MODEL' : 'LIVE'} />}>
              Model risk grid {r?.mode === 'SCENARIO' ? '· SCENARIO' : '· current inputs'}
            </SectionTitle>
            {zs.loading.risk && <Spinner label="Running ensemble on per-cell real inputs…" />}
            {r && !r.available && <Unavailable>{r.reason}</Unavailable>}
            {r?.available && r.distribution && (
              <>
                <div className="flex h-3 overflow-hidden rounded-full">
                  {['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'].map((lvl) => {
                    const n = r.distribution![lvl] ?? 0;
                    const tot = Object.values(r.distribution!).reduce((a, b) => a + b, 0);
                    return n ? <div key={lvl} style={{ width: `${(n / tot) * 100}%`, background: RISK_COLORS[lvl] }} title={`${lvl}: ${n}`} /> : null;
                  })}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px]">
                  {Object.entries(r.distribution).map(([k, v]) => <span key={k}><b>{v}</b> {k.replace('_', ' ').toLowerCase()}</span>)}
                </div>
                <KV k="Max probability" v={`${((r.max_probability ?? 0) * 100).toFixed(1)}%`} />
                {r.imputed_features?.length ? <KV k="Imputed inputs" v={<span className="text-[10.5px]">{r.imputed_features.join(', ')}</span>} /> : null}
                {r.mode === 'SCENARIO' && r.scenario && <Caveat>Scenario: {r.scenario.rainfall_mm} mm over {r.scenario.duration_hours} h replaces the rainfall inputs. Model sensitivity only — not a forecast and not an inundation simulation.</Caveat>}
                <Caveat tone="rose">{r.model?.warning}</Caveat>
              </>
            )}
            <div className="mt-2 rounded-lg bg-slate-50 dark:bg-white/5 p-2">
              <div className="text-[10.5px] font-semibold mb-1">Rainfall scenario (model sensitivity)</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label>Rainfall <b>{mm} mm</b><input type="range" min={10} max={600} step={10} value={mm} onChange={(e) => setMm(+e.target.value)} className="w-full accent-sky-600" /></label>
                <label>Duration <b>{hrs} h</b><input type="range" min={1} max={72} step={1} value={hrs} onChange={(e) => setHrs(+e.target.value)} className="w-full accent-sky-600" /></label>
              </div>
              <div className="flex gap-1.5 mt-1">
                <Btn tone="primary" onClick={() => onScenario({ rainfall_mm: mm, duration_hours: hrs })}>Run scenario</Btn>
                {scenario && <Btn onClick={() => onScenario(null)}>Back to current inputs</Btn>}
              </div>
            </div>
          </Card>

          <ImpactCard zs={zs} showImpact={showImpact} onShowImpact={onShowImpact} />
          <Btn onClick={() => onAskAI('Why is this area at high flash-flood risk?')}><Bot className="h-3.5 w-3.5" />Ask AI about this zone</Btn>
        </>
      )}
    </Shell>
  );
}

const LC: Record<number, string> = { 10: '#006400', 20: '#ffbb22', 30: '#ffff4c', 40: '#f096ff', 50: '#fa0000', 60: '#b4b4b4', 80: '#0064c8', 90: '#0096a0' };

export function SanityCard({ sanity }: { sanity: ModelSanity | null }) {
  if (!sanity) return null;
  return (
    <div className={`rounded-xl border p-3 ${sanity.passed ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-500/10 dark:border-emerald-500/30' : 'border-rose-300 bg-rose-50/70 dark:bg-rose-500/10 dark:border-rose-500/30'}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
        {sanity.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
        Model sanity check — rainfall response
      </div>
      <div className="mt-1.5 flex items-end gap-1 h-12">
        {sanity.rainfall_response.map((x) => (
          <div key={x.rainfall_24h_mm} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full rounded-t bg-rose-400/80" style={{ height: `${Math.max(4, x.probability * 100 * 1.4)}%` }} title={`${x.rainfall_24h_mm} mm → ${(x.probability * 100).toFixed(1)}%`} />
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-[9px] font-mono text-slate-500">
        {sanity.rainfall_response.map((x) => <div key={x.rainfall_24h_mm} className="flex-1 text-center">{x.rainfall_24h_mm}</div>)}
      </div>
      <div className="text-[9.5px] text-center text-slate-500">24 h rainfall (mm) → model probability at {sanity.reference_location}</div>
      <div className="mt-1 text-[11.5px] leading-snug">{sanity.message}</div>
    </div>
  );
}

function ImpactCard({ zs, showImpact, onShowImpact }: { zs: ZoneState; showImpact: boolean; onShowImpact: (v: boolean) => void }) {
  const im = zs.impact;
  const o = zs.osm;
  return (
    <Card>
      <SectionTitle right={<label className="flex items-center gap-1 text-[10px]"><input type="checkbox" checked={showImpact} onChange={(e) => onShowImpact(e.target.checked)} className="accent-rose-600" />Highlight on map</label>}>
        Exposure & impact
      </SectionTitle>
      {(zs.loading.osm || zs.loading.impact) && <Spinner label="Extracting OSM buildings, roads & facilities…" />}
      {o && !o.available && <Unavailable>{o.reason}</Unavailable>}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Population (HRSL)" value={fmt(zs.terrain?.population?.hrsl_total ?? null, 0)} sub="modelled, ref. year n/a" />
        <Stat label="Population (WorldPop)" value={zs.loading.worldpop ? '…' : zs.worldpop?.available ? fmt(zs.worldpop.population ?? null, 0) : '—'} sub={zs.worldpop?.available ? 'reference year 2020' : zs.worldpop ? 'unavailable' : 'querying'} />
        <Stat label="Buildings (OSM)" value={fmt(o?.summary?.building_count ?? null, 0)} sub={o?.summary ? `${o.summary.building_height_status.UNAVAILABLE ?? 0} without height` : ''} />
        <Stat label="Roads (OSM)" value={o?.summary ? `${o.summary.road_length_total_km} km` : '—'} sub={o?.summary ? `${o.summary.bridge_count} bridges` : ''} />
      </div>
      {o?.summary && Object.keys(o.summary.facility_counts).length > 0 && (
        <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">Facilities: {Object.entries(o.summary.facility_counts).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(' · ')}</div>
      )}
      {im && (
        <div className="mt-3 rounded-lg border border-rose-200 dark:border-rose-500/30 p-2.5">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Inside model HIGH / CRITICAL cells {im.mode === 'SCENARIO' ? '(scenario)' : ''}</div>
          {im.high_risk?.cells ? (
            <div className="grid grid-cols-2 gap-x-4 mt-1">
              <KV k="Area" v={`${im.high_risk.area_km2} km²`} />
              <KV k="People (HRSL)" v={fmt(im.high_risk.population_hrsl ?? null, 0)} />
              <KV k="Buildings" v={fmt(im.high_risk.buildings ?? null, 0)} />
              <KV k="Road length" v={`${im.high_risk.road_length_km ?? '—'} km`} />
              <KV k="Bridges" v={fmt(im.high_risk.bridges ?? null, 0)} />
              <KV k="Facilities" v={fmt(im.high_risk.facilities?.length ?? null, 0)} />
            </div>
          ) : <div className="text-[11.5px] mt-1 text-slate-600 dark:text-slate-300">{im.high_risk?.note ?? im.high_risk_reason ?? 'Not computed.'}</div>}
          {im.method && <div className="mt-1 text-[10px] text-slate-500">{im.method}</div>}
        </div>
      )}
      <ProvenanceLine p={o?.provenance} />
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2.5 py-2">
      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-[18px] font-semibold leading-tight">{value}</div>
      {sub && <div className="text-[9.5px] text-slate-500">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------- Evacuation

export function EvacuationPanel({ zs, origin, routes, caveats, loading, onCompute, onClose, onPresets, onFocusRoute }: {
  zs: ZoneState; origin: [number, number] | null; routes: RouteResult[] | null; caveats: string[]; loading: boolean;
  onCompute: () => void; onClose: () => void; onPresets: () => void; onFocusRoute: (r: RouteResult) => void;
}) {
  return (
    <Shell title="Evacuation" icon={Route} onClose={onClose} wide>
      {!zs.zone && !origin ? <NeedZone onPresets={onPresets} /> : (
        <>
          <Card>
            <SectionTitle>Origin</SectionTitle>
            <div className="text-[12px]">{origin ? `${origin[1].toFixed(4)}, ${origin[0].toFixed(4)}` : 'Zone centre'} {zs.zone ? `· ${zs.zone.name}` : ''}</div>
            <div className="text-[10.5px] text-slate-500 mt-0.5">Click a location and choose “Evacuation from here” to change the origin.</div>
            <Btn tone="primary" className="mt-2" onClick={onCompute} disabled={loading}><Route className="h-3.5 w-3.5" />{loading ? 'Routing…' : 'Compute routes to nearest facilities'}</Btn>
          </Card>
          <Unavailable>Official relief-camp list: <b>unavailable</b>. Road closures / blocked roads: <b>data unavailable</b>. Candidate destinations are mapped schools, colleges, community and government buildings outside model HIGH/CRITICAL cells — their designation as shelters is not verified.</Unavailable>
          {routes && (
            <Card>
              <SectionTitle>Routes (OSRM on OpenStreetMap)</SectionTitle>
              {routes.map((r, i) => (
                <button key={r.candidate.id} onClick={() => onFocusRoute(r)} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold truncate">{i === 0 && r.available ? '★ ' : ''}{r.candidate.name ?? r.candidate.category}</span>
                    {r.available ? <span className="font-mono text-[11px]">{r.distance_km} km · {r.duration_min} min</span> : <span className="text-[10.5px] text-rose-500">unavailable</span>}
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-500">
                    <span className="capitalize">{r.candidate.category}{r.destination_elevation_m != null ? ` · ${fmt(r.destination_elevation_m, 0)} m elev.` : ''}</span>
                    <span className={r.crosses_model_high_risk ? 'text-orange-600' : r.crosses_model_high_risk === false ? 'text-emerald-600' : ''}>{r.assessment ?? r.reason}</span>
                  </div>
                </button>
              ))}
              <div className="mt-2 space-y-1">{caveats.map((c) => <div key={c} className="text-[10.5px] text-slate-500">• {c}</div>)}</div>
            </Card>
          )}
          <div className="text-[10.5px] text-slate-500">Emergency: District EOC <b>1077</b> · National emergency <b>112</b>. Follow instructions from the Wayanad district administration and KSDMA.</div>
        </>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------- Alerts

export function AlertsPanel({ data, loading, onClose, onViewArea, onSimulate, onEvacuate }: {
  data: AlertsResponse | null; loading: boolean; onClose: () => void; onViewArea: () => void; onSimulate: () => void; onEvacuate: () => void;
}) {
  return (
    <Shell title="Official alerts" icon={Bell} onClose={onClose}>
      {loading && <Spinner label="Scanning NDMA SACHET CAP feed…" />}
      {data && !data.available && <Unavailable>SACHET feed unavailable. {data.provenance.notes}</Unavailable>}
      {data?.available && data.alerts.length === 0 && (
        <Card>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div className="text-[12px]"><b>No active official alert covers Wayanad.</b><div className="text-slate-500 mt-0.5">Scanned {data.scanned_messages} current CAP messages from NDMA SACHET for LGD district code 567, the name “Wayanad”, or intersecting alert polygons. This is not a statement that conditions are safe.</div></div>
          </div>
        </Card>
      )}
      {data?.alerts.map((a) => (
        <Card key={a.identifier}>
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${a.severity === 'Extreme' || a.severity === 'Severe' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-amber-950'}`}>{a.event}</span>
            <StatusBadge status={a.active ? 'LIVE' : 'STALE'} />
          </div>
          <div className="mt-1.5 text-[12.5px] font-medium">{a.headline}</div>
          <KV k="Severity / urgency" v={`${a.severity} · ${a.urgency}`} />
          <KV k="Area" v={<span className="text-[11px]">{a.areas.join('; ')}</span>} />
          <KV k="Issued" v={new Date(a.sent).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })} />
          <KV k="Expires" v={a.expires ? new Date(a.expires).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }) : '—'} />
          <KV k="Source" v={a.sender} />
          {a.instruction && <div className="text-[11.5px] mt-1">{a.instruction}</div>}
          <div className="text-[10px] text-slate-500 mt-1">Matched by {a.match_reason}</div>
          <div className="mt-2 flex gap-1.5">
            <Btn onClick={onViewArea}>View area</Btn>
            <Btn onClick={onSimulate}>Simulate</Btn>
            <Btn tone="danger" onClick={onEvacuate}>Evacuation</Btn>
            <a href={a.link} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-sky-600 hover:underline inline-flex items-center gap-1">CAP <ExternalLink className="h-3 w-3" /></a>
          </div>
        </Card>
      ))}
      <Caveat tone="slate">FloodGuard never issues alerts itself. It relays only messages published by authorities through SACHET (IMD, CWC, SDMAs).</Caveat>
      <ProvenanceLine p={data?.provenance} />
    </Shell>
  );
}

// ---------------------------------------------------------------------------- Cameras

export function CamerasPanel({ data, onClose, onOpen }: { data: CamerasResponse | null; onClose: () => void; onOpen: (c: Camera) => void }) {
  return (
    <Shell title="Live cameras" icon={Video} onClose={onClose}>
      {!data && <Spinner />}
      {data && data.cameras.length === 0 && (
        <>
          <Unavailable><b>No public live camera available in Wayanad.</b></Unavailable>
          <Card>
            <SectionTitle>Registry review · {data.reviewed_at}</SectionTitle>
            <div className="text-[11.5px] leading-relaxed">{data.review_summary}</div>
            <div className="mt-2 text-[10.5px] text-slate-500">{data.how_to_add}</div>
          </Card>
        </>
      )}
      {data?.cameras.map((c) => (
        <Card key={c.id}>
          <div className="flex items-center justify-between"><b className="text-[12.5px]">{c.name}</b><StatusBadge status="LIVE" /></div>
          <div className="text-[11px] text-slate-500">{c.source}</div>
          <Btn tone="danger" className="mt-1.5" onClick={() => onOpen(c)}>Open</Btn>
        </Card>
      ))}
    </Shell>
  );
}

export function CameraWindow({ camera, onClose }: { camera: Camera; onClose: () => void }) {
  const [size, setSize] = useState<'min' | 'normal' | 'large'>('normal');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (camera.type !== 'image') return;
    const t = setInterval(() => setTick((x) => x + 1), (camera.refresh_seconds ?? 60) * 1000);
    return () => clearInterval(t);
  }, [camera]);
  const dims = size === 'large' ? 'w-[640px]' : 'w-[340px]';
  return (
    <div className={`${panel} pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 z-40 ${dims} rounded-xl overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-2 text-[11px]">
        <span className="font-bold tracking-wider flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />{camera.type === 'image' ? 'LATEST FRAME' : 'LIVE'} · {camera.name}</span>
        <div className="flex gap-1">
          <button className="px-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded" onClick={() => setSize(size === 'min' ? 'normal' : 'min')}>{size === 'min' ? '▢' : '—'}</button>
          <button className="px-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded" onClick={() => setSize(size === 'large' ? 'normal' : 'large')}>⤢</button>
          <button className="px-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded" onClick={onClose}>✕</button>
        </div>
      </div>
      {size !== 'min' && (
        <div className="aspect-video bg-black">
          {camera.type === 'image' && <img src={`${camera.url}${camera.url.includes('?') ? '&' : '?'}t=${tick}`} className="h-full w-full object-cover" alt={camera.name} />}
          {camera.type === 'mjpeg' && <img src={camera.url} className="h-full w-full object-cover" alt={camera.name} />}
          {camera.type === 'hls' && <video src={camera.url} autoPlay muted controls className="h-full w-full" />}
          {camera.type === 'youtube_live' && <iframe title={camera.name} src={camera.url} className="h-full w-full" allow="autoplay; encrypted-media" />}
        </div>
      )}
      <div className="px-3 py-1.5 text-[10px] text-slate-500">Source: {camera.source_url ? <a className="underline" href={camera.source_url} target="_blank" rel="noreferrer">{camera.source}</a> : camera.source}{camera.verified_live_at ? ` · verified ${camera.verified_live_at}` : ''}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------- Weather

export function WeatherPanel({ grid, centreWeather, onClose, layers, onToggle }: {
  grid: { available: boolean; geojson: FeatureCollection; provenance: any } | null; centreWeather: PointWeather | null; onClose: () => void;
  layers: Record<string, boolean>; onToggle: (k: any) => void;
}) {
  const feats = grid?.geojson?.features ?? [];
  const maxOf = (k: string) => feats.reduce((m, f) => Math.max(m, f.properties[k] ?? 0), 0);
  const w = centreWeather;
  return (
    <Shell title="Weather & rainfall" icon={CloudRain} onClose={onClose}>
      <div className="flex flex-wrap gap-1.5">
        {[['rainPast', 'Past 24 h'], ['rainForecast', 'Next 24 h (forecast)'], ['temperature', 'Temperature'], ['humidity', 'Humidity']].map(([k, l]) => (
          <Btn key={k} tone={layers[k] ? 'primary' : 'default'} onClick={() => onToggle(k)}>{l}</Btn>
        ))}
      </div>
      {!grid && <Spinner label="Sampling Open-Meteo on a district grid…" />}
      {grid && !grid.available && <Unavailable>Rainfall grid unavailable.</Unavailable>}
      {grid?.available && (
        <Card>
          <SectionTitle>District grid ({feats.length} cells)</SectionTitle>
          <KV k="Max past 24 h (analysis)" v={`${fmt(maxOf('past_24h_mm'))} mm`} />
          <KV k="Max next 24 h (FORECAST)" v={`${fmt(maxOf('next_24h_mm'))} mm`} />
          <KV k="Max current intensity" v={`${fmt(maxOf('current_mm_h'))} mm/h`} />
          <ProvenanceLine p={grid.provenance} />
        </Card>
      )}
      {w?.available && w.series && (
        <Card>
          <SectionTitle>Map centre · past 72 h (analysis)</SectionTitle>
          <Bars values={w.series.past_72h.map((x) => x.precipitation_mm)} labels={w.series.past_72h.map((x) => x.time.slice(5, 13).replace('T', ' '))} color="#1971c2" unit=" mm" />
          <ProvenanceLine p={w.provenance} />
        </Card>
      )}
      <Caveat tone="slate">OBSERVED rain-gauge data (IMD/KSDMA) is not connected. Values labelled analysis are NWP model estimates; FORECAST values are predictions. Click any location for point weather and ERA5 climate normals.</Caveat>
    </Shell>
  );
}

// ---------------------------------------------------------------------------- AI assistant

export interface ChatMsg { role: 'user' | 'assistant'; text: string; meta?: string }

export function AssistantPanel({ messages, busy, onAsk, onClose }: { messages: ChatMsg[]; busy: boolean; onAsk: (q: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  const suggestions = [
    'Why is this area at high flash-flood risk?',
    'What factors are causing the risk?',
    'How many people are potentially exposed?',
    'Show high-risk areas',
    'Show nearby shelters',
    'What happens if rainfall increases to 200 mm in 6 hours?',
  ];
  return (
    <Shell title="AI command assistant" icon={Bot} onClose={onClose} wide>
      <Caveat tone="slate">Explains FloodGuard's structured data (prediction, zone analysis, exposure, weather, alerts). It does not make independent flood predictions.</Caveat>
      <div className="space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${m.role === 'user' ? 'bg-sky-600 text-white ml-8' : 'bg-slate-100 dark:bg-white/5 mr-2'}`}>
            {m.role === 'assistant' ? <MiniMarkdown text={m.text} /> : m.text}
            {m.meta && <div className="mt-1 text-[9.5px] opacity-70">{m.meta}</div>}
          </div>
        ))}
        {busy && <Spinner label="Reading structured data…" />}
        <div ref={end} />
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestions.map((s) => <button key={s} onClick={() => onAsk(s)} className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[10.5px] hover:bg-slate-100 dark:hover:bg-white/10">{s}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) { onAsk(q.trim()); setQ(''); } }} className="flex gap-1.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about the selected area…" className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-sky-500" />
        <Btn tone="primary"><Send className="h-3.5 w-3.5" /></Btn>
      </form>
    </Shell>
  );
}

// ---------------------------------------------------------------------------- Data sources

export function DataPanel({ manifest, onClose, statuses }: { manifest: Manifest | null; onClose: () => void; statuses: Array<{ label: string; status: string; detail?: string }> }) {
  return (
    <Shell title="Data status" icon={Database} onClose={onClose}>
      <Card>
        <SectionTitle>Live checks</SectionTitle>
        {statuses.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2 py-1 text-[12px]">
            <span>{s.label}</span>
            <span className="flex items-center gap-1.5 text-[10.5px] text-slate-500">{s.detail}<StatusBadge status={s.status} /></span>
          </div>
        ))}
      </Card>
      {manifest && (
        <>
          <Card>
            <SectionTitle>Datasets</SectionTitle>
            {manifest.datasets.map((d) => (
              <div key={d.layer} className="py-1 border-t first:border-0 border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between text-[11.5px]"><b className="capitalize">{d.layer.replace('_', ' ')}</b><span className="text-[9.5px] uppercase tracking-wider text-slate-500">{d.kind}</span></div>
                <div className="text-[10.5px] text-slate-500">{d.source}</div>
              </div>
            ))}
          </Card>
          <Card>
            <SectionTitle>Unavailable — not faked</SectionTitle>
            {manifest.unavailable.map((u) => (
              <div key={u.layer} className="py-1 text-[11px]"><div className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-rose-500" /><b className="capitalize">{u.layer.replace(/_/g, ' ')}</b></div><div className="text-slate-500 pl-4">{u.reason}</div></div>
            ))}
          </Card>
          <Card>
            <SectionTitle>Prediction model</SectionTitle>
            <KV k="Model" v={`${manifest.model.name} v${manifest.model.version} (${manifest.model.stage})`} />
            <KV k="Training data" v={<span className="text-rose-600 font-bold">{manifest.model.training_data} · {manifest.model.training_samples} samples</span>} />
            <KV k="Validated" v={manifest.model.validated ? 'Yes' : 'No'} />
            <div className="text-[10.5px] text-slate-500 mt-1">{manifest.model.metrics_note}</div>
          </Card>
        </>
      )}
      <Caveat tone="slate">Base map © OpenStreetMap contributors (ODbL) via OpenFreeMap / OpenMapTiles. Terrain: Terrain Tiles on AWS and Copernicus DEM GLO-30. Land cover: ESA WorldCover 2021. Population: HRSL v1.5 & WorldPop. Weather: Open-Meteo, ERA5. Alerts: NDMA SACHET.</Caveat>
    </Shell>
  );
}

export type { PanelId };
