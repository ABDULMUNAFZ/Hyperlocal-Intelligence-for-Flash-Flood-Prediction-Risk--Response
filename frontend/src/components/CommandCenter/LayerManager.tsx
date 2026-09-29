import React, { useState } from 'react';
import { 
  Layers, 
  Mountain, 
  Droplet, 
  CloudRain, 
  Home, 
  ShieldAlert, 
  ChevronRight, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Sliders, 
  Flame, 
  LifeBuoy, 
  Radio, 
  MapPin, 
  Sparkles,
  TreePine,
  Building2,
  Activity,
  History,
  Info
} from 'lucide-react';
import { SOUTH_INDIA_HILL_STATIONS, SOUTH_INDIA_STATES, HillStation, SouthIndiaState } from '../../data/geospatialData';

export interface LayerState {
  terrain3d: boolean;
  terrainExaggeration: number;
  elevationContours: boolean;
  slopeHazard: boolean;
  rivers: boolean;
  reservoirs: boolean;
  flowAccumulation: boolean;
  climateZones: boolean;
  liveRainfall: boolean;
  iotSensors: boolean;
  hillStations: boolean;
  cities: boolean;
  buildings3d: boolean;
  criticalInfra: boolean;
  landCover: boolean;
  populationHeatmap: boolean;
  floodRisk: boolean;
  historicalFloods: boolean;
  flashFloodRunoff: boolean;
  simulationFront: boolean;
  evacuationRoutes: boolean;
  activeAlerts: boolean;
}

interface LayerManagerProps {
  layerState: LayerState;
  onToggleLayer: (layerKey: keyof LayerState) => void;
  onChangeExaggeration: (val: number) => void;
  onSelectHillStation: (hill: HillStation) => void;
  onSelectState: (state: SouthIndiaState) => void;
  selectedHillId?: string;
  selectedStateCode?: string;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  layerState,
  onToggleLayer,
  onChangeExaggeration,
  onSelectHillStation,
  onSelectState,
  selectedHillId,
  selectedStateCode,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'layers' | 'hills' | 'states'>('layers');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    terrain: true,
    hydrology: true,
    climate: true,
    settlements: true,
    risk: true,
  });

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  return (
    <aside 
      className={`absolute top-20 left-3 bottom-14 z-20 transition-all duration-300 pointer-events-auto flex flex-col ${
        isOpen ? 'w-80' : 'w-12'
      }`}
    >
      {/* Container Card */}
      <div className="flex-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header / Collapse Toggle */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {isOpen ? (
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                Geospatial Layers
              </h2>
            </div>
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-teal-600 mx-auto"
              title="Expand Layer Manager"
            >
              <Layers className="w-5 h-5" />
            </button>
          )}

          {isOpen && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
              title="Collapse Panel"
            >
              ◀
            </button>
          )}
        </div>

        {/* Collapsed icon bar */}
        {!isOpen && (
          <div className="flex-1 py-4 flex flex-col items-center gap-3">
            <button 
              onClick={() => { setIsOpen(true); setActiveTab('layers'); }}
              className="p-2 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Layers"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setIsOpen(true); setActiveTab('hills'); }}
              className="p-2 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Hill Stations"
            >
              <Mountain className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setIsOpen(true); setActiveTab('states'); }}
              className="p-2 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="States"
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Expanded Content */}
        {isOpen && (
          <>
            {/* View Switcher Tabs */}
            <div className="grid grid-cols-3 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 gap-1 text-[11px] font-semibold">
              <button
                onClick={() => setActiveTab('layers')}
                className={`py-1 rounded-lg transition-all ${
                  activeTab === 'layers' 
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Layers
              </button>
              <button
                onClick={() => setActiveTab('hills')}
                className={`py-1 rounded-lg transition-all ${
                  activeTab === 'hills' 
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Hill Stations ({SOUTH_INDIA_HILL_STATIONS.length})
              </button>
              <button
                onClick={() => setActiveTab('states')}
                className={`py-1 rounded-lg transition-all ${
                  activeTab === 'states' 
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                States (5)
              </button>
            </div>

            {/* Tab: Layers */}
            {activeTab === 'layers' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                
                {/* 1. Topography & Relief */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                  <button
                    onClick={() => toggleSection('terrain')}
                    className="w-full px-3 py-2 flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <Mountain className="w-3.5 h-3.5 text-blue-600" />
                      <span>Terrain & Relief</span>
                    </div>
                    {expandedSections.terrain ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {expandedSections.terrain && (
                    <div className="p-2.5 pt-1 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      {/* 3D DEM Terrain */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Real 3D DEM Elevation</span>
                          <span className="block text-[10px] text-slate-500">AWS Terrarium / Copernicus DEM</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('terrain3d')}
                          className={`p-1 rounded-md transition-colors ${layerState.terrain3d ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.terrain3d ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Terrain Exaggeration Slider */}
                      {layerState.terrain3d && (
                        <div className="px-1 py-1.5 bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>Visualization Exaggeration:</span>
                            <span className="font-mono font-bold text-teal-600">{layerState.terrainExaggeration.toFixed(1)}x</span>
                          </div>
                          <input
                            type="range"
                            min="1.0"
                            max="2.5"
                            step="0.1"
                            value={layerState.terrainExaggeration}
                            onChange={(e) => onChangeExaggeration(parseFloat(e.target.value))}
                            className="w-full accent-teal-600 h-1 rounded cursor-pointer"
                          />
                          <p className="text-[9px] text-slate-400 mt-1 italic leading-tight">
                            Note: Vertical exaggeration applied for visualization; not 1:1 vertical metric scale.
                          </p>
                        </div>
                      )}

                      {/* Elevation Contours */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Hypsometric Elevation Tint</span>
                          <span className="block text-[10px] text-slate-500">0 m to 2,695 m gradient</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('elevationContours')}
                          className={`p-1 rounded-md ${layerState.elevationContours ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.elevationContours ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Slope Gradient Hazard */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Slope &gt; 30° Debris Hazard</span>
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Ghats escarpment failure zones</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('slopeHazard')}
                          className={`p-1 rounded-md ${layerState.slopeHazard ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.slopeHazard ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Hydrology & Water Bodies */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                  <button
                    onClick={() => toggleSection('hydrology')}
                    className="w-full px-3 py-2 flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <Droplet className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Hydrology & Drainage</span>
                    </div>
                    {expandedSections.hydrology ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {expandedSections.hydrology && (
                    <div className="p-2.5 pt-1 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Major River Networks</span>
                          <span className="block text-[10px] text-slate-500">Cauvery, Krishna, Godavari, Periyar, Pamba</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('rivers')}
                          className={`p-1 rounded-md ${layerState.rivers ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.rivers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Reservoirs & Dams</span>
                          <span className="block text-[10px] text-slate-500">Idukki, Mullaperiyar, KRS, Mettur</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('reservoirs')}
                          className={`p-1 rounded-md ${layerState.reservoirs ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.reservoirs ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Flow Accumulation Corridors</span>
                          <span className="block text-[10px] text-slate-500">Hydrological valley concentration paths</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('flowAccumulation')}
                          className={`p-1 rounded-md ${layerState.flowAccumulation ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.flowAccumulation ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Climate & Weather */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                  <button
                    onClick={() => toggleSection('climate')}
                    className="w-full px-3 py-2 flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <CloudRain className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Climate & Precipitation</span>
                    </div>
                    {expandedSections.climate ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {expandedSections.climate && (
                    <div className="p-2.5 pt-1 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Agro-Climatic Belts</span>
                          <span className="block text-[10px] text-slate-500">Per-Humid, Semi-Arid, Coastal</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('climateZones')}
                          className={`p-1 rounded-md ${layerState.climateZones ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.climateZones ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Live Rainfall Overlay</span>
                          <span className="block text-[10px] text-teal-600 font-semibold">[FORECAST / OBSERVED]</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('liveRainfall')}
                          className={`p-1 rounded-md ${layerState.liveRainfall ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.liveRainfall ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">IoT Sensor Telemetry</span>
                          <span className="block text-[10px] text-slate-500">Rainfall & Water Level Gauges</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('iotSensors')}
                          className={`p-1 rounded-md ${layerState.iotSensors ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.iotSensors ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Settlements & 3D Buildings */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                  <button
                    onClick={() => toggleSection('settlements')}
                    className="w-full px-3 py-2 flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Settlements & 3D Buildings</span>
                    </div>
                    {expandedSections.settlements ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {expandedSections.settlements && (
                    <div className="p-2.5 pt-1 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Hill Stations Beacons</span>
                          <span className="block text-[10px] text-slate-500">3D altitude pillars & fly-to</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('hillStations')}
                          className={`p-1 rounded-md ${layerState.hillStations ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.hillStations ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">3D Extruded Buildings</span>
                          <span className="block text-[10px] text-slate-500">LOD rendered at Zoom &ge; 14</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('buildings3d')}
                          className={`p-1 rounded-md ${layerState.buildings3d ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.buildings3d ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Critical Infrastructure</span>
                          <span className="block text-[10px] text-slate-500">Hospitals, schools, police, shelters</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('criticalInfra')}
                          className={`p-1 rounded-md ${layerState.criticalInfra ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.criticalInfra ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">ESA WorldCover 10m</span>
                          <span className="block text-[10px] text-slate-500">Forests, plantations, urban</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('landCover')}
                          className={`p-1 rounded-md ${layerState.landCover ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.landCover ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Risk, Response & Simulation */}
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                  <button
                    onClick={() => toggleSection('risk')}
                    className="w-full px-3 py-2 flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-red-600" />
                      <span>Hazard, Alerts & Simulation</span>
                    </div>
                    {expandedSections.risk ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>

                  {expandedSections.risk && (
                    <div className="p-2.5 pt-1 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">ML Flood Hazard Index</span>
                          <span className="block text-[10px] text-purple-600 font-semibold">[MODEL PREDICTION]</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('floodRisk')}
                          className={`p-1 rounded-md ${layerState.floodRisk ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.floodRisk ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Historical Inundation</span>
                          <span className="block text-[10px] text-emerald-600 font-semibold">[OBSERVED] 2018, 2019, 2024</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('historicalFloods')}
                          className={`p-1 rounded-md ${layerState.historicalFloods ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.historicalFloods ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">What-If Simulation Front</span>
                          <span className="block text-[10px] text-amber-600 font-semibold">[SIMULATION] Depth propagation</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('simulationFront')}
                          className={`p-1 rounded-md ${layerState.simulationFront ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.simulationFront ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Safe Evacuation Corridors</span>
                          <span className="block text-[10px] text-slate-500">Designated shelters & egress paths</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('evacuationRoutes')}
                          className={`p-1 rounded-md ${layerState.evacuationRoutes ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.evacuationRoutes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">Active CAP Warning Polygons</span>
                          <span className="block text-[10px] text-red-600 font-semibold">[OBSERVED] Alert polygons</span>
                        </div>
                        <button
                          onClick={() => onToggleLayer('activeAlerts')}
                          className={`p-1 rounded-md ${layerState.activeAlerts ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' : 'text-slate-400'}`}
                        >
                          {layerState.activeAlerts ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Hill Stations List */}
            {activeTab === 'hills' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
                <div className="p-2 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800 text-[11px] text-teal-800 dark:text-teal-300">
                  Click any hill station to execute a smooth 3D camera fly-to with steep tilted oblique inspection.
                </div>
                {SOUTH_INDIA_HILL_STATIONS.map((hill) => {
                  const isSelected = selectedHillId === hill.id;
                  return (
                    <button
                      key={hill.id}
                      onClick={() => onSelectHillStation(hill)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                        isSelected 
                          ? 'border-teal-500 bg-teal-50/80 dark:bg-teal-950/60 shadow-sm' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>🏔️</span> {hill.name}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          hill.hazardGrade === 'Extreme' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                          hill.hazardGrade === 'Severe' || hill.hazardGrade === 'High' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {hill.hazardGrade.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{hill.district}, {hill.stateName}</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{hill.elevationM} m</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500 flex items-center justify-between">
                        <span>Drainage: {hill.drainageBasin.split('/')[0]}</span>
                        <span className="text-teal-600 dark:text-teal-400 font-semibold">{hill.annualRainfallMm} mm/yr</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab: States Overview */}
            {activeTab === 'states' && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
                {SOUTH_INDIA_STATES.map((st) => {
                  const isSelected = selectedStateCode === st.code;
                  return (
                    <button
                      key={st.id}
                      onClick={() => onSelectState(st)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected 
                          ? 'border-teal-500 bg-teal-50/80 dark:bg-teal-950/60 shadow-sm' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {st.name} ({st.code})
                        </span>
                        <span className="text-xs text-slate-500">{st.localName}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 dark:text-slate-400 mt-2">
                        <div>
                          <span className="block text-slate-400">Capital:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{st.capital}</span>
                        </div>
                        <div>
                          <span className="block text-slate-400">Population:</span>
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {(st.population / 1000000).toFixed(1)} Million
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-400">Area:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">{st.areaSqKm.toLocaleString()} km²</span>
                        </div>
                        <div>
                          <span className="block text-slate-400">Vulnerability:</span>
                          <span className={`font-bold ${st.vulnerabilityScore > 80 ? 'text-red-600' : 'text-amber-600'}`}>
                            {st.vulnerabilityScore} / 100
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-500">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Major Basins: </span>
                        {st.majorBasins.join(', ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
