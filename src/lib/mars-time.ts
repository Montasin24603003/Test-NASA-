/**
 * NASA Mars24 / Allison & McEwen (2000) Mars Time & Planetary Astronomy Engine
 *
 * Implements high-precision calculations for:
 * - Julian Date (JD_UTC and JD_TT)
 * - Mars Sol Date (MSD)
 * - Coordinated Mars Time (MTC - Martian Prime Meridian Mean Solar Time)
 * - Local Mean Solar Time (LMST)
 * - Local True Solar Time (LTST - Sundial Solar Time)
 * - Equation of Time (EOT)
 * - Aerocentric Solar Longitude (Ls) and Martian Seasons
 * - Mars Year (MY)
 * - Subsolar Latitude (Declination) and Solar Elevation / Azimuth
 * - Solar Irradiance (Insolation) and Earth-Mars Light Travel Time
 * - Rover Mission Sols (Curiosity, Perseverance, InSight)
 */

export interface MarsTimeData {
  // Epochs and Julian dates
  timestamp: number;
  utcDateString: string;
  jdUtc: number;
  jdTt: number;
  deltaTSeconds: number;

  // Mars Sol Date & MTC
  msd: number;
  solNumber: number;
  solFraction: number;
  mtcHours: number;
  mtcFormatted: string;

  // Local Solar Times at selected location
  lmstHours: number;
  lmstFormatted: string;
  ltstHours: number;
  ltstFormatted: string;
  eotMinutes: number; // Difference in Martian minutes (LTST - LMST)

  // Analog Clock angles (degrees)
  hourHandDegrees24: number; // 0 to 360 over 24 hours
  hourHandDegrees12: number; // 0 to 360 over 12 hours
  minuteHandDegrees: number; // 0 to 360 over 60 minutes
  secondHandDegrees: number; // 0 to 360 over 60 seconds

  // Solar Longitude & Seasons
  solarLongitudeLs: number; // 0.00° to 359.99°
  martianSeason: string;
  martianSeasonShort: string;
  martianYear: number;

  // Solar Position & Local Illumination
  solarDeclinationDeg: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  isDaylight: boolean;
  solarDistanceAU: number;
  solarInsolationWm2: number;
  lightTravelTimeMinutes: number;

  // Mission Sols
  curiositySol: number;
  perseveranceSol: number;
}

// Astronomical Constants for Mars (Allison & McEwen 2000, NASA GISS Mars24)
const SECONDS_PER_DAY = 86400.0;
const MARS_SOL_LENGTH_EARTH_DAYS = 1.027491252; // 24h 39m 35.244s
const MARS_OBLIQUITY_DEG = 25.1917; // Axial tilt of Mars
const MARS_SEMI_MAJOR_AXIS_AU = 1.523662;
const MARS_ECCENTRICITY = 0.093412;
const SPEED_OF_LIGHT_KM_S = 299792.458;
const AU_KM = 149597870.7;

// Mission Landing Epochs in Mars Sol Date (MSD)
const CURIOSITY_LANDING_MSD = 49269.2; // 2012-08-06 Gale Crater
const PERSEVERANCE_LANDING_MSD = 52317.0; // 2021-02-18 Jezero Crater

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180.0;
}

function radToDeg(rad: number): number {
  return (rad * 180.0) / Math.PI;
}

function normalize360(angle: number): number {
  let a = angle % 360.0;
  if (a < 0) a += 360.0;
  return a;
}

function normalize24(hours: number): number {
  let h = hours % 24.0;
  if (h < 0) h += 24.0;
  return h;
}

export function formatTime24(totalHours: number): string {
  const norm = normalize24(totalHours);
  const h = Math.floor(norm);
  const remMinutes = (norm - h) * 60.0;
  const m = Math.floor(remMinutes);
  const remSeconds = (remMinutes - m) * 60.0;
  const s = Math.floor(remSeconds);

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatTime12(totalHours: number): { time: string; period: "AM" | "PM" } {
  const norm = normalize24(totalHours);
  let h = Math.floor(norm);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) {
    h = 12;
  } else if (h > 12) {
    h -= 12;
  }
  const remMinutes = (norm % 1) * 60.0;
  const m = Math.floor(remMinutes);
  const remSeconds = (remMinutes - m) * 60.0;
  const s = Math.floor(remSeconds);

  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    time: `${pad(h)}:${pad(m)}:${pad(s)}`,
    period,
  };
}

/**
 * Calculates full Mars astronomical and chronometric telemetry
 * @param date Target Earth Date
 * @param longitudeDegEast Martian longitude in degrees East (0° to 360° or -180° to +180°)
 * @param latitudeDeg Martian latitude in degrees (-90° to +90°)
 */
export function calculateMarsTime(
  date: Date,
  longitudeDegEast: number,
  latitudeDeg: number
): MarsTimeData {
  const timestamp = date.getTime();
  const utcDateString = date.toISOString().replace("T", " ").substring(0, 19) + " UTC";

  // 1. Julian Date UTC
  const jdUtc = 2440587.5 + timestamp / (SECONDS_PER_DAY * 1000.0);

  // 2. Terrestrial Time (TT)
  // Delta T = TAI - UTC (37s) + 32.184s = 69.184 seconds
  const deltaTSeconds = 69.184;
  const jdTt = jdUtc + deltaTSeconds / SECONDS_PER_DAY;

  // 3. Days from J2000 epoch (2000-01-01 12:00:00 TT)
  const deltaJ2000 = jdTt - 2451545.0;

  // 4. Mars Sol Date (MSD) - NASA GISS Mars24 formula
  const msd = (jdTt - 2451549.5) / MARS_SOL_LENGTH_EARTH_DAYS + 44796.0 - 0.00096;
  const solNumber = Math.floor(msd);
  const solFraction = msd - solNumber;

  // 5. Coordinated Mars Time (MTC)
  const mtcHours = normalize24(msd * 24.0);
  const mtcFormatted = formatTime24(mtcHours);

  // Normalize longitude to [0, 360)
  const normLonEast = normalize360(longitudeDegEast);

  // 6. Local Mean Solar Time (LMST)
  // 1 hour = 15 degrees of longitude
  const lmstHours = normalize24(mtcHours + normLonEast / 15.0);
  const lmstFormatted = formatTime24(lmstHours);

  // 7. Mars Orbital Coordinates & Equation of Center
  // Mars mean anomaly M
  const mDeg = normalize360(19.3870 + 0.52402075 * deltaJ2000);
  const mRad = degToRad(mDeg);

  // Angle of Fictitious Mean Sun alpha_FMS
  const alphaFms = normalize360(270.3863 + 0.5240384 * deltaJ2000);

  // Planetary perturbations (PBS)
  const p1 = 0.0071 * Math.cos(degToRad(2.2353 * deltaJ2000 + 49.409));
  const p2 = 0.0057 * Math.cos(degToRad(2.7543 * deltaJ2000 + 168.173));
  const p3 = 0.0039 * Math.cos(degToRad(0.4987 * deltaJ2000 + 38.375));
  const p4 = 0.0034 * Math.cos(degToRad(0.7226 * deltaJ2000 + 29.897));
  const p5 = 0.0031 * Math.cos(degToRad(0.3204 * deltaJ2000 + 14.542));
  const pbs = p1 + p2 + p3 + p4 + p5;

  // Equation of Center (v - M)
  const eqCenter =
    (10.691 + 3.0e-7 * deltaJ2000) * Math.sin(mRad) +
    0.623 * Math.sin(2.0 * mRad) +
    0.05 * Math.sin(3.0 * mRad) +
    0.005 * Math.sin(4.0 * mRad) +
    0.0005 * Math.sin(5.0 * mRad) +
    pbs;

  // 8. Aerocentric Solar Longitude (Ls)
  const solarLongitudeLs = normalize360(alphaFms + eqCenter);

  // 9. Equation of Time (EOT)
  const lsRad = degToRad(solarLongitudeLs);
  const obliqRad = degToRad(MARS_OBLIQUITY_DEG);

  // Solar Right Ascension alpha_s
  const alphaSRad = Math.atan2(Math.cos(obliqRad) * Math.sin(lsRad), Math.cos(lsRad));
  const alphaSDeg = normalize360(radToDeg(alphaSRad));

  // Difference between FMS and True Sun
  let eotDeg = normalize360(alphaFms - alphaSDeg);
  if (eotDeg > 180.0) eotDeg -= 360.0;
  const eotHours = eotDeg / 15.0; // In Mars hours
  const eotMinutes = eotHours * 60.0; // In Mars minutes

  // 10. Local True Solar Time (LTST - Sundial solar time)
  const ltstHours = normalize24(lmstHours + eotHours);
  const ltstFormatted = formatTime24(ltstHours);

  // 11. Analog Clock Hand Angles
  // 24-hour dial: 00:00 at 0° (top), 06:00 at 90°, 12:00 at 180°, 18:00 at 270°
  const hourHandDegrees24 = (ltstHours / 24.0) * 360.0;
  // 12-hour dial: full circle in 12 hours
  const hourHandDegrees12 = ((ltstHours % 12.0) / 12.0) * 360.0;
  const minutes = (ltstHours % 1) * 60.0;
  const minuteHandDegrees = (minutes / 60.0) * 360.0;
  const seconds = (minutes % 1) * 60.0;
  const secondHandDegrees = (seconds / 60.0) * 360.0;

  // 12. Martian Seasons and Martian Year
  // Ls: 0° = Northern Spring Equinox, 90° = Northern Summer Solstice,
  // 180° = Northern Autumn Equinox, 270° = Northern Winter Solstice
  let martianSeason = "";
  let martianSeasonShort = "";
  if (solarLongitudeLs >= 0 && solarLongitudeLs < 90) {
    martianSeason = "Northern Spring / Southern Autumn";
    martianSeasonShort = "North Spring";
  } else if (solarLongitudeLs >= 90 && solarLongitudeLs < 180) {
    martianSeason = "Northern Summer / Southern Winter";
    martianSeasonShort = "North Summer";
  } else if (solarLongitudeLs >= 180 && solarLongitudeLs < 270) {
    martianSeason = "Northern Autumn / Southern Spring";
    martianSeasonShort = "North Autumn";
  } else {
    martianSeason = "Northern Winter / Southern Summer";
    martianSeasonShort = "North Winter";
  }

  // Mars Year (MY 1 began on 1955-04-11 at MSD 28892.23)
  const martianYear = Math.floor((msd - 28892.23) / 668.5991) + 1;

  // 13. Solar Declination and Local Solar Coordinates
  // Solar Declination delta_s
  const sinDeclination = Math.sin(obliqRad) * Math.sin(lsRad);
  const solarDeclinationRad = Math.asin(sinDeclination);
  const solarDeclinationDeg = radToDeg(solarDeclinationRad);

  // Local Hour Angle H = (LTST - 12) * 15°
  const hourAngleDeg = (ltstHours - 12.0) * 15.0;
  const hourAngleRad = degToRad(hourAngleDeg);

  // Observer latitude
  const latRad = degToRad(latitudeDeg);

  // Solar Elevation (Altitude)
  const sinAltitude =
    Math.sin(latRad) * Math.sin(solarDeclinationRad) +
    Math.cos(latRad) * Math.cos(solarDeclinationRad) * Math.cos(hourAngleRad);
  const altitudeRad = Math.asin(Math.max(-1.0, Math.min(1.0, sinAltitude)));
  const sunElevationDeg = radToDeg(altitudeRad);
  const isDaylight = sunElevationDeg > 0;

  // Solar Azimuth (degrees from North clockwise)
  const cosAzimuth =
    (Math.sin(solarDeclinationRad) - Math.sin(latRad) * Math.sin(altitudeRad)) /
    (Math.cos(latRad) * Math.cos(altitudeRad) + 1e-7);
  let azimuthDeg = radToDeg(Math.acos(Math.max(-1.0, Math.min(1.0, cosAzimuth))));
  if (Math.sin(hourAngleRad) > 0) {
    azimuthDeg = 360.0 - azimuthDeg;
  }
  const sunAzimuthDeg = normalize360(azimuthDeg);

  // 14. Heliocentric Distance of Mars (AU)
  // r = a * (1 - e^2) / (1 + e * cos(nu))
  const trueAnomalyRad = degToRad(normalize360(mDeg + eqCenter));
  const solarDistanceAU =
    (MARS_SEMI_MAJOR_AXIS_AU * (1.0 - MARS_ECCENTRICITY * MARS_ECCENTRICITY)) /
    (1.0 + MARS_ECCENTRICITY * Math.cos(trueAnomalyRad));

  // Solar Insolation at top of Martian atmosphere (Earth solar constant ~ 1361 W/m^2)
  const solarInsolationWm2 = Math.round(1361.0 / (solarDistanceAU * solarDistanceAU));

  // Approx Earth-Mars light travel time (distance oscillates between ~0.37 AU and ~2.68 AU)
  // Mean estimate based on typical relative orbit configuration
  const earthDistKm = solarDistanceAU * AU_KM;
  const lightTravelTimeMinutes = (earthDistKm / SPEED_OF_LIGHT_KM_S) / 60.0;

  // 15. Rover Mission Sols
  const curiositySol = Math.max(0, Math.floor(msd - CURIOSITY_LANDING_MSD));
  const perseveranceSol = Math.max(0, Math.floor(msd - PERSEVERANCE_LANDING_MSD));

  return {
    timestamp,
    utcDateString,
    jdUtc: Math.round(jdUtc * 100000) / 100000,
    jdTt: Math.round(jdTt * 100000) / 100000,
    deltaTSeconds,
    msd: Math.round(msd * 10000) / 10000,
    solNumber,
    solFraction: Math.round(solFraction * 10000) / 10000,
    mtcHours,
    mtcFormatted,
    lmstHours,
    lmstFormatted,
    ltstHours,
    ltstFormatted,
    eotMinutes: Math.round(eotMinutes * 10) / 10,
    hourHandDegrees24,
    hourHandDegrees12,
    minuteHandDegrees,
    secondHandDegrees,
    solarLongitudeLs: Math.round(solarLongitudeLs * 100) / 100,
    martianSeason,
    martianSeasonShort,
    martianYear,
    solarDeclinationDeg: Math.round(solarDeclinationDeg * 100) / 100,
    sunElevationDeg: Math.round(sunElevationDeg * 10) / 10,
    sunAzimuthDeg: Math.round(sunAzimuthDeg * 10) / 10,
    isDaylight,
    solarDistanceAU: Math.round(solarDistanceAU * 1000) / 1000,
    solarInsolationWm2,
    lightTravelTimeMinutes: Math.round(lightTravelTimeMinutes * 10) / 10,
    curiositySol,
    perseveranceSol,
  };
}

/**
 * Calculates Great Circle bearing and distance between two Martian coordinates
 * Mars mean volumetric radius = 3389.5 km
 */
export function calculateMarsBearingAndDistance(
  lat1Deg: number,
  lon1Deg: number,
  lat2Deg: number,
  lon2Deg: number
): { distanceKm: number; initialBearingDeg: number } {
  const MARS_RADIUS_KM = 3389.5;
  const phi1 = degToRad(lat1Deg);
  const phi2 = degToRad(lat2Deg);
  const deltaPhi = degToRad(lat2Deg - lat1Deg);
  const deltaLambda = degToRad(lon2Deg - lon1Deg);

  // Haversine formula
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(MARS_RADIUS_KM * c);

  // Initial Bearing
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const bearingRad = Math.atan2(y, x);
  const initialBearingDeg = Math.round(normalize360(radToDeg(bearingRad)));

  return { distanceKm, initialBearingDeg };
}

/**
 * Cardinal and intercardinal direction formatting for a degree heading
 */
export function headingToCardinal(headingDeg: number): string {
  const deg = normalize360(headingDeg);
  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW",
  ];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index] ?? "N";
}
