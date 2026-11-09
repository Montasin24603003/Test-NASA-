/**
 * CLOSED-SYSTEM FIRST-PRINCIPLES ENERGY LEDGER
 *
 * Implements Physics Fundamentals Contract B:
 * - Real-time tracking of all mechanical, chemical, and dissipated energy states.
 * - Closed-system conservation check:
 *     Delta E_stored + E_dissipated = E_battery_out + E_MMRTG_in
 * - Closure residual must remain < 1.0% over 60 s test drives.
 * - Explicit loss attribution (zero unaccounted damping).
 */

export class EnergyLedger {
  /**
   * @param {number} initialBatteryEnergyJ - Default: 2400 Wh = 8.64 MJ
   */
  constructor(initialBatteryEnergyJ = 8.64e6) {
    // Stored Energy Components (Joules)
    this.kineticTransJ = 0.0;
    this.kineticRotJ = 0.0;
    this.kineticTotalJ = 0.0;
    this.potentialGravJ = 0.0;
    this.springPotentialJ = 0.0;
    this.batteryChemicalJ = initialBatteryEnergyJ;

    // Cumulative External Work & Generation (Joules)
    this.mmrtgCumulativeInJ = 0.0;
    this.batteryCumulativeOutJ = 0.0;
    this.solarCumulativeInJ = 0.0;

    // Cumulative Dissipation Ledgers (Joules)
    this.dissipation = {
      suspensionDampingJ: 0.0,
      soilCompactionRollingJ: 0.0,
      soilShearSlipJ: 0.0,
      motorCopperLossJ: 0.0,
      motorMechanicalLossJ: 0.0,
      brakeFrictionHeatJ: 0.0,
      aerodynamicDragLossJ: 0.0,
      avionicsHeaterLoadsJ: 0.0,
      numericalStabilityJ: 0.0
    };

    // Baseline Reference for Closed-System Checking
    this.initialStoredEnergyJ = 0.0;
    this.currentStoredEnergyJ = 0.0;
    this.totalDissipatedEnergyJ = 0.0;
    this.closureResidualJ = 0.0;
    this.closureResidualPct = 0.0;

    this._initialized = false;
  }

  /**
   * Initialize reference energy at start of test or simulation run
   * @param {number} eKinetic
   * @param {number} ePotential
   * @param {number} eSpring
   */
  initializeBaseline(eKinetic, ePotential, eSpring) {
    this.kineticTotalJ = eKinetic;
    this.potentialGravJ = ePotential;
    this.springPotentialJ = eSpring;
    this.initialStoredEnergyJ = eKinetic + ePotential + eSpring + this.batteryChemicalJ;
    this.currentStoredEnergyJ = this.initialStoredEnergyJ;
    this._initialized = true;
  }

  /**
   * Record a discrete loss mechanism
   * @param {string} mechanism - Name of dissipation channel
   * @param {number} deltaEnergyJ - Energy dissipated this step (J >= 0)
   */
  recordLoss(mechanism, deltaEnergyJ) {
    if (deltaEnergyJ > 0 && typeof this.dissipation[mechanism] === 'number') {
      this.dissipation[mechanism] += deltaEnergyJ;
    }
  }

  /**
   * Update energy ledger at conclusion of physics step
   *
   * @param {number} eKinetic - 0.5*m*v^2 + 0.5*w^T*I*w (J)
   * @param {number} ePotential - m*g*y (J)
   * @param {number} eSpring - Sum of 0.5*k*x^2 across 6 wheels (J)
   * @param {number} dt - Step duration (s)
   */
  updateStep(eKinetic, ePotential, eSpring, dt) {
    if (!this._initialized) {
      this.initializeBaseline(eKinetic, ePotential, eSpring);
      return;
    }

    this.kineticTotalJ = eKinetic;
    this.potentialGravJ = ePotential;
    this.springPotentialJ = eSpring;

    // Total stored mechanical + chemical energy currently in system
    this.currentStoredEnergyJ = this.kineticTotalJ + this.potentialGravJ +
                                this.springPotentialJ + this.batteryChemicalJ;

    // Sum all cumulative dissipated energy channels
    let sumDissipated = 0.0;
    for (const key in this.dissipation) {
      sumDissipated += this.dissipation[key];
    }
    this.totalDissipatedEnergyJ = sumDissipated;

    // Closed-System Conservation Balance:
    // Stored_Current + Dissipated_Total - (Stored_Initial + External_Energy_In) = Residual
    // Note: Battery chemical energy is already included in currentStoredEnergyJ,
    // so battery output to motors is an internal transfer, not external out.
    const externalEnergyNet = this.mmrtgCumulativeInJ + this.solarCumulativeInJ;
    const expectedTotal = this.initialStoredEnergyJ + externalEnergyNet;
    const actualTotal = this.currentStoredEnergyJ + this.totalDissipatedEnergyJ;

    this.closureResidualJ = actualTotal - expectedTotal;

    // Compute relative residual percentage over total system energy throughput (Contract B):
    // Throughput includes battery discharge, external generation, stored energy delta, and dissipation
    const deltaStored = Math.abs(this.currentStoredEnergyJ - this.initialStoredEnergyJ);
    const throughput = Math.max(100.0, (this.batteryCumulativeOutJ + externalEnergyNet + deltaStored + this.totalDissipatedEnergyJ) * 0.5);
    this.closureResidualPct = Math.min(100.0, (Math.abs(this.closureResidualJ) / throughput) * 100.0);
  }

  /**
   * Snapshot object for telemetry panels and JSON/CSV export
   */
  getSnapshot() {
    return {
      kineticJ: this.kineticTotalJ,
      potentialJ: this.potentialGravJ,
      springJ: this.springPotentialJ,
      batteryChemicalJ: this.batteryChemicalJ,
      mmrtgCumulativeInJ: this.mmrtgCumulativeInJ,
      totalDissipatedJ: this.totalDissipatedEnergyJ,
      closureResidualJ: this.closureResidualJ,
      closureResidualPct: this.closureResidualPct,
      losses: { ...this.dissipation }
    };
  }
}
