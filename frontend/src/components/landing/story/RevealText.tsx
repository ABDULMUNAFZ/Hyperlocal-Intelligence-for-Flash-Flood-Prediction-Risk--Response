// Splits text into words. mode="mask": each word slides up out of a clipping mask when the text
// enters the viewport. mode="scrub": words stay as plain spans ([data-word]) so a parent scene can
// drive them with its own pinned timeline.
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { gsap, MQ } from './gsap';

interface Props {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div' | 'span';
  className?: string;
  mode?: 'mask' | 'scrub';
  /** class for each word span (scrub mode) */
  wordClassName?: string;
}

export const RevealText: React.FC<Props> = ({ text, as = 'div', className = '', mode = 'mask', wordClassName = '' }) => {
  const ref = useRef<HTMLElement>(null);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || mode !== 'mask') return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(MQ.desktop, () => {
        gsap.from(el.querySelectorAll('[data-word-inner]'), {
          yPercent: 110, rotate: 4, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.045,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      });
      mm.add(MQ.mobile, () => {
        gsap.from(el.querySelectorAll('[data-word-inner]'), {
          yPercent: 60, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.03,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      });
    }, el);
    return () => ctx.revert();
  }, [mode, text]);

  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((w, i) =>
        mode === 'mask' ? (
          <span key={i} aria-hidden="true" className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
            <span data-word-inner className="inline-block will-change-transform">{w}</span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ) : (
          <span key={i} aria-hidden="true" data-word className={`inline-block ${wordClassName}`}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ),
      )}
    </Tag>
  );
};

export default RevealText;
