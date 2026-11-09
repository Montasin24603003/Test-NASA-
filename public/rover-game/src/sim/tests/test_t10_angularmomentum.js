/**
 * T10: ANGULAR MOMENTUM CONSERVATION & QUATERNION NORMALIZATION
 *
 * Contract A & T10:
 * In free fall (no contacts, zero external torque), total angular momentum vector
 * L = I_world * omega is strictly conserved to 1e-6 relative,
 * and quaternion norm remains 1.0 +/- 1e-9.
 */

import { ChassisRigidBody } from '../chassis.js';
import { Vec3 } from '../math3d.js';

export function runTestT10() {
  const chassis = new ChassisRigidBody();
  chassis.spawnAt(0, 100, 0);

  // Set non-trivial initial spin vector (all 3 axes)
  chassis.angularVelocity.set(0.65, 1.25, -0.48);
  chassis.integrate(0.0001); // Update world inertia tensor

  const L0 = chassis.getAngularMomentum(new Vec3());
  const L0_mag = L0.length();

  const dt = 1.0 / 120.0;
  const durationS = 5.0; // 600 steps
  const steps = Math.round(durationS / dt);

  let maxRelMomError = 0.0;
  let maxQuatNormError = 0.0;

  const currentL = new Vec3();

  for (let i = 0; i < steps; i++) {
    // Torque-free step: zero external forces or torques
    chassis.netForce.set(0, 0, 0);
    chassis.netTorque.set(0, 0, 0);

    chassis.integrate(dt);

    chassis.getAngularMomentum(currentL);
    const diffMag = Math.sqrt(
      Math.pow(currentL.x - L0.x, 2) +
      Math.pow(currentL.y - L0.y, 2) +
      Math.pow(currentL.z - L0.z, 2)
    );
    const relError = diffMag / L0_mag;
    if (relError > maxRelMomError) maxRelMomError = relError;

    const qNorm = chassis.quaternion.length();
    const qErr = Math.abs(qNorm - 1.0);
    if (qErr > maxQuatNormError) maxQuatNormError = qErr;
  }

  const momPassed = maxRelMomError <= 1e-6;
  const quatPassed = maxQuatNormError <= 1e-9;
  const passed = momPassed && quatPassed;

  return {
    id: 'T10',
    name: 'Angular momentum conservation & quaternion norm',
    expected: 'dL/L <= 1e-6, |norm(q)-1| <= 1e-9',
    got: `dL/L = ${maxRelMomError.toExponential(3)}, |norm-1| = ${maxQuatNormError.toExponential(3)}`,
    errorPct: `${(maxRelMomError * 100).toFixed(6)}%`,
    passed
  };
}
