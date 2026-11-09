/**
 * T11: CLOSED-SYSTEM ENERGY LEDGER CONSERVATION
 *
 * Contract B & T11:
 * Over a 60-second mixed simulation drive (driving, coasting, braking, suspension deflection),
 * energy ledger closure residual stays below 1.0% of throughput.
 * Energy is strictly accounted for and never spontaneously created.
 */

import { SimTerrain } from '../terrain.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT11() {
  const dt = 1.0 / 120.0;
  // Undulating terrain for mechanical work exchange
  const terrain = new SimTerrain('sine', { sineAmp: 0.35, sineFreqX: 0.15, sineFreqZ: 0.15 });
  const sim = new CoreRoverPhysics({ terrain });
  sim.lockedWheels = false;
  sim.spawnAt(0, 0);

  // Settle baseline
  for (let i = 0; i < 30; i++) sim.step(dt, 0.0, false);

  const durationS = 60.0; // 60 seconds (7200 steps)
  const totalSteps = Math.round(durationS / dt);

  // Execute mixed drive profile
  for (let step = 0; step < totalSteps; step++) {
    const t = step * dt;
    let throttle = 0.0;
    let brake = false;

    if (t < 15.0) {
      throttle = 0.45; // Acceleration
    } else if (t < 30.0) {
      throttle = 0.10; // Cruise
    } else if (t < 40.0) {
      throttle = 0.0;  // Coast
    } else if (t < 45.0) {
      brake = true;    // Hard brake
    } else {
      throttle = 0.30; // Resume drive
    }

    sim.step(dt, throttle, brake);
  }

  const snapshot = sim.energyLedger.getSnapshot();
  const residualPct = snapshot.closureResidualPct;
  const passed = residualPct < 1.0 && Number.isFinite(residualPct);

  return {
    id: 'T11',
    name: 'Energy ledger closed-system conservation (60s drive)',
    expected: 'closure residual < 1.0%',
    got: `residual = ${residualPct.toFixed(3)}% (delta = ${snapshot.closureResidualJ.toFixed(2)} J)`,
    errorPct: `${residualPct.toFixed(3)}%`,
    passed
  };
}
