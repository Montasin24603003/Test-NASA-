import React, { useMemo, useState } from 'react';
import { 
  MapPin, 
  Mountain, 
  Droplets, 
  ShieldAlert, 
  Thermometer, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Wind,
  Radio,
  Sun,
  Activity,
  Layers,
  Crosshair,
  User,
  Truck,
  FileText
} from 'lucide-react';
import { querySwimWaterIce, type SwimAssessment } from '@/lib/swim-data';
import { MARS_LANDING_SITES } from '@/lib/mars-trek';
import { getMarsTopography, type MarsElevationProfile } from '@/lib/mars-dem-engine';
import { evaluateMarsHazards, type DualTerrainHazardResult } from '@/lib/mars-hazard-engine';
import { calculateMeri, type MeriAssessmentResult } from '@/lib/mars-meri';
import { getMarsAtmosphericPressure, getMarsDustOpacity, getMarsDiurnalThermal, getMarsRadiationDose, getMarsEnergyAndComms } from '@/lib/mars-environment';

export interface MarsLocationInspectorProps {
  location: { lat: number; lon: number; name?: string; elevationM?: number } | null;
  onSetRouteOrigin?: (loc: { lat: number; lon: number; name: string }) => void;
  onSetRouteDestination?: (loc: { lat: number; lon: number; name: string }) => void;
  onOpenAiAdvisor?: (context: {
    lat: number;
    lon: number;
    name: string;
    elevationM: number;
    slopeDeg: number;
    roughnessM: number;
    terrainClassification: string;
    roverStatus: string;
    roverScore: number;
    evaStatus: string;
    evaScore: number;
    meriScore: number;
    meriClassification: string;
    swim: SwimAssessment;
  }) => void;
  onOpenMissionBrief?: () => void;
}

export function MarsLocationInspector({
  location,
  onSetRouteOrigin,
  onSetRouteDestination,
  onOpenAiAdvisor,
  onOpenMissionBrief,
}: MarsLocationInspectorProps) {
  const [activeHazardTab, setActiveHazardTab] = useState<'rover' | 'eva'>('rover');

  const activeLoc = useMemo(() => {
    return location || { lat: 18.4447, lon: 77.4508, name: 'Jezero Crater (Perseverance Site)', elevationM: -2560 };
  }, [location]);

  // Scientific engines calculations
  const topo: MarsElevationProfile = useMemo(() => {
    return getMarsTopography(activeLoc.lat, activeLoc.lon);
  }, [activeLoc.lat, activeLoc.lon]);

  const swimData: SwimAssessment = useMemo(() => {
    return querySwimWaterIce(activeLoc.lat, activeLoc.lon);
  }, [activeLoc.lat, activeLoc.lon]);

  const hazards: DualTerrainHazardResult = useMemo(() => {
    return evaluateMarsHazards(activeLoc.lat, activeLoc.lon);
  }, [activeLoc.lat, activeLoc.lon]);

  const meri: MeriAssessmentResult = useMemo(() => {
    return calculateMeri(activeLoc.lat, activeLoc.lon, activeHazardTab === 'eva' ? 'astronaut_eva' : 'pressurized_rover');
  }, [activeLoc.lat, activeLoc.lon, activeHazardTab]);

  const atm = useMemo(() => {
    return getMarsAtmosphericPressure(topo.elevationM);
  }, [topo.elevationM]);

  const dust = useMemo(() => {
    return getMarsDustOpacity(75, activeLoc.lat);
  }, [activeLoc.lat]);

  const thermal = useMemo(() => {
    return getMarsDiurnalThermal(activeLoc.lat, topo.elevationM, 75, swimData.thermalInertia);
  }, [activeLoc.lat, topo.elevationM, swimData.thermalInertia]);

  const rad = useMemo(() => {
    return getMarsRadiationDose(topo.elevationM);
  }, [topo.elevationM]);

  const comms = useMemo(() => {
    return getMarsEnergyAndComms(activeLoc.lat, topo.elevationM, 75, dust.tau);
  }, [activeLoc.lat, topo.elevationM, dust.tau]);

  // Check matching landed mission site
  const matchedLandingSite = MARS_LANDING_SITES.find(
    (s) => Math.abs(s.lat - activeLoc.lat) < 0.6 && Math.abs(s.lon - activeLoc.lon) < 0.6
  );

  // Format decimal to Degrees Minutes Seconds
  const formatDms = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    const sec = Math.round(((abs - deg) * 60 - min) * 60);
    return `${deg}°${min}'${sec}" ${dir}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#090e17] border-l border-slate-800 text-slate-200 select-none overflow-hidden font-sans">
      {/* Top Header Card */}
      <div className="p-3.5 border-b border-slate-800 bg-[#0d1422]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="size-4 text-amber-500" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-100">
              Target Telemetry
            </h3>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
            {topo.provenance === 'NASA MRO HiRISE 1m DTM' ? 'HiRISE 1m DTM' : 'MOLA MEGDR'}
          </span>
        </div>

        <div className="mt-2.5">
          <h4 className="font-sans text-sm font-bold text-slate-100 truncate">
            {activeLoc.name || 'Planetary Surface Target'}
          </h4>
          <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-amber-400 font-semibold">
            <span>
              {activeLoc.lat >= 0 ? `${activeLoc.lat.toFixed(3)}°N` : `${Math.abs(activeLoc.lat).toFixed(3)}°S`},{' '}
              {activeLoc.lon >= 0 ? `${activeLoc.lon.toFixed(3)}°E` : `${Math.abs(activeLoc.lon).toFixed(3)}°W`}
            </span>
            <span className="text-slate-500 text-[10px]">
              {formatDms(activeLoc.lat, true)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        
        {/* SECTION 1: TOPOGRAPHY & ELEVATION (Real Horn Gradient & MOLA Grid) */}
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase text-amber-400">
              <Mountain className="size-3.5 text-amber-500" />
              <span>Laser Topography &amp; Slope</span>
            </div>
            <span className="font-mono text-xs font-bold text-slate-100">
              {topo.elevationM >= 0 ? `+${topo.elevationM.toLocaleString()} m` : `${topo.elevationM.toLocaleString()} m`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-1">
            <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 block">Metric Surface Slope</span>
              <span className={`font-bold ${topo.slopeDeg > 15 ? 'text-rose-400' : topo.slopeDeg > 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {topo.slopeDeg}° ({topo.terrainClassification})
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 block">Atmospheric Pressure</span>
              <span className="text-slate-200 font-bold">{atm.pressureMbar} mbar</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: MARS EXPLORATION RISK INDEX (MERI) */}
        <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase font-bold text-indigo-400">
              <Activity className="size-3.5 text-indigo-400" />
              <span>Exploration Risk Index (MERI)</span>
            </div>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold border ${
              meri.classification === 'SAFE' 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : meri.classification === 'CAUTION' 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              {meri.compositeMeriScore}/100 &middot; {meri.classification}
            </span>
          </div>

          {/* 6-Axis Mini Breakdown Bar */}
          <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono text-center">
            <div className="p-1 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 block">Terrain</span>
              <span className="font-bold text-slate-200">{meri.breakdown.terrainScore}</span>
            </div>
            <div className="p-1 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 block">Mobility</span>
              <span className="font-bold text-slate-200">{meri.breakdown.mobilityScore}</span>
            </div>
            <div className="p-1 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 block">Dust (tau)</span>
              <span className="font-bold text-slate-200">{meri.breakdown.dustScore}</span>
            </div>
            <div className="p-1 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 block">Thermal</span>
              <span className="font-bold text-slate-200">{meri.breakdown.thermalScore}</span>
            </div>
            <div className="p-1 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 block">Radiation</span>
              <span className="font-bold text-slate-200">{meri.breakdown.radiationScore}</span>
            </div>
            <div className="p-1 rounded bg-slate-950/80 border border-slate-800">
              <span className="text-slate-500 block">Comms</span>
              <span className="font-bold text-slate-200">{meri.breakdown.communicationScore}</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: DUAL TERRAIN HAZARD (ROVER VS ASTRONAUT EVA) */}
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase font-bold text-rose-400">
              <ShieldAlert className="size-3.5 text-rose-500" />
              <span>Traversability Hazard Envelope</span>
            </div>
            {/* Mode Tab Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveHazardTab('rover')}
                className={`px-2 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 transition-colors ${
                  activeHazardTab === 'rover' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="size-2.5" />
                <span>Rover</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveHazardTab('eva')}
                className={`px-2 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 transition-colors ${
                  activeHazardTab === 'eva' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="size-2.5" />
                <span>EVA</span>
              </button>
            </div>
          </div>

          {activeHazardTab === 'rover' ? (
            <div className="space-y-1.5 text-[10px] font-mono">
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Rover Traversability:</span>
                <span className={`font-bold ${hazards.rover.status === 'SAFE' ? 'text-emerald-400' : hazards.rover.status === 'CAUTION' ? 'text-amber-400' : 'text-rose-400'}`}>
                  {hazards.rover.status} ({hazards.rover.score}/100)
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Wheel Slip Risk:</span>
                <span className="text-slate-200 font-semibold">{hazards.rover.wheelSlipRisk}</span>
              </div>
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Rock Boulder Clearance (CFA):</span>
                <span className="text-slate-200 font-semibold">{hazards.rover.rockObstacleDensityPercent}%</span>
              </div>
              {hazards.rover.limitationsAndVetoReasons.length > 0 && (
                <div className="p-2 rounded bg-rose-950/40 border border-rose-500/30 text-[9px] text-rose-300">
                  <span className="font-bold block text-rose-400">Constraint:</span>
                  {hazards.rover.limitationsAndVetoReasons[0]}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 text-[10px] font-mono">
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Suited EVA Traversability:</span>
                <span className={`font-bold ${hazards.astronautEva.status === 'SAFE' ? 'text-emerald-400' : hazards.astronautEva.status === 'CAUTION' ? 'text-amber-400' : 'text-rose-400'}`}>
                  {hazards.astronautEva.status} ({hazards.astronautEva.score}/100)
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Fall &amp; Suit Breach Risk:</span>
                <span className="text-slate-200 font-semibold">{hazards.astronautEva.fallAndPunctureRisk}</span>
              </div>
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Metabolic Power &amp; O2:</span>
                <span className="text-slate-200 font-semibold">{hazards.astronautEva.metabolicCostWatts} W &middot; {hazards.astronautEva.oxygenBurnRateGramsPerHr} g/h</span>
              </div>
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">PLSS Emergency Radius:</span>
                <span className="text-amber-400 font-bold">{hazards.astronautEva.plssWalkBackLimitKm} km</span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: SCIENTIFIC RESOURCE EXPLORER (SWIM 2.0 & RADAR) */}
        <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase font-bold text-cyan-400">
              <Droplets className="size-3.5 text-cyan-500" />
              <span>Resource Explorer (SWIM 2.0)</span>
            </div>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {swimData.evidenceTier.split(' ')[0]}
            </span>
          </div>

          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-slate-400">Ice Consistency ($C_I$):</span>
              <span className={`font-bold ${swimData.compositeConsistency > 0.5 ? 'text-emerald-400' : swimData.compositeConsistency > 0 ? 'text-cyan-400' : 'text-slate-400'}`}>
                {swimData.compositeConsistency > 0 ? `+${swimData.compositeConsistency}` : swimData.compositeConsistency} ({swimData.confidenceCategory})
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-slate-400">Dominant Depth Horizon:</span>
              <span className="text-slate-200 font-bold">{swimData.dominantDepth}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-slate-400">Extraction Feasibility:</span>
              <span className="text-slate-200 font-bold">{swimData.extractionFeasibility}</span>
            </div>
          </div>
        </div>

        {/* SECTION 5: ENVIRONMENTAL INSTRUMENTS (RAD, THEMIS, TES) */}
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase text-[11px]">
            <Sun className="size-3.5" />
            <span>Environmental Telemetry</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block">MSL Surface GCR Dose</span>
              <span className="text-slate-200 font-bold">~{rad.surfaceGcrDoseMsvYear} mSv/yr</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block">Diurnal Thermal Swing</span>
              <span className="text-slate-200 font-bold">{thermal.nightC}°C to {thermal.dayC}°C</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block">TES Dust Optical Depth</span>
              <span className="text-cyan-400 font-bold">&tau; = {dust.tau}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block">Relay Orbiter Passes</span>
              <span className="text-slate-200 font-bold">{comms.relayPassesPerSol} / sol</span>
            </div>
          </div>
        </div>

        {/* MATCHED MISSION LANDING SITE */}
        {matchedLandingSite && (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/10 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-400">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>Ground Truth: {matchedLandingSite.name}</span>
            </div>
            <p className="text-[10px] text-slate-300">
              {matchedLandingSite.scienceGoal}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons Footer */}
      <div className="p-3 border-t border-slate-800 bg-[#0d1422] space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => onSetRouteOrigin?.({ lat: activeLoc.lat, lon: activeLoc.lon, name: activeLoc.name || 'Origin' })}
            className="py-2 px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="text-emerald-400 font-bold">A</span>
            <span>Set Origin</span>
          </button>
          <button
            type="button"
            onClick={() => onSetRouteDestination?.({ lat: activeLoc.lat, lon: activeLoc.lon, name: activeLoc.name || 'Destination' })}
            className="py-2 px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="text-rose-400 font-bold">B</span>
            <span>Set Target</span>
          </button>
        </div>

        {/* Grounded AI Advisor Consultation */}
        <button
          type="button"
          onClick={() => onOpenAiAdvisor?.({
            lat: activeLoc.lat,
            lon: activeLoc.lon,
            name: activeLoc.name || 'Target Coordinate',
            elevationM: topo.elevationM,
            slopeDeg: topo.slopeDeg,
            roughnessM: topo.roughnessM,
            terrainClassification: topo.terrainClassification,
            roverStatus: hazards.rover.status,
            roverScore: hazards.rover.score,
            evaStatus: hazards.astronautEva.status,
            evaScore: hazards.astronautEva.score,
            meriScore: meri.compositeMeriScore,
            meriClassification: meri.classification,
            swim: swimData,
          })}
          className="w-full py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all"
        >
          <Sparkles className="size-3.5" />
          <span>Consult AI Mission Advisor on This Site</span>
        </button>
      </div>
    </div>
  );
}
