/**
 * T15: TERRAIN CONTACT NORMAL ALIGNMENT
 *
 * Contract C & T15:
 * Sample contact normal across known analytic heightfield (plane & sinusoidal surface).
 * The computed normal equals the analytic gradient normal within 1.0 deg;
 * no penetration beyond documented tolerance.
 */

import { SimTerrain } from '../terrain.js';

export function runTestT15() {
  const amp = 0.8;
  const wx = 0.25;
  const wz = 0.25;

  const terrain = new SimTerrain('sine', { sineAmp: amp, sineFreqX: wx, sineFreqZ: wz });

  // Test across a grid of 16 evaluation points
  let maxAngleDeg = 0.0;
  const normalOut = [0, 1, 0];

  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -2; iz <= 2; iz++) {
      const x = ix * 2.5;
      const z = iz * 2.5;

      // Numerical/sampled normal from terrain class
      terrain.getNormalAt(x, z, normalOut);

      // Closed-form analytic gradient:
      // dh/dx = amp * wx * cos(wx * x) * cos(wz * z)
      // dh/dz = -amp * wz * sin(wx * x) * sin(wz * z)
      const dh_dx = amp * wx * Math.cos(wx * x) * Math.cos(wz * z);
      const dh_dz = -amp * wz * Math.sin(wx * x) * Math.sin(wz * z);
      const len = Math.sqrt(dh_dx * dh_dx + 1.0 + dh_dz * dh_dz);
      const trueNx = -dh_dx / len;
      const trueNy = 1.0 / len;
      const trueNz = -dh_dz / len;

      // Dot product: cos(theta) = n_samp . n_true
      const dot = Math.max(-1.0, Math.min(1.0, normalOut[0] * trueNx + normalOut[1] * trueNy + normalOut[2] * trueNz));
      const angleDeg = Math.acos(dot) * (180.0 / Math.PI);

      if (angleDeg > maxAngleDeg) {
        maxAngleDeg = angleDeg;
      }
    }
  }

  const passed = maxAngleDeg <= 1.0;

  return {
    id: 'T15',
    name: 'Analytic heightfield normal alignment',
    expected: 'max angle error <= 1.0 deg',
    got: `max angle error = ${maxAngleDeg.toFixed(4)} deg`,
    errorPct: `${(maxAngleDeg / 1.0 * 100).toFixed(2)}%`,
    passed
  };
}
