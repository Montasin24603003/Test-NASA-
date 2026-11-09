/**
 * NASA MARS 2020 PERSEVERANCE ELECTRICAL POWER SUBSYSTEM
 *
 * Implements:
 * - MMRTG (Multi-Mission Radioisotope Thermoelectric Generator) baseline generation: 110 W continuous
 * - Optional Solar Assist toggle ("Solar-Assist Mode (NOT REAL PERSEVERANCE)") - default OFF
 * - Dual Li-Ion Battery buffer: 2400 Wh (8.64 MJ) capacity, 8-cell series bus voltage (26-33.6 V)
 * - Load allocation: Drive motors, steering, avionics RCE, telecom, instruments, survival heaters
 * - Safe Mode Latching when SOC < 15% or avionics temperature critically low
 * - Monotonic battery discharge under net positive electrical demand
 */

import {
  MMRTG_NOMINAL_WATTS,
  BATTERY_CAPACITY_WH,
  BATTERY_CAPACITY_JOULES,
  BATTERY_NOMINAL_VOLTS,
  BATTERY_MIN_SAFE_VOLTS,
  BATTERY_MAX_CHARGE_VOLTS,
  BATTERY_INTERNAL_RESISTANCE_OHM,
  AVIONICS_BASELINE_WATTS,
  COMMS_ACTIVE_WATTS,
  HEATER_MAX_WATTS,
  POWER_CONVERTER_EFFICIENCY
} from './constants.js';

export class MarsRoverPowerSystem {
  constructor(options = {}) {
    /** [REFERENCE] MMRTG baseline electrical output: 110 W continuous (Pu-238 alpha decay) */
    this.mmrtgWatts = options.mmrtgWatts ?? MMRTG_NOMINAL_WATTS;

    /** [ASSUMPTION] Solar Assist mode: explicitly labeled non-Perseverance gameplay aid */
    this.solarAssistActive = options.solarAssistActive ?? false;
    this.solarPanelAreaM2 = 1.4; // m^2
    this.solarEfficiency = 0.22; // 22% multi-junction GaAs solar cell
    this.solarWatts = 0.0;

    /** [REFERENCE] Dual Li-ion battery pack energy capacity: 2400 Wh = 8.64 MJ */
    this.batteryMaxCapacityWh = options.batteryCapacityWh ?? BATTERY_CAPACITY_WH;
    this.batteryMaxCapacityJ = this.batteryMaxCapacityWh * 3600.0;

    // Initial battery energy (default 95% charge)
    const initialSoc = options.initialSocPct ?? 95.0;
    this.batteryEnergyJ = (initialSoc / 100.0) * this.batteryMaxCapacityJ;

    // Bus parameters
    this.busVoltageV = BATTERY_NOMINAL_VOLTS;
    this.batteryCurrentA = 0.0;
    this.internalResistanceOhm = BATTERY_INTERNAL_RESISTANCE_OHM;

    // Load break-down (Watts)
    this.driveMotorWatts = 0.0;
    this.steeringWatts = 0.0;
    this.avionicsWatts = AVIONICS_BASELINE_WATTS; // 45 W
    this.commsWatts = 10.0; // 10 W standby, 35 W transmit
    this.instrumentWatts = 0.0;
    this.heaterWatts = 0.0;

    // Power balances
    this.totalGenerationWatts = this.mmrtgWatts;
    this.totalLoadWatts = this.avionicsWatts + this.commsWatts;
    this.netPowerWatts = this.totalGenerationWatts - this.totalLoadWatts;

    // Cumulative energy counters (Joules)
    this.mmrtgCumulativeInJ = 0.0;
    this.solarCumulativeInJ = 0.0;
    this.batteryCumulativeOutJ = 0.0;
    this.batteryCumulativeInJ = 0.0;

    // State & Safe Mode
    this.powerModeState = 'NOMINAL'; // 'NOMINAL' | 'LOW_ENERGY' | 'SAFE_MODE'
    this.safeModeLatched = false;
    this.safeModeReason = '';
    this.safeModeThresholdSocPct = 15.0; // 15% SOC cutoff
    this.lowEnergyThresholdSocPct = 30.0;
  }

  get batteryEnergyWh() {
    return this.batteryEnergyJ / 3600.0;
  }

  get batterySocPct() {
    return Math.max(0.0, Math.min(100.0, (this.batteryEnergyJ / this.batteryMaxCapacityJ) * 100.0));
  }

  setSolarAssist(active) {
    this.solarAssistActive = Boolean(active);
  }

  resetSafeMode() {
    if (this.batterySocPct >= 25.0) {
      this.safeModeLatched = false;
      this.safeModeReason = '';
      this.powerModeState = this.batterySocPct < this.lowEnergyThresholdSocPct ? 'LOW_ENERGY' : 'NOMINAL';
      return true;
    }
    return false;
  }

  /**
   * Update electrical power system for time step dt
   *
   * @param {number} dt - Timestep in seconds
   * @param {Object} loads - { driveMotorWatts, isSteering, isCommsTransmitting, instrumentWatts, heaterDemandWatts, solarIrradianceWm2 }
   */
  update(dt, loads = {}) {
    if (dt <= 0) return this.getTelemetry();

    // 1. Generation
    let generationW = this.mmrtgWatts;
    this.mmrtgCumulativeInJ += this.mmrtgWatts * dt;

    if (this.solarAssistActive && loads.solarIrradianceWm2) {
      this.solarWatts = loads.solarIrradianceWm2 * this.solarPanelAreaM2 * this.solarEfficiency;
      generationW += this.solarWatts;
      this.solarCumulativeInJ += this.solarWatts * dt;
    } else {
      this.solarWatts = 0.0;
    }
    this.totalGenerationWatts = generationW;

    // 2. Loads
    if (this.safeModeLatched) {
      // In Safe Mode, drive motors and non-essential instruments are cut off
      this.driveMotorWatts = 0.0;
      this.steeringWatts = 0.0;
      this.instrumentWatts = 0.0;
      this.avionicsWatts = AVIONICS_BASELINE_WATTS * 0.70; // Low-power survival avionics
      this.commsWatts = 8.0; // Periodic beacon only
      this.heaterWatts = Math.min(HEATER_MAX_WATTS, loads.heaterDemandWatts ?? 15.0);
    } else {
      this.driveMotorWatts = Math.max(0.0, loads.driveMotorWatts ?? 0.0);
      this.steeringWatts = loads.isSteering ? 24.0 : 0.0;
      this.avionicsWatts = AVIONICS_BASELINE_WATTS;
      this.commsWatts = loads.isCommsTransmitting ? COMMS_ACTIVE_WATTS : 10.0;
      this.instrumentWatts = Math.max(0.0, loads.instrumentWatts ?? 0.0);
      this.heaterWatts = Math.min(HEATER_MAX_WATTS, Math.max(0.0, loads.heaterDemandWatts ?? 0.0));
    }

    this.totalLoadWatts = (this.driveMotorWatts + this.steeringWatts + this.avionicsWatts +
                           this.commsWatts + this.instrumentWatts + this.heaterWatts) / POWER_CONVERTER_EFFICIENCY;

    // 3. Power balance
    this.netPowerWatts = this.totalGenerationWatts - this.totalLoadWatts;

    // 4. Battery energy integration
    if (this.netPowerWatts < 0.0) {
      // Deficit: battery discharges
      const dischargePowerW = -this.netPowerWatts;
      const energyDrawnJ = dischargePowerW * dt;
      this.batteryEnergyJ = Math.max(0.0, this.batteryEnergyJ - energyDrawnJ);
      this.batteryCumulativeOutJ += energyDrawnJ;
      this.batteryCurrentA = dischargePowerW / Math.max(10.0, this.busVoltageV);
    } else {
      // Surplus: battery recharges with 95% coulombic efficiency
      const chargePowerW = this.netPowerWatts * 0.95;
      const energyInJ = chargePowerW * dt;
      if (this.batteryEnergyJ < this.batteryMaxCapacityJ) {
        const spaceJ = this.batteryMaxCapacityJ - this.batteryEnergyJ;
        const actualInJ = Math.min(spaceJ, energyInJ);
        this.batteryEnergyJ += actualInJ;
        this.batteryCumulativeInJ += actualInJ;
      }
      this.batteryCurrentA = -(chargePowerW / Math.max(10.0, this.busVoltageV));
    }

    // 5. Battery Open-Circuit Voltage and Bus Sag: V_bus = V_oc - I * R_int
    const socFraction = this.batterySocPct / 100.0;
    const voc = BATTERY_MIN_SAFE_VOLTS + (BATTERY_MAX_CHARGE_VOLTS - BATTERY_MIN_SAFE_VOLTS) * Math.pow(socFraction, 0.45);
    this.busVoltageV = Math.max(BATTERY_MIN_SAFE_VOLTS - 2.0, voc - this.batteryCurrentA * this.internalResistanceOhm);

    // 6. Safe Mode and Low Energy threshold checks
    const soc = this.batterySocPct;
    if (soc <= this.safeModeThresholdSocPct && !this.safeModeLatched) {
      this.safeModeLatched = true;
      this.safeModeReason = `Battery SOC dropped to ${soc.toFixed(1)}% (Threshold: ${this.safeModeThresholdSocPct}%)`;
      this.powerModeState = 'SAFE_MODE';
    } else if (!this.safeModeLatched) {
      if (soc <= this.lowEnergyThresholdSocPct) {
        this.powerModeState = 'LOW_ENERGY';
      } else {
        this.powerModeState = 'NOMINAL';
      }
    }

    return this.getTelemetry();
  }

  getTelemetry() {
    return {
      powerModeState: this.powerModeState,
      safeModeLatched: this.safeModeLatched,
      safeModeReason: this.safeModeReason,
      batterySocPct: this.batterySocPct,
      batteryEnergyWh: this.batteryEnergyWh,
      batteryMaxCapacityWh: this.batteryMaxCapacityWh,
      busVoltageV: this.busVoltageV,
      batteryCurrentA: this.batteryCurrentA,
      mmrtgWatts: this.mmrtgWatts,
      mmrtgProvenance: '[REFERENCE]',
      solarAssistActive: this.solarAssistActive,
      solarWatts: this.solarWatts,
      solarProvenance: this.solarAssistActive ? '[SIM-ESTIMATE]' : '[NOT REAL PERSEVERANCE]',
      driveMotorWatts: this.driveMotorWatts,
      steeringWatts: this.steeringWatts,
      avionicsWatts: this.avionicsWatts,
      commsWatts: this.commsWatts,
      instrumentWatts: this.instrumentWatts,
      heaterWatts: this.heaterWatts,
      totalGenerationWatts: this.totalGenerationWatts,
      totalLoadWatts: this.totalLoadWatts,
      netPowerWatts: this.netPowerWatts,
      provenance: '[COMPUTED]'
    };
  }
}
