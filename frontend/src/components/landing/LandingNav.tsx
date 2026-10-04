import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  Shield,
  Menu,
  X,
  Mountain,
  Layers,
  Radio,
  Eye,
  Sliders,
  LifeBuoy,
  Github,
} from 'lucide-react';
import FloodGuardLogo from '../common/FloodGuardLogo';
import { useStory, DARK_MOODS } from './story/storyStore';
import { ScrollProgress } from './story/ScrollProgress';
import { MOUNT_ALL_EVENT } from './story/LazyChapter';
import { useLenis, scrollToTarget } from './story/SmoothScrollProvider';
import { ScrollTrigger } from './story/gsap';

export const LandingNav: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { chapter, mood } = useStory();
  const lenis = useLenis();
  const dark = DARK_MOODS.includes(mood) && scrolled;

  /** In-page chapter links: mount every lazy chapter first so positions are final, then glide there. */
  const goToChapter = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    setMobileMenuOpen(false);
    window.dispatchEvent(new Event(MOUNT_ALL_EVENT));
    let tries = 0;
    const go = () => {
      const target = document.querySelector(href);
      if (!target && tries++ < 30) { window.setTimeout(go, 100); return; }
      ScrollTrigger.refresh();
      requestAnimationFrame(() => scrollToTarget(lenis, href, -84));
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 25);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Mountain Hydrology', href: '#mountain', icon: Mountain },
    { label: 'Signals Engine', href: '#signals', icon: Layers },
    { label: 'Radar Sweep', href: '#weather', icon: Radio },
    { label: 'AI Cameras', href: '#cameras', icon: Eye },
    { label: 'Verification', href: '#human', icon: Shield },
    { label: 'Roadmap', href: '/production', icon: Sliders },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,padding] duration-500 ${
        dark
          ? 'bg-[#0B0D11]/70 backdrop-blur-xl border-b border-white/10 shadow-xs py-2'
          : scrolled
          ? 'bg-[#EBE8E0]/95 backdrop-blur-xl border-b border-[#DDD9CE] shadow-xs py-2'
          : 'bg-[#EBE8E0]/85 backdrop-blur-md border-b border-[#DDD9CE]/60 py-3'
      }`}
    >
      {/* Expansive Full-Width Header Container Across All Devices */}
      <div className="w-full max-w-[98%] 2xl:max-w-[1720px] mx-auto px-2 sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-4">
          {/* Brand Mark with Official Rescue Emblem (Two Figures Solidarity) */}
          <Link to="/" className="flex items-center gap-3 group shrink-0" title="FloodGuard — Hyperlocal Flash-Flood Intelligence">
            <div className="relative flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-[#181A1E] text-white p-2 shadow-md group-hover:scale-105 transition-transform border border-[#2B2E37]">
              <FloodGuardLogo className="h-6 sm:h-7 w-auto" variant="citron" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4F826] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D4F826]"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`font-display font-extrabold text-lg sm:text-xl tracking-tight transition-colors duration-500 ${dark ? 'text-white' : 'text-[#181A1E]'}`}>
                  FloodGuard
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#181A1E] text-[#D4F826] text-[9.5px] font-mono font-bold tracking-widest uppercase">
                  WAYANAD
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#6A6D75] tracking-wider hidden md:block">
                HYPERLOCAL FLASH-FLOOD INTELLIGENCE
              </span>
            </div>
          </Link>

          {/* Desktop Capsule Nav (Clinical Category Navigation Pills) */}
          <nav className={`hidden lg:flex items-center gap-1.5 xl:gap-2 px-3.5 py-1.5 rounded-full border shadow-2xs transition-colors duration-500 ${dark ? 'bg-white/10 border-white/15' : 'bg-white/90 border-[#DDD9CE]'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === `#${chapter}`;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => goToChapter(e, item.href)}
                  aria-current={active ? 'true' : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium transition-all ${
                    active
                      ? dark ? 'bg-[#D4F826] text-[#181A1E]' : 'bg-[#181A1E] text-[#D4F826]'
                      : dark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-[#45474E] hover:text-[#181A1E] hover:bg-[#F3F1EA]'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? '' : dark ? 'text-white/60' : 'text-[#656872]'}`} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Action Pills: Star on GitHub, Citizen SOS, View 3D Map (Spacious, Wide, Distinct Hierarchy) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* 1. GitHub Star Pill Button */}
            <a
              href="https://github.com/ABDULMUNAFZ/Hyperlocal-Intelligence-for-Flash-Flood-Prediction-Risk--Response"
              target="_blank"
              rel="noopener noreferrer"
              className={`hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-mono font-medium shadow-xs transition-all hover:scale-[1.03] ${dark ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white' : 'bg-white hover:bg-[#F3F1EA] border-[#DDD9CE] text-[#181A1E]'}`}
              title="Star this repository on GitHub"
            >
              <Github className={`h-4 w-4 ${dark ? 'text-white' : 'text-[#181A1E]'}`} />
              <span className="hidden md:inline font-sans font-semibold">Star repo</span>
              <span className="px-2 py-0.5 rounded-full bg-[#181A1E] text-[#D4F826] text-[10.5px] font-bold">★ GitHub</span>
            </a>

            {/* 2. CITIZEN SOS Button */}
            <Link
              to="/emergency"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold tracking-wider shadow-xs transition-all hover:scale-[1.03]"
              title="Citizen Emergency Response & Location Pin PWA"
            >
              <LifeBuoy className="h-4 w-4 text-rose-600 animate-pulse" />
              <span>CITIZEN SOS</span>
            </Link>

            {/* 3. VIEW 3D MAP Button */}
            <Link
              to="/app/map"
              className="inline-flex items-center gap-2.5 px-5 sm:px-6 py-2.5 rounded-full bg-[#181A1E] hover:bg-[#2A2D35] text-white text-xs font-bold tracking-wider shadow-md shadow-black/15 transition-all border border-[#33363F] hover:scale-[1.03]"
            >
              <span className="flex h-2 w-2 rounded-full bg-[#D4F826] shadow-[0_0_8px_#D4F826]"></span>
              <span>VIEW 3D MAP</span>
              <span className="text-white/60 text-[10px] font-mono hidden md:inline">| STEP IN</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#D4F826]" />
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-full bg-white border border-[#DDD9CE] text-[#23252A] hover:bg-[#F4F2EB]"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Page progress through the story */}
      <ScrollProgress className="absolute inset-x-0 bottom-0 h-[2px]" barClassName={dark ? 'bg-[#D4F826]' : 'bg-[#181A1E]'} />

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 mx-4 p-4 rounded-3xl bg-white border border-[#DDD9CE] shadow-xl space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => (item.href.startsWith('#') ? goToChapter(e, item.href) : setMobileMenuOpen(false))}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-medium text-[#23252A] hover:bg-[#F4F2EB]"
              >
                <Icon className="h-4 w-4 text-[#656872]" />
                <span>{item.label}</span>
              </a>
            );
          })}
          <div className="pt-2 border-t border-[#EAE7DF] flex flex-col gap-2">
            <a
              href="https://github.com/ABDULMUNAFZ/Hyperlocal-Intelligence-for-Flash-Flood-Prediction-Risk--Response"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-full bg-[#F4F2EB] text-[#181A1E] text-center text-xs font-mono font-semibold flex items-center justify-center gap-2 border border-[#DDD9CE]"
            >
              <Github className="h-4 w-4" />
              <span>Star repo on GitHub ★</span>
            </a>
            <Link
              to="/app/map"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 rounded-full bg-[#181A1E] text-white text-center text-sm font-bold flex items-center justify-center gap-2"
            >
              <Compass className="h-4 w-4 text-[#D4F826]" />
              <span>View 3D Live Map</span>
            </Link>
            <Link
              to="/emergency"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-center text-xs font-bold"
            >
              Open Citizen Emergency SOS PWA
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingNav;
