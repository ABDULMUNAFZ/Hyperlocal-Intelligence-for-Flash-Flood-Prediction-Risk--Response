import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeftRight, Eye, ShieldAlert, Sparkles, Droplets } from 'lucide-react';

interface FloodComparisonViewerProps {
  className?: string;
}

export const FloodComparisonViewer: React.FC<FloodComparisonViewerProps> = ({
  className = '',
}) => {
  const [splitPos, setSplitPos] = useState<number>(50); // percentage 0 - 100
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Smooth hover tracking without clicking or dragging - full 0 to 100% reveal
  const updateSplit = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSplitPos(pct);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    updateSplit(e.clientX);
  }, [updateSplit]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      updateSplit(e.touches[0].clientX);
    }
  }, [updateSplit]);

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => {
    setIsHovering(false);
    setSplitPos(50); // gently glide back to center partition on mouse exit
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchStart={() => setIsHovering(true)}
      onTouchEnd={handleMouseLeave}
      className={`relative w-full h-full overflow-hidden select-none cursor-ew-resize ${className}`}
    >
      {/* LAYER 1: AFTER FLOOD / INUNDATION MAP (Hero 2 - Full Layer) */}
      <div className="absolute inset-0 w-full h-full">
        <img
          src="/images/hero2.png"
          onError={(e) => {
            // Fallback to alternative image if hero2.png is not found
            (e.currentTarget as HTMLImageElement).src = '/images/wayanad-flooded-map.png';
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
        className={`absolute inset-0 w-full h-full ${
          isHovering ? '' : 'transition-[clip-path] duration-300 ease-out'
        }`}
        style={{
          clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)`,
          WebkitClipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)`,
        }}
      >
        <img
          src="/images/hero1.png"
          onError={(e) => {
            // Fallback to alternative image if hero1.png is not found
            (e.currentTarget as HTMLImageElement).src = '/images/wayanad-before-flood.jpg';
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
        className={`absolute top-0 bottom-0 z-20 pointer-events-none ${
          isHovering ? '' : 'transition-[left] duration-300 ease-out'
        }`}
        style={{ left: `${splitPos}%` }}
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white/90 text-[10px] font-mono shadow-md">
          <ArrowLeftRight className="h-3 w-3 text-[#D4F826]" />
          <span>Hover left to see flooded map · Hover right to see before flood</span>
        </div>
      </div>
    </div>
  );
};

export default FloodComparisonViewer;
