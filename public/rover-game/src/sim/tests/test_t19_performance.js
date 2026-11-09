/**
 * T19: PHYSICS SOLVER EXECUTION PERFORMANCE
 *
 * Contract & T19:
 * Average physics step under 0.10 ms (one rover), worst-case under 1.0 ms at 120 Hz.
 */

import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT19() {
  const sim = new CoreRoverPhysics();
  sim.spawnAt(0, 0);

  const dt = 1.0 / 120.0;
  const warmupSteps = 100;
  for (let i = 0; i < warmupSteps; i++) sim.step(dt);

  const benchmarkSteps = 1000;
  let maxStepMs = 0.0;

  const tStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  for (let i = 0; i < benchmarkSteps; i++) {
    const s0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    sim.step(dt);
    const s1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const elapsed = s1 - s0;
    if (elapsed > maxStepMs) maxStepMs = elapsed;
  }

  const tEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const totalMs = tEnd - tStart;
  const avgStepMs = totalMs / benchmarkSteps;

  const passed = avgStepMs < 0.10 && maxStepMs < 1.0;

  return {
    id: 'T19',
    name: 'Physics step execution performance (1000 steps)',
    expected: 'avg < 0.10 ms, max < 1.0 ms',
    got: `avg = ${avgStepMs.toFixed(4)} ms, max = ${maxStepMs.toFixed(3)} ms`,
    errorPct: `${((avgStepMs / 0.10) * 100).toFixed(1)}% of budget`,
    passed
  };
}
