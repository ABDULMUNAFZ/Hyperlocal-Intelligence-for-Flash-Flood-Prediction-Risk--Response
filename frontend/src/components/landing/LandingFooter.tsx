import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Compass, ArrowRight, Github } from 'lucide-react';
import FloodGuardLogo from '../common/FloodGuardLogo';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="relative bg-[#141518] text-[#F6F5F2] pt-16 pb-12 overflow-hidden border-t border-[#26282E]">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Big Final CTA Banner */}
        <div className="p-8 sm:p-14 rounded-3xl bg-[#EBE8E0] text-[#141518] border border-[#DDD9CE] text-center space-y-6 shadow-xl relative overflow-hidden">
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
            <Link
              to="/app"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#141518] hover:bg-[#252830] text-white font-bold text-sm sm:text-base shadow-md transition-all transform hover:-translate-y-0.5"
            >
              <Terminal className="h-4 w-4" />
              <span>ENTER COMMAND CENTER</span>
            </Link>

            <Link
              to="/app/map"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white hover:bg-[#FAF9F6] border border-[#DDD9CE] text-[#141518] font-semibold text-sm sm:text-base shadow-sm transition-all"
            >
              <Compass className="h-4 w-4 text-[#181A1E]" />
              <span>OPEN 3D MAP</span>
            </Link>

            <a
              href="https://github.com/ABDULMUNAFZ/Hyperlocal-Intelligence-for-Flash-Flood-Prediction-Risk--Response"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#181A1E] hover:bg-black text-[#D4F826] font-mono text-xs sm:text-sm font-semibold transition-all border border-[#2B2E37] shadow-sm hover:scale-105"
            >
              <Github className="h-4 w-4 text-white" />
              <span>STAR ON GITHUB</span>
              <span className="text-white">★</span>
            </a>
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
    </footer>
  );
};

export default LandingFooter;
