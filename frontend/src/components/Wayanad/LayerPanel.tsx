import React, { useState } from 'react';
import { ChevronDown, ChevronLeft, Crosshair, PenTool, CircleDot, X, Target, Mountain } from 'lucide-react';
import { panel, StatusBadge, SectionTitle, Btn } from './ui';
import { LAYER_GROUPS, ZONE_PRESETS, RISK_COLORS, type LayerKey, type LayerState } from './constants';
import { POI_STYLE, iconDataUrl } from './icons';
import { POI_LAYER_CATEGORIES } from './constants';
import type { OperationalZone, FeatureCollection } from '../../types/geo';

interface Props {
  open: boolean;
  onClose: () => void;
  layers: LayerState;
  onToggle: (k: LayerKey) => void;
  exaggeration: number;
  onExaggeration: (v: number) => void;
  zone: OperationalZone | null;
  onZone: (z: OperationalZone | null) => void;
  taluks: FeatureCollection | null;
  interaction: 'select' | 'draw' | 'radius';
  onInteraction: (m: 'select' | 'draw' | 'radius') => void;
  radiusKm: number;
  onRadius: (r: number) => void;
  loadingLayers: Record<string, boolean>;
  poiCounts: Record<string, number>;
  cameraCount: number;
}

export function LayerPanel(p: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ weather: true, env: true, places: true, ops: false });

  if (!p.open) return null;
  return (
    <aside className={`${panel} pointer-events-auto flex max-h-full w-[300px] flex-col overflow-hidden rounded-2xl`}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase">Operations & layers</div>
        <button onClick={p.onClose} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
      </div>

      <div className="overflow-y-auto px-3 pb-3 space-y-3">
        {/* Operational area */}
        <section className="rounded-xl border border-rose-200/80 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/[0.04] p-2.5">
          <SectionTitle right={p.zone && <button onClick={() => p.onZone(null)} className="text-[10px] font-semibold text-rose-600 hover:underline flex items-center gap-0.5"><X className="h-3 w-3" />Exit</button>}>
            <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300"><Target className="h-3.5 w-3.5" />Operational area</span>
          </SectionTitle>
          {p.zone ? (
            <div className="text-[12px]">
              <div className="font-bold text-rose-700 dark:text-rose-300">{p.zone.name}</div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px]">Outside area de-emphasised · labels & POIs filtered to the zone</div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">Select an incident zone to focus analysis. Everything outside is dimmed.</div>
          )}
          <div className="mt-2 grid grid-cols-1 gap-1">
            {ZONE_PRESETS.map((z) => (
              <button key={z.id} onClick={() => p.onZone(z)}
                className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11.5px] transition ${p.zone?.id === z.id ? 'bg-rose-600 text-white' : 'hover:bg-white dark:hover:bg-white/5'}`}>
                <span className="flex items-center gap-1.5"><Crosshair className="h-3 w-3 opacity-70" />{z.name}</span>
              </button>
            ))}
            {p.taluks?.features.map((f) => (
              <button key={f.properties.id} onClick={() => p.onZone({
                id: f.properties.id, name: `${f.properties.name} taluk`, kind: 'taluk', geometry: f.geometry,
                center: [0, 0],
              })}
                className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11.5px] transition ${p.zone?.id === f.properties.id ? 'bg-rose-600 text-white' : 'hover:bg-white dark:hover:bg-white/5'}`}>
                <span className="flex items-center gap-1.5"><Mountain className="h-3 w-3 opacity-70" />{f.properties.name} taluk</span>
                <span className="text-[9.5px] opacity-60">OSM</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <Btn tone={p.interaction === 'radius' ? 'danger' : 'default'} className="flex-1" onClick={() => p.onInteraction(p.interaction === 'radius' ? 'select' : 'radius')}>
              <CircleDot className="h-3.5 w-3.5" />Radius
            </Btn>
            <Btn tone={p.interaction === 'draw' ? 'danger' : 'default'} className="flex-1" onClick={() => p.onInteraction(p.interaction === 'draw' ? 'select' : 'draw')}>
              <PenTool className="h-3.5 w-3.5" />Draw
            </Btn>
          </div>
          {p.interaction === 'radius' && (
            <div className="mt-2 text-[11px]">
              <div className="flex items-center justify-between"><span>Radius</span><b>{p.radiusKm} km</b></div>
              <input type="range" min={0.5} max={4} step={0.5} value={p.radiusKm} onChange={(e) => p.onRadius(parseFloat(e.target.value))} className="w-full accent-rose-600" />
              <div className="text-slate-500">Click the map to place the zone centre.</div>
            </div>
          )}
          {p.interaction === 'draw' && (
            <div className="mt-2 text-[11px] text-slate-500">Click to add vertices · double-click or Enter to finish · Esc to cancel. Keep micro-zones under ~40 km² for building-level analysis.</div>
          )}
        </section>

        {/* Terrain exaggeration */}
        <section>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold">Vertical exaggeration</span>
            <span className="font-mono">×{p.exaggeration.toFixed(1)}</span>
          </div>
          <input type="range" min={1} max={2.5} step={0.1} value={p.exaggeration} onChange={(e) => p.onExaggeration(parseFloat(e.target.value))} className="w-full accent-sky-600" />
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Visualisation only — heights on screen are scaled ×{p.exaggeration.toFixed(1)}; readouts show true elevation.</div>
        </section>

        {LAYER_GROUPS.map((g) => (
          <section key={g.id}>
            <button onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))} className="flex w-full items-center justify-between py-1">
              <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-slate-500 dark:text-slate-400">{g.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${collapsed[g.id] ? '-rotate-90' : ''}`} />
            </button>
            {!collapsed[g.id] && (
              <div className="space-y-0.5">
                {g.layers.map((l) => {
                  const disabled = l.status === 'UNAVAILABLE' && !(l.key === 'cameras' && p.cameraCount > 0);
                  const cats = POI_LAYER_CATEGORIES[l.key];
                  const count = cats ? cats.reduce((s, c) => s + (p.poiCounts[c] ?? 0), 0) : undefined;
                  const status = l.key === 'cameras' ? (p.cameraCount ? 'LIVE' : 'UNAVAILABLE') : l.status;
                  return (
                    <div key={l.key} className="group">
                      <label className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-[12px] ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/5'}`} title={`${l.source}${l.note ? ' — ' + l.note : ''}`}>
                        <input type="checkbox" disabled={disabled} checked={!disabled && p.layers[l.key]} onChange={() => p.onToggle(l.key)} className="h-3.5 w-3.5 accent-sky-600" />
                        {cats && <img src={iconDataUrl(cats[0])} className="h-4 w-4" alt="" />}
                        <span className="flex-1 truncate">{l.label}{count !== undefined && <span className="text-slate-400 text-[10px]"> · {count}</span>}</span>
                        {p.loadingLayers[l.key] && <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" />}
                        <StatusBadge status={status} />
                      </label>
                      {(disabled || (p.layers[l.key] && l.note)) && l.note && (
                        <div className="pl-7 pr-1 pb-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{l.note}</div>
                      )}
                      {p.layers[l.key] && <Legend k={l.key} />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}

function Ramp({ stops, labels }: { stops: string[]; labels: string[] }) {
  return (
    <div className="pl-7 pr-2 pb-1.5">
      <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <div className="mt-0.5 flex justify-between text-[9.5px] text-slate-400 font-mono">{labels.map((l) => <span key={l}>{l}</span>)}</div>
    </div>
  );
}

function Legend({ k }: { k: LayerKey }) {
  switch (k) {
    case 'slope': return <Ramp stops={['#fef0b4', '#fdbe5a', '#f06e32', '#c81e28', '#6e0028']} labels={['5°', '15°', '25°', '35°', '50°']} />;
    case 'elevation': return <Ramp stops={['#286e3c', '#6ea050', '#c8c878', '#be965a', '#966e50', '#f0f0f0']} labels={['0', '700', '1000', '1500', '2100 m']} />;
    case 'population': return <Ramp stops={['#ffdc78', '#faa03c', '#dc4628', '#8c003c']} labels={['10', '100', '1k', '10k /km²']} />;
    case 'rainPast': case 'rainForecast': return <Ramp stops={['#a5d8ff', '#4dabf7', '#1971c2', '#5f3dc4', '#c2255c']} labels={['2.5', '15.6', '64.5', '115.6', '204.5 mm']} />;
    case 'temperature': return <Ramp stops={['#4dabf7', '#8ce99a', '#ffd43b', '#ff922b', '#e03131']} labels={['12', '18', '24', '30', '36 °C']} />;
    case 'humidity': return <Ramp stops={['#fff3bf', '#a5d8ff', '#1864ab']} labels={['40', '70', '100 %']} />;
    case 'flowAcc': return <Ramp stops={['#9fc8f0', '#3c96eb', '#1e5ad2', '#0a28a0']} labels={['0.01', '0.1', '1', '10 km²']} />;
    case 'twi': return <Ramp stops={['#f0f0c8', '#a0d2dc', '#4696d2', '#143ca0']} labels={['4', '7', '10', '14']} />;
    case 'modelRisk':
      return (
        <div className="pl-7 pr-2 pb-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9.5px]">
          {Object.entries(RISK_COLORS).map(([lvl, c]) => <span key={lvl} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{lvl.replace('_', ' ')}</span>)}
        </div>
      );
    case 'landcover':
      return (
        <div className="pl-7 pr-2 pb-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9.5px]">
          {[['Tree cover', '#006400'], ['Shrubland', '#ffbb22'], ['Grassland', '#ffff4c'], ['Cropland', '#f096ff'], ['Built-up', '#fa0000'], ['Bare', '#b4b4b4'], ['Water', '#0064c8'], ['Wetland', '#0096a0']].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{l}</span>
          ))}
        </div>
      );
    case 'buildings':
      return <div className="pl-7 pr-2 pb-1.5 text-[9.5px] text-slate-500">Zone buildings coloured by OSM type; heights: OSM tag › levels×3 m (estimated) › 3.5 m placeholder.</div>;
    default:
      return null;
  }
}

export { POI_STYLE };
