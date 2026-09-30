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

export const LandingNav: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'bg-[#EBE8E0]/95 backdrop-blur-xl border-b border-[#DDD9CE] shadow-xs py-2'
          : 'bg-[#EBE8E0]/85 backdrop-blur-md border-b border-[#DDD9CE]/60 py-3'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          {/* Brand Mark with Official Rescue Emblem (Two Figures Solidarity) */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0" title="FloodGuard — Hyperlocal Flash-Flood Intelligence">
            <div className="relative flex items-center justify-center h-10 w-10 rounded-2xl bg-[#181A1E] text-white p-2 shadow-md group-hover:scale-105 transition-transform border border-[#2B2E37]">
              <FloodGuardLogo className="h-6 w-auto" variant="citron" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4F826] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D4F826]"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-extrabold text-lg tracking-tight text-[#181A1E]">
                  FloodGuard
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#181A1E] text-[#D4F826] text-[9px] font-mono font-bold tracking-widest uppercase">
                  WAYANAD
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#6A6D75] tracking-wider hidden sm:block">
                HYPERLOCAL FLASH-FLOOD INTELLIGENCE
              </span>
            </div>
          </Link>

          {/* Desktop Capsule Nav (Clinical Pills) */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-white/90 px-2 py-1.5 rounded-full border border-[#DDD9CE] shadow-2xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium text-[#45474E] hover:text-[#181A1E] hover:bg-[#F3F1EA] transition-all"
                >
                  <Icon className="h-3.5 w-3.5 text-[#656872]" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Action Pills & GitHub Star */}
          <div className="flex items-center gap-2">
            {/* GitHub Star Pill Button */}
            <a
              href="https://github.com/ABDULMUNAFZ/Hyperlocal-Intelligence-for-Flash-Flood-Prediction-Risk--Response"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white hover:bg-[#F3F1EA] border border-[#DDD9CE] text-[#181A1E] text-xs font-mono font-medium shadow-2xs transition-all hover:scale-105"
              title="Star this repository on GitHub"
            >
              <Github className="h-3.5 w-3.5 text-[#181A1E]" />
              <span className="hidden md:inline font-sans">Star repo</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#181A1E] text-[#D4F826] text-[10px] font-bold">★ Star</span>
            </a>

            <Link
              to="/emergency"
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold shadow-2xs transition-all"
              title="Citizen Emergency Response & Location Pin PWA"
            >
              <LifeBuoy className="h-3.5 w-3.5 text-rose-600 animate-pulse" />
              <span>CITIZEN SOS</span>
            </Link>

            <Link
              to="/app/map"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-[#181A1E] hover:bg-[#2A2D35] text-white text-xs font-bold shadow-md shadow-black/10 transition-all border border-[#33363F]"
            >
              <span className="flex h-2 w-2 rounded-full bg-[#D4F826]"></span>
              <span>VIEW 3D MAP</span>
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

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 mx-4 p-4 rounded-3xl bg-white border border-[#DDD9CE] shadow-xl space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
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
