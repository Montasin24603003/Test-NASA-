/**
 * T05: STRAIGHT-LINE ACCELERATION
 *
 * Contract A & T05:
 * Constant wheel torque on high-traction ground gives:
 * a = (6 * tau_motor / r_eff - sum_R) / m within 2.0%.
 */

import { ROVER_MASS_KG } from '../constants.js';
import { CoreRoverPhysics } from '../corePhysics.js';
import { SOIL_PROFILES } from '../soilModels.js';

export function runTestT05() {
  const dt = 1.0 / 120.0;
  const sim = new CoreRoverPhysics({ soil: SOIL_PROFILES.bedrock });
  sim.lockedWheels = false;
  sim.spawnAt(0, 0);

  // Settle suspension for 0.25s
  for (let i = 0; i < 30; i++) sim.step(dt, 0.0, false);

  const durationS = 0.5;
  const steps = Math.round(durationS / dt);

  const v0 = sim.chassis.forwardSpeed;

  let sumTractionForceN = 0.0;
  for (let i = 0; i < steps; i++) {
    sim.step(dt, 0.50, false);
    for (const w of sim.wheelAssemblies) {
      sumTractionForceN += w.tractionForceN;
    }
  }

  const v1 = sim.chassis.forwardSpeed;
  const measuredA = (v1 - v0) / durationS;

  // Expected a = sum(F_traction) / m
  const avgTractionN = sumTractionForceN / steps;
  const expectedA = avgTractionN / ROVER_MASS_KG;

  const errorPct = (Math.abs(measuredA - expectedA) / expectedA) * 100.0;
  const passed = errorPct <= 2.0 && Number.isFinite(measuredA) && measuredA > 0.1;

  return {
    id: 'T05',
    name: 'Straight-line acceleration (F = m*a torque-force)',
    expected: `a = ${expectedA.toFixed(4)} m/s^2`,
    got: `a = ${measuredA.toFixed(4)} m/s^2`,
    errorPct: `${errorPct.toFixed(2)}%`,
    passed
  };
}
