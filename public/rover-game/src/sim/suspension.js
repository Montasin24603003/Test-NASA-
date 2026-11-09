/**
 * ROCKER-BOGIE PER-WHEEL SUSPENSION MECHANICS
 *
 * Implements Physics Fundamentals Contract A5, B1 & C2:
 * - Spring-damper force along ground reaction normal: F_N = k * compression - c * compression_rate
 * - One-way contact: N >= 0 (ground can push, never pull; airborne produces zero force).
 * - Exact geometric ray-plane intersection along chassis strut axis:
 *     dist = ( (y_anchor - y_terrain) * n_y ) / max(0.1, upWorld . n)
 * - Progressive bump-stop to prevent unrealistic bottoming out.
 * - Exact tracking of spring potential energy E_s = 0.5 * k * x^2 and damping dissipation E_d = integral(c * v^2 dt).
 * - Critical damping ratio checks: omega_d = sqrt(k/m - (c/2m)^2).
 */

import {
  SUSPENSION_REST_LENGTH_M,
  SUSPENSION_MAX_COMPRESSION_M,
  SUSPENSION_MAX_DROOP_M,
  SUSPENSION_SPRING_K,
  SUSPENSION_DAMPER_C,
  WHEEL_RADIUS_M
} from './constants.js';
import { Vec3 } from './math3d.js';

export class WheelSuspensionUnit {
  constructor(wheelConfig, options = {}) {
    this.config = wheelConfig;

    this.restLength = options.restLength ?? SUSPENSION_REST_LENGTH_M;
    this.maxCompression = options.maxCompression ?? SUSPENSION_MAX_COMPRESSION_M;
    this.maxDroop = options.maxDroop ?? SUSPENSION_MAX_DROOP_M;
    this.springK = options.springK ?? SUSPENSION_SPRING_K;
    this.damperC = options.damperC ?? SUSPENSION_DAMPER_C;
    this.wheelRadius = options.wheelRadius ?? WHEEL_RADIUS_M;

    // Kinematic State
    this.localAnchor = new Vec3(wheelConfig.x, wheelConfig.y, wheelConfig.z);
    this.worldAnchor = new Vec3();
    this.wheelHubWorld = new Vec3();
    this.contactPointWorld = new Vec3();
    this.contactNormalWorld = new Vec3(0, 1, 0);

    // Dynamic Suspension State
    this.currentLength = this.restLength;
    this.prevLength = this.restLength;
    this.compression = 0.0;
    this.compressionRate = 0.0;
    this.isGrounded = false;

    // Contact Forces & Energy Ledger Feeds
    this.normalForceN = 0.0;
    this.bumpStopForceN = 0.0;
    this.springPotentialEnergyJ = 0.0;
    this.cumulativeDampingLossJ = 0.0;

    // Scratch buffers
    this._tmpV1 = new Vec3();
    this._tmpV2 = new Vec3();
  }

  /**
   * Evaluate ground contact and compute normal reaction force
   *
   * @param {ChassisRigidBody} chassis
   * @param {SimTerrain} terrain
   * @param {number} dt - Step duration (s)
   * @returns {number} Normal force magnitude N (>= 0)
   */
  evaluateContact(chassis, terrain, dt) {
    // 1. Transform strut anchor into world frame
    this.worldAnchor.copy(this.localAnchor).applyMatrix3(chassis.rotMatrix).add(chassis.position);

    // 2. Sample terrain height directly under wheel spindle
    const groundY = terrain.getHeightAt(this.worldAnchor.x, this.worldAnchor.z);
    terrain.getNormalAt(this.worldAnchor.x, this.worldAnchor.z, this._tmpV1);
    this.contactNormalWorld.copy(this._tmpV1);

    // Exact geometric distance along strut axis (-upWorld) to terrain plane:
    // dist = ((y_anchor - groundY) * n_y) / max(0.1, upWorld . n)
    const uDotN = Math.max(0.1, chassis.upWorld.dot(this.contactNormalWorld));
    const distToGround = ((this.worldAnchor.y - groundY) * this.contactNormalWorld.y) / uDotN;
    const rayLength = distToGround - this.wheelRadius;

    const minAllowedLen = this.restLength - this.maxCompression;
    const maxAllowedLen = this.restLength + this.maxDroop;

    // Check contact condition
    if (rayLength <= maxAllowedLen && chassis.upWorld.y > 0.05) {
      this.isGrounded = true;

      const clampedLen = Math.max(minAllowedLen, rayLength);
      this.prevLength = this.currentLength;
      this.currentLength = clampedLen;
      this.compression = this.restLength - clampedLen;

      // Spindle & ground contact points
      this.wheelHubWorld.copy(this.worldAnchor).addScaled(chassis.upWorld, -clampedLen);
      this.contactPointWorld.set(this.worldAnchor.x, groundY, this.worldAnchor.z);

      // Velocity at wheel hub from rigid-body motion
      const hubVel = chassis.getPointVelocity(this.wheelHubWorld, this._tmpV2);
      // Compression velocity: rate at which suspension is collapsing
      const suspVel = -hubVel.dot(chassis.upWorld);
      this.compressionRate = suspVel;

      // Spring-damper force calculation
      let fn = this.springK * this.compression + this.damperC * suspVel;

      // Progressive non-linear bump stop if compressed beyond limit
      this.bumpStopForceN = 0.0;
      if (rayLength < minAllowedLen) {
        const penetration = minAllowedLen - rayLength;
        this.bumpStopForceN = penetration * this.springK * 3.5;
        fn += this.bumpStopForceN;
      }

      // Physics Fundamentals Contract A5: Normal force N >= 0 (ground can push, never pull)
      this.normalForceN = Math.max(0.0, fn);

      // Energy accounting
      this.springPotentialEnergyJ = 0.5 * this.springK * this.compression * this.compression;
      if (dt > 0 && fn > 0) {
        const damperPower = this.damperC * suspVel * suspVel;
        this.cumulativeDampingLossJ += damperPower * dt;
      }

    } else {
      // Wheel airborne (contact loss)
      this.isGrounded = false;
      this.prevLength = this.currentLength;
      const blendDroop = 1.0 - Math.exp(-dt * 10.0);
      this.currentLength = Math.min(maxAllowedLen, this.currentLength + (maxAllowedLen - this.currentLength) * blendDroop);
      this.compression = 0.0;
      this.compressionRate = 0.0;
      this.normalForceN = 0.0;
      this.bumpStopForceN = 0.0;
      this.springPotentialEnergyJ = 0.0;
      this.wheelHubWorld.copy(this.worldAnchor).addScaled(chassis.upWorld, -this.currentLength);
      this.contactPointWorld.copy(this.wheelHubWorld);
    }

    return this.normalForceN;
  }

  /**
   * Analytical damped natural angular frequency omega_d (used in T09)
   * omega_d = sqrt(k / m - (c / (2*m))^2)
   */
  getAnalyticalDampedFrequency(effectiveWheelMassKg) {
    const omega0Sq = this.springK / effectiveWheelMassKg;
    const dampingFactor = this.damperC / (2.0 * effectiveWheelMassKg);
    const dampedSq = omega0Sq - dampingFactor * dampingFactor;
    return dampedSq > 0 ? Math.sqrt(dampedSq) : 0.0;
  }
}
