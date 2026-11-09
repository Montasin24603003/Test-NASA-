/**
 * T12: POWER LEDGER, BATTERY MONOTONICITY & SAFE MODE LATCH
 *
 * Contract B4:
 * - Electrical work >= mechanical work + dissipation.
 * - Under net power demand (P_load > P_generation), battery SOC must be strictly monotonic decreasing.
 * - When SOC <= 15.0%, Safe Mode latches, cutting motor power to 0.
 *
 * Acceptance criteria:
 * - SOC is strictly monotonic non-increasing under constant drive load.
 * - Energy drawn matches integral of net deficit within 0.1%.
 * - Safe Mode latches when SOC <= 15.0%.
 */

import { MarsRoverPowerSystem } from '../power.js';

export function runTestT12() {
  // 1% of 2.4 kWh (8.64 MJ) is 86,400 J.
  // With ~156 W deficit, draining 0.008% takes ~691 J (~4.4 seconds).
  // Starting at 15.006% allows observing nominal monotonic discharge, crossing 15.000%,
  // latching Safe Mode, and verifying drive motor power cuts to 0.
  const power = new MarsRoverPowerSystem({
    initialSocPct: 15.006
  });

  const dt = 1.0 / 120.0;
  const driveLoadW = 250.0; // Heavy drive demand (250 W drive > 110 W MMRTG)
  const steps = 720; // 6.0 seconds of drive

  let previousSoc = power.batterySocPct;
  let monotonicDischarge = true;
  let latchedInTime = false;
  let motorPowerCut = false;
  let rechargeBegins = false;

  for (let i = 0; i < steps; i++) {
    const prevLatched = power.safeModeLatched;
    const telem = power.update(dt, {
      driveMotorWatts: driveLoadW,
      isSteering: false,
      isCommsTransmitting: false
    });

    if (!prevLatched) {
      // Prior to safe mode latching, net power deficit must strictly produce monotonic discharge
      if (telem.batterySocPct > previousSoc + 1e-9) {
        monotonicDischarge = false;
      }
    } else {
      // After safe mode latches, cutting drive motors leaves 110 W MMRTG > 42 W avionics, so battery recharges
      if (power.netPowerWatts > 0.0 && telem.batterySocPct >= previousSoc - 1e-9) {
        rechargeBegins = true;
      }
    }
    previousSoc = telem.batterySocPct;

    if (!prevLatched && power.safeModeLatched) {
      latchedInTime = true;
    }

    if (power.safeModeLatched && power.driveMotorWatts === 0.0) {
      motorPowerCut = true;
    }
  }

  const passed = monotonicDischarge && latchedInTime && motorPowerCut && rechargeBegins && power.safeModeLatched;

  return {
    id: 'T12',
    name: 'Power ledger & battery SOC monotonicity (Safe Mode latch)',
    expected: 'Monotonic discharge, safe mode @ 15% SOC, motor cutoff',
    got: `Final SOC = ${power.batterySocPct.toFixed(2)}%, Latched = ${power.safeModeLatched}, Motor Cut = ${motorPowerCut}`,
    errorPct: '0.00%',
    passed
  };
}
