// Prologue — "The night it rained". A pinned full-screen dark scene: the Chembra sentence reveals word
// by word as you scroll, the rain gets heavier, and the scene lands on "45 minutes." On mobile and
// for reduced motion it is a short static scene with a simple fade.
import React, { useLayoutEffect, useRef } from 'react';
import { gsap, MQ } from './gsap';
import { Chapter } from './Chapter';
import { RevealText } from './RevealText';
import { storyStore } from './storyStore';

const SENTENCE =
  'When torrential clouds burst over Chembra peak, water accelerates down steep escarpments into valleys within forty-five minutes. FloodGuard watches every contour before the water reaches the street.';

export const PrologueScene: React.FC = () => {
  const stage = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(MQ.desktop, () => {
        const words = el.querySelectorAll<HTMLElement>('[data-word]');
        gsap.set(words, { opacity: 0.12, filter: 'blur(6px)' });
        gsap.set('[data-final]', { opacity: 0, scale: 0.45 });
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: '+=240%',
            pin: true,
            scrub: 0.8,
            onUpdate: (self) => storyStore.setRainBoost(Math.min(0.6, self.progress * 0.8)),
            onLeave: () => storyStore.setRainBoost(0),
            onLeaveBack: () => storyStore.setRainBoost(0),
          },
        });
        tl.to('[data-eyebrow]', { opacity: 1, y: 0, duration: 0.3 })
          .to(words, { opacity: 1, filter: 'blur(0px)', stagger: 0.12, duration: 0.6 }, '<')
          .to('[data-sentence]', { opacity: 0, y: -60, filter: 'blur(8px)', duration: 1.2 }, '+=0.6')
          .to('[data-final]', { opacity: 1, scale: 1, duration: 1.6, ease: 'power2.out' }, '<0.3')
          .to('[data-final-sub]', { opacity: 1, y: 0, duration: 0.8 }, '-=0.6')
          .to({}, { duration: 0.6 });
      });
      mm.add(`${MQ.mobile}, ${MQ.reduce}`, () => {
        gsap.set('[data-eyebrow], [data-final-sub]', { opacity: 1, y: 0 });
      });
    }, el);
    return () => { ctx.revert(); storyStore.setRainBoost(0); };
  }, []);

  return (
    <Chapter id="prologue" index="PROLOGUE" name="THE NIGHT IT RAINED" mood="storm" showLabel={false} className="!py-0">
      <div ref={stage} className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 py-24 text-center">
        <div className="relative mx-auto max-w-5xl">
          <div data-eyebrow className="mb-8 inline-flex translate-y-3 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-white/80 opacity-0 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4F826]" />
            PROLOGUE <span className="text-[#D4F826]">/</span> THE NIGHT IT RAINED
          </div>
          <div data-sentence>
            <RevealText
              as="p"
              mode="scrub"
              text={SENTENCE}
              className="font-display text-3xl font-bold leading-[1.15] text-white sm:text-5xl lg:text-6xl"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex motion-reduce:!hidden">
            <div className="text-center">
              <div data-final className="font-display text-[clamp(5rem,15vw,13rem)] font-black leading-none tracking-tight text-white">
                45 <span className="text-[#D4F826]">minutes.</span>
              </div>
              <div data-final-sub className="mt-4 translate-y-4 font-mono text-xs uppercase tracking-[0.3em] text-white/70 opacity-0">
                from a cloudburst on the ridge to water in the valley
              </div>
            </div>
          </div>
          {/* small screens / reduced motion: the closing line sits under the sentence */}
          <div className="mt-12 lg:hidden motion-reduce:!block">
            <div className="font-display text-6xl font-black text-white sm:text-7xl">45 <span className="text-[#D4F826]">minutes.</span></div>
            <div data-final-sub className="mt-3 font-mono text-[11px] uppercase tracking-[0.25em] text-white/70">from a cloudburst on the ridge to water in the valley</div>
          </div>
        </div>
      </div>
    </Chapter>
  );
};

export default PrologueScene;
