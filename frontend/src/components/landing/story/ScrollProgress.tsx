// Thin progress bar bound to an element's scroll range (or the whole page when no trigger is given).
import React, { useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from './gsap';
import { storyStore } from './storyStore';

interface Props {
  trigger?: React.RefObject<HTMLElement>;
  className?: string;
  barClassName?: string;
}

export const ScrollProgress: React.FC<Props> = ({ trigger, className = '', barClassName = 'bg-[#D4F826]' }) => {
  const bar = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const b = bar.current;
    if (!b) return;
    if (!trigger) return storyStore.onProgress((p) => { b.style.transform = `scaleX(${p})`; });
    const t = trigger.current;
    if (!t) return;
    const st = ScrollTrigger.create({
      trigger: t, start: 'top 80%', end: 'bottom 20%',
      onUpdate: (self) => gsap.set(b, { scaleX: self.progress }),
    });
    return () => st.kill();
  }, [trigger]);

  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <div ref={bar} className={`h-full w-full origin-left ${barClassName}`} style={{ transform: 'scaleX(0)' }} />
    </div>
  );
};

export default ScrollProgress;
