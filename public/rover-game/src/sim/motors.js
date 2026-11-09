/**
 * ELECTRIC HUB ACTUATOR & MOTOR DYNAMICS
 *
 * Implements Physics Fundamentals Contract B4 & B5:
 * - P_elec = (tau * omega) / eta_motor + I^2 * R_winding
 * - DC brushless motor with 100:1 harmonic gear train
 * - Calibrated motor constants: kt = 0.10 N*m/A, ke = 0.10 V/(rad/s)
 * - Current limiting I_max = 15 A
 * - Regenerative braking OFF by default (Contract B5)
 * - Power strictly conserved: P_elec >= P_mech + P_losses (never creates power)
 */

import {
  MOTOR_EFFICIENCY,
  MOTOR_WINDING_RESISTANCE_OHM,
  BATTERY_NOMINAL_VOLTS
} from './constants.js';

export class WheelActuatorMotor {
  constructor(options = {}) {
    this.gearRatio = options.gearRatio ?? 100.0; // 100:1 harmonic drive
    this.kt = options.kt ?? 0.10;                // N*m / A (motor torque constant)
    this.ke = options.ke ?? 0.10;                // V / (rad/s) (back-EMF constant)
    this.resistanceOhm = options.resistance ?? MOTOR_WINDING_RESISTANCE_OHM;
    this.efficiency = options.efficiency ?? MOTOR_EFFICIENCY;
    this.maxCurrentA = options.maxCurrent ?? 15.0; // 15 A current limit
    this.busVolts = options.busVolts ?? BATTERY_NOMINAL_VOLTS;

    // Live Actuator State
    this.throttle = 0.0;       // -1.0 .. +1.0
    this.currentA = 0.0;        // Armature current (A)
    this.appliedVolts = 0.0;    // Terminal voltage (V)
    this.backEmfVolts = 0.0;    // Back-EMF voltage (V)
    this.outputTorqueNm = 0.0;  // Shaft torque delivered to wheel hub (N*m)

    // Electrical Power & Dissipation (Watts)
    this.electricalPowerW = 0.0;
    this.mechanicalPowerW = 0.0;
    this.copperLossW = 0.0;
    this.gearLossW = 0.0;
  }

  /**
   * Evaluate actuator output torque and electrical power draw given throttle command
   *
   * @param {number} throttleInput - Desired drive command [-1.0, +1.0]
   * @param {number} wheelOmegaRadS - Wheel output shaft angular velocity (rad/s)
   * @returns {{ torqueNm: number, electricalPowerW: number, copperLossW: number }}
   */
  evaluate(throttleInput, wheelOmegaRadS) {
    this.throttle = Math.max(-1.0, Math.min(1.0, throttleInput));

    if (Math.abs(this.throttle) < 0.01) {
      this.currentA = 0.0;
      this.appliedVolts = 0.0;
      this.backEmfVolts = 0.0;
      this.outputTorqueNm = 0.0;
      this.electricalPowerW = 0.0;
      this.mechanicalPowerW = 0.0;
      this.copperLossW = 0.0;
      this.gearLossW = 0.0;
      return { torqueNm: 0.0, electricalPowerW: 0.0, copperLossW: 0.0 };
    }

    // Rotor angular velocity inside actuator gearbox
    const rotorOmega = wheelOmegaRadS * this.gearRatio;
    this.backEmfVolts = this.ke * rotorOmega;

    // Terminal voltage commanded by pulse-width modulation (PWM)
    this.appliedVolts = this.throttle * this.busVolts;

    // Net voltage driving armature current
    const vNet = this.appliedVolts - this.backEmfVolts;
    let rawCurrent = vNet / this.resistanceOhm;

    // Clamping to thermal current limit
    this.currentA = Math.max(-this.maxCurrentA, Math.min(this.maxCurrentA, rawCurrent));

    // Motor electromagnetic torque: tau_rotor = kt * I
    const rotorTorque = this.kt * this.currentA;

    // Output shaft torque: tau_wheel = tau_rotor * gearRatio * efficiency
    let shaftTorque = rotorTorque * this.gearRatio * this.efficiency;

    // Contract B5: Regenerative braking is OFF by default.
    // If driving forward and back-EMF exceeds voltage, motor freewheels (zero reverse thrust).
    if (this.throttle > 0 && shaftTorque < 0) {
      shaftTorque = 0.0;
      this.currentA = 0.0;
    } else if (this.throttle < 0 && shaftTorque > 0) {
      shaftTorque = 0.0;
      this.currentA = 0.0;
    }

    this.outputTorqueNm = shaftTorque;

    // Mechanical output power: P_mech = tau * omega
    this.mechanicalPowerW = Math.max(0.0, this.outputTorqueNm * wheelOmegaRadS);

    // Copper Joule loss: P_copper = I^2 * R
    this.copperLossW = this.currentA * this.currentA * this.resistanceOhm;

    // Mechanical gear friction loss
    this.gearLossW = Math.max(0.0, (1.0 - this.efficiency) * Math.abs(rotorTorque * rotorOmega));

    // Electrical power drawn from bus (Contract B4 & B5):
    // Strict closed-form conservation across chopper PWM, armature, and gear train:
    // P_elec = P_mech + P_gearLoss + P_copper
    this.electricalPowerW = this.mechanicalPowerW + this.gearLossW + this.copperLossW;

    return {
      torqueNm: this.outputTorqueNm,
      electricalPowerW: this.electricalPowerW,
      copperLossW: this.copperLossW
    };
  }
}
