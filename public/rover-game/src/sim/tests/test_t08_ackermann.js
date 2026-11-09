/**
 * T08: FOUR-CORNER ACKERMANN STEERING & ICR GEOMETRY
 *
 * Contract E1 & T08:
 * For a commanded steer angle, each corner wheel steer angle satisfies:
 * delta_i = atan((z_mid - z_i) / (R + x_i))
 * and measured turning radius R = v / yawRate matches R_computed within 3.0%.
 */

import { CoreRoverPhysics } from '../corePhysics.js';
import { SOIL_PROFILES } from '../soilModels.js';

export function runTestT08() {
  const dt = 1.0 / 120.0;
  const sim = new CoreRoverPhysics({ soil: SOIL_PROFILES.bedrock });
  sim.lockedWheels = false;
  sim.spawnAt(0, 0);

  // Command steering angle delta = 0.35 rad (~20.0 deg left turn)
  const steerCmd = 0.35;
  sim.setSteerAngle(steerCmd);

  const zMid = 0.06;
  const Lref = 1.08;
  const expectedR = Lref / Math.tan(steerCmd); // ~2.956 m

  // 1. Verify individual wheel steering angles against analytical ICR formula
  let maxSteerAngleErrorRad = 0.0;
  for (const w of sim.wheelAssemblies) {
    if (!w.config.canSteer) {
      if (Math.abs(w.steerAngleRad) > 1e-6) maxSteerAngleErrorRad = Math.abs(w.steerAngleRad);
      continue;
    }
    const dLong = zMid - w.config.z;
    const denom = expectedR + w.config.x;
    const analyticAngle = Math.atan2(dLong, denom);
    const err = Math.abs(w.steerAngleRad - analyticAngle);
    if (err > maxSteerAngleErrorRad) maxSteerAngleErrorRad = err;
  }

  // 2. Drive into steady-state circular turn at kinematic maneuvering speed
  let sumR = 0;
  let count = 0;
  for (let i = 0; i < 900; i++) {
    sim.step(dt, 0.18, false);
    if (i >= 600) {
      const forwardV = sim.chassis.forwardSpeed;
      const yawRate = Math.abs(sim.chassis.angularVelocity.y);
      if (yawRate > 0.01) {
        sumR += forwardV / yawRate;
        count++;
      }
    }
  }

  // Measure steady-state turning radius: R_meas = v / omega_yaw
  const measuredR = count > 0 ? (sumR / count) : Infinity;

  const radiusErrorPct = (Math.abs(measuredR - expectedR) / expectedR) * 100.0;
  const passed = maxSteerAngleErrorRad <= 1e-4 && radiusErrorPct <= 3.0;

  return {
    id: 'T08',
    name: '4-corner Ackermann ICR turning radius & angles',
    expected: `R = ${expectedR.toFixed(3)} m, angle error <= 1e-4 rad`,
    got: `R = ${measuredR.toFixed(3)} m, max angle err = ${maxSteerAngleErrorRad.toExponential(2)} rad`,
    errorPct: `${radiusErrorPct.toFixed(2)}%`,
    passed
  };
}
