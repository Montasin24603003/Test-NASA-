import React, { useState } from 'react';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Sliders, 
  Info, 
  Search, 
  Mountain, 
  ShieldAlert, 
  Droplets, 
  Compass, 
  MapPin, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity,
  Globe2,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { 
  MARS_SCIENTIFIC_LAYERS, 
  type MarsScientificLayer, 
  type LayerGroupType 
} from '@/lib/mars-trek';
import { MARS_LOCATIONS } from '@/lib/mars-locations';

export interface MarsLayerManagerProps {
  activeLayers: Record<string, { visible: boolean; opacity: number }>;
  onToggleLayer: (layerId: string) => void;
  onChangeOpacity: (layerId: string, opacity: number) => void;
  swimDepthFilter: 'all' | '0-1m' | '1-5m' | '>5m';
  onChangeSwimDepthFilter: (filter: 'all' | '0-1m' | '1-5m' | '>5m') => void;
  onSelectSearchLocation: (loc: { lat: number; lon: number; name: string }) => void;
}

export function MarsLayerManager({
  activeLayers,
  onToggleLayer,
  onChangeOpacity,
  swimDepthFilter,
  onChangeSwimDepthFilter,
  onSelectSearchLocation,
}: MarsLayerManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLayerForInfo, setSelectedLayerForInfo] = useState<MarsScientificLayer | null>(null);
  
  // Accordion state for the 5 layer groups
  const [expandedGroups, setExpandedGroups] = useState<Record<LayerGroupType, boolean>>({
    terrain: true,
    hazards: true,
    resources: true,
    geology: false,
    mission_data: true,
  });

  const toggleGroup = (group: LayerGroupType) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const searchResults = searchQuery.trim().length > 1
    ? MARS_LOCATIONS.filter((loc) => 
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.region.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  const groupTitles: Record<LayerGroupType, { label: string; icon: typeof Mountain; color: string }> = {
    terrain: { label: 'Terrain & Topography', icon: Mountain, color: 'text-amber-500' },
    hazards: { label: 'Scientific Hazard Analysis', icon: ShieldAlert, color: 'text-rose-500' },
    resources: { label: 'Resource Explorer & Water Ice', icon: Droplets, color: 'text-cyan-500' },
    geology: { label: 'Geological Formations', icon: Globe2, color: 'text-orange-500' },
    mission_data: { label: 'Mission Data & Landing Sites', icon: MapPin, color: 'text-emerald-500' },
  };

  const tierBadges = {
    measured_observation: { text: 'OBSERVATION', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    derived_analysis: { text: 'DERIVED ANALYSIS', bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    simulated_estimate: { text: 'SIMULATED MODEL', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  };

  return (
    <div className="flex flex-col h-full bg-[#090e17] border-r border-slate-800 text-slate-200 select-none overflow-hidden">
      {/* Top Header & Search */}
      <div className="p-3.5 border-b border-slate-800 bg-[#0d1422]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-amber-500" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-100">
              Scientific Layers
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            NASA Mars Trek WMTS
          </span>
        </div>

        {/* Search Mars Features */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 size-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search crater, volcano, rover..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-900/90 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
              {searchResults.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => {
                    onSelectSearchLocation({ lat: res.latitude, lon: res.longitude, name: res.name });
                    setSearchQuery('');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-800 text-xs transition-colors border-b last:border-b-0 border-slate-800"
                >
                  <div>
                    <p className="font-semibold text-slate-200">{res.name}</p>
                    <p className="text-[10px] text-slate-400">{res.region}</p>
                  </div>
                  <span className="font-mono text-[10px] text-amber-400">
                    {res.latitude.toFixed(1)}°, {res.longitude.toFixed(1)}°
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Layer Groups Accordion List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {(['terrain', 'hazards', 'resources', 'geology', 'mission_data'] as LayerGroupType[]).map((groupKey) => {
          const groupMeta = groupTitles[groupKey];
          const Icon = groupMeta.icon;
          const isExpanded = expandedGroups[groupKey];
          const layersInGroup = MARS_SCIENTIFIC_LAYERS.filter((l) => l.group === groupKey);

          return (
            <div key={groupKey} className="border border-slate-800/90 rounded-xl overflow-hidden bg-slate-950/40">
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                className="w-full px-3 py-2 flex items-center justify-between bg-slate-900/70 hover:bg-slate-850 transition-colors text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`size-3.5 ${groupMeta.color}`} />
                  <span className="font-mono uppercase text-[11px] text-slate-300">{groupMeta.label}</span>
                </div>
                {isExpanded ? <ChevronUp className="size-3.5 text-slate-500" /> : <ChevronDown className="size-3.5 text-slate-500" />}
              </button>

              {isExpanded && (
                <div className="p-2 space-y-2">
                  {layersInGroup.map((layer) => {
                    const state = activeLayers[layer.id] || { visible: layer.defaultVisible, opacity: layer.defaultOpacity };
                    const tierMeta = tierBadges[layer.tier];

                    return (
                      <div 
                        key={layer.id}
                        className={`p-2 rounded-lg border transition-all ${
                          state.visible 
                            ? 'border-amber-500/40 bg-amber-950/20' 
                            : 'border-slate-850 bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => onToggleLayer(layer.id)}
                              className={`p-1 rounded transition-colors ${
                                state.visible ? 'text-amber-400 bg-amber-500/20' : 'text-slate-500 hover:text-slate-300'
                              }`}
                              title={state.visible ? 'Hide Layer' : 'Show Layer'}
                            >
                              {state.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                            </button>
                            <div className="truncate">
                              <p className="text-xs font-medium text-slate-200 truncate">{layer.shortTitle}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[8px] font-mono px-1 py-0.2 rounded border ${tierMeta.bg}`}>
                                  {tierMeta.text}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 truncate">
                                  {layer.instrument.split('(')[0]}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedLayerForInfo(layer)}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                            title="Scientific Metadata & Citations"
                          >
                            <Info className="size-3.5" />
                          </button>
                        </div>

                        {/* Special controls for SWIM Water Ice layer */}
                        {layer.id === 'resource-swim-ice' && state.visible && (
                          <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                            <span className="text-[9px] font-mono uppercase text-slate-400 block">
                              Depth Horizon Filter (SWIM 2.0)
                            </span>
                            <div className="grid grid-cols-2 gap-1 text-[9px] font-mono">
                              {(['all', '0-1m', '1-5m', '>5m'] as const).map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => onChangeSwimDepthFilter(d)}
                                  className={`py-1 px-1.5 rounded border text-center transition-all ${
                                    swimDepthFilter === d
                                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold'
                                      : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  {d === 'all' ? 'All Horizons' : d === '0-1m' ? '0–1m (Excavation)' : d === '1-5m' ? '1–5m (Trenching)' : '>5m (Glacial Core)'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Opacity Slider */}
                        {state.visible && (
                          <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center gap-2">
                            <span className="text-[9px] font-mono text-slate-500 uppercase">Opacity</span>
                            <input
                              type="range"
                              min="0.1"
                              max="1.0"
                              step="0.05"
                              value={state.opacity}
                              onChange={(e) => onChangeOpacity(layer.id, parseFloat(e.target.value))}
                              className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                            />
                            <span className="text-[9px] font-mono text-slate-400 w-6 text-right">
                              {Math.round(state.opacity * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer Scientific Metadata Modal Drawer */}
      {selectedLayerForInfo && (
        <div className="p-3.5 border-t border-slate-800 bg-[#0d1422] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-100 truncate pr-2 font-mono text-[11px]">
              {selectedLayerForInfo.title}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedLayerForInfo(null)}
              className="text-slate-400 hover:text-white text-xs font-mono"
            >
              Close
            </button>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {selectedLayerForInfo.description}
          </p>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1 text-[10px] font-mono text-slate-400">
            <div><span className="text-slate-300 font-semibold">Instrument:</span> {selectedLayerForInfo.instrument}</div>
            <div><span className="text-slate-300 font-semibold">Spacecraft:</span> {selectedLayerForInfo.spacecraft}</div>
            <div><span className="text-slate-300 font-semibold">Resolution:</span> {selectedLayerForInfo.resolution}</div>
            <div><span className="text-slate-300 font-semibold">Date Acquired:</span> {selectedLayerForInfo.acquisitionDate}</div>
            <div><span className="text-slate-300 font-semibold">Scientific Quality:</span> {selectedLayerForInfo.confidence}</div>
          </div>
          <div className="p-2 rounded bg-amber-950/20 border border-amber-500/20 text-[10px] text-amber-200">
            <span className="font-semibold block text-amber-400">Scientific Limitations:</span>
            {selectedLayerForInfo.limitations}
          </div>
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[9px] text-slate-500 italic">{selectedLayerForInfo.credit}</span>
            <a
              href={selectedLayerForInfo.officialDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:underline font-mono"
            >
              <span>NASA Docs</span>
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
