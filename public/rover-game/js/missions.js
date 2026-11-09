import * as THREE from 'three';

/**
 * Contextual Educational Planetary Robotics & Physics Concept Cards
 * Triggered automatically when the player encounters each physical phenomenon during gameplay.
 */
export const PHYSICS_CONCEPT_CARDS = {
  ackermann_icr: {
    id: 'ackermann_icr',
    title: '4-CORNER ACKERMANN STEERING & ICR',
    equation: 'δ_in = atan(L / (R − W/2))  •  δ_out = atan(L / (R + W/2))',
    body: 'Notice how FL/FR steer forward while RL/RR counter-steer! Because middle wheels (ML/MR) have no steering actuators, all 4 corner wheels align tangent to concentric circles around an Instantaneous Center of Rotation (ICR) on the middle axle line—eliminating lateral soil scrubbing.'
  },
  rocker_bogie: {
    id: 'rocker_bogie',
    title: 'PASSIVE ROCKER-BOGIE DIFFERENTIAL SUSPENSION',
    equation: 'θ_chassis ≈ ½ (θ_rocker,L + θ_rocker,R)',
    body: 'Perseverance uses zero chassis springs! Left and right titanium rockers connect across the top deck via a mechanical differential bar: when one front wheel climbs a 35 cm rock, chassis pitch changes by only half the wheel lift, equalizing normal force F_N across all 6 wheels.'
  },
  bekker_sand_slip: {
    id: 'bekker_sand_slip',
    title: 'BEKKER-WONG SINKAGE & SLIP-DIGGING IN SAND',
    equation: 'z = z₀(F_N) · (1 + k_s |s|)  •  F_rr = f_r(z) · F_N',
    body: 'Loose aeolian sand deforms under normal load F_N, increasing compaction rolling resistance. Worse, high wheel slip |s| excavates grains beneath the cleats (slip-sinkage)! Ease off Boost or engage Precision Creep [X] to climb dunes without digging in.'
  },
  slope_gravity_shear: {
    id: 'slope_gravity_shear',
    title: 'SLOPE GRAVITY SHEAR & ROLLOVER STABILITY',
    equation: 'F_g,∥ = m · g · sin(θ)  ≤  Σ (c·A_c + F_N·tan φ)',
    body: 'On a 20° Martian slope, gravity pulls the 1025 kg rover downhill with ~1,300 N of continuous shear while reducing normal force F_N = mg·cos(θ) by 6%! Press [V] to visualize the orange downhill shear arrow vs. wheel traction limits.'
  },
  libs_spectroscopy: {
    id: 'libs_spectroscopy',
    title: 'SUPERCAM 1064nm PULSED LIBS PLASMA PHYSICS',
    equation: 'Plasma T ≈ 10,000 K  •  P_Mars ≈ 600–770 Pa CO₂',
    body: 'Mars’s thin ~700 Pa atmospheric pressure allows the 1064 nm laser plasma plume to expand to optimal optical density without stark self-absorption, revealing atomic emission lines for Si, Fe, Mg, Ca, Al, and Na up to 7–9 meters away!'
  },
  dust_beer_lambert: {
    id: 'dust_beer_lambert',
    title: 'BEER-LAMBERT DUST ATTENUATION & VO DRIFT',
    equation: 'I = S₀ · sin(α) · exp(−τ / sin α)  •  σ_pos ↑',
    body: 'Regional dust storms spike atmospheric optical depth τ from ~0.4 to >4.0, exponentially cutting direct solar irradiance and blinding Navcam Visual Odometry landmarks. Watch your Battery Endurance and press [L] when stopped to recalibrate localization!'
  },
  rotary_coring: {
    id: 'rotary_coring',
    title: 'ROTARY-PERCUSSIVE CORING & POWER BUDGET',
    equation: 'P_drill ≈ 380–450 W  •  Core = Ø13 mm × 63.5 mm',
    body: 'Extracting an intact rock core draws ~400 W—nearly 6× resting avionics power! The turret preloads stabilizers against the outcrop so percussive hammer blows fracture competent rock without shifting the rover chassis.'
  }
};

export const MISSIONS_CATALOG = [
  {
    id: 'm01_first_drive',
    code: 'MISSION 01',
    title: 'First Drive: Mobility & Braking Checkout',
    region: 'jezero',
    difficulty: 'Easy',
    rewardCredits: 180,
    unlockLivery: 'jpl_gold',
    physicsTopic: 'Ackermann ICR Steering, Wheel RPM & Low-Gravity Caliper Braking (g = 3.71 m/s²)',
    briefing: 'Perform engineering mobility checkout across Octavia E. Butler Landing Site. Test 4-corner Ackermann steering [A/D], observe wheel torque & RPM in Telemetry [T], navigate 3 beacons, and execute a full brake stop (<0.35 m/s) at Station Gamma.',
    waypoints: [
      { x: 0, z: -22, radius: 5.5, label: 'Calibration Alpha' },
      { x: -10, z: -54, radius: 5.5, label: 'Craterlet Rim Beta' },
      { x: -18, z: -90, radius: 6.0, label: 'Checkout Station Gamma', requireStop: true }
    ],
    requireScans: 0,
    requireSamples: 0,
    requirePhotos: 0,
    requireDistance: 0,
    requireSoilCount: 0,
    stormMission: false
  },
  {
    id: 'm02_ancient_delta',
    code: 'MISSION 02',
    title: 'Ancient Delta: Multi-Terrain Terramechanics',
    region: 'delta',
    difficulty: 'Moderate',
    rewardCredits: 260,
    physicsTopic: 'Bekker Sinkage & Traction Comparison Across Sand, Regolith & Sedimentary Bedrock',
    briefing: 'Traverse the Western Fluvial Delta! Sample wheel-terrain interaction across at least 2 distinct soil profiles (compare Fine Sand sinkage in the paleochannel vs. Bedrock traction on the upper bench), and capture a Mastcam-Z verification image [P] at the Overlook.',
    waypoints: [
      { x: 8, z: -42, radius: 6.5, label: 'Paleochannel Floor (Sand/Regolith)' },
      { x: -20, z: -96, radius: 6.5, label: 'Sedimentary Bench (Bedrock)' },
      { x: 12, z: -148, radius: 7.5, label: 'Delta Overlook Vista' }
    ],
    requireScans: 0,
    requireSamples: 0,
    requirePhotos: 1,
    requireDistance: 0,
    requireSoilCount: 2,
    stormMission: false
  },
  {
    id: 'm03_analyze_rocks',
    code: 'MISSION 03',
    title: 'Analyze Three Rocks: SuperCam LIBS Survey',
    region: 'plains',
    difficulty: 'Moderate',
    rewardCredits: 300,
    physicsTopic: 'Pulsed 1064nm LIBS Elemental Spectroscopy (Si, Fe, Mg, Ca, Al, Na) & Stand-Off SNR',
    briefing: 'Survey the Máaz Hard Basalt strewnfield. Approach 3 geological targets within 9.5m, activate SuperCam LIBS [E], and inspect simulated elemental compositions and atmospheric observation conditions in the Science Log.',
    waypoints: [],
    requireScans: 3,
    requireSamples: 0,
    requirePhotos: 0,
    requireDistance: 0,
    requireSoilCount: 0,
    stormMission: false
  },
  {
    id: 'm04_dangerous_slopes',
    code: 'MISSION 04',
    title: 'Dangerous Slopes: Grade Shear & Stability',
    region: 'rim',
    difficulty: 'Hard',
    rewardCredits: 360,
    unlockLivery: 'ares_red',
    physicsTopic: 'Downhill Gravity Component (mg·sin θ), Mohr-Coulomb Traction Limit & Rollover Margin',
    briefing: 'Ascend the steep Crater Rim switchbacks! Toggle Physics Viz [V] or Slope Hazard [▲ SLOPE] to balance downhill gravity shear against wheel slip, keep Rollover Stability > 35% and Hull Integrity >= 50%, and reach the Summit Relay.',
    waypoints: [
      { x: 10, z: -45, radius: 6.5, label: 'Switchback Gate 01' },
      { x: -14, z: -98, radius: 6.5, label: 'Rim Saddle Crest' },
      { x: 6, z: -156, radius: 7.0, label: 'Crater Rim Summit Relay' }
    ],
    requireScans: 0,
    requireSamples: 0,
    requirePhotos: 0,
    requireDistance: 0,
    requireSoilCount: 0,
    stormMission: false
  },
  {
    id: 'm05_collect_samples',
    code: 'MISSION 05',
    title: 'Scientific Sampling: Coring Power & Caching',
    region: 'jezero',
    difficulty: 'Moderate – Hard',
    rewardCredits: 450,
    physicsTopic: '420W Rotary-Percussive Coring Load, 63.5mm Penetration & Hermetic Tube Caching',
    briefing: 'Scan outcrops with SuperCam [E], park steady within 5.0m of sample-grade outcrops, and operate the 420W Coring Drill [E] while monitoring bus voltage & power draw to seal 3 Titanium Sample Tubes—then deliver them to the Sample Cache Depot.',
    waypoints: [
      { x: -12, z: -135, radius: 7.0, label: 'Sample Cache Depot', afterCollectionsOnly: true }
    ],
    requireScans: 0,
    requireSamples: 3,
    requirePhotos: 0,
    requireDistance: 0,
    requireSoilCount: 0,
    stormMission: false
  },
  {
    id: 'm06_dust_storm',
    code: 'MISSION 06',
    title: 'Dust Storm Survival: Optical Depth & Energy',
    region: 'dunes',
    difficulty: 'Hard',
    rewardCredits: 520,
    unlockLivery: 'carbon_ops',
    physicsTopic: 'Beer-Lambert Solar Attenuation, Dune Slip-Sinkage & Dead-Reckoning Navigation',
    briefing: 'REGIONAL DUST STORM ACTIVE (τ > 3.8)! Solar irradiance is severely attenuated and soft Dunes cause high wheel slip & odometry drift. Use Headlights [F] and Precision Creep [X] to cross the dunes, reach the Solar Shelter, and hold 20s above 1% battery!',
    waypoints: [
      { x: -16, z: -56, radius: 7.5, label: 'Storm Corridor Marker' },
      { x: 14, z: -116, radius: 9.0, label: 'High-Ground Solar Shelter', holdSeconds: 20 }
    ],
    requireScans: 0,
    requireSamples: 0,
    requirePhotos: 0,
    requireDistance: 0,
    requireSoilCount: 0,
    stormMission: true
  },
  {
    id: 'm07_long_expedition',
    code: 'MISSION 07',
    title: 'Long-Distance Expedition: Systems Mastery',
    region: 'highlands',
    difficulty: 'Expert',
    rewardCredits: 750,
    physicsTopic: 'Integrated Energy Budgeting, Localization Uncertainty Control & Multi-Pass Traverse',
    briefing: 'Complete a 350m scientific traverse through the Noachian Rocky Highlands! Navigate all 3 mountain pass beacons, extract 1 sealed rock core, capture 1 Mastcam-Z observation [P], and keep localization uncertainty controlled (press [L] when stopped if drift rises).',
    waypoints: [
      { x: -20, z: -85, radius: 7.5, label: 'Northern Valley Gate' },
      { x: 24, z: -180, radius: 8.0, label: 'Noachian Gorge Pass' },
      { x: -8, z: -285, radius: 8.5, label: 'Highland Research Outpost' }
    ],
    requireScans: 0,
    requireSamples: 1,
    requirePhotos: 1,
    requireDistance: 350,
    requireSoilCount: 0,
    stormMission: false
  }
];

const SAVE_STORAGE_KEY = 'mars_rover_expedition_save_v2';

/**
 * Mission Gameplay Controller, Educational Physics Tutor, 3D Beacon Renderer & LocalStorage Persistence
 */
export class MissionManager {
  constructor(scene, world, atmosphere, audio) {
    this.scene = scene;
    this.world = world;
    this.atmosphere = atmosphere;
    this.audio = audio;

    this.activeMission = null;
    this.completedMissions = new Set();
    this.unlockedLiveries = new Set(['nasa_white']);
    this.seenConcepts = new Set();

    // Live mission tracking counters
    this.wpIndex = 0;
    this.startScans = 0;
    this.startSamples = 0;
    this.startPhotos = 0;
    this.startDistance = 0;
    this.holdTimer = 0;
    this.soilsExperienced = new Set();

    this.onMissionCompleted = null;
    this.onObjectiveUpdated = null;
    this.onConceptUnlocked = null; // Contextual physics education callback!
    this._conceptCooldown = 0;

    this._buildBeaconVisual();
  }

  _buildBeaconVisual() {
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.visible = false;

    const ringGeo = new THREE.RingGeometry(4.2, 4.65, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.beaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.beaconRing = new THREE.Mesh(ringGeo, this.beaconRingMat);

    const pillarGeo = new THREE.CylinderGeometry(1.1, 2.8, 38, 24, 1, true);
    pillarGeo.translate(0, 19, 0);
    this.beaconPillarMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.beaconPillar = new THREE.Mesh(pillarGeo, this.beaconPillarMat);

    this.beaconGroup.add(this.beaconRing, this.beaconPillar);
    this.scene.add(this.beaconGroup);
  }

  startMission(missionId, science, simulation) {
    const def = MISSIONS_CATALOG.find((m) => m.id === missionId);
    if (!def) {
      this.clearMission();
      return null;
    }

    this.activeMission = def;
    this.wpIndex = 0;
    this.holdTimer = 0;
    this.soilsExperienced = new Set();
    this.startScans = science.scannedCount;
    this.startSamples = science.samplesCollected.length;
    this.startPhotos = science.photos.length;
    this.startDistance = simulation.totalDistanceM;

    if (def.stormMission) {
      this.atmosphere.triggerDustStorm(0.90);
    } else {
      this.atmosphere.clearDustStorm();
    }

    this._syncBeaconPosition();
    return def;
  }

  clearMission() {
    this.activeMission = null;
    this.beaconGroup.visible = false;
    this.atmosphere.clearDustStorm();
  }

  _syncBeaconPosition() {
    if (!this.activeMission) {
      this.beaconGroup.visible = false;
      return;
    }
    const wps = this.activeMission.waypoints;
    if (this.wpIndex < wps.length) {
      const wp = wps[this.wpIndex];
      const y = this.world.getElevationAt(wp.x, wp.z);
      this.beaconGroup.position.set(wp.x, y + 0.08, wp.z);
      const scale = wp.radius / 4.5;
      this.beaconRing.scale.set(scale, 1, scale);
      this.beaconGroup.visible = true;
    } else {
      this.beaconGroup.visible = false;
    }
  }

  getNavigationTarget(science, roverPos) {
    if (!this.activeMission) return null;
    const m = this.activeMission;

    const scansDone = science.scannedCount - this.startScans;
    const samplesDone = science.samplesCollected.length - this.startSamples;

    if (this.wpIndex < m.waypoints.length) {
      const wp = m.waypoints[this.wpIndex];
      if (wp.afterCollectionsOnly && samplesDone < m.requireSamples) {
        return this._findNearestScienceObjective(science, roverPos, true);
      }
      return { x: wp.x, z: wp.z, label: wp.label };
    }

    if (scansDone < m.requireScans) {
      return this._findNearestScienceObjective(science, roverPos, false);
    }
    if (samplesDone < m.requireSamples) {
      return this._findNearestScienceObjective(science, roverPos, true);
    }
    return null;
  }

  _findNearestScienceObjective(science, roverPos, needSample) {
    let best = null;
    let bestD = Infinity;
    for (const t of science.targets) {
      const valid = needSample ? (t.mineral.canSample && !t.sampled) : !t.scanned;
      if (!valid) continue;
      const d = Math.hypot(t.position.x - roverPos.x, t.position.z - roverPos.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (!best) return null;
    return {
      x: best.position.x,
      z: best.position.z,
      label: `${best.code} (${best.mineral.name.split(' ')[0]})`
    };
  }

  /**
   * Triggers contextual educational physics callouts when new phenomena occur
   */
  notifyConceptEvent(conceptId) {
    if (this.seenConcepts.has(conceptId) || this._conceptCooldown > 0) return;
    const card = PHYSICS_CONCEPT_CARDS[conceptId];
    if (!card) return;
    this.seenConcepts.add(conceptId);
    this._conceptCooldown = 14.0; // Don't spam back-to-back lessons
    if (this.onConceptUnlocked) {
      this.onConceptUnlocked(card);
    }
  }

  _evaluateEducationalTriggers(dt, physics, science, simulation) {
    if (this._conceptCooldown > 0) {
      this._conceptCooldown = Math.max(0, this._conceptCooldown - dt);
      return;
    }

    if (Math.abs(physics.steerAngle) > 0.24 && physics.speedMagnitude > 1.2) {
      this.notifyConceptEvent('ackermann_icr');
    } else if (Math.abs(physics.rockerAngleLeft - physics.rockerAngleRight) > 0.11 || Math.abs(physics.bogieAngleLeft) > 0.15) {
      this.notifyConceptEvent('rocker_bogie');
    } else if (physics.averageSlip > 0.36 && physics.averageSinkageCm > 1.8) {
      this.notifyConceptEvent('bekker_sand_slip');
    } else if (physics.slopeDeg > 14.5) {
      this.notifyConceptEvent('slope_gravity_shear');
    } else if (simulation && simulation.dustOpticalDepth > 1.6) {
      this.notifyConceptEvent('dust_beer_lambert');
    } else if (science && science.drillOperation) {
      this.notifyConceptEvent('rotary_coring');
    }
  }

  /**
   * Evaluates live mission progression every frame
   */
  update(dt, physics, science, simulation) {
    this._evaluateEducationalTriggers(dt, physics, science, simulation);

    if (!this.activeMission) return null;
    const m = this.activeMission;

    if (physics.speedMagnitude > 0.4 && physics.currentSoil) {
      this.soilsExperienced.add(physics.currentSoil);
    }

    if (this.beaconGroup.visible) {
      const pulse = 0.72 + 0.25 * Math.sin(performance.now() * 0.004);
      this.beaconRingMat.opacity = pulse;
    }

    const scansDone = Math.min(m.requireScans, science.scannedCount - this.startScans);
    const samplesDone = Math.min(m.requireSamples, science.samplesCollected.length - this.startSamples);
    const photosDone = Math.min(m.requirePhotos, science.photos.length - this.startPhotos);
    const distDone = Math.min(m.requireDistance, simulation.totalDistanceM - this.startDistance);
    const reqSoils = m.requireSoilCount || 0;
    const soilsDone = Math.min(reqSoils, this.soilsExperienced.size);

    if (this.wpIndex < m.waypoints.length) {
      const wp = m.waypoints[this.wpIndex];
      const canTriggerWp = !wp.afterCollectionsOnly || samplesDone >= m.requireSamples;
      this.beaconGroup.visible = canTriggerWp;

      if (canTriggerWp) {
        const d = Math.hypot(physics.position.x - wp.x, physics.position.z - wp.z);
        if (d <= wp.radius) {
          if (wp.holdSeconds) {
            this.holdTimer += dt;
            if (this.holdTimer >= wp.holdSeconds && simulation.batteryPct > 0.5) {
              this.wpIndex++;
              this.holdTimer = 0;
              this.atmosphere.clearDustStorm();
              this.audio.playWaypointChime(false);
              this._syncBeaconPosition();
            }
          } else if (wp.requireStop) {
            if (physics.speedMagnitude < 0.35) {
              this.wpIndex++;
              this.audio.playWaypointChime(false);
              this._syncBeaconPosition();
            }
          } else {
            this.wpIndex++;
            this.audio.playWaypointChime(false);
            this._syncBeaconPosition();
          }
        } else if (wp.holdSeconds) {
          this.holdTimer = Math.max(0, this.holdTimer - dt * 0.5);
        }
      }
    }

    const allWpsDone = this.wpIndex >= m.waypoints.length;
    const allScansDone = scansDone >= m.requireScans;
    const allSamplesDone = samplesDone >= m.requireSamples;
    const allPhotosDone = photosDone >= m.requirePhotos;
    const allDistDone = distDone >= m.requireDistance;
    const allSoilsDone = soilsDone >= reqSoils;
    const hullOk = m.id !== 'm04_dangerous_slopes' || physics.hullIntegrity >= 50;

    if (allWpsDone && allScansDone && allSamplesDone && allPhotosDone && allDistDone && allSoilsDone && hullOk) {
      const completedMission = m;
      const firstTime = !this.completedMissions.has(m.id);
      this.completedMissions.add(m.id);
      science.scienceCredits += firstTime ? m.rewardCredits : Math.round(m.rewardCredits * 0.35);

      if (m.unlockLivery) {
        this.unlockedLiveries.add(m.unlockLivery);
      }

      this.activeMission = null;
      this.beaconGroup.visible = false;
      this.atmosphere.clearDustStorm();
      this.audio.playWaypointChime(true);

      if (this.onMissionCompleted) {
        this.onMissionCompleted(completedMission, firstTime);
      }
      return null;
    }

    const lines = [];
    if (m.waypoints.length > 0) {
      if (this.wpIndex < m.waypoints.length) {
        const wp = m.waypoints[this.wpIndex];
        if (wp.afterCollectionsOnly && samplesDone < m.requireSamples) {
          lines.push(`Depot locked until ${m.requireSamples} cores sealed`);
        } else if (wp.holdSeconds) {
          lines.push(`Hold at ${wp.label}: ${Math.min(wp.holdSeconds, this.holdTimer).toFixed(0)}/${wp.holdSeconds}s`);
        } else if (wp.requireStop) {
          lines.push(`Reach & Full Brake Stop at ${wp.label} (${this.wpIndex}/${m.waypoints.length})`);
        } else {
          lines.push(`Reach ${wp.label} (${this.wpIndex}/${m.waypoints.length})`);
        }
      } else {
        lines.push(`Waypoints (${m.waypoints.length}/${m.waypoints.length}) ✓`);
      }
    }
    if (reqSoils > 0) lines.push(`Terrains Sampled: ${soilsDone}/${reqSoils}`);
    if (m.requireScans > 0) lines.push(`LIBS Scans [E]: ${scansDone}/${m.requireScans}`);
    if (m.requireSamples > 0) lines.push(`Core Tubes [E]: ${samplesDone}/${m.requireSamples}`);
    if (m.requirePhotos > 0) lines.push(`Mastcam Photo [P]: ${photosDone}/${m.requirePhotos}`);
    if (m.requireDistance > 0) lines.push(`Traverse: ${Math.floor(distDone)}/${m.requireDistance} m`);

    return {
      code: m.code,
      title: m.title,
      physicsTopic: m.physicsTopic,
      objectivesText: lines.join(' • ')
    };
  }

  saveProgress(extraState = {}) {
    try {
      const payload = {
        version: 3,
        savedAt: Date.now(),
        completedMissions: Array.from(this.completedMissions),
        unlockedLiveries: Array.from(this.unlockedLiveries),
        seenConcepts: Array.from(this.seenConcepts),
        activeMissionId: this.activeMission ? this.activeMission.id : null,
        ...extraState
      };
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (_) {
      return false;
    }
  }

  loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data.completedMissions)) {
        this.completedMissions = new Set(data.completedMissions);
      }
      if (Array.isArray(data.unlockedLiveries)) {
        data.unlockedLiveries.forEach((l) => this.unlockedLiveries.add(l));
      }
      if (Array.isArray(data.seenConcepts)) {
        this.seenConcepts = new Set(data.seenConcepts);
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  hasSavedGame() {
    try {
      return !!localStorage.getItem(SAVE_STORAGE_KEY);
    } catch (_) {
      return false;
    }
  }

  clearSavedGame() {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch (_) {
      // ignore
    }
    this.completedMissions.clear();
    this.seenConcepts.clear();
    this.unlockedLiveries = new Set(['nasa_white']);
  }
}
