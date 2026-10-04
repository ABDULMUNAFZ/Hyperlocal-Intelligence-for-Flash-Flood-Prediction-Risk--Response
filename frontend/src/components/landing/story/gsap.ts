// One place to register GSAP plugins for the landing story (registering twice is harmless, but keep it tidy).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

export { gsap, ScrollTrigger, MotionPathPlugin };

/** Media-query conditions shared by every chapter (used with gsap.matchMedia). */
export const MQ = {
  desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 1023px) and (prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
} as const;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Re-measure all triggers once layout settles (lazy chapters, images, fonts). Debounced per frame. */
let refreshQueued = 0;
export function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = requestAnimationFrame(() => {
    refreshQueued = 0;
    ScrollTrigger.refresh();
  });
}

/** True when an element can be pinned without being taller than the viewport (minus the nav). */
export function fitsViewport(el: HTMLElement, margin = 110) {
  return el.offsetHeight <= window.innerHeight - margin;
}
