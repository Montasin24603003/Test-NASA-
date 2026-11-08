import React, { useState } from 'react';
import { 
  Globe2, 
  Map as MapIcon, 
  Ruler, 
  Navigation, 
  Database, 
  Camera, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  Search, 
  Layers, 
  Compass, 
  SlidersHorizontal,
  Box,
  BrainCircuit,
  ExternalLink,
  FileText
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

export interface MarsTopToolbarProps {
  onSearchCoordinate: (coord: { lat: number; lon: number; name?: string }) => void;
  isMeasuring: boolean;
  onToggleMeasure: () => void;
  onOpenRoutePlanner: () => void;
  onOpenCatalogue: () => void;
  onOpenImages: () => void;
  onOpenAiAdvisor: () => void;
  onOpenMissionBrief?: () => void;
  onOpenHfAi?: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function MarsTopToolbar({
  onSearchCoordinate,
  isMeasuring,
  onToggleMeasure,
  onOpenRoutePlanner,
  onOpenCatalogue,
  onOpenImages,
  onOpenAiAdvisor,
  onOpenMissionBrief,
  onOpenHfAi,
  isSidebarOpen,
  onToggleSidebar,
  isInspectorOpen,
  onToggleInspector,
  isFullscreen,
  onToggleFullscreen,
}: MarsTopToolbarProps) {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = searchInput.trim();
    if (!val) return;

    // Check if input is lat, lon (e.g., "18.44, 77.45")
    const match = val.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (match && match[1] && match[3]) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[3]);
      onSearchCoordinate({ lat, lon, name: `Coordinate (${lat}°, ${lon}°)` });
      setSearchInput('');
      return;
    }

    // Common named Martian shortcuts
    const lower = val.toLowerCase();
    if (lower.includes('jezero')) {
      onSearchCoordinate({ lat: 18.4447, lon: 77.4508, name: 'Jezero Crater' });
    } else if (lower.includes('gale') || lower.includes('curiosity')) {
      onSearchCoordinate({ lat: -4.5895, lon: 137.4417, name: 'Gale Crater (Curiosity)' });
    } else if (lower.includes('olympus')) {
      onSearchCoordinate({ lat: 18.65, lon: -133.8, name: 'Olympus Mons' });
    } else if (lower.includes('valles') || lower.includes('marineris')) {
      onSearchCoordinate({ lat: -14.0, lon: -59.0, name: 'Valles Marineris' });
    } else if (lower.includes('hellas')) {
      onSearchCoordinate({ lat: -42.0, lon: 70.0, name: 'Hellas Planitia' });
    } else if (lower.includes('elysium') || lower.includes('insight')) {
      onSearchCoordinate({ lat: 4.5, lon: 135.6, name: 'Elysium Planitia (InSight)' });
    } else if (lower.includes('north') || lower.includes('boreum')) {
      onSearchCoordinate({ lat: 84.0, lon: 0.0, name: 'Planum Boreum (North Pole)' });
    } else if (lower.includes('south') || lower.includes('australe')) {
      onSearchCoordinate({ lat: -84.0, lon: 0.0, name: 'Planum Australe (South Pole)' });
    } else {
      // Default fallback search
      onSearchCoordinate({ lat: 18.4447, lon: 77.4508, name: val });
    }
    setSearchInput('');
  };

  return (
    <header className="w-full bg-[#090e17] border-b border-slate-800 text-slate-200 select-none px-4 py-2 flex items-center justify-between gap-3 shadow-md z-30">
      {/* Brand & Toggle Sidebar */}
      <div className="flex items-center gap-3 min-w-max">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-lg border transition-colors ${
            isSidebarOpen 
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
          }`}
          title="Toggle Layers Sidebar"
        >
          <Layers className="size-4" />
        </button>

        <Link
          to="/"
          title="Return to Home Console"
          className="flex items-center gap-2 group hover:opacity-95 transition-all cursor-pointer select-none"
        >
          <div className="size-7 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center font-bold text-slate-950 text-xs shadow-sm group-hover:scale-105 transition-transform">
            M
          </div>
          <div className="leading-tight hidden sm:block">
            <h1 className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase group-hover:text-amber-400 transition-colors">
              MARS EXPLORER // TREK
            </h1>
            <p className="font-mono text-[9px] text-slate-400 uppercase tracking-widest">
              Planetary Scientific Platform
            </p>
          </div>
        </Link>
      </div>

      {/* Coordinate & Landmark Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 size-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search lat, lon (e.g. 18.44, 77.45) or crater name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
      </form>

      {/* Scientific Tools Toolbar */}
      <div className="flex items-center gap-1.5 text-xs font-mono">
        {/* Measure Distance Tool */}
        <button
          type="button"
          onClick={onToggleMeasure}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
            isMeasuring 
              ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold' 
              : 'border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300'
          }`}
          title="Measure Surface Distance (km)"
        >
          <Ruler className="size-3.5" />
          <span className="hidden lg:inline">Measure</span>
        </button>

        {/* Route Planner Button */}
        <button
          type="button"
          onClick={onOpenRoutePlanner}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 transition-colors"
          title="Safe Mission Route Planner"
        >
          <Navigation className="size-3.5 text-emerald-400" />
          <span className="hidden lg:inline">Route</span>
        </button>

        {/* Mission Readiness Brief */}
        {onOpenMissionBrief && (
          <button
            type="button"
            onClick={onOpenMissionBrief}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
            title="Structured Mission Readiness Brief"
          >
            <FileText className="size-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Brief</span>
          </button>
        )}

        {/* NASA Catalogue Button */}
        <button
          type="button"
          onClick={onOpenCatalogue}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 transition-colors"
          title="Searchable NASA Data Catalogue"
        >
          <Database className="size-3.5 text-amber-400" />
          <span className="hidden lg:inline">Datasets</span>
        </button>

        {/* NASA Images API Explorer */}
        <button
          type="button"
          onClick={onOpenImages}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 transition-colors"
          title="NASA Images Library API"
        >
          <Camera className="size-3.5 text-cyan-400" />
          <span className="hidden lg:inline">Images</span>
        </button>

        {/* Hugging Face AI Models Analysis */}
        {onOpenHfAi && (
          <button
            type="button"
            onClick={onOpenHfAi}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold transition-all shadow-xs"
            title="Hugging Face Mars AI Models (MOMO, Mars-Bench, SegFormer, Qwen2.5-VL)"
          >
            <BrainCircuit className="size-3.5 text-amber-400" />
            <span className="hidden sm:inline">HF Mars AI</span>
          </button>
        )}

        {/* Grounded AI Advisor */}
        <button
          type="button"
          onClick={onOpenAiAdvisor}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all"
          title="Grounded AI Mission Advisor"
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">AI Advisor</span>
        </button>

        {/* 3D Regional Lab & ML Lab quick links */}
        <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />
        <Link
          to="/mission-lab"
          className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          title="3D Regional Models Lab"
        >
          <Box className="size-3.5" />
          <span className="hidden xl:inline">3D Lab</span>
        </Link>
        <Link
          to="/ml-terrain-lab"
          className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          title="Machine Learning Terrain Lab"
        >
          <BrainCircuit className="size-3.5" />
          <span className="hidden xl:inline">ML Lab</span>
        </Link>

        {/* Mars Clock & Compass Quick Access */}
        <Link
          to="/mars-clock"
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-mono text-[11px] transition-colors"
          title="Mars Local Time Clock & 3D Compass"
        >
          <Compass className="size-3.5" />
          <span className="hidden xl:inline">Clock &amp; Compass</span>
        </Link>

        {/* Fullscreen Expansion Toggle */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white transition-colors"
            title={isFullscreen ? "Exit Fullscreen Deck" : "Expand Fullscreen Exploration Deck"}
          >
            {isFullscreen ? <Minimize2 className="size-4 text-amber-400" /> : <Maximize2 className="size-4" />}
          </button>
        )}

        {/* Toggle Right Inspector */}
        <button
          type="button"
          onClick={onToggleInspector}
          className={`p-1.5 rounded-lg border transition-colors ml-1 ${
            isInspectorOpen 
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
          }`}
          title="Toggle Target Telemetry Inspector"
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>
    </header>
  );
}
