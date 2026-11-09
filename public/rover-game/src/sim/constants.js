/**
 * NASA MARS 2020 PERSEVERANCE SIMULATION CONSTANTS & SCIENTIFIC CITATIONS
 *
 * All physical quantities are strictly in SI units:
 * Distance: meters (m)
 * Mass: kilograms (kg)
 * Time: seconds (s)
 * Force: Newtons (N)
 * Torque: Newton-meters (N*m)
 * Power: Watts (W)
 * Energy: Joules (J)
 * Temperature: Kelvin (K) or Celsius (deg C) as labeled
 * Pressure: Pascals (Pa)
 * Angle: radians (rad) internally, degrees (deg) in display
 *
 * PROVENANCE TAGS:
 * [REFERENCE] = Documented NASA / JPL Mars 2020 specification or planetary science constant.
 * [ASSUMPTION] = Engineering estimate or numerical approximation, calibrated to physical laws.
 */

// ============================================================================
// 1. MARS PLANETARY & ATMOSPHERIC CONSTANTS
// ============================================================================

/** [REFERENCE] Mean surface gravitational acceleration on Mars (NASA Mars Fact Sheet) */
export const MARS_GRAVITY = 3.71; // m/s^2

/** [REFERENCE] Mean Martian datum barometric pressure at MOLA 0 m areoid (Viking/MGS MOLA) */
export const MARS_DATUM_PRESSURE_PA = 610.0; // Pa

/** [REFERENCE] Specific gas constant for Mars atmosphere (95.32% CO2, 2.6% N2, 1.9% Ar, R = R_u / M) */
export const MARS_GAS_CONSTANT = 188.92; // J/(kg*K)

/** [REFERENCE] Ratio of specific heats for CO2-dominant atmosphere at Martian temperatures */
export const MARS_GAMMA = 1.30; // Dimensionless

/** [REFERENCE] Duration of one Martian solar day (1 Sol = 24h 39m 35.244s) */
export const MARS_SOL_SECONDS = 88775.244; // seconds

/** [REFERENCE] Mean Martian volumetric radius (IAU 2000 / NASA Mars Fact Sheet) */
export const MARS_VOLUMETRIC_RADIUS_M = 3389500.0; // meters

/** [REFERENCE] Mean top-of-atmosphere solar irradiance at Mars perihelion/aphelion mean (1.524 AU) */
export const MARS_SOLAR_CONSTANT_WM2 = 590.0; // W/m^2

/** [REFERENCE] Jezero Crater landing site nominal planetocentric coordinates (Octavia E. Butler Landing) */
export const JEZERO_LANDING_LAT_DEG = 18.3848; // deg North
export const JEZERO_LANDING_LON_DEG = 77.5802; // deg East
export const JEZERO_MOLA_ELEVATION_M = -2558.0; // meters relative to MOLA datum

// ============================================================================
// 2. ROVER DIMENSIONAL & MASS PROPERTIES (NASA Mars 2020 Perseverance)
// ============================================================================

/** [REFERENCE] Rover total landed mass including robotic arm and MMRTG (NASA Mars 2020 Press Kit) */
export const ROVER_MASS_KG = 1025.0; // kg

/** [REFERENCE] Wheel outer diameter (NASA Mars 2020 Spec: 52.5 cm machined aluminum) */
export const WHEEL_DIAMETER_M = 0.525; // meters
export const WHEEL_RADIUS_M = WHEEL_DIAMETER_M / 2.0; // 0.2625 meters

/** [REFERENCE] Wheel tread width (NASA Mars 2020 Spec: 40 cm width with 48 chevron grousers) */
export const WHEEL_WIDTH_M = 0.40; // meters

/** [REFERENCE] Rover wheel track width (NASA Mars 2020 Technical Drawing) */
export const TRACK_WIDTH_CORNER_M = 2.08; // meters (FL to FR, RL to RR centerline)
export const TRACK_WIDTH_MID_M = 2.20;    // meters (ML to MR centerline, slight outward offset)

/** [REFERENCE] Total longitudinal wheelbase front to rear axles */
export const WHEELBASE_TOTAL_M = 2.26; // meters

/**
 * [ASSUMPTION] Principal Moments of Inertia in chassis coordinate frame (x=right, y=up, z=backward).
 * Derived from 1025 kg mass distributed in 3.0 m x 2.7 m x 2.2 m bounding box with heavy low belly:
 * I_xx (pitch) = 560.0 kg*m^2
 * I_yy (yaw)   = 890.0 kg*m^2
 * I_zz (roll)  = 480.0 kg*m^2
 */
export const BODY_INERTIA_DIAG_KG_M2 = Object.freeze([560.0, 890.0, 480.0]);

/**
 * [ASSUMPTION] Reflected wheel rotational inertia including rim, grousers, and harmonic gear rotor.
 * J_w = 1.85 kg*m^2 per wheel hub actuator.
 */
export const WHEEL_INERTIA_KG_M2 = 1.85; // kg*m^2

/**
 * [ASSUMPTION] Nominal Center of Gravity (CG) location in local chassis body frame.
 * (0.0 m lateral, -0.04 m low belly bias, +0.03 m longitudinal bias towards rear MMRTG).
 */
export const COG_LOCAL_M = Object.freeze([0.0, -0.04, 0.03]);

/**
 * [REFERENCE] Individual wheel nominal mounting locations in chassis frame [x, y, z]:
 * Axle layout: Front z=-1.02 m, Mid z=+0.06 m, Rear z=+1.04 m
 */
export const WHEEL_CONFIGS = Object.freeze([
  { id: 0, name: 'FL', axle: 'front', x: -1.04, y: 0.06, z: -1.02, side: 'L', canSteer: true },
  { id: 1, name: 'FR', axle: 'front', x:  1.04, y: 0.06, z: -1.02, side: 'R', canSteer: true },
  { id: 2, name: 'ML', axle: 'mid',   x: -1.10, y: 0.06, z:  0.06, side: 'L', canSteer: false },
  { id: 3, name: 'MR', axle: 'mid',   x:  1.10, y: 0.06, z:  0.06, side: 'R', canSteer: false },
  { id: 4, name: 'RL', axle: 'rear',  x: -1.04, y: 0.06, z:  1.04, side: 'L', canSteer: true },
  { id: 5, name: 'RR', axle: 'rear',  x:  1.04, y: 0.06, z:  1.04, side: 'R', canSteer: true }
]);

// ============================================================================
// 3. SUSPENSION & ROCKER-BOGIE PARAMETERS
// ============================================================================

/** [ASSUMPTION] Uncompressed strut rest length from body pivot to wheel spindle */
export const SUSPENSION_REST_LENGTH_M = 0.54; // meters

/** [ASSUMPTION] Maximum allowable suspension compression from rest before solid bump-stop */
export const SUSPENSION_MAX_COMPRESSION_M = 0.34; // meters

/** [ASSUMPTION] Maximum allowable suspension droop from rest before mechanical link stop */
export const SUSPENSION_MAX_DROOP_M = 0.20; // meters

/**
 * [ASSUMPTION] Effective vertical suspension stiffness per wheel.
 * Calibrated so nominal static load on Mars (1025 kg * 3.71 / 6 ≈ 633.8 N) produces ~0.11 m deflection:
 * k = 633.8 N / 0.113 m ≈ 5600 N/m.
 */
export const SUSPENSION_SPRING_K = 5600.0; // N/m

/**
 * [ASSUMPTION] Effective suspension damping coefficient.
 * Damping ratio zeta = c / (2 * sqrt(m_unsprung * k)) ≈ 0.70 (near critical damping):
 * c ≈ 1520 N*s/m.
 */
export const SUSPENSION_DAMPER_C = 1520.0; // N*s/m

// ============================================================================
// 4. POWER & ELECTRICAL ARCHITECTURE (MMRTG + DUAL LI-ION BATTERIES)
// ============================================================================

/** [REFERENCE] Nominal electrical power output of MMRTG at mission start (NASA Mars 2020 Fact Sheet) */
export const MMRTG_NOMINAL_WATTS = 110.0; // Watts continuous

/** [REFERENCE] Annual decay rate of MMRTG output due to Pu-238 alpha decay (t_1/2 = 87.7 yrs) and thermocouple aging */
export const MMRTG_DECAY_FRACTION_PER_YEAR = 0.016; // ~1.6% per Earth year

/** [REFERENCE] Nominal battery bus voltage (8-cell series lithium-ion chemistry) */
export const BATTERY_NOMINAL_VOLTS = 32.0; // Volts
export const BATTERY_MIN_SAFE_VOLTS = 26.0; // Cutoff voltage
export const BATTERY_MAX_CHARGE_VOLTS = 33.6; // Full charge

/** [REFERENCE] Usable total energy capacity of the dual Li-ion battery pack (2 x 43 Ah @ ~28-32 V) */
export const BATTERY_CAPACITY_WH = 2400.0; // Watt-hours (8.64 MJ)
export const BATTERY_CAPACITY_JOULES = BATTERY_CAPACITY_WH * 3600.0; // 8,640,000 Joules

/** [ASSUMPTION] Internal resistance of battery pack */
export const BATTERY_INTERNAL_RESISTANCE_OHM = 0.045; // Ohms

/** [ASSUMPTION] Converter & power distribution unit (PDU) efficiency */
export const POWER_CONVERTER_EFFICIENCY = 0.94; // 94%

/** [ASSUMPTION] Drive actuator motor electromechanical conversion efficiency */
export const MOTOR_EFFICIENCY = 0.88; // 88%

/** [ASSUMPTION] Motor winding phase resistance per actuator */
export const MOTOR_WINDING_RESISTANCE_OHM = 0.32; // Ohms

/** [REFERENCE] Standby electrical draw of the Rover Compute Element (RCE) avionics */
export const AVIONICS_BASELINE_WATTS = 45.0; // Watts

/** [ASSUMPTION] Telemetry radio transmitter load (UHF / X-band active transmission) */
export const COMMS_ACTIVE_WATTS = 35.0; // Watts

/** [ASSUMPTION] Maximum continuous electrical draw of survival heaters in the Warm Electronics Box */
export const HEATER_MAX_WATTS = 120.0; // Watts

// ============================================================================
// 5. MOBILITY & TIME SCALE SPECIFICATIONS
// ============================================================================

/** [REFERENCE] Nominal maximum traverse speed of Perseverance on hard flat terrain */
export const REAL_PERSEVERANCE_TOP_SPEED_MS = 0.042; // ~4.2 cm/s (0.15 km/h)

/** [ASSUMPTION] High-speed gameplay mobility gear maximum target speed (OPTIONAL - Default OFF) */
export const GAMEPLAY_MOBILITY_GEAR_TOP_SPEED_MS = 5.4; // m/s (19.4 km/h)

/** [REFERENCE] Available Time Acceleration multipliers achieved via physics sub-stepping */
export const TIME_ACCELERATION_PRESETS = Object.freeze([1, 2, 5, 10, 25]);

/** [ASSUMPTION] Default physics simulation step frequency (120 Hz = 8.333 ms timestep) */
export const DEFAULT_PHYSICS_HZ = 120;
export const DEFAULT_PHYSICS_DT = 1.0 / DEFAULT_PHYSICS_HZ; // 0.0083333 s

/** [ASSUMPTION] Maximum allowed physics steps per rendering frame to prevent spiral of death */
export const MAX_SUBSTEPS_PER_FRAME = 15;
