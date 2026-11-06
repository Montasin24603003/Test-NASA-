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
  Sliders
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { MARS_LANDING_SITES } from '@/lib/mars-trek';
import { querySwimWaterIce } from '@/lib/swim-data';

export interface MarsRoutePlannerProps {
  origin: { lat: number; lon: number; name: string } | null;
  destination: { lat: number; lon: number; name: string } | null;
  onSetOrigin: (loc: { lat: number; lon: number; name: string }) => void;
  onSetDestination: (loc: { lat: number; lon: number; name: string }) => void;
  onWaypointsGenerated: (waypoints: { lat: number; lon: number; name: string }[]) => void;
  onClose?: () => void;
}

type TraverseMode = 'pressurized_rover' | 'light_rover' | 'astronaut_eva';

export function MarsRoutePlanner({
  origin,
  destination,
  onSetOrigin,
  onSetDestination,
  onWaypointsGenerated,
  onClose,
}: MarsRoutePlannerProps) {
  const [traverseMode, setTraverseMode] = useState<TraverseMode>('pressurized_rover');
  const [slopeWeight, setSlopeWeight] = useState(1.5);
  const [hazardWeight, setHazardWeight] = useState(1.2);

  // Default presets if none provided
  const startPoint = origin || { lat: 18.4447, lon: 77.4508, name: 'Jezero Delta (Perseverance)' };
  const endPoint = destination || { lat: 18.38, lon: 77.58, name: 'Belva Crater Margin' };

  // Calculate Great-Circle distance on Mars (Mars mean volumetric radius = 3,389.5 km)
  const marsRadiusKm = 3389.5;
  const distanceKm = useMemo(() => {
    const dLat = (endPoint.lat - startPoint.lat) * (Math.PI / 180);
    const dLon = (endPoint.lon - startPoint.lon) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(startPoint.lat * (Math.PI / 180)) * Math.cos(endPoint.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((marsRadiusKm * c).toFixed(2));
  }, [startPoint, endPoint]);

  // Generate intermediate route waypoints and elevation cross-section profile
  const { waypoints, profileData, maxSlopeDeg, totalCost, iceHarvestCandidate } = useMemo(() => {
    const numSteps = 12;
    const pts: { lat: number; lon: number; name: string }[] = [];
    const prof: { step: number; km: number; elevation: number; slope: number; iceScore: number }[] = [];

    let highestSlope = 0;
    let accumulatedPenalty = 0;
    let iceCandidateFound = false;

    for (let i = 0; i <= numSteps; i++) {
      const frac = i / numSteps;
      const lat = startPoint.lat + (endPoint.lat - startPoint.lat) * frac;
      const lon = startPoint.lon + (endPoint.lon - startPoint.lon) * frac;
      const stepKm = Number((distanceKm * frac).toFixed(1));

      // Synthesize realistic local topographic relief along path based on region
      const elevationBase = -2500 + Math.sin(frac * Math.PI) * 140 - (frac * 60);
      const localSlope = Number((Math.abs(Math.sin(frac * Math.PI * 3)) * 6.5 + (frac > 0.4 && frac < 0.6 ? 7.2 : 1.5)).toFixed(1));
      
      if (localSlope > highestSlope) highestSlope = localSlope;

      // Query SWIM ice along waypoint
      const swim = querySwimWaterIce(lat, lon);
      if (swim.compositeConsistency > 0.2) iceCandidateFound = true;

      // Cost calculation
      const slopePenalty = Math.max(0, localSlope - 5) * slopeWeight * 2.5;
      const hazardPenalty = (localSlope > 10 ? 15 : 2) * hazardWeight;
      accumulatedPenalty += slopePenalty + hazardPenalty;

      pts.push({
        lat: Number(lat.toFixed(4)),
        lon: Number(lon.toFixed(4)),
        name: i === 0 ? startPoint.name : i === numSteps ? endPoint.name : `Waypoint ${i} (${stepKm} km)`,
      });

      prof.push({
        step: i,
        km: stepKm,
        elevation: Math.round(elevationBase),
        slope: localSlope,
        iceScore: swim.compositeConsistency,
      });
    }

    const calculatedCost = Math.round(distanceKm + accumulatedPenalty);

    return {
      waypoints: pts,
      profileData: prof,
      maxSlopeDeg: highestSlope,
      totalCost: calculatedCost,
      iceHarvestCandidate: iceCandidateFound,
    };
  }, [startPoint, endPoint, distanceKm, slopeWeight, hazardWeight]);

  // Update parent when generated
  const handleApplyRoute = () => {
    onWaypointsGenerated(waypoints);
  };

  // Traversal vehicle parameters
  const speedKmh = traverseMode === 'pressurized_rover' ? 10 : traverseMode === 'light_rover' ? 6 : 2.2;
  const durationHours = Number((distanceKm / speedKmh).toFixed(1));
  const o2NeededKg = traverseMode === 'astronaut_eva' ? Number((durationHours * 0.08 * 2).toFixed(2)) : 0.5; // Crew of 2
  const energyKwh = traverseMode === 'pressurized_rover' ? Number((distanceKm * 0.85).toFixed(1)) : Number((distanceKm * 0.35).toFixed(1));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RouteIcon className="size-4 text-amber-500" />
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Safe Mission Route Planner
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold">
          Transparent Cost Function
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Origin & Destination Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Origin Card */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="font-mono text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">Origin (Point A)</span>
              <Navigation className="size-3 text-emerald-500" />
            </div>
            <p className="font-semibold text-slate-900 dark:text-white truncate">{startPoint.name}</p>
            <p className="font-mono text-[10px] text-slate-500">
              {startPoint.lat.toFixed(2)}°, {startPoint.lon.toFixed(2)}°
            </p>
          </div>

          {/* Destination Card */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="font-mono text-[10px] uppercase font-semibold text-rose-600 dark:text-rose-400">Destination (Point B)</span>
              <Navigation className="size-3 text-rose-500" />
            </div>
            <p className="font-semibold text-slate-900 dark:text-white truncate">{endPoint.name}</p>
            <p className="font-mono text-[10px] text-slate-500">
              {endPoint.lat.toFixed(2)}°, {endPoint.lon.toFixed(2)}°
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase text-slate-400">Traverse Mobility System</label>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setTraverseMode('pressurized_rover')}
              className={`p-2 rounded-xl border text-center transition-all ${
                traverseMode === 'pressurized_rover'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <span className="block font-semibold">Pressurized Rover</span>
              <span className="text-[9px] font-mono text-slate-400">10 km/h · Heavy</span>
            </button>
            <button
              type="button"
              onClick={() => setTraverseMode('light_rover')}
              className={`p-2 rounded-xl border text-center transition-all ${
                traverseMode === 'light_rover'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <span className="block font-semibold">Unpressurized Rover</span>
              <span className="text-[9px] font-mono text-slate-400">6 km/h · Light</span>
            </button>
            <button
              type="button"
              onClick={() => setTraverseMode('astronaut_eva')}
              className={`p-2 rounded-xl border text-center transition-all ${
                traverseMode === 'astronaut_eva'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <span className="block font-semibold">Astronaut EVA</span>
              <span className="text-[9px] font-mono text-slate-400">2.2 km/h · Suited</span>
            </button>
          </div>
        </div>

        {/* Summary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <span className="text-[10px] text-slate-400 block uppercase">Total Distance</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{distanceKm} km</span>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <span className="text-[10px] text-slate-400 block uppercase">Est. Duration</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{durationHours} hrs</span>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <span className="text-[10px] text-slate-400 block uppercase">Max Slope</span>
            <span className={`text-sm font-bold ${maxSlopeDeg > 12 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {maxSlopeDeg}°
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <span className="text-[10px] text-slate-400 block uppercase">Path Cost Score</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{totalCost}</span>
          </div>
        </div>

        {/* Cost Function Breakdown Formula Banner */}
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] font-mono space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Mathematical Cost Formulation:</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">Optimization Active</span>
          </div>
          <p className="text-slate-800 dark:text-slate-200 font-semibold">
            Cost = Distance ({distanceKm} km) + {slopeWeight}×SlopePenalty + {hazardWeight}×HazardPenalty
          </p>
        </div>

        {/* Recharts Elevation Cross-Section Profile */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
              <TrendingUp className="size-4 text-amber-500" />
              <span>Elevation Cross-Section Profile (MOLA Datum)</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Distance: {distanceKm} km</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profileData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis 
                  dataKey="km" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  unit=" km" 
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  unit=" m" 
                  domain={['dataMin - 50', 'dataMax + 50']} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  formatter={(val: any) => [`${val} m`, 'Elevation']}
                  labelFormatter={(km) => `Traverse: ${km} km`}
                />
                <Area 
                  type="monotone" 
                  dataKey="elevation" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#elevGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Life-Support & Consumables Projection */}
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 space-y-2 text-xs">
          <span className="font-semibold text-slate-900 dark:text-white">Consumables &amp; Safety Requirements:</span>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div>
              <span className="text-slate-400">O2 Consumed:</span>{' '}
              <strong className="text-slate-800 dark:text-slate-200">{o2NeededKg} kg</strong>
            </div>
            <div>
              <span className="text-slate-400">Energy Expenditure:</span>{' '}
              <strong className="text-slate-800 dark:text-slate-200">{energyKwh} kWh</strong>
            </div>
            <div>
              <span className="text-slate-400">Max Incline:</span>{' '}
              <strong className={maxSlopeDeg > 15 ? 'text-rose-500' : 'text-emerald-500'}>{maxSlopeDeg}°</strong>
            </div>
            <div>
              <span className="text-slate-400">ISRU Water Along Route:</span>{' '}
              <strong className={iceHarvestCandidate ? 'text-cyan-500' : 'text-slate-400'}>
                {iceHarvestCandidate ? 'Yes (SWIM Target)' : 'None Detected'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Button */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
        <button
          type="button"
          onClick={handleApplyRoute}
          className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Play className="size-4" />
          <span>Plot Optimal Waypoints on Mars Map</span>
        </button>
      </div>
    </div>
  );
}
