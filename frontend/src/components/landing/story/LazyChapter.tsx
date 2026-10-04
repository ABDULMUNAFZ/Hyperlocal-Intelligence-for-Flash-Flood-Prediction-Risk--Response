// Mounts a heavy chapter only when it comes near the viewport (or when the nav asks for everything,
// e.g. before jumping to a far chapter), keeping the first load light. Re-measures ScrollTriggers
// after mounting so pins below stay in the right place.
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { queueRefresh } from './gsap';

export const MOUNT_ALL_EVENT = 'story:mount-all';

interface Props { minHeight?: string; children: React.ReactNode }

export const LazyChapter: React.FC<Props> = ({ minHeight = '120vh', children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) { queueRefresh(); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setShow(true); }, { rootMargin: '1600px 0px' });
    io.observe(el);
    const all = () => setShow(true);
    window.addEventListener(MOUNT_ALL_EVENT, all);
    return () => { io.disconnect(); window.removeEventListener(MOUNT_ALL_EVENT, all); };
  }, [show]);

  const placeholder = <div style={{ minHeight }} aria-hidden="true" />;
  return (
    <div ref={ref}>
      {show ? <Suspense fallback={placeholder}><Mounted>{children}</Mounted></Suspense> : placeholder}
    </div>
  );
};

/** Refreshes triggers once the lazy chunk has actually rendered. */
const Mounted: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => { queueRefresh(); const t = window.setTimeout(queueRefresh, 600); return () => window.clearTimeout(t); }, []);
  return <>{children}</>;
};

export default LazyChapter;
