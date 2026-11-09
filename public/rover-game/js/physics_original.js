import * as THREE from 'three';

export const MARS_GRAVITY = 3.71; // Authentic Mars surface gravity (m/s^2)

/**
 * True 6-DOF Rigid-Body & 6-Wheel Rocker-Bogie Raycast Vehicle Physics Engine
 * Engineered for planetary off-road simulation:
 * - Mars gravity (3.71 m/s^2)
 * - 6 independent spring-damper raycast wheel assemblies + wheel arc contact sampling
 * - Ackermann 4-corner steering (FL/FR steer in phase, RL/RR counter-steer)
 * - Coulomb friction circle with soil-dependent traction, rolling resistance & sand wheel slip
 * - Rocker-Bogie differential kinematics output
 * - Solid 3D boulder/outcrop impulse collision response & chassis ground protection
 */
export class RoverPhysicsEngine {
  constructor(world) {
    this.world = world;

    // Physical properties (Perseverance scale)
    this.mass = 1025.0; // kg
    this.invMass = 1.0 / this.mass;

    // Local body-space Moments of Inertia (kg * m^2)
    this.inertiaBody = new THREE.Vector3(560, 890, 480);
    this.invInertiaBody = new THREE.Vector3(1 / 560, 1 / 890, 1 / 480);

    // Upgrade multipliers (tunable in Rover Garage)
    this.upgrades = {
      tractionMult: 1.0,
      suspensionStiffnessMult: 1.0,
      motorPowerMult: 1.0
    };

    // Rigid body state
    this.position = new THREE.Vector3(0, 3.0, 4.0);
    this.quaternion = new THREE.Quaternion();
    this.linearVelocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3(); // World space rad/s

    // Telemetry outputs
    this.forwardSpeed = 0;      // Signed forward velocity (m/s)
    this.speedMagnitude = 0;    // Total speed (m/s)
    this.averageSlip = 0;       // 0..1
    this.groundedWheels = 6;
    this.pitchDeg = 0;
    this.rollDeg = 0;
    this.slopeDeg = 0;
    this.headingDeg = 180;
    this.steerAngle = 0;        // Current front steer angle (rad)
    this.currentSoil = 'Ferric Regolith';
    this.hullIntegrity = 100.0; // %

    // Rocker-bogie visual linkage angles (rad)
    this.rockerAngleLeft = 0;
    this.rockerAngleRight = 0;
    this.bogieAngleLeft = 0;
    this.bogieAngleRight = 0;

    // Wheel definitions in chassis local coordinates (-Z is forward, +X is right, +Y is up)
    this.wheelRadius = 0.2625;
    this.restLength = 0.54;
    this.maxCompression = 0.34;
    this.maxDroop = 0.20;
    this.baseSpringK = 5600.0;
    this.baseDamperC = 1520.0;

    const wheelConfigs = [
      { name: 'FL', x: -1.04, y: 0.06, z: -1.02, steerFactor:  1.0, side: 'L' },
      { name: 'FR', x:  1.04, y: 0.06, z: -1.02, steerFactor:  1.0, side: 'R' },
      { name: 'ML', x: -1.10, y: 0.06, z:  0.06, steerFactor:  0.0, side: 'L' },
      { name: 'MR', x:  1.10, y: 0.06, z:  0.06, steerFactor:  0.0, side: 'R' },
      { name: 'RL', x: -1.04, y: 0.06, z:  1.04, steerFactor: -0.72, side: 'L' },
      { name: 'RR', x:  1.04, y: 0.06, z:  1.04, steerFactor: -0.72, side: 'R' }
    ];

    this.wheels = wheelConfigs.map((cfg) => ({
      ...cfg,
      localAnchor: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
      worldAnchor: new THREE.Vector3(),
      contactPoint: new THREE.Vector3(),
      contactNormal: new THREE.Vector3(0, 1, 0),
      suspensionLength: this.restLength,
      prevLength: this.restLength,
      compression: 0,
      grounded: false,
      steerRad: 0,
      spinRad: 0,
      angularSpeed: 0,
      slipRatio: 0,
      normalForce: 0,
      soilDustiness: 0.8
    }));

    // Scratch math objects to eliminate per-substep GC allocations
    this._forceAccum = new THREE.Vector3();
    this._torqueAccum = new THREE.Vector3();
    this._tmpV1 = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._tmpV3 = new THREE.Vector3();
    this._tmpR = new THREE.Vector3();
    this._upWorld = new THREE.Vector3();
    this._fwdWorld = new THREE.Vector3();
    this._rightWorld = new THREE.Vector3();
    this._obstacles = [];

    this.onCollisionCallback = null;
  }

  /**
   * Place rover cleanly onto terrain at (x, z) with given yaw heading (radians)
   */
  spawnAt(x, z, headingYaw = Math.PI) {
    const groundY = this.world.getWheelContactHeight(x, z);
    const surfNormal = this.world.getNormalAt(x, z, new THREE.Vector3());

    this.position.set(x, groundY + 0.68, z);

    // Align yaw + gentle initial terrain normal tilt
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headingYaw);
    const upDefault = new THREE.Vector3(0, 1, 0);
    const tiltQuat = new THREE.Quaternion().setFromUnitVectors(upDefault, surfNormal);
    this.quaternion.copy(tiltQuat).multiply(yawQuat).normalize();

    this.linearVelocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.steerAngle = 0;

    for (const w of this.wheels) {
      w.suspensionLength = this.restLength - 0.11;
      w.prevLength = w.suspensionLength;
      w.compression = 0.11;
      w.angularSpeed = 0;
      w.slipRatio = 0;
    }

    this._computeTelemetry();
  }

  /**
   * Emergency upright recovery ('R' key) if flipped or wedged
   */
  recoverUpright() {
    const euler = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ');
    this.spawnAt(this.position.x, this.position.z, euler.y);
  }

  /**
   * Advance physics with fixed sub-stepping for rock-solid stability at any frame rate
   */
  step(dt, controls, lowPowerLimp = false, extraColliders = null) {
    const clampedDt = Math.min(dt, 0.05);
    const substeps = 4;
    const h = clampedDt / substeps;

    // Smooth steering actuator response (speed-sensitive steering to prevent high-speed spinouts)
    const speedFactor = 1.0 / (1.0 + Math.abs(this.forwardSpeed) * 0.11);
    const maxSteer = THREE.MathUtils.degToRad(30) * (0.48 + 0.52 * speedFactor);
    const desiredSteer = (controls.steerLeft - controls.steerRight) * maxSteer;
    const steerRate = 2.6; // rad/s servo speed
    const steerDiff = desiredSteer - this.steerAngle;
    this.steerAngle += Math.sign(steerDiff) * Math.min(Math.abs(steerDiff), steerRate * clampedDt);

    for (let s = 0; s < substeps; s++) {
      this._substep(h, controls, lowPowerLimp, extraColliders);
    }

    this._computeRockerBogieKinematics();
    this._computeTelemetry();
  }

  _substep(dt, controls, lowPowerLimp, extraColliders) {
    this._forceAccum.set(0, -this.mass * MARS_GRAVITY, 0); // Mars gravity force!
    this._torqueAccum.set(0, 0, 0);

    // Body basis vectors in world space
    this._rightWorld.set(1, 0, 0).applyQuaternion(this.quaternion);
    this._upWorld.set(0, 1, 0).applyQuaternion(this.quaternion);
    this._fwdWorld.set(0, 0, -1).applyQuaternion(this.quaternion);

    // Aerodynamic / chassis drag (very thin Mars atmosphere + internal drivetrain damping)
    const speedSq = this.linearVelocity.lengthSq();
    if (speedSq > 0.0001) {
      this._tmpV1.copy(this.linearVelocity).multiplyScalar(-14.0);
      this._forceAccum.add(this._tmpV1);
    }

    const springK = this.baseSpringK * this.upgrades.suspensionStiffnessMult;
    const damperC = this.baseDamperC * Math.sqrt(this.upgrades.suspensionStiffnessMult);

    // Motor drive parameters
    const isBoost = controls.boost && !lowPowerLimp;
    const maxTargetSpeed = lowPowerLimp ? 1.5 : (isBoost ? 9.6 : 5.4);
    const peakWheelDriveForce = (lowPowerLimp ? 320 : (isBoost ? 1420 : 940)) * this.upgrades.motorPowerMult;
    const throttleInput = controls.forward - controls.reverse; // -1..+1

    let groundedCount = 0;
    let slipSum = 0;

    for (let i = 0; i < 6; i++) {
      const w = this.wheels[i];
      w.steerRad = this.steerAngle * w.steerFactor;

      // World-space suspension anchor
      w.worldAnchor.copy(w.localAnchor).applyQuaternion(this.quaternion).add(this.position);
      // Lever arm r = worldAnchor - position
      this._tmpR.copy(w.worldAnchor).sub(this.position);

      // Wheel forward & right unit vectors in world space
      const cosS = Math.cos(w.steerRad);
      const sinS = Math.sin(w.steerRad);
      // Rotate around chassis Up axis by +steerRad (positive steerRad = left turn)
      const wheelFwd = this._tmpV1.copy(this._fwdWorld).multiplyScalar(cosS)
        .addScaledVector(this._rightWorld, -sinS).normalize();
      const wheelRight = this._tmpV2.copy(this._rightWorld).multiplyScalar(cosS)
        .addScaledVector(this._fwdWorld, sinS).normalize();

      // Multi-sample wheel arc contact (center + leading edge + trailing edge of 52.5cm wheel)
      const probeX = w.worldAnchor.x;
      const probeZ = w.worldAnchor.z;
      const leadDist = this.wheelRadius * 0.58;

      const hCenter = this.world.getWheelContactHeight(probeX, probeZ);
      const hLead = this.world.getWheelContactHeight(
        probeX + wheelFwd.x * leadDist,
        probeZ + wheelFwd.z * leadDist
      ) - this.wheelRadius * 0.16;
      const hTrail = this.world.getWheelContactHeight(
        probeX - wheelFwd.x * leadDist,
        probeZ - wheelFwd.z * leadDist
      ) - this.wheelRadius * 0.16;

      const effectiveGroundY = Math.max(hCenter, hLead, hTrail);
      const soil = this.world.getSurfaceProperties(probeX, probeZ);
      w.soilDustiness = soil.dustiness;
      if (i === 0) this.currentSoil = soil.type;

      // Raycast along -upWorld from worldAnchor
      const upY = Math.max(0.25, this._upWorld.y); // Projection factor when tilted
      const distToGround = (w.worldAnchor.y - (effectiveGroundY - soil.sinkage)) / upY;
      const rayLength = distToGround - this.wheelRadius;

      const maxLen = this.restLength + this.maxDroop;
      const minLen = this.restLength - this.maxCompression;

      if (rayLength <= maxLen && this._upWorld.y > 0.1) {
        // Wheel is in contact with Martian surface / climbable rock!
        w.grounded = true;
        groundedCount++;

        const clampedLen = Math.max(minLen, rayLength);
        w.prevLength = w.suspensionLength;
        w.suspensionLength = clampedLen;
        w.compression = this.restLength - clampedLen;

        w.contactPoint.set(probeX, effectiveGroundY, probeZ);
        this.world.getNormalAt(probeX, probeZ, w.contactNormal);

        // Velocity of wheel contact point on rigid body: v_p = v + omega x r
        const velAtWheel = this._tmpV3.copy(this.angularVelocity).cross(this._tmpR).add(this.linearVelocity);

        // 1. Suspension Spring + Damper Force along surface/suspension normal
        const springVel = velAtWheel.dot(this._upWorld);
        let normalForce = springK * w.compression - damperC * springVel;

        // Progressive bump-stop if bottoming out over huge rock
        if (rayLength < minLen) {
          normalForce += (minLen - rayLength) * springK * 3.2;
        }
        normalForce = Math.max(0, Math.min(normalForce, this.mass * MARS_GRAVITY * 3.8));
        w.normalForce = normalForce;

        // Blend chassis up and terrain normal so slopes exert true downhill gravitational shear!
        const suspForceVec = w.contactNormal.clone().lerp(this._upWorld, 0.35).normalize().multiplyScalar(normalForce);
        this._forceAccum.add(suspForceVec);
        this._torqueAccum.add(this._tmpR.clone().cross(suspForceVec));

        // 2. Project wheel velocity onto tangent ground plane
        const vLong = velAtWheel.dot(wheelFwd);
        const vLat = velAtWheel.dot(wheelRight);

        // Maximum tire grip (Coulomb friction circle)
        const mu = Math.min(1.25, soil.friction * this.upgrades.tractionMult);
        const maxFrictionForce = mu * normalForce;

        // Longitudinal force: Motor Drive + Rolling Resistance + Braking
        let fLong = 0;
        if (Math.abs(throttleInput) > 0.02) {
          // Speed limiter taper near maxTargetSpeed
          const dirMatch = throttleInput * vLong;
          const speedRatio = dirMatch > 0 ? Math.min(1.0, Math.abs(vLong) / maxTargetSpeed) : 0;
          const torqueCurve = 1.0 - Math.pow(speedRatio, 2.2);
          fLong += throttleInput * peakWheelDriveForce * torqueCurve;
        } else {
          // Natural electric hub motor regenerative drag when coasting
          fLong += -vLong * 145.0;
        }

        // Rolling resistance in regolith / sand
        fLong += -Math.sign(vLong) * Math.min(Math.abs(vLong) * 90.0, soil.rollingResistance * normalForce);

        // Spacebar Mechanical + Regenerative Brake
        if (controls.brake) {
          const brakeForce = -vLong * 920.0;
          fLong += Math.max(-maxFrictionForce * 1.15, Math.min(maxFrictionForce * 1.15, brakeForce));
          // Hill-hold parking lock at near-zero speed
          if (Math.abs(vLong) < 0.35 && Math.abs(throttleInput) < 0.05) {
            fLong += -vLong * 2200.0;
          }
        }

        // Lateral cornering force (opposes side-slip)
        const corneringStiffness = 1150.0;
        let fLat = -vLat * corneringStiffness;

        // Friction circle clamping -> produces realistic wheel slip & sand drift!
        const demandMag = Math.hypot(fLong, fLat);
        if (demandMag > maxFrictionForce && demandMag > 0.001) {
          const scale = maxFrictionForce / demandMag;
          // Calculate wheel slip ratio from excess motor torque
          const excess = Math.min(1.0, (demandMag - maxFrictionForce) / Math.max(120, maxFrictionForce));
          w.slipRatio = THREE.MathUtils.lerp(w.slipRatio, excess, 0.25);
          fLong *= scale;
          fLat *= scale;
        } else {
          w.slipRatio = THREE.MathUtils.lerp(w.slipRatio, 0, 0.25);
        }

        slipSum += w.slipRatio;

        // Apply tire forces slightly closer to CoM height to prevent unrealistic arcade tip-overs on turns
        const tireForce = wheelFwd.clone().multiplyScalar(fLong).addScaledVector(wheelRight, fLat);
        this._forceAccum.add(tireForce);

        const tireLever = this._tmpR.clone();
        // Scale vertical lever arm for realistic low-CG Mars rover stability (MMRTG + battery pack sit low in WEB)
        tireLever.subScaledVector(this._upWorld, tireLever.dot(this._upWorld) * 0.55);
        this._torqueAccum.add(tireLever.cross(tireForce));

        // Wheel visual spin speed (includes wheel spin during sand slip!)
        const slipSpin = Math.abs(throttleInput) > 0.1 ? throttleInput * w.slipRatio * 8.5 : 0;
        w.angularSpeed = (vLong / this.wheelRadius) + slipSpin;
        w.spinRad += w.angularSpeed * dt;

      } else {
        // Wheel airborne!
        w.grounded = false;
        w.prevLength = w.suspensionLength;
        w.suspensionLength = THREE.MathUtils.lerp(w.suspensionLength, maxLen, dt * 10.0);
        w.compression = 0;
        w.normalForce = 0;
        w.slipRatio = 0;
        if (Math.abs(throttleInput) > 0.05 && !controls.brake) {
          w.angularSpeed = THREE.MathUtils.lerp(w.angularSpeed, throttleInput * (maxTargetSpeed / this.wheelRadius), dt * 4.0);
        } else {
          w.angularSpeed *= (1.0 - dt * 2.5);
        }
        w.spinRad += w.angularSpeed * dt;
      }
    }

    this.groundedWheels = groundedCount;
    this.averageSlip = groundedCount > 0 ? slipSum / groundedCount : 0;

    // 3. Symplectic Euler Linear Integration
    this.linearVelocity.addScaledVector(this._forceAccum, this.invMass * dt);
    // Clamp runaway velocities
    const maxAbsSpeed = 16.0;
    if (this.linearVelocity.lengthSq() > maxAbsSpeed * maxAbsSpeed) {
      this.linearVelocity.setLength(maxAbsSpeed);
    }
    this.position.addScaledVector(this.linearVelocity, dt);

    // 4. Rigid-Body Angular Integration via Body-Space Inverse Inertia Tensor
    const invQuat = this.quaternion.clone().invert();
    const localTorque = this._torqueAccum.clone().applyQuaternion(invQuat);
    const localAngAccel = localTorque.multiply(this.invInertiaBody);
    const worldAngAccel = localAngAccel.applyQuaternion(this.quaternion);

    this.angularVelocity.addScaledVector(worldAngAccel, dt);
    // Rotational damping from rocker-bogie differential joints
    this.angularVelocity.multiplyScalar(Math.max(0, 1.0 - 2.6 * dt));

    const omegaMag = this.angularVelocity.length();
    if (omegaMag > 0.00001) {
      const clampedOmega = Math.min(omegaMag, 3.5);
      const axis = this.angularVelocity.clone().divideScalar(omegaMag);
      const dq = new THREE.Quaternion().setFromAxisAngle(axis, clampedOmega * dt);
      this.quaternion.premultiply(dq).normalize();
    }

    // 5. Chassis Belly Ground Protection (prevents tunneling after high drops)
    const groundUnderChassis = this.world.getElevationAt(this.position.x, this.position.z);
    const minChassisY = groundUnderChassis + 0.36;
    if (this.position.y < minChassisY) {
      this.position.y = minChassisY;
      if (this.linearVelocity.y < 0) {
        this.linearVelocity.y *= -0.18;
      }
    }

    // 6. Solid 3D Boulder & Science Outcrop Rigid Collisions
    this._resolveObstacleCollisions(extraColliders);
  }

  _resolveObstacleCollisions(extraColliders) {
    const obstacles = this.world.getNearbySolidObstacles(this.position.x, this.position.z, this._obstacles);
    if (extraColliders && extraColliders.length > 0) {
      for (let i = 0; i < extraColliders.length; i++) {
        obstacles.push(extraColliders[i]);
      }
    }

    const roverRadius = 1.28;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      // Check vertical overlap first (allows jumping over low things if airborne)
      if (this.position.y - 0.55 > obs.baseY + obs.height) continue;

      const dx = this.position.x - obs.x;
      const dz = this.position.z - obs.z;
      const distSq = dx * dx + dz * dz;
      const minDist = roverRadius + obs.radius;

      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const penetration = minDist - dist;

        // Push chassis out of obstacle
        this.position.x += nx * penetration;
        this.position.z += nz * penetration;

        // Relative impact speed along collision normal
        const vn = this.linearVelocity.x * nx + this.linearVelocity.z * nz;
        if (vn < 0) {
          const impactSpeed = -vn;
          const restitution = 0.22;
          const impulse = -(1.0 + restitution) * vn;

          this.linearVelocity.x += nx * impulse;
          this.linearVelocity.z += nz * impulse;
          // Tangential scrape friction
          this.linearVelocity.x *= 0.88;
          this.linearVelocity.z *= 0.88;

          // Induce yaw deflection torque if glancing blow off-center
          const fwd = this._fwdWorld;
          const crossY = fwd.z * nx - fwd.x * nz;
          this.angularVelocity.y += crossY * impactSpeed * 0.35;

          if (impactSpeed > 1.8) {
            // Hull damage only on hard impacts (> 3.2 m/s)
            if (impactSpeed > 3.2) {
              const dmg = Math.min(18, (impactSpeed - 3.0) * 2.8);
              this.hullIntegrity = Math.max(15, this.hullIntegrity - dmg);
            }
            if (this.onCollisionCallback) {
              this.onCollisionCallback(impactSpeed, {
                x: obs.x + nx * obs.radius,
                y: this.position.y - 0.1,
                z: obs.z + nz * obs.radius
              });
            }
          }
        }
      }
    }
  }

  _computeRockerBogieKinematics() {
    // FL=0, FR=1, ML=2, MR=3, RL=4, RR=5
    const cFL = this.wheels[0].compression;
    const cFR = this.wheels[1].compression;
    const cML = this.wheels[2].compression;
    const cMR = this.wheels[3].compression;
    const cRL = this.wheels[4].compression;
    const cRR = this.wheels[5].compression;

    // Differential bar equalizes left vs right main rocker pitch
    const leftDiff = (cFL - (cML + cRL) * 0.5);
    const rightDiff = (cFR - (cMR + cRR) * 0.5);
    this.rockerAngleLeft = THREE.MathUtils.clamp(leftDiff * 0.42, -0.35, 0.35);
    this.rockerAngleRight = THREE.MathUtils.clamp(rightDiff * 0.42, -0.35, 0.35);

    // Rear bogie pivots between middle and rear wheels
    this.bogieAngleLeft = THREE.MathUtils.clamp((cML - cRL) * 0.52, -0.42, 0.42);
    this.bogieAngleRight = THREE.MathUtils.clamp((cMR - cRR) * 0.52, -0.42, 0.42);
  }

  _computeTelemetry() {
    this._fwdWorld.set(0, 0, -1).applyQuaternion(this.quaternion);
    this._rightWorld.set(1, 0, 0).applyQuaternion(this.quaternion);
    this._upWorld.set(0, 1, 0).applyQuaternion(this.quaternion);

    this.forwardSpeed = this.linearVelocity.dot(this._fwdWorld);
    this.speedMagnitude = this.linearVelocity.length();

    // Compass heading: 0° = North (-Z), 90° = East (+X), 180° = South (+Z), 270° = West (-X)
    const rad = Math.atan2(this._fwdWorld.x, -this._fwdWorld.z);
    this.headingDeg = ((rad * THREE.MathUtils.RAD2DEG) % 360 + 360) % 360;

    // Pitch & Roll in degrees
    this.pitchDeg = Math.asin(THREE.MathUtils.clamp(this._fwdWorld.y, -1, 1)) * THREE.MathUtils.RAD2DEG;
    this.rollDeg = -Math.asin(THREE.MathUtils.clamp(this._rightWorld.y, -1, 1)) * THREE.MathUtils.RAD2DEG;
    this.slopeDeg = Math.acos(THREE.MathUtils.clamp(this._upWorld.y, -1, 1)) * THREE.MathUtils.RAD2DEG;
  }
}
