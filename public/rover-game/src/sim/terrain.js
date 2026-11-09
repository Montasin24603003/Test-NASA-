/**
 * ANALYTIC & BILINEAR HEIGHTFIELD TERRAIN INTERFACE
 *
 * Implements Physics Fundamentals Contract C & F:
 * - Pure heightfield elevation queries with finite-difference or analytic gradients.
 * - One sample per wheel contact point; zero Three.js or WebGL mesh raycasting.
 * - Supports benchmark analytic surfaces (flat planes, inclined slopes, sinusoidal test surfaces).
 * - Compatible with both Vec3 and Array return buffers.
 */

import { Vec3 } from './math3d.js';

export class SimTerrain {
  constructor(mode = 'flat', options = {}) {
    this.mode = mode; // 'flat' | 'incline' | 'sine' | 'grid' | 'callback'
    this.options = { ...options };

    // Default incline parameters
    this.slopeDeg = options.slopeDeg ?? 0.0;
    this.slopeDirectionDeg = options.slopeDirectionDeg ?? 0.0; // Azimuth 0 = downhill along +z

    // Sine surface parameters (for test T15)
    this.sineAmp = options.sineAmp ?? 0.5;
    this.sineFreqX = options.sineFreqX ?? 0.2;
    this.sineFreqZ = options.sineFreqZ ?? 0.2;

    // Grid parameters
    this.gridData = options.gridData || null;
    this.gridWidth = options.gridWidth || 0;
    this.gridHeight = options.gridHeight || 0;
    this.gridSpacing = options.gridSpacing || 1.0;
    this.gridOriginX = options.gridOriginX || 0.0;
    this.gridOriginZ = options.gridOriginZ || 0.0;

    // Custom callbacks
    this.customElevationFn = options.elevationFn || null;
    this.customSoilFn = options.soilFn || null;
  }

  setIncline(slopeDeg, dirDeg = 0.0) {
    this.mode = 'incline';
    this.slopeDeg = slopeDeg;
    this.slopeDirectionDeg = dirDeg;
  }

  setSinusoidal(amp = 0.5, freqX = 0.2, freqZ = 0.2) {
    this.mode = 'sine';
    this.sineAmp = amp;
    this.sineFreqX = freqX;
    this.sineFreqZ = freqZ;
  }

  getHeightAt(x, z) {
    switch (this.mode) {
      case 'flat':
        return this.options.baseY ?? 0.0;

      case 'incline': {
        const theta = (this.slopeDeg * Math.PI) / 180.0;
        const psi = (this.slopeDirectionDeg * Math.PI) / 180.0;
        const distDownhill = x * Math.sin(psi) + z * Math.cos(psi);
        const baseY = this.options.baseY ?? 0.0;
        return baseY - distDownhill * Math.tan(theta);
      }

      case 'sine': {
        return (this.options.baseY ?? 0.0) +
          this.sineAmp * Math.sin(this.sineFreqX * x) * Math.cos(this.sineFreqZ * z);
      }

      case 'grid': {
        return this._getBilinearGridHeight(x, z);
      }

      case 'callback': {
        if (this.customElevationFn) {
          return this.customElevationFn(x, z);
        }
        return 0.0;
      }

      default:
        return 0.0;
    }
  }

  _getBilinearGridHeight(x, z) {
    if (!this.gridData || this.gridWidth <= 1 || this.gridHeight <= 1) {
      return 0.0;
    }
    const gx = (x - this.gridOriginX) / this.gridSpacing;
    const gz = (z - this.gridOriginZ) / this.gridSpacing;

    const ix = Math.floor(gx);
    const iz = Math.floor(gz);

    if (ix < 0 || ix >= this.gridWidth - 1 || iz < 0 || iz >= this.gridHeight - 1) {
      return 0.0;
    }

    const fx = gx - ix;
    const fz = gz - iz;

    const idx00 = iz * this.gridWidth + ix;
    const idx10 = idx00 + 1;
    const idx01 = idx00 + this.gridWidth;
    const idx11 = idx01 + 1;

    const h00 = this.gridData[idx00];
    const h10 = this.gridData[idx10];
    const h01 = this.gridData[idx01];
    const h11 = this.gridData[idx11];

    const hTop = h00 * (1 - fx) + h10 * fx;
    const hBot = h01 * (1 - fx) + h11 * fx;

    return hTop * (1 - fz) + hBot * fz;
  }

  /**
   * Compute outward unit surface normal vector [nx, ny, nz] at (x, z)
   * Supports Vec3 instances and number arrays
   * @param {number} x
   * @param {number} z
   * @param {Vec3|number[]} [out]
   * @returns {Vec3|number[]}
   */
  getNormalAt(x, z, out = new Vec3(0, 1, 0)) {
    let nx = 0.0, ny = 1.0, nz = 0.0;

    if (this.mode === 'flat') {
      nx = 0.0; ny = 1.0; nz = 0.0;
    } else if (this.mode === 'incline') {
      const theta = (this.slopeDeg * Math.PI) / 180.0;
      const psi = (this.slopeDirectionDeg * Math.PI) / 180.0;
      // Normal points perpendicular to inclined plane into upper hemisphere:
      // Incline: y = y0 - (x * sin(psi) + z * cos(psi)) * tan(theta)
      // Grad y = (-sin(psi)*tan(theta), -cos(psi)*tan(theta))
      // Unit normal = (sin(psi)*sin(theta), cos(theta), cos(psi)*sin(theta))
      nx = Math.sin(psi) * Math.sin(theta);
      ny = Math.cos(theta);
      nz = Math.cos(psi) * Math.sin(theta);
    } else if (this.mode === 'sine') {
      const dh_dx = this.sineAmp * this.sineFreqX * Math.cos(this.sineFreqX * x) * Math.cos(this.sineFreqZ * z);
      const dh_dz = -this.sineAmp * this.sineFreqZ * Math.sin(this.sineFreqX * x) * Math.sin(this.sineFreqZ * z);
      const len = Math.sqrt(dh_dx * dh_dx + 1.0 + dh_dz * dh_dz);
      nx = -dh_dx / len;
      ny = 1.0 / len;
      nz = -dh_dz / len;
    } else {
      const eps = 0.02;
      const hL = this.getHeightAt(x - eps, z);
      const hR = this.getHeightAt(x + eps, z);
      const hD = this.getHeightAt(x, z - eps);
      const hU = this.getHeightAt(x, z + eps);
      const dh_dx = (hR - hL) / (2.0 * eps);
      const dh_dz = (hU - hD) / (2.0 * eps);
      const len = Math.sqrt(dh_dx * dh_dx + 1.0 + dh_dz * dh_dz);
      nx = -dh_dx / len;
      ny = 1.0 / len;
      nz = -dh_dz / len;
    }

    if (out instanceof Vec3 || (typeof out === 'object' && 'set' in out)) {
      out.set(nx, ny, nz);
    } else if (Array.isArray(out) || out instanceof Float64Array) {
      out[0] = nx; out[1] = ny; out[2] = nz;
    }
    return out;
  }

  getSoilTypeAt(x, z) {
    if (this.customSoilFn) {
      return this.customSoilFn(x, z);
    }
    return this.options.defaultSoil || 'loose_regolith';
  }
}
