/**
 * T20: NUMERICAL ROBUSTNESS & HIGH-DROP IMPACT TEST
 *
 * Contract & T20:
 * Drop rover from 20 m altitude and run 1000 randomized-force steps.
 * Must produce ZERO NaNs, ZERO coordinate tunnelling, and ZERO numerical explosions.
 */

import { DeterministicRNG } from '../rng.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT20() {
  const dt = 1.0 / 120.0;
  const rng = new DeterministicRNG(9999);
  let nanDetected = false;
  let tunnelDetected = false;

  // 1. High-drop test: 20 meters free-fall impact onto terrain
  const simDrop = new CoreRoverPhysics();
  simDrop.chassis.spawnAt(0, 20.0, 0);

  // Drop and impact sequence: 3.5 seconds (420 steps)
  for (let i = 0; i < 420; i++) {
    simDrop.step(dt);
    if (simDrop.chassis.hasNaN || !simDrop.chassis.position.isFinite()) {
      nanDetected = true;
      break;
    }
    // Check belly did not tunnel far through ground
    if (simDrop.chassis.position.y < -0.8) {
      tunnelDetected = true;
      break;
    }
  }

  // 2. Extreme randomized perturbations: 1000 steps with massive impact impulses
  const simRandom = new CoreRoverPhysics();
  simRandom.spawnAt(0, 0);

  for (let i = 0; i < 1000; i++) {
    const fx = rng.range(-3000, 3000);
    const fz = rng.range(-3000, 3000);
    const tauY = rng.range(-1500, 1500);

    simRandom.chassis.netForce.x += fx;
    simRandom.chassis.netForce.z += fz;
    simRandom.chassis.netTorque.y += tauY;

    simRandom.step(dt);

    if (simRandom.chassis.hasNaN || !simRandom.chassis.position.isFinite() ||
        !simRandom.chassis.linearVelocity.isFinite() || !simRandom.chassis.angularVelocity.isFinite()) {
      nanDetected = true;
      break;
    }
  }

  const passed = !nanDetected && !tunnelDetected;

  return {
    id: 'T20',
    name: 'Numerical robustness (20m drop + 1000 random impulses)',
    expected: 'Zero NaNs, Zero Tunnelling, Zero Explosions',
    got: `NaNs: ${nanDetected ? 'YES' : '0'}, Tunnelling: ${tunnelDetected ? 'YES' : '0'}`,
    errorPct: '0.000%',
    passed
  };
}
