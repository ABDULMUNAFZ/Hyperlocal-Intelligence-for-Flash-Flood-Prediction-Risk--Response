import React, { useEffect, useRef } from 'react';
import { Compass, Sun, Moon, CloudRain, Wind, Radio } from 'lucide-react';

interface GeoDomeOverlayProps {
  showDomeMask: boolean;
  showRadarSweep: boolean;
  showWeatherAtmosphere: boolean;
  bearing: number;
  pitch: number;
  zoom: number;
  centerCoords: [number, number];
  isDarkMode: boolean;
  weatherMode: 'clear' | 'monsoon_rain' | 'cloudburst' | 'cloudy';
}

export const GeoDomeOverlay: React.FC<GeoDomeOverlayProps> = ({
  showDomeMask,
  showRadarSweep,
  showWeatherAtmosphere,
  bearing,
  pitch,
  centerCoords,
  isDarkMode,
  weatherMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animate dynamic rain & cloud particles when weather atmosphere is active
  useEffect(() => {
    if (!showWeatherAtmosphere || weatherMode === 'clear') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    // Particle pool for rain streaks
    const particleCount = weatherMode === 'cloudburst' ? 220 : 120;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 22 + 10,
      speed: Math.random() * 14 + 16,
      opacity: Math.random() * 0.4 + 0.25,
      tilt: -4,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render rain streaks
      ctx.strokeStyle = isDarkMode ? 'rgba(56, 189, 248, 0.45)' : 'rgba(2, 132, 199, 0.35)';
      ctx.lineWidth = 1.2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.length);
        ctx.stroke();

        p.y += p.speed;
        p.x += p.tilt;

        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [showWeatherAtmosphere, weatherMode, isDarkMode]);

  if (!showDomeMask) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
      {/* 1. Canvas layer for dynamic weather particles (Rain streaks) */}
      {showWeatherAtmosphere && weatherMode !== 'clear' && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
        />
      )}

      {/* 2. South India Geo-Dome Circular Boundary Ring & Outer Mask */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Radial mask: South India inside circle is clear, outside circle has dark cosmic/situational vignette */}
          <radialGradient id="southIndiaDomeMask" cx="50%" cy="52%" r="48%" fx="50%" fy="52%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="68%" stopColor="#000000" stopOpacity="0" />
            <stop offset="82%" stopColor="#020617" stopOpacity={isDarkMode ? '0.65' : '0.45'} />
            <stop offset="96%" stopColor="#020617" stopOpacity={isDarkMode ? '0.94' : '0.85'} />
            <stop offset="100%" stopColor="#020617" stopOpacity={isDarkMode ? '0.98' : '0.92'} />
          </radialGradient>

          {/* Glowing perimeter ring stroke gradient */}
          <linearGradient id="domePerimeterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.8" />
            <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#00f0ff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.5" />
          </linearGradient>

          {/* Radar Sweep Arc Gradient */}
          <radialGradient id="radarSweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.0" />
          </radialGradient>
        </defs>

        {/* Outer Circular Vignette Mask (cuts out rest of world as requested) */}
        <rect width="1920" height="1080" fill="url(#southIndiaDomeMask)" />

        {/* Circular Radar Dome Perimeter (Center 960, 560, Radius 490) */}
        <g transform="translate(960, 560)">
          {/* Primary Outer Disc Ring */}
          <circle
            cx="0"
            cy="0"
            r="490"
            fill="none"
            stroke="url(#domePerimeterGrad)"
            strokeWidth="2.5"
            strokeDasharray="12 4"
            className="opacity-90"
          />

          {/* Secondary Concentric Range Ticks */}
          <circle
            cx="0"
            cy="0"
            r="380"
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            strokeOpacity="0.35"
          />
          <text x="385" y="-10" fill="#38bdf8" fontSize="10" fontFamily="monospace" opacity="0.6">
            500 KM RANGE
          </text>

          <circle
            cx="0"
            cy="0"
            r="230"
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            strokeOpacity="0.3"
          />
          <text x="235" y="-10" fill="#38bdf8" fontSize="10" fontFamily="monospace" opacity="0.6">
            250 KM RANGE
          </text>

          {/* Rotating Radar Sweep Line */}
          {showRadarSweep && (
            <g className="animate-[spin_8s_linear_infinite] origin-center opacity-70">
              <line x1="0" y1="0" x2="0" y2="-490" stroke="#00f0ff" strokeWidth="2" strokeOpacity="0.8" />
              <path
                d="M 0 0 L -120 -475 A 490 490 0 0 1 0 -490 Z"
                fill="url(#radarSweepGrad)"
                opacity="0.3"
              />
            </g>
          )}

          {/* Compass Bearing Degree Numerals along Perimeter */}
          {/* 000° North */}
          <text x="0" y="-505" fill="#38bdf8" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
            000° N [DECCAN / GODAVARI]
          </text>
          <line x1="0" y1="-490" x2="0" y2="-475" stroke="#38bdf8" strokeWidth="2.5" />

          {/* 045° North East */}
          <text x="365" y="-365" fill="#94a3b8" fontSize="11" fontFamily="monospace">
            045° [BAY OF BENGAL]
          </text>
          <line x1="346" y1="-346" x2="335" y2="-335" stroke="#94a3b8" strokeWidth="1.5" />

          {/* 090° East */}
          <text x="505" y="4" fill="#38bdf8" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="start">
            090° E [COROMANDEL]
          </text>
          <line x1="490" y1="0" x2="475" y2="0" stroke="#38bdf8" strokeWidth="2.5" />

          {/* 135° South East */}
          <text x="365" y="375" fill="#94a3b8" fontSize="11" fontFamily="monospace">
            135° [PALK STRAIT]
          </text>
          <line x1="346" y1="346" x2="335" y2="335" stroke="#94a3b8" strokeWidth="1.5" />

          {/* 180° South */}
          <text x="0" y="520" fill="#38bdf8" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
            180° S [CAPE COMORIN / INDIAN OCEAN]
          </text>
          <line x1="0" y1="490" x2="0" y2="475" stroke="#38bdf8" strokeWidth="2.5" />

          {/* 225° South West */}
          <text x="-480" y="375" fill="#94a3b8" fontSize="11" fontFamily="monospace">
            225° [LAKSHADWEEP SEA]
          </text>
          <line x1="-346" y1="346" x2="-335" y2="335" stroke="#94a3b8" strokeWidth="1.5" />

          {/* 270° West */}
          <text x="-505" y="4" fill="#38bdf8" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="end">
            270° W [MALABAR / ARABIAN SEA]
          </text>
          <line x1="-490" y1="0" x2="-475" y2="0" stroke="#38bdf8" strokeWidth="2.5" />

          {/* 315° North West */}
          <text x="-480" y="-365" fill="#94a3b8" fontSize="11" fontFamily="monospace">
            315° [WESTERN GHATS RIDGELINE]
          </text>
          <line x1="-346" y1="-346" x2="-335" y2="-335" stroke="#94a3b8" strokeWidth="1.5" />

          {/* Center Crosshair */}
          <line x1="-15" y1="0" x2="15" y2="0" stroke="#00f0ff" strokeWidth="1.5" strokeOpacity="0.8" />
          <line x1="0" y1="-15" x2="0" y2="15" stroke="#00f0ff" strokeWidth="1.5" strokeOpacity="0.8" />
          <circle cx="0" cy="0" r="3" fill="#00f0ff" />
        </g>
      </svg>

      {/* 3. Celestial Orbital Compass Badges (Top-Right / Reference Image 1 & 2) */}
      <div className="absolute top-16 right-16 hidden lg:flex flex-col items-end gap-2 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-md shadow-lg">
          <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
          <span>SUN 18.2° ELEV · SUNRISE 06:10 · SUNSET 18:07</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-md shadow-lg">
          <Moon className="w-4 h-4 text-cyan-300" />
          <span>MOON WAXING GIBBOUS 91% · MOONRISE 19:56</span>
        </div>
      </div>

      {/* 4. Live Atmosphere & Weather Telemetry Bar (Reference Image 1) */}
      {showWeatherAtmosphere && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 rounded-2xl bg-slate-950/85 dark:bg-slate-950/90 border border-slate-700/70 backdrop-blur-xl shadow-2xl text-xs font-mono text-slate-200">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Radio className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
            <span className="font-semibold text-white">AWS DOPPLER RADAR:</span>
            <span>ACTIVE</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-sky-400" />
            <span>SW MONSOON 18 km/h (GUST 38)</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5 text-amber-300">
            <CloudRain className="w-3.5 h-3.5" />
            <span>OROGRAPHIC RAIN: {weatherMode.toUpperCase().replace('_', ' ')}</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>CENTRE:</span>
            <span className="text-white">{centerCoords[1].toFixed(3)}°N, {centerCoords[0].toFixed(3)}°E</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoDomeOverlay;
