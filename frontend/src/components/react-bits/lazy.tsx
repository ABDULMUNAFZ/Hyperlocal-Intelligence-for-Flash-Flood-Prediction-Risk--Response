// Lazy wrappers for the heavy landing-page effects (three.js, GSAP, framer-motion).
// They keep those libraries out of the main bundle, so every page — including the 3D map at /app —
// loads without them, and the landing page paints its content before any effect is downloaded.
import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { DitherProps } from './Dither';
import type { ScrollRevealProps } from './ScrollReveal';
import type { TextCursorProps } from './TextCursor';

const DitherImpl = lazy(() => import('./Dither'));
const ScrollRevealImpl = lazy(() => import('./ScrollReveal'));
const TextCursorImpl = lazy(() => import('./TextCursor'));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

/** true once the browser is idle after first paint (or after `timeout` ms at the latest). */
function useIdle(timeout = 1500) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setIdle(true), 300);
    return () => window.clearTimeout(t);
  }, [timeout]);
  return idle;
}

/** WebGL dither background — loaded after first paint; static frame for reduced-motion users. */
export function LazyDither(props: DitherProps) {
  const idle = useIdle();
  if (!idle) return null;
  const reduced = prefersReducedMotion();
  return (
    <Suspense fallback={null}>
      <DitherImpl {...props} disableAnimation={props.disableAnimation || reduced} enableMouseInteraction={!!props.enableMouseInteraction && hasFinePointer() && !reduced} />
    </Suspense>
  );
}

/** Mouse text trail — only on devices with a mouse, never for reduced motion. */
export function LazyTextCursor(props: TextCursorProps) {
  const idle = useIdle(2500);
  if (!idle || !hasFinePointer() || prefersReducedMotion()) return null;
  return (
    <Suspense fallback={null}>
      <TextCursorImpl {...props} />
    </Suspense>
  );
}

/** Scroll-reveal text. Renders the same text immediately (identical markup), then upgrades to GSAP. */
export function LazyScrollReveal(props: ScrollRevealProps) {
  const plain = (
    <div className={`scroll-reveal ${props.containerClassName ?? ''}`}>
      <div className={`scroll-reveal-text ${props.textClassName ?? ''}`}>{props.children}</div>
    </div>
  );
  if (prefersReducedMotion()) return plain;
  return (
    <Suspense fallback={plain}>
      <ScrollRevealImpl {...props} />
    </Suspense>
  );
}
