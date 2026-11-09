/**
 * CORE ROVER MULTI-BODY PHYSICS SOLVER
 *
 * Implements Physics Fundamentals Contract A, B, C, E, F:
 * - Couples ChassisRigidBody (6-DOF) with 6 SimWheelAssemblies, RockerBogieMechanism, and SimTerrain
 * - Evaluates Bekker terramechanics, Janosi shear thrust, and Coulomb friction circles
 * - Full Four-Corner Ackermann Steering around non-steered middle axle ICR line
 * - Wheel angular dynamics J_w * dw/dt = tau_motor - F_x * r_eff - tau_roll - tau_brake
 * - Strict Energy Ledger Closure: motor electrical power draws from battery chemical energy
 */

import {
  ROVER_MASS_KG,
  MARS_GRAVITY,
  WHEEL_CONFIGS,
  SUSPENSION_REST_LENGTH_M,
  WHEEL_RADIUS_M,
  SUSPENSION_SPRING_K,
  SUSPENSION_DAMPER_C
} from './constants.js';
import { Vec3, Quat } from './math3d.js';
import { ChassisRigidBody } from './chassis.js';
import { SimTerrain } from './terrain.js';
import { WheelSuspensionUnit } from './suspension.js';
import { SimWheelAssembly } from './wheel.js';
import { RockerBogieMechanism } from './rockerBogie.js';
import { EnergyLedger } from './energyLedger.js';
import { SOIL_PROFILES } from './soilModels.js';
import { MarsEnvironment } from './environment.js';

export class CoreRoverPhysics {
  constructor(options = {}) {
    this.mass = options.mass ?? ROVER_MASS_KG;
    this.gravity = options.gravity ?? MARS_GRAVITY;
    this.frictionCoeff = options.frictionCoeff ?? 0.65;
    this.atmosphereEnabled = options.atmosphereEnabled ?? false;
    this.environment = options.environment || new MarsEnvironment();

    // Soil & Terrain
    this.terrain = options.terrain || new SimTerrain('flat');
    this.currentSoil = options.soil || (options.frictionCoeff !== undefined
      ? { ...SOIL_PROFILES.loose_regolith, frictionCoeff: options.frictionCoeff }
      : SOIL_PROFILES.loose_regolith);

    // 6-DOF Rigid-Body Chassis
    this.chassis = new ChassisRigidBody({
      mass: this.mass,
      gravity: this.gravity
    });

    // 6 Suspension units & Wheel Assemblies
    this.suspensionUnits = WHEEL_CONFIGS.map((cfg) => new WheelSuspensionUnit(cfg, {
      springK: options.springK ?? SUSPENSION_SPRING_K,
      damperC: options.damperC ?? SUSPENSION_DAMPER_C
    }));

    this.wheelAssemblies = WHEEL_CONFIGS.map((cfg) => new SimWheelAssembly(cfg, {
      motorOptions: options.motorOptions || {}
    }));

    this.wheels = this.suspensionUnits;

    // Rocker-Bogie Mechanism
    this.rockerBogie = new RockerBogieMechanism();

    // Energy Ledger
    this.energyLedger = new EnergyLedger();

    // Steering State
    this.steerAngle = 0.0;
    this.turningRadiusM = Infinity;
    this.contactsEnabled = true;
    this.lockedWheels = false;

    // Performance & Telemetry
    this.lastStepTimeMs = 0.0;
    this.stepCount = 0;
    this.totalNormalForceN = 0.0;
    this.groundedWheelsCount = 6;
    this.averageSlip = 0.0;
    this.maxWheelSlip = 0.0;
    this.averageSinkageCm = 0.0;

    // Scratch buffers
    this._tmpForce = new Vec3();
    this._tmpVel = new Vec3();
    this._tmpRel = new Vec3();
    this._tmpNormal = new Vec3();
    this._bellyLocal = new Vec3(0.0, -0.22, 0.0);
  }

  setSteerAngle(steerRad) {
    this.steerAngle = Math.max(-0.60, Math.min(0.60, steerRad));
    const zMid = 0.06;
    const Lref = 1.08;

    if (Math.abs(this.steerAngle) < 0.002) {
      this.turningRadiusM = Infinity;
      for (const w of this.wheelAssemblies) {
        w.setSteerAngle(0.0);
        w.speedRatio = 1.0;
      }
      return;
    }

    const Rcenter = Lref / Math.tan(this.steerAngle);
    this.turningRadiusM = Rcenter;

    for (const w of this.wheelAssemblies) {
      const dLong = zMid - w.config.z;
      const denom = Rcenter + w.config.x;
      if (w.config.canSteer) {
        const angle = Math.atan2(dLong, denom);
        w.setSteerAngle(angle);
      } else {
        w.setSteerAngle(0.0);
      }
      // Kinematic ICR radius ratio for differential wheel speeds (Contract E1)
      const Ri = Math.hypot(denom, dLong);
      w.speedRatio = Ri / Math.abs(Rcenter);
    }
  }

  spawnAt(x, z, headingRad = 0.0) {
    const groundY = this.terrain.getHeightAt(x, z);
    this.terrain.getNormalAt(x, z, this._tmpNormal);

    const upDefault = new Vec3(0, 1, 0);
    const qTilt = new Quat().setFromUnitVectors(upDefault, this._tmpNormal);
    const qYaw = new Quat().setFromAxisAngle(new Vec3(0, 1, 0), headingRad);
    const qOrient = new Quat().copy(qTilt).multiply(qYaw).normalize();

    const nominalRideHeight = (SUSPENSION_REST_LENGTH_M - 0.113) + WHEEL_RADIUS_M - 0.06;
    const nominalY = groundY + nominalRideHeight;

    this.chassis.spawnAt(x, nominalY, z);
    this.chassis.quaternion.copy(qOrient);
    this.chassis._updateDerivedTensors();

    for (let i = 0; i < 6; i++) {
      this.suspensionUnits[i].evaluateContact(this.chassis, this.terrain, 0.0);
      this.wheelAssemblies[i].angularVelocity = 0.0;
      this.wheelAssemblies[i].rpm = 0.0;
      this.wheelAssemblies[i].updateOrientation(this.chassis.forwardWorld, this.chassis.rightWorld);
    }
    this.rockerBogie.updateKinematics(this.suspensionUnits);

    const ek = this.chassis.getKineticEnergy();
    const ep = this.chassis.getPotentialEnergy(0.0);
    let es = 0.0;
    for (let i = 0; i < 6; i++) {
      es += this.suspensionUnits[i].springPotentialEnergyJ;
    }
    this.energyLedger.initializeBaseline(ek, ep, es);
  }

  step(dt, throttleInput = 0.0, brakeEngaged = false) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // 1. Begin step: applies downward gravity m*g at Center of Gravity
    this.chassis.beginStep();

    // 1b. Atmospheric Drag Coupling
    if (this.atmosphereEnabled && this.environment) {
      const envRes = this.environment.update(dt, this.chassis.position, this.chassis.linearVelocity);
      if (envRes && envRes.dragForceWorld) {
        this.chassis.applyForce(envRes.dragForceWorld);
        this.energyLedger.recordLoss('aerodynamicDragLossJ', (envRes.dragPowerW ?? 0.0) * dt);
      }
    }

    this.totalNormalForceN = 0.0;
    this.groundedWheelsCount = 0;
    let sumSpringEnergyJ = 0.0;
    let sumSlip = 0.0;
    let maxSlip = 0.0;
    let sumSinkCm = 0.0;
    let totalElectricalPowerW = 0.0;

    if (this.contactsEnabled) {
      // 2. Evaluate ground contact for each of the 6 suspension units
      for (let i = 0; i < 6; i++) {
        const sUnit = this.suspensionUnits[i];
        const fn = sUnit.evaluateContact(this.chassis, this.terrain, dt);
        if (sUnit.isGrounded) {
          this.groundedWheelsCount++;
          this.totalNormalForceN += fn;
        }
        sumSpringEnergyJ += sUnit.springPotentialEnergyJ;
      }

      // 3. Rocker-bogie kinematics and load equalization
      this.rockerBogie.updateKinematics(this.suspensionUnits);
      const avgNormalY = Math.max(0.05, Math.min(1.0, this.suspensionUnits[0].contactNormalWorld.y));
      const totalDemand = this.mass * this.gravity * avgNormalY;
      const rollRad = (this.chassis.rollDeg * Math.PI) / 180.0;
      this.rockerBogie.equalizeNormalLoads(this.suspensionUnits, totalDemand, rollRad);

      // Re-sum balanced normal forces
      this.totalNormalForceN = 0.0;
      for (let i = 0; i < 6; i++) {
        if (this.suspensionUnits[i].isGrounded) {
          this.totalNormalForceN += this.suspensionUnits[i].normalForceN;
        }
      }

      // 4. Soil resolution: priority to instance-configured soil profile
      const soil = this.currentSoil;

      for (let i = 0; i < 6; i++) {
        const sUnit = this.suspensionUnits[i];
        const wAssy = this.wheelAssemblies[i];

        if (!sUnit.isGrounded || sUnit.normalForceN <= 0.0) {
          wAssy.normalForceN = 0.0;
          wAssy.tractionForceN = 0.0;
          wAssy.lateralForceN = 0.0;
          continue;
        }

        // Apply normal force vector perpendicular to terrain at contact point
        const normalVec = this._tmpForce.copy(sUnit.contactNormalWorld).scale(sUnit.normalForceN);
        this.chassis.applyForceAtWorldPoint(normalVec, sUnit.contactPointWorld);

        // Update wheel orientation
        wAssy.updateOrientation(this.chassis.forwardWorld, this.chassis.rightWorld);

        // Contact point velocity in world coordinates
        const contactVel = this.chassis.getPointVelocity(sUnit.contactPointWorld, this._tmpVel);

        if (this.lockedWheels) {
          // Locked wheel sliding block / static hold check (T02/T03/T04 mode)
          const fGravity = new Vec3(0, -this.mass * this.gravity, 0);
          const fGravityNorm = fGravity.dot(sUnit.contactNormalWorld);
          const fGravityTanTotal = new Vec3().copy(fGravity).addScaled(sUnit.contactNormalWorld, -fGravityNorm);
          const loadRatio = this.totalNormalForceN > 0 ? (sUnit.normalForceN / this.totalNormalForceN) : (1.0 / 6.0);
          const fGravityTanWheel = new Vec3().copy(fGravityTanTotal).scale(loadRatio);

          // Tangent velocity of chassis along terrain surface
          const vNorm = this.chassis.linearVelocity.dot(sUnit.contactNormalWorld);
          const vTan = this._tmpRel.copy(this.chassis.linearVelocity).addScaled(sUnit.contactNormalWorld, -vNorm);
          const tanSpeed = vTan.length();

          const mu = soil.frictionCoeff ?? this.frictionCoeff;
          const maxCoulomb = mu * sUnit.normalForceN;
          const mEff = this.mass * loadRatio;

          // Tangent static equilibrium demand: opposes tangent gravity and arrests linear tangent velocity
          const fArrest = new Vec3().copy(vTan).scale(-mEff / dt);
          const fDemand = new Vec3().copy(fGravityTanWheel).scale(-1).add(fArrest);
          const demandMag = fDemand.length();

          if (demandMag > maxCoulomb) {
            // Dynamic sliding Coulomb friction: opposes velocity if moving, else opposes gravity demand
            if (tanSpeed > 1e-4) {
              const fSlide = new Vec3().copy(vTan).scale(-maxCoulomb / tanSpeed);
              this.chassis.applyForce(fSlide);
              this.energyLedger.recordLoss('soilShearSlipJ', maxCoulomb * tanSpeed * dt);
            } else {
              const fSlide = new Vec3().copy(fDemand).scale(maxCoulomb / demandMag);
              this.chassis.applyForce(fSlide);
            }
          } else {
            // Static stick: cancels gravity and residual velocity exactly
            this.chassis.applyForce(fDemand);
            this.chassis.angularVelocity.set(0, 0, 0);
            this.chassis.angularMomentumWorld.set(0, 0, 0);
            this.chassis.netTorque.set(0, 0, 0);
          }
        } else {
          // Active wheel rotational dynamics, motor torque, and terramechanics
          const wheelThrottle = throttleInput * (wAssy.speedRatio ?? 1.0);
          const res = wAssy.evaluate(
            dt,
            sUnit.normalForceN,
            contactVel,
            wheelThrottle,
            brakeEngaged,
            soil,
            this.chassis.forwardSpeed
          );

          // Apply 3D wheel ground reaction force to chassis
          this.chassis.applyForceAtWorldPoint(res.forceWorld, sUnit.contactPointWorld);

          // Feed energy ledger
          this.energyLedger.recordLoss('soilShearSlipJ', res.slipPowerW * dt);
          this.energyLedger.recordLoss('motorCopperLossJ', res.copperLossW * dt);
          this.energyLedger.recordLoss('motorMechanicalLossJ', wAssy.motor.gearLossW * dt);
          this.energyLedger.recordLoss('soilCompactionRollingJ', wAssy.rollingLossPowerW * dt);
          if (brakeEngaged && wAssy.brakeTorqueNm > 0) {
            const vBrake = contactVel.dot(wAssy.wheelForwardWorld);
            this.energyLedger.recordLoss('brakeFrictionHeatJ', Math.abs(wAssy.tractionForceN * vBrake) * dt);
          }

          totalElectricalPowerW += wAssy.motor.electricalPowerW;

          const slipMag = wAssy.slipMagnitude;
          sumSlip += slipMag;
          if (slipMag > maxSlip) maxSlip = slipMag;
          sumSinkCm += wAssy.sinkageM * 100.0;
        }
      }

      // Deduct electrical power from battery chemical energy (Contract B2, B4)
      if (totalElectricalPowerW > 0.0 && dt > 0.0) {
        const deltaEnergyJ = totalElectricalPowerW * dt;
        this.energyLedger.batteryChemicalJ = Math.max(0.0, this.energyLedger.batteryChemicalJ - deltaEnergyJ);
        this.energyLedger.batteryCumulativeOutJ += deltaEnergyJ;
      }

      this.averageSlip = this.groundedWheelsCount > 0 ? (sumSlip / this.groundedWheelsCount) : 0.0;
      this.maxWheelSlip = maxSlip;
      this.averageSinkageCm = this.groundedWheelsCount > 0 ? (sumSinkCm / this.groundedWheelsCount) : 0.0;

      // 5. Belly ground contact penalty spring/damper
      const bellyWorld = this._tmpVel.copy(this._bellyLocal).applyMatrix3(this.chassis.rotMatrix).add(this.chassis.position);
      const groundUnderBelly = this.terrain.getHeightAt(bellyWorld.x, bellyWorld.z);
      if (bellyWorld.y < groundUnderBelly) {
        const penetration = groundUnderBelly - bellyWorld.y;
        const vBelly = this.chassis.getPointVelocity(bellyWorld, this._tmpRel);
        const vy = vBelly.dot(this.chassis.upWorld);
        const kBelly = 3.5e5;
        const cBelly = 2.0e4;
        const fBellyMag = Math.max(0.0, kBelly * penetration - cBelly * vy);
        const fBelly = this._tmpForce.copy(this.chassis.upWorld).scale(fBellyMag);
        this.chassis.applyForceAtWorldPoint(fBelly, bellyWorld);
      }

      // Record suspension damper dissipation
      for (let i = 0; i < 6; i++) {
        const sUnit = this.suspensionUnits[i];
        if (sUnit.isGrounded && sUnit.compressionRate !== 0) {
          const power = sUnit.damperC * sUnit.compressionRate * sUnit.compressionRate;
          this.energyLedger.recordLoss('suspensionDampingJ', power * dt);
        }
      }
    }

    // 6. Integrate 6-DOF rigid body
    this.chassis.integrate(dt);

    // 7. Update Energy Ledger
    const ek = this.chassis.getKineticEnergy();
    const ep = this.chassis.getPotentialEnergy(0.0);
    this.energyLedger.updateStep(ek, ep, sumSpringEnergyJ, dt);

    // 8. Performance Monitoring
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.lastStepTimeMs = Math.max(0.001, t1 - t0);
    this.stepCount++;
  }
}
