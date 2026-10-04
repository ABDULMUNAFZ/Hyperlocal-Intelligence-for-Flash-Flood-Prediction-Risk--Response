import React, { useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Compass } from 'lucide-react';

interface FloodComparisonViewerProps {
  className?: string;
}

export const FloodComparisonViewer: React.FC<FloodComparisonViewerProps> = ({
  className = '',
}) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const beforeRef = useRef<HTMLDivElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const raf = useRef(0);
  const pendingX = useRef<number | null>(null);

  // The split follows the pointer directly (written to the DOM on the next frame, no React re-render),
  // so the reveal stays instant even while the rest of the page is busy animating.
  const applySplit = useCallback((pct: number, glide: boolean) => {
    const before = beforeRef.current;
    const divider = dividerRef.current;
    if (!before || !divider) return;
    const clip = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
    before.style.transition = glide ? 'clip-path 300ms ease-out, -webkit-clip-path 300ms ease-out' : 'none';
    divider.style.transition = glide ? 'left 300ms ease-out' : 'none';
    before.style.clipPath = clip;
    before.style.setProperty('-webkit-clip-path', clip);
    divider.style.left = `${pct}%`;
  }, []);

  const updateSplit = useCallback((clientX: number) => {
    pendingX.current = clientX;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = containerRef.current;
      const x = pendingX.current;
      if (!el || x === null) return;
      const rect = el.getBoundingClientRect();
      applySplit(Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100)), false);
    });
  }, [applySplit]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    updateSplit(e.clientX);
  }, [updateSplit]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      updateSplit(e.touches[0].clientX);
    }
  }, [updateSplit]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => updateSplit(e.clientX);
  const handleMouseLeave = () => {
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
    pendingX.current = null;
    applySplit(50, true); // gently glide back to center partition on mouse exit
  };

  // Clicking anywhere on the image navigates directly to the 3D Map
  const handleClick = () => {
    navigate('/app/map');
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchStart={(e) => { if (e.touches.length > 0) updateSplit(e.touches[0].clientX); }}
      onTouchEnd={handleMouseLeave}
      role="button"
      tabIndex={0}
      title="Click image to enter 3D Map (Hover to compare Before & Flooded)"
      className={`relative w-full h-full overflow-hidden select-none cursor-pointer group ${className}`}
    >
      {/* LAYER 1: AFTER FLOOD / INUNDATION MAP (Hero 2 - Full Layer) */}
      <div className="absolute inset-0 w-full h-full">
        <img
          // Responsive WebP (≈160 KB at 1920 px instead of a 3.5 MB PNG); PNG remains as fallback
          src="/images/hero2-1920.webp"
          srcSet="/images/hero2-1280.webp 1280w, /images/hero2-1920.webp 1920w, /images/hero2-2446.webp 2446w"
          sizes="(min-width: 1024px) 70vw, 100vw"
          width={2446}
          height={1368}
          decoding="async"
          fetchPriority="low"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            img.removeAttribute('srcset');
            img.src = img.src.includes('hero2.png') ? '/images/wayanad-flooded-map.png' : '/images/hero2.png';
          }}
          alt="Wayanad Deluge Flood Inundation Map"
          className="w-full h-full object-cover object-center select-none pointer-events-none"
          style={{ imageRendering: '-webkit-optimize-contrast' }}
        />
        {/* Active Inundation Indicator Pill */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/90 backdrop-blur-md border border-rose-500/50 text-rose-200 text-[10.5px] font-mono font-bold shadow-lg">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span>FLOODED DELUGE (ACTIVE 36 mm/h)</span>
          </div>
        </div>
      </div>

      {/* LAYER 2: BEFORE FLOOD / BASELINE MAP (Hero 1 - Clipped Layer based on splitPos) */}
      <div
        ref={beforeRef}
        className="absolute inset-0 w-full h-full"
        style={{
          clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)',
          WebkitClipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)',
        }}
      >
        <img
          // Largest contentful paint image: responsive WebP, fetched first (PNG remains as fallback)
          src="/images/hero1-1920.webp"
          srcSet="/images/hero1-1280.webp 1280w, /images/hero1-1920.webp 1920w, /images/hero1-2560.webp 2560w"
          sizes="(min-width: 1024px) 70vw, 100vw"
          width={2618}
          height={1498}
          decoding="async"
          fetchPriority="high"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            img.removeAttribute('srcset');
            img.src = img.src.includes('hero1.png') ? '/images/wayanad-before-flood.jpg' : '/images/hero1.png';
          }}
          alt="Wayanad Baseline Before Flood Risk Terrain"
          className="w-full h-full object-cover object-center select-none pointer-events-none"
          style={{ imageRendering: '-webkit-optimize-contrast' }}
        />
        {/* Baseline Status Pill */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181A1E]/90 backdrop-blur-md border border-[#33363F] text-white text-[10.5px] font-mono font-bold shadow-lg">
            <span className="h-2 w-2 rounded-full bg-[#D4F826]"></span>
            <span>BEFORE FLOOD (BASELINE MAP)</span>
          </div>
        </div>
      </div>

      {/* PARTITION DIVIDER BAR (Follows cursor smoothly on hover) */}
      <div
        ref={dividerRef}
        className="absolute top-0 bottom-0 z-20 pointer-events-none"
        style={{ left: '50%' }}
      >
        {/* Crisp Glowing Divider Line */}
        <div className="absolute top-0 bottom-0 -left-[1.5px] w-[3px] bg-[#D4F826] shadow-[0_0_14px_#D4F826]" />

        {/* Floating Center Comparison Handle Badge */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30">
          <div className="px-3.5 py-1.5 rounded-full bg-[#181A1E] text-white border border-[#D4F826] text-[10px] font-mono font-bold tracking-wider whitespace-nowrap shadow-2xl flex items-center gap-2">
            <span className="text-white/90">◀ BEFORE</span>
            <span className="text-[#D4F826] font-black">|</span>
            <span className="text-white/90">FLOODED ▶</span>
          </div>
        </div>
      </div>

      {/* Bottom Floating Hint Strip */}
      <div className="absolute bottom-3 inset-x-0 z-20 flex items-center justify-center pointer-events-none">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white text-[10px] font-mono shadow-md">
          <ArrowLeftRight className="h-3 w-3 text-[#D4F826]" />
          <span>Hover to compare</span>
          <span className="text-white/40">|</span>
          <Compass className="h-3 w-3 text-[#D4F826] animate-pulse" />
          <span className="text-[#D4F826] font-bold">Click image to enter 3D Map</span>
        </div>
      </div>
    </div>
  );
};

export default FloodComparisonViewer;
