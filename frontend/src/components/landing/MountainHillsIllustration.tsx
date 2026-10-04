import React from 'react';

interface MountainHillsIllustrationProps {
  className?: string;
  variant?: 'hero-panoramic' | 'section-backdrop' | 'compact-card';
  showContourGrid?: boolean;
}

export const MountainHillsIllustration: React.FC<MountainHillsIllustrationProps> = ({
  className = '',
  variant: _variant = 'hero-panoramic',
  showContourGrid = true,
}) => {
  return (
    <div className={`relative w-full overflow-hidden pointer-events-none select-none ${className}`}>
      <svg
        viewBox="0 0 1440 480"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMax slice"
        className="w-full h-full"
      >
        <defs>
          {/* Subtle natural mountain gradients in light stone, lavender and misty slate */}
          <linearGradient id="mistSkyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F6F5F2" stopOpacity="0" />
            <stop offset="60%" stopColor="#DDD6EE" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#C5BAE0" stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id="chembraFarRidge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DDD6EE" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#EDE8F5" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="midGhatRidge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CEC4E6" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#DDD6EE" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#E5DFEF" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="nearTeaHills" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BCB0DC" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#D2C8E8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#EDEAE3" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="valleyFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B3A5D4" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#FAF9F6" stopOpacity="1" />
          </linearGradient>

          {/* Topographic Contour Pattern */}
          <pattern id="contourLinesPattern" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 0 30 Q 15 15 30 30 T 60 30 M 0 60 Q 15 45 30 60 T 60 60"
              fill="none"
              stroke="#141518"
              strokeWidth="0.5"
              strokeOpacity="0.04"
            />
          </pattern>
        </defs>

        {/* Contour Grid Texture */}
        {showContourGrid && (
          <rect width="1440" height="480" fill="url(#contourLinesPattern)" />
        )}

        {/* 1. Distant Mountain Ridge — High Western Ghats Escarpment (Chembra Peak ~2,100m) */}
        <path
          d="M0 260 C 120 220 220 180 340 195 C 460 210 520 160 640 130 C 740 105 820 145 920 170 C 1040 200 1140 160 1260 185 C 1360 205 1410 220 1440 235 L 1440 480 L 0 480 Z"
          fill="url(#chembraFarRidge)"
        />

        {/* Elevation Contour Lines on Distant Peak */}
        <path
          d="M 520 160 Q 580 135 640 130 T 700 142 M 560 175 Q 610 152 660 150 T 730 160"
          fill="none"
          stroke="#4B435C"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.25"
        />

        {/* 2. Mid Ridge — Escarpment Drainage Divide (~1,400m) */}
        <path
          d="M0 310 C 150 290 280 230 420 250 C 560 270 680 220 800 240 C 940 265 1060 215 1200 245 C 1320 270 1390 260 1440 280 L 1440 480 L 0 480 Z"
          fill="url(#midGhatRidge)"
        />

        {/* Topographic Relief Lines on Mid Ridge */}
        <path
          d="M 280 230 Q 350 245 420 250 T 520 265 M 800 240 Q 870 255 940 265 T 1040 250"
          fill="none"
          stroke="#383344"
          strokeWidth="1"
          strokeOpacity="0.2"
        />

        {/* 3. Rolling Hill Slope — Tea Estate Slopes & Catchments (~980m) */}
        <path
          d="M0 365 C 160 330 310 360 480 320 C 650 280 780 340 960 310 C 1120 280 1280 330 1440 315 L 1440 480 L 0 480 Z"
          fill="url(#nearTeaHills)"
        />

        {/* Geological flow paths / runoff lines */}
        <path
          d="M 480 320 Q 520 370 560 410 M 780 340 Q 820 380 870 420 M 1120 280 Q 1160 340 1210 390"
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          strokeOpacity="0.3"
        />

        {/* 4. Foreground Valley Floor — Meppadi & Chooralmala Confluence (~720m) */}
        <path
          d="M0 415 C 200 395 380 430 580 405 C 780 380 960 425 1160 400 C 1300 385 1390 410 1440 405 L 1440 480 L 0 480 Z"
          fill="url(#valleyFloor)"
        />

        {/* Realistic Elevation & Geographical Benchmarks */}
        <g className="font-mono text-[9px] fill-[#141518] font-bold" opacity="0.65">
          {/* Chembra Peak Pin */}
          <circle cx="640" cy="130" r="3.5" fill="#141518" />
          <line x1="640" y1="130" x2="640" y2="105" stroke="#141518" strokeWidth="1" />
          <text x="648" y="112" fontWeight="bold">CHEMBRA PEAK (2,100m MSL)</text>
          <text x="648" y="123" fontSize="8" fill="#554E63">Orographic Catchment Crest</text>

          {/* Mundakkai Escarpment */}
          <circle cx="340" cy="195" r="3" fill="#6d28d9" />
          <text x="348" y="195" fontSize="8.5">MUNDAKKAI (1,150m)</text>

          {/* Chooralmala River Confluence */}
          <circle cx="960" cy="310" r="3" fill="#be123c" />
          <text x="968" y="310" fontSize="8.5" fill="#be123c">CHOORALMALA GAUGE (780m)</text>

          {/* Valley Outflow */}
          <circle cx="1200" cy="245" r="3" fill="#141518" />
          <text x="1208" y="245" fontSize="8.5">KABINI BASIN ESCARPMENT</text>
        </g>
      </svg>
    </div>
  );
};

export default MountainHillsIllustration;
