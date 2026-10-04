// Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger and Lenis share one frame loop.
// Disabled for reduced motion. Everything is torn down on unmount, so leaving the landing page
// (e.g. to /app/map) restores native scrolling and leaves no triggers behind.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger, prefersReducedMotion } from './gsap';
import { storyStore } from './storyStore';

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

/** Scroll to an element or y position, smoothly when Lenis is active. */
export function scrollToTarget(lenis: Lenis | null, target: string | number | HTMLElement, offset = -80) {
  if (lenis) {
    // Lazy chapters can still settle while gliding; re-measure at the end and correct small misses.
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : typeof target === 'number' ? null : target;
    lenis.scrollTo(target, {
      offset,
      duration: 1.4,
      onComplete: () => {
        if (!el) return;
        const miss = el.getBoundingClientRect().top + offset;
        if (Math.abs(miss) > 16) lenis.scrollTo(el, { offset, duration: 0.6 });
      },
    });
    return;
  }
  if (typeof target === 'number') window.scrollTo({ top: target });
  else {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset });
  }
}

let activeInstances = 0;
const stripLenisClasses = () => {
  const cl = document.documentElement.classList;
  Array.from(cl).forEach((c) => { if (c === 'lenis' || c.startsWith('lenis-')) cl.remove(c); });
};

export const SmoothScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const tickRef = useRef<((time: number) => void) | null>(null);

  useEffect(() => {
    // page progress for the nav bar (works with and without Lenis)
    const progressTrigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => storyStore.setProgress(self.progress),
    });

    if (prefersReducedMotion()) return () => { progressTrigger.kill(); storyStore.reset(); };

    activeInstances += 1;
    const instance = new Lenis({ duration: 1.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.2 });
    instance.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    tickRef.current = tick;
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    setLenis(instance);

    return () => {
      progressTrigger.kill();
      if (tickRef.current) gsap.ticker.remove(tickRef.current);
      gsap.ticker.lagSmoothing(500, 33);
      instance.destroy();
      // Lenis can re-apply its classes from a pending timer after destroy(); strip them now and once more
      // shortly after, unless a new landing instance has started meanwhile (e.g. browser Back).
      activeInstances -= 1;
      stripLenisClasses();
      window.setTimeout(() => { if (activeInstances === 0) stripLenisClasses(); }, 400);
      setLenis(null);
      storyStore.reset();
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
};

export default SmoothScrollProvider;
