/**
 * T01: FREE FALL ON MARS
 *
 * Contract A4: Gravity is a body force m*g at the center of mass, g = 3.71 m/s^2.
 * Setup: Drop chassis from z0 = 2.0 m with contacts disabled.
 * Expected: y(t) = y0 - 0.5 * 3.71 * t^2.
 * Acceptance criteria: Error <= 0.5% over 1.0 second drop.
 */

import { MARS_GRAVITY } from '../constants.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT01() {
  const sim = new CoreRoverPhysics();
  sim.contactsEnabled = false; // Free fall, no contacts

  const y0 = 2.0;
  sim.chassis.spawnAt(0, y0, 0);

  const dt = 1.0 / 120.0;
  const durationS = 1.0;
  const steps = Math.round(durationS / dt);

  for (let i = 0; i < steps; i++) {
    sim.step(dt);
  }

  const tActual = steps * dt;
  const expectedY = y0 - 0.5 * MARS_GRAVITY * tActual * tActual;
  const gotY = sim.chassis.position.y;
  const errorAbs = Math.abs(gotY - expectedY);
  const errorPct = (errorAbs / Math.abs(expectedY - y0)) * 100.0;

  const passed = errorPct <= 0.5 && Number.isFinite(gotY);

  return {
    id: 'T01',
    name: 'Free fall on Mars (3.71 m/s^2)',
    expected: `y = ${expectedY.toFixed(4)} m`,
    got: `y = ${gotY.toFixed(4)} m`,
    errorPct: `${errorPct.toFixed(3)}%`,
    passed
  };
}
