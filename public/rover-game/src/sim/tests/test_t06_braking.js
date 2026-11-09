/**
 * T06: TRACTION-LIMITED BRAKING DISTANCE
 *
 * Contract A & T06:
 * From initial speed v0 on hard ground with full braking,
 * stopping distance d = v0^2 / (2 * mu * g) within 3.0%.
 */

import { MARS_GRAVITY } from '../constants.js';
import { CoreRoverPhysics } from '../corePhysics.js';
import { SOIL_PROFILES } from '../soilModels.js';

export function runTestT06() {
  const dt = 1.0 / 120.0;
  const mu = 0.80;
  const soil = { ...SOIL_PROFILES.bedrock, frictionCoeff: mu };

  const sim = new CoreRoverPhysics({ soil });
  sim.lockedWheels = false;
  sim.spawnAt(0, 0);

  // Settle suspension
  for (let i = 0; i < 20; i++) sim.step(dt, 0.0, false);

  // Set initial pure forward velocity v0 = 1.20 m/s
  const v0 = 1.20;
  sim.chassis.linearVelocity.set(0, 0, -v0);
  sim.chassis.speedMagnitude = v0;
  sim.chassis.forwardSpeed = v0;
  for (const w of sim.wheelAssemblies) {
    w.angularVelocity = v0 / w.radius;
  }

  const expectedDistM = (v0 * v0) / (2.0 * mu * MARS_GRAVITY); // ~0.2426 m

  let distanceM = 0.0;
  let steps = 0;
  const maxSteps = 360; // 3.0s max

  while (sim.chassis.forwardSpeed > 0.01 && steps < maxSteps) {
    const vPrev = sim.chassis.forwardSpeed;
    sim.step(dt, 0.0, true); // Full caliper braking
    const vCurr = sim.chassis.forwardSpeed;
    distanceM += 0.5 * (vPrev + Math.max(0.0, vCurr)) * dt;
    steps++;
  }

  const errorPct = (Math.abs(distanceM - expectedDistM) / expectedDistM) * 100.0;
  const passed = errorPct <= 3.0 && Number.isFinite(distanceM);

  return {
    id: 'T06',
    name: 'Traction-limited braking distance (v^2 / 2*mu*g)',
    expected: `d = ${expectedDistM.toFixed(4)} m`,
    got: `d = ${distanceM.toFixed(4)} m`,
    errorPct: `${errorPct.toFixed(2)}%`,
    passed
  };
}
