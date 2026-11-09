import * as THREE from 'three';
import { MARS_REGIONS } from './regions.js';

const MARS_MEAN_RADIUS_M = 3389500.0; // IAU Mars 2000 volumetric mean radius (m)

/**
 * NASA-Style Rover Localization, Strapdown 6-Axis IMU, Wheel Odometry,
 * Forward Hazard Scanner & Engineering Safety Warning System.
 *
 * All localization outputs are explicitly tagged as SIMULATED LOCALIZATION
 * anchored to real Mars 2020 / HiRISE regional planetocentric reference coordinates.
 */
export class RoverNavigationSystem {
  constructor(world) {
    this.world = world;

    // Planetocentric Localization [SIMULATED]
    this.latitudeDeg = 18.3847;
    this.longitudeDeg = 77.5802;
    this.elevationMolaM = -2558.0;
    this.localPosition = new THREE.Vector3();

    // Wheel Odometry vs. Visual/True Ground Traverse
    this.wheelOdometryM = 0.0;         // Integrated wheel circumference rotation (over-reads during slip!)
    this.trueGroundDistanceM = 0.0;    // True 3D traverse distance (m)
    this.odometryDriftM = 0.0;         // Cumulative slip-induced odometry discrepancy (m)
    this.positionUncertaintyM = 0.14;  // Estimated 1-sigma localization uncertainty (+/- m)
    this.navigationStatus = 'VO-LOCK NOMINAL';

    // 6-Axis Strapdown IMU in Rover Body Frame (-Z fwd, +X right, +Y up)
    this.imuAccelBodyMs2 = { x: 0, y: 3.71, z: 0 }; // Specific force f = R^T * (a - g) (m/s^2)
    this.imuGyroBodyDegS = { pitchRate: 0, yawRate: 0, rollRate: 0 }; // Body angular rates (deg/s)

    // Waypoint & Safe-Path Guidance
    this.waypointDistanceM = null;
    this.waypointBearingDeg = null;
    this.headingErrorDeg = 0;
    this.forwardSlopeAheadDeg = 0;
    this.recommendedSafeHeadingDeg = 0;
    this.forwardHazardLevel = 'SAFE'; // 'SAFE' | 'CAUTION' | 'HAZARD'
    this.rayScanResults = [];         // 5 forward hazard scan rays for UI & PhysicsViz

    // Active Structured Engineering & Safety Warnings
    this.warnings = [];

    this._lastTruePos = null;
    this._invQuat = new THREE.Quaternion();
    this._tmpVec = new THREE.Vector3();
    this._scanTimer = 0;
  }

  resetForRegion(pos, regionId) {
    this.wheelOdometryM = 0.0;
    this.trueGroundDistanceM = 0.0;
    this.odometryDriftM = 0.0;
    this.positionUncertaintyM = 0.14;
    this._lastTruePos = pos ? pos.clone() : null;
    this._updateLatLon(pos || new THREE.Vector3(), regionId);
  }

  /**
   * Performs a simulated Navcam Stereo Landmark + Sun-Sensor Localization Fix ('L' key)
   */
  performVisualLocalizationFix(physics, atmosphere) {
    if (physics.speedMagnitude > 0.45) {
      return {
        ok: false,
        reason: 'Halt rover (< 0.4 m/s) before acquiring Navcam/Sun-Sensor localization fix.'
      };
    }

    // Dust storms degrade horizon & landmark correlation accuracy
    const minAchievableSigma = 0.12 + atmosphere.stormIntensity * 1.65;
    this.positionUncertaintyM = Math.min(this.positionUncertaintyM, minAchievableSigma);
    this.navigationStatus = atmosphere.stormIntensity > 0.45
      ? 'DEGRADED SUN-FIX (STORM HAZE)'
      : 'NAVCAM + SUN-SENSOR FIX LOCKED';

    return {
      ok: true,
      sigmaM: this.positionUncertaintyM,
      status: this.navigationStatus
    };
  }

  _updateLatLon(pos, regionId) {
    const reg = MARS_REGIONS[regionId] || MARS_REGIONS.jezero;
    const lat0 = reg.latDeg || 18.3847;
    const lon0 = reg.lonDeg || 77.5802;
    const cosLat = Math.cos(lat0 * THREE.MathUtils.DEG2RAD);

    // Local ENU: +X = East (m), -Z = North (m)
    const northM = -pos.z;
    const eastM = pos.x;

    this.latitudeDeg = lat0 + (northM / MARS_MEAN_RADIUS_M) * THREE.MathUtils.RAD2DEG;
    this.longitudeDeg = lon0 + (eastM / (MARS_MEAN_RADIUS_M * Math.max(0.2, cosLat))) * THREE.MathUtils.RAD2DEG;
    this.elevationMolaM = (reg.datumElevation || -2560) + pos.y;
    this.localPosition.copy(pos);
  }

  update(dt, physics, simulation, atmosphere, navTarget, regionId = 'jezero') {
    if (dt <= 0) return;

    // 1. Planetocentric Coordinates
    this._updateLatLon(physics.position, regionId);

    // 2. Wheel Odometry vs. True Ground Traverse & Localization Uncertainty Growth
    let dTrue = 0;
    if (!this._lastTruePos) {
      this._lastTruePos = physics.position.clone();
    } else {
      dTrue = physics.position.distanceTo(this._lastTruePos);
      if (dTrue < 8.0) {
        this.trueGroundDistanceM += dTrue;
      } else {
        dTrue = 0;
      }
      this._lastTruePos.copy(physics.position);
    }

    // Average rim travel of grounded wheels (or all wheels if spinning in sand)
    let rimSpeedSum = 0;
    let count = 0;
    for (let i = 0; i < physics.wheels.length; i++) {
      const w = physics.wheels[i];
      if (w.grounded || count === 0) {
        rimSpeedSum += Math.abs(w.angularSpeed * physics.wheelRadius);
        count++;
      }
    }
    const meanRimSpeed = count > 0 ? rimSpeedSum / count : 0;
    const dWheel = meanRimSpeed * dt;
    this.wheelOdometryM += dWheel;
    this.odometryDriftM = this.wheelOdometryM - this.trueGroundDistanceM;

    // Localization uncertainty grows with traverse distance, wheel slip, and dust-storm VO degradation
    const voNoiseMult = 1.0 + atmosphere.stormIntensity * 4.2 + (atmosphere.getVisibilityMeters() < 200 ? 1.8 : 0);
    const slipErrorRate = Math.abs(dWheel - dTrue) * 0.38 * voNoiseMult;
    const baseDriftRate = dTrue * 0.012 * voNoiseMult;
    this.positionUncertaintyM = Math.min(45.0, this.positionUncertaintyM + slipErrorRate + baseDriftRate);

    if (atmosphere.stormIntensity > 0.45) {
      this.navigationStatus = this.positionUncertaintyM > 4.0
        ? 'HIGH DRIFT — DUST ATTENUATED VO'
        : 'STORM IMU DEAD-RECKONING';
    } else if (this.positionUncertaintyM > 3.5) {
      this.navigationStatus = 'ODOMETRY DRIFT — PRESS [L] FOR FIX';
    } else {
      this.navigationStatus = 'VO-LOCK NOMINAL';
    }

    // 3. 6-Axis Strapdown IMU in Body Frame
    this._invQuat.copy(physics.quaternion).invert();
    // Specific force = a_kinematic - g_vector (where g_vector = (0, -g, 0))
    this._tmpVec.set(
      physics.linearAcceleration.x,
      physics.linearAcceleration.y + physics.gravity,
      physics.linearAcceleration.z
    ).applyQuaternion(this._invQuat);

    this.imuAccelBodyMs2.x = this._tmpVec.x;
    this.imuAccelBodyMs2.y = this._tmpVec.y;
    this.imuAccelBodyMs2.z = this._tmpVec.z;

    const bodyOmega = this._tmpVec.copy(physics.angularVelocity).applyQuaternion(this._invQuat);
    this.imuGyroBodyDegS.pitchRate = bodyOmega.x * THREE.MathUtils.RAD2DEG;
    this.imuGyroBodyDegS.yawRate = bodyOmega.y * THREE.MathUtils.RAD2DEG;
    this.imuGyroBodyDegS.rollRate = bodyOmega.z * THREE.MathUtils.RAD2DEG;

    // 4. Waypoint Distance & Bearing
    if (navTarget) {
      const dx = navTarget.x - physics.position.x;
      const dz = navTarget.z - physics.position.z;
      this.waypointDistanceM = Math.hypot(dx, dz);
      const brg = ((Math.atan2(dx, -dz) * THREE.MathUtils.RAD2DEG) % 360 + 360) % 360;
      this.waypointBearingDeg = brg;
      let err = brg - physics.headingDeg;
      while (err > 180) err -= 360;
      while (err < -180) err += 360;
      this.headingErrorDeg = err;
    } else {
      this.waypointDistanceM = null;
      this.waypointBearingDeg = null;
      this.headingErrorDeg = 0;
    }

    // 5. Forward Terrain Hazard & Safe-Path Scanner (runs at 10 Hz for efficiency)
    this._scanTimer += dt;
    if (this._scanTimer >= 0.1) {
      this._scanTimer = 0;
      this._scanForwardTerrain(physics);
    }

    // 6. Evaluate Engineering Safety & Hazard Warnings
    this._evaluateSafetyWarnings(physics, simulation, atmosphere);
  }

  _scanForwardTerrain(physics) {
    const offsetsDeg = [-32, -16, 0, 16, 32];
    const obstacles = this.world.getNearbySolidObstacles(physics.position.x, physics.position.z, []);
    let bestCost = Infinity;
    let bestHdg = physics.headingDeg;
    let centerHazard = 'SAFE';

    this.rayScanResults = [];

    for (let i = 0; i < offsetsDeg.length; i++) {
      const relDeg = offsetsDeg[i];
      const worldHdgDeg = ((physics.headingDeg + relDeg) % 360 + 360) % 360;
      const rad = worldHdgDeg * THREE.MathUtils.DEG2RAD;
      const dirX = Math.sin(rad);
      const dirZ = -Math.cos(rad);

      const x4 = physics.position.x + dirX * 4.5;
      const z4 = physics.position.z + dirZ * 4.5;
      const x8 = physics.position.x + dirX * 8.5;
      const z8 = physics.position.z + dirZ * 8.5;

      const slope4 = (this.world.sampler && typeof this.world.sampler.getSlopeDegrees === 'function')
        ? this.world.sampler.getSlopeDegrees(x4, z4)
        : (typeof this.world.getSlopeDegrees === 'function' ? this.world.getSlopeDegrees(x4, z4) : 0);
      const slope8 = (this.world.sampler && typeof this.world.sampler.getSlopeDegrees === 'function')
        ? this.world.sampler.getSlopeDegrees(x8, z8)
        : (typeof this.world.getSlopeDegrees === 'function' ? this.world.getSlopeDegrees(x8, z8) : 0);
      const maxSlope = Math.max(slope4, slope8);
      const soil4 = this.world.getSurfaceProperties(x4, z4);

      // Check solid boulder proximity along ray
      let rockBlocked = false;
      for (let k = 0; k < obstacles.length; k++) {
        const obs = obstacles[k];
        const d4 = Math.hypot(x4 - obs.x, z4 - obs.z);
        const d8 = Math.hypot(x8 - obs.x, z8 - obs.z);
        if (d4 < obs.radius + 1.35 || d8 < obs.radius + 1.15) {
          rockBlocked = true;
          break;
        }
      }

      const sandCost = (1.0 - soil4.friction) * 24.0;
      const rockCost = rockBlocked ? 85.0 : 0.0;
      const wpBias = this.waypointBearingDeg !== null
        ? Math.min(35, Math.abs((((worldHdgDeg - this.waypointBearingDeg + 540) % 360) - 180)) * 0.18)
        : Math.abs(relDeg) * 0.15;

      const totalCost = maxSlope * 1.6 + sandCost + rockCost + wpBias;
      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestHdg = worldHdgDeg;
      }

      const status = (rockBlocked || maxSlope > 21.0)
        ? 'HAZARD'
        : (maxSlope > 13.5 || soil4.friction < 0.55 ? 'CAUTION' : 'SAFE');

      if (relDeg === 0) {
        this.forwardSlopeAheadDeg = slope4;
        centerHazard = status;
      }

      this.rayScanResults.push({
        relDeg,
        headingDeg: worldHdgDeg,
        x: x8,
        z: z8,
        y: this.world.getElevationAt(x8, z8),
        maxSlope,
        rockBlocked,
        status
      });
    }

    this.recommendedSafeHeadingDeg = bestHdg;
    this.forwardHazardLevel = centerHazard;
  }

  _evaluateSafetyWarnings(physics, simulation, atmosphere) {
    const w = [];

    if (physics.isImmobilized) {
      w.push({ level: 'CRITICAL', code: 'IMMOBILIZED', text: `ROVER IMMOBILIZED: ${physics.immobilizedReason} — Reverse/Steer or Press [R]` });
    }
    if (physics.slopeDeg > 22.0 || physics.stabilityMarginPct < 34.0) {
      w.push({ level: 'CRITICAL', code: 'ROLLOVER_RISK', text: `DANGEROUS CHASSIS TILT (${physics.slopeDeg.toFixed(1)}°) • Stability Margin ${physics.stabilityMarginPct.toFixed(0)}%` });
    } else if (physics.slopeDeg > 15.0) {
      w.push({ level: 'CAUTION', code: 'HIGH_SLOPE', text: `STEEP GRADE (${physics.slopeDeg.toFixed(1)}°) • Downhill Shear ${physics.slopeGravityForceN.toFixed(0)} N` });
    }

    if (physics.averageSlip > 0.45) {
      w.push({ level: 'CAUTION', code: 'HIGH_SLIP', text: `EXCESSIVE WHEEL SLIP (${(physics.averageSlip * 100).toFixed(0)}%) on ${physics.currentSoil} — Sinkage ${physics.averageSinkageCm.toFixed(1)} cm` });
    }
    if (physics.groundClearanceM < 0.16) {
      w.push({ level: 'CAUTION', code: 'LOW_CLEARANCE', text: `LOW BELLY CLEARANCE (${(physics.groundClearanceM * 100).toFixed(0)} cm) — Obstacle Scrape Risk` });
    }
    if (physics.groundedWheels < 5) {
      w.push({ level: 'CAUTION', code: 'WHEEL_LIFT', text: `WHEEL CONTACT LOSS (${physics.groundedWheels}/6 Grounded)` });
    }

    if (simulation.powerModeState === 'SAFE_MODE') {
      w.push({ level: 'CRITICAL', code: 'SAFE_MODE', text: `EMERGENCY SAFE MODE (${simulation.batteryPct.toFixed(1)}%) — Drive Limited & Instruments Shed` });
    } else if (simulation.powerModeState === 'INSTRUMENT_RESTRICTED') {
      w.push({ level: 'CRITICAL', code: 'INST_LOCKOUT', text: `CRITICAL BATTERY (${simulation.batteryPct.toFixed(1)}%) — High-Power Laser & Drill Locked` });
    } else if (simulation.powerModeState === 'LOW_ENERGY') {
      w.push({ level: 'CAUTION', code: 'LOW_BATTERY', text: `LOW BATTERY (${simulation.batteryPct.toFixed(1)}%) — Overdrive Disabled` });
    }

    const visM = atmosphere.getVisibilityMeters();
    if (visM < 190) {
      w.push({ level: 'CAUTION', code: 'LOW_VISIBILITY', text: `POOR VISIBILITY (${visM}m) • Dust Optical Depth τ=${simulation.dustOpticalDepth.toFixed(2)}` });
    }

    if (simulation.thermalWarnings.length > 0) {
      w.push({ level: 'CAUTION', code: 'THERMAL', text: simulation.thermalWarnings[0] });
    }

    this.warnings = w;
  }

  getSnapshot() {
    return {
      provenance: 'SIMULATED PLANETOCENTRIC LOCALIZATION & IMU',
      latitude_degN: Number(this.latitudeDeg.toFixed(6)),
      longitude_degE: Number(this.longitudeDeg.toFixed(6)),
      elevationMOLA_m: Number(this.elevationMolaM.toFixed(2)),
      wheelOdometry_m: Number(this.wheelOdometryM.toFixed(2)),
      trueTraverse_m: Number(this.trueGroundDistanceM.toFixed(2)),
      positionUncertainty_m: Number(this.positionUncertaintyM.toFixed(2)),
      navigationStatus: this.navigationStatus,
      imuAccelBody_ms2: this.imuAccelBodyMs2,
      imuGyroBody_degs: this.imuGyroBodyDegS,
      recommendedSafeHeading_deg: Number(this.recommendedSafeHeadingDeg.toFixed(1)),
      forwardHazardLevel: this.forwardHazardLevel
    };
  }
}
