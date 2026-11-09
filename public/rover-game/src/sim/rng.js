/**
 * DETERMINISTIC SEEDED PSEUDO-RANDOM NUMBER GENERATOR (Mulberry32)
 *
 * Adheres strictly to Physics Fundamentals Contract C5:
 * "Determinism: given the same seed, initial state and input sequence,
 * the simulation yields identical results. Use a seeded PRNG only. No Math.random in /src/sim."
 */

export class DeterministicRNG {
  /**
   * @param {number} seedInt - 32-bit integer seed
   */
  constructor(seedInt = 1337) {
    this._initialSeed = seedInt >>> 0;
    this._state = this._initialSeed;
  }

  /**
   * Re-seed the generator
   * @param {number} seedInt
   */
  seed(seedInt) {
    this._initialSeed = seedInt >>> 0;
    this._state = this._initialSeed;
  }

  /**
   * Returns a deterministic float in [0, 1)
   * @returns {number}
   */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
  }

  /**
   * Returns a float in [min, max)
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * Returns an integer in [min, max] inclusive
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Generates a normally distributed random variable using the Box-Muller transform
   * @param {number} mean
   * @param {number} stdDev
   * @returns {number}
   */
  gaussian(mean = 0.0, stdDev = 1.0) {
    let u1 = this.next();
    let u2 = this.next();
    // Prevent log(0)
    while (u1 <= 1e-15) {
      u1 = this.next();
    }
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  /**
   * Serialize internal state for save/load or test checkpoints
   * @returns {number}
   */
  getState() {
    return this._state;
  }

  /**
   * Restore internal state
   * @param {number} st
   */
  setState(st) {
    this._state = st >>> 0;
  }
}

/** Global default simulation PRNG instance */
export const defaultSimRNG = new DeterministicRNG(1337);
