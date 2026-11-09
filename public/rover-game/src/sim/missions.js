/**
 * FIRST-PRINCIPLES NASA SCIENTIFIC MISSIONS & EXPEDITIONS CATALOG
 *
 * Implements 7 physics-grounded mission profiles with quantitative verification thresholds:
 * 1. Sol 38 Mobility Checkout: Ackermann ICR & Low-Gravity Caliper Braking (g = 3.71 m/s^2)
 * 2. Western Delta Terramechanics: Multi-soil Bekker sinkage comparison
 * 3. Máaz Basalt SuperCam Survey: LIBS pulsed plasma elemental spectroscopy
 * 4. Crater Rim Grade Ascent: Downhill shear mg*sin(theta) vs Mohr-Coulomb traction & SSF
 * 5. Scientific Coring & Sample Caching: Rotary-percussive drill load & tube encapsulation
 * 6. Regional Dust Storm Survival: Beer-Lambert solar extinction & MMRTG power margin
 * 7. Long-Distance Traverse: Closed-system energy conservation & visual odometry uncertainty
 */

export const SIMULATION_MISSIONS = Object.freeze([
  {
    id: 'm01_first_drive',
    code: 'SOL 38 CHECKOUT',
    title: 'First Drive: Mobility & Caliper Braking Checkout',
    region: 'jezero',
    physicsTopic: 'Ackermann ICR Steering, Wheel RPM & Low-Gravity Caliper Braking (g = 3.71 m/s²)',
    objectives: [
      { id: 'steer_check', desc: 'Execute 4-corner Ackermann steering test', target: 1, current: 0 },
      { id: 'reach_alpha', desc: 'Reach Calibration Alpha beacon', target: 1, current: 0 },
      { id: 'reach_beta', desc: 'Reach Craterlet Rim Beta beacon', target: 1, current: 0 },
      { id: 'station_gamma_stop', desc: 'Station Gamma complete stop (< 0.25 m/s)', target: 1, current: 0 }
    ],
    energyBudgetJoules: 1.8e5,
    rewardCredits: 180
  },
  {
    id: 'm02_ancient_delta',
    code: 'SOL 42 DELTA',
    title: 'Ancient Delta: Multi-Terrain Terramechanics',
    region: 'delta',
    physicsTopic: 'Bekker Sinkage & Traction Comparison Across Sand, Regolith & Sedimentary Bedrock',
    objectives: [
      { id: 'sand_sinkage_test', desc: 'Traverse aeolian sand (measure sinkage > 2.0 cm)', target: 1, current: 0 },
      { id: 'bedrock_traverse', desc: 'Traverse sedimentary bench (traction limit > 2000 N)', target: 1, current: 0 },
      { id: 'delta_vista_photo', desc: 'Reach Delta Overlook and acquire Mastcam-Z panorama', target: 1, current: 0 }
    ],
    energyBudgetJoules: 3.5e5,
    rewardCredits: 260
  },
  {
    id: 'm03_analyze_rocks',
    code: 'SOL 50 SUPERCAM',
    title: 'SuperCam LIBS Elemental Spectroscopy Survey',
    region: 'plains',
    physicsTopic: 'Pulsed 1064nm LIBS Elemental Spectroscopy (Si, Fe, Mg, Ca, Al, Na) & Stand-Off SNR',
    objectives: [
      { id: 'libs_target_1', desc: 'Target 1: Fire SuperCam LIBS at igneous basalt', target: 1, current: 0 },
      { id: 'libs_target_2', desc: 'Target 2: Fire SuperCam LIBS at clay mudstone', target: 1, current: 0 },
      { id: 'libs_target_3', desc: 'Target 3: Fire SuperCam LIBS at carbonate rock', target: 1, current: 0 }
    ],
    energyBudgetJoules: 2.2e5,
    rewardCredits: 300
  },
  {
    id: 'm04_dangerous_slopes',
    code: 'SOL 65 RIM ASCENT',
    title: 'Dangerous Slopes: Grade Shear & SSF Rollover Margin',
    region: 'rim',
    physicsTopic: 'Downhill Gravity Component (mg·sin θ), Mohr-Coulomb Traction Limit & Rollover Margin',
    objectives: [
      { id: 'switchback_1', desc: 'Climb Switchback Gate 01 on 15° slope', target: 1, current: 0 },
      { id: 'rim_saddle', desc: 'Traverse Rim Saddle with Rollover Margin > 35%', target: 1, current: 0 },
      { id: 'summit_relay', desc: 'Ascend to Crater Rim Summit Relay without high-centering', target: 1, current: 0 }
    ],
    energyBudgetJoules: 4.8e5,
    rewardCredits: 360
  },
  {
    id: 'm05_collect_samples',
    code: 'SOL 82 CACHE',
    title: 'Scientific Sampling: Rotary-Percussive Coring & Hermetic Caching',
    region: 'jezero',
    physicsTopic: 'Rotary-Percussive Coring Load (85W), 60mm Penetration & Titanium Tube Caching',
    objectives: [
      { id: 'core_sample_1', desc: 'Extract and seal core sample 01 (60 mm depth)', target: 1, current: 0 },
      { id: 'core_sample_2', desc: 'Extract and seal core sample 02 (60 mm depth)', target: 1, current: 0 },
      { id: 'deliver_cache', desc: 'Deliver sealed sample tubes to Sample Cache Depot', target: 1, current: 0 }
    ],
    energyBudgetJoules: 4.2e5,
    rewardCredits: 450
  },
  {
    id: 'm06_dust_storm',
    code: 'SOL 114 DUST STORM',
    title: 'Dust Storm Survival: Beer-Lambert Optical Depth & Power Margins',
    region: 'dunes',
    physicsTopic: 'Beer-Lambert Solar Attenuation (τ > 3.5), Dune Slip-Sinkage & Safe Mode Avoidance',
    objectives: [
      { id: 'storm_traverse', desc: 'Navigate through storm corridor with Headlights active', target: 1, current: 0 },
      { id: 'precision_creep', desc: 'Use Precision Creep gear [X] to limit dune wheel slip < 50%', target: 1, current: 0 },
      { id: 'shelter_hold', desc: 'Hold at High-Ground Solar Shelter for 20s with Battery SOC > 15%', target: 20, current: 0 }
    ],
    energyBudgetJoules: 3.8e5,
    rewardCredits: 520
  },
  {
    id: 'm07_long_expedition',
    code: 'SOL 145 ENDURANCE',
    title: 'Long-Distance Expedition: Systems Mastery & Energy Closure',
    region: 'highlands',
    physicsTopic: 'Integrated Energy Budgeting, Closed-System Closure (<1%) & Navcam Visual Odometry',
    objectives: [
      { id: 'valley_gate', desc: 'Pass Northern Valley Gate', target: 1, current: 0 },
      { id: 'gorge_pass', desc: 'Traverse Noachian Gorge Pass', target: 1, current: 0 },
      { id: 'vo_fix', desc: 'Perform at least 2 Navcam Visual Odometry fixes [L]', target: 2, current: 0 },
      { id: 'outpost_arrival', desc: 'Reach Highland Research Outpost (350m traverse) with Energy Residual < 1%', target: 1, current: 0 }
    ],
    energyBudgetJoules: 6.5e5,
    rewardCredits: 750
  }
]);

export class PureSimMissionTracker {
  constructor() {
    this.activeMission = null;
    this.completedMissions = new Set();
  }

  startMission(missionId) {
    const def = SIMULATION_MISSIONS.find(m => m.id === missionId);
    if (!def) return null;
    this.activeMission = JSON.parse(JSON.stringify(def));
    return this.activeMission;
  }

  isMissionCompleted() {
    if (!this.activeMission) return false;
    return this.activeMission.objectives.every(o => o.current >= o.target);
  }
}
