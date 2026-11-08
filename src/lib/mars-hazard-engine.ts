/**
 * NASA Intelligent Mars Terrain Hazard Engine
 * 
 * Features:
 * - Dual Assessment Systems:
 *   System A: Robotic & Pressurized Rover Traversability (Terramechanics & Wheel-Slip)
 *   System B: Astronaut Suited EVA Traversability (Metabolic Power, Fall Hazard, PLSS Radius)
 * - Fuses trained HistGradientBoostingRegressor Jezero ML surrogate if coordinates fall within Jezero Crater
 * - Uses Horn's topography gradient, THEMIS thermal inertia, and MOLA roughness globally
 * - Clearly documents all biomechanical and terramechanic assumptions
 */

import { getMarsTopography, type MarsElevationProfile } from './mars-dem-engine';
import { querySwimWaterIce } from './swim-data';
import { getMarsAtmosphericPressure, getMarsDiurnalThermal, getMarsRadiationDose } from './mars-environment';
import jezeroData from '@/data/jezero_data.json';

export type TraversabilityStatus = 'SAFE' | 'CAUTION' | 'NO-GO';

export interface RoverHazardAssessment {
  status: TraversabilityStatus;
  score: number; // 0 to 100 (0 = completely safe, 100 = impassable)
  maxTraversableSlopeDeg: number;
  currentSlopeDeg: number;
  wheelSlipRisk: 'Low' | 'Moderate' | 'High (Sand Trap Risk)' | 'Impassable Dune Crest';
  rockObstacleDensityPercent: number; // Cumulative Fractional Area (CFA)
  groundClearanceRisk: 'Clear' | 'Minor Tortuosity Required' | 'High Undercarriage Risk';
  rolloverMarginFactor: number; // > 1.5 safe, 1.0 - 1.5 caution, < 1.0 tip-over hazard
  limitationsAndVetoReasons: string[];
}

export interface AstronautEvaHazardAssessment {
  status: TraversabilityStatus;
  score: number; // 0 to 100 (0 = safe walking, 100 = fatal terrain / abort)
  currentSlopeDeg: number;
  maxWalkingSlopeDeg: number;
  fallAndPunctureRisk: 'Negligible' | 'Moderate' | 'High Slip / Sharp Ejecta' | 'Lethal Drop-off / Scarp';
  metabolicCostWatts: number; // Bioenergetic metabolic power (Pandolf / NASA HIDH)
  oxygenBurnRateGramsPerHr: number;
  plssWalkBackLimitKm: number; // Safe radius from habitat/pressurized rover
  thermalStressLevel: 'Comfort Range' | 'Suit Heating Required' | 'Extreme Cold-Soak Hazard';
  limitationsAndVetoReasons: string[];
}

export interface DualTerrainHazardResult {
  latitude: number;
  longitude: number;
  elevationM: number;
  topography: MarsElevationProfile;
  mlSurrogateActive: boolean;
  mlHazardScore?: number | undefined;
  rover: RoverHazardAssessment;
  astronautEva: AstronautEvaHazardAssessment;
  overallSiteRecommendation: 'Favorable for Both Rover & EVA' | 'Rover Only (Unsafe for Suited Crew)' | 'Careful EVA & Rover Caution' | 'NO-GO Exclusion Zone';
}

// Cached Jezero ML hazard array
let cachedJezeroMlHaz: Float32Array | null = null;
function getJezeroMlHazard(): Float32Array {
  if (cachedJezeroMlHaz) return cachedJezeroMlHaz;
  const bin = atob(jezeroData.ml);
  const arr = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i) / 255.0; // 0.0 to 1.0
  }
  cachedJezeroMlHaz = arr;
  return arr;
}

const JEZERO_BOUNDS = {
  latMin: 18.20,
  latMax: 18.65,
  lonMin: 77.25,
  lonMax: 77.75,
};

/**
 * Evaluates comprehensive terrain hazards at any Martian coordinate,
 * delivering separate evaluations for Robotic/Pressurized Rover vs Suited Astronaut EVA.
 */
export function evaluateMarsHazards(lat: number, lon: number): DualTerrainHazardResult {
  const topo = getMarsTopography(lat, lon);
  const swim = querySwimWaterIce(lat, lon);
  const atm = getMarsAtmosphericPressure(topo.elevationM);
  const thermal = getMarsDiurnalThermal(lat, topo.elevationM, 75, swim.thermalInertia);

  // Check if inside Jezero Crater ML Surrogate domain
  let mlSurrogateActive = false;
  let mlHazardScore: number | undefined;

  if (
    lat >= JEZERO_BOUNDS.latMin &&
    lat <= JEZERO_BOUNDS.latMax &&
    lon >= JEZERO_BOUNDS.lonMin &&
    lon <= JEZERO_BOUNDS.lonMax
  ) {
    mlSurrogateActive = true;
    const mlArr = getJezeroMlHazard();
    const n = jezeroData.n; // 128
    const rFrac = (JEZERO_BOUNDS.latMax - lat) / (JEZERO_BOUNDS.latMax - JEZERO_BOUNDS.latMin);
    const cFrac = (lon - JEZERO_BOUNDS.lonMin) / (JEZERO_BOUNDS.lonMax - JEZERO_BOUNDS.lonMin);
    const r = Math.max(0, Math.min(n - 1, Math.floor(rFrac * n)));
    const c = Math.max(0, Math.min(n - 1, Math.floor(cFrac * n)));
    mlHazardScore = Number((mlArr[r * n + c] ?? 0).toFixed(3));
  }

  // =========================================================================
  // SYSTEM A: ROVER TRAVERSABILITY ASSESSMENT (Terramechanics & Wheel-Slip)
  // =========================================================================
  const roverMaxSlope = 22.0; // Maximum dynamic climb limit on coarse regolith
  const slope = topo.slopeDeg;
  const roverVetoes: string[] = [];

  // Wheel slip estimation from thermal inertia (low TI < 90 tiu = fine loose dust / Opportunity Purgatory trap)
  let wheelSlipRisk: RoverHazardAssessment['wheelSlipRisk'] = 'Low';
  let slipPenalty = 0;
  if (swim.thermalInertia < 90) {
    wheelSlipRisk = 'High (Sand Trap Risk)';
    slipPenalty = 35;
    roverVetoes.push('Unconsolidated low-inertia dust deposit (risk of impassable wheel entrapment)');
  } else if (swim.thermalInertia < 140) {
    wheelSlipRisk = 'Moderate';
    slipPenalty = 15;
  }

  // Rock obstacle density from roughness & thermal inertia
  const rockCfa = Number(Math.min(30, Math.max(2, (topo.roughnessM / 15) * 8 + (swim.thermalInertia > 350 ? 8 : 2))).toFixed(1));
  let groundClearanceRisk: RoverHazardAssessment['groundClearanceRisk'] = 'Clear';
  if (rockCfa > 15 || topo.roughnessM > 25) {
    groundClearanceRisk = 'High Undercarriage Risk';
    roverVetoes.push('High rock abundance (CFA > 15%) exceeds rover undercarriage clearance');
  } else if (rockCfa > 8 || topo.roughnessM > 12) {
    groundClearanceRisk = 'Minor Tortuosity Required';
  }

  // Rollover static margin (Rocker-bogie critical rollover angle ~ 32°)
  const rolloverMargin = Number(Math.max(0.1, (32.0 - slope) / 12.0).toFixed(2));
  if (slope > roverMaxSlope) {
    roverVetoes.push(`Slope (${slope}°) exceeds rover climbing threshold (${roverMaxSlope}°)`);
  }

  // Base Rover Hazard Score (0-100)
  let roverScore = Math.min(
    100,
    (slope / roverMaxSlope) * 45 +
    slipPenalty +
    (rockCfa / 30) * 25 +
    Math.min(25, topo.roughnessM * 0.8)
  );

  // Blend in ML surrogate if available
  if (mlSurrogateActive && mlHazardScore !== undefined) {
    roverScore = roverScore * 0.4 + mlHazardScore * 100 * 0.6;
  }
  roverScore = Math.round(roverScore);

  let roverStatus: TraversabilityStatus = 'SAFE';
  if (slope > roverMaxSlope || roverScore > 65 || roverVetoes.length > 0) {
    roverStatus = 'NO-GO';
  } else if (slope > 12 || roverScore > 35) {
    roverStatus = 'CAUTION';
  }

  // =========================================================================
  // SYSTEM B: ASTRONAUT SUITED EVA TRAVERSABILITY (Bioenergetics & Suit Fall Risk)
  // =========================================================================
  // Suited astronauts have restricted ankle articulation, bulky pressurized joints,
  // and a high center of mass that makes slopes > 15° extremely dangerous.
  const evaMaxSlope = 14.0;
  const evaVetoes: string[] = [];

  let fallRisk: AstronautEvaHazardAssessment['fallAndPunctureRisk'] = 'Negligible';
  if (slope > 18 || topo.terrainClassification === 'Hazardous Cliff / Chasma') {
    fallRisk = 'Lethal Drop-off / Scarp';
    evaVetoes.push(`Cliff / Scarp grade (${slope}°) poses catastrophic fall and suit breach hazard`);
  } else if (slope > 11 || rockCfa > 14) {
    fallRisk = 'High Slip / Sharp Ejecta';
    evaVetoes.push('Steep slope combined with sharp boulder ejecta threatens suit thermal-micrometeoroid puncture');
  } else if (slope > 6) {
    fallRisk = 'Moderate';
  }

  // Pandolf / NASA Human Integration Design Handbook (HIDH) Bioenergetics:
  // Base metabolic rate for suited walking in 0.38g (W):
  // Level ground: ~ 260 W
  // Gradient penalty: grows steeply with slope grade %
  const gradePercent = Math.tan((slope * Math.PI) / 180) * 100;
  const metabolicWatts = Math.round(260 + gradePercent * 28 + Math.max(0, topo.roughnessM - 5) * 6);
  // O2 consumption: ~ 0.08 kg/hr nominal, scaling linearly with metabolic wattage
  const oxygenBurnRateGramsPerHr = Math.round((metabolicWatts / 280) * 60);

  // Portable Life Support System (PLSS) Walk-Back Radius:
  // Based on 45-minute emergency reserve walking at ~ 2.4 km/h reduced by slope
  const walkingSpeedKmh = Math.max(0.4, 2.5 - slope * 0.12);
  const plssWalkBackLimitKm = Number(Math.max(0.5, (walkingSpeedKmh * 0.75)).toFixed(1)); // ~ 1.5 - 2.0 km radius

  let thermalStress: AstronautEvaHazardAssessment['thermalStressLevel'] = 'Comfort Range';
  if (thermal.nightC < -85) {
    thermalStress = 'Extreme Cold-Soak Hazard';
    evaVetoes.push(`Nighttime surface temperature (${thermal.nightC}°C) exceeds suit active heating capacity`);
  } else if (thermal.dayC < -40) {
    thermalStress = 'Suit Heating Required';
  }

  if (slope > evaMaxSlope) {
    evaVetoes.push(`Slope (${slope}°) exceeds astronaut walking threshold (${evaMaxSlope}°)`);
  }

  let evaScore = Math.min(
    100,
    (slope / evaMaxSlope) * 50 +
    (metabolicWatts > 450 ? 30 : metabolicWatts > 320 ? 15 : 0) +
    (fallRisk === 'Lethal Drop-off / Scarp' ? 45 : fallRisk === 'High Slip / Sharp Ejecta' ? 25 : 5)
  );
  evaScore = Math.round(evaScore);

  let evaStatus: TraversabilityStatus = 'SAFE';
  if (slope > evaMaxSlope || evaScore > 65 || evaVetoes.length > 0) {
    evaStatus = 'NO-GO';
  } else if (slope > 7 || evaScore > 35) {
    evaStatus = 'CAUTION';
  }

  // Overall Site Synthesis
  let siteRecommendation: DualTerrainHazardResult['overallSiteRecommendation'] = 'Favorable for Both Rover & EVA';
  if (roverStatus === 'NO-GO' && evaStatus === 'NO-GO') {
    siteRecommendation = 'NO-GO Exclusion Zone';
  } else if (roverStatus === 'SAFE' && evaStatus === 'NO-GO') {
    siteRecommendation = 'Rover Only (Unsafe for Suited Crew)';
  } else if (roverStatus === 'CAUTION' || evaStatus === 'CAUTION') {
    siteRecommendation = 'Careful EVA & Rover Caution';
  }

  return {
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
    elevationM: topo.elevationM,
    topography: topo,
    mlSurrogateActive,
    ...(mlHazardScore !== undefined ? { mlHazardScore } : {}),
    rover: {
      status: roverStatus,
      score: roverScore,
      maxTraversableSlopeDeg: roverMaxSlope,
      currentSlopeDeg: slope,
      wheelSlipRisk,
      rockObstacleDensityPercent: rockCfa,
      groundClearanceRisk,
      rolloverMarginFactor: rolloverMargin,
      limitationsAndVetoReasons: roverVetoes,
    },
    astronautEva: {
      status: evaStatus,
      score: evaScore,
      currentSlopeDeg: slope,
      maxWalkingSlopeDeg: evaMaxSlope,
      fallAndPunctureRisk: fallRisk,
      metabolicCostWatts: metabolicWatts,
      oxygenBurnRateGramsPerHr,
      plssWalkBackLimitKm,
      thermalStressLevel: thermalStress,
      limitationsAndVetoReasons: evaVetoes,
    },
    overallSiteRecommendation: siteRecommendation,
  };
}
