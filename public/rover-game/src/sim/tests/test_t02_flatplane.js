/**
 * T02: REST ON A FLAT PLANE
 *
 * Contract A5 & A8:
 * - Sum of wheel normal forces = m * g within 0.5%.
 * - No velocity drift over 60 s (v < 1e-4 m/s, zero jitter).
 */

import { ROVER_MASS_KG, MARS_GRAVITY } from '../constants.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT02() {
  const sim = new CoreRoverPhysics();
  sim.lockedWheels = true;
  sim.spawnAt(0, 0);

  const dt = 1.0 / 120.0;
  // Settle suspension for 2 seconds
  const settleSteps = 240;
  for (let i = 0; i < settleSteps; i++) {
    sim.step(dt);
  }

  const expectedNormalN = ROVER_MASS_KG * MARS_GRAVITY; // 3802.75 N
  const gotNormalN = sim.totalNormalForceN;
  const normalErrorPct = (Math.abs(gotNormalN - expectedNormalN) / expectedNormalN) * 100.0;

  // Now measure velocity drift over 60 simulated seconds (7200 steps)
  const driftSteps = Math.round(60.0 / dt);
  let maxVel = 0.0;

  for (let i = 0; i < driftSteps; i++) {
    sim.step(dt);
    const speed = sim.chassis.speedMagnitude;
    if (speed > maxVel) maxVel = speed;
  }

  const passed = normalErrorPct <= 0.5 && maxVel < 1e-4 && sim.groundedWheelsCount === 6;

  return {
    id: 'T02',
    name: 'Rest on flat plane (Sum N = m*g, zero drift in 60s)',
    expected: `N = ${expectedNormalN.toFixed(2)} N, v < 0.0001 m/s`,
    got: `N = ${gotNormalN.toFixed(2)} N, peak_v = ${maxVel.toExponential(2)} m/s`,
    errorPct: `${normalErrorPct.toFixed(3)}%`,
    passed
  };
}
