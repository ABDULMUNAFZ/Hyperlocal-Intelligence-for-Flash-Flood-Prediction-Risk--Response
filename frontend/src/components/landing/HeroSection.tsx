import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import Dither from '../react-bits/Dither';
import FloodComparisonViewer from './FloodComparisonViewer';

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[96vh] flex flex-col justify-center pt-24 pb-12 overflow-hidden bg-[#EBE8E0] text-[#181A1E]">
      {/* React Bits Dither Wave Background Animation for Homepage First Page */}
      <div className="absolute inset-0 pointer-events-none opacity-35 z-0 overflow-hidden">
        <Dither
          waveColor={[0.5, 0.5, 0.5]}
          backgroundColor={[0.92, 0.91, 0.88]}
          disableAnimation={false}
          enableMouseInteraction={true}
          mouseRadius={0.3}
          colorNum={4}
          waveAmplitude={0.3}
          waveFrequency={3}
          waveSpeed={0.05}
        />
      </div>

      {/* SVG Clip Path Definition for Asymmetric Stepped Scallop Frame (Exact Match to User Reference UI) */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id="heroOrganicFrameClip" clipPathUnits="objectBoundingBox">
            <path d="M 0.025 0.246 L 0.317 0.246 C 0.367 0.246, 0.383 0.031, 0.433 0.031 L 0.975 0.031 C 0.99 0.031, 1 0.049, 1 0.077 L 1 0.708 C 1 0.735, 0.99 0.754, 0.975 0.754 L 0.65 0.754 C 0.60 0.754, 0.583 0.969, 0.533 0.969 L 0.025 0.969 C 0.01 0.969, 0 0.951, 0 0.923 L 0 0.292 C 0 0.265, 0.01 0.246, 0.025 0.246 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Background Topographic Texture */}
      <div className="absolute inset-0 pointer-events-none light-contour-lines opacity-20 z-0" />

      {/* Main Container - Exact Default Proportions for Homepage */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* DESKTOP HERO ARCHITECTURE (>= 1024px) - EXACT DEFAULT REFERENCE MATCH */}
        <div className="hidden lg:block relative w-full h-[690px]">
          {/* 1. OUTSIDE TOP-LEFT NOTCH (Sitting in the upper-left cutout) */}
          <div className="absolute top-0 left-2 z-30 max-w-lg select-none">
            <div className="font-mono text-sm tracking-widest text-[#45474E] uppercase flex items-center gap-1.5 font-medium">
              <span className="text-[#181A1E] font-bold">: //</span> BRINGING DATA TO REAL LIFE
            </div>
            <h1 className="font-display font-extrabold text-5xl lg:text-6xl 2xl:text-7xl tracking-tight text-[#181A1E] uppercase leading-[0.94] mt-1.5">
              AI-DRIVEN
            </h1>
            <div className="text-xs font-mono text-[#6A6D75] tracking-wider mt-1.5 uppercase flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9BBD00]"></span>
              FLASH-FLOOD RISK INTELLIGENCE · WAYANAD
            </div>
          </div>

          {/* 2. THE CENTER DARK CURVED FRAME - Click to open 3D Map */}
          <div
            onClick={() => navigate('/app/map')}
            className="absolute inset-0 z-10 bg-[#0B0D11] border border-[#262830] shadow-2xl overflow-hidden cursor-pointer"
            title="Click image to enter 3D Map"
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

          {/* 3. OUTSIDE BOTTOM-RIGHT NOTCH: BUTTON MOVED UP (BIGGER & LENGTHIER), HEADING BROUGHT DOWN */}
          <div className="absolute bottom-3 right-6 lg:right-8 z-30 text-right select-none flex flex-col items-end gap-2.5">
            {/* BIGGER & LENGTHIER BUTTON MOVED UP */}
            <div>
              <Link
                to="/app/map"
                className="group inline-flex items-center justify-center gap-3.5 px-9 lg:px-12 py-3.5 lg:py-4 rounded-full bg-[#181A1E] hover:bg-[#282B34] text-white font-display font-black text-sm lg:text-base tracking-widest shadow-2xl shadow-black/25 transition-all transform hover:-translate-y-0.5 border border-[#33363F] hover:border-[#D4F826]/50 min-w-[280px] lg:min-w-[340px]"
              >
                <span className="flex h-2.5 w-2.5 rounded-full bg-[#D4F826] shadow-[0_0_10px_#D4F826] animate-pulse"></span>
                <span className="tracking-widest uppercase">VIEW 3D MAP</span>
                <span className="text-[#A0A4B0] text-xs font-mono font-normal">| STEP IN</span>
                <ArrowRight className="h-4.5 w-4.5 text-[#D4F826] group-hover:translate-x-1.5 transition-transform" />
              </Link>
            </div>

            {/* HEADING BROUGHT DOWN BELOW BUTTON */}
            <div className="text-right">
              <div className="font-display font-black text-xl lg:text-[22px] tracking-tight text-[#181A1E] uppercase leading-tight">
                SEE THE FLOOD
              </div>
              <div className="font-display font-extrabold text-sm lg:text-[16px] tracking-tight text-[#45474E] uppercase leading-tight mt-0.5 flex items-center justify-end gap-1.5">
                <span>BEFORE IT REACHES TO TOWN</span>
                <span className="text-[#181A1E] text-sm lg:text-base animate-spin-slow">✹</span>
              </div>
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

          {/* Mobile Center Comparison Frame - Click to open 3D Map */}
          <div
            onClick={() => navigate('/app/map')}
            className="relative w-full h-[460px] rounded-[2.5rem] bg-[#0B0D11] border border-[#262830] shadow-xl overflow-hidden cursor-pointer"
            title="Click image to enter 3D Map"
          >
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

          {/* Mobile Bottom: Button Moved Up (Bigger & Lengthier), Heading Brought Down */}
          <div className="text-center sm:text-right space-y-3 pt-2">
            {/* BIGGER & LENGTHIER BUTTON (MOVED UP) */}
            <div>
              <Link
                to="/app/map"
                className="group inline-flex items-center justify-center gap-3.5 w-full sm:w-auto px-10 py-4 rounded-full bg-[#181A1E] hover:bg-[#2A2D35] text-white font-display font-black text-sm tracking-widest shadow-xl shadow-black/20 transition-all border border-[#33363F] min-w-[280px]"
              >
                <span className="flex h-2.5 w-2.5 rounded-full bg-[#D4F826] shadow-[0_0_8px_#D4F826] animate-pulse"></span>
                <span>VIEW 3D MAP</span>
                <span className="text-[#A0A4B0] text-xs font-mono font-normal">| STEP IN</span>
                <ArrowRight className="h-4.5 w-4.5 text-[#D4F826] group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* HEADING (BROUGHT DOWN BELOW BUTTON) */}
            <div className="font-display font-black text-2xl sm:text-3xl tracking-tight text-[#181A1E] uppercase leading-tight pt-1">
              SEE THE FLOOD <br />
              <span className="flex items-center justify-center sm:justify-end gap-1.5">
                BEFORE IT REACHES TO TOWN <span className="text-[#181A1E] text-lg sm:text-xl">✹</span>
              </span>
            </div>
          </div>
        </div>

        {/* District Running Ticker Bar Below Hero */}
        <div className="relative z-20 w-full mt-10 py-3.5 bg-[#181A1E] text-[#FAF9F6] rounded-2xl border border-[#2A2D35] shadow-xs overflow-hidden">
          <div className="marquee-track">
            <div className="marquee-content font-mono text-xs sm:text-sm tracking-wider uppercase">
              <span className="text-[#D4F826]">◆ HYPERLOCAL FLASH-FLOOD INTELLIGENCE FOR WAYANAD</span>
              <span>· 461 GAUGED WATERSHEDS</span>
              <span>· 30M COPERNICUS DEM</span>
              <span>· DOPPLER RADAR REFLECTIVITY</span>
              <span className="text-[#D4F826]">· LEAD TIME &lt; 45 MIN</span>
              <span>· AI DETECTS · HUMANS DECIDE</span>
              <span>· 100% DISASTER TRIAGE WORKFLOW</span>
              <span>· REAL-TIME RUNOFF KINEMATICS</span>
            </div>
            <div className="marquee-content font-mono text-xs sm:text-sm tracking-wider uppercase" aria-hidden="true">
              <span className="text-[#D4F826]">◆ HYPERLOCAL FLASH-FLOOD INTELLIGENCE FOR WAYANAD</span>
              <span>· 461 GAUGED WATERSHEDS</span>
              <span>· 30M COPERNICUS DEM</span>
              <span>· DOPPLER RADAR REFLECTIVITY</span>
              <span className="text-[#D4F826]">· LEAD TIME &lt; 45 MIN</span>
              <span>· AI DETECTS · HUMANS DECIDE</span>
              <span>· 100% DISASTER TRIAGE WORKFLOW</span>
              <span>· REAL-TIME RUNOFF KINEMATICS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
