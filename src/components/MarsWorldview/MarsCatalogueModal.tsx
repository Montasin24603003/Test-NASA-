import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  X, 
  ExternalLink, 
  CheckCircle2, 
  Layers, 
  Filter, 
  Mountain, 
  ShieldAlert, 
  Droplets, 
  Globe2, 
  MapPin,
  Calendar,
  Eye
} from 'lucide-react';
import { 
  MARS_SCIENTIFIC_LAYERS, 
  type MarsScientificLayer, 
  type LayerGroupType 
} from '@/lib/mars-trek';

export interface MarsCatalogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLayers: Record<string, { visible: boolean; opacity: number }>;
  onActivateLayer: (layerId: string) => void;
  onFlyToRegion?: (loc: { lat: number; lon: number; name: string }) => void;
}

export function MarsCatalogueModal({
  isOpen,
  onClose,
  activeLayers,
  onActivateLayer,
  onFlyToRegion,
}: MarsCatalogueModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedLayer, setSelectedLayer] = useState<MarsScientificLayer>(MARS_SCIENTIFIC_LAYERS[0]!);

  if (!isOpen) return null;

  const filteredLayers = MARS_SCIENTIFIC_LAYERS.filter((layer) => {
    const matchesGroup = selectedGroup === 'all' || layer.group === selectedGroup;
    const matchesSearch =
      searchQuery === '' ||
      layer.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      layer.instrument.toLowerCase().includes(searchQuery.toLowerCase()) ||
      layer.spacecraft.toLowerCase().includes(searchQuery.toLowerCase()) ||
      layer.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  const isLayerActive = (id: string) => activeLayers[id]?.visible;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#090e17] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0d1422]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Database className="size-5" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                NASA Planetary Data Catalogue
              </h3>
              <p className="font-mono text-[10px] text-slate-400">
                Searchable planetary datasets connected directly to the Mars exploration map
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="p-3 border-b border-slate-800 bg-[#070b12] flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 size-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search dataset, mission, instrument (MOLA, CRISM, THEMIS, SWIM)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-[10px] font-mono whitespace-nowrap">
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'terrain', label: 'Terrain' },
              { id: 'hazards', label: 'Hazards' },
              { id: 'resources', label: 'Resources' },
              { id: 'geology', label: 'Geology' },
              { id: 'mission_data', label: 'Missions' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedGroup(cat.id)}
                className={`px-2.5 py-1.5 rounded-lg border transition-all ${
                  selectedGroup === cat.id
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-bold'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Split Body: Catalogue List (Left) | Detailed Metadata & Map Trigger (Right) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: Dataset List */}
          <div className="md:col-span-5 border-r border-slate-800 overflow-y-auto p-2.5 space-y-1.5">
            {filteredLayers.map((layer) => {
              const active = isLayerActive(layer.id);
              const isSelected = selectedLayer.id === layer.id;

              return (
                <div
                  key={layer.id}
                  onClick={() => setSelectedLayer(layer)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-950/20 text-slate-100 ring-1 ring-amber-500/50'
                      : 'border-slate-800/80 bg-slate-950/50 hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold truncate">{layer.shortTitle}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                      active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}>
                      {active ? 'ACTIVE ON MAP' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                    {layer.instrument} &middot; {layer.spacecraft}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-slate-500">
                    <span>{layer.resolution}</span>
                    <span className="text-amber-400">{layer.confidence}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Dataset Scientific Inspector */}
          <div className="md:col-span-7 overflow-y-auto p-5 flex flex-col justify-between space-y-4 bg-[#090e17]">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
                    {selectedLayer.group.replace('_', ' ')}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    Tier: {selectedLayer.tier.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <h3 className="font-sans text-lg font-bold text-slate-100 mt-2">
                  {selectedLayer.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-2">
                  {selectedLayer.description}
                </p>
              </div>

              {/* Technical Specifications Grid */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Instrument</span>
                  <span className="text-slate-200 font-semibold">{selectedLayer.instrument}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Spacecraft / Mission</span>
                  <span className="text-slate-200 font-semibold">{selectedLayer.spacecraft}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Spatial Resolution</span>
                  <span className="text-slate-200 font-semibold">{selectedLayer.resolution}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Acquisition Era</span>
                  <span className="text-slate-200 font-semibold">{selectedLayer.acquisitionDate}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 text-[10px] block uppercase">Spatial Coverage</span>
                  <span className="text-slate-200 font-semibold">{selectedLayer.spatialCoverage}</span>
                </div>
              </div>

              {/* Scientific Limitations & Confidence */}
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs font-mono space-y-1">
                <span className="text-amber-400 font-bold block text-[11px] uppercase">
                  Scientific Caveats &amp; Limitations:
                </span>
                <p className="text-amber-200 text-[11px] leading-relaxed">
                  {selectedLayer.limitations}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
                <span>Credit: {selectedLayer.credit}</span>
                <a
                  href={selectedLayer.officialDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-amber-400 hover:underline"
                >
                  <span>Official NASA Documentation</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  onActivateLayer(selectedLayer.id);
                  onClose();
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isLayerActive(selectedLayer.id)
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                }`}
              >
                <Eye className="size-4" />
                <span>{isLayerActive(selectedLayer.id) ? 'Deactivate Layer on Map' : 'Activate as Map Layer'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-mono font-semibold"
              >
                Back to Map
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
