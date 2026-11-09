/**
 * NASA Mars Digital Elevation Model (DEM) & Topography Processing Engine
 * 
 * Sources:
 * - NASA Mars Global Surveyor (MGS) MOLA MEGDR 128 px/deg & 4 px/deg
 * - Bundled 128×128 Jezero elevation patch (nominal ~240 m mean grid spacing)
 * - Projection: Equirectangular / Areocentric IAU2000:49900
 * - Algorithm: Horn's 8-neighbor weighted finite difference gradient for true metric surface slope
 */

import { queryMolaElevation } from '@/data/mola-global-dem';
import jezeroData from '@/data/jezero_data.json';

export interface MarsElevationProfile {
  elevationM: number;
  slopeDeg: number;
  roughnessM: number;
  topographicPositionIndex: number; // TPI > 0 ridge/peak, ~0 plain/uniform slope, < 0 depression/crater
  terrainClassification: 'Flat Plains' | 'Gentle Undulation' | 'Moderate Slope' | 'Steep Escarpment' | 'Hazardous Cliff / Chasma';
  provenance: 'Jezero DEM patch (128×128)' | 'NASA MGS MOLA MEGDR';
  resolutionM: number;
}

// Jezero high-resolution bounding box
const JEZERO_BOUNDS = {
  latMin: 18.20,
  latMax: 18.65,
  lonMin: 77.25,
  lonMax: 77.75,
};

// Cached Jezero decoded DEM
let cachedJezeroDem: Float32Array | null = null;
function getJezeroDem(): Float32Array {
  if (cachedJezeroDem) return cachedJezeroDem;
  const bin = atob(jezeroData.dem);
  const arr = new Float32Array(bin.length);
  const hmin = jezeroData.hmin; // e.g. -2650m
  const hmax = jezeroData.hmax; // e.g. -2200m
  const span = hmax - hmin;
  for (let i = 0; i < bin.length; i++) {
    const uint8 = bin.charCodeAt(i);
    arr[i] = hmin + (uint8 / 255.0) * span;
  }
  cachedJezeroDem = arr;
  return arr;
}

/**
 * Mars volumetric mean radius in meters
 */
const MARS_RADIUS_M = 3389500;

/**
 * Returns surface elevation in meters relative to MOLA datum.
 */
export function getMarsElevation(lat: number, lon: number): { elevationM: number; provenance: 'Jezero DEM patch (128×128)' | 'NASA MGS MOLA MEGDR'; resolutionM: number } {
  // Check if inside Jezero Crater HiRISE coverage
  if (
    lat >= JEZERO_BOUNDS.latMin &&
    lat <= JEZERO_BOUNDS.latMax &&
    lon >= JEZERO_BOUNDS.lonMin &&
    lon <= JEZERO_BOUNDS.lonMax
  ) {
    const dem = getJezeroDem();
    const n = jezeroData.n; // 128
    const rFrac = (JEZERO_BOUNDS.latMax - lat) / (JEZERO_BOUNDS.latMax - JEZERO_BOUNDS.latMin);
    const cFrac = (lon - JEZERO_BOUNDS.lonMin) / (JEZERO_BOUNDS.lonMax - JEZERO_BOUNDS.lonMin);
    const r = Math.max(0, Math.min(n - 1, Math.floor(rFrac * n)));
    const c = Math.max(0, Math.min(n - 1, Math.floor(cFrac * n)));
    const val = dem[r * n + c] ?? 0;
    return {
      elevationM: Math.round(val),
      provenance: 'Jezero DEM patch (128×128)',
      // Report mean north/south and east/west cell spacing on Mars.
      resolutionM: Math.round(
        (MARS_RADIUS_M * (Math.PI / 180) *
          ((JEZERO_BOUNDS.latMax - JEZERO_BOUNDS.latMin) +
            (JEZERO_BOUNDS.lonMax - JEZERO_BOUNDS.lonMin) * Math.cos((lat * Math.PI) / 180))) /
          (2 * n),
      ),
    };
  }

  return {
    elevationM: queryMolaElevation(lat, lon),
    provenance: 'NASA MGS MOLA MEGDR',
    resolutionM: 463.0,
  };
}

/**
 * Calculates metric surface slope in degrees using Horn's 8-neighbor finite-difference method.
 * Computes exact ground-distance steps in meters taking planetary latitude into account.
 */
export function getMarsTopography(lat: number, lon: number): MarsElevationProfile {
  const centerElevData = getMarsElevation(lat, lon);
  const zCenter = centerElevData.elevationM;

  // Small differential offset (0.015° ~ 880m on Mars)
  const dDeg = centerElevData.provenance === 'Jezero DEM patch (128×128)' ? 0.003 : 0.015;
  const dLatRad = (dDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  // Metric step sizes
  const dy = MARS_RADIUS_M * dLatRad;
  const dx = Math.max(10, MARS_RADIUS_M * Math.cos(latRad) * dLatRad);

  // Sample 8 neighbors for Horn's formula:
  // [zNW, zN, zNE]
  // [zW,  zC, zE ]
  // [zSW, zS, zSE]
  const zN = getMarsElevation(lat + dDeg, lon).elevationM;
  const zS = getMarsElevation(lat - dDeg, lon).elevationM;
  const zE = getMarsElevation(lat, lon + dDeg).elevationM;
  const zW = getMarsElevation(lat, lon - dDeg).elevationM;
  const zNE = getMarsElevation(lat + dDeg, lon + dDeg).elevationM;
  const zNW = getMarsElevation(lat + dDeg, lon - dDeg).elevationM;
  const zSE = getMarsElevation(lat - dDeg, lon + dDeg).elevationM;
  const zSW = getMarsElevation(lat - dDeg, lon - dDeg).elevationM;

  // Horn's weighted gradient
  const dzdx = ((zNE + 2 * zE + zSE) - (zNW + 2 * zW + zSW)) / (8 * dx);
  const dzdy = ((zNW + 2 * zN + zNE) - (zSW + 2 * zS + zSE)) / (8 * dy);

  const gradientMag = Math.hypot(dzdx, dzdy);
  let slopeDeg = Number(((Math.atan(gradientMag) * 180) / Math.PI).toFixed(1));

  // RMS Roughness calculation over 3x3 kernel
  const neighbors = [zN, zS, zE, zW, zNE, zNW, zSE, zSW];
  const meanNeighbors = neighbors.reduce((acc, v) => acc + v, 0) / 8;
  const variance = neighbors.reduce((acc, v) => acc + Math.pow(v - meanNeighbors, 2), 0) / 8;
  const roughnessM = Number(Math.sqrt(variance).toFixed(1));

  // Topographic Position Index (TPI)
  const tpi = Number((zCenter - meanNeighbors).toFixed(1));

  // Qualitative Terrain Classification
  let terrainClassification: MarsElevationProfile['terrainClassification'] = 'Flat Plains';
  if (slopeDeg > 20 || Math.abs(tpi) > 180) {
    terrainClassification = 'Hazardous Cliff / Chasma';
  } else if (slopeDeg > 12 || Math.abs(tpi) > 90) {
    terrainClassification = 'Steep Escarpment';
  } else if (slopeDeg > 6) {
    terrainClassification = 'Moderate Slope';
  } else if (slopeDeg > 2.5) {
    terrainClassification = 'Gentle Undulation';
  }

  return {
    elevationM: zCenter,
    slopeDeg,
    roughnessM,
    topographicPositionIndex: tpi,
    terrainClassification,
    provenance: centerElevData.provenance,
    resolutionM: centerElevData.resolutionM,
  };
}
