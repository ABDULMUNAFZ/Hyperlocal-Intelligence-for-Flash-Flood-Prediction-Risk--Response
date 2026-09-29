import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Layers, CloudRain, ShieldAlert, Waves, Bell, Video, Bot, Database, Sun, Moon, Maximize2, Minimize2, Box, Square, Route,
  Shield, Info, LifeBuoy, Clapperboard, Users,
} from 'lucide-react';
import { SoundControl } from './EmergencyPanels';
import { panel, StatusBadge } from './ui';
import type { LngLat, PointWeather } from '../../types/geo';
import type { CameraMode } from './constants';

export interface SearchItem {
  id: string;
  name: string;
  type: string;
  lngLat: LngLat;
  zoom: number;
  extra?: string;
  geometry?: any;
  props?: Record<string, any>;
}

export type PanelId = 'layers' | 'weather' | 'risk' | 'simulation' | 'evacuation' | 'alerts' | 'cameras' | 'ai' | 'data' | 'admin' | 'citizen' | 'about' | 'rescue';

interface Props {
  theme: 'light' | 'dark';
  onTheme: () => void;
  is3D: boolean;
  on3D: () => void;
  openPanel: PanelId | null;
  onPanel: (p: PanelId) => void;
  layersOpen: boolean;
  onLayers: () => void;
  backendOnline: boolean | null;
  alertCount: number | null;
  modelSanityPassed: boolean | null;
  centreWeather: PointWeather | null;
  centreName: string;
  centre: LngLat;
  cameraMode: CameraMode;
  searchIndex: SearchItem[];
  onSearchPick: (item: SearchItem) => void;
  responder: boolean;
  liveConnected: boolean;
  demoActive: boolean;
  onDemo: () => void;
  precipitationNow: { maxMmH: number; label: string } | null;
  rescueCount?: number;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

const WAYANAD_VIEWBOX = '75.77,11.98,76.45,11.45';

export function TopBar(p: Props) {
  const now = useClock();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<SearchItem[]>([]);
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [fs, setFs] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const local = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const scored = p.searchIndex
      .map((it) => {
        const n = it.name.toLowerCase();
        const score = n === s ? 0 : n.startsWith(s) ? 1 : n.includes(s) ? 2 : 9;
        return { it, score };
      })
      .filter((x) => x.score < 9)
      .sort((a, b) => a.score - b.score || typeRank(a.it.type) - typeRank(b.it.type) || a.it.name.length - b.it.name.length);
    return scored.slice(0, 12).map((x) => x.it);
  }, [q, p.searchIndex]);

  useEffect(() => { setRemote([]); setRemoteState('idle'); }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  async function searchRemote() {
    if (q.trim().length < 3) return;
    setRemoteState('loading');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&bounded=1&viewbox=${WAYANAD_VIEWBOX}&q=${encodeURIComponent(q.trim())}`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await r.json();
      setRemote(data.map((d: any) => ({
        id: `nom-${d.osm_type}-${d.osm_id}`, name: d.name || d.display_name.split(',')[0], type: `${d.category}:${d.type}`,
        lngLat: [parseFloat(d.lon), parseFloat(d.lat)] as LngLat, zoom: 15, extra: d.display_name.split(',').slice(1, 3).join(','),
      })));
      setRemoteState('done');
    } catch {
      setRemoteState('error');
    }
  }

  const pick = (it: SearchItem) => { p.onSearchPick(it); setOpen(false); setQ(it.name); };
  const cw = p.centreWeather;
  const ist = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  const istDate = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

  const NavBtn = ({ id, icon: Icon, label }: { id: PanelId; icon: any; label: string }) => (
    <button onClick={() => p.onPanel(id)}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] font-semibold tracking-[0.12em] uppercase transition ${p.openPanel === id ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>
      <Icon className="h-3.5 w-3.5" /><span className="hidden 2xl:inline">{label}</span>
    </button>
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-2 md:p-3 space-y-1.5">
      <div className={`${panel} pointer-events-auto flex items-center gap-2 rounded-2xl px-2.5 py-2`}>
        <div className="flex items-center gap-2.5 pr-2 md:pr-3 md:border-r border-slate-200 dark:border-white/10 shrink-0">
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 grid place-items-center shadow-inner">
            <Waves className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-[13px] font-extrabold tracking-[0.22em]">FLOODGUARD</div>
            <div className="text-[9.5px] font-semibold tracking-[0.2em] text-slate-500 dark:text-slate-400">WAYANAD SITUATIONAL AWARENESS</div>
          </div>
        </div>

        <div ref={boxRef} className="relative flex-1 min-w-0 max-w-md">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-2.5">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') { if (local[0]) pick(local[0]); else searchRemote(); } }}
              placeholder="Search Kalpetta, Meppadi, a river, hospital, school…"
              className="w-full bg-transparent py-1.5 text-[12.5px] outline-none placeholder:text-slate-400" />
          </div>
          {open && q.trim().length >= 2 && (
            <div className={`${panel} absolute left-0 right-0 mt-1 max-h-80 overflow-auto rounded-xl p-1`}>
              {local.map((it) => (
                <button key={it.id} onClick={() => pick(it)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10">
                  <span className="truncate text-[12.5px] font-medium">{it.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-400">{it.type.replace('_', ' ')}</span>
                </button>
              ))}
              {remote.map((it) => (
                <button key={it.id} onClick={() => pick(it)} className="flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10">
                  <span className="truncate text-[12.5px] font-medium">{it.name}</span>
                  <span className="truncate text-[10px] text-slate-400">{it.type} · {it.extra}</span>
                </button>
              ))}
              <div className="px-2.5 py-1.5 text-[10.5px] text-slate-400 flex items-center justify-between">
                <span>{local.length} local OSM matches{remoteState === 'done' ? ` · ${remote.length} geocoder results` : ''}</span>
                {remoteState !== 'done' && (
                  <button onClick={searchRemote} className="font-semibold text-sky-600 hover:underline">
                    {remoteState === 'loading' ? 'Searching…' : remoteState === 'error' ? 'Geocoder unavailable' : 'Search roads & rivers (OSM Nominatim)'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <nav className="hidden lg:flex items-center gap-0.5">
          <button onClick={p.onLayers} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] font-semibold tracking-[0.12em] uppercase ${p.layersOpen ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>
            <Layers className="h-3.5 w-3.5" /><span className="hidden 2xl:inline">Layers</span>
          </button>
          <NavBtn id="weather" icon={CloudRain} label="Weather" />
          <NavBtn id="risk" icon={ShieldAlert} label="Risk" />
          <NavBtn id="simulation" icon={Waves} label="Simulation" />
          <NavBtn id="evacuation" icon={Route} label="Evacuation" />
          <NavBtn id="alerts" icon={Bell} label="Alerts" />
          <NavBtn id="cameras" icon={Video} label="Cameras" />
          <NavBtn id="ai" icon={Bot} label="AI" />
          <NavBtn id="data" icon={Database} label="Data" />
          <NavBtn id="admin" icon={Shield} label={p.responder ? 'Command' : 'Responder'} />
          <NavBtn id="about" icon={Info} label="About" />
        </nav>
        {p.responder && (
          <button onClick={() => p.onPanel('rescue')} title="People who requested rescue (responders only)" className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-extrabold tracking-[0.14em] ${p.openPanel === 'rescue' ? 'bg-rose-700 text-white' : 'border border-rose-600 text-rose-600'}`}>
            <Users className="h-3.5 w-3.5" /><span className="hidden sm:inline">RESCUE PEOPLE</span>
            {!!p.rescueCount && <span className="rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{p.rescueCount}</span>}
          </button>
        )}
        <button onClick={() => p.onPanel('citizen')} title="I need help / report" className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10.5px] font-extrabold tracking-[0.14em] text-white hover:bg-rose-700">
          <LifeBuoy className="h-3.5 w-3.5" /><span className="hidden sm:inline">HELP</span>
        </button>
        <button onClick={p.onDemo} title="Deterministic DEMO / SIMULATION scenario" className={`hidden md:flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10.5px] font-extrabold tracking-[0.14em] ${p.demoActive ? 'bg-amber-400 text-amber-950' : 'border border-amber-400 text-amber-600'}`}>
          <Clapperboard className="h-3.5 w-3.5" />{p.demoActive ? 'STOP DEMO' : 'DEMO'}
        </button>

        <div className="flex items-center gap-1 pl-1 md:pl-2 md:border-l border-slate-200 dark:border-white/10">
          <SoundControl />
          <button title="Toggle 3D / 2D" onClick={p.on3D} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 text-[10px] font-bold flex items-center gap-1">
            {p.is3D ? <Box className="h-4 w-4" /> : <Square className="h-4 w-4" />}<span className="hidden md:inline">{p.is3D ? '3D' : '2D'}</span>
          </button>
          <button title="Toggle theme" onClick={p.onTheme} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
            {p.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button title="Fullscreen" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())} className="hidden sm:block rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
            {fs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <div className="hidden md:block pl-2 text-right leading-tight">
            <div className="font-mono text-[15px] font-semibold tabular-nums">{ist}</div>
            <div className="text-[9.5px] tracking-wider text-slate-500 dark:text-slate-400">{istDate} · IST</div>
          </div>
        </div>
      </div>

      {/* Status strip */}
      <div className={`${panel} pointer-events-auto hidden md:flex items-center gap-3 overflow-x-auto no-scrollbar whitespace-nowrap rounded-xl px-3 py-1.5 text-[10.5px] font-semibold tracking-[0.1em] uppercase [&>*]:shrink-0`}>
        <span className={`flex items-center gap-1.5 ${p.backendOnline ? 'text-emerald-600 dark:text-emerald-400' : p.backendOnline === false ? 'text-rose-600' : 'text-slate-400'}`}>
          <span className={`h-2 w-2 rounded-full ${p.backendOnline ? 'bg-emerald-500 animate-pulse' : p.backendOnline === false ? 'bg-rose-500' : 'bg-slate-400'}`} />
          {p.backendOnline ? 'System online' : p.backendOnline === false ? 'Backend offline' : 'Connecting'}
        </span>
        <span className={`flex items-center gap-1 ${p.liveConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} title="Real-time alert channel (SSE)">
          ● {p.liveConnected ? `Live channel${p.responder ? ' · responder' : ''}` : 'Live channel offline'}
        </span>
        <Sep />
        {p.precipitationNow && (
          <span className={p.precipitationNow.maxMmH > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'} title="Open-Meteo model analysis on the district grid">
            {p.precipitationNow.maxMmH > 0 ? `💧 Raining now · max ${p.precipitationNow.maxMmH} mm/h` : 'No current precipitation'} <span className="text-slate-400 normal-case tracking-normal font-medium">({p.precipitationNow.label})</span>
          </span>
        )}
        <Sep />
        <button onClick={() => p.onPanel('alerts')} className={`flex items-center gap-1.5 ${p.alertCount ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
          <Bell className="h-3 w-3" />
          {p.alertCount === null ? 'Official alerts …' : p.alertCount === 0 ? 'No active official alert (SACHET)' : `${p.alertCount} active official alert${p.alertCount > 1 ? 's' : ''}`}
        </button>
        <Sep />
        <button onClick={() => p.onPanel('risk')} className={`flex items-center gap-1.5 ${p.modelSanityPassed === false ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
          <ShieldAlert className="h-3 w-3" />
          Model {p.modelSanityPassed === false ? 'UNVALIDATED · sanity check failed' : p.modelSanityPassed ? 'sanity check passed' : '…'}
        </button>
        <Sep />
        {cw?.available && cw.current ? (
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 normal-case tracking-normal font-medium text-[11px]">
            <span className="uppercase tracking-[0.1em] font-semibold text-[10.5px]">Air</span>
            <b className="text-amber-600 dark:text-amber-400">{cw.current.temperature_c}°C</b>
            <span>{cw.current.relative_humidity_pct}% RH</span>
            <span>Wind {cw.current.wind_speed_kmh} km/h</span>
            <span>Rain 24 h <b>{cw.rainfall_recent?.rain_24h_mm ?? '—'} mm</b></span>
            <span className="text-slate-400">({cw.current.condition})</span>
            <StatusBadge status={cw.provenance.status} />
            <span className="text-[9.5px] text-slate-400">Open-Meteo model</span>
          </span>
        ) : <span className="text-slate-400">Weather …</span>}
        <div className="ml-auto flex items-center gap-2 shrink-0 text-slate-600 dark:text-slate-300">
          <span className="rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-1.5 py-0.5 text-[9.5px]">{p.cameraMode}</span>
          <span>Centre · {p.centreName}</span>
          <span className="font-mono normal-case tracking-normal">{p.centre[1].toFixed(4)}° N · {p.centre[0].toFixed(4)}° E</span>
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="h-3 w-px bg-slate-300 dark:bg-white/15 shrink-0" />;
}

function typeRank(t: string) {
  return ({ town: 0, taluk: 0, preset: 1, village: 1, hospital: 2, suburb: 3, hamlet: 4, fire_station: 2, police: 3, school: 5 } as Record<string, number>)[t] ?? 6;
}
