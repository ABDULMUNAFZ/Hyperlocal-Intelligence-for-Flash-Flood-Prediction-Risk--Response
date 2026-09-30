import React from 'react';

export type LogoVariant = 'dark' | 'light' | 'citron' | 'current' | 'adaptive';

interface FloodGuardLogoProps {
  variant?: LogoVariant;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  badge?: boolean;
}

export const FloodGuardLogo: React.FC<FloodGuardLogoProps> = ({
  variant = 'current',
  className = 'h-6 w-auto',
  showText = false,
  textClassName = 'font-display font-black text-lg tracking-wider',
  badge = false,
}) => {
  // Color determination
  let fillColor = 'currentColor';
  if (variant === 'dark') fillColor = '#181A1E';
  if (variant === 'light') fillColor = '#FFFFFF';
  if (variant === 'citron') fillColor = '#D4F826';

  const logoSvg = (
    <svg
      viewBox="0 0 532 385"
      fill={fillColor}
      className={`select-none transition-colors ${className}`}
      aria-label="FloodGuard Rescue Emblem"
    >
      <path
        d="M 488 132 L 462 98 L 421 78 L 417 49 L 407 39 L 396 36 L 379 41 L 371 53 L 375 70 L 398 82 L 396 87 L 273 133 L 170 138 L 169 133 L 194 122 L 197 107 L 183 94 L 161 93 L 147 106 L 145 130 L 119 144 L 101 160 L 69 210 L 39 298 L 38 341 L 45 348 L 51 345 L 84 280 L 104 259 L 121 249 L 146 241 L 159 241 L 165 246 L 157 269 L 131 302 L 134 310 L 162 295 L 192 266 L 205 240 L 200 220 L 179 209 L 141 208 L 135 204 L 140 191 L 165 174 L 348 131 L 379 129 L 396 138 L 398 154 L 388 168 L 309 201 L 273 235 L 269 247 L 279 251 L 361 214 L 368 216 L 246 328 L 243 337 L 251 341 L 405 240 L 436 203 L 456 147 L 470 168 L 473 197 L 469 215 L 477 217 L 488 202 L 495 174 L 495 155 Z"
      />
    </svg>
  );

  if (badge) {
    return (
      <div className="inline-flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-2xl bg-[#181A1E] text-white flex items-center justify-center p-2 shadow-xs border border-[#33363F]">
          {logoSvg}
        </div>
        {showText && (
          <span className={textClassName}>FLOODGUARD</span>
        )}
      </div>
    );
  }

  if (showText) {
    return (
      <div className="inline-flex items-center gap-2">
        {logoSvg}
        <span className={textClassName}>FLOODGUARD</span>
      </div>
    );
  }

  return logoSvg;
};

export default FloodGuardLogo;
