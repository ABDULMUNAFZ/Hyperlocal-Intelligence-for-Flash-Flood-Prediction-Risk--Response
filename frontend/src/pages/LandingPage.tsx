import React, { useEffect } from 'react';
import { LandingNav } from '../components/landing/LandingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { MountainSection } from '../components/landing/MountainSection';
import { SignalsConvergenceSection } from '../components/landing/SignalsConvergenceSection';
import { WeatherSatelliteSection } from '../components/landing/WeatherSatelliteSection';
import { CameraNetworkSection } from '../components/landing/CameraNetworkSection';
import { HumanInTheLoopSection } from '../components/landing/HumanInTheLoopSection';
import { PlaceIntelligenceSection } from '../components/landing/PlaceIntelligenceSection';
import { SimulationSection } from '../components/landing/SimulationSection';
import { MobileJourneySection } from '../components/landing/MobileJourneySection';
import { AdminCommandPreview } from '../components/landing/AdminCommandPreview';
import { LandingFooter } from '../components/landing/LandingFooter';
import TextCursor from '../components/react-bits/TextCursor';
import ScrollReveal from '../components/react-bits/ScrollReveal';

export default function LandingPage() {
  useEffect(() => {
    document.title = 'FloodGuard — Hyperlocal Flash-Flood Intelligence';
  }, []);

  return (
    <div className="min-h-screen bg-[#EBE8E0] text-[#23252A] selection:bg-[#D4F826] selection:text-[#181A1E] overflow-x-hidden font-sans relative">
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

      {/* Fixed Sticky Header Navigation */}
      <LandingNav />

      {/* 1. Hero Section (Headline, Single Prominent Center Button, Dither Waves + Mountain Relief) */}
      <HeroSection />

      {/* Signature Environmental Intelligence Scroll Reveal Manifesto */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl mx-auto text-center border-y border-[#DDD9CE] bg-white/80 backdrop-blur-sm rounded-3xl my-8 shadow-xs">
        <div className="inline-block px-3 py-1 rounded-full bg-[#181A1E] text-[#D4F826] text-xs font-mono font-bold tracking-widest uppercase mb-4">
          ENVIRONMENTAL INTELLIGENCE PRINCIPLE
        </div>

        <ScrollReveal
          baseOpacity={0.15}
          enableBlur={true}
          baseRotation={2}
          blurStrength={6}
          containerClassName="max-w-4xl mx-auto"
          textClassName="text-2xl sm:text-4xl lg:text-5xl font-display font-bold text-[#141518] leading-tight"
        >
          When torrential clouds burst over Chembra peak, water accelerates down steep escarpments into valleys within forty-five minutes. FloodGuard watches every contour before the water reaches the street.
        </ScrollReveal>
      </section>

      {/* 2. The Mountain Section (Topographic Hydrology, Mountain Cross-section, Slope Physics Calculator) */}
      <MountainSection />

      {/* 3. One Flood, Many Signals (Multi-source data convergence into ML Risk Engine) */}
      <SignalsConvergenceSection />

      {/* 4. Live Weather + Satellite (Real Open-Meteo API, Radar Reflectivity Timeline) */}
      <WeatherSatelliteSection />

      {/* 5. AI Camera Network (Planned Production Sensor Layer, Strategic Nodes, Edge CV Analytics) */}
      <CameraNetworkSection />

      {/* 6. Critical Human-in-the-Loop Concept (AI Detects, Humans Decide — Officer Verification Simulator) */}
      <HumanInTheLoopSection />

      {/* 7. Place-wise Flood Intelligence (Micro-zone profiles: Chooralmala, Mundakkai, Meppadi, Kalpetta, Vythiri, etc.) */}
      <PlaceIntelligenceSection />

      {/* 8. What-If Flood Simulation & Human Story (Rainfall Scenarios: 50mm, 100mm, 150mm, 200mm / 6h) */}
      <SimulationSection />

      {/* 9. Mobile Citizen Emergency Mockup (10-Step Lifesaving Loop from warning to safe shelter arrival) */}
      <MobileJourneySection />

      {/* 10. Operational Command Center Preview (Multi-pane disaster management cockpit) */}
      <AdminCommandPreview />

      {/* 11. Final CTA & Comprehensive Environmental Intelligence Footer */}
      <LandingFooter />
    </div>
  );
}
