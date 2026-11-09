/**
 * T13: TIMESTEP CONVERGENCE
 *
 * Contract C6:
 * Halving dt (120 Hz vs 240 Hz) changes trajectory position after 10 s by less than 2.0%.
 */

import { SimTerrain } from '../terrain.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT13() {
  const durationS = 10.0;
  const slopeTerrain = new SimTerrain('incline', { slopeDeg: 15.0, slopeDirectionDeg: 0 });

  // Run 1: dt = 1/120 s (1200 steps)
  const dt1 = 1.0 / 120.0;
  const sim1 = new CoreRoverPhysics({ terrain: slopeTerrain, frictionCoeff: 0.20 });
  sim1.spawnAt(0, 0);
  const steps1 = Math.round(durationS / dt1);
  for (let i = 0; i < steps1; i++) sim1.step(dt1);
  const pos1 = sim1.chassis.position.clone();

  // Run 2: dt = 1/240 s (2400 steps)
  const dt2 = 1.0 / 240.0;
  const sim2 = new CoreRoverPhysics({ terrain: slopeTerrain, frictionCoeff: 0.20 });
  sim2.spawnAt(0, 0);
  const steps2 = Math.round(durationS / dt2);
  for (let i = 0; i < steps2; i++) sim2.step(dt2);
  const pos2 = sim2.chassis.position.clone();

  const diffX = pos1.x - pos2.x;
  const diffY = pos1.y - pos2.y;
  const diffZ = pos1.z - pos2.z;
  const distDiff = Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ);
  const totalTravel = Math.max(1.0, Math.sqrt(pos1.x * pos1.x + pos1.y * pos1.y + pos1.z * pos1.z));
  const errorPct = (distDiff / totalTravel) * 100.0;

  const passed = errorPct < 2.0 && Number.isFinite(errorPct);

  return {
    id: 'T13',
    name: 'Timestep convergence (120 Hz vs 240 Hz over 10s)',
    expected: 'variance < 2.0%',
    got: `variance = ${errorPct.toFixed(3)}% (delta = ${distDiff.toFixed(4)}m)`,
    errorPct: `${errorPct.toFixed(3)}%`,
    passed
  };
}
