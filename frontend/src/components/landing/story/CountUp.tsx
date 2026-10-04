// Counts a number up when it enters the viewport. The final value is rendered on the server/first
// paint width-wise (tabular figures) so nothing shifts while counting.
import React, { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from './gsap';

interface Props { value: number; decimals?: number; prefix?: string; suffix?: string; duration?: number; className?: string }

const fmt = (v: number, d: number) => v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

export const CountUp: React.FC<Props> = ({ value, decimals = 0, prefix = '', suffix = '', duration = 1.6, className = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const obj = { v: 0 };
    let tween: gsap.core.Tween | null = null;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      el.textContent = prefix + fmt(0, decimals) + suffix;
      tween = gsap.to(obj, { v: value, duration, ease: 'power2.out', onUpdate: () => { el.textContent = prefix + fmt(obj.v, decimals) + suffix; } });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); tween?.kill(); el.textContent = prefix + fmt(value, decimals) + suffix; };
  }, [value, decimals, prefix, suffix, duration]);
  return <span ref={ref} className={`tabular-nums ${className}`}>{prefix + fmt(value, decimals) + suffix}</span>;
};

export default CountUp;
