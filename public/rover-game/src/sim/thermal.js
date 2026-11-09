/**
 * NASA MARS 2020 PERSEVERANCE 4-NODE LUMPED THERMAL CAPACITANCE ODE MODEL
 *
 * Implements:
 * - 4 thermal nodes:
 *   1. Warm Electronics Box (WEB) / Avionics (C = 45,000 J/K)
 *   2. Dual Li-Ion Battery Pack (C = 30,000 J/K)
 *   3. Wheel Actuators & Drive Gearboxes (C = 20,000 J/K)
 *   4. Remote Sensing Mast / Mastcam-Z / SuperCam (C = 10,000 J/K)
 * - Heat inputs:
 *   - MMRTG Heat Rejection System (HRS) pumped Freon loops transferring waste heat (~120 W thermal) into WEB
 *   - Internal electrical dissipation (avionics, copper/friction losses)
 *   - Solar radiative absorptance
 * - Heat losses:
 *   - Aerogel insulation thermal conductance
 *   - Convective cooling in thin CO2 atmosphere
 *   - Radiative emission into cold Martian sky (Stefan-Boltzmann: epsilon * sigma * A * (T^4 - T_sky^4))
 * - Thermostatic survival heaters (15-40 W) with safe-mode threshold at -40 deg C
 */

export class MarsRoverThermalSystem {
  constructor(options = {}) {
    // Stefan-Boltzmann constant
    this.sigma = 5.670374e-8; // W/(m^2*K^4)

    // Node Temperatures (Kelvin and Celsius)
    // Nominal initial temperatures at midday
    this.tempElectronicsK = options.tempElectronicsK ?? 295.15; // +22 deg C (inside insulated WEB)
    this.tempBatteryK = options.tempBatteryK ?? 291.15;         // +18 deg C
    this.tempMotorsK = options.tempMotorsK ?? 261.15;           // -12 deg C
    this.tempMastK = options.tempMastK ?? 249.15;               // -24 deg C

    // Thermal Capacitances (J/K)
    this.capElectronics = 45000.0;
    this.capBattery = 30000.0;
    this.capMotors = 20000.0;
    this.capMast = 10000.0;

    // Thermal Conductances between nodes (W/K)
    this.gElectronicsBattery = 4.5;
    this.gElectronicsMotors = 1.2;
    this.gElectronicsMast = 0.8;

    // Environmental Conductances & Radiative Properties (W/K, m^2)
    this.gWebAmbient = 1.8;      // Aerogel blanket conduction
    this.gMotorsAmbient = 3.5;   // Direct exposure of aluminum wheel hubs
    this.gMastAmbient = 2.4;     // Composite mast strut convection

    this.emissivityWeb = 0.85;
    this.emissivityMotors = 0.80;
    this.emissivityMast = 0.85;

    this.areaRadWeb = 1.5;    // m^2
    this.areaRadMotors = 0.8; // m^2
    this.areaRadMast = 0.5;   // m^2

    // Heaters (Watts)
    this.heaterWebWatts = 0.0;
    this.heaterBatteryWatts = 0.0;
    this.totalHeaterDemandWatts = 0.0;

    // Critical Safe Mode flag
    this.thermalSafeModeTriggered = false;
  }

  get tempElectronicsC() { return this.tempElectronicsK - 273.15; }
  get tempBatteryC() { return this.tempBatteryK - 273.15; }
  get tempMotorsC() { return this.tempMotorsK - 273.15; }
  get tempMastC() { return this.tempMastK - 273.15; }

  /**
   * Integrate 4-node thermal ODE over timestep dt
   *
   * @param {number} dt - Timestep in seconds
   * @param {number} ambientTempK - Martian atmospheric temperature (K)
   * @param {number} solarIrradianceWm2 - Direct solar flux
   * @param {Object} electricalHeat - { avionicsWatts, motorHeatWatts, instrumentWatts }
   */
  update(dt, ambientTempK, solarIrradianceWm2 = 0.0, electricalHeat = {}) {
    if (dt <= 0) return this.getTelemetry();

    const tAmb = Math.max(120.0, ambientTempK);
    const tSky = Math.max(100.0, tAmb - 15.0); // Cold deep Martian sky effective radiation temperature

    const qAvionics = electricalHeat.avionicsWatts ?? 45.0;
    const qMotorLoss = electricalHeat.motorHeatWatts ?? 0.0;
    const qInstLoss = electricalHeat.instrumentWatts ?? 0.0;

    // 1. Thermostatic heaters: activate when temps drop near safe lower limits
    // Battery heater: turns on below -5 deg C (268.15 K)
    if (this.tempBatteryK < 268.15) {
      const deficit = 268.15 - this.tempBatteryK;
      this.heaterBatteryWatts = Math.min(25.0, deficit * 5.0);
    } else {
      this.heaterBatteryWatts = 0.0;
    }

    // WEB survival heater: turns on below -30 deg C (243.15 K)
    if (this.tempElectronicsK < 243.15) {
      const deficit = 243.15 - this.tempElectronicsK;
      this.heaterWebWatts = Math.min(40.0, deficit * 8.0);
    } else {
      this.heaterWebWatts = 0.0;
    }

    this.totalHeaterDemandWatts = this.heaterBatteryWatts + this.heaterWebWatts;

    // 2. Heat inputs
    // NASA Mars 2020 MMRTG Heat Rejection System: pumped fluid loop transfers ~120 W thermal decay heat
    const qMmrtgHrsThermal = 120.0;

    // Direct solar absorption: alpha_solar * A * I
    const qSolarWeb = 0.65 * this.areaRadWeb * solarIrradianceWm2;
    const qSolarMast = 0.70 * this.areaRadMast * solarIrradianceWm2;

    // 3. Node 1: Electronics / WEB
    const qCondWebBattery = this.gElectronicsBattery * (this.tempBatteryK - this.tempElectronicsK);
    const qCondWebMotors = this.gElectronicsMotors * (this.tempMotorsK - this.tempElectronicsK);
    const qCondWebMast = this.gElectronicsMast * (this.tempMastK - this.tempElectronicsK);
    const qConvWeb = this.gWebAmbient * (tAmb - this.tempElectronicsK);
    const qRadWeb = this.emissivityWeb * this.sigma * this.areaRadWeb * (Math.pow(tSky, 4) - Math.pow(this.tempElectronicsK, 4));

    const netQElectronics = qAvionics + qMmrtgHrsThermal + this.heaterWebWatts +
                            qSolarWeb + qCondWebBattery + qCondWebMotors + qCondWebMast +
                            qConvWeb + qRadWeb;

    // 4. Node 2: Battery
    const qCondBattWeb = -qCondWebBattery;
    const qConvBatt = 0.5 * (tAmb - this.tempBatteryK);
    const netQBattery = this.heaterBatteryWatts + qCondBattWeb + qConvBatt;

    // 5. Node 3: Motors & Gearboxes
    const qCondMotWeb = -qCondWebMotors;
    const qConvMot = this.gMotorsAmbient * (tAmb - this.tempMotorsK);
    const qRadMot = this.emissivityMotors * this.sigma * this.areaRadMotors * (Math.pow(tSky, 4) - Math.pow(this.tempMotorsK, 4));
    const netQMotors = qMotorLoss + qCondMotWeb + qConvMot + qRadMot;

    // 6. Node 4: Mast & Remote Sensing Instruments
    const qCondMastWeb = -qCondWebMast;
    const qConvMast = this.gMastAmbient * (tAmb - this.tempMastK);
    const qRadMast = this.emissivityMast * this.sigma * this.areaRadMast * (Math.pow(tSky, 4) - Math.pow(this.tempMastK, 4));
    const netQMast = qInstLoss + qSolarMast + qCondMastWeb + qConvMast + qRadMast;

    // 7. Euler integration
    this.tempElectronicsK += (netQElectronics / this.capElectronics) * dt;
    this.tempBatteryK += (netQBattery / this.capBattery) * dt;
    this.tempMotorsK += (netQMotors / this.capMotors) * dt;
    this.tempMastK += (netQMast / this.capMast) * dt;

    // 8. Safe mode condition: electronics < -40 deg C (233.15 K)
    this.thermalSafeModeTriggered = this.tempElectronicsK < 233.15;

    return this.getTelemetry();
  }

  getTelemetry() {
    return {
      tempElectronicsC: this.tempElectronicsC,
      tempBatteryC: this.tempBatteryC,
      tempMotorsC: this.tempMotorsC,
      tempMastC: this.tempMastC,
      tempElectronicsK: this.tempElectronicsK,
      tempBatteryK: this.tempBatteryK,
      tempMotorsK: this.tempMotorsK,
      tempMastK: this.tempMastK,
      heaterWebWatts: this.heaterWebWatts,
      heaterBatteryWatts: this.heaterBatteryWatts,
      totalHeaterDemandWatts: this.totalHeaterDemandWatts,
      thermalSafeModeTriggered: this.thermalSafeModeTriggered,
      provenance: '[COMPUTED]'
    };
  }
}
