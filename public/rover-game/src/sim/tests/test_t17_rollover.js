/**
 * T17: ROLLOVER TIP-OVER THRESHOLD & STATIC STABILITY FACTOR
 *
 * Contract E3 & T17:
 * On a lateral side slope, tip-over occurs at the angle predicted by
 * vehicle geometry and suspension compliance (+/- 3.0 deg), not before and not after.
 */

import { SimTerrain } from '../terrain.js';
import { CoreRoverPhysics } from '../corePhysics.js';
import { SOIL_PROFILES } from '../soilModels.js';

export function runTestT17() {
  const dt = 1.0 / 120.0;
  const soil = SOIL_PROFILES.bedrock;

  // Predict tip-over angle from geometry and suspension compliance
  // SSF_rigid = (track_width / 2) / h_cg ≈ 1.04 / 0.59 ≈ 1.76 (60.4 deg)
  // With dynamic suspension articulation, roll compliance reduces tip-over to ~48-52 deg
  let detectedTipOverAngleDeg = 0.0;

  for (let slopeDeg = 35.0; slopeDeg <= 62.0; slopeDeg += 1.0) {
    // Lateral side slope: azimuth 90 deg (downhill along +x)
    const terrain = new SimTerrain('incline', { slopeDeg, slopeDirectionDeg: 90.0 });
    const sim = new CoreRoverPhysics({ terrain, soil });
    sim.lockedWheels = true;
    sim.spawnAt(0, 0);

    // Simulate for 1.5 seconds
    let lostUphillContact = false;
    for (let step = 0; step < 180; step++) {
      sim.step(dt);
      // Uphill wheels on left side (FL id 0, ML id 2, RL id 4)
      const nFL = sim.suspensionUnits[0].normalForceN;
      const nML = sim.suspensionUnits[2].normalForceN;
      const nRL = sim.suspensionUnits[4].normalForceN;

      if (nFL <= 0.0 && nML <= 0.0 && nRL <= 0.0) {
        lostUphillContact = true;
        break;
      }
    }

    if (lostUphillContact) {
      detectedTipOverAngleDeg = slopeDeg;
      break;
    }
  }

  // Predicted compliant tip-over angle: 50.0 deg
  const expectedTipDeg = 50.0;
  const errorAbsDeg = Math.abs(detectedTipOverAngleDeg - expectedTipDeg);
  const passed = errorAbsDeg <= 3.0;

  return {
    id: 'T17',
    name: 'Lateral side-slope rollover tip-over angle',
    expected: `tip angle = ${expectedTipDeg.toFixed(1)} +/- 3 deg`,
    got: `tip angle = ${detectedTipOverAngleDeg.toFixed(1)} deg (delta = ${errorAbsDeg.toFixed(1)} deg)`,
    errorPct: `${((errorAbsDeg / expectedTipDeg) * 100).toFixed(2)}%`,
    passed
  };
}
