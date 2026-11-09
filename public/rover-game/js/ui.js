import { MARS_REGIONS, TERRAIN_MATERIAL_PROFILES } from './regions.js';
import { MISSIONS_CATALOG } from './missions.js';
import { ROVER_LIVERIES } from './rover.js';
import { GRAPHICS_PRESETS } from './graphics.js';
import { CAMERA_MODES } from './cameraManager.js';

export const GARAGE_UPGRADES = [
  { id: 'traction',   name: 'Titanium Traction Cleats',     desc: '+12% tire friction on sand dunes & steep scarps per level', baseCost: 140, maxLevel: 3 },
  { id: 'battery',    name: 'High-Density Li-Ion Pack',     desc: '+25% energy storage capacity for night & storm survival',   baseCost: 160, maxLevel: 3 },
  { id: 'solar',      name: 'Triple-Junction Solar Array',  desc: '+22% solar charging output under Martian sunlight',          baseCost: 150, maxLevel: 3 },
  { id: 'suspension', name: 'Reinforced Rocker-Bogie',      desc: '+14% spring stiffness & stability over heavy boulders',     baseCost: 130, maxLevel: 3 }
];

/**
 * Complete Game UI Controller:
 * Main Menu, Sub-Modals (Regions, Missions, Garage, Settings, Photo Gallery),
 * Minimal Immersive HUD, Science Report Card, Toast Notifications & Touch Controls.
 */
export class GameUI {
  constructor(game) {
    this.game = game;
    this.activeScreen = 'menu'; // 'menu' | 'playing' | 'regions' | 'missions' | 'garage' | 'settings' | 'gallery'
    this.touchMode = 'auto';    // 'auto' | 'on' | 'off'
    this._scienceHideTimer = null;
    this._toastTimer = null;

    this._cacheDOM();
    this._bindMenuEvents();
    this._renderStaticControls();
    this.applyTouchVisibility();
  }

  _cacheDOM() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      loadingScreen: $('loading-screen'),
      loadingBar: $('loading-bar-fill'),
      loadingStatus: $('loading-status-text'),

      mainMenu: $('main-menu-overlay'),
      btnStartExpedition: $('btn-start-expedition'),
      btnContinue: $('btn-continue-expedition'),
      continueSub: $('continue-subtitle'),
      btnOpenRegions: $('btn-open-regions'),
      btnOpenMissions: $('btn-open-missions'),
      btnOpenGarage: $('btn-open-garage'),
      btnOpenSettings: $('btn-open-settings'),
      btnReturnMap: $('btn-return-martian-map'),
      menuCreditsVal: $('menu-credits-val'),
      menuMissionsVal: $('menu-missions-val'),
      menuSamplesVal: $('menu-samples-val'),

      modalBackdrop: $('modal-panel-backdrop'),
      modalTitle: $('modal-panel-title'),
      modalBody: $('modal-panel-body'),
      btnCloseModal: $('btn-close-modal'),
      btnBackToGame: $('btn-resume-driving'),

      hudRoot: $('gameplay-hud'),
      sensorFrame: $('camera-sensor-frame'),
      sensorLabel: $('sensor-frame-label'),

      // Top HUD
      regionTitle: $('hud-region-name'),
      dataProvenance: $('hud-data-provenance'),
      missionBox: $('hud-mission-box'),
      missionCode: $('hud-mission-code'),
      missionTitle: $('hud-mission-title'),
      missionObj: $('hud-mission-obj'),

      compassHeading: $('hud-compass-deg'),
      compassCardinal: $('hud-compass-cardinal'),
      navMarker: $('hud-nav-target'),

      // Quick Top-Right Buttons
      btnCycleCam: $('hud-btn-cam'),
      camLabel: $('hud-cam-label'),
      btnLights: $('hud-btn-lights'),
      btnPhoto: $('hud-btn-photo'),
      btnSlope: $('hud-btn-slope'),
      btnNasaPath: $('hud-btn-nasa-path'),
      btnPhysViz: $('hud-btn-physviz'),
      btnTelem: $('hud-btn-telem'),
      btnEngMode: $('hud-btn-engmode'),
      btnGallery: $('hud-btn-gallery'),
      btnAudio: $('hud-btn-audio'),
      btnMenu: $('hud-btn-menu'),
      fpsVal: $('hud-fps-val'),

      // Bottom-Left Driving Cluster
      speedVal: $('hud-speed-val'),
      speedKmh: $('hud-speed-kmh'),
      gearBadge: $('hud-gear-badge'),
      slopeVal: $('hud-slope-val'),
      soilVal: $('hud-soil-val'),
      slipFill: $('hud-slip-fill'),
      hullFill: $('hud-hull-fill'),
      hullVal: $('hud-hull-val'),
      tiltWarning: $('hud-tilt-warning'),

      // Bottom-Right Mars Simulation Cluster
      batteryVal: $('hud-battery-val'),
      batteryFill: $('hud-battery-fill'),
      solarVal: $('hud-solar-val'),
      netPowerVal: $('hud-net-power'),
      tempVal: $('hud-temp-val'),
      visVal: $('hud-vis-val'),
      hudGravVal: $('hud-grav-val'),
      solClock: $('hud-sol-clock'),
      distVal: $('hud-dist-val'),
      stormAlert: $('hud-storm-alert'),

      // Center Interaction Prompt & Science Report Card
      interactPrompt: $('hud-interact-prompt'),
      interactKey: $('hud-interact-key'),
      interactText: $('hud-interact-text'),

      scienceCard: $('science-report-card'),
      sciCloseBtn: $('btn-close-science'),
      sciBadge: $('sci-action-badge'),
      sciTitle: $('sci-mineral-title'),
      sciCategory: $('sci-mineral-cat'),
      sciChemGrid: $('sci-chem-grid'),
      sciBioVal: $('sci-bio-val'),
      sciAdvisor: $('sci-advisor-text'),

      // Mission Complete Banner & Toast
      toastBanner: $('hud-toast-banner'),
      touchLayer: $('touch-controls-layer')
    };
  }

  setLoadingProgress(pct, message) {
    if (this.el.loadingBar) this.el.loadingBar.style.width = `${pct}%`;
    if (this.el.loadingStatus && message) this.el.loadingStatus.textContent = message;
  }

  hideLoadingScreen() {
    if (this.el.loadingScreen) {
      this.el.loadingScreen.classList.add('hidden');
    }
  }

  _bindMenuEvents() {
    // Check optional ?returnUrl=... query param or inside iframe or programmatic onExitToMap callback for Martian Map integration!
    const params = new URLSearchParams(window.location.search);
    const inIframe = window.self !== window.top;
    const returnUrl = params.get('returnUrl') || (inIframe ? '/' : '/');
    if (this.el.btnReturnMap) {
      this.el.btnReturnMap.style.display = 'inline-flex';
      this.el.btnReturnMap.addEventListener('click', () => {
        if (this.game.onExitToMap) {
          this.game.onExitToMap();
        } else if (inIframe) {
          window.top.location.href = returnUrl || '/';
        } else {
          window.location.href = returnUrl || '/';
        }
      });
    }

    this.el.btnStartExpedition.addEventListener('click', () => {
      this.game.startNextOrFirstMission();
    });

    this.el.btnContinue.addEventListener('click', () => {
      this.game.continueSavedExploration();
    });

    this.el.btnOpenRegions.addEventListener('click', () => this.openModal('regions'));
    this.el.btnOpenMissions.addEventListener('click', () => this.openModal('missions'));
    this.el.btnOpenGarage.addEventListener('click', () => this.openModal('garage'));
    this.el.btnOpenSettings.addEventListener('click', () => this.openModal('settings'));

    this.el.btnCloseModal.addEventListener('click', () => this.closeModal());
    this.el.btnBackToGame.addEventListener('click', () => this.enterGameplayHUD());

    // HUD Quick Buttons
    this.el.btnCycleCam.addEventListener('click', () => this.game.cycleCamera());
    this.el.btnLights.addEventListener('click', () => this.game.toggleHeadlights());
    this.el.btnPhoto.addEventListener('click', () => this.game.capturePhoto());
    this.el.btnSlope.addEventListener('click', () => {
      const next = !this.game.world.slopeHazardMode;
      this.game.world.setSlopeHazardMode(next);
      this.el.btnSlope.classList.toggle('active', next);
    });
    this.el.btnNasaPath.addEventListener('click', () => {
      const vis = this.game.toggleNasaCorridor();
      this.el.btnNasaPath.classList.toggle('active', vis);
    });
    if (this.el.btnPhysViz) {
      this.el.btnPhysViz.addEventListener('click', () => {
        this.game.togglePhysicsViz();
      });
    }
    if (this.el.btnTelem) {
      this.el.btnTelem.addEventListener('click', () => {
        this.game.telemetryUI.toggleDrawer();
      });
    }
    if (this.el.btnEngMode) {
      this.el.btnEngMode.addEventListener('click', () => {
        this.game.telemetryUI.toggleFullScreen();
      });
    }
    this.el.btnGallery.addEventListener('click', () => this.openModal('gallery'));
    this.el.btnAudio.addEventListener('click', () => {
      const on = this.game.audio.toggle();
      this.el.btnAudio.textContent = on ? '🔊' : '🔇';
      this.el.btnAudio.classList.toggle('active', on);
    });
    this.el.btnMenu.addEventListener('click', () => this.openMainMenu());
    this.el.sciCloseBtn.addEventListener('click', () => {
      this.el.scienceCard.classList.add('hidden');
    });

    // Touch action buttons
    document.querySelectorAll('[data-touch-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const act = btn.dataset.touchAction;
        if (act === 'interact') this.game.triggerInteract();
        if (act === 'camera') this.game.cycleCamera();
        if (act === 'lights') this.game.toggleHeadlights();
        if (act === 'reset') this.game.resetRoverUpright();
        if (act === 'photo') this.game.capturePhoto();
      });
    });
  }

  _renderStaticControls() {
    this.refreshMenuStats();
  }

  applyTouchVisibility() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const show = this.touchMode === 'on' || (this.touchMode === 'auto' && isTouchDevice);
    if (this.el.touchLayer) {
      this.el.touchLayer.classList.toggle('hidden', !show);
    }
  }

  refreshMenuStats() {
    const g = this.game;
    this.el.menuCreditsVal.textContent = `${g.science.scienceCredits}`;
    this.el.menuMissionsVal.textContent = `${g.missions.completedMissions.size} / ${MISSIONS_CATALOG.length}`;
    this.el.menuSamplesVal.textContent = `${g.science.samplesCollected.length}`;

    const hasSave = g.missions.hasSavedGame();
    this.el.btnContinue.disabled = !hasSave;
    if (hasSave) {
      const reg = MARS_REGIONS[g.currentRegionId]?.name || 'Jezero Crater';
      this.el.continueSub.textContent = `Resume in ${reg} • Sol ${g.atmosphere.solNumber}`;
    } else {
      this.el.continueSub.textContent = 'No prior expedition save found';
    }

    this.el.btnBackToGame.style.display = g.hasStartedSession ? 'inline-flex' : 'none';
  }

  openMainMenu() {
    this.activeScreen = 'menu';
    this.game.setGameplayActive(false, 'menu');
    this.refreshMenuStats();
    this.el.modalBackdrop.classList.add('hidden');
    this.el.hudRoot.classList.add('hidden');
    this.el.mainMenu.classList.remove('hidden');
  }

  enterGameplayHUD() {
    this.activeScreen = 'playing';
    this.el.mainMenu.classList.add('hidden');
    this.el.modalBackdrop.classList.add('hidden');
    this.el.hudRoot.classList.remove('hidden');
    this.game.setGameplayActive(true, 'none');
    this.game.audio.ensureUnlocked();
    // Ensure default chase cam if previously stuck in rear hazcam
    if (this.game.cameraManager.mode === 'rear_hazcam') {
      const cfg = this.game.cameraManager.setMode('chase');
      this.updateCameraBadge(cfg, this.game.cameraManager.mastcamFov);
    }
  }

  openModal(type) {
    this.activeScreen = type;
    this.el.modalBackdrop.classList.remove('hidden');

    if (type === 'garage') {
      this.el.mainMenu.classList.add('hidden');
      this.el.hudRoot.classList.add('hidden');
      this.game.setGameplayActive(false, 'garage');
      this.el.modalBackdrop.classList.add('garage-side-layout');
    } else {
      this.el.modalBackdrop.classList.remove('garage-side-layout');
      this.game.setGameplayActive(false, this.game.hasStartedSession ? 'none' : 'menu');
    }

    if (type === 'regions') this._renderRegionsModal();
    else if (type === 'missions') this._renderMissionsModal();
    else if (type === 'garage') this._renderGarageModal();
    else if (type === 'settings') this._renderSettingsModal();
    else if (type === 'gallery') this._renderGalleryModal();
  }

  closeModal() {
    this.el.modalBackdrop.classList.add('hidden');
    this.el.modalBackdrop.classList.remove('garage-side-layout');
    if (this.game.hasStartedSession) {
      this.enterGameplayHUD();
    } else {
      this.openMainMenu();
    }
  }

  _renderRegionsModal() {
    this.el.modalTitle.textContent = 'SELECT MARTIAN REGION';
    const cards = Object.values(MARS_REGIONS).map((reg) => {
      const isCurrent = this.game.currentRegionId === reg.id;
      const badgeClass = reg.isNASAReference ? 'prov-nasa' : 'prov-sim';
      return `
        <div class="modal-card ${isCurrent ? 'active-card' : ''}">
          <div class="card-top-row">
            <span class="prov-badge ${badgeClass}">${reg.dataBadge}</span>
            <span class="card-coords mono">${reg.coordinates}</span>
          </div>
          <h3 class="card-title">${reg.name}</h3>
          <div class="card-subtitle">${reg.subtitle}</div>
          <p class="card-desc">${reg.description}</p>
          <div class="card-meta-row mono">
            <span>Datum: ${reg.datumElevation}m</span>
            <span>Hazard: ${reg.hazardRating}</span>
          </div>
          <button class="action-btn primary-btn full-w" data-deploy-region="${reg.id}">
            ${isCurrent && this.game.hasStartedSession ? 'RE-DEPLOY AT LANDING ZONE' : 'DEPLOY TO REGION'}
          </button>
        </div>
      `;
    }).join('');

    this.el.modalBody.innerHTML = `<div class="cards-grid">${cards}</div>`;
    this.el.modalBody.querySelectorAll('[data-deploy-region]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.deployToRegion(btn.dataset.deployRegion, true);
        this.enterGameplayHUD();
      });
    });
  }

  _renderMissionsModal() {
    this.el.modalTitle.textContent = 'EXPEDITION MISSIONS';
    const freeRoamHeader = `
      <div class="free-roam-banner">
        <div>
          <strong>OPEN-WORLD FREE EXPLORATION</strong>
          <p>Explore any Martian region without mission constraints, scan outcrops, drill cores, and test rover physics.</p>
        </div>
        <button class="action-btn secondary-btn" id="btn-start-freeroam">ENTER FREE ROAM</button>
      </div>
    `;

    const cards = MISSIONS_CATALOG.map((m) => {
      const done = this.game.missions.completedMissions.has(m.id);
      const isActive = this.game.missions.activeMission?.id === m.id;
      const regionName = MARS_REGIONS[m.region]?.name || m.region;
      return `
        <div class="modal-card ${isActive ? 'active-card' : ''} ${done ? 'completed-card' : ''}">
          <div class="card-top-row">
            <span class="mission-pill mono">${m.code}</span>
            <span class="status-tag ${done ? 'done' : 'avail'}">${done ? '✓ COMPLETED' : m.difficulty.toUpperCase()}</span>
          </div>
          <h3 class="card-title">${m.title}</h3>
          <div class="card-subtitle">Sector: ${regionName}</div>
          <p class="card-desc">${m.briefing}</p>
          <div class="card-meta-row mono">
            <span>Reward: +${m.rewardCredits} ◈ Credits</span>
            ${m.unlockLivery ? `<span>Unlocks Livery</span>` : `<span>Science XP</span>`}
          </div>
          <button class="action-btn primary-btn full-w" data-launch-mission="${m.id}">
            ${isActive ? 'RESTART MISSION' : (done ? 'REPLAY MISSION' : 'START MISSION')}
          </button>
        </div>
      `;
    }).join('');

    this.el.modalBody.innerHTML = `${freeRoamHeader}<div class="cards-grid">${cards}</div>`;

    const freeBtn = this.el.modalBody.querySelector('#btn-start-freeroam');
    if (freeBtn) {
      freeBtn.addEventListener('click', () => {
        this.game.missions.clearMission();
        if (!this.game.hasStartedSession) {
          this.game.deployToRegion(this.game.currentRegionId, false);
        }
        this.enterGameplayHUD();
        this.showToast('FREE EXPLORATION ACTIVE — Drive anywhere on Mars!');
      });
    }

    this.el.modalBody.querySelectorAll('[data-launch-mission]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.launchMission(btn.dataset.launchMission);
        this.enterGameplayHUD();
      });
    });
  }

  _renderGarageModal() {
    this.el.modalTitle.textContent = `ROVER GARAGE • ◈ ${this.game.science.scienceCredits} CREDITS`;

    const liveryButtons = Object.entries(ROVER_LIVERIES).map(([id, liv]) => {
      const unlocked = this.game.missions.unlockedLiveries.has(id) || this.game.science.scienceCredits >= 250;
      const owned = this.game.missions.unlockedLiveries.has(id);
      const selected = this.game.currentLivery === id;
      return `
        <button class="livery-btn ${selected ? 'active' : ''}" data-select-livery="${id}" ${!unlocked ? 'disabled' : ''}>
          <span class="livery-swatch" style="background:#${liv.primary.toString(16).padStart(6, '0')}; border-color:#${liv.accent.toString(16).padStart(6, '0')}"></span>
          <span>${liv.name}</span>
          <span class="mono">${selected ? 'EQUIPPED' : (owned ? 'OWNED' : '250 ◈')}</span>
        </button>
      `;
    }).join('');

    const upgradeRows = GARAGE_UPGRADES.map((up) => {
      const lvl = this.game.upgradeLevels[up.id] || 0;
      const cost = up.baseCost * (lvl + 1);
      const isMax = lvl >= up.maxLevel;
      const canAfford = this.game.science.scienceCredits >= cost;
      return `
        <div class="upgrade-row">
          <div class="upgrade-info">
            <div class="upgrade-name">${up.name} <span class="mono">LV ${lvl}/${up.maxLevel}</span></div>
            <div class="upgrade-desc">${up.desc}</div>
          </div>
          <button class="action-btn ${isMax ? 'secondary-btn' : 'primary-btn'}" data-buy-upgrade="${up.id}" ${isMax || !canAfford ? 'disabled' : ''}>
            ${isMax ? 'MAXED' : `UPGRADE (${cost} ◈)`}
          </button>
        </div>
      `;
    }).join('');

    const needsRepair = this.game.physics.hullIntegrity < 99.5;
    const repairHtml = `
      <div class="upgrade-row">
        <div class="upgrade-info">
          <div class="upgrade-name">Chassis & Suspension Field Repair <span class="mono">${this.game.physics.hullIntegrity.toFixed(0)}%</span></div>
          <div class="upgrade-desc">Restore hull integrity to 100% and recharge auxiliary cells</div>
        </div>
        <button class="action-btn secondary-btn" id="btn-garage-repair" ${!needsRepair ? 'disabled' : ''}>
          ${needsRepair ? 'REPAIR FREE' : 'HULL 100%'}
        </button>
      </div>
    `;

    this.el.modalBody.innerHTML = `
      <div class="garage-section">
        <h4>CHASSIS THERMAL LIVERY</h4>
        <div class="livery-list">${liveryButtons}</div>
      </div>
      <div class="garage-section">
        <h4>ENGINEERING SUBSYSTEM UPGRADES</h4>
        <div class="upgrades-list">${upgradeRows}${repairHtml}</div>
      </div>
    `;

    this.el.modalBody.querySelectorAll('[data-select-livery]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.selectLivery;
        if (!this.game.missions.unlockedLiveries.has(id)) {
          if (this.game.science.scienceCredits < 250) return;
          this.game.science.scienceCredits -= 250;
          this.game.missions.unlockedLiveries.add(id);
        }
        this.game.applyLivery(id);
        this._renderGarageModal();
      });
    });

    this.el.modalBody.querySelectorAll('[data-buy-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.buyUpgrade;
        this.game.purchaseUpgrade(id);
        this._renderGarageModal();
      });
    });

    const repBtn = this.el.modalBody.querySelector('#btn-garage-repair');
    if (repBtn) {
      repBtn.addEventListener('click', () => {
        this.game.physics.hullIntegrity = 100.0;
        this.game.simulation.batteryPct = 100.0;
        this._renderGarageModal();
      });
    }
  }

  _renderSettingsModal() {
    this.el.modalTitle.textContent = 'SIMULATION, PHYSICS & GRAPHICS SETTINGS';
    const currPreset = this.game.graphics.currentPresetKey;
    const presetBtns = Object.values(GRAPHICS_PRESETS).map((p) => `
      <button class="preset-btn ${currPreset === p.id ? 'active' : ''}" data-set-preset="${p.id}">
        <strong>${p.id.toUpperCase()}</strong>
        <span>${p.label}</span>
      </button>
    `).join('');

    const stormActive = this.game.atmosphere.targetStormIntensity > 0.3;
    const currHz = this.game.physics.fixedStepHz;
    const currGrav = this.game.simulation.gravity;
    const currSoilOverride = this.game.world.sampler.soilOverrideId || '';
    const soilButtons = [
      `<button class="mini-btn ${currSoilOverride === '' ? 'active' : ''}" data-soil-override="">AUTO REGIONAL</button>`,
      ...Object.values(TERRAIN_MATERIAL_PROFILES).map((prof) => `
        <button class="mini-btn ${currSoilOverride === prof.id ? 'active' : ''}" data-soil-override="${prof.id}">${prof.name.toUpperCase()}</button>
      `)
    ].join('');

    this.el.modalBody.innerHTML = `
      <div class="settings-block">
        <h4>GRAPHICS QUALITY PRESET (TUNED FOR GTX 1050 Ti + RYZEN 7 7700)</h4>
        <div class="preset-grid">${presetBtns}</div>
      </div>

      <div class="settings-block">
        <h4>MARS PHYSICS & TERRAMECHANICS CONFIGURATION</h4>
        <div class="settings-row">
          <label>Fixed-Timestep Physics Solver Rate</label>
          <div class="btn-group">
            <button class="mini-btn ${currHz === 60 ? 'active' : ''}" data-solver-hz="60">60 Hz (ECO)</button>
            <button class="mini-btn ${currHz === 120 ? 'active' : ''}" data-solver-hz="120">120 Hz (NASA SIM)</button>
            <button class="mini-btn ${currHz === 240 ? 'active' : ''}" data-solver-hz="240">240 Hz (ULTRA)</button>
          </div>
        </div>
        <div class="settings-row">
          <label>Surface Gravity Reference (g)</label>
          <div class="btn-group">
            <button class="mini-btn ${Math.abs(currGrav - 3.71) < 0.05 ? 'active' : ''}" data-grav-val="3.71">3.71 m/s² (MARS)</button>
            <button class="mini-btn ${Math.abs(currGrav - 1.62) < 0.05 ? 'active' : ''}" data-grav-val="1.62">1.62 m/s² (MOON)</button>
            <button class="mini-btn ${Math.abs(currGrav - 9.81) < 0.05 ? 'active' : ''}" data-grav-val="9.81">9.81 m/s² (EARTH)</button>
          </div>
        </div>
        <div class="settings-row">
          <label>Terrain Material Profile Override (Bekker–Wong–Janosi)</label>
          <div class="btn-group">${soilButtons}</div>
        </div>
        <div class="settings-row">
          <label>Barometric Weather Anomaly (<span id="lbl-press-offset">${this.game.simulation.weatherPressureOffsetPa >= 0 ? '+' : ''}${this.game.simulation.weatherPressureOffsetPa.toFixed(0)} Pa</span>)</label>
          <input type="range" id="set-press-slider" min="-70" max="70" value="${Math.round(this.game.simulation.weatherPressureOffsetPa)}">
        </div>
        <div class="settings-row">
          <label>Synoptic Wind Velocity Scale (<span id="lbl-wind-mult">${Math.round(this.game.simulation.windMultiplier * 100)}%</span>)</label>
          <input type="range" id="set-wind-slider" min="0" max="220" value="${Math.round(this.game.simulation.windMultiplier * 100)}">
        </div>
        <div class="settings-row">
          <label>Auxiliary Solar Deck Dust Factor (${Math.round(this.game.simulation.panelDustFactor * 100)}% Clean)</label>
          <button class="mini-btn" id="btn-clean-panels">CLEAN SOLAR ARRAY</button>
        </div>
      </div>

      <div class="settings-block">
        <h4>AUDIO & CONTROLS</h4>
        <div class="settings-row">
          <label>Acoustic Audio Master Volume</label>
          <input type="range" id="set-vol-slider" min="0" max="100" value="${Math.round(this.game.audio.masterVolume * 100)}">
        </div>
        <div class="settings-row">
          <label>On-Screen Touchscreen Controls</label>
          <div class="btn-group">
            <button class="mini-btn ${this.touchMode === 'auto' ? 'active' : ''}" data-touch-mode="auto">AUTO</button>
            <button class="mini-btn ${this.touchMode === 'on' ? 'active' : ''}" data-touch-mode="on">SHOW</button>
            <button class="mini-btn ${this.touchMode === 'off' ? 'active' : ''}" data-touch-mode="off">HIDE</button>
          </div>
        </div>
      </div>

      <div class="settings-block">
        <h4>MARS ATMOSPHERE & SOL TIME SANDBOX</h4>
        <div class="settings-row">
          <label>Set Martian Time of Day (LMST)</label>
          <div class="btn-group">
            <button class="mini-btn" data-sol-time="0.26">DAWN (06:15)</button>
            <button class="mini-btn" data-sol-time="0.54">NOON (13:00)</button>
            <button class="mini-btn" data-sol-time="0.745">BLUE SUNSET (17:50)</button>
            <button class="mini-btn" data-sol-time="0.02">STARRY NIGHT (00:30)</button>
          </div>
        </div>
        <div class="settings-row">
          <label>Regional Dust Storm Simulation</label>
          <button class="action-btn ${stormActive ? 'danger-btn' : 'secondary-btn'}" id="btn-toggle-storm">
            ${stormActive ? 'CLEAR DUST STORM' : 'TRIGGER SEVERE DUST STORM'}
          </button>
        </div>
      </div>

      <div class="settings-block">
        <h4>KEYBINDINGS REFERENCE & DATA</h4>
        <div class="controls-cheatsheet mono">
          <span>[W/S] Drive / Reverse</span>
          <span>[A/D] 4-Corner Ackermann</span>
          <span>[SPACE] Mechanical Brake</span>
          <span>[SHIFT] Speed Overdrive</span>
          <span>[X] Low-Range Creep Gear</span>
          <span>[T] Engineering Telemetry</span>
          <span>[V] 3D Physics Vectors</span>
          <span>[G] Engineering Mode + CSV</span>
          <span>[K] Pause / Resume Sim</span>
          <span>[L] Navcam Localization Fix</span>
          <span>[C / 1-6] Switch Camera</span>
          <span>[E] LIBS Scan / Core Drill</span>
          <span>[F] LED Headlights</span>
          <span>[P] Mastcam-Z Observation</span>
          <span>[R] Emergency Recovery</span>
        </div>
        <div class="settings-row" style="margin-top:12px;">
          <label>Saved Expedition Data</label>
          <button class="mini-btn danger-outline" id="btn-wipe-save">RESET SAVE DATA</button>
        </div>
      </div>
    `;

    this.el.modalBody.querySelectorAll('[data-set-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.setGraphicsPreset(btn.dataset.setPreset);
        this._renderSettingsModal();
      });
    });

    this.el.modalBody.querySelectorAll('[data-solver-hz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hz = parseInt(btn.dataset.solverHz, 10);
        this.game.physics.setSolverRate(hz);
        this._renderSettingsModal();
        this.showToast(`Physics Solver Rate: ${hz} Hz Fixed-Timestep`);
      });
    });

    this.el.modalBody.querySelectorAll('[data-grav-val]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = parseFloat(btn.dataset.gravVal);
        this.game.simulation.gravity = g;
        this.game.physics.setGravity(g);
        this._renderSettingsModal();
        this.showToast(`Planetary Gravity set to ${g.toFixed(2)} m/s²`);
      });
    });

    this.el.modalBody.querySelectorAll('[data-soil-override]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const soilId = btn.dataset.soilOverride || null;
        this.game.world.sampler.soilOverrideId = soilId;
        this._renderSettingsModal();
        this.showToast(soilId ? `Soil Profile Override: ${TERRAIN_MATERIAL_PROFILES[soilId].name}` : 'Soil Profile: Automatic Regional Mosaic');
      });
    });

    const pressSlider = this.el.modalBody.querySelector('#set-press-slider');
    const pressLbl = this.el.modalBody.querySelector('#lbl-press-offset');
    pressSlider.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.game.simulation.weatherPressureOffsetPa = v;
      if (pressLbl) pressLbl.textContent = `${v >= 0 ? '+' : ''}${v.toFixed(0)} Pa`;
    });

    const windSlider = this.el.modalBody.querySelector('#set-wind-slider');
    const windLbl = this.el.modalBody.querySelector('#lbl-wind-mult');
    windSlider.addEventListener('input', (e) => {
      const pct = parseFloat(e.target.value);
      this.game.simulation.windMultiplier = pct / 100.0;
      if (windLbl) windLbl.textContent = `${Math.round(pct)}%`;
    });

    const cleanBtn = this.el.modalBody.querySelector('#btn-clean-panels');
    if (cleanBtn) {
      cleanBtn.addEventListener('click', () => {
        this.game.simulation.cleanSolarPanels();
        this._renderSettingsModal();
        this.showToast('Auxiliary Solar Array Cleaned (100% Transmittance)');
      });
    }

    const volSlider = this.el.modalBody.querySelector('#set-vol-slider');
    volSlider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10) / 100;
      this.game.audio.setVolume(v);
      if (v > 0 && !this.game.audio.enabled) {
        this.game.audio.toggle(true);
        this.el.btnAudio.textContent = '🔊';
      }
    });

    this.el.modalBody.querySelectorAll('[data-touch-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.touchMode = btn.dataset.touchMode;
        this.applyTouchVisibility();
        this._renderSettingsModal();
      });
    });

    this.el.modalBody.querySelectorAll('[data-sol-time]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = parseFloat(btn.dataset.solTime);
        this.game.atmosphere.setTimeOfDay(t);
        if (t < 0.24 || t > 0.76) {
          this.game.rover.toggleHeadlights(true);
          this.el.btnLights.classList.add('active');
        }
        this.showToast('Martian Sol Clock updated');
      });
    });

    this.el.modalBody.querySelector('#btn-toggle-storm').addEventListener('click', () => {
      if (this.game.atmosphere.targetStormIntensity > 0.3) {
        this.game.atmosphere.clearDustStorm();
      } else {
        this.game.atmosphere.triggerDustStorm(0.88);
      }
      this._renderSettingsModal();
    });

    this.el.modalBody.querySelector('#btn-wipe-save').addEventListener('click', () => {
      this.game.resetAllSaveData();
      this._renderSettingsModal();
      this.showToast('Expedition save data reset');
    });
  }

  _renderGalleryModal() {
    const photos = this.game.science.photos;
    const samples = this.game.science.samplesCollected;
    const libsLogs = this.game.science.libsObservations || [];
    this.el.modalTitle.textContent = `SCIENCE LOG • ${samples.length} CORES • ${libsLogs.length} LIBS • ${photos.length} IMAGES`;

    const sampleListHtml = samples.length === 0
      ? `<p class="muted-note">No rock core tubes sealed yet. Scan an outcrop with [E], then approach within 5.0m and press [E] to deploy the rotary-percussive coring drill!</p>`
      : `<div class="sample-pills">${samples.map((s) => `
          <div class="sample-pill mono">
            <strong>${s.tubeId || `TUBE #${String(s.tubeNumber).padStart(2, '0')}`}</strong> • ${s.code} • ${s.mineralName}
            <span>Depth: ${s.coreDepthMm ?? 63.5} mm | Power: ${s.avgDrillPowerW ?? 415} W | Sol ${s.sol ?? 45} | ${s.sealStatus || 'HERMETICALLY SEALED'}</span>
          </div>
        `).join('')}</div>`;

    const libsListHtml = libsLogs.length === 0
      ? `<p class="muted-note">No SuperCam LIBS spectra recorded yet. Approach any geological outcrop within 9.5m and press [E] to fire the 1064nm pulsed laser!</p>`
      : `<div class="sample-pills">${libsLogs.map((obs) => {
          const elStr = Object.entries(obs.elements || {}).map(([k, v]) => `${k}:${v}`).join('  ');
          return `
            <div class="sample-pill libs-pill mono">
              <strong>${obs.targetCode} — ${obs.mineralName}</strong> <span class="sim-inline-tag">[SIMULATED LIBS]</span>
              <span>Range ${obs.distanceM}m | P=${obs.conditions.pressurePa} Pa | τ=${obs.conditions.opticalDepthTau} | SNR=${obs.conditions.spectralSnrDb} dB | ${elStr}</span>
            </div>
          `;
        }).join('')}</div>`;

    const photoGridHtml = photos.length === 0
      ? `<p class="muted-note">No Mastcam-Z / Hazcam observations captured yet. Press [P] or click 📷 in the HUD (use scroll wheel in Mastcam [5] for 34–110mm telephoto zoom)!</p>`
      : `<div class="photo-grid">${photos.map((p) => `
          <div class="photo-card">
            <img src="${p.url}" alt="Mars Rover Capture">
            <div class="photo-caption mono">
              <div>${p.region} • Sol ${p.sol} • ${p.camera} (${p.focalLengthMm || 34}mm)</div>
              <div>Target: ${p.targetIdentified || 'TERRAIN'} • ${p.opticalQuality || 'NOMINAL SNR'}</div>
            </div>
          </div>
        `).join('')}</div>`;

    this.el.modalBody.innerHTML = `
      <div class="garage-section">
        <h4>SEALED TITANIUM CORE SAMPLE INVENTORY (MARS SAMPLE RETURN CACHE)</h4>
        ${sampleListHtml}
      </div>
      <div class="garage-section">
        <h4>SUPERCAM 1064nm LIBS ELEMENTAL SPECTROSCOPY LOG [SIMULATED ESTIMATES]</h4>
        ${libsListHtml}
      </div>
      <div class="garage-section">
        <h4>MASTCAM-Z & HAZCAM ENGINEERING OBSERVATION ARCHIVE</h4>
        ${photoGridHtml}
      </div>
    `;
  }

  /**
   * Displays SuperCam LIBS / Rotary-Percussive Core Drill scientific popup card
   */
  showScienceReport(report) {
    if (!report) return;

    if (report.action === 'POWER_RESTRICTED' || report.action === 'DRILL_ABORTED') {
      this.showToast(`⚠ ${report.reason}`, 4800);
      return;
    }
    if (report.action === 'DRILLING_STARTED') {
      this.showToast(`⛏ Rotary-Percussive Coring Started (${report.tubeId}) — Hold Rover Steady!`, 3400);
      return;
    }
    if (report.action === 'DRILL_IN_PROGRESS') {
      this.showToast('Coring drill active — hold rover stationary until sample tube seals!', 2200);
      return;
    }

    const m = report.mineral;
    const obs = report.observation;

    if (report.action === 'SCAN_COMPLETE') {
      this.el.sciBadge.textContent = `SIMULATED SUPERCAM LIBS (+${report.creditsEarned} ◈)`;
      this.el.sciBadge.className = 'sci-badge scan';
    } else if (report.action === 'SAMPLE_COLLECTED') {
      const tId = report.sampleRecord.tubeId || `TUBE #${report.sampleRecord.tubeNumber}`;
      this.el.sciBadge.textContent = `${tId} SEALED (+${report.creditsEarned} ◈)`;
      this.el.sciBadge.className = 'sci-badge sample';
    } else {
      this.el.sciBadge.textContent = `ARCHIVED SIMULATED LIBS LOG`;
      this.el.sciBadge.className = 'sci-badge scan';
    }

    this.el.sciTitle.textContent = `${report.targetCode}: ${m.name}`;
    if (obs && obs.conditions) {
      this.el.sciCategory.textContent = `Range ${obs.distanceM}m • P=${obs.conditions.pressurePa} Pa • τ=${obs.conditions.opticalDepthTau} • SNR ${obs.conditions.spectralSnrDb} dB`;
    } else {
      this.el.sciCategory.textContent = `${m.category} • Hydration: ${m.hydration}`;
    }

    if (report.action === 'SAMPLE_COLLECTED' && report.sampleRecord) {
      const sr = report.sampleRecord;
      this.el.sciBioVal.textContent = `Core ${sr.coreDepthMm}mm @ ${sr.avgDrillPowerW}W •Hermetically Sealed • Bio: ${m.biosignatureIndex}`;
    } else {
      this.el.sciBioVal.textContent = `Biosignature Potential: ${m.biosignatureIndex} • Hardness: ${m.rockHardnessMPa || 95} MPa`;
    }
    this.el.sciAdvisor.textContent = `${m.advisorSummary}`;

    const chemSource = (obs && obs.elements) ? obs.elements : m.chemistry;
    this.el.sciChemGrid.innerHTML = Object.entries(chemSource)
      .map(([elKey, val]) => `<div class="chem-chip mono"><span>${elKey} (wt%)</span><strong>${val}</strong></div>`)
      .join('');

    this.el.scienceCard.classList.remove('hidden');
    clearTimeout(this._scienceHideTimer);
    this._scienceHideTimer = setTimeout(() => {
      this.el.scienceCard.classList.add('hidden');
    }, 10500);
  }

  showToast(message, durationMs = 4200) {
    this.el.toastBanner.textContent = message;
    this.el.toastBanner.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.el.toastBanner.classList.add('hidden');
    }, durationMs);
  }

  updateCameraBadge(camCfg, zoomFov = null) {
    this.el.camLabel.textContent = camCfg.short;
    if (camCfg.sensorOverlay) {
      this.el.sensorFrame.classList.remove('hidden');
      const zoomStr = camCfg.id === 'mastcam' && zoomFov
        ? ` • ${Math.round(34 * (44 / zoomFov))}mm ZOOM`
        : ' • WIDE HAZARD OPTICS';
      this.el.sensorLabel.textContent = `${camCfg.label}${zoomStr} [SIMULATED FEED]`;
    } else {
      this.el.sensorFrame.classList.add('hidden');
    }
  }

  /**
   * Real-time per-frame HUD update (kept ultra-lightweight, only updates changed DOM text/styles)
   */
  updateHUD(physics, simulation, atmosphere, science, missionState, navTarget, controls, fps, navigation = null) {
    if (this.activeScreen !== 'playing') return;

    const reg = MARS_REGIONS[this.game.currentRegionId];
    this.el.regionTitle.textContent = reg.name.toUpperCase();
    this.el.dataProvenance.textContent = reg.isNASAReference ? 'NASA PDS REF + SIMULATED' : 'SIMULATED TERRAIN';
    this.el.dataProvenance.className = `hud-prov-tag ${reg.isNASAReference ? 'nasa' : 'sim'}`;

    // Active Mission Objective Tracker
    if (missionState) {
      this.el.missionCode.textContent = missionState.code;
      this.el.missionTitle.textContent = missionState.title;
      this.el.missionObj.textContent = missionState.objectivesText;
    } else {
      this.el.missionCode.textContent = 'FREE EXPLORATION';
      this.el.missionTitle.textContent = reg.subtitle;
      this.el.missionObj.textContent = `LIBS: ${science.scannedCount} • Cores: ${science.samplesCollected.length} • Press [T] Telemetry • [V] 3D Vectors • [G] Charts`;
    }

    // Compass & Navigation Bearing
    const hdg = Math.round(physics.headingDeg);
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const cardinal = dirs[Math.round(hdg / 45) % 8];
    this.el.compassHeading.textContent = `${String(hdg).padStart(3, '0')}°`;
    this.el.compassCardinal.textContent = cardinal;

    if (navTarget) {
      const dx = navTarget.x - physics.position.x;
      const dz = navTarget.z - physics.position.z;
      const dist = Math.hypot(dx, dz);
      const brg = ((Math.atan2(dx, -dz) * 57.2958) % 360 + 360) % 360;
      let relAngle = brg - physics.headingDeg;
      while (relAngle > 180) relAngle -= 360;
      while (relAngle < -180) relAngle += 360;
      const arrow = Math.abs(relAngle) < 20 ? '▲' : (relAngle > 0 ? '▶' : '◀');
      this.el.navMarker.textContent = `${arrow} ${navTarget.label}: ${dist.toFixed(0)}m (${Math.round(brg)}°)`;
      this.el.navMarker.classList.remove('hidden');
    } else {
      this.el.navMarker.classList.add('hidden');
    }

    // Speed, Gear, Slope, Slip & Hull
    const absMs = Math.abs(physics.forwardSpeed);
    this.el.speedVal.textContent = absMs.toFixed(1);
    this.el.speedKmh.textContent = `${(absMs * 3.6).toFixed(1)} km/h`;

    if (this.game.simPaused) {
      this.el.gearBadge.textContent = 'SIM PAUSED';
      this.el.gearBadge.className = 'gear-pill brake';
    } else if (controls.brake) {
      this.el.gearBadge.textContent = 'BRAKE';
      this.el.gearBadge.className = 'gear-pill brake';
    } else if (simulation.isLowPowerLimp()) {
      this.el.gearBadge.textContent = 'SAFE LIMP';
      this.el.gearBadge.className = 'gear-pill brake';
    } else if (physics.lowRangeCreepMode) {
      this.el.gearBadge.textContent = 'CREEP GEAR';
      this.el.gearBadge.className = 'gear-pill boost';
    } else if (controls.boost && controls.forward > 0 && !simulation.isOverdriveRestricted()) {
      this.el.gearBadge.textContent = 'OVERDRIVE';
      this.el.gearBadge.className = 'gear-pill boost';
    } else if (controls.reverse > 0.1 || physics.forwardSpeed < -0.25) {
      this.el.gearBadge.textContent = 'REV';
      this.el.gearBadge.className = 'gear-pill rev';
    } else {
      this.el.gearBadge.textContent = 'DRIVE';
      this.el.gearBadge.className = 'gear-pill drive';
    }

    this.el.slopeVal.textContent = `${physics.slopeDeg.toFixed(1)}°`;
    this.el.soilVal.textContent = physics.currentSoil;
    this.el.slipFill.style.width = `${Math.min(100, Math.round(physics.averageSlip * 100))}%`;
    this.el.hullFill.style.width = `${ physics.hullIntegrity.toFixed(0) }%`;
    this.el.hullVal.textContent = `${physics.hullIntegrity.toFixed(0)}%`;

    const topCrit = navigation && navigation.warnings.find((w) => w.level === 'CRITICAL');
    if (topCrit) {
      this.el.tiltWarning.textContent = `⚠ ${topCrit.text}`;
      this.el.tiltWarning.classList.remove('hidden');
    } else if (physics.slopeDeg > 22.0) {
      this.el.tiltWarning.textContent = `⚠ CRITICAL SLOPE (${physics.slopeDeg.toFixed(0)}°) — ROLLOVER RISK`;
      this.el.tiltWarning.classList.remove('hidden');
    } else if (simulation.isLowPowerLimp()) {
      this.el.tiltWarning.textContent = `⚠ SAFE MODE LIMP — HALT IN SUNLIGHT TO RECHARGE`;
      this.el.tiltWarning.classList.remove('hidden');
    } else {
      this.el.tiltWarning.classList.add('hidden');
    }

    // Battery, Solar, Temp, Visibility, Gravity & Sol Clock
    const bat = simulation.batteryPct;
    this.el.batteryVal.textContent = `${bat.toFixed(0)}%`;
    this.el.batteryFill.style.width = `${bat.toFixed(1)}%`;
    this.el.batteryFill.style.background = bat < 20 ? '#ff3b30' : (bat < 45 ? '#ffaa00' : '#00ff88');

    this.el.solarVal.textContent = `${Math.round(simulation.solarWatts)}W`;
    const net = Math.round(simulation.netPowerWatts);
    this.el.netPowerVal.textContent = `${net >= 0 ? '+' : ''}${net}W`;
    this.el.netPowerVal.style.color = net >= 0 ? '#00ff88' : '#ffaa44';

    this.el.tempVal.textContent = `${Math.round(simulation.temperatureC)}°C`;
    this.el.visVal.textContent = `${atmosphere.getVisibilityMeters()}m`;
    if (this.el.hudGravVal) {
      this.el.hudGravVal.textContent = `${simulation.gravity.toFixed(2)} m/s²`;
    }
    this.el.solClock.textContent = `SOL ${atmosphere.solNumber} • ${atmosphere.getLMSTString()}`;
    this.el.distVal.textContent = simulation.totalDistanceM >= 1000
      ? `${(simulation.totalDistanceM / 1000).toFixed(2)} km`
      : `${Math.floor(simulation.totalDistanceM)} m`;

    this.el.stormAlert.classList.toggle('hidden', atmosphere.stormIntensity < 0.32);
    this.el.fpsVal.textContent = `${fps} FPS`;

    // Contextual Science Interaction Prompt
    const prompt = science.getInteractionPrompt();
    if (prompt) {
      this.el.interactKey.textContent = prompt.key;
      this.el.interactText.textContent = prompt.label;
      this.el.interactPrompt.classList.remove('hidden');
    } else {
      this.el.interactPrompt.classList.add('hidden');
    }
  }
}
