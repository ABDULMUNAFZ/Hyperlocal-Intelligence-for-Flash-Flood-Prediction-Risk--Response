import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  UploadCloud,
  RotateCcw,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import Dither from '../react-bits/Dither';
import MountainParticleCluster from './MountainParticleCluster';

export const HeroSection: React.FC = () => {
  const [customImage, setCustomImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetImage = () => {
    setCustomImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <section className="relative min-h-[96vh] flex flex-col justify-center pt-24 pb-12 overflow-hidden bg-[#EBE8E0] text-[#181A1E]">
      {/* Hidden File Input for Custom Image Slot */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

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
        <div className="hidden lg:block relative w-full h-[650px]">
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
            {/* Background Layer: Three.js Dither Canvas */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <Dither
                waveColor={[0.83, 0.97, 0.15]}
                backgroundColor={[0.04, 0.05, 0.07]}
                disableAnimation={false}
                enableMouseInteraction={true}
                mouseRadius={0.35}
                colorNum={4}
                waveAmplitude={0.28}
                waveFrequency={3.2}
                waveSpeed={0.04}
                pixelSize={2.5}
              />
            </div>

            {/* Visual Subject: 3D Mountain Spherical Particle Cluster OR Custom Inserted Image */}
            <div className="absolute inset-0">
              <MountainParticleCluster customImage={customImage} />
            </div>

            {/* Subtle Vignette & Depth Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D11]/90 via-transparent to-[#0B0D11]/40 pointer-events-none" />

            {/* INNER ELEMENT A: Top-Left Lower Shelf */}
            <div className="absolute top-[185px] left-8 z-20 flex items-start gap-3 text-white/90 select-none">
              <div className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-none">
                <Sparkles className="h-4 w-4 text-[#D4F826]" />
              </div>
              <div className="text-[11px] font-mono leading-tight">
                <div className="text-white/60 tracking-wider">WE AIM TO PROVIDE</div>
                <div className="text-white font-semibold tracking-wider">TOOLS THAT ENHANCE</div>
                <div className="text-[#D4F826] font-bold tracking-widest mt-0.5">PREDICTIVITY</div>
              </div>
            </div>

            {/* INNER ELEMENT B: Image Upload & Customization Control Bar (Center-Top) */}
            <div className="absolute top-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-[11px] font-mono font-medium transition-all shadow-lg hover:scale-105"
                title="Click to insert your own image into the center frame"
              >
                <UploadCloud className="h-3.5 w-3.5 text-[#D4F826]" />
                <span>{customImage ? 'Change Image' : 'Insert Image / Visual'}</span>
              </button>

              {customImage && (
                <button
                  type="button"
                  onClick={handleResetImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white/80 hover:text-white text-[11px] font-mono transition-all"
                  title="Reset to live 3D Mountain Mesh"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset 3D Mesh</span>
                </button>
              )}
            </div>

            {/* INNER ELEMENT C: Top-Right Huge Stat & Indicator */}
            <div className="absolute top-6 right-12 z-20 text-right text-white select-none">
              <div className="font-display font-extrabold text-5xl tracking-tight text-white flex items-baseline justify-end gap-1">
                461
                <span className="text-[#D4F826] text-xl font-mono">+</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-1 text-[11px] font-mono text-white/70">
                <span className="h-2 w-2 rounded-full bg-[#D4F826] animate-pulse"></span>
                <span>Gauged Catchment Cells</span>
              </div>
            </div>

            {/* INNER ELEMENT D: Bottom-Left Action Circle & Telemetry Text */}
            <div className="absolute bottom-7 left-8 z-20 flex items-center gap-4 text-white select-none">
              <Link
                to="/app/map"
                className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center transition-all hover:scale-110 group cursor-pointer"
                title="Open Live Spatial Telemetry"
              >
                <ArrowUpRight className="h-5 w-5 text-white group-hover:text-[#D4F826] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
              <div className="text-[11px] font-mono leading-tight">
                <div className="text-white/60">Dynamic sensor telemetry</div>
                <div className="text-white font-semibold">Real-time rainfall &amp; slope saturation</div>
                <div className="text-[#D4F826] text-[10px] mt-0.5">Chembra watershed · AMC III: 84%</div>
              </div>
            </div>

            {/* INNER ELEMENT E: Bottom-Right Shelf Capsule Tags (Above Cutout) */}
            <div className="absolute bottom-[170px] right-12 z-20 flex items-center gap-2 select-none">
              <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-mono text-white/90">
                Copernicus 30m DEM
              </div>
              <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-mono text-white/90">
                Hydrological Engine
              </div>
              <div className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-mono text-[#D4F826] font-bold">
                v2.4
              </div>
            </div>
          </div>

          {/* 3. OUTSIDE BOTTOM-RIGHT NOTCH (Sitting in the lower-right cutout) */}
          <div className="absolute bottom-0 right-2 z-30 text-right select-none flex flex-col items-end">
            <div className="font-display font-extrabold text-4xl lg:text-5xl tracking-tight text-[#181A1E] uppercase leading-[0.94]">
              SEE THE FLOOD
            </div>
            <div className="font-display font-extrabold text-3xl lg:text-4xl tracking-tight text-[#181A1E] uppercase leading-[0.94] mt-1.5 flex items-center gap-2">
              <span>BEFORE IT REACHES THE STREET</span>
              <span className="text-[#181A1E] text-2xl lg:text-3xl animate-spin-slow">✹</span>
            </div>

            {/* ONLY ONE SINGLE PROMINENT BUTTON (Requested by User) */}
            <div className="mt-5">
              <Link
                to="/app/map"
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#181A1E] hover:bg-[#2A2D35] text-white font-display font-bold text-base lg:text-lg shadow-xl shadow-black/20 transition-all transform hover:-translate-y-0.5 border border-[#33363F]"
              >
                <span className="flex h-2.5 w-2.5 rounded-full bg-[#D4F826] shadow-[0_0_8px_#D4F826]"></span>
                <span className="tracking-wide">VIEW 3D MAP</span>
                <span className="text-[#A0A4B0] text-xs font-mono font-normal">| STEP IN</span>
                <ArrowRight className="h-5 w-5 text-[#D4F826] group-hover:translate-x-1 transition-transform" />
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

          {/* Mobile Center Frame */}
          <div className="relative w-full h-[460px] rounded-[2.5rem] bg-[#0B0D11] border border-[#262830] shadow-xl overflow-hidden">
            {/* Background Dither */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <Dither
                waveColor={[0.83, 0.97, 0.15]}
                backgroundColor={[0.04, 0.05, 0.07]}
                disableAnimation={false}
                enableMouseInteraction={false}
                colorNum={4}
                pixelSize={3}
              />
            </div>

            {/* 3D Particle Hill or Image */}
            <div className="absolute inset-0">
              <MountainParticleCluster customImage={customImage} />
            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D11]/90 via-transparent to-[#0B0D11]/40 pointer-events-none" />

            {/* Mobile Top Stats & Image Slot Trigger */}
            <div className="absolute top-4 inset-x-4 flex items-center justify-between z-20">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[11px] font-mono"
              >
                <UploadCloud className="h-3 w-3 text-[#D4F826]" />
                <span>{customImage ? 'Change Image' : 'Insert Image'}</span>
              </button>

              <div className="text-right text-white">
                <div className="font-display font-extrabold text-2xl text-white">461+</div>
                <div className="text-[10px] font-mono text-[#D4F826]">Gauged Cells</div>
              </div>
            </div>

            {/* Mobile Bottom Telemetry & Tags */}
            <div className="absolute bottom-4 inset-x-4 z-20 space-y-3">
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white/90">
                  Copernicus 30m DEM
                </div>
                <div className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-mono text-[#D4F826] font-bold">
                  v2.4 Live
                </div>
              </div>

              <div className="flex items-center gap-3 text-white">
                <Link
                  to="/app/map"
                  className="h-10 w-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center flex-none"
                >
                  <ArrowUpRight className="h-4 w-4 text-[#D4F826]" />
                </Link>
                <div className="text-[11px] font-mono leading-tight">
                  <div className="text-white/70">Dynamic sensor telemetry</div>
                  <div className="text-white font-medium">Real-time rainfall &amp; slope saturation</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Bottom Heading & Single Prominent Button */}
          <div className="text-center sm:text-right space-y-4 pt-2">
            <div className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-[#181A1E] uppercase leading-tight">
              SEE THE FLOOD <br />
              <span className="flex items-center justify-center sm:justify-end gap-2">
                BEFORE IT REACHES THE STREET <span className="text-[#181A1E] text-2xl">✹</span>
              </span>
            </div>

            <div>
              <Link
                to="/app/map"
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#181A1E] hover:bg-[#2A2D35] text-white font-display font-bold text-base shadow-xl shadow-black/20 transition-all border border-[#33363F]"
              >
                <span className="flex h-2.5 w-2.5 rounded-full bg-[#D4F826] shadow-[0_0_8px_#D4F826]"></span>
                <span className="tracking-wide">VIEW 3D MAP</span>
                <span className="text-[#A0A4B0] text-xs font-mono font-normal">| STEP IN</span>
                <ArrowRight className="h-5 w-5 text-[#D4F826] group-hover:translate-x-1 transition-transform" />
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
