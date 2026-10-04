import React from 'react';
import { ChapterHeader } from './story/ChapterHeader';

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

const ACCENTS: Partial<Record<HeadingAnimationVariant, string>> = {
  contour: 'ELEVATION CONTOURS · 2,100M MSL',
  radar: 'DOPPLER SWEEP · 10-MIN INTERVALS',
  crosshair: 'CV OPTICAL TELEMETRY · EDGE NODES',
  stamp: 'MANDATORY HUMAN AUDIT · 100% TRIAGE',
  depth: 'HYDROLOGICAL BASIN GAUGES · 461 CELLS',
};

/** Section heading — now the shared story ChapterHeader (eyebrow, split-word headline, accent line, body). */
export const ScrollHeading: React.FC<ScrollHeadingProps> = ({
  category,
  badge,
  title,
  italicWord,
  subtitle,
  className = '',
  animationVariant = 'default',
  theme = 'light',
}) => (
  <ChapterHeader
    eyebrow={category || badge}
    accent={ACCENTS[animationVariant]}
    title={title}
    italic={italicWord}
    body={subtitle}
    theme={theme}
    className={className}
  />
);

export default ScrollHeading;
