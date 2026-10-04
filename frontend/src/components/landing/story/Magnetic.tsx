// Magnetic hover: the wrapped element leans towards the pointer and springs back on leave.
// Fine pointers with motion allowed only.
import React, { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from './gsap';

export const Magnetic: React.FC<{ strength?: number; className?: string; children: React.ReactNode }> = ({ strength = 0.28, className = '', children }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => { xTo(0); yTo(0); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); gsap.killTweensOf(el); };
  }, [strength]);
  return <span ref={ref} className={`inline-block will-change-transform ${className}`}>{children}</span>;
};

export default Magnetic;
