import React, { useRef } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  CheckCircle2, 
  ShieldAlert, 
  Droplets, 
  Mountain, 
  Navigation, 
  Battery, 
  Radio, 
  AlertTriangle, 
  Compass, 
  Copy, 
  Check, 
  X,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import type { MultiRoutePlanResult, RouteAlternative } from '@/lib/mars-pathfinder';
import type { MeriAssessmentResult } from '@/lib/mars-meri';
import type { SwimAssessment } from '@/lib/swim-data';

export interface MissionReadinessBriefProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
  lat: number;
  lon: number;
  elevationM: number;
  missionObjective?: string;
  planResult: MultiRoutePlanResult;
  selectedRouteId: 'safest' | 'fastest' | 'science';
  meriAssessment: MeriAssessmentResult;
  swimAssessment: SwimAssessment;
  onSelectRoute?: (routeId: 'safest' | 'fastest' | 'science') => void;
}

export function MissionReadinessBrief({
  isOpen,
  onClose,
  locationName,
  lat,
  lon,
  elevationM,
  missionObjective = 'Scientific reconnaissance, geological sampling, and ISRU water ice prospecting',
  planResult,
  selectedRouteId,
  meriAssessment,
  swimAssessment,
  onSelectRoute,
}: MissionReadinessBriefProps) {
  const [copied, setCopied] = React.useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const currentRoute: RouteAlternative = planResult.routes[selectedRouteId];
  const modeLabel = planResult.mode === 'astronaut_eva' 
    ? 'Astronaut Suited EVA (xEMU)' 
    : planResult.mode === 'pressurized_rover' 
    ? 'Pressurized Crewed Rover' 
    : 'Robotic Science Rover';

  const handlePrint = () => {
    window.print();
  };

  const generateMarkdownReport = () => {
    return `# NASA SPACE APPS 2026 — MISSION READINESS BRIEF
**Project:** Interplanetary Survival Guide: Martian Map
**Date Generated:** Sol ${Math.round(214 + (lat + lon) * 0.1)} (MTC / Allison & McEwen 2000)
**Exploration Target:** ${locationName} (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)
**MOLA Datum Elevation:** ${elevationM >= 0 ? `+${elevationM}` : elevationM} m
**Traverse Mode:** ${modeLabel}
**Primary Mission Objective:** ${missionObjective}

---

## 1. PRIMARY TRAVERSE ROUTE: ${currentRoute.title.toUpperCase()}
- **Distance:** ${currentRoute.distanceKm} km (Geodesic Straight Line: ${planResult.straightLineDistanceKm} km)
- **Estimated Duration:** ${currentRoute.durationHours} hours
- **Elevation Change:** +${currentRoute.elevationGainM} m / -${currentRoute.elevationLossM} m
- **Max Slope:** ${currentRoute.maxSlopeDeg}° (Mean: ${currentRoute.meanSlopeDeg}°)
- **Mean MERI Risk:** ${currentRoute.meanMeriScore}/100 (${meriAssessment.classification})
- **Energy Budget:** ${currentRoute.energyKwh} kWh
${currentRoute.evaO2ConsumedKg ? `- **O2 Consumed:** ${currentRoute.evaO2ConsumedKg} kg (Crew of 2)\n- **Metabolic Cost:** ${currentRoute.evaCaloriesKcal} kcal` : ''}
- **Return-Route Feasibility:** ${currentRoute.returnRouteFeasibility}
- **Selection Rationale:** ${currentRoute.recommendationRationale}

## 2. MULTI-OBJECTIVE ROUTE ALTERNATIVES COMPARISON
| Route Alternative | Distance | Duration | Max Slope | Mean MERI | Return Feasibility | Science Yield |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Safest Traverse** | ${planResult.routes.safest.distanceKm} km | ${planResult.routes.safest.durationHours} h | ${planResult.routes.safest.maxSlopeDeg}° | ${planResult.routes.safest.meanMeriScore}/100 | ${planResult.routes.safest.returnRouteFeasibility} | ${planResult.routes.safest.scienceTargetScore}/100 |
| **Fastest Direct** | ${planResult.routes.fastest.distanceKm} km | ${planResult.routes.fastest.durationHours} h | ${planResult.routes.fastest.maxSlopeDeg}° | ${planResult.routes.fastest.meanMeriScore}/100 | ${planResult.routes.fastest.returnRouteFeasibility} | ${planResult.routes.fastest.scienceTargetScore}/100 |
| **Best Science-per-Risk** | ${planResult.routes.science.distanceKm} km | ${planResult.routes.science.durationHours} h | ${planResult.routes.science.maxSlopeDeg}° | ${planResult.routes.science.meanMeriScore}/100 | ${planResult.routes.science.returnRouteFeasibility} | ${planResult.routes.science.scienceTargetScore}/100 |

## 3. TERRAIN & MOBILITY HAZARD EVALUATION
- **Rover Traversability:** ${meriAssessment.hazardDetails.rover.status} (Score: ${meriAssessment.hazardDetails.rover.score}/100)
- **Astronaut Suited EVA:** ${meriAssessment.hazardDetails.astronautEva.status} (Score: ${meriAssessment.hazardDetails.astronautEva.score}/100)
- **Wheel Slip / Sand Trap Risk:** ${meriAssessment.hazardDetails.rover.wheelSlipRisk}
- **Fall & Visor Puncture Risk:** ${meriAssessment.hazardDetails.astronautEva.fallAndPunctureRisk}

## 4. UNDERGROUND WATER ICE & ISRU PROSPECTING (NASA SWIM 2.0)
- **Confidence Category:** ${swimAssessment.confidenceCategory}
- **Composite Consistency (CI):** ${swimAssessment.compositeConsistency}
- **Evidence Tier:** ${swimAssessment.evidenceTier}
- **Dominant Depth Horizon:** ${swimAssessment.dominantDepth}
- **Extraction Feasibility:** ${swimAssessment.extractionFeasibility}
- **Neutron Hydrogen (WEH):** ${swimAssessment.wehPercent} wt%
- **Dielectric Permittivity:** ${swimAssessment.radarDielectricConstant ?? '6.0 (basaltic)'}

## 5. ENVIRONMENTAL PARAMETERS & LIFE SUPPORT
- **Atmospheric Pressure:** ${((6.1 * Math.exp(-elevationM / 11100))).toFixed(1)} mbar
- **Surface GCR Radiation:** ~${Math.round(220 + Math.max(0, elevationM / 150))} mSv/year (MSL RAD baseline)
- **Dust Opacity (tau):** Seasonal baseline nominal
- **Direct-to-Earth Comm:** Elevation angle ${Math.round(55 - Math.abs(lat) * 0.4)}°
- **Orbital Relay Passes:** 3 passes/sol (MRO, Odyssey, TGO)

## 6. MANDATORY TURN-BACK & ABORT CONDITIONS
- ${currentRoute.turnBackCondition}
- Immediate abort if solar proton event (SPE) warning exceeds 50 mGy/hr.
- Immediate abort if rover battery state-of-charge drops below 40% before turning back.

## 7. SCIENTIFIC DATA PROVENANCE & CITATIONS
1. NASA Mars Global Surveyor MOLA MEGDR Topography (Smith et al. 2001)
2. Planetary Science Institute / NASA SWIM 2.0 Subsurface Ice Consistency (Putzig et al. 2023)
3. MRO SHARAD Radar Sounding Observations (Bramson et al. 2015, Holt et al. 2008)
4. MSL RAD Surface Cosmic Ray Dosimeter Measurements (Hassler et al. 2014)
5. NASA Human Integration Design Handbook (HIDH) Suited Locomotion Bioenergetics`;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generateMarkdownReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white dark:bg-[#0c121e] border border-slate-300 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 font-sans">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#080d17]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Mission Readiness Brief
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  DEMO GRADE
                </span>
              </div>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                NASA Space Apps Challenge 2026 &middot; Operational Planning Synthesis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono flex items-center gap-1.5 text-slate-600 dark:text-slate-300 transition-colors"
              title="Copy Markdown Report"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy MD'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Print / Save PDF"
            >
              <Printer className="size-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Report Content */}
        <div ref={reportRef} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs sm:text-sm">
          
          {/* Header Metadata Card */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 font-bold block">
                  Target Destination
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {locationName}
                </h3>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-slate-400 block text-[10px]">COORDINATES / DATUM</span>
                <span className="text-slate-900 dark:text-white font-bold">
                  {lat >= 0 ? `${lat.toFixed(3)}°N` : `${Math.abs(lat).toFixed(3)}°S`}, {lon >= 0 ? `${lon.toFixed(3)}°E` : `${Math.abs(lon).toFixed(3)}°W`}
                </span>
                <span className="text-slate-500 ml-2">({elevationM >= 0 ? `+${elevationM}` : elevationM} m MOLA)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-mono block">Mission Objective</span>
                <p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">{missionObjective}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-mono block">Mobility System</span>
                <p className="font-semibold text-amber-600 dark:text-amber-400 mt-0.5">{modeLabel}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-mono block">MERI Exploration Risk</span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${meriAssessment.classification === 'SAFE' ? 'bg-emerald-500' : meriAssessment.classification === 'CAUTION' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                  <span>{meriAssessment.compositeMeriScore}/100 &middot; {meriAssessment.classification}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Route Selection Tabs & Active Route Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                <Navigation className="size-4 text-emerald-500" />
                <span>Traverse Route Evaluation</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-500">
                Straight Line: {planResult.straightLineDistanceKm} km
              </span>
            </div>

            {/* Route Selection Switcher */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['safest', 'fastest', 'science'] as const).map((rId) => {
                const r = planResult.routes[rId];
                const isSelected = selectedRouteId === rId;
                return (
                  <button
                    key={rId}
                    type="button"
                    onClick={() => onSelectRoute?.(rId)}
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
                      <span>Max Slope: {r.maxSlopeDeg}°</span>
                      <span>MERI: {r.meanMeriScore}/100</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Route Telemetry Deep Dive */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                    Selected Primary Traverse: {currentRoute.title}
                  </h5>
                  <p className="text-xs text-slate-500 mt-0.5">{currentRoute.recommendationRationale}</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-mono text-[11px] font-bold border border-emerald-500/20">
                  {currentRoute.returnRouteFeasibility}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Distance / Elevation</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currentRoute.distanceKm} km (+{currentRoute.elevationGainM}m)</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Duration / Speed</span>
                  <span className="font-bold text-amber-500">{currentRoute.durationHours} hrs</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Energy Budget</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currentRoute.energyKwh} kWh</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Science / ISRU Score</span>
                  <span className="font-bold text-cyan-500">{currentRoute.scienceTargetScore}/100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Dual Terrain Hazard Breakdown (Rover vs Astronaut EVA) */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <ShieldAlert className="size-4 text-rose-500" />
              <span>Terrain Hazard Analysis (Dual System Assessment)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Rover System */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white font-mono uppercase text-xs">A. Rover Traversability</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${meriAssessment.hazardDetails.rover.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : meriAssessment.hazardDetails.rover.status === 'CAUTION' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {meriAssessment.hazardDetails.rover.status} ({meriAssessment.hazardDetails.rover.score}/100)
                  </span>
                </div>
                <ul className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  <li>&bull; Wheel Slip Risk: <strong>{meriAssessment.hazardDetails.rover.wheelSlipRisk}</strong></li>
                  <li>&bull; Rock Obstacle Density (CFA): <strong>{meriAssessment.hazardDetails.rover.rockObstacleDensityPercent}%</strong></li>
                  <li>&bull; Maximum Climb Limit: <strong>{meriAssessment.hazardDetails.rover.maxTraversableSlopeDeg}°</strong></li>
                  <li>&bull; Rollover Safety Margin: <strong>{meriAssessment.hazardDetails.rover.rolloverMarginFactor}x</strong></li>
                </ul>
              </div>

              {/* Astronaut EVA System */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white font-mono uppercase text-xs">B. Astronaut Suited EVA</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${meriAssessment.hazardDetails.astronautEva.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : meriAssessment.hazardDetails.astronautEva.status === 'CAUTION' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {meriAssessment.hazardDetails.astronautEva.status} ({meriAssessment.hazardDetails.astronautEva.score}/100)
                  </span>
                </div>
                <ul className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  <li>&bull; Fall &amp; Suit Puncture Risk: <strong>{meriAssessment.hazardDetails.astronautEva.fallAndPunctureRisk}</strong></li>
                  <li>&bull; Suited Metabolic Power: <strong>{meriAssessment.hazardDetails.astronautEva.metabolicCostWatts} W</strong></li>
                  <li>&bull; Oxygen Burn Rate: <strong>{meriAssessment.hazardDetails.astronautEva.oxygenBurnRateGramsPerHr} g/hr</strong></li>
                  <li>&bull; PLSS Safe Walk-Back Radius: <strong>{meriAssessment.hazardDetails.astronautEva.plssWalkBackLimitKm} km</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 3: Underground Ice & In-Situ Resources */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
              <Droplets className="size-4 text-cyan-500" />
              <span>Underground Water Ice &amp; ISRU Feasibility (SWIM 2.0)</span>
            </h4>

            <div className="p-4 rounded-2xl border border-cyan-500/20 bg-cyan-950/10 dark:bg-cyan-950/20 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 pb-2.5">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    Ice Consistency ($C_I$): {swimAssessment.compositeConsistency > 0 ? `+${swimAssessment.compositeConsistency}` : swimAssessment.compositeConsistency}
                  </span>
                  <span className="ml-2 font-mono text-cyan-400 font-bold">({swimAssessment.confidenceCategory})</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {swimAssessment.evidenceTier}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 text-[10px] block">Dominant Horizon</span>
                  <strong className="text-slate-200">{swimAssessment.dominantDepth}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">ISRU Feasibility</span>
                  <strong className="text-slate-200">{swimAssessment.extractionFeasibility}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Neutron WEH %</span>
                  <strong className="text-slate-200">{swimAssessment.wehPercent} wt% H2O</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Dielectric Constant</span>
                  <strong className="text-slate-200">&epsilon; = {swimAssessment.radarDielectricConstant ?? '6.0 (rock)'}</strong>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                {swimAssessment.scientificNotes}
              </p>
            </div>
          </div>

          {/* Section 4: Operational Turn-Back / Abort Thresholds */}
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-950/10 dark:bg-amber-950/20 space-y-2">
            <h4 className="font-mono text-xs uppercase font-bold text-amber-500 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <span>Mandatory Mission Abort / Turn-Back Conditions</span>
            </h4>
            <p className="font-mono text-xs text-amber-300 leading-relaxed">
              &bull; <strong>Route Constraint:</strong> {currentRoute.turnBackCondition}
            </p>
            <p className="font-mono text-xs text-amber-300 leading-relaxed">
              &bull; <strong>Consumables Constraint:</strong> Turn back immediately if PLSS oxygen pressure reaches 45 minutes reserve, or if rover battery drops below 50% state-of-charge before the return traverse begins.
            </p>
          </div>

          {/* Section 5: Data Provenance & Literature Citations */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-2 text-[11px] font-mono text-slate-500">
            <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">
              Ingested NASA Data Sources &amp; Literature References
            </span>
            <p>1. NASA MGS MOLA MEGDR Laser Altimetry (Smith et al. 2001, JGR Planets)</p>
            <p>2. Planetary Science Institute / NASA SWIM 2.0 Subsurface Ice Consistency (Putzig et al. 2023, Icarus)</p>
            <p>3. MRO SHARAD Radar Sounding Observations (Bramson et al. 2015, GRL; Holt et al. 2008)</p>
            <p>4. MSL RAD Surface Cosmic Ray Dosimeter Measurements (Hassler et al. 2014, Science)</p>
            <p>5. NASA Human Integration Design Handbook (HIDH) Suited EVA Locomotion Bioenergetics</p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080d17] flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">
            Interplanetary Survival Guide &middot; NASA Space Apps 2026
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold transition-colors"
          >
            Close Brief
          </button>
        </div>

      </div>
    </div>
  );
}
