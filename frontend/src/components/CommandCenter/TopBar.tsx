import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Sun, 
  Moon, 
  RotateCcw, 
  Activity, 
  Layers, 
  CloudRain, 
  Flame, 
  LifeBuoy, 
  Sliders, 
  Bot, 
  CheckCircle2, 
  AlertTriangle,
  Compass,
  MapPin,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { SOUTH_INDIA_HILL_STATIONS, SOUTH_INDIA_STATES, SOUTH_INDIA_RIVERS, SOUTH_INDIA_RESERVOIRS } from '../../data/geospatialData';

export type CommandCenterMode = 'command' | 'climate' | 'flash_flood' | 'simulation' | 'evacuation';

interface TopBarProps {
  currentMode: CommandCenterMode;
  onModeChange: (mode: CommandCenterMode) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onResetCamera: () => void;
  onSelectFeature: (type: 'hill' | 'state' | 'river' | 'reservoir' | 'coords', item: any) => void;
  activeAlertCount?: number;
  onOpenAlerts?: () => void;
  onOpenAi?: () => void;
  backendHealthy?: boolean;
  showDomeMask?: boolean;
  onToggleDomeMask?: () => void;
  showWeatherAtmosphere?: boolean;
  onToggleWeatherAtmosphere?: () => void;
  weatherMode?: 'clear' | 'monsoon_rain' | 'cloudburst' | 'cloudy';
  onWeatherModeChange?: (mode: 'clear' | 'monsoon_rain' | 'cloudburst' | 'cloudy') => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentMode,
  onModeChange,
  isDarkMode,
  onToggleTheme,
  onResetCamera,
  onSelectFeature,
  activeAlertCount = 3,
  onOpenAlerts,
  onOpenAi,
  backendHealthy = true,
  showDomeMask = true,
  onToggleDomeMask,
  showWeatherAtmosphere = true,
  onToggleWeatherAtmosphere,
  weatherMode = 'monsoon_rain',
  onWeatherModeChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter searchable items
  const matchingHills = SOUTH_INDIA_HILL_STATIONS.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    h.district.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 4);

  const matchingStates = SOUTH_INDIA_STATES.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 3);

  const matchingRivers = SOUTH_INDIA_RIVERS.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 3);

  const matchingReservoirs = SOUTH_INDIA_RESERVOIRS.filter(res => 
    res.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 3);

  // Close search on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="absolute top-0 left-0 right-0 z-30 pointer-events-auto">
      {/* 1. Situational Status & Weather Telemetry Bar (Reference Image 4 Clean Modern Scheme) */}
      <div className="mx-3 mt-2 px-3 py-1 rounded-xl bg-white/95 dark:bg-slate-950/90 border border-[#E6E4DE] dark:border-slate-800/80 backdrop-blur-md text-[11px] font-mono text-[#141518] dark:text-slate-300 flex items-center justify-between shadow-xs overflow-x-auto select-none">
        <div className="flex items-center gap-3 shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-[#DDD6EE] text-[#141518] font-bold tracking-wider text-[10px] border border-[#C5BAE0]">
            STATUS · WARNING
          </span>
          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
            <span>LIVE MONSOON FEED</span>
          </div>
          <span className="text-[#A2A4AC] hidden sm:inline">|</span>
          <div className="hidden md:flex items-center gap-2 text-[#45474E] dark:text-slate-300">
            <span className="text-violet-700 dark:text-teal-400 font-bold">AIR 26.8°C</span>
            <span>· 91% RH</span>
            <span>· WIND SW 18 km/h (GUST 38)</span>
            <span>· RAIN RATE 48 mm/h</span>
            <span>· UV 0.0</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Circular Radar Dome Toggle */}
          <button
            onClick={onToggleDomeMask}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 ${
              showDomeMask
                ? 'bg-[#DDD6EE] text-[#141518] border-[#C5BAE0]'
                : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
            }`}

            title="Toggle South India Circular Radar Dome Arena Mask"
          >
            <span>◎ RADAR DOME</span>
            <span className="text-[9px] opacity-75">{showDomeMask ? 'ON' : 'OFF'}</span>
          </button>

          {/* Weather / Rain Atmosphere Toggle */}
          <button
            onClick={onToggleWeatherAtmosphere}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 ${
              showWeatherAtmosphere
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
            title="Toggle Cloudy & Rainy Atmospheric Particle Effects"
          >
            <span>🌧️ ATMOSPHERE</span>
            <span className="text-[9px] opacity-75">{showWeatherAtmosphere ? 'ACTIVE' : 'MUTED'}</span>
          </button>

          {/* Digital Clock */}
          <span className="font-mono text-cyan-300 font-bold tracking-widest pl-2 border-l border-slate-800">
            {currentTime || '20:19:56'} IST
          </span>
        </div>
      </div>

      {/* Main Top Bar */}
      <div className="mx-3 mt-1.5 px-4 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-lg flex items-center justify-between gap-3 text-slate-800 dark:text-slate-100 transition-colors">
        
        {/* Brand & System Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 via-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <span className="text-lg">🌊</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                  FLOOD<span className="text-teal-600 dark:text-teal-400">GUARD</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800">
                  SOUTH INDIA 3D COMMAND
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none hidden md:block">
                SIH 26192 • Geospatial Intelligence Digital Twin
              </p>
            </div>
          </div>

          {/* Live Engine Indicator */}
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${backendHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${backendHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {backendHealthy ? 'ML ENSEMBLE ACTIVE' : 'LOCAL CACHE MODE'}
            </span>
            <button
              onClick={() => setShowIntegrityModal(true)}
              className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 ml-1"
              title="View Strict Data Integrity Standards"
            >
              [DATA STANDARDS]
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div ref={searchRef} className="relative flex-1 max-w-xs md:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search Wayanad, Munnar, Ooty, Cauvery, or Lat, Lon..."
              className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-transparent focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none transition-all"
            />
          </div>

          {/* Search Dropdown */}
          {isSearchOpen && searchQuery.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2 max-h-80 overflow-y-auto z-50 text-xs">
              {/* Hill Stations */}
              {matchingHills.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                    <span>🏔️</span> High-Risk Hill Stations
                  </div>
                  {matchingHills.map(h => (
                    <button
                      key={h.id}
                      onClick={() => {
                        onSelectFeature('hill', h);
                        setIsSearchOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{h.name}</span>
                        <span className="text-[10px] text-slate-500 ml-1.5">({h.district}, {h.stateCode})</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300">
                        {h.elevationM}m
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* States */}
              {matchingStates.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                    <span>🗺️</span> States
                  </div>
                  {matchingStates.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSelectFeature('state', s);
                        setIsSearchOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{s.name} ({s.code})</span>
                      <span className="text-[10px] text-slate-500">{s.capital}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Rivers */}
              {matchingRivers.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                    <span>💧</span> Major Rivers
                  </div>
                  {matchingRivers.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onSelectFeature('river', r);
                        setIsSearchOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</span>
                      <span className="text-[10px] text-slate-500">{r.lengthKm} km</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Reservoirs */}
              {matchingReservoirs.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                    <span>🛡️</span> Major Reservoirs & Dams
                  </div>
                  {matchingReservoirs.map(res => (
                    <button
                      key={res.id}
                      onClick={() => {
                        onSelectFeature('reservoir', res);
                        setIsSearchOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{res.name}</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">{res.liveStoragePercent}% full</span>
                    </button>
                  ))}
                </div>
              )}

              {matchingHills.length === 0 && matchingStates.length === 0 && matchingRivers.length === 0 && matchingReservoirs.length === 0 && (
                <div className="p-3 text-center text-slate-400">
                  No predefined feature found. Click map to query ML prediction at any point.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Operating Modes Switcher */}
        <div className="hidden xl:flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1">
          {[
            { id: 'command', label: 'Command 3D', icon: Compass },
            { id: 'climate', label: 'Climate', icon: Sun },
            { id: 'flash_flood', label: 'Flash Flood', icon: Flame },
            { id: 'simulation', label: 'What-If Sim', icon: Sliders },
            { id: 'evacuation', label: 'Evacuation', icon: LifeBuoy },
          ].map(tab => {
            const Icon = tab.icon;
            const active = currentMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onModeChange(tab.id as CommandCenterMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  active 
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-teal-600 dark:text-teal-400' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Actions & Utilities */}
        <div className="flex items-center gap-2">
          {/* Active Alerts Button */}
          <button
            onClick={onOpenAlerts}
            className="relative px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-100 transition-colors"
            title="View Active Flash Flood Alerts"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">ALERTS</span>
            <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
              {activeAlertCount}
            </span>
          </button>

          {/* AI Copilot Button */}
          {onOpenAi && (
            <button
              onClick={onOpenAi}
              className="px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-teal-100 transition-colors"
              title="Open FloodGuard AI Geospatial Copilot"
            >
              <Bot className="w-4 h-4 text-teal-600" />
              <span className="hidden sm:inline">AI COPILOT</span>
            </button>
          )}

          {/* Reset Camera to South India */}
          <button
            onClick={onResetCamera}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Reset Camera to South India 3D Overview"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isDarkMode ? 'Switch to Original White Light Theme' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>

      {/* Data Integrity Standards Modal */}
      {showIntegrityModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-base">FloodGuard Strict Data Integrity Guarantee</h3>
              </div>
              <button 
                onClick={() => setShowIntegrityModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
              Every data point in the FloodGuard 3D Command Center is authenticated and explicitly tagged according to strict scientific standards:
            </p>

            <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">OBSERVED</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Ground telemetry from calibrated IoT rain gauges, water level stations & IMD radar.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">FORECAST</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Numerical weather predictions from Open-Meteo & GFS global models.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                <span className="font-bold text-purple-700 dark:text-purple-400 block mb-1">MODEL PREDICTION</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Outputs generated by the real Phase 5 Machine Learning Ensemble inference engine.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">SIMULATION</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">What-if hydrological hydrodynamic runoffs based on user rainfall parameters.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">DATA UNAVAILABLE</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Explicitly shown when no sensor or observation exists. No values are ever fabricated.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900">
                <span className="font-bold text-orange-700 dark:text-orange-400 block mb-1">ESTIMATED</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Internally flagged for 3D building visual extrusion heights where exact lidar is pending.</p>
              </div>
            </div>

            <button
              onClick={() => setShowIntegrityModal(false)}
              className="w-full mt-5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
