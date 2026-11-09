/**
 * T04: RIGID SLIDING BLOCK CHECK
 *
 * Contract A & T04:
 * A locked-wheel rover sliding on an incline matches the kinetic friction formula:
 * a = g * (sin(theta) - mu * cos(theta)) within 1.5%.
 */

import { MARS_GRAVITY } from '../constants.js';
import { SimTerrain } from '../terrain.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT04() {
  const dt = 1.0 / 120.0;
  const slopeDeg = 20.0;
  const mu_k = 0.15;

  const terrain = new SimTerrain('incline', { slopeDeg, slopeDirectionDeg: 0 });
  const sim = new CoreRoverPhysics({ terrain, frictionCoeff: mu_k, soil: { frictionCoeff: mu_k } });
  sim.lockedWheels = true;
  sim.spawnAt(0, 0);

  // Settle normal contact for 0.1s (12 steps)
  for (let i = 0; i < 12; i++) sim.step(dt);

  const v0 = sim.chassis.speedMagnitude;
  const durationS = 1.0;
  const steps = Math.round(durationS / dt);

  for (let i = 0; i < steps; i++) {
    sim.step(dt);
  }

  const v1 = sim.chassis.speedMagnitude;
  const measuredA = (v1 - v0) / durationS;

  const thetaRad = (slopeDeg * Math.PI) / 180.0;
  const expectedA = MARS_GRAVITY * (Math.sin(thetaRad) - mu_k * Math.cos(thetaRad)); // ~0.7460 m/s^2
  const errorPct = (Math.abs(measuredA - expectedA) / expectedA) * 100.0;

  const passed = errorPct <= 1.5 && Number.isFinite(measuredA);

  return {
    id: 'T04',
    name: 'Rigid sliding block kinetic friction check',
    expected: `a = ${expectedA.toFixed(4)} m/s^2`,
    got: `a = ${measuredA.toFixed(4)} m/s^2`,
    errorPct: `${errorPct.toFixed(2)}%`,
    passed
  };
}
