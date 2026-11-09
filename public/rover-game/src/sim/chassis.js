/**
 * RIGID-BODY 6-DOF CHASSIS DYNAMICS
 *
 * Implements Physics Fundamentals Contract A & C:
 * - Angular momentum state formulation: L_world(t + dt) = L_world(t) + tau_net * dt
 *   omega = I_world^-1 * L_world (Conserves angular momentum to machine precision when tau = 0!)
 * - Velocity Verlet linear dynamics: x(t+dt) = x(t) + v(t)*dt + 0.5*a*dt^2
 *   v(t+dt) = v(t) + a*dt (Exact for free-fall under constant gravity!)
 * - World-frame inertia tensor: I_world = R * I_body * R^T
 * - Strict unit quaternion renormalization every step
 * - Zero artificial damping; explicit force accounting
 */

import {
  ROVER_MASS_KG,
  BODY_INERTIA_DIAG_KG_M2,
  COG_LOCAL_M,
  MARS_GRAVITY,
  TRACK_WIDTH_CORNER_M
} from './constants.js';
import { Vec3, Quat, Mat3 } from './math3d.js';

export class ChassisRigidBody {
  constructor(options = {}) {
    this.mass = options.mass ?? ROVER_MASS_KG;
    this.invMass = 1.0 / this.mass;
    this.gravity = options.gravity ?? MARS_GRAVITY;

    // Body-frame diagonal inertia tensor
    const ib = options.inertiaBodyDiag ?? BODY_INERTIA_DIAG_KG_M2;
    this.inertiaBodyDiag = new Vec3(ib[0], ib[1], ib[2]);
    this.invInertiaBodyDiag = new Vec3(1.0 / ib[0], 1.0 / ib[1], 1.0 / ib[2]);

    // Local center of gravity offset from geometric center
    const cog = options.cogLocal ?? COG_LOCAL_M;
    this.cogLocal = new Vec3(cog[0], cog[1], cog[2]);
    this.cogWorld = new Vec3();

    // 6-DOF Dynamic State
    this.position = new Vec3(0.0, 3.0, 0.0);
    this.quaternion = new Quat(0.0, 0.0, 0.0, 1.0);
    this.linearVelocity = new Vec3(0.0, 0.0, 0.0);
    this.angularVelocity = new Vec3(0.0, 0.0, 0.0);
    this.angularMomentumWorld = new Vec3(0.0, 0.0, 0.0);
    this.linearAcceleration = new Vec3(0.0, 0.0, 0.0);
    this.angularAcceleration = new Vec3(0.0, 0.0, 0.0);

    // Coordinate orientation matrices
    this.rotMatrix = new Mat3();
    this.inertiaWorld = new Mat3();
    this.invInertiaWorld = new Mat3();

    // Force & Torque Accumulators
    this.netForce = new Vec3();
    this.netTorque = new Vec3();

    // Unit directions in world frame
    this.forwardWorld = new Vec3(0.0, 0.0, -1.0);
    this.upWorld = new Vec3(0.0, 1.0, 0.0);
    this.rightWorld = new Vec3(1.0, 0.0, 0.0);

    // Telemetry & Stability
    this.forwardSpeed = 0.0;
    this.speedMagnitude = 0.0;
    this.pitchDeg = 0.0;
    this.rollDeg = 0.0;
    this.headingDeg = 0.0;
    this.staticStabilityFactor = 1.48;
    this.rolloverMarginPct = 100.0;
    this.clampEvents = 0;
    this.hasNaN = false;

    // Scratch buffers
    this._tmpV1 = new Vec3();
    this._tmpV2 = new Vec3();
    this._tmpV3 = new Vec3();
    this._rotTranspose = new Mat3();
    this._matDiag = new Mat3();
    this._deltaQ = new Quat();

    this._updateDerivedTensors();
  }

  /**
   * Recompute world-frame inertia tensors from current orientation
   * I_world = R * I_body * R^T
   * I_world^-1 = R * I_body^-1 * R^T
   * @private
   */
  _updateDerivedTensors() {
    this.rotMatrix.setFromQuaternion(this.quaternion);
    this._rotTranspose.copy(this.rotMatrix).transpose();

    // I_world = R * diag(I_body) * R^T
    this._matDiag.setDiagonal(this.inertiaBodyDiag.x, this.inertiaBodyDiag.y, this.inertiaBodyDiag.z);
    this.inertiaWorld.multiplyMatrices(this.rotMatrix, this._matDiag).multiply(this._rotTranspose);

    // I_world^-1 = R * diag(I_body^-1) * R^T
    this._matDiag.setDiagonal(this.invInertiaBodyDiag.x, this.invInertiaBodyDiag.y, this.invInertiaBodyDiag.z);
    this.invInertiaWorld.multiplyMatrices(this.rotMatrix, this._matDiag).multiply(this._rotTranspose);

    // Update basis vectors
    this.rightWorld.set(1.0, 0.0, 0.0).applyMatrix3(this.rotMatrix);
    this.upWorld.set(0.0, 1.0, 0.0).applyMatrix3(this.rotMatrix);
    this.forwardWorld.set(0.0, 0.0, -1.0).applyMatrix3(this.rotMatrix);

    // Update world Center of Gravity
    this.cogWorld.copy(this.cogLocal).applyMatrix3(this.rotMatrix).add(this.position);

    // Dynamic Static Stability Factor (SSF)
    const hCg = Math.max(0.3, this.cogWorld.y);
    const halfTrack = TRACK_WIDTH_CORNER_M * 0.5;
    this.staticStabilityFactor = halfTrack / hCg;

    // Compute Tait-Bryan pitch, roll, heading (deg)
    this._computeEulerAngles();
  }

  /**
   * Extract pitch, roll, heading angles in degrees
   * @private
   */
  _computeEulerAngles() {
    const e = this.rotMatrix.elements;
    // Pitch: angle of forward vector (-e[6], -e[7], -e[8]) out of X-Z plane
    this.pitchDeg = Math.asin(Math.max(-1.0, Math.min(1.0, -e[7]))) * (180.0 / Math.PI);
    // Roll: tilt angle around forward axis (lateral tilt of up vector e[3], e[4])
    this.rollDeg = Math.atan2(e[3], e[4]) * (180.0 / Math.PI);
    // Heading: compass bearing of forward vector in X-Z horizontal plane (0 deg = North/-z, 90 deg = East/+x)
    this.headingDeg = (Math.atan2(-e[6], e[8]) * (180.0 / Math.PI) + 360.0) % 360.0;

    const tipAngleDeg = Math.atan(this.staticStabilityFactor) * (180.0 / Math.PI);
    const absRoll = Math.abs(this.rollDeg);
    this.rolloverMarginPct = Math.max(0.0, Math.min(100.0, (1.0 - absRoll / tipAngleDeg) * 100.0));
  }

  /**
   * Reset net force & torque accumulators and apply Martian gravity
   */
  beginStep() {
    this.netForce.set(0.0, 0.0, 0.0);
    this.netTorque.set(0.0, 0.0, 0.0);

    // Pure body force gravity m * g applied downwards at Center of Gravity
    this.netForce.y -= this.mass * this.gravity;
  }

  /**
   * Apply an external force at the Center of Gravity (zero torque)
   */
  applyForce(forceWorld) {
    this.netForce.add(forceWorld);
  }

  /**
   * Apply an external force at a world-space point
   * tau = (point - cogWorld) x force
   */
  applyForceAtWorldPoint(forceWorld, pointWorld) {
    this.netForce.add(forceWorld);
    const r = this._tmpV1.copy(pointWorld).sub(this.cogWorld);
    const tau = this._tmpV2.crossVectors(r, forceWorld);
    this.netTorque.add(tau);
  }

  /**
   * Apply a pure couple torque directly to the chassis
   */
  applyTorque(torqueWorld) {
    this.netTorque.add(torqueWorld);
  }

  /**
   * Advance rigid-body state by dt seconds using Velocity Verlet & Momentum Formulation
   * @param {number} dt - Step duration (s)
   */
  integrate(dt) {
    if (dt <= 0) return;

    if (!this.position.isFinite() || !this.linearVelocity.isFinite() ||
        !this.quaternion.isFinite() || !this.angularVelocity.isFinite()) {
      this.hasNaN = true;
      return;
    }

    // 1. Linear dynamics: Velocity Verlet
    // a = F / m
    this.linearAcceleration.copy(this.netForce).scale(this.invMass);
    // x(t+dt) = x(t) + v(t)*dt + 0.5*a*dt^2
    this.position.addScaled(this.linearVelocity, dt).addScaled(this.linearAcceleration, 0.5 * dt * dt);
    // v(t+dt) = v(t) + a*dt
    this.linearVelocity.addScaled(this.linearAcceleration, dt);

    // 2. Rotational dynamics: Angular Momentum Formulation
    // In world coordinates: dL_world / dt = tau_world
    // L_world(t+dt) = L_world(t) + tau_world * dt
    this.angularMomentumWorld.addScaled(this.netTorque, dt);

    // Calculate angular velocity: omega = I_world^-1 * L_world
    this.angularVelocity.copy(this.angularMomentumWorld).applyMatrix3(this.invInertiaWorld);

    // Physical bound clamp on extreme angular velocity (12 rad/s)
    const omegaMag = this.angularVelocity.length();
    const maxOmega = 12.0;
    if (omegaMag > maxOmega) {
      this.angularVelocity.scale(maxOmega / omegaMag);
      this.angularMomentumWorld.copy(this.angularVelocity).applyMatrix3(this.inertiaWorld);
      this.clampEvents++;
    }

    // 3. Quaternion integration via exact exponential map:
    // delta_q = [ sin(|w|*dt/2) * (w / |w|), cos(|w|*dt/2) ]
    const speedW = this.angularVelocity.length();
    if (speedW > 1e-12) {
      const halfAngle = speedW * dt * 0.5;
      const s = Math.sin(halfAngle) / speedW;
      this._deltaQ.set(
        this.angularVelocity.x * s,
        this.angularVelocity.y * s,
        this.angularVelocity.z * s,
        Math.cos(halfAngle)
      );
      this.quaternion.premultiply(this._deltaQ);
    }
    // Strict unit quaternion renormalization every step
    this.quaternion.normalize();

    // 4. Update tensors and derived telemetry
    this._updateDerivedTensors();
    // Re-synchronize angular velocity to world inertia
    this.angularVelocity.copy(this.angularMomentumWorld).applyMatrix3(this.invInertiaWorld);

    this.forwardSpeed = this.linearVelocity.dot(this.forwardWorld);
    this.speedMagnitude = this.linearVelocity.length();
  }

  /**
   * Kinetic energy: translational + rotational
   * E_k = 0.5 * m * v^2 + 0.5 * omega^T * I_world * omega
   */
  getKineticEnergy() {
    const eTrans = 0.5 * this.mass * this.linearVelocity.lengthSq();
    const eRot = 0.5 * this.angularVelocity.dot(this.angularMomentumWorld);
    return eTrans + eRot;
  }

  /**
   * Gravitational potential energy:
   * E_p = m * g * y_cog
   */
  getPotentialEnergy(refDatumY = 0.0) {
    return this.mass * this.gravity * (this.cogWorld.y - refDatumY);
  }

  /**
   * Total angular momentum vector in world frame
   */
  getAngularMomentum(out = new Vec3()) {
    return out.copy(this.angularMomentumWorld);
  }

  /**
   * Velocity of a rigid-body point in world coordinates:
   * v_p = v_chassis + omega x (p - cogWorld)
   */
  getPointVelocity(pointWorld, out = new Vec3()) {
    const r = this._tmpV1.copy(pointWorld).sub(this.cogWorld);
    const vRot = this._tmpV2.crossVectors(this.angularVelocity, r);
    return out.copy(this.linearVelocity).add(vRot);
  }

  /**
   * Kinematic spawn (only allowed at startup, respawn, or recovery)
   */
  spawnAt(x, y, z, headingRad = 0.0, pitchRad = 0.0, rollRad = 0.0) {
    this.position.set(x, y, z);

    // Compose yaw, pitch, roll orientation
    const qYaw = new Quat().setFromAxisAngle(new Vec3(0, 1, 0), headingRad);
    const qPitch = new Quat().setFromAxisAngle(new Vec3(1, 0, 0), pitchRad);
    const qRoll = new Quat().setFromAxisAngle(new Vec3(0, 0, 1), rollRad);

    this.quaternion.copy(qYaw).multiply(qPitch).multiply(qRoll).normalize();
    this.linearVelocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.angularMomentumWorld.set(0, 0, 0);
    this.linearAcceleration.set(0, 0, 0);
    this.angularAcceleration.set(0, 0, 0);
    this.hasNaN = false;
    this._updateDerivedTensors();
  }
}
