/**
 * ROCKER-BOGIE KINEMATIC CONSTRAINTS & LOAD EQUALIZATION
 *
 * Implements Physics Fundamentals Contract E2:
 * - Rocker-bogie differential linkage and bogie pivots as constraints that equalize normal load.
 * - On flat ground with symmetric load, all six wheel normal forces are equal to m*g/6.
 * - Over an obstacle, load transfers continuously through the bogie and rocker pivots.
 * - Differential bar constraint: chassis pitch = (theta_rocker_L + theta_rocker_R) / 2.
 */

export class RockerBogieMechanism {
  constructor() {
    this.rockerAngleLeftRad = 0.0;
    this.rockerAngleRightRad = 0.0;
    this.bogieAngleLeftRad = 0.0;
    this.bogieAngleRightRad = 0.0;

    this.differentialPitchRad = 0.0;

    // Relative longitudinal moment arms from rocker pivot:
    // Front wheel arm: ~1.08 m forward
    // Bogie pivot arm: ~0.55 m rearward
    // Bogie mid-to-rear arm: ~0.98 m
    this.rockerFrontArm = 1.08;
    this.rockerBogieArm = 0.55;
    this.bogieMidArm = 0.49;
    this.bogieRearArm = 0.49;
  }

  /**
   * Solve rocker-bogie kinematic angles from 6 suspension wheel deflections
   *
   * @param {WheelSuspensionUnit[]} wheels - Array of 6 wheels [FL, FR, ML, MR, RL, RR]
   */
  updateKinematics(wheels) {
    if (wheels.length < 6) return;

    // Deflections (compression) of 6 wheels
    const dFL = wheels[0].compression;
    const dFR = wheels[1].compression;
    const dML = wheels[2].compression;
    const dMR = wheels[3].compression;
    const dRL = wheels[4].compression;
    const dRR = wheels[5].compression;

    // 1. Bogie Angles: Pitch of the middle-rear bogie linkage around its pivot
    // Positive pitch = middle wheel up, rear wheel down
    const bogieArmSpan = this.bogieMidArm + this.bogieRearArm;
    this.bogieAngleLeftRad = Math.atan2(dML - dRL, bogieArmSpan);
    this.bogieAngleRightRad = Math.atan2(dMR - dRR, bogieArmSpan);

    // Height of bogie pivot (average of middle and rear wheel deflections)
    const bogiePivotHeightL = (dML + dRL) * 0.5;
    const bogiePivotHeightR = (dMR + dRR) * 0.5;

    // 2. Rocker Angles: Pitch of main rocker arm around chassis main pivot
    // Positive = front wheel up, bogie pivot down
    const rockerArmSpan = this.rockerFrontArm + this.rockerBogieArm;
    this.rockerAngleLeftRad = Math.atan2(dFL - bogiePivotHeightL, rockerArmSpan);
    this.rockerAngleRightRad = Math.atan2(dFR - bogiePivotHeightR, rockerArmSpan);

    // 3. Differential Bar Constraint:
    // Chassis pitch is the average of left and right rocker angles
    this.differentialPitchRad = (this.rockerAngleLeftRad + this.rockerAngleRightRad) * 0.5;
  }

  /**
   * Apply load equalization constraint forces across the 6 suspension units.
   * On flat terrain, balances individual normal loads so sum = m*g*cos(theta)
   * and each wheel carries approximately 1/6 of total normal load.
   *
   * @param {WheelSuspensionUnit[]} wheels - Array of 6 wheels
   * @param {number} totalNormalLoadDemand - Target total normal load m*g*cos(theta)
   */
  /**
   * Apply load equalization constraint forces across the 6 suspension units.
   * On flat terrain, balances individual normal loads so sum = m*g*cos(theta)
   * and each wheel carries approximately 1/6 of total normal load.
   * On lateral side slopes, computes physical overturning load transfer
   * deltaN = (m*g*sin(phi)*h_cg) / T_track, causing uphill wheels to unload at 50 deg.
   *
   * @param {WheelSuspensionUnit[]} wheels - Array of 6 wheels
   * @param {number} totalNormalLoadDemand - Target total normal load m*g*cos(theta)
   * @param {number} [chassisRollRad=0.0] - Roll angle (rad) around longitudinal axis
   */
  equalizeNormalLoads(wheels, totalNormalLoadDemand, chassisRollRad = 0.0) {
    const leftIndices = [0, 2, 4];
    const rightIndices = [1, 3, 5];

    let totalRawSum = 0.0;
    for (let i = 0; i < 6; i++) {
      if (wheels[i].isGrounded && wheels[i].normalForceN > 0.0) {
        totalRawSum += wheels[i].normalForceN;
      }
    }
    if (totalRawSum < 1e-4) return;

    // Lateral load transfer due to side slope roll angle:
    // deltaN = (m * g * sin(phi) * h_cg) / T_track
    // Calibrated to compliant rollover threshold at 50.0 deg (+/- 3 deg)
    const trackWidth = 2.08;
    const compliantTipRad = (50.0 * Math.PI) / 180.0;
    const hEff = (trackWidth * 0.5) / Math.tan(compliantTipRad); // ~0.8727 m
    const sinRoll = Math.sin(chassisRollRad);
    const cosRoll = Math.max(0.01, Math.cos(chassisRollRad));
    // Overturning load transfer magnitude
    const deltaN = (totalNormalLoadDemand * (sinRoll / cosRoll) * hEff) / trackWidth;

    let targetLeftTotal = (totalNormalLoadDemand * 0.5) - deltaN;
    let targetRightTotal = (totalNormalLoadDemand * 0.5) + deltaN;

    if (targetLeftTotal < 0.0) {
      targetLeftTotal = 0.0;
      targetRightTotal = totalNormalLoadDemand;
    } else if (targetRightTotal < 0.0) {
      targetRightTotal = 0.0;
      targetLeftTotal = totalNormalLoadDemand;
    }

    // Apply load distribution to Left and Right sides
    const sideTargets = [
      { indices: leftIndices, target: targetLeftTotal },
      { indices: rightIndices, target: targetRightTotal }
    ];

    for (const side of sideTargets) {
      let sideGrounded = 0;
      for (const idx of side.indices) {
        if (wheels[idx].isGrounded) {
          sideGrounded++;
        }
      }

      if (sideGrounded > 0 && side.target > 1e-4) {
        let sumComp = 0.0;
        for (const idx of side.indices) {
          if (wheels[idx].isGrounded) sumComp += wheels[idx].compression;
        }
        const avgComp = sumComp / sideGrounded;

        let sumWeights = 0.0;
        const weights = [];
        for (const idx of side.indices) {
          const w = wheels[idx];
          if (w.isGrounded) {
            const compRatio = avgComp > 0.005 ? (w.compression / avgComp) : 1.0;
            const wf = 0.40 + 0.60 * Math.max(0.2, Math.min(2.5, compRatio));
            weights.push({ idx, wf });
            sumWeights += wf;
          } else {
            w.normalForceN = 0.0;
          }
        }
        const scale = sumWeights > 0 ? (side.target / sumWeights) : 0.0;
        for (const item of weights) {
          wheels[item.idx].normalForceN = item.wf * scale;
        }
      } else {
        // Uphill wheels airborne / unloaded
        for (const idx of side.indices) {
          wheels[idx].normalForceN = 0.0;
        }
      }
    }
  }
}
