import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import FloodComparisonViewer from './FloodComparisonViewer';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative min-h-[96vh] flex flex-col justify-center pt-24 pb-12 overflow-hidden bg-[#EBE8E0] text-[#181A1E]">
      {/* SVG Clip Path Definition for Asymmetric Stepped Scallop Frame (Exact Match to User Reference UI) */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id="heroOrganicFrameClip" clipPathUnits="objectBoundingBox">
            <path d="M 0.025 0.246 L 0.317 0.246 C 0.367 0.246, 0.383 0.031, 0.433 0.031 L 0.975 0.031 C 0.99 0.031, 1 0.049, 1 0.077 L 1 0.708 C 1 0.735, 0.99 0.754, 0.975 0.754 L 0.65 0.754 C 0.60 0.754, 0.583 0.969, 0.533 0.969 L 0.025 0.969 C 0.01 0.969, 0 0.951, 0 0.923 L 0 0.292 C 0 0.265, 0.01 0.246, 0.025 0.246 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Background Topographic Texture */}
      <div className="absolute inset-0 pointer-events-none light-contour-lines opacity-25 z-0" />

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* DESKTOP HERO ARCHITECTURE (>= 1024px) - EXACT REFERENCE MATCH */}
        <div className="hidden lg:block relative w-full h-[680px]">
          {/* 1. OUTSIDE TOP-LEFT NOTCH (Sitting in the upper-left cutout) */}
          <div className="absolute top-0 left-2 z-30 max-w-md select-none">
            <div className="font-mono text-sm tracking-widest text-[#45474E] uppercase flex items-center gap-1.5 font-medium">
              <span className="text-[#181A1E] font-bold">: //</span> BRINGING DATA TO REAL LIFE
            </div>
            <h1 className="font-display font-extrabold text-5xl lg:text-6xl tracking-tight text-[#181A1E] uppercase leading-[0.94] mt-2">
              AI-DRIVEN
            </h1>
            <div className="text-xs font-mono text-[#6A6D75] tracking-wider mt-1.5 uppercase flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9BBD00]"></span>
              FLASH-FLOOD RISK INTELLIGENCE · WAYANAD
            </div>
          </div>

          {/* 2. THE CENTER DARK CURVED FRAME */}
          <div
            className="absolute inset-0 z-10 bg-[#0B0D11] border border-[#262830] shadow-2xl overflow-hidden"
            style={{
              clipPath: 'url(#heroOrganicFrameClip)',
              WebkitClipPath: 'url(#heroOrganicFrameClip)',
            }}
          >
            {/* VISUAL SUBJECT: Interactive Hover-Based Before & After Flood Comparison */}
            {/* Direct uncompressed images hero1.png and hero2.png with zero obstruction */}
            <div className="absolute inset-0">
              <FloodComparisonViewer />
            </div>

            {/* INNER ELEMENT A: Top-Left Lower Shelf */}
            <div className="absolute top-[185px] left-8 z-20 flex items-start gap-3 text-white/90 select-none pointer-events-none">
              <div className="h-8 w-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center flex-none">
                <Sparkles className="h-4 w-4 text-[#D4F826]" />
              </div>
              <div className="text-[11px] font-mono leading-tight">
                <div className="text-white/70 tracking-wider">WE AIM TO PROVIDE</div>
                <div className="text-white font-semibold tracking-wider">TOOLS THAT ENHANCE</div>
                <div className="text-[#D4F826] font-bold tracking-widest mt-0.5">PREDICTIVITY</div>
              </div>
            </div>

            {/* INNER ELEMENT C: Top-Right Stat & Indicator */}
            <div className="absolute top-6 right-12 z-20 text-right text-white select-none pointer-events-none">
              <div className="font-display font-extrabold text-5xl tracking-tight text-white flex items-baseline justify-end gap-1">
                461
                <span className="text-[#D4F826] text-xl font-mono">+</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-1 text-[11px] font-mono text-white/90">
                <span className="h-2 w-2 rounded-full bg-[#D4F826] animate-pulse"></span>
                <span>Gauged Catchment Cells</span>
              </div>
            </div>

            {/* INNER ELEMENT D: Bottom-Left Action Circle & Telemetry Text */}
            <div className="absolute bottom-7 left-8 z-20 flex items-center gap-4 text-white select-none">
              <Link
                to="/app/map"
                className="h-12 w-12 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/25 flex items-center justify-center transition-all hover:scale-110 group cursor-pointer shadow-lg"
                title="Open Live Spatial Telemetry"
              >
                <ArrowUpRight className="h-5 w-5 text-white group-hover:text-[#D4F826] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
              <div className="text-[11px] font-mono leading-tight">
                <div className="text-white/70">Dynamic sensor telemetry</div>
                <div className="text-white font-semibold">Real-time rainfall &amp; slope saturation</div>
                <div className="text-[#D4F826] text-[10px] mt-0.5">Chooralmala incident zone · Active monitoring</div>
              </div>
            </div>

            {/* INNER ELEMENT E: Bottom-Right Shelf Capsule Tags (Above Cutout) */}
            <div className="absolute bottom-[170px] right-12 z-20 flex items-center gap-2 select-none pointer-events-none">
              <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[11px] font-mono text-white/90">
                Copernicus 30m DEM
              </div>
              <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[11px] font-mono text-white/90">
                Hydrological Engine
              </div>
              <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-mono text-[#D4F826] font-bold">
                v2.4
              </div>
            </div>
          </div>

          {/* 3. OUTSIDE BOTTOM-RIGHT NOTCH (Sitting cleanly in the lower-right cutout with zero frame collision) */}
          <div className="absolute bottom-4 right-8 z-30 text-right select-none flex flex-col items-end">
            <div className="font-display font-black text-2xl lg:text-[26px] tracking-tight text-[#181A1E] uppercase leading-tight">
              SEE THE FLOOD
            </div>
            <div className="font-display font-extrabold text-base lg:text-[18px] tracking-tight text-[#181A1E] uppercase leading-tight mt-0.5 flex items-center justify-end gap-1.5">
              <span>BEFORE IT REACHES THE TOWN</span>
              <span className="text-[#181A1E] text-base lg:text-lg animate-spin-slow">✹</span>
            </div>

            {/* SINGLE PROMINENT BUTTON (Compact, Sleek, Safe Distance From Frame) */}
            <div className="mt-2.5">
              <Link
                to="/app/map"
                className="group inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-[#181A1E] hover:bg-[#2A2D35] text-white font-display font-bold text-xs tracking-wider shadow-lg shadow-black/15 transition-all transform hover:-translate-y-0.5 border border-[#33363F]"
              >
                <span className="flex h-2 w-2 rounded-full bg-[#D4F826] shadow-[0_0_8px_#D4F826]"></span>
                <span>VIEW 3D MAP</span>
                <span className="text-[#A0A4B0] text-[10px] font-mono font-normal">| STEP IN</span>
                <ArrowRight className="h-4 w-4 text-[#D4F826] group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* MOBILE & TABLET HERO ARCHITECTURE (< 1024px) - CLEAN RESPONSIVE STACK */}
        <div className="block lg:hidden space-y-6">
          {/* Mobile Top Heading */}
          <div className="text-center sm:text-left space-y-2">
            <div className="font-mono text-xs tracking-widest text-[#45474E] uppercase flex items-center justify-center sm:justify-start gap-1.5 font-medium">
              <span className="text-[#181A1E] font-bold">: //</span> BRINGING DATA TO REAL LIFE
            </div>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-[#181A1E] uppercase leading-none">
              AI-DRIVEN
            </h1>
            <div className="text-xs font-mono text-[#6A6D75] tracking-wider uppercase">
              FLASH-FLOOD RISK INTELLIGENCE · WAYANAD
            </div>
          </div>

          {/* Mobile Center Comparison Frame */}
          <div className="relative w-full h-[460px] rounded-[2.5rem] bg-[#0B0D11] border border-[#262830] shadow-xl overflow-hidden">
            <FloodComparisonViewer />

            {/* Mobile Top Stats */}
            <div className="absolute top-4 right-4 z-20 pointer-events-none">
              <div className="text-right text-white">
                <div className="font-display font-extrabold text-2xl text-white">461+</div>
                <div className="text-[10px] font-mono text-[#D4F826]">Gauged Cells</div>
              </div>
            </div>

            {/* Mobile Bottom Telemetry & Tags */}
            <div className="absolute bottom-4 inset-x-4 z-20 space-y-2 pointer-events-none">
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-mono text-white/90">
                  Copernicus 30m DEM
                </div>
                <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-mono text-[#D4F826] font-bold">
                  v2.4 Live
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Bottom Heading & Single Prominent Button */}
          <div className="text-center sm:text-right space-y-3 pt-2">
            <div className="font-display font-black text-2xl sm:text-3xl tracking-tight text-[#181A1E] uppercase leading-tight">
              SEE THE FLOOD <br />
              <span className="flex items-center justify-center sm:justify-end gap-1.5">
                BEFORE IT REACHES THE TOWN <span className="text-[#181A1E] text-lg sm:text-xl">✹</span>
              </span>
            </div>

            <div>
              <Link
                to="/app/map"
                className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#181A1E] hover:bg-[#2A2D35] text-white font-display font-bold text-xs tracking-wider shadow-lg shadow-black/20 transition-all border border-[#33363F]"
              >
                <span className="flex h-2 w-2 rounded-full bg-[#D4F826] shadow-[0_0_8px_#D4F826]"></span>
                <span>VIEW 3D MAP</span>
                <span className="text-[#A0A4B0] text-[10px] font-mono font-normal">| STEP IN</span>
                <ArrowRight className="h-4 w-4 text-[#D4F826] group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* District Running Ticker Bar Below Hero */}
        <div className="relative z-20 w-full mt-10 py-3 bg-[#181A1E] text-[#FAF9F6] rounded-2xl border border-[#2A2D35] shadow-xs overflow-hidden">
          <div className="marquee-track">
            <div className="marquee-content font-mono text-xs sm:text-sm tracking-wider uppercase">
              <span className="text-[#D4F826]">◆ HYPERLOCAL FLASH-FLOOD INTELLIGENCE FOR WAYANAD</span>
              <span>· 461 GAUGED WATERSHEDS</span>
              <span>· 30M COPERNICUS DIGITAL ELEVATION MODEL</span>
              <span>· SATELLITE RADAR REFLECTIVITY</span>
              <span className="text-[#D4F826]">· EARLY RUNOFF LEAD TIME &lt; 45 MIN</span>
              <span>· AI DETECTS · HUMANS DECIDE</span>
              <span>· 100% CERTIFIED DISASTER MANAGER TRIAGE</span>
              <span>· CITIZEN GEOLOCATION SOS DISPATCH</span>
            </div>
            <div className="marquee-content font-mono text-xs sm:text-sm tracking-wider uppercase" aria-hidden="true">
              <span className="text-[#D4F826]">◆ HYPERLOCAL FLASH-FLOOD INTELLIGENCE FOR WAYANAD</span>
              <span>· 461 GAUGED WATERSHEDS</span>
              <span>· 30M COPERNICUS DIGITAL ELEVATION MODEL</span>
              <span>· SATELLITE RADAR REFLECTIVITY</span>
              <span className="text-[#D4F826]">· EARLY RUNOFF LEAD TIME &lt; 45 MIN</span>
              <span>· AI DETECTS · HUMANS DECIDE</span>
              <span>· 100% CERTIFIED DISASTER MANAGER TRIAGE</span>
              <span>· CITIZEN GEOLOCATION SOS DISPATCH</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
