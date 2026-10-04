import React, { lazy, useEffect, useLayoutEffect, useRef } from 'react';
import { LandingNav } from '../components/landing/LandingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { LazyTextCursor as TextCursor } from '../components/react-bits/lazy';
import { SmoothScrollProvider } from '../components/landing/story/SmoothScrollProvider';
import { StoryBackground } from '../components/landing/story/StoryBackground';
import { PrologueScene } from '../components/landing/story/PrologueScene';
import { MountainChapter, SignalsChapter } from '../components/landing/story/chapters';
import { LazyChapter } from '../components/landing/story/LazyChapter';
import { ScrollTrigger } from '../components/landing/story/gsap';
import { storyStore } from '../components/landing/story/storyStore';
import { useGlowCards } from '../components/landing/story/useGlowCards';

// Chapters 3–9 and the epilogue share one lazily loaded chunk.
const lazyChapter = (name: keyof typeof import('../components/landing/story/lazyChapters')) =>
  lazy(() => import('../components/landing/story/lazyChapters').then((m) => ({ default: m[name] })));
const WeatherChapter = lazyChapter('WeatherChapter');
const CamerasChapter = lazyChapter('CamerasChapter');
const HumanChapter = lazyChapter('HumanChapter');
const PlacesChapter = lazyChapter('PlacesChapter');
const SimulationChapter = lazyChapter('SimulationChapter');
const JourneyChapter = lazyChapter('JourneyChapter');
const CommandChapter = lazyChapter('CommandChapter');
const EpilogueChapter = lazyChapter('EpilogueChapter');

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  useGlowCards(root);

  useEffect(() => {
    document.title = 'FloodGuard — Hyperlocal Flash-Flood Intelligence';
  }, []);

  // Prefetch the 3D command center (map engine + page code) once the landing page is idle, so
  // "VIEW 3D MAP" opens instantly. Skipped on data-saver / slow connections.
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const prefetch = () => { import('./WayanadCommandCenter').catch(() => undefined); };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(prefetch, 3000);
    return () => window.clearTimeout(t);
  }, []);

  // The hero keeps the warm paper mood.
  useLayoutEffect(() => {
    const el = hero.current;
    if (!el) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) storyStore.set({ chapter: 'hero', mood: 'paper' }); },
    });
    return () => st.kill();
  }, []);

  return (
    <SmoothScrollProvider>
      <div
        ref={root}
        className="relative isolate min-h-screen overflow-x-clip text-[#23252A] selection:bg-[#D4F826] selection:text-[#181A1E] font-sans"
      >
        {/* One fixed background whose mood follows the story */}
        <StoryBackground />

        {/* React Bits TextCursor: "AI" follows the mouse trail smoothly */}
        <TextCursor
          text="AI"
          spacing={80}
          followMouseDirection={true}
          randomFloat={true}
          exitDuration={0.3}
          removalInterval={20}
          maxPoints={8}
        />

        {/* Fixed navigation with chapter progress */}
        <LandingNav />

        <main className="relative z-10">
          {/* Hero — unchanged layout (before/after comparison, Dither, ticker) */}
          <div ref={hero} data-mood="paper">
            <HeroSection />
          </div>

          <PrologueScene />
          <MountainChapter />
          <SignalsChapter />

          <LazyChapter minHeight="150vh"><WeatherChapter /></LazyChapter>
          <LazyChapter minHeight="140vh"><CamerasChapter /></LazyChapter>
          <LazyChapter minHeight="150vh"><HumanChapter /></LazyChapter>
          <LazyChapter minHeight="400vh"><PlacesChapter /></LazyChapter>
          <LazyChapter minHeight="150vh"><SimulationChapter /></LazyChapter>
          <LazyChapter minHeight="600vh"><JourneyChapter /></LazyChapter>
          <LazyChapter minHeight="120vh"><CommandChapter /></LazyChapter>
          <LazyChapter minHeight="160vh"><EpilogueChapter /></LazyChapter>
        </main>
      </div>
    </SmoothScrollProvider>
  );
}
