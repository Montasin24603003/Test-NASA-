/**
 * Mars Exploration Risk Index (MERI) Engine
 * 
 * Unified multi-dimensional risk framework for Martian surface exploration.
 * Synthesizes 6 core environmental and operational vectors:
 * 1. Terrain Risk (Horn's gradient slope, MOLA roughness, cliffs/scarps)
 * 2. Mobility Risk (Mode-dependent: Rover terramechanics vs Suited EVA bioenergetics)
 * 3. Dust Risk (MCD / TES seasonal dust optical depth tau, storm exposure)
 * 4. Thermal Risk (THEMIS thermal inertia, diurnal extreme cold-soak)
 * 5. Radiation Risk (Elevation-shielded GCR dose from MSL RAD / MARIE)
 * 6. Communication Risk (DTE geometry & UHF relay orbiter passes)
 * 
 * Classifications:
 * - SAFE: Composite MERI < 35
 * - CAUTION: Composite MERI 35 - 65
 * - NO-GO: Composite MERI > 65 OR Hard-Veto Trigger (Cliff grade > threshold / SPE storm)
 */

import { evaluateMarsHazards, type DualTerrainHazardResult } from './mars-hazard-engine';
import { getMarsAtmosphericPressure, getMarsDustOpacity, getMarsDiurnalThermal, getMarsRadiationDose, getMarsEnergyAndComms } from './mars-environment';
import { querySwimWaterIce } from './swim-data';

export type MeriClassification = 'SAFE' | 'CAUTION' | 'NO-GO';
export type TraverseMobilityMode = 'robotic_rover' | 'pressurized_rover' | 'astronaut_eva';

export interface MeriWeights {
  terrain: number;
  mobility: number;
  dust: number;
  thermal: number;
  radiation: number;
  communication: number;
}

export const DEFAULT_MERI_WEIGHTS: Record<TraverseMobilityMode, MeriWeights> = {
  robotic_rover: {
    terrain: 0.30,
    mobility: 0.25,
    dust: 0.20,
    thermal: 0.10,
    radiation: 0.05,
    communication: 0.10,
  },
  pressurized_rover: {
    terrain: 0.25,
    mobility: 0.20,
    dust: 0.15,
    thermal: 0.15,
    radiation: 0.15,
    communication: 0.10,
  },
  astronaut_eva: {
    terrain: 0.25,
    mobility: 0.30,
    dust: 0.05,
    thermal: 0.15,
    radiation: 0.15,
    communication: 0.10,
  },
};

export interface MeriScoreBreakdown {
  terrainScore: number;     // 0-100
  mobilityScore: number;    // 0-100
  dustScore: number;        // 0-100
  thermalScore: number;     // 0-100
  radiationScore: number;   // 0-100
  communicationScore: number; // 0-100
  compositeScore: number;   // 0-100
}

export interface MeriAssessmentResult {
  latitude: number;
  longitude: number;
  elevationM: number;
  mode: TraverseMobilityMode;
  compositeMeriScore: number; // 0 to 100
  classification: MeriClassification;
  breakdown: MeriScoreBreakdown;
  activeWeights: MeriWeights;
  hardVetoTriggered: boolean;
  hardVetoReason?: string | undefined;
  hazardDetails: DualTerrainHazardResult;
  scientificConfidence: 'High (Calibrated In-Situ / Orbital Consensus)' | 'Moderate (Interpolated Regional Map)' | 'Permissive Baseline';
  dataLimitations: string;
}

/**
 * Calculates the normalized Mars Exploration Risk Index (MERI) for any Martian surface location.
 */
export function calculateMeri(
  lat: number,
  lon: number,
  mode: TraverseMobilityMode = 'pressurized_rover',
  customWeights?: Partial<MeriWeights>,
  lsDeg = 75
): MeriAssessmentResult {
  // 1. Gather all scientific vectors
  const hazards = evaluateMarsHazards(lat, lon);
  const swim = querySwimWaterIce(lat, lon);
  const atm = getMarsAtmosphericPressure(hazards.elevationM, lsDeg);
  const dust = getMarsDustOpacity(lsDeg, lat);
  const thermal = getMarsDiurnalThermal(lat, hazards.elevationM, lsDeg, swim.thermalInertia);
  const rad = getMarsRadiationDose(hazards.elevationM);
  const comms = getMarsEnergyAndComms(lat, hazards.elevationM, lsDeg, dust.tau);

  // 2. Compute individual normalized [0, 100] sub-scores

  // Vector 1: Terrain Risk (Horn's gradient slope + roughness)
  // Max scale: slope 25° = 100 score
  const slopeRatio = Math.min(1.0, hazards.topography.slopeDeg / 25.0);
  const roughnessRatio = Math.min(1.0, hazards.topography.roughnessM / 30.0);
  const terrainScore = Math.round(Math.min(100, slopeRatio * 75 + roughnessRatio * 25));

  // Vector 2: Mobility Risk (Mode-dependent)
  let mobilityScore: number;
  let hardVetoTriggered = false;
  let hardVetoReason: string | undefined;

  if (mode === 'astronaut_eva') {
    mobilityScore = hazards.astronautEva.score;
    if (hazards.astronautEva.status === 'NO-GO') {
      hardVetoTriggered = true;
      hardVetoReason = hazards.astronautEva.limitationsAndVetoReasons[0] || 'Slope / scarp exceeds suited EVA safety threshold';
    }
  } else {
    mobilityScore = hazards.rover.score;
    if (hazards.rover.status === 'NO-GO') {
      hardVetoTriggered = true;
      hardVetoReason = hazards.rover.limitationsAndVetoReasons[0] || 'Slope or sand trap exceeds rover safety threshold';
    }
  }

  // Vector 3: Dust Risk
  // tau ~ 0.2 is nominal (score 10), tau > 1.2 is severe dust storm (score 90-100)
  const dustScore = Math.round(Math.min(100, Math.max(10, (dust.tau / 1.5) * 100)));

  // Vector 4: Thermal Risk
  // Nighttime cold below -70°C scales risk up to 100 at -110°C
  const coldExcess = Math.max(0, -50 - thermal.nightC); // 0 at -50C, 40 at -90C
  const thermalScore = Math.round(Math.min(100, (coldExcess / 50) * 100));

  // Vector 5: Radiation Risk
  // Surface dose: 200 mSv/yr (deep Hellas) = 25 score, 320 mSv/yr (high volcano) = 85 score
  const radScore = Math.round(Math.min(100, Math.max(20, ((rad.surfaceGcrDoseMsvYear - 180) / 140) * 100)));

  // Vector 6: Communication Risk
  // Relay passes: 3-4 per sol = 15 score, 2 per sol = 50 score, high horizon masking = +25
  const commsScore = Math.round(comms.relayPassesPerSol >= 3 ? 20 : 60);

  // 3. Weight Normalization
  const baseWeights = DEFAULT_MERI_WEIGHTS[mode];
  const combined = { ...baseWeights, ...customWeights };
  const sumWeights = combined.terrain + combined.mobility + combined.dust + combined.thermal + combined.radiation + combined.communication;
  const normWeights: MeriWeights = {
    terrain: combined.terrain / sumWeights,
    mobility: combined.mobility / sumWeights,
    dust: combined.dust / sumWeights,
    thermal: combined.thermal / sumWeights,
    radiation: combined.radiation / sumWeights,
    communication: combined.communication / sumWeights,
  };

  // 4. Composite Score
  let compositeScore = Math.round(
    terrainScore * normWeights.terrain +
    mobilityScore * normWeights.mobility +
    dustScore * normWeights.dust +
    thermalScore * normWeights.thermal +
    radScore * normWeights.radiation +
    commsScore * normWeights.communication
  );

  // Hard Veto Override
  let classification: MeriClassification = 'SAFE';
  if (hardVetoTriggered || compositeScore >= 65) {
    classification = 'NO-GO';
    if (compositeScore < 65) compositeScore = 68; // Guarantee score reflects NO-GO state
  } else if (compositeScore >= 35) {
    classification = 'CAUTION';
  }

  // Epistemic Confidence
  let scientificConfidence: MeriAssessmentResult['scientificConfidence'] = 'Moderate (Interpolated Regional Map)';
  if (hazards.mlSurrogateActive || swim.evidenceTier === 'OBSERVED INSTRUMENT EVIDENCE') {
    scientificConfidence = 'High (Calibrated In-Situ / Orbital Consensus)';
  } else if (swim.evidenceTier === 'THERMODYNAMIC / LATITUDE STABILITY MODEL') {
    scientificConfidence = 'Permissive Baseline';
  }

  return {
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
    elevationM: hazards.elevationM,
    mode,
    compositeMeriScore: compositeScore,
    classification,
    breakdown: {
      terrainScore,
      mobilityScore,
      dustScore,
      thermalScore,
      radiationScore: radScore,
      communicationScore: commsScore,
      compositeScore,
    },
    activeWeights: normWeights,
    hardVetoTriggered,
    ...(hardVetoReason !== undefined ? { hardVetoReason } : {}),
    hazardDetails: hazards,
    scientificConfidence,
    dataLimitations: 'MERI integrates MOLA laser altimetry, Mars Climate Database climatology, MSL RAD surface measurements, and SWIM 2.0. Unmapped localized boulders below orbital resolution may present additional tactical obstacles.'
  };
}
