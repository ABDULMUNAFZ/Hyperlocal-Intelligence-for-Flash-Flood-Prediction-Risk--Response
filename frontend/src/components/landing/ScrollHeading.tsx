import React from 'react';
import ScrollReveal from '../react-bits/ScrollReveal';

export type HeadingAnimationVariant =
  | 'default'
  | 'contour'
  | 'radar'
  | 'crosshair'
  | 'stamp'
  | 'depth'
  | 'tac-hud';

interface ScrollHeadingProps {
  category?: string;
  badge?: string;
  title: string;
  italicWord?: string;
  subtitle?: string;
  className?: string;
  animationVariant?: HeadingAnimationVariant;
  theme?: 'light' | 'dark';
  // Deprecated number prop kept as optional so existing callers don't break, but it will NOT render artificial AI numbers
  number?: string;
}

export const ScrollHeading: React.FC<ScrollHeadingProps> = ({
  category,
  badge,
  title,
  italicWord,
  subtitle,
  className = '',
  animationVariant = 'default',
  theme = 'light',
}) => {
  const displayLabel = category || badge;
  const isDark = theme === 'dark';

  return (
    <div className={`max-w-3xl mb-12 space-y-3.5 relative ${className}`}>
      {/* Editorial Domain Tag (Clean, human, non-AI) */}
      {displayLabel && (
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full shadow-2xs ${
              isDark
                ? 'bg-white/10 border border-white/20 text-white'
                : 'bg-white border border-[#DDD9CE] text-[#23252A]'
            }`}
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4F826] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#9BBD00]"></span>
            </span>
            <span className="text-[11px] font-mono font-semibold tracking-wider uppercase">
              {displayLabel}
            </span>
          </div>

          {/* Distinct Visual Accents depending on animationVariant */}
          {animationVariant === 'contour' && (
            <span
              className={`text-[10px] font-mono border-l pl-2 hidden sm:inline ${
                isDark ? 'text-slate-400 border-white/20' : 'text-[#7A7D87] border-[#DDD9CE]'
              }`}
            >
              ELEVATION CONTOURS · 2,100M MSL
            </span>
          )}
          {animationVariant === 'radar' && (
            <span
              className={`text-[10px] font-mono border-l pl-2 hidden sm:inline ${
                isDark ? 'text-slate-400 border-white/20' : 'text-[#7A7D87] border-[#DDD9CE]'
              }`}
            >
              DOPPLER SWEEP · 10-MIN INTERVALS
            </span>
          )}
          {animationVariant === 'crosshair' && (
            <span
              className={`text-[10px] font-mono border-l pl-2 hidden sm:inline ${
                isDark ? 'text-slate-400 border-white/20' : 'text-[#7A7D87] border-[#DDD9CE]'
              }`}
            >
              CV OPTICAL TELEMETRY · EDGE NODES
            </span>
          )}
          {animationVariant === 'stamp' && (
            <span
              className={`text-[10px] font-mono border-l pl-2 hidden sm:inline ${
                isDark ? 'text-slate-400 border-white/20' : 'text-[#7A7D87] border-[#DDD9CE]'
              }`}
            >
              MANDATORY HUMAN AUDIT · 100% TRIAGE
            </span>
          )}
          {animationVariant === 'depth' && (
            <span
              className={`text-[10px] font-mono border-l pl-2 hidden sm:inline ${
                isDark ? 'text-slate-400 border-white/20' : 'text-[#7A7D87] border-[#DDD9CE]'
              }`}
            >
              HYDROLOGICAL BASIN GAUGES · 461 CELLS
            </span>
          )}
        </div>
      )}

      {/* GSAP ScrollReveal Title with Smooth Scroll Entrance */}
      <ScrollReveal
        baseOpacity={isDark ? 0.25 : 0.15}
        enableBlur={true}
        baseRotation={animationVariant === 'stamp' ? 0 : 1.2}
        blurStrength={animationVariant === 'crosshair' ? 6 : 4}
        containerClassName="my-0"
        textClassName={`font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.08] ${
          isDark ? 'text-white' : 'text-[#181A1E]'
        }`}
      >
        {title}
      </ScrollReveal>

      {italicWord && (
        <div
          className={`italic font-normal font-serif text-2xl sm:text-4xl underline decoration-4 underline-offset-8 -mt-1 ${
            isDark
              ? 'text-[#D4F826] decoration-white/30'
              : 'text-[#4A4740] decoration-[#D4F826]'
          }`}
        >
          {italicWord}
        </div>
      )}

      {subtitle && (
        <p
          className={`font-sans text-base sm:text-lg leading-relaxed pt-1 ${
            isDark ? 'text-slate-300' : 'text-[#52555E]'
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default ScrollHeading;
