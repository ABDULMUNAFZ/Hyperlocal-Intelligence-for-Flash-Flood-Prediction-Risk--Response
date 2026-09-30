import React from 'react';

export type DataStatusKind =
  | 'LIVE'
  | 'OBSERVED'
  | 'DERIVED'
  | 'FORECAST'
  | 'MODEL'
  | 'SIMULATION'
  | 'HISTORICAL'
  | 'OFFICIAL'
  | 'USER REPORT'
  | 'PLANNED'
  | 'UNAVAILABLE';

export type DataHonestyKind = DataStatusKind;

interface DataHonestyBadgeProps {
  kind: DataStatusKind;
  source?: string;
  timestamp?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const BADGE_CONFIG: Record<
  DataStatusKind,
  { label: string; bg: string; text: string; border: string; dot: string; desc: string }
> = {
  LIVE: {
    label: 'LIVE',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400 animate-pulse',
    desc: 'Real-time telemetry stream from active sensors / live API',
  },
  OBSERVED: {
    label: 'OBSERVED',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    dot: 'bg-cyan-400',
    desc: 'Empirically measured meteorological or geospatial observation',
  },
  DERIVED: {
    label: 'DERIVED',
    bg: 'bg-teal-500/10',
    text: 'text-teal-300',
    border: 'border-teal-500/30',
    dot: 'bg-teal-400',
    desc: 'Scientifically derived geospatial or hydrological calculation',
  },
  FORECAST: {
    label: 'FORECAST',
    bg: 'bg-blue-500/10',
    text: 'text-blue-300',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
    desc: 'Numerical weather prediction horizon model',
  },
  MODEL: {
    label: 'MODEL PREDICTION',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-300',
    border: 'border-indigo-500/30',
    dot: 'bg-indigo-400',
    desc: 'FloodGuard ML hydrological risk calculation (v2.4 calibrated)',
  },
  SIMULATION: {
    label: 'SIMULATION',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
    desc: 'Hydrological cell solver scenario — synthetic precipitation test',
  },
  HISTORICAL: {
    label: 'HISTORICAL',
    bg: 'bg-purple-500/10',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
    desc: 'Archived flood or landslide footprint (2024 Wayanad event benchmark)',
  },
  OFFICIAL: {
    label: 'OFFICIAL ALERT',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300 font-bold',
    border: 'border-rose-500/40',
    dot: 'bg-rose-500 animate-ping',
    desc: 'Validated bulletin issued by District Collectorate / KSDMA / IMD',
  },
  'USER REPORT': {
    label: 'CITIZEN REPORT',
    bg: 'bg-sky-500/10',
    text: 'text-sky-300',
    border: 'border-sky-500/30',
    dot: 'bg-sky-400',
    desc: 'Crowdsourced field report from verified citizen PWA device',
  },
  PLANNED: {
    label: 'PRODUCTION CONCEPT',
    bg: 'bg-slate-800/80',
    text: 'text-slate-400',
    border: 'border-slate-700/60',
    dot: 'bg-slate-500',
    desc: 'Proposed hardware/sensor layer — deployment blueprint for production',
  },
  UNAVAILABLE: {
    label: 'DATA UNAVAILABLE',
    bg: 'bg-zinc-900',
    text: 'text-zinc-500',
    border: 'border-zinc-800',
    dot: 'bg-zinc-600',
    desc: 'Upstream API offline or coverage absent for this coordinate',
  },
};

export const DataHonestyBadge: React.FC<DataHonestyBadgeProps> = ({
  kind,
  source,
  timestamp,
  className = '',
  size = 'md',
}) => {
  const conf = BADGE_CONFIG[kind];

  const sizeClasses = {
    sm: 'text-[9.5px] px-2 py-0.5 gap-1.5',
    md: 'text-[11px] px-2.5 py-1 gap-2',
    lg: 'text-[12px] px-3 py-1.5 gap-2.5',
  }[size];

  return (
    <div
      className={`inline-flex items-center rounded-full border font-mono tracking-wider transition-all select-none ${conf.bg} ${conf.text} ${conf.border} ${sizeClasses} ${className}`}
      title={`${conf.desc}${source ? ` · Source: ${source}` : ''}${timestamp ? ` · At: ${timestamp}` : ''}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${conf.dot}`} />
      <span className="font-semibold">{conf.label}</span>
      {source && (
        <span className="opacity-60 text-[9px] border-l border-current/25 pl-1.5 uppercase font-sans">
          {source}
        </span>
      )}
      {timestamp && (
        <span className="opacity-50 text-[9px] hidden sm:inline border-l border-current/25 pl-1.5">
          {timestamp}
        </span>
      )}
    </div>
  );
};
