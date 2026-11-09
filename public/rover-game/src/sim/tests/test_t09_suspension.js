/**
 * T09: SUSPENSION OSCILLATION FREQUENCY
 *
 * Contract A & T09:
 * Displace a single wheel suspension unit; the measured damped natural frequency matches:
 * omega_d = sqrt(k/m - (c / (2*m))^2) within 3%.
 */

import { WheelSuspensionUnit } from '../suspension.js';
import { WHEEL_CONFIGS } from '../constants.js';

export function runTestT09() {
  const m = 170.833; // kg (1025 kg / 6 wheels)
  const k = 5600.0;  // N/m
  const c = 260.0;   // N*s/m (underdamped regime for frequency measurement)

  const wheel = new WheelSuspensionUnit(WHEEL_CONFIGS[0], { springK: k, damperC: c });
  const theoreticalOmegaD = wheel.getAnalyticalDampedFrequency(m);
  const theoreticalPeriodS = (2.0 * Math.PI) / theoreticalOmegaD;

  // Simulate 1-DOF damped harmonic oscillator:
  // x'' = -(k/m)*x - (c/m)*x'
  let x = 0.12; // 12 cm initial displacement
  let v = 0.0;
  const dt = 1.0 / 1200.0; // High-precision 1200 Hz integration
  const totalTimeS = 3.5;
  const steps = Math.round(totalTimeS / dt);

  const zeroCrossings = [];
  let prevX = x;

  for (let step = 0; step < steps; step++) {
    const t = step * dt;
    // Harmonic spring + damper acceleration
    const a = -(k / m) * x - (c / m) * v;
    // Symplectic Euler
    v += a * dt;
    x += v * dt;

    // Detect zero-crossing (falling edge: prevX > 0 and x <= 0)
    if (prevX > 0 && x <= 0) {
      // Linear interpolation for exact crossing time
      const frac = prevX / (prevX - x);
      const exactT = (step - 1 + frac) * dt;
      zeroCrossings.push(exactT);
    }
    prevX = x;
  }

  // Measure period from successive crossings (each full period has 1 falling crossing)
  let measuredPeriodS = 0.0;
  if (zeroCrossings.length >= 2) {
    const p1 = zeroCrossings[1] - zeroCrossings[0];
    measuredPeriodS = p1;
  }

  const measuredOmegaD = (2.0 * Math.PI) / measuredPeriodS;
  const errorPct = (Math.abs(measuredOmegaD - theoreticalOmegaD) / theoreticalOmegaD) * 100.0;

  const passed = errorPct <= 3.0 && Number.isFinite(measuredOmegaD);

  return {
    id: 'T09',
    name: 'Suspension damped oscillation frequency',
    expected: `omega_d = ${theoreticalOmegaD.toFixed(3)} rad/s (T = ${theoreticalPeriodS.toFixed(3)}s)`,
    got: `omega_d = ${measuredOmegaD.toFixed(3)} rad/s (T = ${measuredPeriodS.toFixed(3)}s)`,
    errorPct: `${errorPct.toFixed(2)}%`,
    passed
  };
}
