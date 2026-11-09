/**
 * T07: COULOMB FRICTION CONE CLAMPING & WHEEL SPIN-UP
 *
 * Contract A6 & T07:
 * Command excess motor torque; the traction force per wheel never exceeds
 * mu * N (tolerance 1e-6 relative); the wheel spins up (slip -> 1.0).
 */

import { CoreRoverPhysics } from '../corePhysics.js';
import { SOIL_PROFILES } from '../soilModels.js';

export function runTestT07() {
  const dt = 1.0 / 120.0;
  const mu = 0.42;
  const soil = { ...SOIL_PROFILES.fine_sand, frictionCoeff: mu };

  const sim = new CoreRoverPhysics({ soil });
  sim.lockedWheels = false;
  sim.spawnAt(0, 0);

  // Settle
  for (let i = 0; i < 20; i++) sim.step(dt, 0.0, false);

  let maxViolation = 0.0;
  const steps = 180; // 1.5 seconds of full throttle

  for (let i = 0; i < steps; i++) {
    sim.step(dt, 1.0, false); // Maximum drive command

    for (const w of sim.wheelAssemblies) {
      if (w.normalForceN <= 0.0) continue;
      const fTangential = Math.hypot(w.tractionForceN, w.lateralForceN);
      const fLimit = mu * w.normalForceN;

      const violation = (fTangential - fLimit) / fLimit;
      if (violation > maxViolation) {
        maxViolation = violation;
      }
    }
  }

  // Final average slip across grounded wheels
  const finalSlip = sim.averageSlip;

  const conePassed = maxViolation <= 1e-6;
  const slipSpunUp = finalSlip > 0.45; // Wheel spins significantly faster than chassis
  const passed = conePassed && slipSpunUp;

  return {
    id: 'T07',
    name: 'Friction cone strict envelope & wheel spin-up',
    expected: 'Max violation <= 1e-6, slip spun up > 0.45',
    got: `Violation = ${maxViolation.toExponential(3)}, Final slip = ${finalSlip.toFixed(3)}`,
    errorPct: `${(maxViolation * 100).toFixed(6)}%`,
    passed
  };
}
