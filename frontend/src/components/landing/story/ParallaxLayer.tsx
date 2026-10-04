// Moves its content vertically at a different speed than the page (desktop, motion allowed only).
import React, { useLayoutEffect, useRef } from 'react';
import { gsap, MQ } from './gsap';

interface Props { speed?: number; className?: string; children: React.ReactNode }

export const ParallaxLayer: React.FC<Props> = ({ speed = 0.2, className = '', children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.matchMedia().add(MQ.desktop, () => {
        gsap.fromTo(el, { yPercent: -speed * 50 }, {
          yPercent: speed * 50, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
    }, el);
    return () => ctx.revert();
  }, [speed]);
  return <div ref={ref} className={`will-change-transform ${className}`}>{children}</div>;
};

export default ParallaxLayer;
