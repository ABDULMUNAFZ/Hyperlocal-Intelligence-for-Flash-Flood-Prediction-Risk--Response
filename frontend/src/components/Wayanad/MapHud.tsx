import React from 'react';
import { Plus, Minus, Navigation, ChevronUp, ChevronDown, Layers } from 'lucide-react';
import { panel } from './ui';
import { JOURNEY, type CameraMode, type CameraView } from './constants';
import type { HoverInfo } from './WayanadMap';

const MODES: CameraMode[] = ['REGIONAL', 'DISTRICT', 'TOWN', 'VILLAGE', 'MICRO-ZONE', 'BUILDING', 'SIMULATION'];

export function JourneyBar({ current, onGo }: { current: string | null; onGo: (v: CameraView) => void }) {
  return (
    <div className={`${panel} pointer-events-auto flex items-center gap-0.5 overflow-x-auto no-scrollbar rounded-xl px-1.5 py-1 max-w-full`}>
      {JOURNEY.map((v, i) => (
        <React.Fragment key={v.id}>
          {i > 0 && <span className="text-slate-300 dark:text-slate-600 text-[10px]">›</span>}
          <button onClick={() => onGo(v)}
            className={`whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] font-semibold tracking-wide transition ${current === v.id ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>
            {v.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

export function ModeRail({ mode, onMode }: { mode: CameraMode; onMode: (m: CameraMode) => void }) {
  return (
    <div className={`${panel} pointer-events-auto hidden md:flex items-center gap-0.5 rounded-xl px-1.5 py-1`}>
      <div className="px-1.5 text-[8.5px] font-bold tracking-[0.18em] text-slate-400">CAMERA</div>
      {MODES.map((m) => (
        <button key={m} onClick={() => onMode(m)}
          className={`whitespace-nowrap rounded-md px-2 py-1 text-[9.5px] font-bold tracking-[0.12em] transition ${mode === m ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
          {m}
        </button>
      ))}
    </div>
  );
}

export function NavControls({ bearing, pitch, onZoom, onNorth, onPitch, onLayers }: {
  bearing: number; pitch: number; onZoom: (d: number) => void; onNorth: () => void; onPitch: (d: number) => void; onLayers: () => void;
}) {
  const B = ({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) => (
    <button title={title} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">{children}</button>
  );
  return (
    <div className={`${panel} pointer-events-auto flex flex-col items-center rounded-xl p-1`}>
      <B title="Layers" onClick={onLayers}><Layers className="h-4 w-4" /></B>
      <div className="my-0.5 h-px w-6 bg-slate-200 dark:bg-white/10" />
      <B title="Reset north" onClick={onNorth}>
        <Navigation className="h-4 w-4 text-rose-500 transition-transform" style={{ transform: `rotate(${-bearing}deg)` }} />
      </B>
      <div className="text-[9px] font-mono text-slate-500 -mt-1 mb-0.5">{Math.round(((bearing % 360) + 360) % 360)}°</div>
      <B title="Tilt up" onClick={() => onPitch(10)}><ChevronUp className="h-4 w-4" /></B>
      <div className="text-[9px] font-mono text-slate-500">{Math.round(pitch)}°</div>
      <B title="Tilt down" onClick={() => onPitch(-10)}><ChevronDown className="h-4 w-4" /></B>
      <div className="my-0.5 h-px w-6 bg-slate-200 dark:bg-white/10" />
      <B title="Zoom in" onClick={() => onZoom(1)}><Plus className="h-4 w-4" /></B>
      <B title="Zoom out" onClick={() => onZoom(-1)}><Minus className="h-4 w-4" /></B>
    </div>
  );
}

export function HoverTooltip({ info }: { info: HoverInfo | null }) {
  if (!info) return null;
  return (
    <div className={`${panel} pointer-events-none absolute z-30 rounded-lg px-2.5 py-1.5 text-[11px] hidden md:block`}
      style={{ left: info.x + 16, top: info.y + 14, maxWidth: 280 }}>
      <div className="font-semibold text-[11.5px] mb-0.5 truncate">{info.title}</div>
      {info.lines.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">{k}</span><span className="font-medium text-right">{v}</span></div>
      ))}
    </div>
  );
}
