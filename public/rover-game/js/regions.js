import * as THREE from 'three';

/**
 * Fast, deterministic 2D hash & gradient/value noise for seamless chunked open-world terrain
 */
function hash2(ix, iz, seed = 42) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function noise2D(x, z, seed = 42) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  // Quintic smoothstep for smooth analytical normals (no facet grid artifacts!)
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);

  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2.0 - 1.0;
}

export function fbm2D(x, z, octaves = 4, lacunarity = 2.05, gain = 0.5, seed = 42) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2D(x * freq, z * freq, seed + i * 31);
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
}

export function ridged2D(x, z, octaves = 4, seed = 101) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let weight = 1.0;
  for (let i = 0; i < octaves; i++) {
    let n = 1.0 - Math.abs(noise2D(x * freq, z * freq, seed + i * 17));
    n = n * n * weight;
    weight = Math.max(0.0, Math.min(1.0, n * 1.8));
    sum += n * amp;
    freq *= 2.12;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Impact crater cavity + raised ejecta rim profile
 */
function craterProfile(x, z, cx, cz, radius, depth, rimHeight) {
  const dx = x - cx;
  const dz = z - cz;
  const r2 = dx * dx + dz * dz;
  const maxR = radius * 1.65;
  if (r2 > maxR * maxR) return 0;

  const r = Math.sqrt(r2) / radius;
  if (r < 1.0) {
    // Parabolic bowl transitioning smoothly to rim crest at r = 1.0
    const bowl = (r * r - 1.0) * depth;
    const rim = Math.pow(r, 3) * rimHeight;
    return bowl + rim;
  } else {
    // Smooth outer ejecta apron decay
    const t = (r - 1.0) / 0.65;
    const smoothDecay = Math.cos(t * Math.PI * 0.5);
    return rimHeight * smoothDecay * smoothDecay;
  }
}

/**
 * Configurable Terramechanics Soil & Rock Profiles
 * Inspired by Bekker-Wong pressure-sinkage & Mohr-Coulomb / Janosi-Hanamoto shear models
 * calibrated to Mars 2020 / MSL rover wheel-soil testbed literature (SIMULATED APPROXIMATION).
 *
 * Units:
 * - cohesionPa: Soil cohesion c (Pa)
 * - frictionAngleDeg: Internal angle of shearing resistance phi (deg)
 * - kc: Bekker cohesive modulus (N / m^(n+1))
 * - kphi: Bekker frictional modulus (N / m^(n+2))
 * - sinkExponent: Bekker sinkage exponent n (dimensionless)
 * - shearModulusK: Janosi shear deformation modulus K (m)
 * - baseRollingRes: Intrinsic carcass/bearing/surface rolling resistance coefficient f_r0
 * - slipSinkageFactor: Dynamic digging multiplier when wheel slips in granular media
 * - roughnessAmp: High-frequency micro-contact vertical perturbation (m)
 */
export const TERRAIN_MATERIAL_PROFILES = {
  bedrock: {
    id: 'bedrock',
    type: 'Bedrock',
    modelTag: 'Elastic Rock Contact (Simulated)',
    cohesionPa: 22000,
    frictionAngleDeg: 39.5,
    friction: 0.96,
    kc: 18000000,
    kphi: 95000000,
    sinkExponent: 1.25,
    shearModulusK: 0.006,
    baseRollingRes: 0.014,
    rollingResistance: 0.015,
    slipSinkageFactor: 0.02,
    roughnessAmp: 0.003,
    dustiness: 0.28
  },
  hard_basalt: {
    id: 'hard_basalt',
    type: 'Hard Basalt',
    modelTag: 'Bekker-Janosi Competent Igneous',
    cohesionPa: 9500,
    frictionAngleDeg: 37.0,
    friction: 0.90,
    kc: 3600000,
    kphi: 22000000,
    sinkExponent: 1.15,
    shearModulusK: 0.009,
    baseRollingRes: 0.018,
    rollingResistance: 0.020,
    slipSinkageFactor: 0.08,
    roughnessAmp: 0.007,
    dustiness: 0.45
  },
  rocky_ground: {
    id: 'rocky_ground',
    type: 'Rocky Ground',
    modelTag: 'Coarse Talus & Cobble Pavement',
    cohesionPa: 3200,
    frictionAngleDeg: 34.5,
    friction: 0.80,
    kc: 620000,
    kphi: 4600000,
    sinkExponent: 1.02,
    shearModulusK: 0.015,
    baseRollingRes: 0.034,
    rollingResistance: 0.038,
    slipSinkageFactor: 0.25,
    roughnessAmp: 0.024,
    dustiness: 0.72
  },
  loose_regolith: {
    id: 'loose_regolith',
    type: 'Loose Regolith',
    modelTag: 'Bekker-Janosi Ferric Regolith',
    cohesionPa: 1650,
    frictionAngleDeg: 33.5,
    friction: 0.78,
    kc: 95000,
    kphi: 1250000,
    sinkExponent: 0.95,
    shearModulusK: 0.020,
    baseRollingRes: 0.028,
    rollingResistance: 0.034,
    slipSinkageFactor: 0.55,
    roughnessAmp: 0.009,
    dustiness: 0.92
  },
  fine_sand: {
    id: 'fine_sand',
    type: 'Fine Sand',
    modelTag: 'Bekker-Janosi Compressible Drift',
    cohesionPa: 420,
    frictionAngleDeg: 28.0,
    friction: 0.56,
    kc: 12000,
    kphi: 420000,
    sinkExponent: 0.82,
    shearModulusK: 0.034,
    baseRollingRes: 0.052,
    rollingResistance: 0.068,
    slipSinkageFactor: 1.15,
    roughnessAmp: 0.005,
    dustiness: 1.30
  },
  dunes: {
    id: 'dunes',
    type: 'Dunes',
    modelTag: 'Bekker-Janosi Aeolian Slipface',
    cohesionPa: 190,
    frictionAngleDeg: 25.0,
    friction: 0.48,
    kc: 4500,
    kphi: 215000,
    sinkExponent: 0.76,
    shearModulusK: 0.044,
    baseRollingRes: 0.064,
    rollingResistance: 0.085,
    slipSinkageFactor: 1.55,
    roughnessAmp: 0.006,
    dustiness: 1.50
  }
};

/**
 * 6 Playable Open-World Martian Regions
 * Connected to authentic Martian Map coordinates & geological classifications
 */
export const MARS_REGIONS = {
  jezero: {
    id: 'jezero',
    name: 'Jezero Crater Floor',
    subtitle: 'Octavia E. Butler Landing Site & Séítah Margin',
    coordinates: '18.38° N, 77.58° E',
    latDeg: 18.3847,
    lonDeg: 77.5802,
    datumElevation: -2560,
    ambientTempOffsetC: 0.0,
    windBaseMs: 4.8,
    prevailingWindDeg: 112, // ESE katabatic crater breeze (MEDA Sol 38-44 typical)
    baseDustTau: 0.44,
    dataBadge: 'NASA PDS / HiRISE REF + SIMULATED MICRO-TERRAIN',
    isNASAReference: true,
    difficulty: 'Low – Moderate',
    hazardRating: 'Beginner Friendly',
    skyTint: 0xd4916a,
    fogDensity: 0.0024,
    rockMultiplier: 1.0,
    spawn: { x: 0, z: 4, heading: 0 },
    palette: {
      low: new THREE.Color(0x6e361e),    // Dark Máaz basalt
      mid: new THREE.Color(0xb85c34),    // Classic ferric regolith
      high: new THREE.Color(0xd98a55),   // Pale dust / scarp crest
      sand: new THREE.Color(0x9a522c)    // Aeolian ripple sand
    },
    description: 'Ancient 45-km lakebed crater floor where NASA Perseverance landed. Features vesicular basaltic flows, micro-craters, transverse sand ripples, and the actual Sols 38–44 NASA SPICE traverse corridor.'
  },

  delta: {
    id: 'delta',
    name: 'Ancient River Delta',
    subtitle: 'Western Jezero Fluvial Fan & Sedimentary Scarps',
    coordinates: '18.45° N, 77.45° E',
    latDeg: 18.4512,
    lonDeg: 77.4518,
    datumElevation: -2490,
    ambientTempOffsetC: -1.2,
    windBaseMs: 5.6,
    prevailingWindDeg: 295, // Down-canyon drainage wind from western inlet valley
    baseDustTau: 0.42,
    dataBadge: 'SIMULATED TERRAIN (MRO HiRISE STRATIGRAPHY MODEL)',
    isNASAReference: false,
    difficulty: 'Moderate',
    hazardRating: 'Terraced Cliffs & Channels',
    skyTint: 0xd8966e,
    fogDensity: 0.0022,
    rockMultiplier: 0.95,
    spawn: { x: 0, z: 12, heading: 0 },
    palette: {
      low: new THREE.Color(0x7c462b),    // Channel siltstone
      mid: new THREE.Color(0xc46d41),    // Layered mudstone
      high: new THREE.Color(0xe09d6b),   // Pale carbonate/clay terrace
      sand: new THREE.Color(0x8c4a27)
    },
    description: 'Sinuous braided river channels and flat-topped sedimentary delta terraces deposited 3.7 billion years ago when water flowed into Lake Jezero. Prime astrobiology target for hydrated clays and carbonates.'
  },

  plains: {
    id: 'plains',
    name: 'Rocky Plains',
    subtitle: 'Máaz Volcanic Flats & Ejecta Boulder Strewnfield',
    coordinates: '18.29° N, 77.71° E',
    latDeg: 18.2905,
    lonDeg: 77.7110,
    datumElevation: -2585,
    ambientTempOffsetC: 0.8,
    windBaseMs: 6.2,
    prevailingWindDeg: 98,
    baseDustTau: 0.40,
    dataBadge: 'SIMULATED TERRAIN (VOLCANIC PLAINS MODEL)',
    isNASAReference: false,
    difficulty: 'Low – Moderate',
    hazardRating: 'Dense Angular Boulders',
    skyTint: 0xcf8962,
    fogDensity: 0.0020,
    rockMultiplier: 1.65,
    spawn: { x: 0, z: 0, heading: 0 },
    palette: {
      low: new THREE.Color(0x522918),    // Dark vesicular lava
      mid: new THREE.Color(0xa6502b),    // Iron-rich plain
      high: new THREE.Color(0xcb7948),   // Dust-coated pavement
      sand: new THREE.Color(0x7d3f22)
    },
    description: 'Broad, windswept basaltic plains fractured into polygonal bedrock plates and littered with angular impact ejecta boulders. High surface traction makes this ideal for high-speed rover testing and rock spectroscopy.'
  },

  dunes: {
    id: 'dunes',
    name: 'Sand Dunes',
    subtitle: 'Séítah Erg & Barchan Megaripple Sea',
    coordinates: '18.35° N, 77.54° E',
    latDeg: 18.3520,
    lonDeg: 77.5408,
    datumElevation: -2575,
    ambientTempOffsetC: 1.4,
    windBaseMs: 7.8,
    prevailingWindDeg: 128,
    baseDustTau: 0.58,
    dataBadge: 'SIMULATED TERRAIN (AEOLIAN DUNE DYNAMICS)',
    isNASAReference: false,
    difficulty: 'High (Traction Hazard)',
    hazardRating: 'High Wheel Slip & Sinkage',
    skyTint: 0xdc996b,
    fogDensity: 0.0032,
    rockMultiplier: 0.42,
    spawn: { x: 0, z: 0, heading: 0 },
    palette: {
      low: new THREE.Color(0x6b3a24),    // Olivine-rich dark sand
      mid: new THREE.Color(0xb66236),    // Windward dune slope
      high: new THREE.Color(0xe39b62),   // Sharp golden-ochre dune crest
      sand: new THREE.Color(0x884726)
    },
    description: 'Vast sea of wind-sculpted barchan dunes and transverse aeolian ridges (TARs). Soft sand reduces tire friction and increases wheel slip—use momentum and interdune bedrock exposures wisely!'
  },

  rim: {
    id: 'rim',
    name: 'Crater Rim',
    subtitle: 'Western Impact Terrace & High Solar Ridge',
    coordinates: '18.52° N, 77.31° E',
    latDeg: 18.5210,
    lonDeg: 77.3104,
    datumElevation: -2180,
    ambientTempOffsetC: -3.2,
    windBaseMs: 8.9,
    prevailingWindDeg: 265,
    baseDustTau: 0.36,
    dataBadge: 'SIMULATED TERRAIN (IMPACT CRATER RIM MODEL)',
    isNASAReference: false,
    difficulty: 'High (Steep Gradients)',
    hazardRating: 'Steep Slopes (15°–26°) & Drop-offs',
    skyTint: 0xc9835d,
    fogDensity: 0.0018,
    rockMultiplier: 1.25,
    spawn: { x: 0, z: 20, heading: 0 },
    palette: {
      low: new THREE.Color(0x5c2f1c),
      mid: new THREE.Color(0xad5731),
      high: new THREE.Color(0xdca074),   // Bright exposed breccia crest
      sand: new THREE.Color(0x854425)
    },
    description: 'Dramatic ascending impact crater rim featuring steep switchback ridges, deep secondary craters, impact megabreccia outcrops, and sweeping panoramic vistas with unobstructed solar charging.'
  },

  highlands: {
    id: 'highlands',
    name: 'Rocky Highlands',
    subtitle: 'Nili Fossae Noachian Crustal Massifs',
    coordinates: '18.78° N, 77.12° E',
    latDeg: 18.7800,
    lonDeg: 77.1200,
    datumElevation: -1890,
    ambientTempOffsetC: -5.4,
    windBaseMs: 7.4,
    prevailingWindDeg: 240,
    baseDustTau: 0.38,
    dataBadge: 'SIMULATED TERRAIN (NOACHIAN HIGHLANDS MODEL)',
    isNASAReference: false,
    difficulty: 'Extreme',
    hazardRating: 'Massive Peaks, Valleys & Rough Talus',
    skyTint: 0xc37c56,
    fogDensity: 0.0025,
    rockMultiplier: 1.45,
    spawn: { x: 0, z: 10, heading: 0 },
    palette: {
      low: new THREE.Color(0x4d2819),
      mid: new THREE.Color(0x9d4e2c),
      high: new THREE.Color(0xd5966c),
      sand: new THREE.Color(0x783c20)
    },
    description: 'Ancient 4-billion-year-old Noachian mountain passes surrounded by towering rocky massifs, hydrothermal fracture veins, talus slopes, and deep canyon floors.'
  }
};

/**
 * Evaluates deterministic elevation, soil terramechanics profile, and slope at any (x, z) in the active region.
 */
export class RegionTerrainSampler {
  constructor(regionId = 'jezero') {
    this.soilOverrideId = null; // Optional sandbox override to test a specific soil profile everywhere
    this.setRegion(regionId);
  }

  setRegion(regionId) {
    this.regionId = MARS_REGIONS[regionId] ? regionId : 'jezero';
    this.config = MARS_REGIONS[this.regionId];
  }

  /**
   * Exact elevation y (meters) at world (x, z)
   */
  getElevation(x, z) {
    const id = this.regionId;

    // Gentle safe flat pad right around origin spawn (radius ~5m blended) Only subtle undulation
    const spawnDist = Math.hypot(x - this.config.spawn.x, z - this.config.spawn.z);
    const spawnFlatten = Math.min(1.0, Math.max(0.0, (spawnDist - 4.0) / 10.0));

    let h = 0;

    if (id === 'jezero') {
      // Preserves compatibility with Sols 38-44 traverse while expanding into huge open world!
      h = 2.0 - z * 0.005;
      h += Math.sin(x * 0.015 + 1.2) * Math.cos(z * 0.018) * 1.9;
      h += fbm2D(x * 0.008, z * 0.008, 4, 2.05, 0.5, 11) * 6.5 * spawnFlatten;

      // Delta scarp rise near z = -95
      const scarpDist = Math.hypot(x + 20, z + 95);
      h += Math.exp(-scarpDist * 0.025) * 3.2;

      // Craters across Jezero sector
      h += craterProfile(x, z, -4, -15, 7.5, 0.9, 0.45);
      h += craterProfile(x, z, 48, -62, 19.0, 2.8, 1.3);
      h += craterProfile(x, z, -68, -45, 24.0, 3.6, 1.5);
      h += craterProfile(x, z, 32, -155, 15.0, 2.1, 0.95);
      h += craterProfile(x, z, -85, -170, 32.0, 4.8, 2.1);

      // Séítah ripple belt
      if (z < -45 && z > -165) {
        const ripple = Math.sin(z * 0.78 + Math.sin(x * 0.09) * 2.2);
        const mask = Math.sin(((z + 45) / -120) * Math.PI);
        h += ripple * mask * 0.38;
      }

      // Distant outer mountain ridges beyond 220m
      const rad = Math.hypot(x, z + 80);
      if (rad > 220) {
        h += Math.pow((rad - 220) * 0.025, 1.45) * (0.6 + 0.6 * ridged2D(x * 0.006, z * 0.006, 3, 77));
      }

    } else if (id === 'delta') {
      // Terraced sedimentary river delta + sinuous paleochannel canyon
      const rawTerrace = fbm2D(x * 0.006, z * 0.006, 4, 2.0, 0.5, 202) * 18.0 + (-z * 0.035);
      // Step/terrace quantization smoothed for driveable geological benches
      const stepSize = 3.6;
      const stepped = Math.floor(rawTerrace / stepSize) * stepSize +
        THREE.MathUtils.smoothstep((rawTerrace % stepSize + stepSize) % stepSize, 0.4, stepSize - 0.4) * stepSize;
      h = THREE.MathUtils.lerp(rawTerrace, stepped, 0.58) * spawnFlatten;

      // Sinuous river channel carving through the delta
      const channelCenterX = Math.sin(z * 0.016) * 38.0 + Math.cos(z * 0.007) * 22.0;
      const distToChannel = Math.abs(x - channelCenterX);
      if (distToChannel < 22.0) {
        const carve = Math.cos((distToChannel / 22.0) * Math.PI * 0.5);
        h -= carve * carve * 4.5 * spawnFlatten;
      }
      h += fbm2D(x * 0.03, z * 0.03, 3, 2.1, 0.45, 210) * 0.9;

    } else if (id === 'plains') {
      // Rolling volcanic flats + dramatic impact craters
      h = fbm2D(x * 0.005, z * 0.005, 4, 2.0, 0.48, 303) * 4.2;
      h += fbm2D(x * 0.025, z * 0.025, 3, 2.1, 0.45, 309) * 0.65;
      h += craterProfile(x, z, 42, -55, 22.0, 3.2, 1.4) * spawnFlatten;
      h += craterProfile(x, z, -60, 40, 28.0, 4.0, 1.7) * spawnFlatten;
      h += craterProfile(x, z, -25, -120, 16.0, 2.0, 0.9) * spawnFlatten;

    } else if (id === 'dunes') {
      // Asymmetric barchan/transverse sand dunes (gentle windward slope, steeper slipface)
      const warp = fbm2D(x * 0.008, z * 0.008, 3, 2.0, 0.5, 404) * 18.0;
      const phase = (z + warp + Math.sin(x * 0.025) * 12.0) * 0.095;
      const duneWave = Math.sin(phase) + 0.32 * Math.sin(2.0 * phase + 0.6);
      const env = 0.55 + 0.45 * (fbm2D(x * 0.005, z * 0.005, 2, 2.0, 0.5, 415) + 0.5);
      h = duneWave * 3.4 * env * spawnFlatten;
      // Secondary fine wind ripples
      h += Math.sin((z * 1.4 + x * 0.4)) * 0.09;
      h += fbm2D(x * 0.012, z * 0.012, 3, 2.0, 0.5, 420) * 2.2;

    } else if (id === 'rim') {
      // Ascending steep crater rim ridge toward -Z with switchback valleys
      const climb = Math.max(-6.0, Math.min(48.0, -z * 0.14)) * spawnFlatten;
      const ridge = ridged2D(x * 0.007, z * 0.007, 4, 505) * 14.0 * spawnFlatten;
      // Driveable ridge saddle corridor winding northward
      const corridorX = Math.sin(z * 0.018) * 32.0;
      const offCorridor = Math.min(1.0, Math.abs(x - corridorX) / 28.0);
      h = climb + ridge * (0.32 + 0.68 * offCorridor);
      h += craterProfile(x, z, 38, -75, 18.0, 3.0, 1.4) * spawnFlatten;
      h += craterProfile(x, z, -44, -145, 22.0, 3.6, 1.6) * spawnFlatten;

    } else if (id === 'highlands') {
      // Towering Noachian mountain peaks with a winding valley floor exploration network
      const valleyCenter = Math.sin(z * 0.012) * 45.0 + Math.cos(x * 0.008) * 20.0;
      const valleyMask = THREE.MathUtils.smoothstep(Math.abs(x - valleyCenter), 14.0, 95.0);
      const mountains = ridged2D(x * 0.0065, z * 0.0065, 4, 606) * 46.0;
      const hills = fbm2D(x * 0.014, z * 0.014, 3, 2.0, 0.5, 612) * 5.5;
      h = (mountains * valleyMask + hills * 0.65) * spawnFlatten;
    }

    // Subtle regolith micro-relief across all regions
    h += noise2D(x * 0.42, z * 0.42, 888) * 0.045;

    return h;
  }

  /**
   * Analytical surface normal at (x, z)
   */
  getNormal(x, z, out = new THREE.Vector3()) {
    const eps = 0.35;
    const hL = this.getElevation(x - eps, z);
    const hR = this.getElevation(x + eps, z);
    const hD = this.getElevation(x, z - eps);
    const hU = this.getElevation(x, z + eps);
    out.set((hL - hR) / (2 * eps), 1.0, (hD - hU) / (2 * eps)).normalize();
    return out;
  }

  /**
   * Slope angle in degrees at (x, z)
   */
  getSlopeDegrees(x, z) {
    const n = this.getNormal(x, z);
    return Math.acos(Math.max(-1, Math.min(1, n.y))) * THREE.MathUtils.RAD2DEG;
  }

  /**
   * Classifies spatial coordinates into one of the 6 physical Martian terrain material profiles:
   * - Hard Basalt
   * - Bedrock
   * - Rocky Ground
   * - Loose Regolith
   * - Fine Sand
   * - Dunes
   */
  getSurfaceProperties(x, z) {
    if (this.soilOverrideId && TERRAIN_MATERIAL_PROFILES[this.soilOverrideId]) {
      return TERRAIN_MATERIAL_PROFILES[this.soilOverrideId];
    }

    const slope = this.getSlopeDegrees(x, z);
    const nMacro = noise2D(x * 0.035, z * 0.035, 999);
    const nPatch = noise2D(x * 0.085, z * 0.085, 515);

    // 1. Dunes Region: Active Dune crests/slipfaces vs Fine Sand troughs vs Exposed Interdune Bedrock
    if (this.regionId === 'dunes') {
      if (nMacro > 0.58 && slope < 7.5) {
        return TERRAIN_MATERIAL_PROFILES.bedrock;
      }
      if (slope > 9.5 || nPatch > 0.15) {
        return TERRAIN_MATERIAL_PROFILES.dunes;
      }
      return TERRAIN_MATERIAL_PROFILES.fine_sand;
    }

    // 2. Jezero Séítah Aeolian Ripple Corridor (Sols 40-41 sand belt)
    if (this.regionId === 'jezero' && z < -48 && z > -160) {
      if (nMacro > 0.25) return TERRAIN_MATERIAL_PROFILES.dunes;
      if (nMacro > -0.18) return TERRAIN_MATERIAL_PROFILES.fine_sand;
      if (z < -105 && z > -130) return TERRAIN_MATERIAL_PROFILES.bedrock; // Paver bedrock strip!
    }

    // 3. Ancient River Delta: Channel Fine Sand, Sedimentary Bedrock Benches, Rocky Talus Scarps
    if (this.regionId === 'delta') {
      const channelCenterX = Math.sin(z * 0.016) * 38.0 + Math.cos(z * 0.007) * 22.0;
      const inChannel = Math.abs(x - channelCenterX) < 15.0;
      if (slope > 15.5) return TERRAIN_MATERIAL_PROFILES.rocky_ground;
      if (inChannel) return nPatch > 0.1 ? TERRAIN_MATERIAL_PROFILES.fine_sand : TERRAIN_MATERIAL_PROFILES.loose_regolith;
      if (slope < 5.5 && nMacro > -0.05) return TERRAIN_MATERIAL_PROFILES.bedrock;
      return TERRAIN_MATERIAL_PROFILES.loose_regolith;
    }

    // 4. Steep Scarps & Highlands Talus -> Rocky Ground
    if (slope > 15.0 || (this.regionId === 'highlands' && nPatch > 0.22)) {
      return TERRAIN_MATERIAL_PROFILES.rocky_ground;
    }

    // 5. Volcanic Rocky Plains -> Hard Basalt & Polygonal Bedrock with pockets of Fine Sand in craters
    if (this.regionId === 'plains') {
      if (nMacro < -0.45) return TERRAIN_MATERIAL_PROFILES.fine_sand;
      if (nPatch > 0.25) return TERRAIN_MATERIAL_PROFILES.bedrock;
      return TERRAIN_MATERIAL_PROFILES.hard_basalt;
    }

    // 6. Crater Rim -> Exposed Bedrock ridges, Rocky Ground switchbacks, Loose Regolith saddles
    if (this.regionId === 'rim') {
      if (slope > 12.0) return TERRAIN_MATERIAL_PROFILES.rocky_ground;
      if (nMacro > 0.15) return TERRAIN_MATERIAL_PROFILES.bedrock;
      return TERRAIN_MATERIAL_PROFILES.hard_basalt;
    }

    // Default spatial mosaic (Jezero floor & Highlands valley): Hard Basalt, Bedrock outcrops, Loose Regolith, Fine Sand hollows
    if (nMacro > 0.42) return TERRAIN_MATERIAL_PROFILES.bedrock;
    if (nMacro > 0.10) return TERRAIN_MATERIAL_PROFILES.hard_basalt;
    if (nMacro < -0.68) return TERRAIN_MATERIAL_PROFILES.fine_sand;
    if (nPatch > 0.48) return TERRAIN_MATERIAL_PROFILES.rocky_ground;

    return TERRAIN_MATERIAL_PROFILES.loose_regolith;
  }
}
