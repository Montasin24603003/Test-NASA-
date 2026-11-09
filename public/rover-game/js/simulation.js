import * as THREE from 'three';
import { MARS_GRAVITY, RoverPhysicsEngine } from './physics.js';
import { MARS_REGIONS } from './regions.js';

/**
 * NASA-Style Mars Atmospheric Physics, Electrical Power Bus, 4-Node Thermal Network
 * & Engineering Time-Series Telemetry Recorder.
 *
 * Physical Constants & NASA References:
 * - Mars Surface Gravity g_0 = 3.71 m/s^2 (NASA Mars Fact Sheet / Mars 2020)
 * - Mean Martian Datum Pressure P_0 = 610 Pa (~6.1 mbar at MOLA 0m areoid)
 * - Specific Gas Constant for Mars Atmosphere (95.3% CO2, 2.7% N2, 1.6% Ar): R_spec = 191.18 J/(kg*K)
 * - Top-of-Atmosphere Mean Solar Flux at Mars (1.524 AU): S_0 = 590.0 W/m^2
 * - Perseverance Dual Li-Ion Battery Bus: 8-cell series nominal ~28-32 V, 2 x 43 Ah (~2400 Wh real; time-scaled option)
 */
export class MarsSimulation {
  constructor() {
    // 1. Configurable Mars Environment Parameters
    this.gravity = MARS_GRAVITY;            // m/s^2 [NASA CONSTANT, configurable in Sandbox]
    this.datumRefPressurePa = 610.0;        // Pa at MOLA 0m datum [NASA Reference]
    this.weatherPressureOffsetPa = 0.0;     // User-configurable barometric anomaly (-80..+80 Pa)
    this.customTempOffsetC = 0.0;           // User-configurable temperature offset (-25..+25 C)
    this.windMultiplier = 1.0;              // User-configurable wind factor (0.0..2.5)
    this.customDustTauOffset = 0.0;         // User-configurable optical depth offset (0..2.5)
    this.marsSolarConstantWm2 = 590.0;      // W/m^2 at 1.52 AU
    this.gasConstantMars = 191.18;          // J/(kg*K)

    // 2. Live Calculated Mars Environmental Telemetry (SI Units)
    this.regionId = 'jezero';
    this.molaElevationM = -2558.0;          // MOLA planetary elevation (m)
    this.localElevationM = 2.0;             // Local ENU elevation (m)
    this.temperatureC = -24.0;              // Ambient air temperature at 1.5m MEDA height (°C)
    this.temperatureK = 249.15;             // Ambient air temperature (K)
    this.scaleHeightM = 12830.0;            // Atmospheric scale height H = R*T/g (m)
    this.pressurePa = 745.0;                // Barometric surface pressure (Pa)
    this.atmosphericDensityKgM3 = 0.0156;   // Atmospheric mass density rho (kg/m^3)
    this.windSpeedMs = 4.8;                 // Wind speed at rover mast (m/s)
    this.windDirectionDeg = 112.0;          // Meteorological wind source azimuth (deg)
    this.windVectorWorld = new THREE.Vector3(4.4, 0, 1.8);
    this.dustOpticalDepth = 0.44;           // Atmospheric optical depth tau (dimensionless)
    this.dustConcentrationMgM3 = 0.11;      // Suspended dust mass concentration (mg/m^3)
    this.solarIrradianceWm2 = 365.0;        // Total horizontal surface irradiance (W/m^2)
    this.panelDustFactor = 0.96;            // Cleanliness of auxiliary solar deck (0.45..1.0)

    // 3. Configurable Rover Power & Energy System
    this.batteryPct = 96.0;                 // State of Charge SoC (0..100 %)
    this.baseCapacityWh = 900.0;            // Nominal usable energy pack (Wh)
    this.timeScaleEnergy = 11.0;            // Gameplay discharge acceleration so energy management matters in 15m sessions
    this.capacityMult = 1.0;                // Garage upgrade multiplier
    this.solarEfficiencyMult = 1.0;         // Garage upgrade multiplier
    this.solarPanelAreaM2 = 1.42;           // Auxiliary high-efficiency deck array area (m^2)
    this.solarCellBaseEff = 0.295;          // Triple-junction GaInP/GaAs/Ge cell efficiency (29.5%)
    this.mmrtgNominalWatts = 68.0;          // Continuous Pu-238 thermoelectric baseline (W)

    // Live Electrical Bus Readouts
    this.batteryVoltageV = 31.8;            // DC bus voltage (V)
    this.batteryCurrentA = -2.8;            // Battery current (+A discharging, -A charging)
    this.solarWatts = 180.0;                // Solar array generation (W)
    this.mmrtgWatts = 68.0;                 // MMRTG generation (W)
    this.driveMotorWatts = 0.0;             // 6-wheel actuator mechanical + copper losses (W)
    this.instrumentWatts = 18.0;            // Science & navigation sensors load (W)
    this.commsWatts = 16.0;                 // UHF / X-band telemetry load (W)
    this.heaterWatts = 0.0;                 // Thermal survival heaters load (W)
    this.lightingWatts = 0.0;               // LED headlights load (W)
    this.avionicsWatts = 44.0;              // RCE flight computer load (W)
    this.powerDrawWatts = 78.0;             // Total electrical load (W)
    this.netPowerWatts = 170.0;             // Generation - Load (W)
    this.remainingEnergyWh = 864.0;         // Remaining stored energy (Wh)
    this.estimatedEnduranceMin = Infinity;  // Minutes until battery depletion at current smoothed draw
    this._smoothedNetWatts = 50.0;

    // Transient Instrument Loads
    this.activeDrillPowerW = 0.0;           // 420 W continuous during rotary-percussive coring
    this._laserCapRechargeTimer = 0.0;      // SuperCam capacitor bank recharge window (s)
    this._commsBurstTimer = 0.0;

    // Power Governance State ('NOMINAL' | 'LOW_ENERGY' | 'INSTRUMENT_RESTRICTED' | 'SAFE_MODE')
    this.powerModeState = 'NOMINAL';
    this.safeModeLatched = false;

    // 4. Four-Node Rover Thermal Network (°C)
    this.tempBatteryC = 14.5;               // WEB thermally regulated Li-Ion pack (-15..+35 °C)
    this.tempMotorC = -12.0;                // Wheel drive/steer actuators (-80..+95 °C)
    this.tempElectronicsC = 21.0;           // RCE Warm Electronics Box (+5..+45 °C)
    this.tempInstrumentC = -22.0;           // Remote Sensing Mast / SuperCam head (°C)
    this.thermalWarnings = [];

    // 5. Distance Odometer & Sim Clock
    this.simElapsedSec = 0.0;
    this.sessionDistanceM = 0.0;
    this.totalDistanceM = 0.0;
    this._lastPos = null;

    // 6. Rolling Engineering Time-Series History (for Full-Screen Engineering Mode Charts & CSV/JSON Export)
    this.history = [];
    this.maxHistorySamples = 360;           // 3 minutes @ 2 Hz
    this._historySampleTimer = 0;
  }

  resetForExpedition(pos, regionId = null) {
    if (regionId) this.regionId = regionId;
    this.batteryPct = Math.max(this.batteryPct, 88.0);
    this.safeModeLatched = false;
    this.powerModeState = 'NOMINAL';
    this.sessionDistanceM = 0.0;
    this.activeDrillPowerW = 0.0;
    this._lastPos = pos ? pos.clone() : null;
  }

  cleanSolarPanels() {
    this.panelDustFactor = 1.0;
  }

  triggerLaserCapacitorLoad() {
    this._laserCapRechargeTimer = 2.8;
  }

  consumeInstantEnergy(wattSeconds) {
    const capWh = (this.baseCapacityWh * this.capacityMult) / this.timeScaleEnergy;
    const deltaPct = (wattSeconds / 3600.0 / capWh) * 100.0;
    this.batteryPct = Math.max(0.0, this.batteryPct - deltaPct);
  }

  isLowPowerLimp() {
    return this.safeModeLatched || this.batteryPct <= 4.0;
  }

  areInstrumentsRestricted() {
    return this.safeModeLatched || this.batteryPct < 10.0;
  }

  isOverdriveRestricted() {
    return this.safeModeLatched || this.batteryPct < 18.0;
  }

  update(dt, physics, atmosphere, rover, controls, regionId = 'jezero') {
    if (dt <= 0) return;
    this.simElapsedSec += dt;
    this.regionId = regionId || this.regionId;
    const regCfg = MARS_REGIONS[this.regionId] || MARS_REGIONS.jezero;

    // Sync configurable gravity with physics solver
    if (Math.abs(physics.gravity - this.gravity) > 0.001) {
      physics.setGravity(this.gravity);
    }

    // -------------------------------------------------------------------------
    // 1. Odometer Integration
    // -------------------------------------------------------------------------
    if (!this._lastPos) {
      this._lastPos = physics.position.clone();
    } else {
      const d = physics.position.distanceTo(this._lastPos);
      if (d < 8.0) {
        this.sessionDistanceM += d;
        this.totalDistanceM += d;
      }
      this._lastPos.copy(physics.position);
    }

    // -------------------------------------------------------------------------
    // 2. Mars Atmospheric Physics (Elevation, Temperature, Pressure, Density, Wind, Solar, Dust)
    // -------------------------------------------------------------------------
    this.localElevationM = physics.position.y;
    this.molaElevationM = (regCfg.datumElevation || -2560) + this.localElevationM;

    // Diurnal temperature harmonic modeled on Perseverance MEDA air temperature curve:
    // Peak ~14:25 LMST (solFraction=0.60), Pre-dawn minimum ~05:20 LMST (solFraction=0.22)
    const thermalPhase = (atmosphere.solFraction - 0.60) * Math.PI * 2.0;
    const diurnalWave = Math.cos(thermalPhase) - 0.16 * Math.cos(2.0 * thermalPhase);
    // Dust storms damp diurnal swing (block daytime shortwave, trap nighttime longwave IR)
    const stormDamp = 1.0 - atmosphere.stormIntensity * 0.48;
    const stormNightWarming = atmosphere.stormIntensity * 6.5;
    // Adiabatic/tropospheric lapse rate ~ -2.2 K/km above Jezero floor (-2560m)
    const altDeltaKm = (this.molaElevationM - (-2560.0)) / 1000.0;
    const lapseOffsetC = -2.2 * altDeltaKm;

    this.temperatureC = -51.5
      + (regCfg.ambientTempOffsetC || 0)
      + this.customTempOffsetC
      + lapseOffsetC
      + stormNightWarming
      + diurnalWave * 31.5 * stormDamp;
    this.temperatureK = Math.max(150.0, this.temperatureC + 273.15);

    // Hydrostatic Barometric Equation: P(z) = P_datum * exp(-z_MOLA / H), where H = R_spec * T / g
    this.scaleHeightM = (this.gasConstantMars * this.temperatureK) / Math.max(1.0, this.gravity);
    const diurnalPressureTide = 16.5 * Math.cos((atmosphere.solFraction - 0.34) * Math.PI * 2.0);
    const stormLowPressure = -24.0 * atmosphere.stormIntensity;
    this.pressurePa = Math.max(
      120.0,
      this.datumRefPressurePa * Math.exp(-this.molaElevationM / this.scaleHeightM)
        + diurnalPressureTide
        + stormLowPressure
        + this.weatherPressureOffsetPa
    );

    // Ideal Gas Law for CO2-dominated Martian air: rho = P / (R_spec * T)
    this.atmosphericDensityKgM3 = this.pressurePa / (this.gasConstantMars * this.temperatureK);
    physics.airDensityKgM3 = this.atmosphericDensityKgM3;

    // Deterministic Synoptic + Katabatic Slope Wind Vector (NO random jumps)
    const baseWind = regCfg.windBaseMs || 5.0;
    const prevDir = regCfg.prevailingWindDeg || 110.0;
    const tSec = this.simElapsedSec;
    const harmonicGust = Math.sin(tSec * 0.43) * 1.45 + Math.sin(tSec * 1.17 + 0.8) * 0.75;
    const diurnalConvection = Math.max(0, diurnalWave) * 2.4;
    this.windSpeedMs = Math.max(
      0.4,
      (baseWind + diurnalConvection + atmosphere.stormIntensity * 28.5 + harmonicGust) * this.windMultiplier
    );

    const dirSwing = Math.sin(tSec * 0.11) * 14.0 + atmosphere.stormIntensity * 22.0;
    this.windDirectionDeg = (((prevDir + dirSwing) % 360) + 360) % 360;
    // Meteorological wind direction is where wind blows FROM; convert to velocity vector wind blows TOWARD
    const blowTowardRad = ((this.windDirectionDeg + 180.0) % 360) * THREE.MathUtils.DEG2RAD;
    this.windVectorWorld.set(
      Math.sin(blowTowardRad) * this.windSpeedMs,
      0,
      -Math.cos(blowTowardRad) * this.windSpeedMs
    );
    physics.windVelocityWorld.copy(this.windVectorWorld);

    // Optical Depth (tau), Suspended Dust Concentration (mg/m^3) & Beer-Lambert Solar Irradiance (W/m^2)
    const baseTau = regCfg.baseDustTau || 0.44;
    this.dustOpticalDepth = Math.max(0.15, baseTau + this.customDustTauOffset + atmosphere.stormIntensity * 3.85);
    this.dustConcentrationMgM3 = 0.28 * Math.pow(this.dustOpticalDepth, 1.35);

    const sunDir = atmosphere.sunDirection;
    const sinSunElev = Math.max(0, sunDir.y);
    if (sinSunElev > 0.005) {
      const airmass = 1.0 / Math.max(0.08, sinSunElev);
      const directBeamTrans = Math.exp(-this.dustOpticalDepth * Math.min(8.5, airmass * 0.55));
      const directHoriz = this.marsSolarConstantWm2 * sinSunElev * directBeamTrans;
      // Forward-scattered diffuse Martian sky irradiance
      const diffuseHoriz = this.marsSolarConstantWm2 * sinSunElev * 0.22 * (1.0 - directBeamTrans)
        * Math.exp(-this.dustOpticalDepth * 0.22);
      this.solarIrradianceWm2 = Math.max(0, directHoriz + diffuseHoriz);
    } else {
      this.solarIrradianceWm2 = 0.0;
    }

    // Gradual dust settling on solar deck during storms, mild wind-clearing at high clean gusts
    if (atmosphere.stormIntensity > 0.35) {
      this.panelDustFactor = Math.max(0.52, this.panelDustFactor - dt * 0.0012 * atmosphere.stormIntensity);
    } else if (this.windSpeedMs > 7.5 && atmosphere.stormIntensity < 0.08) {
      this.panelDustFactor = Math.min(0.98, this.panelDustFactor + dt * 0.0004);
    }

    // -------------------------------------------------------------------------
    // 3. Rover Electrical Power Generation & Subsystem Load Distribution
    // -------------------------------------------------------------------------
    const deckUp = new THREE.Vector3(0, 1, 0).applyQuaternion(physics.quaternion);
    const cosIncidence = sinSunElev > 0.01
      ? THREE.MathUtils.clamp(deckUp.dot(sunDir) / Math.max(0.18, sinSunElev), 0.15, 1.35)
      : 0;

    this.solarWatts = this.solarIrradianceWm2
      * this.solarPanelAreaM2
      * this.solarCellBaseEff
      * this.panelDustFactor
      * cosIncidence
      * this.solarEfficiencyMult;

    this.mmrtgWatts = this.mmrtgNominalWatts;

    // Power Governance State Machine with Hysteresis
    if (this.batteryPct <= 4.0) {
      this.safeModeLatched = true;
    } else if (this.safeModeLatched && this.batteryPct >= 7.5) {
      this.safeModeLatched = false;
    }

    if (this.safeModeLatched) {
      this.powerModeState = 'SAFE_MODE';
    } else if (this.batteryPct < 10.0) {
      this.powerModeState = 'INSTRUMENT_RESTRICTED';
    } else if (this.batteryPct < 20.0) {
      this.powerModeState = 'LOW_ENERGY';
    } else {
      this.powerModeState = 'NOMINAL';
    }

    // A. 6-Wheel Drive & Steer Actuator Electrical Power directly from Physics Torque * Angular Velocity!
    let mechPowerSum = 0;
    let copperLossSum = 0;
    for (let i = 0; i < physics.wheels.length; i++) {
      const w = physics.wheels[i];
      const mechW = Math.abs(w.driveTorqueNm * w.angularSpeed);
      // Regenerative recovery when braking/descending, motor efficiency 0.78 when driving
      if (w.driveTorqueNm * w.angularSpeed >= 0) {
        mechPowerSum += mechW / 0.78;
      } else {
        mechPowerSum += mechW * 0.25; // Minor inverter overhead
      }
      // Winding I^2*R Joule loss proportional to torque squared (high when stalled on steep slope or sand!)
      copperLossSum += (w.driveTorqueNm * w.driveTorqueNm) * 0.0018;
    }
    const steerServoW = (Math.abs(controls.steerLeft - controls.steerRight) > 0.05) ? 14.0 : 0.0;
    this.driveMotorWatts = Math.min(620.0, mechPowerSum * 0.085 + copperLossSum + steerServoW);

    // B. Avionics, Science Instruments, Comms & Lighting
    this.avionicsWatts = this.safeModeLatched ? 26.0 : 44.0;

    if (this._laserCapRechargeTimer > 0) {
      this._laserCapRechargeTimer = Math.max(0, this._laserCapRechargeTimer - dt);
    }
    const superCamRechargeW = this._laserCapRechargeTimer > 0 ? 165.0 : 0.0;
    const baseSensorsW = this.safeModeLatched ? 6.0 : 18.0;
    this.instrumentWatts = baseSensorsW + superCamRechargeW + this.activeDrillPowerW;

    this._commsBurstTimer = (this._commsBurstTimer + dt) % 24.0;
    this.commsWatts = this.safeModeLatched ? 8.0 : (this._commsBurstTimer < 3.5 ? 48.0 : 14.0);

    // Shed headlights automatically if rover enters emergency Safe Mode
    if (this.safeModeLatched && rover && rover.headlightsOn) {
      rover.toggleHeadlights(false);
    }
    this.lightingWatts = (rover && rover.headlightsOn) ? 44.0 : 0.0;

    // C. Thermostatic Survival Heaters
    let heaterDemandW = 0;
    if (this.tempBatteryC < -5.0) {
      heaterDemandW += (-5.0 - this.tempBatteryC) * 3.8;
    }
    if (this.tempElectronicsC < 6.0) {
      heaterDemandW += (6.0 - this.tempElectronicsC) * 2.6;
    }
    if (this.tempMotorC < -52.0 && !this.safeModeLatched) {
      heaterDemandW += (-52.0 - this.tempMotorC) * 1.6;
    }
    if (this.powerModeState === 'LOW_ENERGY') heaterDemandW *= 0.65;
    this.heaterWatts = Math.min(140.0, heaterDemandW);

    this.powerDrawWatts = this.avionicsWatts
      + this.driveMotorWatts
      + this.instrumentWatts
      + this.commsWatts
      + this.lightingWatts
      + this.heaterWatts;

    const totalGenWatts = this.solarWatts + this.mmrtgWatts;
    this.netPowerWatts = totalGenWatts - this.powerDrawWatts;
    this._smoothedNetWatts = THREE.MathUtils.lerp(this._smoothedNetWatts, this.netPowerWatts, Math.min(1, dt * 1.5));

    // D. Li-Ion 8S Bus Voltage, Internal Resistance Sag & Current
    const socFrac = this.batteryPct / 100.0;
    const vOcv = 25.4 + 7.2 * socFrac - 0.9 * Math.exp(-socFrac * 12.0);
    // Cold battery internal resistance increases below 0 °C
    const rInternal = 0.065 * (1.0 + Math.max(0, -this.tempBatteryC) * 0.035);
    const approxCurrent = -this.netPowerWatts / Math.max(22.0, vOcv);
    this.batteryVoltageV = THREE.MathUtils.clamp(vOcv - approxCurrent * rInternal, 23.5, 33.2);
    this.batteryCurrentA = -this.netPowerWatts / this.batteryVoltageV; // +A discharge, -A charge

    // E. State of Charge Integration & Endurance Estimate
    const fullPackWh = this.baseCapacityWh * this.capacityMult;
    const effectiveSimCapWh = fullPackWh / this.timeScaleEnergy;
    const deltaWh = (this.netPowerWatts * dt) / 3600.0;
    this.batteryPct = THREE.MathUtils.clamp(
      this.batteryPct + (deltaWh / effectiveSimCapWh) * 100.0,
      0.0,
      100.0
    );
    this.remainingEnergyWh = fullPackWh * (this.batteryPct / 100.0);

    if (this._smoothedNetWatts < -2.0) {
      const hoursRealSim = (effectiveSimCapWh * (this.batteryPct / 100.0)) / Math.abs(this._smoothedNetWatts);
      this.estimatedEnduranceMin = Math.max(0.1, hoursRealSim * 60.0);
    } else {
      this.estimatedEnduranceMin = Infinity; // Net charging / sustainable!
    }

    // -------------------------------------------------------------------------
    // 4. Four-Node Thermal Network Integration (Lumped Heat Capacity ODEs)
    // -------------------------------------------------------------------------
    const hConv = 1.6 + 0.85 * Math.sqrt(this.atmosphericDensityKgM3 * 55.0 * Math.max(0.5, this.windSpeedMs));

    // Battery Node (insulated inside WEB + MMRTG waste heat + Joule I^2*R + survival heater)
    const qBatIn = 12.0 + (this.batteryCurrentA * this.batteryCurrentA * rInternal) + this.heaterWatts * 0.55;
    const qBatOut = 0.65 * (this.tempBatteryC - this.temperatureC) * 0.22;
    this.tempBatteryC += ((qBatIn - qBatOut) / 420.0) * dt * 8.0;

    // Drive Actuator Motors Node (exposed on wheel hubs: motor heat vs wind convection)
    const qMotorIn = this.driveMotorWatts * 0.26 + this.heaterWatts * 0.20;
    const qMotorOut = hConv * 0.95 * (this.tempMotorC - this.temperatureC);
    this.tempMotorC += ((qMotorIn - qMotorOut) / 185.0) * dt * 8.0;

    // RCE Warm Electronics Box Node (MMRTG HRS loop + avionics dissipation)
    const qElecIn = this.avionicsWatts * 0.85 + 16.0 + this.heaterWatts * 0.25;
    const qElecOut = 0.82 * (this.tempElectronicsC - this.temperatureC);
    this.tempElectronicsC += ((qElecIn - qElecOut) / 360.0) * dt * 8.0;

    // Mast / Science Instrument Head Node (exposed to ambient Mars air & solar irradiance)
    const qInstSolar = this.solarIrradianceWm2 * 0.032 + this.instrumentWatts * 0.35;
    const qInstOut = hConv * 1.15 * (this.tempInstrumentC - this.temperatureC);
    this.tempInstrumentC += ((qInstSolar - qInstOut) / 110.0) * dt * 8.0;

    // Evaluate Thermal Warnings
    this.thermalWarnings = [];
    if (this.tempMotorC > 75.0) this.thermalWarnings.push(`HIGH WHEEL MOTOR TEMP (${this.tempMotorC.toFixed(1)}°C)`);
    if (this.tempMotorC < -62.0) this.thermalWarnings.push(`COLD ACTUATOR DRAG (${this.tempMotorC.toFixed(1)}°C)`);
    if (this.tempBatteryC < -10.0) this.thermalWarnings.push(`LOW BATTERY PACK TEMP (${this.tempBatteryC.toFixed(1)}°C)`);
    if (this.tempBatteryC > 42.0) this.thermalWarnings.push(`HIGH BATTERY PACK TEMP (${this.tempBatteryC.toFixed(1)}°C)`);
    if (this.tempInstrumentC < -68.0) this.thermalWarnings.push(`MAST OPTICS COLD LIMIT (${this.tempInstrumentC.toFixed(1)}°C)`);

    // -------------------------------------------------------------------------
    // 5. Sample Time-Series Telemetry Buffer (2 Hz)
    // -------------------------------------------------------------------------
    this._historySampleTimer += dt;
    if (this._historySampleTimer >= 0.5) {
      this._historySampleTimer = 0;
      this._recordHistorySnapshot(physics, atmosphere);
    }
  }

  _recordHistorySnapshot(physics, atmosphere) {
    const frontSlip = ((physics.wheels[0].slipRatio + physics.wheels[1].slipRatio) * 0.5) * 100.0;
    const midSlip = ((physics.wheels[2].slipRatio + physics.wheels[3].slipRatio) * 0.5) * 100.0;
    const rearSlip = ((physics.wheels[4].slipRatio + physics.wheels[5].slipRatio) * 0.5) * 100.0;

    this.history.push({
      t: Number(this.simElapsedSec.toFixed(1)),
      sol: atmosphere.solNumber,
      lmst: atmosphere.getLMSTString(),
      x: Number(physics.position.x.toFixed(2)),
      y: Number(physics.position.y.toFixed(2)),
      z: Number(physics.position.z.toFixed(2)),
      speedMs: Number(physics.forwardSpeed.toFixed(3)),
      accelMs2: Number(physics.longitudinalAccel.toFixed(3)),
      slopeDeg: Number(physics.slopeDeg.toFixed(2)),
      pitchDeg: Number(physics.pitchDeg.toFixed(2)),
      rollDeg: Number(physics.rollDeg.toFixed(2)),
      avgSlipPct: Number((physics.averageSlip * 100).toFixed(1)),
      frontSlipPct: Number(frontSlip.toFixed(1)),
      midSlipPct: Number(midSlip.toFixed(1)),
      rearSlipPct: Number(rearSlip.toFixed(1)),
      sinkageCm: Number(physics.averageSinkageCm.toFixed(2)),
      tractionN: Number(physics.totalLongitudinalForceN.toFixed(1)),
      tracLimitN: Number(physics.totalTractionLimitN.toFixed(1)),
      slopeGravN: Number(physics.slopeGravityForceN.toFixed(1)),
      socPct: Number(this.batteryPct.toFixed(2)),
      voltageV: Number(this.batteryVoltageV.toFixed(2)),
      currentA: Number(this.batteryCurrentA.toFixed(2)),
      genWatts: Number((this.solarWatts + this.mmrtgWatts).toFixed(1)),
      loadWatts: Number(this.powerDrawWatts.toFixed(1)),
      driveWatts: Number(this.driveMotorWatts.toFixed(1)),
      solarIrrWm2: Number(this.solarIrradianceWm2.toFixed(1)),
      pressurePa: Number(this.pressurePa.toFixed(1)),
      tempAmbC: Number(this.temperatureC.toFixed(1)),
      tempBatC: Number(this.tempBatteryC.toFixed(1)),
      tempMotC: Number(this.tempMotorC.toFixed(1)),
      tempElecC: Number(this.tempElectronicsC.toFixed(1)),
      tempInstC: Number(this.tempInstrumentC.toFixed(1)),
      soil: physics.currentSoil
    });

    if (this.history.length > this.maxHistorySamples) {
      this.history.shift();
    }
  }

  /**
   * Exports recorded telemetry history as RFC-4180 CSV string with SI units in headers
   */
  exportTelemetryCSV() {
    const cols = [
      'time_s', 'sol', 'lmst', 'pos_x_m', 'pos_y_m', 'pos_z_m',
      'speed_ms', 'accel_ms2', 'slope_deg', 'pitch_deg', 'roll_deg',
      'avg_slip_pct', 'front_slip_pct', 'mid_slip_pct', 'rear_slip_pct',
      'sinkage_cm', 'traction_force_N', 'traction_limit_N', 'slope_gravity_N',
      'battery_soc_pct', 'bus_voltage_V', 'battery_current_A',
      'power_gen_W', 'power_load_W', 'drive_motor_W',
      'solar_irradiance_Wm2', 'pressure_Pa',
      'temp_ambient_C', 'temp_battery_C', 'temp_motor_C', 'temp_electronics_C', 'temp_instrument_C',
      'soil_profile'
    ];

    const rows = [cols.join(',')];
    for (const h of this.history) {
      rows.push([
        h.t, h.sol, `"${h.lmst}"`, h.x, h.y, h.z,
        h.speedMs, h.accelMs2, h.slopeDeg, h.pitchDeg, h.rollDeg,
        h.avgSlipPct, h.frontSlipPct, h.midSlipPct, h.rearSlipPct,
        h.sinkageCm, h.tractionN, h.tracLimitN, h.slopeGravN,
        h.socPct, h.voltageV, h.currentA,
        h.genWatts, h.loadWatts, h.driveWatts,
        h.solarIrrWm2, h.pressurePa,
        h.tempAmbC, h.tempBatC, h.tempMotC, h.tempElecC, h.tempInstC,
        `"${h.soil}"`
      ].join(','));
    }
    return rows.join('\n');
  }

  /**
   * Exports current snapshot + full telemetry history + physical assumptions as structured JSON
   */
  exportTelemetryJSON(physics, navigation = null) {
    return JSON.stringify({
      metadata: {
        platform: 'ROVER EXPEDITION — Planetary Robotics & Terramechanics Simulation',
        dataProvenance: 'SIMULATED ENGINEERING TELEMETRY (Grounded on NASA Mars 2020 Reference Constants)',
        exportedAtISO: new Date().toISOString(),
        constants: {
          marsGravity_ms2: this.gravity,
          roverMass_kg: physics.mass,
          wheelRadius_m: physics.wheelRadius,
          wheelWidth_m: physics.wheelWidth,
          datumPressureRef_Pa: this.datumRefPressurePa,
          marsSolarConstant_Wm2: this.marsSolarConstantWm2,
          marsGasConstant_JkgK: this.gasConstantMars
        }
      },
      currentWheelStates: physics.wheels.map((w) => ({
        wheel: w.name,
        grounded: w.grounded,
        rpm: Number(w.rpm.toFixed(2)),
        angularVelocity_rads: Number(w.angularSpeed.toFixed(3)),
        driveTorque_Nm: Number(w.driveTorqueNm.toFixed(2)),
        normalForce_N: Number(w.normalForce.toFixed(1)),
        tractionForce_N: Number(w.tractionForceN.toFixed(1)),
        slipRatio_pct: Number((w.slipRatio * 100).toFixed(1)),
        sinkage_cm: Number(w.sinkageCm.toFixed(2)),
        suspensionTravel_cm: Number(w.suspensionTravelCm.toFixed(2)),
        steerAngle_deg: Number(w.steerDeg.toFixed(2)),
        soilType: w.soilType
      })),
      navigationSnapshot: navigation ? navigation.getSnapshot() : null,
      timeSeriesHistory: this.history
    }, null, 2);
  }
}
