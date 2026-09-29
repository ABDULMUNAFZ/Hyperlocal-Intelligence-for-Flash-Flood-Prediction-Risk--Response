import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Clock, 
  Database, 
  Radio, 
  CheckCircle2, 
  ShieldCheck,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface TimelineControlsProps {
  currentHourOffset: number; // -24 to +72
  onChangeHourOffset: (offset: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  backendHealthy: boolean;
}

const TIME_STEPS = [
  { offset: -24, label: 'T-24h', badge: 'OBSERVED', color: 'text-emerald-600' },
  { offset: -12, label: 'T-12h', badge: 'OBSERVED', color: 'text-emerald-600' },
  { offset: -6, label: 'T-6h', badge: 'OBSERVED', color: 'text-emerald-600' },
  { offset: 0, label: 'NOW', badge: 'LIVE TELEMETRY', color: 'text-teal-600 font-bold' },
  { offset: 6, label: 'T+6h', badge: 'FORECAST', color: 'text-blue-600' },
  { offset: 12, label: 'T+12h', badge: 'FORECAST', color: 'text-blue-600' },
  { offset: 24, label: 'T+24h', badge: 'FORECAST', color: 'text-blue-600' },
  { offset: 48, label: 'T+48h', badge: 'FORECAST', color: 'text-blue-600' },
  { offset: 72, label: 'T+72h', badge: 'MODEL PREDICTION', color: 'text-purple-600' },
];

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  currentHourOffset,
  onChangeHourOffset,
  isPlaying,
  onTogglePlay,
  backendHealthy,
}) => {
  const currentStep = TIME_STEPS.find(s => s.offset === currentHourOffset) || TIME_STEPS[3];

  return (
    <footer className="absolute bottom-2 left-3 right-3 z-20 pointer-events-auto">
      <div className="px-4 py-2 rounded-2xl bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xl flex items-center justify-between gap-4 text-xs text-slate-800 dark:text-slate-100 transition-colors">
        
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className={`p-2 rounded-xl text-white font-bold flex items-center justify-center transition-all ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-600 hover:bg-teal-700 shadow-sm shadow-teal-500/20'
            }`}
            title={isPlaying ? 'Pause Timeline' : 'Play Timeline Animation'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => onChangeHourOffset(0)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-[10px] font-bold"
            title="Snap to Current Live Time"
          >
            LIVE
          </button>

          <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Temporal Horizon:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              currentStep.badge === 'LIVE TELEMETRY' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' :
              currentStep.badge === 'OBSERVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
              currentStep.badge === 'FORECAST' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
              'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
            }`}>
              {currentStep.badge} ({currentStep.label})
            </span>
          </div>
        </div>

        {/* Time Steps Scrubber */}
        <div className="flex-1 max-w-xl flex items-center gap-1">
          {TIME_STEPS.map((step) => {
            const isSelected = step.offset === currentHourOffset;
            return (
              <button
                key={step.offset}
                onClick={() => onChangeHourOffset(step.offset)}
                className={`flex-1 py-1 px-1 rounded-lg text-center transition-all ${
                  isSelected 
                    ? 'bg-teal-600 text-white font-extrabold shadow-sm scale-105' 
                    : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="block text-[10px] font-mono leading-none">{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Telemetry Status Strip */}
        <div className="hidden md:flex items-center gap-3 text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Copernicus DEM 10m</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Open-Meteo NWP</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>SoilGrids</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
