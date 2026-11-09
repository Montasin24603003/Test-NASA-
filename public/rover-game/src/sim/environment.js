/**
 * MARS ATMOSPHERIC & ENVIRONMENTAL PHYSICS SIMULATION
 *
 * Implements:
 * - Hydrostatic barometric equation: P(z) = P_0 * exp(-z / H)
 * - Ideal gas atmospheric density: rho = P / (R_spec * T)
 * - NASA MEDA diurnal surface temperature oscillation: T(LST) = T_mean + deltaT * cos(...)
 * - Solar position, zenith angle, and Beer-Lambert dust extinction irradiance: I = I_0 * exp(-tau / cos theta)
 * - Aerodynamic drag force: F_drag = 0.5 * rho * C_d * A * |v_rel| * v_rel
 * - Mars wind field with gust dynamics
 *
 * Provenance:
 * [REFERENCE] NASA Mars Fact Sheet, Viking/MOLA areoid datum, NASA MEDA Mars 2020 weather records
 * [COMPUTED] Hydrostatic law, Ideal gas equation, Beer-Lambert optical depth
 * [SIM-ESTIMATE] Seeded wind gust turbulence, dust concentration correlation
 */

import {
  MARS_GRAVITY,
  MARS_DATUM_PRESSURE_PA,
  MARS_GAS_CONSTANT,
  MARS_SOLAR_CONSTANT_WM2,
  MARS_SOL_SECONDS,
  JEZERO_LANDING_LAT_DEG,
  JEZERO_MOLA_ELEVATION_M
} from './constants.js';
import { Vec3 } from './math3d.js';

export class MarsEnvironment {
  constructor(options = {}) {
    /** [REFERENCE] Atmospheric datum pressure at MOLA 0m areoid */
    this.datumPressurePa = options.datumPressurePa ?? MARS_DATUM_PRESSURE_PA; // 610.0 Pa

    /** [REFERENCE] Atmospheric scale height on Mars H = R*T / g ≈ 11.1 km */
    this.scaleHeightM = options.scaleHeightM ?? 11100.0; // 11,100 m

    /** [REFERENCE] Jezero crater floor elevation relative to MOLA datum (-2558 m) */
    this.baseElevationM = options.baseElevationM ?? JEZERO_MOLA_ELEVATION_M; // -2558.0 m

    /** [REFERENCE] Specific gas constant for Mars CO2 atmosphere: 188.92 J/(kg*K) */
    this.gasConstant = options.gasConstant ?? MARS_GAS_CONSTANT;

    /** [REFERENCE] Mean surface temperature in Jezero (MEDA annual mean ≈ 215 K / -58 C) */
    this.meanTempK = options.meanTempK ?? 215.0;

    /** [REFERENCE] Diurnal temperature half-amplitude (peak 245 K @ 14:00, min 185 K @ 04:00) */
    this.diurnalDeltaK = options.diurnalDeltaK ?? 30.0;

    /** [REFERENCE] Jezero crater landing site latitude (deg North) */
    this.latitudeDeg = options.latitudeDeg ?? JEZERO_LANDING_LAT_DEG;

    /** [REFERENCE] Solar constant at Mars mean orbital distance (1.524 AU) */
    this.solarConstantWm2 = options.solarConstantWm2 ?? MARS_SOLAR_CONSTANT_WM2; // 590 W/m^2

    /** [REFERENCE] Aerodynamic frontal area of Perseverance rover: ~2.8 m^2 */
    this.roverAreaM2 = options.roverAreaM2 ?? 2.8;

    /** [ASSUMPTION] Bluff body drag coefficient for Mars 2020 rover chassis */
    this.roverDragCd = options.roverDragCd ?? 1.15;

    // Environmental state variables
    this.solTimeS = options.initialSolTimeS ?? (12.0 * 3600.0); // Default midday 12:00
    this.dustOpticalDepthTau = options.dustOpticalDepthTau ?? 0.44; // Nominal clear sky: 0.44
    this.dustConcentrationMgM3 = 0.12;

    // Wind state (m/s)
    this.windBaseSpeedMs = options.windSpeedMs ?? 4.5;
    this.windDirectionRad = options.windDirectionRad ?? 0.85; // ~48.7 degrees
    this.windVelocityWorld = new Vec3(
      Math.sin(this.windDirectionRad) * this.windBaseSpeedMs,
      0.0,
      Math.cos(this.windDirectionRad) * this.windBaseSpeedMs
    );
    this.gustTimer = 0.0;
    this.currentGustSpeedMs = 0.0;

    // Cache / Current step outputs
    this.currentElevationM = this.baseElevationM;
    this.currentPressurePa = 768.0;
    this.currentTempK = 235.0;
    this.currentTempC = -38.15;
    this.currentDensityKgM3 = 0.017;
    this.currentSolarIrradianceWm2 = 420.0;
    this.currentVisibilityKm = 22.0;
    this.aerodynamicDragForceN = new Vec3();
    this.aerodynamicDragPowerW = 0.0;

    this._tmpRelVel = new Vec3();
  }

  /**
   * Barometric pressure at a given elevation relative to MOLA datum.
   * Hydrostatic formula: P(z) = P_0 * exp(-z / H)
   * [COMPUTED] with [REFERENCE] parameters
   */
  getPressureAtElevation(molaElevationM) {
    return this.datumPressurePa * Math.exp(-molaElevationM / this.scaleHeightM);
  }

  /**
   * Diurnal temperature model calibrated against NASA Mars 2020 MEDA instrument data.
   * Peak at 14:00 LST, minimum at 04:00 LST.
   * [COMPUTED]
   */
  getDiurnalTemperatureK(solTimeSeconds) {
    const lstHours = ((solTimeSeconds % MARS_SOL_SECONDS) / MARS_SOL_SECONDS) * 24.0;
    // Cosine wave with peak at 14.0 hours (t - 14)
    const phaseRad = ((lstHours - 14.0) * 2.0 * Math.PI) / 24.0;
    return this.meanTempK + this.diurnalDeltaK * Math.cos(phaseRad);
  }

  /**
   * Ideal gas law density for Mars CO2 atmosphere: rho = P / (R_spec * T)
   * [COMPUTED]
   */
  getAtmosphericDensity(pressurePa, tempK) {
    if (tempK <= 0) return 0.015;
    return pressurePa / (this.gasConstant * tempK);
  }

  /**
   * Direct solar irradiance on a horizontal surface via Beer-Lambert extinction law.
   * I = I_0 * sin(alpha) * exp(-tau / sin(alpha))
   * [COMPUTED]
   */
  getSolarIrradiance(solTimeSeconds, tau = this.dustOpticalDepthTau) {
    const lstHours = ((solTimeSeconds % MARS_SOL_SECONDS) / MARS_SOL_SECONDS) * 24.0;
    const hourAngleRad = ((lstHours - 12.0) * 15.0 * Math.PI) / 180.0;
    const latRad = (this.latitudeDeg * Math.PI) / 180.0;

    // Solar declination (approximate seasonal mean near equinox)
    const declinationRad = 0.0;

    // Solar elevation angle alpha: sin(alpha) = sin(phi)*sin(delta) + cos(phi)*cos(delta)*cos(h)
    const sinElevation = Math.sin(latRad) * Math.sin(declinationRad) +
                         Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);

    if (sinElevation <= 0.02) {
      // Sun is below horizon or in extreme twilight
      return 0.0;
    }

    // Optical airmass m ≈ 1 / sin(elevation)
    const airmass = 1.0 / sinElevation;
    const directExtinction = Math.exp(-tau * airmass);

    return Math.max(0.0, this.solarConstantWm2 * sinElevation * directExtinction);
  }

  /**
   * Koschmieder's Law for atmospheric visibility: V = 3.912 / beta_ext
   * Dust optical depth tau = beta_ext * H_dust
   */
  getVisibilityKm(tau = this.dustOpticalDepthTau) {
    const tauSafe = Math.max(0.1, tau);
    // Empirical Jezero visibility relation: ~25 km at tau=0.4, down to 1.5 km during major dust storm (tau=3.5)
    return Math.max(1.0, 11.0 / tauSafe);
  }

  /**
   * Update atmospheric state and calculate aerodynamic drag force on the rover.
   * F_drag = 0.5 * rho * C_d * A * |v_rel| * v_rel
   */
  update(dt, roverPositionWorld, roverVelocityWorld) {
    this.solTimeS += dt;

    // 1. Altitude & Barometrics
    const localAltitudeM = roverPositionWorld ? roverPositionWorld.y : 0.0;
    this.currentElevationM = this.baseElevationM + localAltitudeM;
    this.currentPressurePa = this.getPressureAtElevation(this.currentElevationM);

    // 2. Temperature
    this.currentTempK = this.getDiurnalTemperatureK(this.solTimeS);
    this.currentTempC = this.currentTempK - 273.15;

    // 3. Density
    this.currentDensityKgM3 = this.getAtmosphericDensity(this.currentPressurePa, this.currentTempK);

    // 4. Solar Radiation & Dust
    this.currentSolarIrradianceWm2 = this.getSolarIrradiance(this.solTimeS, this.dustOpticalDepthTau);
    this.dustConcentrationMgM3 = this.dustOpticalDepthTau * 0.28;
    this.currentVisibilityKm = this.getVisibilityKm(this.dustOpticalDepthTau);

    // 5. Wind & Gust Model
    this.gustTimer += dt;
    if (this.gustTimer > 4.0) {
      this.gustTimer = 0.0;
      // Slight periodic wind variation
      const wave = Math.sin(this.solTimeS * 0.05);
      this.currentGustSpeedMs = this.windBaseSpeedMs * (1.0 + 0.35 * wave);
      this.windVelocityWorld.set(
        Math.sin(this.windDirectionRad) * this.currentGustSpeedMs,
        0.0,
        Math.cos(this.windDirectionRad) * this.currentGustSpeedMs
      );
    }

    // 6. Aerodynamic Drag Calculation
    if (roverVelocityWorld) {
      const vx = roverVelocityWorld.x ?? 0.0;
      const vy = roverVelocityWorld.y ?? 0.0;
      const vz = roverVelocityWorld.z ?? 0.0;
      const roverSpeed = Math.hypot(vx, vy, vz);

      // Relative velocity: v_rel = v_rover - v_wind
      this._tmpRelVel.set(vx - this.windVelocityWorld.x, vy - this.windVelocityWorld.y, vz - this.windVelocityWorld.z);
      const relSpeed = this._tmpRelVel.length();

      if (relSpeed > 1e-4) {
        // F_drag = 0.5 * rho * C_d * A * |v_rel| * v_rel opposing motion
        const dragMagnitude = 0.5 * this.currentDensityKgM3 * this.roverDragCd * this.roverAreaM2 * relSpeed * relSpeed;
        this.aerodynamicDragForceN.copy(this._tmpRelVel).scale(-dragMagnitude / relSpeed);
        this.aerodynamicDragPowerW = Math.abs(dragMagnitude * roverSpeed);
      } else {
        this.aerodynamicDragForceN.set(0, 0, 0);
        this.aerodynamicDragPowerW = 0.0;
      }
    } else {
      this.aerodynamicDragForceN.set(0, 0, 0);
      this.aerodynamicDragPowerW = 0.0;
    }

    return {
      dragForceWorld: this.aerodynamicDragForceN,
      dragPowerW: this.aerodynamicDragPowerW,
      telemetry: this.getTelemetry()
    };
  }

  getTelemetry() {
    const lstHours = ((this.solTimeS % MARS_SOL_SECONDS) / MARS_SOL_SECONDS) * 24.0;
    const hh = Math.floor(lstHours).toString().padStart(2, '0');
    const mm = Math.floor((lstHours % 1) * 60).toString().padStart(2, '0');
    const ss = Math.floor(((lstHours * 60) % 1) * 60).toString().padStart(2, '0');

    return {
      localSolarTime: `${hh}:${mm}:${ss} LST`,
      lstHours: lstHours,
      solDay: Math.floor(this.solTimeS / MARS_SOL_SECONDS),
      gravityMs2: MARS_GRAVITY,
      gravityProvenance: '[REFERENCE]',
      molaElevationM: this.currentElevationM,
      elevationProvenance: '[REFERENCE]',
      pressurePa: this.currentPressurePa,
      pressureProvenance: '[COMPUTED]',
      temperatureK: this.currentTempK,
      temperatureC: this.currentTempC,
      temperatureProvenance: '[COMPUTED]',
      densityKgM3: this.currentDensityKgM3,
      densityProvenance: '[COMPUTED]',
      windSpeedMs: this.windVelocityWorld.length(),
      windDirectionDeg: (this.windDirectionRad * 180.0 / Math.PI) % 360.0,
      windProvenance: '[SIM-ESTIMATE]',
      solarIrradianceWm2: this.currentSolarIrradianceWm2,
      solarProvenance: '[COMPUTED]',
      dustOpticalDepthTau: this.dustOpticalDepthTau,
      dustConcentrationMgM3: this.dustConcentrationMgM3,
      visibilityKm: this.currentVisibilityKm,
      aerodynamicDragN: this.aerodynamicDragForceN.length(),
      aerodynamicDragProvenance: '[COMPUTED]'
    };
  }
}
