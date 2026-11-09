/**
 * DETERMINISTIC FIXED-TIMESTEP SOLVER ACCUMULATOR
 *
 * Implements Physics Fundamentals Contract C1 & C2:
 * - Fixed timestep dt with an accumulator; physics independent of frame rate.
 * - Render interpolates between last two states via interpolation factor alpha.
 * - Cap steps per frame to prevent spiral of death and show warning if cap is hit.
 */

import { DEFAULT_PHYSICS_HZ, MAX_SUBSTEPS_PER_FRAME } from './constants.js';

export class TimestepAccumulator {
  /**
   * @param {number} targetHz - Physics rate (30, 60, 120, 240 Hz)
   * @param {number} maxSteps - Spiral-of-death step cap
   */
  constructor(targetHz = DEFAULT_PHYSICS_HZ, maxSteps = MAX_SUBSTEPS_PER_FRAME) {
    this.targetHz = targetHz;
    this.dt = 1.0 / targetHz;
    this.maxStepsPerFrame = maxSteps;

    this.accumulator = 0.0;
    this.timeScale = 1.0; // 1x, 2x, 5x, 10x, 25x

    this.simTimeS = 0.0;
    this.totalStepsExecuted = 0;
    this.isCapped = false;
    this.stepsRunLastFrame = 0;
    this.achievedTimeScale = 1.0;
    this.interpolationAlpha = 0.0;
  }

  /**
   * Set solver frequency (e.g. 60, 120, 240 Hz)
   * @param {number} hz
   */
  setFrequency(hz) {
    const clampedHz = Math.max(30, Math.min(240, Math.round(hz)));
    this.targetHz = clampedHz;
    this.dt = 1.0 / clampedHz;
    this.accumulator = 0.0;
  }

  /**
   * Set simulation time acceleration multiplier (e.g. 1x, 2x, 5x, 10x, 25x)
   * @param {number} scale
   */
  setTimeScale(scale) {
    this.timeScale = Math.max(0.1, Math.min(50.0, scale));
  }

  /**
   * Feed rendering frame delta (dtRender in seconds) and execute fixed physics steps.
   *
   * @param {number} dtRender - Delta time from animation loop (s)
   * @param {Function} stepCallback - (dt, stepIndex, isLastStep) => void
   * @returns {{ stepsRun: number, alpha: number, capped: boolean, achievedScale: number }}
   */
  update(dtRender, stepCallback) {
    // Clamp excessive frame pauses (e.g. background tab or breakpoint) to 0.1s
    const clampedDt = Math.max(0.0, Math.min(dtRender, 0.1));
    const effectiveDt = clampedDt * this.timeScale;

    this.accumulator += effectiveDt;
    let steps = 0;
    this.isCapped = false;

    // Substep loop
    while (this.accumulator >= this.dt && steps < this.maxStepsPerFrame) {
      steps++;
      this.totalStepsExecuted++;
      this.simTimeS += this.dt;
      this.accumulator -= this.dt;

      const isLast = (this.accumulator < this.dt) || (steps >= this.maxStepsPerFrame);
      stepCallback(this.dt, steps, isLast);
    }

    // Check if step cap was hit (spiral of death defense)
    if (this.accumulator >= this.dt && steps >= this.maxStepsPerFrame) {
      this.isCapped = true;
      // Discard backlog to prevent spiral of death
      this.accumulator = 0.0;
    }

    this.stepsRunLastFrame = steps;
    // Normalized interpolation factor between 0.0 and 1.0
    this.interpolationAlpha = this.dt > 0 ? (this.accumulator / this.dt) : 0.0;
    this.achievedTimeScale = (clampedDt > 1e-6) ? (steps * this.dt) / clampedDt : this.timeScale;

    return {
      stepsRun: steps,
      alpha: this.interpolationAlpha,
      capped: this.isCapped,
      achievedScale: this.achievedTimeScale
    };
  }

  /**
   * Reset the accumulator state
   */
  reset() {
    this.accumulator = 0.0;
    this.simTimeS = 0.0;
    this.totalStepsExecuted = 0;
    this.isCapped = false;
    this.stepsRunLastFrame = 0;
    this.interpolationAlpha = 0.0;
  }
}
