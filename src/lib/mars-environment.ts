/**
 * NASA Mars Environmental Physics & Climatology Engine
 * 
 * References:
 * - Mars Science Laboratory (MSL) RAD: Hassler et al. (2014) Science "Mars' Surface Radiation Environment"
 * - Mars Odyssey MARIE / GRS: Zeitlin et al. (2004) "Overview of the MARIE on Mars Odyssey"
 * - Mars Climate Database (MCD v5.3) & MGS Thermal Emission Spectrometer (TES) Dust Climatology: Montabone et al. (2015)
 * - MGS Radio Science / Mars PathFinder scale height: Zurek et al.
 * - Mars Odyssey THEMIS Thermal Inertia: Fergason et al. (2006)
 */

export interface MarsAtmosphericTelemetry {
  pressureMbar: number;
  columnDensityKgM2: number;
  temperatureKelvinDay: number;
  temperatureKelvinNight: number;
  temperatureCelsiusDay: number;
  temperatureCelsiusNight: number;
  diurnalDeltaK: number;
  dustOpticalDepthTau: number;
  dustSeason: 'Aphelion Clear Season' | 'Transitional Period' | 'Perihelion Storm Season' | 'Global Dust Storm Risk';
}

export interface MarsRadiationTelemetry {
  surfaceGcrDoseMsvYear: number;
  orbitalGcrDoseMsvYear: number;
  atmosphericShieldingMassPercent: number; // percentage of orbital dose mitigated by CO2 column
  crustalFieldDeflection: 'Negligible' | 'Weak' | 'Localized Regional Deflection';
  cumulativeDosePerSolMsv: number;
  humanCareerLimitRemainingPercent: number; // Based on NASA 600 mSv career limit
  solarParticleEventRisk: 'Nominal Solar Quiet' | 'Moderate Proton Flux' | 'High SPE Alert (Shelter Required)';
}

export interface MarsEnergyCommunicationTelemetry {
  solarInsolationWm2: number;
  photovoltaicYieldKwhM2Sol: number;
  dteDirectToEarthAvailable: boolean;
  dteElevationAngleDeg: number;
  relayPassesPerSol: number; // Typical MRO/Odyssey/TGO passes (2-4 per sol)
  relayWindowDurationMinutes: number;
  lightTravelTimeMinutes: number;
}

/**
 * Calculates atmospheric pressure using the standard Mars barometric scale-height equation:
 * P(z) = P0 * exp(-z / H), with P0 = 6.1 mbar at MOLA 0m datum and H = 11.1 km.
 * Modulated by the global 25% CO2 atmospheric mass breathing cycle as polar caps freeze/sublimate with Ls.
 */
export function getMarsAtmosphericPressure(elevationM: number, lsDeg = 75): { pressureMbar: number; columnDensityKgM2: number } {
  const scaleHeightM = 11100;
  // Polar CO2 seasonal cycle: atmospheric mass drops by ~25% during southern winter (Ls 90-180)
  const seasonalCycleFactor = 1.0 + 0.12 * Math.cos(((lsDeg - 250) * Math.PI) / 180);
  const p0 = 6.1 * seasonalCycleFactor;

  const pressureMbar = Number((p0 * Math.exp(-elevationM / scaleHeightM)).toFixed(2));
  // Column mass density: rho_column = P / g (Mars g = 3.72 m/s^2)
  // 1 mbar = 100 Pa -> (pressureMbar * 100) / 3.72 kg/m^2
  const columnDensityKgM2 = Number(((pressureMbar * 100) / 3.72).toFixed(1));

  return { pressureMbar, columnDensityKgM2 };
}

/**
 * Calculates atmospheric dust optical depth (tau at 9.3 um / visible equivalent)
 * based on aerocentric solar longitude (Ls) and latitude from MGS TES / MCD climatology.
 */
export function getMarsDustOpacity(lsDeg = 75, lat = 0): { tau: number; season: MarsAtmosphericTelemetry['dustSeason'] } {
  // Aphelion clear season (Ls 30° - 150°): Mars is furthest from Sun; cold, transparent atmosphere (tau ~ 0.2)
  // Perihelion dust storm season (Ls 180° - 330°): Maximum solar heating; dust storms initiate, especially in southern plains
  let baseTau = 0.22;
  let season: MarsAtmosphericTelemetry['dustSeason'] = 'Aphelion Clear Season';

  if (lsDeg >= 180 && lsDeg <= 330) {
    // Perihelion season
    const perihelionFrac = Math.sin(((lsDeg - 180) * Math.PI) / 150);
    baseTau = 0.55 + 0.65 * perihelionFrac;
    season = baseTau > 0.9 ? 'Global Dust Storm Risk' : 'Perihelion Storm Season';

    // Southern hemisphere basin enhancement (Hellas, Argyre)
    if (lat < -15) {
      baseTau += 0.25;
    }
  } else if (lsDeg > 150 && lsDeg < 180) {
    baseTau = 0.35;
    season = 'Transitional Period';
  } else {
    // Normal aphelion background
    baseTau = 0.18 + 0.08 * Math.cos((lat * Math.PI) / 180);
    season = 'Aphelion Clear Season';
  }

  return { tau: Number(baseTau.toFixed(2)), season };
}

/**
 * Calculates diurnal surface temperature envelope from THEMIS thermal inertia,
 * solar insolation, elevation, and latitude.
 */
export function getMarsDiurnalThermal(
  lat: number,
  elevationM: number,
  lsDeg = 75,
  thermalInertia = 240
): {
  dayK: number;
  nightK: number;
  dayC: number;
  nightC: number;
  deltaK: number;
} {
  // Mars solar declination: delta = 25.19° * sin(Ls)
  const declinationRad = ((25.19 * Math.sin((lsDeg * Math.PI) / 180)) * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const noonSolarZenithRad = Math.abs(latRad - declinationRad);
  const cosZenith = Math.max(0.1, Math.cos(noonSolarZenithRad));

  // High thermal inertia (bedrock/pure ice ~ 600-800 tiu) dampens diurnal swing.
  // Low thermal inertia (fine dust ~ 60-120 tiu) heats rapidly during day and drops to severe cold at night.
  const inertiaFactor = Math.sqrt(Math.max(80, thermalInertia) / 250);

  // Elevation lapse rate: ~ -2.5 K/km
  const elevationOffset = -(elevationM / 1000) * 2.2;

  const baseDayK = 210 + cosZenith * 60 + elevationOffset;
  const baseNightK = 180 - (1 - cosZenith) * 30 - 25 / inertiaFactor + elevationOffset * 0.5;

  const dayK = Math.max(145, Math.min(295, Math.round(baseDayK)));
  const nightK = Math.max(130, Math.min(240, Math.round(baseNightK)));
  const deltaK = dayK - nightK;

  return {
    dayK,
    nightK,
    dayC: Math.round(dayK - 273.15),
    nightC: Math.round(nightK - 273.15),
    deltaK,
  };
}

/**
 * Calculates surface radiation dose rates based on MSL RAD surface measurements
 * and Odyssey MARIE orbital reference.
 */
export function getMarsRadiationDose(
  elevationM: number,
  crustalFieldStrengthNt = 25
): MarsRadiationTelemetry {
  const orbitalGcrDoseMsvYear = 295; // MARIE / MSL cruise baseline ~ 0.81 mSv/day

  // Atmospheric shielding attenuation:
  // MSL RAD measured 0.67 mSv/day (245 mSv/yr) at Gale Crater (-4,500m datum).
  // On high plateaus (Tharsis, Olympus Mons +21 km), atmosphere is negligible (< 1 mbar),
  // dose approaches the unshielded orbital rate ~300 mSv/yr.
  // In deep basins (Hellas -7 km, ~11 mbar), dose drops to ~210 mSv/yr.
  const scaleHeightM = 11100;
  const relativeAtmosphereFraction = Math.exp(-elevationM / scaleHeightM);
  const maxAtmosphericReduction = 85; // mSv/year mitigated at datum
  const actualMitigation = maxAtmosphericReduction * Math.min(1.4, relativeAtmosphereFraction);

  // Crustal magnetic anomaly deflection (MGS MAG/ER / MAVEN):
  // Intense magnetic fields in Terra Cimmeria / Sirenum (>200 nT) deflect low-energy charged ions slightly
  let magneticDeflectionMsv = 0;
  let crustalFieldDeflection: MarsRadiationTelemetry['crustalFieldDeflection'] = 'Negligible';
  if (crustalFieldStrengthNt > 150) {
    magneticDeflectionMsv = 12;
    crustalFieldDeflection = 'Localized Regional Deflection';
  } else if (crustalFieldStrengthNt > 60) {
    magneticDeflectionMsv = 5;
    crustalFieldDeflection = 'Weak';
  }

  const surfaceGcrDoseMsvYear = Math.max(195, Math.round(orbitalGcrDoseMsvYear - actualMitigation - magneticDeflectionMsv));
  const shieldingPercent = Math.round(((orbitalGcrDoseMsvYear - surfaceGcrDoseMsvYear) / orbitalGcrDoseMsvYear) * 100);
  const cumulativeDosePerSolMsv = Number((surfaceGcrDoseMsvYear / 355.2).toFixed(3)); // Mars year ~ 668 sols ~ 687 earth days

  // NASA astronaut career limit is 600 mSv (standard 3% excess risk of lifetime fatal cancer)
  const sol180MissionDoseMsv = cumulativeDosePerSolMsv * 180;
  const humanCareerLimitRemainingPercent = Math.max(0, Math.round((1 - sol180MissionDoseMsv / 600) * 100));

  return {
    surfaceGcrDoseMsvYear,
    orbitalGcrDoseMsvYear,
    atmosphericShieldingMassPercent: shieldingPercent,
    crustalFieldDeflection,
    cumulativeDosePerSolMsv,
    humanCareerLimitRemainingPercent,
    solarParticleEventRisk: 'Nominal Solar Quiet',
  };
}

/**
 * Calculates solar energy insolation and orbital communication geometry.
 */
export function getMarsEnergyAndComms(
  lat: number,
  elevationM: number,
  lsDeg = 75,
  tau = 0.3
): MarsEnergyCommunicationTelemetry {
  // Mars orbital distance in AU: r = a * (1 - e^2) / (1 + e * cos(Ls - 248°))
  const a = 1.523662;
  const e = 0.093412;
  const trueAnomalyRad = ((lsDeg - 248) * Math.PI) / 180;
  const rAu = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomalyRad));

  // Top of Mars atmosphere solar flux (W/m2): S = 1361 / r^2
  const s0 = 1361 / (rAu * rAu); // ~ 490 to 715 W/m2

  // Solar declination & noon zenith
  const declinationRad = ((25.19 * Math.sin((lsDeg * Math.PI) / 180)) * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const noonZenithRad = Math.abs(latRad - declinationRad);
  const cosZenith = Math.max(0.05, Math.cos(noonZenithRad));

  // Atmospheric extinction via Beer-Lambert: I = S0 * cos(theta) * exp(-tau / cos(theta))
  const airmass = 1 / cosZenith;
  const directInsolation = s0 * cosZenith * Math.exp(-tau * Math.min(airmass, 4.0));
  // Diffuse sky radiation adds back ~15% of scattered flux
  const diffuseInsolation = s0 * cosZenith * (1 - Math.exp(-tau * 0.7)) * 0.22;
  const solarInsolationWm2 = Math.max(10, Math.round(directInsolation + diffuseInsolation));

  // Daily PV yield: ~ 8.5 equivalent full-sun hours in Mars sol (24.65h)
  // Assuming 28% triple-junction GaAs space solar cells
  const pvEfficiency = 0.28;
  const photovoltaicYieldKwhM2Sol = Number(((solarInsolationWm2 * 8.2 * pvEfficiency) / 1000).toFixed(2));

  // Communication geometry:
  // Light travel time from Earth (minimum ~3.1 min at closest opposition, up to ~22.2 min at superior conjunction)
  const approxEarthDistAu = Math.sqrt(1.0 + rAu * rAu - 2 * rAu * Math.cos((lsDeg * Math.PI) / 180));
  const lightTravelTimeMinutes = Number(((approxEarthDistAu * 149597870.7) / (299792.458 * 60)).toFixed(1));

  // Relay orbiter window (MRO, 2001 Mars Odyssey, Trace Gas Orbiter)
  // Deep canyons and high crater walls degrade relay window duration
  const horizonDegraded = elevationM < -3500 && Math.abs(lat) < 20;
  const relayPassesPerSol = horizonDegraded ? 2 : 3;
  const relayWindowDurationMinutes = horizonDegraded ? 8 : 14;

  return {
    solarInsolationWm2,
    photovoltaicYieldKwhM2Sol,
    dteDirectToEarthAvailable: true,
    dteElevationAngleDeg: Math.round(55 - Math.abs(lat) * 0.4),
    relayPassesPerSol,
    relayWindowDurationMinutes,
    lightTravelTimeMinutes,
  };
}
