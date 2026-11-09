/**
 * ROTATIONAL WHEEL DYNAMICS, SLIP RATIO & FRICTION CONE ELLIPSE
 *
 * Implements Physics Fundamentals Contract A6, A7, B3, F4:
 * - J_w * (d_omega / dt) = tau_motor - F_x * r_eff - tau_roll - tau_brake
 * - Wheel and chassis coupled ONLY through contact force F_x
 * - Strict Coulomb friction cone / ellipse: sqrt(F_x^2 + F_y^2) <= mu * N
 * - Slip ratio: s = (omega * r_eff - v_x) / max(|omega * r_eff|, |v_x|, eps)
 * - Slip power dissipation: P_slip = F_x * (omega * r_eff - v_x) >= 0
 * - Four-corner Ackermann ICR steering integration
 */

import {
  WHEEL_RADIUS_M,
  WHEEL_WIDTH_M,
  WHEEL_INERTIA_KG_M2
} from './constants.js';
import { Vec3 } from './math3d.js';
import { WheelActuatorMotor } from './motors.js';
import { TerramechanicsModel } from './soilModels.js';

export class SimWheelAssembly {
  constructor(wheelConfig, options = {}) {
    this.config = wheelConfig; // { id, name, axle, x, y, z, side, canSteer }

    this.radius = options.radius ?? WHEEL_RADIUS_M;
    this.width = options.width ?? WHEEL_WIDTH_M;
    this.inertiaJw = options.inertia ?? WHEEL_INERTIA_KG_M2;

    // Hub Actuator Motor
    this.motor = new WheelActuatorMotor(options.motorOptions || {});

    // Rotational State
    this.spinRad = 0.0;          // Cumulative rotation angle theta (rad)
    this.angularVelocity = 0.0;  // omega (rad/s)
    this.rpm = 0.0;              // RPM

    // Steering Kinematics (Ackermann)
    this.steerAngleRad = 0.0;
    this.steerAngleDeg = 0.0;

    // Contact Forces (Newtons & Newton-meters)
    this.driveTorqueNm = 0.0;
    this.brakeTorqueNm = 0.0;
    this.rollingResistanceTorqueNm = 0.0;
    this.normalForceN = 0.0;
    this.tractionForceN = 0.0;   // Longitudinal tire-ground force F_x
    this.lateralForceN = 0.0;    // Lateral cornering force F_y
    this.frictionUtilization = 0.0; // sqrt(Fx^2 + Fy^2) / (mu * N)

    // Terramechanics State
    this.slipRatio = 0.0;        // Signed s in [-1, +1]
    this.slipMagnitude = 0.0;    // |s| in [0, 1]
    this.slipAngleRad = 0.0;
    this.sinkageM = 0.005;       // Bekker sinkage
    this.effectiveRadius = this.radius;
    this.cumulativeShearDispM = 0.0;

    // Energy & Power Ledger Feeds (Watts)
    this.mechanicalPowerW = 0.0;
    this.groundPowerW = 0.0;
    this.slipLossPowerW = 0.0;

    // Orientation vectors in world frame
    this.wheelForwardWorld = new Vec3(0, 0, -1);
    this.wheelRightWorld = new Vec3(1, 0, 0);

    // Scratch buffers
    this._tmpFwd = new Vec3();
    this._tmpRight = new Vec3();
  }

  /**
   * Set Ackermann steering angle for this wheel
   * @param {number} angleRad
   */
  setSteerAngle(angleRad) {
    if (!this.config.canSteer) {
      this.steerAngleRad = 0.0;
      this.steerAngleDeg = 0.0;
      return;
    }
    // Limit steering actuator to +/- 35 deg (+/- 0.61 rad)
    this.steerAngleRad = Math.max(-0.61, Math.min(0.61, angleRad));
    this.steerAngleDeg = this.steerAngleRad * (180.0 / Math.PI);
  }

  /**
   * Update wheel forward and lateral unit vectors based on chassis basis and steer angle
   * @param {Vec3} chassisFwdWorld
   * @param {Vec3} chassisRightWorld
   */
  updateOrientation(chassisFwdWorld, chassisRightWorld) {
    const cosS = Math.cos(this.steerAngleRad);
    const sinS = Math.sin(this.steerAngleRad);

    // Steered forward: cos(delta)*fwd - sin(delta)*right
    this.wheelForwardWorld.copy(chassisFwdWorld).scale(cosS)
      .addScaled(chassisRightWorld, -sinS).normalize();

    // Steered right: cos(delta)*right + sin(delta)*fwd
    this.wheelRightWorld.copy(chassisRightWorld).scale(cosS)
      .addScaled(chassisFwdWorld, sinS).normalize();
  }

  /**
   * Evaluate wheel-terrain contact forces and integrate angular velocity
   *
   * @param {number} dt - Step duration (s)
   * @param {number} normalForceN - Ground normal reaction N (>= 0)
   * @param {Vec3} contactVelocityWorld - World velocity of wheel contact point
   * @param {number} throttleInput - Commanded throttle [-1, +1]
   * @param {boolean} brakeEngaged - Mechanical brake command
   * @param {object} soil - Terramechanics soil profile
   * @returns {{ forceWorld: Vec3, slipPowerW: number, copperLossW: number }}
   */
  evaluate(dt, normalForceN, contactVelocityWorld, throttleInput, brakeEngaged, soil, vehicleForwardSpeed = 0.0) {
    this.normalForceN = Math.max(0.0, normalForceN);

    // 1. Terramechanics sinkage and effective rolling radius
    const sinkageData = TerramechanicsModel.computeSinkage(
      this.normalForceN,
      soil,
      this.slipMagnitude,
      this.radius,
      this.width
    );
    this.sinkageM = sinkageData.sinkageM;
    this.effectiveRadius = Math.max(this.radius * 0.7, this.radius - this.sinkageM / 3.0);

    // 2. Project ground velocity into wheel coordinate frame:
    // v_long = v_contact . wheelForward
    // v_lat  = v_contact . wheelRight
    const vLong = contactVelocityWorld.dot(this.wheelForwardWorld);
    const vLat  = contactVelocityWorld.dot(this.wheelRightWorld);

    // 3. Electric motor hub actuator torque
    const motorRes = this.motor.evaluate(throttleInput, this.angularVelocity);
    this.driveTorqueNm = motorRes.torqueNm;

    // 4. Caliper friction braking
    let brakeTorque = 0.0;
    if (brakeEngaged) {
      // 350 N*m caliper braking clamp capacity per wheel
      brakeTorque = 350.0;
    }
    this.brakeTorqueNm = brakeTorque;

    // 5. Compaction and tire rolling resistance torque
    const compactionResN = TerramechanicsModel.computeCompactionResistance(this.sinkageM, soil, this.width);
    const internalRollingN = (soil.baseRollingRes ?? 0.04) * this.normalForceN;
    const totalRollingResN = compactionResN + internalRollingN;
    this.rollingResistanceTorqueNm = totalRollingResN * this.effectiveRadius;

    // 6. Longitudinal slip ratio s:
    // s = (omega * r_eff - v_long) / max(|omega * r_eff|, |v_long|, eps)
    const rimSpeed = this.angularVelocity * this.effectiveRadius;
    const maxRefSpeed = Math.max(Math.abs(rimSpeed), Math.abs(vLong), 0.005);
    this.slipRatio = (rimSpeed - vLong) / maxRefSpeed;
    this.slipMagnitude = Math.min(1.0, Math.abs(this.slipRatio));

    // Lateral slip angle alpha:
    this.slipAngleRad = Math.atan2(vLat, Math.abs(vLong) + 0.005);

    // Cumulative shear displacement for Janosi shear development
    const slipSpeed = Math.abs(rimSpeed - vLong);
    this.cumulativeShearDispM += slipSpeed * dt;

    // 7. Mohr-Coulomb & Janosi shear envelope traction limit
    const mu = soil.frictionCoeff ?? 0.65;
    const maxCoulombFriction = mu * this.normalForceN;
    const janosiLimit = TerramechanicsModel.computeShearThrustLimit(
      this.normalForceN,
      sinkageData.contactAreaM2,
      this.cumulativeShearDispM,
      soil
    );
    const tractionLimitN = brakeEngaged
      ? maxCoulombFriction
      : Math.min(maxCoulombFriction, Math.max(1.0, janosiLimit));

    // 8. Contact forces: F_long demand and cornering stiffness F_lat
    let fLongDemand = 0.0;
    if (this.normalForceN > 0.0) {
      if (brakeEngaged) {
        // Caliper braking opposes longitudinal motion
        const maxBrakeThrust = Math.min(tractionLimitN, brakeTorque / this.effectiveRadius);
        const mEff = 170.83;
        const vRef = (Math.abs(vehicleForwardSpeed) > 0.005) ? vehicleForwardSpeed : vLong;
        const arrestThrust = (mEff * Math.abs(vRef)) / Math.max(1e-4, dt);
        const brakeMag = Math.min(maxBrakeThrust, arrestThrust);
        const brakeDir = Math.sign(vRef) || 1.0;
        fLongDemand = -brakeDir * brakeMag;
      } else if (Math.abs(throttleInput) > 0.01) {
        // Semi-implicit terramechanics wheel angular velocity integration:
        // (Jw/dt + C_slip * r^2) * omega(t+dt) = (Jw/dt)*omega(t) + tau_motor + C_slip*r*v - tau_roll
        const K = soil.shearModulusK ?? 0.02;
        const cSlip = Math.max(200.0, (this.normalForceN * mu) / (K * 5.0));
        const rEff = this.effectiveRadius;
        const rollTorqueOppose = Math.sign(this.angularVelocity || 1.0) * this.rollingResistanceTorqueNm;
        const driveDir = Math.sign(throttleInput) || 1.0;

        const denom = (this.inertiaJw / dt) + cSlip * rEff * rEff;
        const numer = (this.inertiaJw / dt) * this.angularVelocity + this.driveTorqueNm + cSlip * rEff * vLong - rollTorqueOppose;
        const nextOmega = driveDir * Math.max(0.0, driveDir * (numer / denom));

        // Tractive force demand from contact slip
        fLongDemand = cSlip * (nextOmega * rEff - vLong);

        // Check if tractive force demand exceeds Coulomb / Janosi traction limit (Contract A6 & A7)
        if (Math.abs(fLongDemand) > tractionLimitN && (this.driveTorqueNm * driveDir > 0)) {
          // Wheel spin-up / saturation regime:
          // Ground reaction force is clamped at traction limit:
          const fTractionActual = driveDir * tractionLimitN;
          fLongDemand = fTractionActual;
          // Excess torque accelerates wheel angular velocity (Newton's Contract A7):
          const netTorque = this.driveTorqueNm - fTractionActual * rEff - rollTorqueOppose;
          if (netTorque * driveDir > 0) {
            const angAccel = netTorque / this.inertiaJw;
            this.angularVelocity += angAccel * dt;
          } else {
            this.angularVelocity = nextOmega;
          }
        } else {
          this.angularVelocity = nextOmega;
        }
      } else {
        // Coasting: wheels roll freely with bearing & base rolling resistance (Contract A7 & A8)
        const rollingResistN = (soil.baseRollingRes ?? 0.02) * this.normalForceN;
        fLongDemand = -rollingResistN * Math.tanh(vLong / 0.005);
      }
    }

    // Lateral cornering stiffness & Static Stick:
    const corneringStiffness = (1200.0 + 800.0 * mu);
    const mEffLat = 170.83;
    const arrestLat = (mEffLat * Math.abs(vLat)) / Math.max(1e-4, dt);
    let fLatDemand = 0.0;
    if (Math.abs(vLat) < 0.005 && arrestLat < tractionLimitN) {
      fLatDemand = -Math.sign(vLat) * arrestLat;
    } else {
      fLatDemand = -vLat * corneringStiffness;
    }

    // 9. Coulomb Friction Circle Clamping:
    // sqrt(F_long^2 + F_lat^2) <= mu * N
    const demandMag = Math.hypot(fLongDemand, fLatDemand);
    if (demandMag > tractionLimitN && demandMag > 1e-6) {
      const scale = tractionLimitN / demandMag;
      this.tractionForceN = fLongDemand * scale;
      this.lateralForceN = fLatDemand * scale;
      this.frictionUtilization = 1.0;
    } else {
      this.tractionForceN = fLongDemand;
      this.lateralForceN = fLatDemand;
      this.frictionUtilization = tractionLimitN > 0.001 ? (demandMag / tractionLimitN) : 0.0;
    }

    // 10. Wheel Angular Dynamics & RPM bookkeeping (Contract A7):
    if (dt > 0.0) {
      if (brakeEngaged) {
        const maxDeltaW = (this.brakeTorqueNm / this.inertiaJw) * dt;
        if (Math.abs(this.angularVelocity) <= maxDeltaW) {
          this.angularVelocity = 0.0;
        } else {
          this.angularVelocity -= Math.sign(this.angularVelocity) * maxDeltaW;
        }
      } else if (Math.abs(throttleInput) <= 0.01) {
        // Coasting: wheel smoothly couples to ground speed vLong / rEff
        const targetOmega = vLong / this.effectiveRadius;
        const blend = 1.0 - Math.exp(-dt * 10.0);
        this.angularVelocity += (targetOmega - this.angularVelocity) * blend;
      }

      this.rpm = (this.angularVelocity * 60.0) / (2.0 * Math.PI);
      this.spinRad += this.angularVelocity * dt;
    }

    // 11. Mechanical & Slip Power Accounting (Contract B3):
    this.mechanicalPowerW = this.driveTorqueNm * this.angularVelocity;
    this.groundPowerW = this.tractionForceN * vLong;
    // P_slip = F_long * (omega * r_eff - v_long) >= 0 evaluated with updated rim speed
    const actualRimSpeed = this.angularVelocity * this.effectiveRadius;
    this.slipLossPowerW = Math.max(0.0, this.tractionForceN * (actualRimSpeed - vLong));

    // Compose 3D tire contact force vector in world coordinates
    // Longitudinal force applied to chassis is Drawbar Pull: DP = F_traction - R_c (Contract F)
    let drawbarPullN = 0.0;
    let rollingLossW = 0.0;
    if (brakeEngaged) {
      drawbarPullN = this.tractionForceN;
      rollingLossW = 0.0;
    } else if (Math.abs(throttleInput) > 0.01) {
      // Driving: DP = F_traction - R_c (clamped to prevent reverse propulsion)
      const compactionRetard = Math.min(compactionResN, Math.abs(this.tractionForceN));
      drawbarPullN = this.tractionForceN - Math.sign(this.tractionForceN || 1.0) * compactionRetard;
      const totalRollRetard = compactionRetard + internalRollingN * 0.32;
      rollingLossW = totalRollRetard * Math.abs(vLong);
    } else {
      // Coasting / Static holding: internal rolling and soil resistance retard motion
      const totalHoldN = compactionResN + internalRollingN;
      drawbarPullN = -totalHoldN * Math.tanh(vLong / 0.005);
      rollingLossW = Math.abs(drawbarPullN * vLong);
    }
    this.rollingLossPowerW = rollingLossW;

    const forceWorld = this._tmpFwd.copy(this.wheelForwardWorld).scale(drawbarPullN)
      .addScaled(this.wheelRightWorld, this.lateralForceN);

    return {
      forceWorld,
      slipPowerW: this.slipLossPowerW,
      copperLossW: motorRes.copperLossW
    };
  }
}
