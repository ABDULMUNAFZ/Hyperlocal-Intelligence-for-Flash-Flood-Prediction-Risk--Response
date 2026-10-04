// One delegated pointer listener that feeds --mx/--my to the hovered .glow-card (cursor-aware glow).
import { useEffect } from 'react';

export function useGlowCards(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let raf = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      const card = (e.target as HTMLElement | null)?.closest?.('.glow-card') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const move = (e: PointerEvent) => { last = e; if (!raf) raf = requestAnimationFrame(apply); };
    el.addEventListener('pointermove', move, { passive: true });
    return () => { el.removeEventListener('pointermove', move); if (raf) cancelAnimationFrame(raf); };
  }, [root]);
}
