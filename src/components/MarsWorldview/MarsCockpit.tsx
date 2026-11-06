import React, { useState, useCallback } from 'react';
import { MarsWorldviewMap, type RouteWaypoint, type MeasurePoint } from './MarsWorldviewMap';
import { MarsLayerManager } from './MarsLayerManager';
import { MarsLocationInspector } from './MarsLocationInspector';
import { MarsScientificBottomBar } from './MarsScientificBottomBar';
import { MarsRegionalBar } from './MarsRegionalBar';
import { MarsRoutePlanner } from './MarsRoutePlanner';
import { NasaImagesModal } from './NasaImagesModal';
import { MarsAiAdvisorModal } from './MarsAiAdvisorModal';
import { MarsCatalogueModal } from './MarsCatalogueModal';
import { MarsTopToolbar } from './MarsTopToolbar';
import { HfAiAnalysisPanel } from '@/components/HfAiAnalysis/HfAiAnalysisPanel';
import { BrainCircuit, X } from 'lucide-react';
import { 
  MARS_SCIENTIFIC_LAYERS, 
  MARS_REGIONAL_PROFILES, 
  type MarsScientificLayer, 
  type MarsRegionProfile 
} from '@/lib/mars-trek';
import type { SwimAssessment } from '@/lib/swim-data';

export interface MarsCockpitProps {
  embedded?: boolean;
  className?: string;
  initialFullscreen?: boolean;
}

export function MarsCockpit({ embedded = false, className, initialFullscreen = false }: MarsCockpitProps = {}) {
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  // 1. Layer state for Mars Trek WMTS Base Layers & Scientific Overlays
  const [activeLayers, setActiveLayers] = useState<Record<string, { visible: boolean; opacity: number }>>(() => {
    const initial: Record<string, { visible: boolean; opacity: number }> = {};
    MARS_SCIENTIFIC_LAYERS.forEach((l) => {
      initial[l.id] = { visible: l.defaultVisible, opacity: l.defaultOpacity };
    });
    return initial;
  });

  // 2. SWIM Subsurface Water Ice Depth Horizon Filter
  const [swimDepthFilter, setSwimDepthFilter] = useState<'all' | '0-1m' | '1-5m' | '>5m'>('all');

  // 3. Selected Target Coordinates Telemetry
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
    name?: string;
    elevationM?: number;
  }>({
    lat: 18.4447,
    lon: 77.4508,
    name: 'Jezero Crater (Perseverance Site)',
    elevationM: -2560,
  });

  // 4. Panel Visibility Toggles (Collapsible Sidebars)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'layers' | 'regions'>('layers');

  // 5. Scientific Tools State
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementResult, setMeasurementResult] = useState<{
    distanceKm: number;
    start: MeasurePoint;
    end: MeasurePoint;
  } | null>(null);

  // 6. Mission Timeline Sol
  const [currentSol, setCurrentSol] = useState(145);

  // 7. Route Planner & Modals
  const [routeWaypoints, setRouteWaypoints] = useState<RouteWaypoint[]>([]);
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [isRoutePlannerOpen, setIsRoutePlannerOpen] = useState(false);
  const [isCatalogueOpen, setIsCatalogueOpen] = useState(false);
  const [isImagesModalOpen, setIsImagesModalOpen] = useState(false);
  const [isAiAdvisorOpen, setIsAiAdvisorOpen] = useState(false);
  const [isHfAiOpen, setIsHfAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState<{
    lat: number;
    lon: number;
    name: string;
    elevationM: number;
    swim: SwimAssessment;
  } | null>(null);

  const [routeOrigin, setRouteOrigin] = useState<{ lat: number; lon: number; name: string }>({
    lat: 18.4447,
    lon: 77.4508,
    name: 'Jezero Delta (Perseverance)',
  });
  const [routeDestination, setRouteDestination] = useState<{ lat: number; lon: number; name: string }>({
    lat: 18.38,
    lon: 77.58,
    name: 'Belva Crater Margin',
  });

  // Toggle layer visibility
  const handleToggleLayer = useCallback((layerId: string) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layerId]: {
        visible: !prev[layerId]?.visible,
        opacity: prev[layerId]?.opacity ?? 1.0,
      },
    }));
  }, []);

  // Change layer opacity
  const handleChangeOpacity = useCallback((layerId: string, opacity: number) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layerId]: {
        visible: prev[layerId]?.visible ?? true,
        opacity,
      },
    }));
  }, []);

  // Handle fly-to region
  const handleSelectRegion = (region: MarsRegionProfile) => {
    setSelectedLocation({
      lat: region.center[0],
      lon: region.center[1],
      name: region.name,
      elevationM: region.elevationMeters,
    });
  };

  // Measurement completed callback
  const handleMeasureComplete = (result: { distanceKm: number; start: MeasurePoint; end: MeasurePoint }) => {
    setMeasurementResult(result);
  };

  // Open AI Advisor with Context
  const handleOpenAiAdvisor = (ctx: {
    lat: number;
    lon: number;
    name: string;
    elevationM: number;
    swim: SwimAssessment;
  }) => {
    setAiContext(ctx);
    setIsAiAdvisorOpen(true);
  };

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-[#05080f] text-slate-200 overflow-hidden font-sans"
    : embedded
    ? `w-full h-[760px] lg:h-[820px] rounded-3xl border border-slate-800 shadow-2xl flex flex-col bg-[#05080f] text-slate-200 overflow-hidden font-sans relative ${className || ''}`
    : `w-full h-screen max-h-screen flex flex-col bg-[#05080f] text-slate-200 overflow-hidden font-sans ${className || ''}`;

  return (
    <div className={containerClasses}>
      {/* 1. TOP SCIENTIFIC TOOLBAR */}
      <MarsTopToolbar
        onSearchCoordinate={(coord) => setSelectedLocation(coord)}
        isMeasuring={isMeasuring}
        onToggleMeasure={() => setIsMeasuring(!isMeasuring)}
        onOpenRoutePlanner={() => setIsRoutePlannerOpen(true)}
        onOpenCatalogue={() => setIsCatalogueOpen(true)}
        onOpenImages={() => setIsImagesModalOpen(true)}
        onOpenAiAdvisor={() => {
          setAiContext(null);
          setIsAiAdvisorOpen(true);
        }}
        onOpenHfAi={() => setIsHfAiOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
      />

      {/* 2. MAIN 3-PANEL EXPLORATION WORKSPACE (75-85% VIEWPORT FOR MAP) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLLAPSIBLE SIDEBAR: DATA LAYERS & REGIONS */}
        {isSidebarOpen && (
          <aside className="w-72 sm:w-80 md:w-88 h-full flex flex-col z-20 shrink-0">
            {/* Sidebar Tab Switcher */}
            <div className="flex border-b border-slate-800 bg-[#070b12] text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('layers')}
                className={`flex-1 py-2 text-center uppercase tracking-wider font-bold transition-colors ${
                  activeTab === 'layers'
                    ? 'bg-[#090e17] text-amber-400 border-b-2 border-amber-500'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Data Layers
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('regions')}
                className={`flex-1 py-2 text-center uppercase tracking-wider font-bold transition-colors ${
                  activeTab === 'regions'
                    ? 'bg-[#090e17] text-amber-400 border-b-2 border-amber-500'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Mars Regions (7)
              </button>
            </div>

            {/* Sidebar View Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'layers' ? (
                <MarsLayerManager
                  activeLayers={activeLayers}
                  onToggleLayer={handleToggleLayer}
                  onChangeOpacity={handleChangeOpacity}
                  swimDepthFilter={swimDepthFilter}
                  onChangeSwimDepthFilter={setSwimDepthFilter}
                  onSelectSearchLocation={(loc) => setSelectedLocation(loc)}
                />
              ) : (
                <div className="h-full overflow-y-auto p-3 space-y-2.5 bg-[#090e17]">
                  <p className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                    Select Region to Fly-To &amp; Inspect Geology
                  </p>
                  {MARS_REGIONAL_PROFILES.map((region) => (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => handleSelectRegion(region)}
                      className="w-full p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-amber-500/40 text-left transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-100">{region.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-400">
                          {region.elevationMeters >= 0 ? `+${(region.elevationMeters / 1000).toFixed(1)}k` : `${(region.elevationMeters / 1000).toFixed(1)}k m`}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{region.tagline}</p>
                      <p className="text-[9px] text-slate-500 mt-1.5 font-mono line-clamp-2 leading-relaxed">
                        {region.geologySummary}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* CENTER VIEWPORT: INTERACTIVE 2D / 3D MARS GLOBE (75-85% SCREEN AREA) */}
        <main className="flex-1 h-full relative overflow-hidden flex flex-col">
          <MarsWorldviewMap
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocation}
            activeLayers={activeLayers}
            swimDepthFilter={swimDepthFilter}
            isMeasuring={isMeasuring}
            onMeasureComplete={handleMeasureComplete}
            routeWaypoints={routeWaypoints}
            onWaypointAdd={(wp) => setRouteWaypoints((prev) => [...prev, wp])}
            isRoutingMode={isRoutingMode}
            className="flex-1 w-full h-full"
          />

          {/* Measurement Floating Results Banner (if measured) */}
          {measurementResult && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-amber-500/50 rounded-xl px-4 py-2.5 shadow-2xl backdrop-blur-md flex items-center gap-4 text-xs font-mono">
              <span className="text-amber-400 font-bold">MEASURED DISTANCE:</span>
              <span className="text-white font-bold text-sm">{measurementResult.distanceKm.toLocaleString()} km</span>
              <button
                type="button"
                onClick={() => setMeasurementResult(null)}
                className="text-[10px] text-slate-400 hover:text-white underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}
        </main>

        {/* RIGHT COLLAPSIBLE SIDEBAR: TELEMETRY INSPECTOR & SCIENTIFIC HAZARDS */}
        {isInspectorOpen && (
          <aside className="w-72 sm:w-80 md:w-88 h-full z-20 shrink-0">
            <MarsLocationInspector
              location={selectedLocation}
              onSetRouteOrigin={(loc) => {
                setRouteOrigin(loc);
                setIsRoutePlannerOpen(true);
              }}
              onSetRouteDestination={(loc) => {
                setRouteDestination(loc);
                setIsRoutePlannerOpen(true);
              }}
              onOpenAiAdvisor={handleOpenAiAdvisor}
            />
          </aside>
        )}
      </div>

      {/* 3. SCIENTIFIC BOTTOM PANEL (SCALE, COORDINATES, TIMELINE, ATTRIBUTION) */}
      <MarsScientificBottomBar
        selectedSol={currentSol}
        onSelectSol={setCurrentSol}
        selectedCoordinates={selectedLocation}
        zoomLevel={2}
      />

      {/* MODALS */}
      {/* 1. Safe Mission Route Planner Modal */}
      {isRoutePlannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[90vh]">
            <MarsRoutePlanner
              origin={routeOrigin}
              destination={routeDestination}
              onSetOrigin={setRouteOrigin}
              onSetDestination={setRouteDestination}
              onWaypointsGenerated={(pts) => {
                setRouteWaypoints(pts);
                setIsRoutePlannerOpen(false);
              }}
              onClose={() => setIsRoutePlannerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 2. NASA Planetary Data Catalogue Modal */}
      <MarsCatalogueModal
        isOpen={isCatalogueOpen}
        onClose={() => setIsCatalogueOpen(false)}
        activeLayers={activeLayers}
        onActivateLayer={(layerId) => handleToggleLayer(layerId)}
      />

      {/* 3. NASA Images & Video Library Explorer Modal */}
      <NasaImagesModal
        isOpen={isImagesModalOpen}
        onClose={() => setIsImagesModalOpen(false)}
      />

      {/* 4. Grounded AI Mission Advisor Modal */}
      <MarsAiAdvisorModal
        isOpen={isAiAdvisorOpen}
        onClose={() => setIsAiAdvisorOpen(false)}
        context={aiContext}
      />

      {/* 5. Hugging Face Mars AI Analysis Modal */}
      {isHfAiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl text-slate-200 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="size-5 text-amber-400" />
                <h2 className="text-base font-bold font-mono text-white">
                  Hugging Face Mars AI Model Analysis
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300">
                  Target: {selectedLocation.name || `${selectedLocation.lat.toFixed(2)}°, ${selectedLocation.lon.toFixed(2)}°`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHfAiOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close AI Analysis"
              >
                <X className="size-5" />
              </button>
            </div>

            <HfAiAnalysisPanel
              onSelectCoordinates={(lat, lon, name) => {
                setSelectedLocation({ lat, lon, name });
                setIsHfAiOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
