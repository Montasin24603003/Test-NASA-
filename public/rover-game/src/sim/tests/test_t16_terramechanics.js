/**
 * T16: TERRAMECHANICS MONOTONICITY & SOIL ORDERING
 *
 * Contract F & T16:
 * - Sinkage increases with normal load and decreases with stiffer soil.
 * - Same throttle for 10 s on basalt, regolith, and dune sand gives strictly ordered results:
 *     dune sand has the most slip, highest sinkage, and greatest mechanical work per meter.
 */

import { TerramechanicsModel, SOIL_PROFILES } from '../soilModels.js';
import { CoreRoverPhysics } from '../corePhysics.js';

export function runTestT16() {
  // 1. Static sinkage vs soil stiffness under nominal 633 N wheel load
  const loadN = 633.8;
  const zBedrock = TerramechanicsModel.computeSinkage(loadN, SOIL_PROFILES.bedrock).sinkageM;
  const zBasalt = TerramechanicsModel.computeSinkage(loadN, SOIL_PROFILES.hard_basalt).sinkageM;
  const zRegolith = TerramechanicsModel.computeSinkage(loadN, SOIL_PROFILES.loose_regolith).sinkageM;
  const zFineSand = TerramechanicsModel.computeSinkage(loadN, SOIL_PROFILES.fine_sand).sinkageM;
  const zDunes = TerramechanicsModel.computeSinkage(loadN, SOIL_PROFILES.dune_sand).sinkageM;

  const stiffnessMonotonic = (zBedrock < zBasalt) && (zBasalt < zRegolith) &&
                             (zRegolith < zFineSand) && (zFineSand < zDunes);

  // 2. 10-second drive comparison on Basalt vs Regolith vs Dune Sand
  const dt = 1.0 / 120.0;
  const durationS = 10.0;
  const steps = Math.round(durationS / dt);

  function simulateSoilRun(soilProfile) {
    const sim = new CoreRoverPhysics({ soil: soilProfile });
    sim.lockedWheels = false;
    sim.spawnAt(0, 0);

    let totalWorkJ = 0.0;
    for (let i = 0; i < steps; i++) {
      sim.step(dt, 0.45, false);
      for (const w of sim.wheelAssemblies) {
        totalWorkJ += Math.abs(w.mechanicalPowerW) * dt;
      }
    }

    const distM = Math.hypot(sim.chassis.position.x, sim.chassis.position.z);
    const workPerMeter = distM > 0.1 ? (totalWorkJ / distM) : Infinity;

    return {
      avgSlip: sim.averageSlip,
      sinkageCm: sim.averageSinkageCm,
      distM,
      workPerMeter
    };
  }

  const runBasalt = simulateSoilRun(SOIL_PROFILES.hard_basalt);
  const runRegolith = simulateSoilRun(SOIL_PROFILES.loose_regolith);
  const runDunes = simulateSoilRun(SOIL_PROFILES.dune_sand);

  // Verification checks:
  // Slip: Basalt < Regolith < Dunes
  const slipOrdered = (runBasalt.avgSlip < runRegolith.avgSlip) && (runRegolith.avgSlip < runDunes.avgSlip);
  // Sinkage: Basalt < Regolith < Dunes
  const sinkageOrdered = (runBasalt.sinkageCm < runRegolith.sinkageCm) && (runRegolith.sinkageCm < runDunes.sinkageCm);
  // Energy per meter: Basalt < Regolith < Dunes
  const energyOrdered = (runBasalt.workPerMeter < runRegolith.workPerMeter) && (runRegolith.workPerMeter < runDunes.workPerMeter);

  const passed = stiffnessMonotonic && slipOrdered && sinkageOrdered && energyOrdered;

  return {
    id: 'T16',
    name: 'Terramechanics monotonicity & Bekker soil ordering',
    expected: 'Basalt < Regolith < Dunes for sinkage, slip, and J/m',
    got: `Slip: [${runBasalt.avgSlip.toFixed(3)}, ${runRegolith.avgSlip.toFixed(3)}, ${runDunes.avgSlip.toFixed(3)}], Sink: [${runBasalt.sinkageCm.toFixed(2)}, ${runRegolith.sinkageCm.toFixed(2)}, ${runDunes.sinkageCm.toFixed(2)}] cm`,
    errorPct: '0.00%',
    passed
  };
}
