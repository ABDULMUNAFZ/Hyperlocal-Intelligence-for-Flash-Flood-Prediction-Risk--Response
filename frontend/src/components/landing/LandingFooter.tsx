import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Compass, Github, LifeBuoy } from 'lucide-react';
import { Magnetic } from './story/Magnetic';
import { ParallaxLayer } from './story/ParallaxLayer';
import FloodGuardLogo from '../common/FloodGuardLogo';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="relative text-[#F6F5F2] pt-6 pb-10 overflow-hidden">
      {/* dawn: a soft sun rising behind the closing call to action */}
      <ParallaxLayer speed={0.35} className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2">
        <div className="h-[46rem] w-[46rem] rounded-full bg-[radial-gradient(circle,rgba(255,214,150,0.75)_0%,rgba(255,190,120,0.25)_40%,transparent_70%)] blur-2xl" />
      </ParallaxLayer>
      <div className="relative max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Big Final CTA Banner */}
        <div data-reveal className="p-8 sm:p-16 rounded-[2.5rem] bg-white/55 backdrop-blur-xl text-[#141518] border border-white/70 text-center space-y-6 shadow-[0_50px_120px_-50px_rgba(120,70,20,0.45)] relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181A1E] text-white font-mono text-xs font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4F826]"></span>
            <span>EARLY ACTION SAVES LIVES</span>
          </div>

          <h2 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-[#141518] tracking-tight leading-[1.06] max-w-3xl mx-auto">
            SEE THE FLOOD <br />
            <span className="italic font-serif font-normal text-[#4A4740] underline decoration-[#D4F826] decoration-4 underline-offset-8">
              BEFORE IT REACHES THE STREET.
            </span>
          </h2>

          <p className="font-sans text-base sm:text-xl text-[#3A3644] max-w-2xl mx-auto font-normal leading-relaxed">
            Deploying multi-source disaster intelligence to protect vulnerable mountain communities 
            across Wayanad and the Western Ghats.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            <Magnetic>
              <Link
                to="/app/map"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-[#141518] hover:bg-[#252830] text-white font-bold text-sm sm:text-base shadow-lg transition-colors"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#D4F826] shadow-[0_0_10px_#D4F826]" />
                <span>OPEN THE 3D MAP</span>
                <Compass className="h-4 w-4 text-[#D4F826]" />
              </Link>
            </Magnetic>

            <Magnetic>
              <Link
                to="/emergency"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-full bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-sm sm:text-base shadow-sm transition-colors"
              >
                <LifeBuoy className="h-4 w-4" />
                <span>CITIZEN SOS APP</span>
              </Link>
            </Magnetic>

            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-white/80 hover:bg-white border border-[#DDD9CE] text-[#141518] font-semibold text-sm sm:text-base shadow-sm transition-colors"
            >
              <Terminal className="h-4 w-4" />
              <span>ENTER COMMAND CENTER</span>
            </Link>

            <a
              href="https://github.com/ABDULMUNAFZ/Hyperlocal-Intelligence-for-Flash-Flood-Prediction-Risk--Response"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-[#181A1E] hover:bg-black text-[#D4F826] font-mono text-xs sm:text-sm font-semibold transition-all border border-[#2B2E37] shadow-sm"
            >
              <Github className="h-4 w-4 text-white" />
              <span>STAR ON GITHUB</span>
              <span className="text-white">★</span>
            </a>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-[#141518] p-5 sm:p-10 space-y-12 shadow-2xl">
        {/* Official Smart India Hackathon 2026 National Project Accreditation Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#1B1D22] border-2 border-[#2E323D] relative overflow-hidden shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141518] border border-[#3A3E4B] text-[11px] font-mono text-[#D4F826]">
                <span className="h-2 w-2 rounded-full bg-[#D4F826] animate-pulse"></span>
                <span className="font-bold">SMART INDIA HACKATHON 2026</span>
                <span className="text-white/40">|</span>
                <span className="text-white font-semibold">PS ID: 26192</span>
              </div>
              <h3 className="font-display font-extrabold text-xl sm:text-2xl text-white tracking-tight">
                Flash Flood Prediction System for Hilly Regions using Multi-Source Data Theme
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm font-sans leading-relaxed">
                National hackathon innovation engineered to predict and track catastrophic flash floods across steep mountain watersheds 
                (Wayanad, Western Ghats) through integrated Copernicus 30m DEM, real-time radar precipitation, and ML slope failure physics.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-[#D4F826] font-bold">Done by:</span>
                  <span className="text-white font-semibold">Team Tech Mavericks</span>
                </div>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">National Submission:</span>
                  <span className="text-white font-semibold">Smart India Hackathon 2026</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2.5">
              <a
                href="https://github.com/ABDULMUNAFZ/Hyperlocal-Intelligence-for-Flash-Flood-Prediction-Risk--Response"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#D4F826] hover:bg-[#bce014] text-[#181A1E] font-bold text-xs tracking-wider shadow-md transition-all hover:scale-105"
              >
                <Github className="h-4 w-4" />
                <span>GITHUB REPO ★</span>
              </a>
              <Link
                to="/app/map"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#252830] hover:bg-[#323642] text-white border border-white/10 font-bold text-xs tracking-wider transition-all"
              >
                <Compass className="h-4 w-4 text-[#D4F826]" />
                <span>EXPLORE 3D MAP</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Links & Attributions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-xs font-mono">
          {/* Brand Col with Official Rescue Emblem */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-white/10 border border-white/20 p-2 flex items-center justify-center">
                <FloodGuardLogo className="h-5 w-auto" variant="citron" />
              </div>
              <span className="font-display font-black text-lg text-white">FLOODGUARD</span>
            </div>
            <p className="text-slate-400 font-sans leading-relaxed text-[11.5px]">
              Hyperlocal Flash-Flood Prediction, Risk Intelligence &amp; Emergency Response Platform for Hilly Regions.
            </p>
            <div className="text-[#D4F826] font-bold text-[11px] tracking-wider">
              WAYANAD DISTRICT, KERALA
            </div>
            <div className="pt-2">
              <a
                href="https://github.com/ABDULMUNAFZ/Hyperlocal-Intelligence-for-Flash-Flood-Prediction-Risk--Response"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] transition-all"
              >
                <Github className="h-3.5 w-3.5 text-[#D4F826]" />
                <span>Star on GitHub</span>
                <span className="text-[#D4F826] font-bold">★</span>
              </a>
            </div>
          </div>

          {/* Platform Routes */}
          <div className="space-y-2">
            <div className="text-white font-bold uppercase tracking-wider pb-1 border-b border-white/10">
              OPERATIONAL PLATFORM
            </div>
            <div className="space-y-2 text-slate-400">
              <div><Link to="/app" className="hover:text-white transition-colors">Command Center (/app)</Link></div>
              <div><Link to="/app/map" className="hover:text-white transition-colors">3D Situational Map (/app/map)</Link></div>
              <div><Link to="/simulations" className="hover:text-white transition-colors">What-If Simulations (/simulations)</Link></div>
              <div><Link to="/emergency" className="hover:text-white transition-colors">Citizen Emergency SOS (/emergency)</Link></div>
              <div><Link to="/alerts" className="hover:text-white transition-colors">Alert Center (/alerts)</Link></div>
              <div><Link to="/production" className="hover:text-white transition-colors">Production Roadmap (/production)</Link></div>
            </div>
          </div>

          {/* Emergency Helplines */}
          <div className="space-y-2">
            <div className="text-white font-bold uppercase tracking-wider pb-1 border-b border-white/10">
              KERALA DISASTER HELPLINES
            </div>
            <div className="space-y-2 text-slate-300 text-[11px]">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span>National Emergency:</span>
                <span className="text-rose-400 font-bold">112</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span>District Disaster EOC:</span>
                <span className="text-[#D4F826] font-bold">1077 (Wayanad)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span>State Disaster Operations:</span>
                <span className="text-sky-300 font-bold">1070 (KSDMA)</span>
              </div>
            </div>
          </div>

          {/* Data Sources & Transparency */}
          <div className="space-y-2">
            <div className="text-white font-bold uppercase tracking-wider pb-1 border-b border-white/10">
              DATA SOURCES &amp; ATTRIBUTION
            </div>
            <div className="space-y-1 text-slate-400 text-[10.5px]">
              <div>• Elevation: Copernicus 30m GLO DEM</div>
              <div>• Weather: Open-Meteo High-Resolution</div>
              <div>• Radar: IMD Doppler Stations</div>
              <div>• Infrastructure: OpenStreetMap (ODbL 1.0)</div>
              <div>• Land Cover: ESA WorldCover 10m</div>
              <div>• Population: WorldPop 100m Raster</div>
            </div>
          </div>
        </div>

        {/* Legal & Data Honesty Footnote */}
        <div className="pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[10.5px] font-mono text-slate-500">
          <div>
            © 2026 FloodGuard Project · Built for disaster intelligence &amp; early community warning.
          </div>
          <div className="text-slate-400 flex items-center gap-2">
            <span>Strict separation maintained between LIVE, MODEL, and SIMULATION data states.</span>
            <a
              href="https://github.com/ABDULMUNAFZ/Hyperlocal-Intelligence-for-Flash-Flood-Prediction-Risk--Response"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D4F826] hover:underline"
            >
              GitHub Repository
            </a>
          </div>
        </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
