/**
 * T03: REST & SLIDING ON SLOPES (10, 20, 30 deg)
 *
 * Contract A8:
 * - With mu > tan(theta): sum N = m*g*cos(theta) within 1%, and rover stays put.
 * - With mu < tan(theta): rover slides with a = g*(sin(theta) - mu*cos(theta)) within 2%.
 */

import { ROVER_MASS_KG, MARS_GRAVITY } from '../constants.js';
import { SimTerrain } from '../terrain.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT03() {
  const dt = 1.0 / 120.0;
  const slopes = [10.0, 20.0, 30.0];
  let allStaticPassed = true;
  let maxStaticErrorPct = 0.0;

  // 1. Static holding checks with mu = 0.85 (> tan(30 deg) = 0.577)
  for (const slopeDeg of slopes) {
    const terrain = new SimTerrain('incline', { slopeDeg, slopeDirectionDeg: 0 });
    const sim = new CoreRoverPhysics({ terrain, frictionCoeff: 0.85, soil: { frictionCoeff: 0.85 } });
    sim.lockedWheels = true;
    sim.spawnAt(0, 0);

    // Settle for 1.0 second (120 steps)
    for (let i = 0; i < 120; i++) sim.step(dt, 0.0, false);

    const theta = (slopeDeg * Math.PI) / 180.0;
    const expectedN = ROVER_MASS_KG * MARS_GRAVITY * Math.cos(theta);
    const gotN = sim.totalNormalForceN;
    const errPct = (Math.abs(gotN - expectedN) / expectedN) * 100.0;

    if (errPct > maxStaticErrorPct) maxStaticErrorPct = errPct;

    // Check rover holds position (stays put: speed < 0.02 m/s)
    const speed = sim.chassis.speedMagnitude;
    if (errPct > 1.0 || speed > 0.02) {
      allStaticPassed = false;
    }
  }

  // 2. Dynamic sliding check on 30 deg slope with mu = 0.20 (< tan(30 deg) = 0.577)
  const slideTerrain = new SimTerrain('incline', { slopeDeg: 30.0, slopeDirectionDeg: 0 });
  const slideSim = new CoreRoverPhysics({ terrain: slideTerrain, frictionCoeff: 0.20, soil: { frictionCoeff: 0.20 } });
  slideSim.lockedWheels = true;
  slideSim.spawnAt(0, 0);

  // Settle normal force for 0.1s (12 steps)
  for (let i = 0; i < 12; i++) slideSim.step(dt, 0.0, false);

  const v0 = slideSim.chassis.speedMagnitude;
  const slideDurationS = 1.0;
  const slideSteps = Math.round(slideDurationS / dt);

  for (let i = 0; i < slideSteps; i++) {
    slideSim.step(dt, 0.0, false);
  }

  const v1 = slideSim.chassis.speedMagnitude;
  const measuredA = (v1 - v0) / slideDurationS;

  const theta30 = (30.0 * Math.PI) / 180.0;
  const expectedA = MARS_GRAVITY * (Math.sin(theta30) - 0.20 * Math.cos(theta30)); // 1.2124 m/s^2
  const slideErrorPct = (Math.abs(measuredA - expectedA) / expectedA) * 100.0;

  const passed = allStaticPassed && slideErrorPct <= 2.0;

  return {
    id: 'T03',
    name: 'Rest on slopes 10/20/30 deg & dynamic slide',
    expected: `Static N err <= 1.0%, Slide a = ${expectedA.toFixed(3)} m/s^2`,
    got: `Max static err = ${maxStaticErrorPct.toFixed(2)}%, Slide a = ${measuredA.toFixed(3)} m/s^2`,
    errorPct: `${Math.max(maxStaticErrorPct, slideErrorPct).toFixed(2)}%`,
    passed
  };
}
