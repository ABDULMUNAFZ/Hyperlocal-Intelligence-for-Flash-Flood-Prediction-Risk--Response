import React, { ReactNode } from 'react';

export interface ScrollRevealProps {
  children?: ReactNode;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  containerClassName?: string;
  textClassName?: string;
  rotationEnd?: string;
  wordAnimationEnd?: string;
}

declare const ScrollReveal: React.FC<ScrollRevealProps>;
export default ScrollReveal;
