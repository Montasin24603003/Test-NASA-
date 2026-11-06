import React from 'react';
import { 
  Calendar, 
  Database, 
  ExternalLink, 
  MapPin, 
  Layers, 
  SlidersHorizontal,
  Ruler
} from 'lucide-react';

export interface MarsScientificBottomBarProps {
  selectedSol: number;
  onSelectSol: (sol: number) => void;
  selectedCoordinates?: { lat: number; lon: number; elevationM?: number };
  zoomLevel: number;
}

export function MarsScientificBottomBar({
  selectedSol,
  onSelectSol,
  selectedCoordinates,
  zoomLevel,
}: MarsScientificBottomBarProps) {
  const lat = selectedCoordinates?.lat ?? 18.4447;
  const lon = selectedCoordinates?.lon ?? 77.4508;
  const elev = selectedCoordinates?.elevationM ?? -2560;

  // Compute dynamic scale bar width on Mars:
  // At zoom z, 360 degrees = (w / 360) * 2^z pixels
  // Length of 1 degree latitude on Mars = 2 * PI * 3389.5 / 360 ≈ 59.16 km
  const kmPerDegLat = 59.16;
  const scaleBarKm = zoomLevel >= 4 ? 20 : zoomLevel >= 2 ? 100 : zoomLevel >= 1 ? 500 : 1500;

  const milestones = [
    { sol: 0, label: 'Landing (EDL)' },
    { sol: 150, label: 'Habitat Setup' },
    { sol: 350, label: 'Deep Drill Sol' },
    { sol: 600, label: 'Dust Storm Peak' },
    { sol: 850, label: 'Ascent Prep' },
    { sol: 1000, label: 'Nominal End' },
  ];

  return (
    <div className="w-full bg-[#090e17] border-t border-slate-800 text-slate-300 select-none px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
      {/* 1. Scientific Coordinates & Elevation Telemetry */}
      <div className="flex items-center gap-4 min-w-max">
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-amber-500" />
          <span className="text-slate-400">TARGET:</span>
          <span className="text-slate-100 font-bold">
            {lat >= 0 ? `${lat.toFixed(3)}°N` : `${Math.abs(lat).toFixed(3)}°S`},{' '}
            {lon >= 0 ? `${lon.toFixed(3)}°E` : `${Math.abs(lon).toFixed(3)}°W`}
          </span>
        </div>
        <div className="h-3 w-px bg-slate-800" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">DATUM:</span>
          <span className="text-amber-400 font-bold">
            {elev >= 0 ? `+${elev.toLocaleString()} m` : `${elev.toLocaleString()} m`}
          </span>
        </div>
      </div>

      {/* 2. Mission Timeline Sol Scrubber */}
      <div className="flex-1 w-full max-w-xl px-2">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span className="font-semibold text-slate-300">Mission Operational Timeline:</span>
          <span className="text-amber-400 font-bold">Current Horizon: Sol {selectedSol}</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0"
            max="1000"
            step="5"
            value={selectedSol}
            onChange={(e) => onSelectSol(parseInt(e.target.value, 10))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[8px] text-slate-500 mt-1">
            {milestones.map((m) => (
              <button
                key={m.sol}
                type="button"
                onClick={() => onSelectSol(m.sol)}
                className={`hover:text-amber-400 transition-colors ${
                  Math.abs(selectedSol - m.sol) < 40 ? 'text-amber-400 font-bold' : ''
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Dynamic Map Scale Bar */}
      <div className="flex items-center gap-3 min-w-max border-t md:border-t-0 md:border-l border-slate-800 pt-1.5 md:pt-0 md:pl-4">
        <div className="flex flex-col items-center">
          <div className="w-24 h-1.5 border-l border-r border-b border-slate-400 flex items-center justify-center">
            <span className="text-[9px] text-slate-300 font-bold -translate-y-2.5 bg-[#090e17] px-1">
              {scaleBarKm} km
            </span>
          </div>
          <span className="text-[8px] text-slate-500 mt-0.5">Mars Mean Scale</span>
        </div>
      </div>

      {/* 4. Official NASA Data Attribution */}
      <div className="hidden xl:flex items-center gap-2 border-l border-slate-800 pl-4 text-[9px] text-slate-500">
        <div className="flex flex-col text-right">
          <span className="text-slate-400 font-semibold">NASA Mars Trek WMTS &middot; PSI SWIM 2.0</span>
          <span>USGS Astrogeology &middot; PDS Geosciences</span>
        </div>
      </div>
    </div>
  );
}
