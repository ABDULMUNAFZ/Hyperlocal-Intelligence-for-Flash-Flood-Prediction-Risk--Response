import React, { useEffect, useState } from 'react';
import FloodGuardLogo from './common/FloodGuardLogo';

interface FloodGuardLoaderProps {
  fullScreen?: boolean;
  message?: string;
}

export const FloodGuardLoader: React.FC<FloodGuardLoaderProps> = ({
  fullScreen = true,
  message = 'INITIALIZING HYPERLOCAL HYDRO-ENGINE',
}) => {
  const [progress, setProgress] = useState(12);
  const [leadTime, setLeadTime] = useState(45);
  const [telemetryStep, setTelemetryStep] = useState(0);

  const steps = [
    'Parsing Copernicus 30m Elevation Grid...',
    'Calibrating 461 Catchment Basin Cells...',
    'Connecting IMD Doppler & Open-Meteo Streams...',
    'Synchronizing Chembra Orographic Slope Vectors...',
    'Verification Protocol Armed: 100% Human Triage Ready.',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return 98;
        const inc = Math.floor(Math.random() * 14) + 6;
        return Math.min(prev + inc, 98);
      });

      setLeadTime((prev) => Math.max(prev - 3, 1));
      setTelemetryStep((prev) => (prev + 1) % steps.length);
    }, 180);

    return () => clearInterval(interval);
  }, [steps.length]);

  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#EBE8E0] text-[#181A1E] px-4'
    : 'w-full py-16 flex flex-col items-center justify-center bg-[#EBE8E0] text-[#181A1E] px-4 rounded-3xl border border-[#DDD9CE]';

  return (
    <div className={containerClasses}>
      {/* Background Topographic Texture */}
      <div className="absolute inset-0 pointer-events-none light-contour-lines opacity-30" />

      {/* Main Glass/Porcelain Loader Card */}
      <div className="relative z-10 w-full max-w-md p-8 rounded-[2.5rem] bg-white border border-[#DDD9CE] shadow-2xl space-y-6 text-center">
        {/* Rescue Emblem Icon with Dual Pulsing Beacon */}
        <div className="relative mx-auto flex items-center justify-center h-20 w-20 rounded-3xl bg-[#181A1E] p-4 shadow-xl border border-[#2B2E37]">
          <FloodGuardLogo className="h-10 w-auto" variant="citron" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4F826] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-[#D4F826]"></span>
          </span>
        </div>

        {/* Title & District Tag */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBE8E0] text-[10px] font-mono font-bold tracking-widest text-[#181A1E] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9BBD00]"></span>
            <span>WAYANAD · DISASTER INTELLIGENCE</span>
          </div>
          <h2 className="font-display font-black text-2xl tracking-tight text-[#181A1E] pt-1">
            FLOODGUARD
          </h2>
          <p className="text-xs font-mono text-[#656872] uppercase tracking-wider">
            {message}
          </p>
        </div>

        {/* Countdown & Progress Meter */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="flex items-center gap-1.5 text-[#181A1E]">
              <span className="text-[#9BBD00]">●</span>
              <span>CALIBRATING</span>
            </span>
            <span className="text-lg font-display font-extrabold text-[#181A1E]">
              {progress}%
            </span>
          </div>

          {/* Progress Bar with Glowing Neon Citron Head */}
          <div className="w-full h-2 rounded-full bg-[#EAE7DF] overflow-hidden p-0.5 relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#181A1E] to-[#9BBD00] transition-all duration-200 relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-[#D4F826] shadow-[0_0_8px_#D4F826]" />
            </div>
          </div>
        </div>

        {/* Real-time Lead-time Countdown Ticker & Live Telemetry Feed */}
        <div className="p-3.5 rounded-2xl bg-[#F4F2EB] border border-[#DDD9CE] text-left space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#656872]">EARLY RUNOFF WINDOW:</span>
            <span className="font-bold text-[#181A1E] px-2 py-0.5 rounded-full bg-white border border-[#DDD9CE]">
              &lt; {leadTime} MIN LEAD
            </span>
          </div>
          <div className="text-[11px] font-mono text-[#4A4740] flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4F826] animate-pulse flex-none"></span>
            <span className="truncate">{steps[telemetryStep]}</span>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="text-[10px] font-mono text-[#7A7D87]">
          AI DETECTS · 100% HUMAN OFFICER VERIFICATION
        </div>
      </div>
    </div>
  );
};

export default FloodGuardLoader;
