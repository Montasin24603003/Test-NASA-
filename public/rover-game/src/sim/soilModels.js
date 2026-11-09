/**
 * TERRAMECHANICS SOIL MODELS & PARAMETER PROFILES
 *
 * Implements Physics Fundamentals Contract F:
 * - Bekker-Wong rigid-wheel pressure-sinkage equation:
 *     z_0 = [ (3 * F_N) / (b * (3 - n) * (k_c/b + k_phi) * sqrt(2*r)) ] ^ (2 / (2n + 1))
 * - Dynamic slip-sinkage enhancement: z_dyn = z_0 * (1 + c_slip * |s|)
 * - Janosi-Shields shear displacement relation:
 *     tau(j) = (c + sigma * tan(phi)) * (1 - exp(-j / K))
 * - Compaction rolling resistance:
 *     R_c = (b * (k_c/b + k_phi) / (n + 1)) * z_0^(n + 1)
 *
 * PROVENANCE TAG: [SIM-ESTIMATE]
 * Simplified continuum terramechanics models calibrated for 120 Hz real-time calculation.
 * Parameters referenced to Bekker (1960), Wong (2008), and Mars rover analogue soil mechanics.
 */

import { WHEEL_RADIUS_M, WHEEL_WIDTH_M } from './constants.js';

export const SOIL_PROFILES = Object.freeze({
  bedrock: {
    id: 'bedrock',
    name: 'Exposed Bedrock',
    kc: 5.0e5,        // N/m^(n+1)
    kphi: 1.0e7,      // N/m^(n+2)
    n: 1.35,          // sinkage exponent
    cohesionPa: 15000,// Pa
    frictionAngleDeg: 42.0, // deg
    frictionCoeff: 0.90,    // Coulomb mu
    shearModulusK: 0.008,   // m (Janosi K)
    baseRollingRes: 0.012,
    slipSinkageFactor: 0.02
  },
  hard_basalt: {
    id: 'hard_basalt',
    name: 'Hard Basaltic Pavement',
    kc: 2.0e5,
    kphi: 4.0e6,
    n: 1.25,
    cohesionPa: 8000,
    frictionAngleDeg: 38.0,
    frictionCoeff: 0.82,
    shearModulusK: 0.010,
    baseRollingRes: 0.018,
    slipSinkageFactor: 0.05
  },
  rocky_ground: {
    id: 'rocky_ground',
    name: 'Rocky Talus & Regolith',
    kc: 8.0e4,
    kphi: 1.5e6,
    n: 1.15,
    cohesionPa: 4500,
    frictionAngleDeg: 36.0,
    frictionCoeff: 0.74,
    shearModulusK: 0.015,
    baseRollingRes: 0.025,
    slipSinkageFactor: 0.12
  },
  loose_regolith: {
    id: 'loose_regolith',
    name: 'Martian Loose Regolith',
    kc: 1.5e4,
    kphi: 4.5e5,
    n: 1.05,
    cohesionPa: 1200,
    frictionAngleDeg: 32.0,
    frictionCoeff: 0.65,
    shearModulusK: 0.025,
    baseRollingRes: 0.040,
    slipSinkageFactor: 0.25
  },
  fine_sand: {
    id: 'fine_sand',
    name: 'Aeolian Fine Sand',
    kc: 3.5e3,
    kphi: 1.8e5,
    n: 0.95,
    cohesionPa: 400,
    frictionAngleDeg: 28.0,
    frictionCoeff: 0.48,
    shearModulusK: 0.035,
    baseRollingRes: 0.065,
    slipSinkageFactor: 0.45
  },
  dune_sand: {
    id: 'dune_sand',
    name: 'Active Dune Sand (Soft)',
    kc: 900.0,
    kphi: 6.5e4,
    n: 0.88,
    cohesionPa: 150,
    frictionAngleDeg: 24.0,
    frictionCoeff: 0.38,
    shearModulusK: 0.045,
    baseRollingRes: 0.090,
    slipSinkageFactor: 0.70
  }
});

export class TerramechanicsModel {
  /**
   * Compute static and dynamic wheel sinkage z_0 (meters)
   *
   * @param {number} normalForceN - Wheel normal reaction load F_N (N)
   * @param {object} soil - Soil profile from SOIL_PROFILES
   * @param {number} [slipRatio=0.0] - Slip ratio magnitude s in [0, 1]
   * @param {number} [wheelRadius=WHEEL_RADIUS_M] - Wheel radius r (m)
   * @param {number} [wheelWidth=WHEEL_WIDTH_M] - Wheel width b (m)
   * @returns {{ sinkageM: number, contactChordM: number, contactAreaM2: number }}
   */
  static computeSinkage(normalForceN, soil, slipRatio = 0.0, wheelRadius = WHEEL_RADIUS_M, wheelWidth = WHEEL_WIDTH_M) {
    if (normalForceN <= 0.0) {
      return { sinkageM: 0.0, contactChordM: 0.0, contactAreaM2: 0.0 };
    }

    const n = soil.n;
    const b = wheelWidth;
    const r = wheelRadius;
    const bekkerMod = (soil.kc / b) + soil.kphi;

    // Bekker-Wong rigid wheel sinkage closed-form:
    // denom = b * (3 - n) * (kc/b + kphi) * sqrt(2*r)
    const denom = Math.max(100.0, b * (3.0 - n) * bekkerMod * Math.sqrt(2.0 * r));
    const exponent = 2.0 / (2.0 * n + 1.0);
    const staticSinkageM = Math.pow((3.0 * normalForceN) / denom, exponent);

    // Dynamic slip-sinkage enhancement (digging effect under high slip)
    const slipFactor = 1.0 + (soil.slipSinkageFactor ?? 0.35) * Math.min(1.0, Math.abs(slipRatio));
    const dynamicSinkageM = staticSinkageM * slipFactor;

    // Contact chord length l_c ≈ sqrt(2*r*z - z^2)
    const zClamped = Math.max(0.0001, Math.min(r * 0.9, dynamicSinkageM));
    const contactChordM = Math.sqrt(Math.max(0.0001, 2.0 * r * zClamped - zClamped * zClamped));
    const contactAreaM2 = b * contactChordM;

    return {
      sinkageM: zClamped,
      contactChordM,
      contactAreaM2
    };
  }

  /**
   * Compute compaction rolling resistance force R_c (Newtons)
   * R_c = ( b * (kc/b + kphi) / (n + 1) ) * z_0^(n + 1)
   *
   * @param {number} sinkageM - Wheel sinkage z (m)
   * @param {object} soil - Soil profile
   * @param {number} [wheelWidth=WHEEL_WIDTH_M]
   * @returns {number} Resistance force (N >= 0)
   */
  static computeCompactionResistance(sinkageM, soil, wheelWidth = WHEEL_WIDTH_M) {
    if (sinkageM <= 0.0 || soil.id === 'bedrock' || soil.id === 'hard_basalt') return 0.0;
    const b = wheelWidth;
    const n = soil.n;
    const bekkerMod = (soil.kc / b) + soil.kphi;
    return (b * bekkerMod / (n + 1.0)) * Math.pow(sinkageM, n + 1.0);
  }

  /**
   * Compute Mohr-Coulomb & Janosi-Shields shear traction limit H_max (Newtons)
   * H_max = ( c * A_c + F_N * tan(phi) ) * ( 1 - exp(-j / K) )
   *
   * @param {number} normalForceN - Normal force F_N (N)
   * @param {number} contactAreaM2 - Contact area A_c (m^2)
   * @param {number} shearDisplacementM - Cumulative shear displacement j = int(|v_slip| dt) (m)
   * @param {object} soil - Soil profile
   * @returns {number} Maximum shear thrust limit (N)
   */
  static computeShearThrustLimit(normalForceN, contactAreaM2, shearDisplacementM, soil) {
    if (normalForceN <= 0.0) return 0.0;

    const tanPhi = Math.tan((soil.frictionAngleDeg * Math.PI) / 180.0);
    const mohrCoulombPeak = soil.cohesionPa * contactAreaM2 + normalForceN * tanPhi;

    // Bedrock & hard basalt: rigid pavement obeys full Mohr-Coulomb envelope
    if (soil.id === 'bedrock' || soil.id === 'hard_basalt') {
      return mohrCoulombPeak;
    }

    // Janosi-Shields shear development factor (1 - exp(-j / K))
    const K = soil.shearModulusK;
    const jEff = Math.max(0.008, shearDisplacementM);
    const janosiFactor = (jEff > 0 && K > 0)
      ? (1.0 - Math.exp(-jEff / K))
      : 1.0;

    return Math.max(0.0, mohrCoulombPeak * janosiFactor);
  }
}
