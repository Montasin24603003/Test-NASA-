import React, { useState, useMemo } from 'react';
import { 
  Navigation, 
  Route as RouteIcon, 
  Clock, 
  ShieldAlert, 
  Mountain, 
  Droplets, 
  Zap, 
  Play, 
  RotateCcw, 
  ChevronRight, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders,
  FileText,
  User,
  Truck
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { planMultiObjectiveRoutes, type RouteAlternative, type MultiRoutePlanResult } from '@/lib/mars-pathfinder';
import type { TraverseMobilityMode } from '@/lib/mars-meri';

export interface MarsRoutePlannerProps {
  origin: { lat: number; lon: number; name: string } | null;
  destination: { lat: number; lon: number; name: string } | null;
  onSetOrigin: (loc: { lat: number; lon: number; name: string }) => void;
  onSetDestination: (loc: { lat: number; lon: number; name: string }) => void;
  onWaypointsGenerated: (waypoints: { lat: number; lon: number; name: string }[]) => void;
  onOpenMissionBrief?: (planResult: MultiRoutePlanResult, selectedRouteId: 'safest' | 'fastest' | 'science') => void;
  onClose?: () => void;
}

export function MarsRoutePlanner({
  origin,
  destination,
  onSetOrigin,
  onSetDestination,
  onWaypointsGenerated,
  onOpenMissionBrief,
  onClose,
}: MarsRoutePlannerProps) {
  const [traverseMode, setTraverseMode] = useState<TraverseMobilityMode>('pressurized_rover');
  const [selectedRouteId, setSelectedRouteId] = useState<'safest' | 'fastest' | 'science'>('safest');

  // Default coordinates if none provided
  const startPoint = origin || { lat: 18.4447, lon: 77.4508, name: 'Jezero Delta (Perseverance)' };
  const endPoint = destination || { lat: 18.38, lon: 77.58, name: 'Belva Crater Margin' };

  // Run the multi-objective graph pathfinder
  const planResult: MultiRoutePlanResult = useMemo(() => {
    return planMultiObjectiveRoutes(startPoint, endPoint, traverseMode);
  }, [startPoint, endPoint, traverseMode]);

  const activeRoute: RouteAlternative = planResult.routes[selectedRouteId];

  // Elevation profile data for Recharts
  const profileData = useMemo(() => {
    return activeRoute.waypoints.map((wp, idx) => ({
      step: idx,
      km: wp.distanceFromStartKm,
      elevation: wp.elevationM,
      slope: wp.slopeDeg,
      meri: wp.meriScore,
      name: wp.name,
    }));
  }, [activeRoute]);

  const handleApplyRoute = () => {
    onWaypointsGenerated(activeRoute.waypoints.map((w) => ({
      lat: w.lat,
      lon: w.lon,
      name: w.name,
    })));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 font-sans">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080d17] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <RouteIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Multi-Objective Route Pathfinder
            </h3>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              A* &middot; Dijkstra Graph Optimization with MOLA Elevation &amp; MERI Risk
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenMissionBrief && (
            <button
              type="button"
              onClick={() => onOpenMissionBrief(planResult, selectedRouteId)}
              className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <FileText className="size-3.5" />
              <span className="hidden sm:inline">Mission Brief</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono text-slate-400 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        {/* Origin & Destination Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-bold text-emerald-500">Origin (Point A)</span>
              <Navigation className="size-3.5 text-emerald-500" />
            </div>
            <p className="font-bold text-slate-900 dark:text-white truncate">{startPoint.name}</p>
            <p className="font-mono text-[10px] text-slate-500">
              {startPoint.lat.toFixed(3)}°, {startPoint.lon.toFixed(3)}°
            </p>
          </div>

          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-bold text-rose-500">Destination (Point B)</span>
              <Navigation className="size-3.5 text-rose-500" />
            </div>
            <p className="font-bold text-slate-900 dark:text-white truncate">{endPoint.name}</p>
            <p className="font-mono text-[10px] text-slate-500">
              {endPoint.lat.toFixed(3)}°, {endPoint.lon.toFixed(3)}°
            </p>
          </div>
        </div>

        {/* Traverse Mode Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
            Traverse Mobility System (Determines Slope Envelope &amp; Speed)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTraverseMode('pressurized_rover')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                traverseMode === 'pressurized_rover'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Truck className="size-3.5" />
                <span>Pressurized Rover</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">9.5 km/h &middot; Max 20° Slope</span>
            </button>

            <button
              type="button"
              onClick={() => setTraverseMode('robotic_rover')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                traverseMode === 'robotic_rover'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Navigation className="size-3.5" />
                <span>Robotic Rover</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">5.5 km/h &middot; Rocker-Bogie</span>
            </button>

            <button
              type="button"
              onClick={() => setTraverseMode('astronaut_eva')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                traverseMode === 'astronaut_eva'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold ring-1 ring-amber-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <User className="size-3.5" />
                <span>Astronaut EVA</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">2.2 km/h &middot; Strict 14° Limit</span>
            </button>
          </div>
        </div>

        {/* 3 Distinct Route Alternatives Tabs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Generated Route Alternatives (Select to Inspect &amp; Compare)
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Straight Line: {planResult.straightLineDistanceKm} km
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['safest', 'fastest', 'science'] as const).map((rId) => {
              const r = planResult.routes[rId];
              const isSelected = selectedRouteId === rId;
              return (
                <button
                  key={rId}
                  type="button"
                  onClick={() => setSelectedRouteId(rId)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-sm ring-1 ring-amber-500'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs" style={{ color: r.colorHex }}>{r.title}</span>
                    {isSelected && <CheckCircle2 className="size-3.5 text-amber-500" />}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2 font-mono text-xs">
                    <strong className="text-slate-900 dark:text-white">{r.distanceKm} km</strong>
                    <span className="text-slate-500 text-[11px]">{r.durationHours} hrs</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Max: {r.maxSlopeDeg}°</span>
                    <span>MERI: {r.meanMeriScore}/100</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Route Rationale & Return Feasibility */}
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-900 dark:text-white text-xs">
              Algorithmic Selection Rationale:
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Return Feasibility: {activeRoute.returnRouteFeasibility}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
            {activeRoute.recommendationRationale}
          </p>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-600 dark:text-amber-400">
            <strong>Turn-Back Condition:</strong> {activeRoute.turnBackCondition}
          </div>
        </div>

        {/* Recharts Elevation Cross-Section Profile (Real MOLA Datum) */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white font-mono">
              <TrendingUp className="size-4 text-amber-500" />
              <span>Topographic Cross-Section Profile (MOLA Laser Elevation)</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {activeRoute.waypoints.length} Waypoints &middot; +{activeRoute.elevationGainM}m / -{activeRoute.elevationLossM}m
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profileData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="routeElevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeRoute.colorHex} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={activeRoute.colorHex} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis 
                  dataKey="km" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  unit=" km" 
                />
                <YAxis 
                  dataKey="elevation" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  unit=" m" 
                  domain={['dataMin - 40', 'dataMax + 40']} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  formatter={(val: any, name: any) => [
                    name === 'elevation' ? `${val} m MOLA` : val, 
                    name === 'elevation' ? 'Elevation' : name
                  ]}
                  labelFormatter={(km) => `Traverse Distance: ${km} km`}
                />
                <Area 
                  type="monotone" 
                  dataKey="elevation" 
                  stroke={activeRoute.colorHex} 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#routeElevGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consumables & Bioenergetics Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <span className="text-slate-400 text-[10px] uppercase block">Energy Required</span>
            <strong className="text-slate-900 dark:text-white text-sm">{activeRoute.energyKwh} kWh</strong>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <span className="text-slate-400 text-[10px] uppercase block">Max Incline</span>
            <strong className={`text-sm ${activeRoute.maxSlopeDeg > 14 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {activeRoute.maxSlopeDeg}°
            </strong>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <span className="text-slate-400 text-[10px] uppercase block">ISRU Water Index</span>
            <strong className="text-cyan-500 text-sm">{activeRoute.waterIceAccessScore}/100</strong>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <span className="text-slate-400 text-[10px] uppercase block">Science Target Yield</span>
            <strong className="text-indigo-400 text-sm">{activeRoute.scienceTargetScore}/100</strong>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080d17] flex items-center justify-between gap-3">
        {onOpenMissionBrief && (
          <button
            type="button"
            onClick={() => onOpenMissionBrief(planResult, selectedRouteId)}
            className="py-2.5 px-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-display font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            title="Generate NASA Mission Readiness Brief"
          >
            <FileText className="size-4 text-emerald-400" />
            <span className="hidden sm:inline">Mission Brief</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleApplyRoute}
          className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Play className="size-4" />
          <span>Apply {activeRoute.title} to Planetary Map</span>
        </button>
      </div>
    </div>
  );
}
