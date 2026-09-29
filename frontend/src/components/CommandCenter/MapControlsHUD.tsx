import React from 'react';
import { 
  Compass, 
  Maximize2, 
  Minimize2, 
  Layers, 
  Rotate3d, 
  ArrowUp, 
  ArrowDown, 
  Globe, 
  Eye, 
  Map as MapIcon,
  Mountain,
  Navigation
} from 'lucide-react';

interface MapControlsHUDProps {
  zoom: number;
  pitch: number;
  bearing: number;
  cursorCoords: [number, number] | null;
  cursorElevation: number | null;
  is3d: boolean;
  onToggle3D: () => void;
  onPitchAdjust: (delta: number) => void;
  onResetNorth: () => void;
  onFlyToPreset: (preset: 'south_india' | 'western_ghats' | 'nilgiris' | 'anamalai' | 'deccan' | 'coastal') => void;
  exaggeration: number;
}

export const MapControlsHUD: React.FC<MapControlsHUDProps> = ({
  zoom,
  pitch,
  bearing,
  cursorCoords,
  cursorElevation,
  is3d,
  onToggle3D,
  onPitchAdjust,
  onResetNorth,
  onFlyToPreset,
  exaggeration,
}) => {
  return (
    <>
      {/* Top-Right HUD Navigation Floating Pill */}
      <div className="absolute top-20 right-3 z-10 pointer-events-none hidden md:flex flex-col items-end gap-2">
        {/* We keep space for ContextInspector; when ContextInspector is open, this stays compact */}
      </div>

      {/* Bottom-Left 3D Camera Controls Widget */}
      <div className="absolute bottom-16 left-3 z-10 pointer-events-auto flex flex-col gap-2">
        {/* Quick Fly-To Viewport Presets Strip */}
        <div className="p-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-lg flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <span className="px-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Navigation className="w-3 h-3 text-teal-600" /> Presets:
          </span>
          <button
            onClick={() => onFlyToPreset('south_india')}
            className="px-2.5 py-1 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-teal-600 transition-colors"
          >
            South India
          </button>
          <button
            onClick={() => onFlyToPreset('western_ghats')}
            className="px-2.5 py-1 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-teal-600 transition-colors"
          >
            Western Ghats
          </button>
          <button
            onClick={() => onFlyToPreset('nilgiris')}
            className="px-2.5 py-1 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-teal-600 transition-colors"
          >
            Nilgiris (Ooty)
          </button>
          <button
            onClick={() => onFlyToPreset('anamalai')}
            className="px-2.5 py-1 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-teal-600 transition-colors"
          >
            Anamalai (Munnar)
          </button>
        </div>

        {/* Telemetry and Exaggeration Notice */}
        <div className="px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-4 text-[10px] text-slate-500 font-mono">
          <div>
            <span>Zoom: </span>
            <strong className="text-slate-800 dark:text-slate-200">{zoom.toFixed(1)}</strong>
          </div>
          <div>
            <span>Pitch: </span>
            <strong className="text-slate-800 dark:text-slate-200">{pitch.toFixed(0)}°</strong>
          </div>
          <div>
            <span>Bearing: </span>
            <strong className="text-slate-800 dark:text-slate-200">{bearing.toFixed(0)}°</strong>
          </div>
          {cursorCoords && (
            <div className="hidden sm:block">
              <span>Cursor: </span>
              <strong className="text-slate-800 dark:text-slate-200">
                {cursorCoords[1].toFixed(3)}°N, {cursorCoords[0].toFixed(3)}°E
              </strong>
            </div>
          )}
          <div className="hidden lg:block text-slate-400 italic">
            <span>Vis Exaggeration: </span>
            <strong className="text-teal-600 dark:text-teal-400 font-sans">{exaggeration.toFixed(1)}x DEM</strong>
          </div>
        </div>
      </div>

      {/* Floating Right Map Control Buttons */}
      <div className="absolute top-24 right-4 z-10 pointer-events-auto flex flex-col gap-1.5">
        {/* 3D / 2D Perspective Toggle */}
        <button
          onClick={onToggle3D}
          className={`p-2.5 rounded-xl backdrop-blur-md shadow-lg border transition-all ${
            is3d 
              ? 'bg-teal-600 text-white border-teal-500 shadow-teal-500/20' 
              : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800'
          }`}
          title={is3d ? 'Switch to 2D Top-Down View' : 'Switch to 3D Tilted Perspective'}
        >
          <span className="font-extrabold text-xs block leading-none">{is3d ? '3D' : '2D'}</span>
        </button>

        {/* Compass Reset North */}
        <button
          onClick={onResetNorth}
          className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Reset North Orientation"
        >
          <Compass 
            className="w-4 h-4 text-rose-500 transition-transform duration-200" 
            style={{ transform: `rotate(${-bearing}deg)` }} 
          />
        </button>

        {/* Tilt Up */}
        <button
          onClick={() => onPitchAdjust(10)}
          className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Tilt Camera Up"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        {/* Tilt Down */}
        <button
          onClick={() => onPitchAdjust(-10)}
          className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Tilt Camera Down"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
};
