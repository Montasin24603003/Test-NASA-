/**
 * NASA MARS 2020 PERSEVERANCE AUTONOMOUS NAVIGATION & STATE ESTIMATION
 *
 * Implements:
 * 1. True State vs Estimated State separation (NASA SPICE / Flight Software)
 * 2. Wheel Odometry Drift: integrates slip-induced odometric error
 * 3. Strapdown 6-Axis IMU (accelerometer + gyroscope) with bias and Gaussian noise
 * 4. Navcam Visual Odometry (VO): periodic feature matching reset to bound uncertainty
 * 5. AutoNav Autonomous Waypoint Following: commands steering & throttle (NEVER sets coordinates)
 * 6. Planetocentric Geodetic Coordinates (Jezero Crater 18.3848°N, 77.5802°E)
 */

import {
  JEZERO_LANDING_LAT_DEG,
  JEZERO_LANDING_LON_DEG,
  MARS_VOLUMETRIC_RADIUS_M
} from './constants.js';
import { Vec3 } from './math3d.js';
import { DeterministicRNG } from './rng.js';

export class MarsRoverNavigation {
  constructor(options = {}) {
    this.landingLatDeg = options.landingLatDeg ?? JEZERO_LANDING_LAT_DEG;
    this.landingLonDeg = options.landingLonDeg ?? JEZERO_LANDING_LON_DEG;
    this.marsRadiusM = options.marsRadiusM ?? MARS_VOLUMETRIC_RADIUS_M;

    // True state (ground truth from physics solver)
    this.truePositionM = new Vec3();
    this.trueHeadingRad = 0.0;
    this.trueDistanceTraversedM = 0.0;

    // Estimated state (flight computer belief)
    this.estimatedPositionM = new Vec3();
    this.estimatedHeadingRad = 0.0;
    this.odometryDistanceM = 0.0;
    this.positionUncertainty1SigmaM = 0.05; // 5 cm initial uncertainty

    // IMU Sensor Model
    this.rng = new DeterministicRNG(options.seed ?? 192837);
    this.imuAccelBias = new Vec3(0.002, -0.001, 0.003); // m/s^2 sensor bias
    this.imuGyroBias = new Vec3(0.0001, 0.0002, -0.0001); // rad/s sensor bias
    this.imuAccelNoiseSigma = 0.015;
    this.imuGyroNoiseSigma = 0.002;
    this.imuAccelMeasured = new Vec3();
    this.imuGyroMeasured = new Vec3();

    // Visual Odometry (VO)
    this.voStatus = 'NOMINAL';
    this.voLastFixDistanceM = 0.0;
    this.voFixIntervalM = 8.0; // Auto VO check every 8 meters of driving
    this.totalVoFixes = 0;

    // AutoNav Autonomous Waypoint Planner
    this.autoNavEnabled = false;
    this.waypoints = [];
    this.currentWaypointIndex = 0;
    this.waypointArrivalToleranceM = 1.2;
    this.commandedSteerRad = 0.0;
    this.commandedThrottle = 0.0;

    this._prevTruePos = new Vec3();
    this._hasPrev = false;
  }

  setWaypoints(wps) {
    this.waypoints = Array.isArray(wps) ? [...wps] : [];
    this.currentWaypointIndex = 0;
  }

  setAutoNav(enable) {
    this.autoNavEnabled = Boolean(enable);
  }

  /**
   * Trigger Navcam Visual Odometry feature tracking fix.
   * Compares stereo camera images, bounds accumulated drift, and reduces uncertainty.
   */
  performVisualOdometryFix() {
    this.voStatus = 'ACQUIRING_STEREO';
    // Small residual VO error (2-4 cm)
    const errX = this.rng.gaussian(0, 0.03);
    const errZ = this.rng.gaussian(0, 0.03);

    this.estimatedPositionM.set(
      this.truePositionM.x + errX,
      this.truePositionM.y,
      this.truePositionM.z + errZ
    );
    this.estimatedHeadingRad = this.trueHeadingRad + this.rng.gaussian(0, 0.005);
    this.positionUncertainty1SigmaM = 0.05; // Reset uncertainty to baseline 5 cm
    this.voLastFixDistanceM = this.trueDistanceTraversedM;
    this.totalVoFixes++;
    this.voStatus = 'FIX_ACQUIRED';
    return true;
  }

  /**
   * Step navigation filter and AutoNav controller
   *
   * @param {number} dt - Timestep in seconds
   * @param {Object} sim - CoreRoverPhysics instance
   */
  update(dt, sim) {
    if (!sim || !sim.chassis) return;

    // 1. Update true state from chassis
    this.truePositionM.copy(sim.chassis.position);
    this.trueHeadingRad = (sim.chassis.headingDeg * Math.PI) / 180.0;

    if (!this._hasPrev) {
      this._prevTruePos.copy(this.truePositionM);
      this.estimatedPositionM.copy(this.truePositionM);
      this.estimatedHeadingRad = this.trueHeadingRad;
      this._hasPrev = true;
    }

    const deltaX = this.truePositionM.x - this._prevTruePos.x;
    const deltaZ = this.truePositionM.z - this._prevTruePos.z;
    const deltaDist = Math.hypot(deltaX, deltaZ);
    this.trueDistanceTraversedM += deltaDist;
    this._prevTruePos.copy(this.truePositionM);

    // 2. Wheel Odometry Integration: d_odom = sum(w * r) * dt / 6
    let sumWheelSpeed = 0.0;
    for (const w of sim.wheelAssemblies) {
      sumWheelSpeed += w.angularVelocity * 0.2625; // r = 0.2625m
    }
    const avgWheelSpeed = sumWheelSpeed / 6.0;
    const odomDelta = Math.abs(avgWheelSpeed) * dt;
    this.odometryDistanceM += odomDelta;

    // 3. IMU measurement with bias and noise
    const trueAccel = sim.chassis.linearAcceleration;
    const trueOmega = sim.chassis.angularVelocity;

    this.imuAccelMeasured.set(
      trueAccel.x + this.imuAccelBias.x + this.rng.gaussian(0, this.imuAccelNoiseSigma),
      trueAccel.y + this.imuAccelBias.y + this.rng.gaussian(0, this.imuAccelNoiseSigma),
      trueAccel.z + this.imuAccelBias.z + this.rng.gaussian(0, this.imuAccelNoiseSigma)
    );

    this.imuGyroMeasured.set(
      trueOmega.x + this.imuGyroBias.x + this.rng.gaussian(0, this.imuGyroNoiseSigma),
      trueOmega.y + this.imuGyroBias.y + this.rng.gaussian(0, this.imuGyroNoiseSigma),
      trueOmega.z + this.imuGyroBias.z + this.rng.gaussian(0, this.imuGyroNoiseSigma)
    );

    // 4. Dead-Reckoning Position Estimation with Slip-Induced Drift
    // When wheels slip (sim.averageSlip > 0), odometry over-estimates traverse
    const headingToUse = this.estimatedHeadingRad;
    const slipDriftFactor = 1.0 - Math.min(0.85, sim.averageSlip * 0.8);
    const estimatedStepDist = odomDelta * slipDriftFactor;

    this.estimatedPositionM.x += Math.sin(headingToUse) * estimatedStepDist;
    this.estimatedPositionM.z += Math.cos(headingToUse) * estimatedStepDist;
    this.estimatedPositionM.y = this.truePositionM.y; // Inclinometer altitude reference

    // Growth of 1-sigma uncertainty ellipse
    const slipUncertaintyGrowth = sim.averageSlip * deltaDist * 0.4;
    this.positionUncertainty1SigmaM += (0.015 * deltaDist) + slipUncertaintyGrowth;

    // 5. Automatic Visual Odometry fix trigger
    if (this.trueDistanceTraversedM - this.voLastFixDistanceM >= this.voFixIntervalM) {
      this.performVisualOdometryFix();
    }

    // 6. AutoNav Autonomous Waypoint Controller
    if (this.autoNavEnabled && this.waypoints.length > 0 && this.currentWaypointIndex < this.waypoints.length) {
      const targetWp = this.waypoints[this.currentWaypointIndex];
      const dx = targetWp.x - this.estimatedPositionM.x;
      const dz = targetWp.z - this.estimatedPositionM.z;
      const distToTarget = Math.hypot(dx, dz);

      if (distToTarget <= this.waypointArrivalToleranceM) {
        // Waypoint reached
        this.currentWaypointIndex++;
        if (this.currentWaypointIndex >= this.waypoints.length) {
          // Mission corridor completed
          this.commandedThrottle = 0.0;
          this.commandedSteerRad = 0.0;
          this.autoNavEnabled = false;
        }
      } else {
        // Steer toward target
        const desiredHeadingRad = Math.atan2(dx, dz);
        let headingError = desiredHeadingRad - this.estimatedHeadingRad;
        // Normalize angle to [-PI, PI]
        while (headingError > Math.PI) headingError -= 2 * Math.PI;
        while (headingError < -Math.PI) headingError += 2 * Math.PI;

        const kP = 0.75;
        this.commandedSteerRad = Math.max(-0.55, Math.min(0.55, headingError * kP));

        // Speed governor: slow down during sharp steer
        const steerPenalty = Math.max(0.2, 1.0 - Math.abs(this.commandedSteerRad) / 0.55);
        this.commandedThrottle = 0.70 * steerPenalty;
      }
    } else if (!this.autoNavEnabled) {
      this.commandedSteerRad = 0.0;
      this.commandedThrottle = 0.0;
    }
  }

  /**
   * Convert local coordinates to Mars planetocentric latitude and longitude.
   */
  getPlanetocentricCoordinates(posX = this.truePositionM.x, posZ = this.truePositionM.z) {
    const dLatDeg = (-posZ / this.marsRadiusM) * (180.0 / Math.PI);
    const lat = this.landingLatDeg + dLatDeg;
    const cosLat = Math.cos((lat * Math.PI) / 180.0);
    const dLonDeg = (posX / (this.marsRadiusM * cosLat)) * (180.0 / Math.PI);
    const lon = this.landingLonDeg + dLonDeg;

    return {
      latDeg: lat,
      lonDeg: lon,
      latString: `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`,
      lonString: `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`
    };
  }

  getTelemetry() {
    const coords = this.getPlanetocentricCoordinates();
    return {
      planetocentricLat: coords.latString,
      planetocentricLon: coords.lonString,
      truePositionM: [this.truePositionM.x, this.truePositionM.y, this.truePositionM.z],
      estimatedPositionM: [this.estimatedPositionM.x, this.estimatedPositionM.y, this.estimatedPositionM.z],
      positionUncertainty1SigmaM: this.positionUncertainty1SigmaM,
      driftDistanceM: this.truePositionM.distanceTo(this.estimatedPositionM),
      trueTraverseM: this.trueDistanceTraversedM,
      odometryDistanceM: this.odometryDistanceM,
      voStatus: this.voStatus,
      totalVoFixes: this.totalVoFixes,
      autoNavActive: this.autoNavEnabled,
      currentWaypointIndex: this.currentWaypointIndex,
      totalWaypoints: this.waypoints.length,
      provenance: '[COMPUTED]'
    };
  }
}
