// A story chapter: mono chapter label + progress bar, mood switching for the global background,
// and the soft fade between chapters (incoming blocks fade/rise/unblur, outgoing chapter dims).
// Only opacity is animated on the chapter root, so pinned children (position: fixed) keep working.
import React, { useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger, MQ } from './gsap';
import { storyStore, DARK_MOODS, type Mood } from './storyStore';
import { ScrollProgress } from './ScrollProgress';

interface ChapterProps {
  id: string;
  /** "01".."09", "PROLOGUE", "EPILOGUE" */
  index: string;
  name: string;
  mood: Mood;
  /** sheet = light paper panel floating over the background; open = content sits on the background */
  variant?: 'sheet' | 'open';
  className?: string;
  /** show the chapter label row (prologue renders its own) */
  showLabel?: boolean;
  children: React.ReactNode;
}

export const Chapter: React.FC<ChapterProps> = ({ id, index, name, mood, variant = 'open', className = '', showLabel = true, children }) => {
  const root = useRef<HTMLElement>(null);
  const dark = DARK_MOODS.includes(mood);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        end: 'bottom 45%',
        onToggle: (self) => { if (self.isActive) storyStore.set({ chapter: id, mood }); },
      });

      const mm = gsap.matchMedia();
      mm.add(MQ.desktop, () => {
        el.querySelectorAll<HTMLElement>('[data-reveal]').forEach((b) => {
          gsap.fromTo(b, { opacity: 0, y: 48, filter: 'blur(10px)' }, {
            opacity: 1, y: 0, filter: 'blur(0px)', ease: 'none',
            scrollTrigger: { trigger: b, start: 'top 92%', end: 'top 62%', scrub: 0.6 },
          });
        });
        gsap.fromTo(el, { opacity: 1 }, {
          opacity: 0.2, ease: 'none',
          scrollTrigger: { trigger: el, start: 'bottom 40%', end: 'bottom top', scrub: true },
        });
      });
      mm.add(MQ.mobile, () => {
        el.querySelectorAll<HTMLElement>('[data-reveal]').forEach((b) => {
          gsap.from(b, { opacity: 0, y: 24, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: b, start: 'top 90%', once: true } });
        });
      });
    }, el);
    return () => ctx.revert();
  }, [id, mood]);

  return (
    <section ref={root} id={id} data-chapter={id} data-mood={mood} className={`story-chapter relative z-10 py-6 sm:py-10 ${className}`}>
      {showLabel && (
        <div className="mx-auto mb-4 sm:mb-6 flex max-w-7xl items-center gap-3 px-6 sm:px-8 2xl:max-w-[1680px]">
          <span className={`font-mono text-[11px] font-bold tracking-[0.22em] uppercase ${dark ? 'text-white/80' : 'text-[#23252A]'}`}>
            {/^\d/.test(index) ? `CHAPTER ${index}` : index}
            <span className={dark ? 'text-[#D4F826]' : 'text-[#9BBD00]'}> / </span>
            {name}
          </span>
          <ScrollProgress trigger={root} className={`h-[2px] flex-1 rounded-full ${dark ? 'bg-white/10' : 'bg-black/10'}`} barClassName={dark ? 'bg-[#D4F826]' : 'bg-[#181A1E]'} />
        </div>
      )}
      {variant === 'sheet' ? (
        <div className="story-sheet mx-2 sm:mx-4 lg:mx-6 rounded-[2.5rem] overflow-clip ring-1 ring-black/5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.55)]">
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
};

export default Chapter;
