/**
 * T14: SIMULATION DETERMINISM
 *
 * Contract C5:
 * Two independent simulation runs initialized with the exact same seed and inputs
 * yield bit-identical or within 1e-9 results. Zero non-deterministic random calls.
 */

import { DeterministicRNG } from '../rng.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT14() {
  const seed = 4242;
  const dt = 1.0 / 120.0;
  const steps = 600; // 5.0 simulated seconds

  // Run 1
  const rng1 = new DeterministicRNG(seed);
  const sim1 = new CoreRoverPhysics();
  sim1.spawnAt(0, 0);
  for (let i = 0; i < steps; i++) {
    // Generate deterministic external perturbation
    const pert = rng1.range(-0.5, 0.5);
    sim1.chassis.netForce.x += pert;
    sim1.step(dt);
  }
  const pos1 = sim1.chassis.position.clone();
  const q1 = sim1.chassis.quaternion.clone();

  // Run 2
  const rng2 = new DeterministicRNG(seed);
  const sim2 = new CoreRoverPhysics();
  sim2.spawnAt(0, 0);
  for (let i = 0; i < steps; i++) {
    const pert = rng2.range(-0.5, 0.5);
    sim2.chassis.netForce.x += pert;
    sim2.step(dt);
  }
  const pos2 = sim2.chassis.position.clone();
  const q2 = sim2.chassis.quaternion.clone();

  const posDiff = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y, pos1.z - pos2.z);
  const qDiff = Math.hypot(q1.x - q2.x, q1.y - q2.y, q1.z - q2.z, q1.w - q2.w);
  const maxDiff = Math.max(posDiff, qDiff);

  const passed = maxDiff <= 1e-9;

  return {
    id: 'T14',
    name: 'Seeded PRNG simulation determinism',
    expected: 'variance <= 1e-9',
    got: `max delta = ${maxDiff.toExponential(3)}`,
    errorPct: '0.000%',
    passed
  };
}
