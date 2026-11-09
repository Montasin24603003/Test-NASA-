import * as THREE from 'three';
import { GraphicsManager } from './graphics.js';
import { MARS_REGIONS } from './regions.js';
import { MarsWorld } from './world.js';
import { MarsAtmosphere } from './atmosphere.js';
import { MarsParticles } from './particles.js';
import { RoverPhysicsEngine } from './physics.js';
import { MarsRover } from './rover.js';
import { InputController } from './input.js';
import { CameraManager } from './cameraManager.js';
import { ScienceExplorationSystem } from './science.js';
import { MissionManager, MISSIONS_CATALOG } from './missions.js';
import { MarsSimulation } from './simulation.js';
import { MarsAudio } from './audio.js';
import { GameUI, GARAGE_UPGRADES } from './ui.js';
import { TrajectoryManager } from './trajectory.js';
import { RoverNavigationSystem } from './navigation.js';
import { PhysicsVisualizer } from './physicsViz.js';
import { EngineeringTelemetryUI } from './telemetryUI.js';
import { checkAndRunInBrowserTests } from './testRunnerUI.js';

/**
 * Master Standalone & Embeddable 3D Mars Rover Exploration & Planetary Robotics Simulation Controller
 * Designed for direct standalone browser play AND seamless Phase 2 mounting at /rover-game.
 */
export class RoverExpeditionGame {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('webgl-container');
    this.onExitToMap = options.onExitToMap || null;

    this.currentRegionId = 'jezero';
    this.currentLivery = 'nasa_white';
    this.upgradeLevels = { traction: 0, battery: 0, solar: 0, suspension: 0 };
    this.hasStartedSession = false;
    this.isGameplayActive = false;
    this.simPaused = false;
    this.showNasaCorridor = true;

    this._clock = new THREE.Clock();
    this._autoSaveTimer = 0;
    this._rightVec = new THREE.Vector3();
    this._lastMissionState = null;
    this._lastNavTarget = null;

    this._boot();
  }

  _boot() {
    try {
      // 1. Graphics & WebGL Renderer
      this.graphics = new GraphicsManager(this.container, 'high');

      // 2. Mars Open-World Chunked Terrain & GPU Instanced Rocks
      this.world = new MarsWorld(this.graphics.scene, this.graphics.preset, this.currentRegionId);

      // 3. Martian Atmosphere, Day/Night Sol Cycle & Dust Storms
      this.atmosphere = new MarsAtmosphere(this.graphics.scene, this.graphics.preset);
      this.atmosphere.setRegionAtmosphere(MARS_REGIONS[this.currentRegionId]);

      // 4. GPU Particle Effects (Wheel Dust, Storm Swirl, LIBS Laser)
      this.particles = new MarsParticles(this.graphics.scene, this.graphics.preset);

      // 5. 6-DOF Rigid-Body & 6-Wheel Rocker-Bogie Physics Engine
      this.physics = new RoverPhysicsEngine(this.world);

      // 6. Detailed Articulated Perseverance Rover
      this.rover = new MarsRover(this.graphics.scene, this.graphics.preset);

      // 7. Preserved NASA PDS/SPICE Sols 38-44 Reference Corridor (active in Jezero Crater)
      this.nasaTrajectory = new TrajectoryManager();
      this.nasaTrajectory.alignToTerrain((x, z) => this.world.getElevationAt(x, z));
      this.graphics.scene.add(this.nasaTrajectory.pathLine);
      this.graphics.scene.add(this.nasaTrajectory.waypointMarkers);

      // 8. Audio, Simulation, Localization/IMU, 3D Physics Visualizer, Science & Missions
      this.audio = new MarsAudio();
      this.simulation = new MarsSimulation();
      this.navigation = new RoverNavigationSystem(this.world);
      this.physicsViz = new PhysicsVisualizer(this.graphics.scene, this.world);
      this.science = new ScienceExplorationSystem(this.graphics.scene, this.world);
      this.science.populateRegionTargets(this.currentRegionId);
      this.missions = new MissionManager(this.graphics.scene, this.world, this.atmosphere, this.audio);

      // 9. Input & 6-Mode Smooth Camera System
      this.input = new InputController(this.graphics.renderer.domElement);
      this.cameraManager = new CameraManager(
        this.graphics.camera,
        this.graphics.renderer,
        this.rover,
        this.world
      );

      // Spawn rover cleanly at Jezero Landing Site
      const sp = MARS_REGIONS[this.currentRegionId].spawn;
      this.physics.spawnAt(sp.x, sp.z, sp.heading);
      this.rover.syncFromPhysics(this.physics, this.input.state, 0.016, null);
      this.simulation.resetForExpedition(this.physics.position, this.currentRegionId);
      this.navigation.resetForRegion(this.physics.position, this.currentRegionId);
      this.simulation.update(0.016, this.physics, this.atmosphere, this.rover, this.input.state, this.currentRegionId);
      this.navigation.update(0.016, this.physics, this.simulation, this.atmosphere, null, this.currentRegionId);

      // 10. UI, Expandable Engineering Telemetry Drawer & Full-Screen Engineering Mode
      this.ui = new GameUI(this);
      this.telemetryUI = new EngineeringTelemetryUI(this);
      this.ui.setLoadingProgress(75, 'Calibrating Bekker–Wong Terramechanics, Rocker-Bogie & SuperCam...');
      this.input.bindTouchButtons(document);

      this._wireCallbacks();
      this._restoreSavedMetadata();

      // Compile shaders once to eliminate first-drive frame hitch
      this.graphics.renderer.compile(this.graphics.scene, this.graphics.camera);
      this.ui.setLoadingProgress(100, 'Telemetry Nominal — Ready for Mars Surface Operations');
      setTimeout(() => {
        this.ui.hideLoadingScreen();
        // If launched via iframe with ?autostart=1, engage expedition immediately
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1' || params.get('drive') === '1') {
          this.startNextOrFirstMission();
        }
      }, 280);

      // Parent window command bridge (React Rover Page Integration)
      window.addEventListener('message', (event) => {
        if (!event.data || typeof event.data !== 'object') return;
        const { type, payload } = event.data;
        switch (type) {
          case 'MARS_START_EXPEDITION':
            this.startNextOrFirstMission();
            break;
          case 'MARS_CONTINUE_DRIVE':
            this.continueSavedExploration();
            break;
          case 'MARS_SET_CAMERA':
            if (payload && payload.mode) {
              const cfg = this.cameraManager.setMode(payload.mode);
              this.ui.updateCameraBadge(cfg, this.cameraManager.mastcamFov);
            }
            break;
          case 'MARS_CYCLE_CAMERA':
            this.cycleCamera();
            break;
          case 'MARS_RESET_ROVER':
            this.resetRoverUpright();
            break;
          case 'MARS_FIRE_LASER':
            this.triggerInteract();
            break;
          case 'MARS_TOGGLE_LIGHTS':
            this.toggleHeadlights();
            break;
          case 'MARS_DEPLOY_REGION':
            if (payload && payload.regionId) {
              this.deployToRegion(payload.regionId, true);
              this.ui.enterGameplayHUD();
            }
            break;
          case 'MARS_TOGGLE_AUDIO':
            if (this.audio) {
              this.audio.toggleAudio();
            }
            break;
          case 'MARS_INPUT_EVENT':
            if (payload && payload.code) {
              if (payload.type === 'keydown') {
                this.input.keys.add(payload.code);
              } else if (payload.type === 'keyup') {
                this.input.keys.delete(payload.code);
              }
              this.input._syncState();
            }
            break;
          case 'MARS_DRIVE_THROTTLE':
            if (payload) {
              if (typeof payload.forward === 'number') this.input.touchState.forward = payload.forward;
              if (typeof payload.reverse === 'number') this.input.touchState.reverse = payload.reverse;
              if (typeof payload.steerLeft === 'number') this.input.touchState.steerLeft = payload.steerLeft;
              if (typeof payload.steerRight === 'number') this.input.touchState.steerRight = payload.steerRight;
              if (typeof payload.boost === 'boolean') this.input.touchState.boost = payload.boost;
              if (typeof payload.brake === 'boolean') this.input.touchState.brake = payload.brake;
              this.input._syncState();
            }
            break;
        }
      });

      // Start 60 FPS Simulation Loop
      this.graphics.renderer.setAnimationLoop(this._tick.bind(this));
    } catch (err) {
      console.error('RoverExpeditionGame initialization failed:', err);
      const statusEl = document.getElementById('loading-status-text');
      if (statusEl) {
        statusEl.textContent = `Initialization Error: ${err.message}. Please ensure WebGL hardware acceleration is enabled.`;
        statusEl.style.color = '#ff5252';
      }
    }
  }

  _wireCallbacks() {
    // Input discrete actions
    this.input.actions.onCycleCamera = () => this.cycleCamera();
    this.input.actions.onSelectCameraIndex = (idx) => {
      const cfg = this.cameraManager.setModeByIndex(idx);
      this.ui.updateCameraBadge(cfg, this.cameraManager.mastcamFov);
      this.ui.showToast(`Camera: ${cfg.label}`, 1800);
    };
    this.input.actions.onInteract = () => this.triggerInteract();
    this.input.actions.onResetRover = () => this.resetRoverUpright();
    this.input.actions.onToggleHeadlights = () => this.toggleHeadlights();
    this.input.actions.onCapturePhoto = () => this.capturePhoto();
    this.input.actions.onToggleMissions = () => {
      if (this.ui.activeScreen === 'playing') {
        this.ui.openModal('missions');
      } else if (this.ui.activeScreen === 'missions') {
        this.ui.closeModal();
      }
    };
    this.input.actions.onToggleTelemetryDrawer = () => {
      if (this.ui.activeScreen === 'playing') {
        this.telemetryUI.toggleDrawer();
      }
    };
    this.input.actions.onTogglePhysicsViz = () => {
      if (this.ui.activeScreen === 'playing') {
        this.togglePhysicsViz();
      }
    };
    this.input.actions.onToggleEngineeringMode = () => {
      if (this.ui.activeScreen === 'playing') {
        this.telemetryUI.toggleFullScreen();
      }
    };
    this.input.actions.onToggleCreepMode = () => {
      if (this.ui.activeScreen === 'playing') {
        this.toggleCreepMode();
      }
    };
    this.input.actions.onLocalizationFix = () => {
      if (this.ui.activeScreen === 'playing') {
        this.triggerLocalizationFix();
      }
    };
    this.input.actions.onToggleSimPause = () => {
      if (this.ui.activeScreen === 'playing') {
        this.toggleSimulationPause();
      }
    };
    this.input.actions.onTogglePauseMenu = () => {
      if (this.telemetryUI && this.telemetryUI.fullScreenOpen) {
        this.telemetryUI.toggleFullScreen(false);
        return;
      }
      if (this.ui.activeScreen === 'playing') {
        this.ui.openMainMenu();
      } else if (this.ui.activeScreen !== 'menu') {
        this.ui.closeModal();
      } else if (this.hasStartedSession) {
        this.ui.enterGameplayHUD();
      }
    };

    // Physics collision impact feedback
    this.physics.onCollisionCallback = (impactSpeed, pt) => {
      this.audio.playImpact(impactSpeed);
      for (let i = 0; i < 8; i++) {
        this.particles.spawnDust(pt.x, pt.y, pt.z, 0, 0.9, 0, 0.8);
      }
    };

    // Educational planetary robotics concept cards
    this.missions.onConceptUnlocked = (card) => {
      if (this.telemetryUI) {
        this.telemetryUI.showConceptCard(card);
      }
    };

    // Mission completion celebration & auto-save
    this.missions.onMissionCompleted = (mission, firstTime) => {
      const bonus = firstTime ? mission.rewardCredits : Math.round(mission.rewardCredits * 0.35);
      const unlockNote = (firstTime && mission.unlockLivery) ? ' • NEW GARAGE LIVERY UNLOCKED!' : '';
      this.ui.showToast(`★ ${mission.code} COMPLETE: ${mission.title}! (+${bonus} ◈ Credits)${unlockNote}`, 6500);
      this.saveGame();
    };
  }

  _restoreSavedMetadata() {
    const saved = this.missions.loadProgress();
    if (!saved) {
      this.ui.refreshMenuStats();
      return;
    }

    if (typeof saved.scienceCredits === 'number') {
      this.science.scienceCredits = saved.scienceCredits;
    }
    if (Array.isArray(saved.samplesCollected)) {
      this.science.samplesCollected = saved.samplesCollected;
    }
    if (typeof saved.scannedCount === 'number') {
      this.science.scannedCount = saved.scannedCount;
    }
    if (typeof saved.totalDistanceM === 'number') {
      this.simulation.totalDistanceM = saved.totalDistanceM;
    }
    if (Array.isArray(saved.libsObservations)) {
      this.science.libsObservations = saved.libsObservations;
    }
    if (saved.upgradeLevels) {
      this.upgradeLevels = { ...this.upgradeLevels, ...saved.upgradeLevels };
      this._syncUpgradesToSystems();
    }
    if (saved.livery) {
      this.applyLivery(saved.livery, false);
    }
    if (saved.graphicsPreset) {
      this.setGraphicsPreset(saved.graphicsPreset, false);
    }
    if (saved.regionId && MARS_REGIONS[saved.regionId]) {
      this.currentRegionId = saved.regionId;
    }
    this.ui.refreshMenuStats();
  }

  saveGame() {
    this.missions.saveProgress({
      regionId: this.currentRegionId,
      roverPos: {
        x: this.physics.position.x,
        z: this.physics.position.z,
        headingRad: -THREE.MathUtils.degToRad(this.physics.headingDeg)
      },
      batteryPct: this.simulation.batteryPct,
      hullIntegrity: this.physics.hullIntegrity,
      solNumber: this.atmosphere.solNumber,
      solFraction: this.atmosphere.solFraction,
      scienceCredits: this.science.scienceCredits,
      scannedCount: this.science.scannedCount,
      samplesCollected: this.science.samplesCollected,
      libsObservations: this.science.libsObservations,
      totalDistanceM: this.simulation.totalDistanceM,
      upgradeLevels: this.upgradeLevels,
      livery: this.currentLivery,
      graphicsPreset: this.graphics.currentPresetKey
    });
  }

  resetAllSaveData() {
    this.missions.clearSavedGame();
    this.science.scienceCredits = 0;
    this.science.scannedCount = 0;
    this.science.samplesCollected = [];
    this.science.photos = [];
    this.simulation.totalDistanceM = 0;
    this.upgradeLevels = { traction: 0, battery: 0, solar: 0, suspension: 0 };
    this._syncUpgradesToSystems();
    this.applyLivery('nasa_white', false);
    this.hasStartedSession = false;
    this.ui.refreshMenuStats();
  }

  setGameplayActive(active, showcaseMode = 'none') {
    this.isGameplayActive = active;
    this.input.setEnabled(active);
    this.input.allowEngineeringHotkeys = active || (this.telemetryUI && this.telemetryUI.fullScreenOpen);
    this.cameraManager.setShowcaseMode(showcaseMode);
    if (!active) {
      this.audio.update(0, 0, this.atmosphere.stormIntensity, 6);
    }
  }

  startNextOrFirstMission() {
    // Pick first uncompleted mission, or Mission 01 if all completed
    const next = MISSIONS_CATALOG.find((m) => !this.missions.completedMissions.has(m.id)) || MISSIONS_CATALOG[0];
    this.launchMission(next.id);
    this.ui.enterGameplayHUD();
  }

  continueSavedExploration() {
    const saved = this.missions.loadProgress();
    if (!saved) {
      this.startNextOrFirstMission();
      return;
    }

    const regId = (saved.regionId && MARS_REGIONS[saved.regionId]) ? saved.regionId : 'jezero';
    this.deployToRegion(regId, false);

    if (saved.roverPos && typeof saved.roverPos.x === 'number') {
      this.world.updateChunks(saved.roverPos.x, saved.roverPos.z, true);
      this.physics.spawnAt(saved.roverPos.x, saved.roverPos.z, saved.roverPos.headingRad ?? 0);
    }
    if (typeof saved.batteryPct === 'number') this.simulation.batteryPct = saved.batteryPct;
    if (typeof saved.hullIntegrity === 'number') this.physics.hullIntegrity = saved.hullIntegrity;
    if (typeof saved.solNumber === 'number') this.atmosphere.solNumber = saved.solNumber;
    if (typeof saved.solFraction === 'number') this.atmosphere.solFraction = saved.solFraction;

    if (saved.activeMissionId) {
      this.missions.startMission(saved.activeMissionId, this.science, this.simulation);
    }

    this.hasStartedSession = true;
    this.ui.enterGameplayHUD();
    this.ui.showToast(`Resumed Expedition in ${MARS_REGIONS[regId].name}`);
  }

  deployToRegion(regionId, clearActiveMission = false) {
    if (!MARS_REGIONS[regionId]) return;
    this.currentRegionId = regionId;
    const regCfg = MARS_REGIONS[regionId];

    if (clearActiveMission) {
      this.missions.clearMission();
    }

    this.world.setRegion(regionId);
    this.atmosphere.setRegionAtmosphere(regCfg);
    this.science.populateRegionTargets(regionId);

    // Show authentic NASA PDS Sols 38-44 trajectory spline only in Jezero Crater
    const showSpline = (regionId === 'jezero') && this.showNasaCorridor;
    this.nasaTrajectory.pathLine.visible = showSpline;
    this.nasaTrajectory.waypointMarkers.visible = showSpline;
    if (regionId === 'jezero') {
      this.nasaTrajectory.alignToTerrain((x, z) => this.world.getElevationAt(x, z));
    }

    const sp = regCfg.spawn;
    this.physics.spawnAt(sp.x, sp.z, sp.heading);
    this.simulation.resetForExpedition(this.physics.position, regionId);
    this.navigation.resetForRegion(this.physics.position, regionId);
    if (this.physicsViz) this.physicsViz.clearTrajectory();
    this.rover.syncFromPhysics(this.physics, this.input.state, 0.016, null);

    this.hasStartedSession = true;
    this.saveGame();
  }

  launchMission(missionId) {
    const def = MISSIONS_CATALOG.find((m) => m.id === missionId);
    if (!def) return;

    this.deployToRegion(def.region, false);
    this.missions.startMission(missionId, this.science, this.simulation);
    this.hasStartedSession = true;

    if (def.stormMission) {
      this.rover.toggleHeadlights(true);
      this.ui.el.btnLights.classList.add('active');
    }

    this.ui.showToast(`${def.code}: ${def.title} — ${def.briefing.split('.')[0]}.`, 5200);
    this.saveGame();
  }

  cycleCamera() {
    const cfg = this.cameraManager.cycleCamera();
    this.ui.updateCameraBadge(cfg, this.cameraManager.mastcamFov);
    this.ui.showToast(`Camera Mode: ${cfg.label}`, 1600);
  }

  toggleHeadlights() {
    const on = this.rover.toggleHeadlights();
    this.ui.el.btnLights.classList.toggle('active', on);
    this.ui.showToast(on ? 'Rover LED Headlights: ON' : 'Rover LED Headlights: OFF', 1600);
  }

  toggleNasaCorridor() {
    this.showNasaCorridor = !this.showNasaCorridor;
    const vis = this.showNasaCorridor && this.currentRegionId === 'jezero';
    this.nasaTrajectory.pathLine.visible = vis;
    this.nasaTrajectory.waypointMarkers.visible = vis;
    return vis;
  }

  resetRoverUpright() {
    this.physics.recoverUpright();
    this.ui.showToast('Emergency Attitude Thrusters / Recovery Actuated', 2200);
  }

  togglePhysicsViz(force = null) {
    const on = this.physicsViz.setEnabled(force);
    this.telemetryUI.syncPhysVizMasterCheckbox(on);
    const hudBtn = document.getElementById('hud-btn-physviz');
    if (hudBtn) hudBtn.classList.toggle('active', on);
    this.ui.showToast(on ? '3D Physics Vector Visualization: ON [V]' : '3D Physics Vector Visualization: OFF [V]', 1600);
    return on;
  }

  toggleCreepMode(force = null) {
    const on = this.physics.toggleCreepMode(force);
    this.ui.showToast(on ? 'Low-Range Creep Gear Engaged (High-Torque / 0.85 m/s) [X]' : 'Standard Drive Gear Engaged [X]', 1800);
    return on;
  }

  triggerLocalizationFix() {
    const res = this.navigation.performVisualLocalizationFix(this.physics, this.atmosphere);
    if (!res.ok) {
      this.ui.showToast(`⚠ ${res.reason}`, 2400);
    } else {
      this.ui.showToast(`Navcam/Sun-Sensor Fix Locked (±${res.sigmaM.toFixed(2)}m) [L]`, 2800);
    }
    return res;
  }

  toggleSimulationPause() {
    this.simPaused = !this.simPaused;
    if (this.telemetryUI) this.telemetryUI._syncPauseButton();
    this.ui.showToast(this.simPaused ? '⏸ Simulation Paused [K]' : '▶ Simulation Resumed [K]', 1600);
    return this.simPaused;
  }

  stepSimulationOnce() {
    const stepDt = 1.0 / this.physics.fixedStepHz;
    const effectiveControls = {
      ...this.input.state,
      boost: this.input.state.boost && !this.simulation.isOverdriveRestricted()
    };
    this.physics.step(
      stepDt,
      effectiveControls,
      this.simulation.isLowPowerLimp(),
      this.science.solidColliders
    );
    this.rover.syncFromPhysics(this.physics, effectiveControls, stepDt, this.particles);
    this.simulation.update(stepDt, this.physics, this.atmosphere, this.rover, effectiveControls, this.currentRegionId);
    this.navigation.update(stepDt, this.physics, this.simulation, this.atmosphere, this._lastNavTarget, this.currentRegionId);
    this.physicsViz.update(this.physics, this.navigation);
    this.telemetryUI.refreshDrawerNow();
    this.telemetryUI.renderChartsAndSummary();
    this.ui.showToast(`+1 Step (${(stepDt * 1000).toFixed(1)} ms) Executed`, 1200);
  }

  triggerInteract() {
    const report = this.science.interact(this.rover, this.particles, this.audio, this.simulation, {
      asyncDrill: true,
      atmosphere: this.atmosphere
    });
    if (!report) {
      this.ui.showToast('No geological target within SuperCam 9.5m range', 1800);
      return;
    }
    if (report.action === 'SCAN_COMPLETE') {
      this.missions.notifyConceptEvent('libs_spectroscopy');
    }
    this.ui.showScienceReport(report);
    this.saveGame();
  }

  async capturePhoto() {
    const regName = MARS_REGIONS[this.currentRegionId].name;
    const camLabel = this.cameraManager.getCurrentConfig().label;
    const focalMm = (this.cameraManager.mode === 'mastcam')
      ? Math.round(34 * (44 / Math.max(14, this.cameraManager.mastcamFov)))
      : 34;

    await this.science.capturePhoto(
      this.graphics,
      regName,
      this.atmosphere.solNumber,
      this.atmosphere.getLMSTString(),
      camLabel,
      this.physics.position,
      this.audio,
      {
        focalLengthMm: focalMm,
        stormIntensity: this.atmosphere.stormIntensity,
        tau: this.simulation.dustOpticalDepth,
        latDeg: this.navigation.latitudeDeg,
        lonDeg: this.navigation.longitudeDeg
      }
    );
    this.ui.showToast('📷 Telemetry-Stamped Rover Image Saved to Science Log!', 2800);
    this.saveGame();
  }

  applyLivery(liveryId, persist = true) {
    this.currentLivery = liveryId;
    this.rover.setLivery(liveryId);
    if (persist) this.saveGame();
  }

  purchaseUpgrade(upgradeId) {
    const def = GARAGE_UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return false;
    const currLvl = this.upgradeLevels[upgradeId] || 0;
    if (currLvl >= def.maxLevel) return false;
    const cost = def.baseCost * (currLvl + 1);
    if (this.science.scienceCredits < cost) return false;

    this.science.scienceCredits -= cost;
    this.upgradeLevels[upgradeId] = currLvl + 1;
    this._syncUpgradesToSystems();
    this.saveGame();
    return true;
  }

  _syncUpgradesToSystems() {
    this.physics.upgrades.tractionMult = 1.0 + (this.upgradeLevels.traction || 0) * 0.12;
    this.physics.upgrades.suspensionStiffnessMult = 1.0 + (this.upgradeLevels.suspension || 0) * 0.14;
    this.physics.upgrades.motorPowerMult = 1.0 + (this.upgradeLevels.traction || 0) * 0.08;
    this.simulation.capacityMult = 1.0 + (this.upgradeLevels.battery || 0) * 0.25;
    this.simulation.solarEfficiencyMult = 1.0 + (this.upgradeLevels.solar || 0) * 0.22;
  }

  setGraphicsPreset(presetKey, persist = true) {
    this.graphics.applyPreset(presetKey, (newPreset) => {
      this.world.applyGraphicsPreset(newPreset);
      this.atmosphere.applyGraphicsPreset(newPreset);
      this.particles.applyGraphicsPreset(newPreset);
      this.rover.applyGraphicsPreset(newPreset);
    });
    if (persist) this.saveGame();
  }

  _tick() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this.graphics.updateFPS(dt);

    if (this.isGameplayActive) {
      // 1. Stream open-world terrain chunks & LODs around rover
      this.world.updateChunks(this.physics.position.x, this.physics.position.z, false);

      const navTarget = this.missions.getNavigationTarget(this.science, this.physics.position);
      this._lastNavTarget = navTarget;

      if (!this.simPaused) {
        // Effective controls considering electrical power restrictions
        const effectiveControls = {
          ...this.input.state,
          boost: this.input.state.boost && !this.simulation.isOverdriveRestricted()
        };

        // 2. Step 6-DOF Rigid-Body & 6-Wheel Rocker-Bogie Physics
        this.physics.step(
          dt,
          effectiveControls,
          this.simulation.isLowPowerLimp(),
          this.science.solidColliders
        );

        // 3. Synchronize Rover 3D Model, Suspension Linkages, Wheels & Dust Plumes
        this.rover.syncFromPhysics(this.physics, effectiveControls, dt, this.particles);

        // 4. Imprint persistent tire tracks into Martian regolith
        this._rightVec.set(1, 0, 0).applyQuaternion(this.physics.quaternion);
        this.world.recordWheelTracks(this.physics.position, this._rightVec, this.physics.groundedWheels);

        // 5. Update Mars Environmental & Battery/Solar Simulation
        this.simulation.update(dt, this.physics, this.atmosphere, this.rover, effectiveControls, this.currentRegionId);

        // 6. Update Localization, 6-Axis Body IMU & Forward Terrain Scanner
        this.navigation.update(dt, this.physics, this.simulation, this.atmosphere, navTarget, this.currentRegionId);

        // 7. Update Scientific Proximity Scanner & Progressive Rotary-Percussive Drill Sequence
        this.science.update(
          dt,
          this.physics.position,
          this.graphics.camera,
          this.physics,
          this.simulation,
          this.particles,
          (drillReport) => {
            this.ui.showScienceReport(drillReport);
            if (drillReport.action === 'SAMPLE_COLLECTED') {
              this.missions.notifyConceptEvent('coring_drill');
            }
            this.saveGame();
          }
        );

        // 8. Update Missions
        this._lastMissionState = this.missions.update(dt, this.physics, this.science, this.simulation);

        // 9. Continuous Acoustic Modulation
        this.audio.update(
          this.physics.forwardSpeed,
          this.physics.averageSlip,
          this.atmosphere.stormIntensity,
          this.physics.groundedWheels
        );

        // Periodic background auto-save every 10 seconds
        this._autoSaveTimer += dt;
        if (this._autoSaveTimer >= 10.0) {
          this._autoSaveTimer = 0;
          this.saveGame();
        }
      }

      // 10. Update 3D Physics Vector Visualizer & Engineering Telemetry UI
      this.physicsViz.update(this.physics, this.navigation);
      this.telemetryUI.update(dt);

      // 11. Refresh Minimal Immersive HUD
      if (this.cameraManager.mode === 'mastcam') {
        this.ui.updateCameraBadge(this.cameraManager.getCurrentConfig(), this.cameraManager.mastcamFov);
      }
      this.ui.updateHUD(
        this.physics,
        this.simulation,
        this.atmosphere,
        this.science,
        this._lastMissionState,
        navTarget,
        this.input.state,
        this.graphics.fps,
        this.navigation
      );

      // 12. Dispatch real-time telemetry back to React Flight Deck (5 Hz throttled)
      if (this.isGameplayActive && window.parent && window.parent !== window) {
        this._parentTelemetryTimer = (this._parentTelemetryTimer || 0) + dt;
        if (this._parentTelemetryTimer >= 0.2) {
          this._parentTelemetryTimer = 0;
          try {
            window.parent.postMessage({
              type: 'ROVER_TELEMETRY_UPDATE',
              telemetry: {
                speedKmh: +(this.physics.linearVelocity.length() * 3.6).toFixed(1),
                speedCms: +(this.physics.linearVelocity.length() * 100).toFixed(1),
                batteryPct: Math.round(this.simulation.batteryPct),
                headingDeg: Math.round(this.physics.headingDeg),
                pitchDeg: +this.physics.pitchDeg.toFixed(1),
                rollDeg: +this.physics.rollDeg.toFixed(1),
                distanceM: Math.round(this.simulation.totalDistanceM),
                samplesCount: this.science.samplesCollected.length,
                credits: this.science.scienceCredits,
                regionId: this.currentRegionId,
                regionName: MARS_REGIONS[this.currentRegionId]?.name ?? 'Jezero Crater',
                cameraMode: this.cameraManager.mode,
                hullIntegrity: Math.round(this.physics.hullIntegrity),
                slipRatio: +(this.physics.averageSlipRatio || 0).toFixed(2),
              }
            }, '*');
          } catch {
            // Non-fatal if parent is cross-origin
          }
        }
      }
    }

    // Atmosphere, Particles & Camera always update smoothly (including on Main Menu & Garage!)
    this.atmosphere.update(dt, this.physics.position);
    this.cameraManager.update(dt, this.isGameplayActive ? this.input : null, this.physics);
    this.particles.update(dt, this.graphics.camera.position, this.atmosphere.stormIntensity);

    this.graphics.render();
  }
}

// Auto-mount standalone browser game (resilient to DOM load timing)
function bootRoverExpedition() {
  if (window.roverExpedition) return;
  window.roverExpedition = new RoverExpeditionGame();
  checkAndRunInBrowserTests();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  bootRoverExpedition();
} else {
  window.addEventListener('DOMContentLoaded', bootRoverExpedition);
}
