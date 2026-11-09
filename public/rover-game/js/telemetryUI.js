/**
 * Real-Time Expandable Engineering Telemetry Drawer ([T])
 * & Full-Screen Engineering Simulation Mode ([G]) with Live Canvas Charts,
 * Simulation Pause / Single-Step, PhysicsViz Layer Controls, NASA Reference Docs & CSV/JSON Export.
 */
export class EngineeringTelemetryUI {
  constructor(game) {
    this.game = game;
    this.drawerOpen = false;
    this.fullScreenOpen = false;
    this.activeFullTab = 'charts'; // 'charts' | 'docs'
    this._refreshAccum = 0;
    this._chartAccum = 0;

    this._cacheDOM();
    this._buildWheelTableRows();
    this._bindEvents();
  }

  _cacheDOM() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      // Expandable Side Telemetry Drawer
      drawer: $('eng-telemetry-drawer'),
      btnCloseDrawer: $('btn-close-telem-drawer'),
      btnOpenFullFromDrawer: $('btn-open-eng-fullscreen'),
      btnCalibrateNav: $('btn-telem-nav-fix'),
      btnToggleCreep: $('btn-telem-creep'),

      // Vehicle Dynamics fields
      tdSpeed: $('td-veh-speed'),
      tdAccel: $('td-veh-accel'),
      tdAttitude: $('td-veh-attitude'),
      tdYawRate: $('td-veh-yawrate'),
      tdClearance: $('td-veh-clearance'),
      tdTurnRad: $('td-veh-turnrad'),
      tdMassCog: $('td-veh-masscog'),
      tdForcesLongLat: $('td-veh-flonglat'),
      tdForcesRrBrk: $('td-veh-frrbrk'),
      tdSlopeGrav: $('td-veh-slopegrav'),
      tdTracLimit: $('td-veh-traclimit'),
      tdStability: $('td-veh-stability'),

      // 6-Wheel tbody
      wheelTbody: $('td-wheel-tbody'),

      // Environment fields
      tdEnvGravPress: $('td-env-gravpress'),
      tdEnvTempDens: $('td-env-tempdens'),
      tdEnvWind: $('td-env-wind'),
      tdEnvSolarDust: $('td-env-solardust'),
      tdEnvVisElev: $('td-env-viselev'),
      tdEnvSoil: $('td-env-soil'),

      // Power & Thermal fields
      tdPwrSocVolt: $('td-pwr-socvolt'),
      tdPwrCurrMode: $('td-pwr-currmode'),
      tdPwrGen: $('td-pwr-gen'),
      tdPwrLoads: $('td-pwr-loads'),
      tdPwrEndurance: $('td-pwr-endurance'),
      tdThermNodes: $('td-therm-nodes'),
      tdThermWarn: $('td-therm-warn'),

      // Navigation & IMU fields
      tdNavEnu: $('td-nav-enu'),
      tdNavLatLon: $('td-nav-latlon'),
      tdNavOdom: $('td-nav-odom'),
      tdNavUncert: $('td-nav-uncert'),
      tdNavImuAcc: $('td-nav-imuacc'),
      tdNavImuGyr: $('td-nav-imugyr'),
      tdNavStatus: $('td-nav-status'),

      // Active Safety Warnings Strip inside drawer
      tdSafetyAlerts: $('td-safety-alerts'),

      // Contextual Educational Physics Concept Card
      conceptCard: $('physics-concept-toast'),
      conceptTitle: $('concept-card-title'),
      conceptEq: $('concept-card-eq'),
      conceptBody: $('concept-card-body'),
      btnCloseConcept: $('btn-close-concept'),

      // Full-Screen Engineering Simulation Mode
      fullModal: $('eng-fullscreen-modal'),
      btnSimPause: $('btn-eng-pause'),
      btnSimStep: $('btn-eng-step'),
      btnExportCsv: $('btn-eng-export-csv'),
      btnExportJson: $('btn-eng-export-json'),
      btnTabCharts: $('btn-eng-tab-charts'),
      btnTabDocs: $('btn-eng-tab-docs'),
      btnCloseFull: $('btn-eng-close'),
      chartsPane: $('eng-charts-pane'),
      docsPane: $('eng-docs-pane'),
      summaryBox: $('eng-mission-summary'),

      // 7 Live Canvas Charts
      cSpeedAccel: $('chart-speed-accel'),
      cWheels: $('chart-wheels-compare'),
      cPower: $('chart-power-balance'),
      cBattery: $('chart-battery-bus'),
      cSlip: $('chart-wheel-slip'),
      cSlopeTrac: $('chart-slope-traction'),
      cThermal: $('chart-thermal-history')
    };
  }

  _buildWheelTableRows() {
    if (!this.el.wheelTbody) return;
    this.wheelCells = [];
    const names = ['FL', 'FR', 'ML', 'MR', 'RL', 'RR'];
    this.el.wheelTbody.innerHTML = names.map((nm, i) => `
      <tr>
        <td class="w-id"><span id="wc-dot-${i}" class="contact-dot on"></span>${nm}</td>
        <td id="wc-rpm-${i}">0.0</td>
        <td id="wc-omg-${i}">0.0</td>
        <td id="wc-trq-${i}">0</td>
        <td id="wc-str-${i}">0°</td>
        <td id="wc-fn-${i}">634</td>
        <td id="wc-slp-${i}">0%</td>
        <td id="wc-snk-${i}">0.5</td>
        <td id="wc-ftr-${i}">0</td>
        <td id="wc-sus-${i}">11.0</td>
      </tr>
    `).join('');

    for (let i = 0; i < 6; i++) {
      this.wheelCells.push({
        dot: document.getElementById(`wc-dot-${i}`),
        rpm: document.getElementById(`wc-rpm-${i}`),
        omg: document.getElementById(`wc-omg-${i}`),
        trq: document.getElementById(`wc-trq-${i}`),
        str: document.getElementById(`wc-str-${i}`),
        fn: document.getElementById(`wc-fn-${i}`),
        slp: document.getElementById(`wc-slp-${i}`),
        snk: document.getElementById(`wc-snk-${i}`),
        ftr: document.getElementById(`wc-ftr-${i}`),
        sus: document.getElementById(`wc-sus-${i}`)
      });
    }
  }

  _bindEvents() {
    if (this.el.btnCloseDrawer) {
      this.el.btnCloseDrawer.addEventListener('click', () => this.toggleDrawer(false));
    }
    if (this.el.btnOpenFullFromDrawer) {
      this.el.btnOpenFullFromDrawer.addEventListener('click', () => this.toggleFullScreen(true));
    }
    if (this.el.btnCalibrateNav) {
      this.el.btnCalibrateNav.addEventListener('click', () => this.game.triggerLocalizationFix());
    }
    if (this.el.btnToggleCreep) {
      this.el.btnToggleCreep.addEventListener('click', () => this.game.toggleCreepMode());
    }
    if (this.el.btnCloseConcept) {
      this.el.btnCloseConcept.addEventListener('click', () => this.el.conceptCard.classList.add('hidden'));
    }

    // Physics Visualization Layer Checkboxes
    document.querySelectorAll('[data-physviz-layer]').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const key = chk.dataset.physvizLayer;
        if (key === 'master') {
          this.game.togglePhysicsViz(e.target.checked);
        } else {
          this.game.physicsViz.setLayer(key, e.target.checked);
        }
      });
    });

    // Full-Screen Engineering Mode Controls
    if (this.el.btnCloseFull) {
      this.el.btnCloseFull.addEventListener('click', () => this.toggleFullScreen(false));
    }
    if (this.el.btnSimPause) {
      this.el.btnSimPause.addEventListener('click', () => {
        this.game.toggleSimulationPause();
        this._syncPauseButton();
      });
    }
    if (this.el.btnSimStep) {
      this.el.btnSimStep.addEventListener('click', () => {
        this.game.stepSimulationOnce();
        this.renderChartsAndSummary();
      });
    }
    if (this.el.btnExportCsv) {
      this.el.btnExportCsv.addEventListener('click', () => this._downloadFile('csv'));
    }
    if (this.el.btnExportJson) {
      this.el.btnExportJson.addEventListener('click', () => this._downloadFile('json'));
    }
    if (this.el.btnTabCharts) {
      this.el.btnTabCharts.addEventListener('click', () => this._switchFullTab('charts'));
    }
    if (this.el.btnTabDocs) {
      this.el.btnTabDocs.addEventListener('click', () => this._switchFullTab('docs'));
    }
  }

  _switchFullTab(tab) {
    this.activeFullTab = tab;
    this.el.btnTabCharts.classList.toggle('active', tab === 'charts');
    this.el.btnTabDocs.classList.toggle('active', tab === 'docs');
    this.el.chartsPane.classList.toggle('hidden', tab !== 'charts');
    this.el.docsPane.classList.toggle('hidden', tab !== 'docs');
    if (tab === 'charts') this.renderChartsAndSummary();
  }

  _syncPauseButton() {
    if (!this.el.btnSimPause) return;
    const p = this.game.simPaused;
    this.el.btnSimPause.textContent = p ? '▶ RESUME SIMULATION' : '⏸ PAUSE SIMULATION';
    this.el.btnSimPause.classList.toggle('paused-active', p);
  }

  toggleDrawer(force = null) {
    this.drawerOpen = force !== null ? Boolean(force) : !this.drawerOpen;
    if (this.el.drawer) {
      this.el.drawer.classList.toggle('hidden', !this.drawerOpen);
    }
    const hudBtn = document.getElementById('hud-btn-telem');
    if (hudBtn) hudBtn.classList.toggle('active', this.drawerOpen);
    if (this.drawerOpen) {
      this.refreshDrawerNow();
    }
    return this.drawerOpen;
  }

  toggleFullScreen(force = null) {
    this.fullScreenOpen = force !== null ? Boolean(force) : !this.fullScreenOpen;
    if (this.el.fullModal) {
      this.el.fullModal.classList.toggle('hidden', !this.fullScreenOpen);
    }
    const hudBtn = document.getElementById('hud-btn-engmode');
    if (hudBtn) hudBtn.classList.toggle('active', this.fullScreenOpen);

    if (this.fullScreenOpen) {
      this._syncPauseButton();
      this.renderChartsAndSummary();
    }
    return this.fullScreenOpen;
  }

  syncPhysVizMasterCheckbox(enabled) {
    const masterChk = document.querySelector('[data-physviz-layer="master"]');
    if (masterChk) masterChk.checked = enabled;
  }

  showConceptCard(card) {
    if (!this.el.conceptCard) return;
    this.el.conceptTitle.textContent = `PLANETARY ROBOTICS INSIGHT // ${card.title}`;
    this.el.conceptEq.textContent = card.equation;
    this.el.conceptBody.textContent = card.body;
    this.el.conceptCard.classList.remove('hidden');
    clearTimeout(this._conceptTimer);
    this._conceptTimer = setTimeout(() => {
      this.el.conceptCard.classList.add('hidden');
    }, 11500);
  }

  _downloadFile(format) {
    const sol = this.game.atmosphere.solNumber;
    const isCsv = format === 'csv';
    const content = isCsv
      ? this.game.simulation.exportTelemetryCSV()
      : this.game.simulation.exportTelemetryJSON(this.game.physics, this.game.navigation);
    const mime = isCsv ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
    const ext = isCsv ? 'csv' : 'json';

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mars_rover_telemetry_sol${sol}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.game.ui.showToast(`Exported Engineering Telemetry (${ext.toUpperCase()})`);
  }

  update(dt) {
    if (this.drawerOpen) {
      this._refreshAccum += dt;
      if (this._refreshAccum >= 0.085) { // 12 Hz crisp telemetry refresh
        this._refreshAccum = 0;
        this.refreshDrawerNow();
      }
    }

    if (this.fullScreenOpen && this.activeFullTab === 'charts') {
      this._chartAccum += dt;
      if (this._chartAccum >= 0.25) { // 4 Hz smooth canvas chart redraw
        this._chartAccum = 0;
        this.renderChartsAndSummary();
      }
    }
  }

  refreshDrawerNow() {
    const p = this.game.physics;
    const s = this.game.simulation;
    const n = this.game.navigation;
    const a = this.game.atmosphere;

    if (!this.el.drawer) return;

    // 1. Vehicle Dynamics
    this.el.tdSpeed.textContent = `${p.forwardSpeed.toFixed(2)} m/s (${(p.forwardSpeed * 3.6).toFixed(1)} km/h)`;
    this.el.tdAccel.textContent = `${p.longitudinalAccel >= 0 ? '+' : ''}${p.longitudinalAccel.toFixed(2)} m/s²`;
    this.el.tdAttitude.textContent = `Hdg ${p.headingDeg.toFixed(1)}° | P ${p.pitchDeg.toFixed(1)}° | R ${p.rollDeg.toFixed(1)}°`;
    this.el.tdYawRate.textContent = `${p.yawRateDegS >= 0 ? '+' : ''}${p.yawRateDegS.toFixed(1)} °/s`;
    this.el.tdClearance.textContent = `${(p.groundClearanceM * 100).toFixed(1)} cm (${p.groundClearanceM.toFixed(2)} m)`;
    this.el.tdTurnRad.textContent = Number.isFinite(p.turningRadiusM)
      ? `${Math.abs(p.turningRadiusM).toFixed(2)} m (${p.turningRadiusM > 0 ? 'L' : 'R'})`
      : '∞ (Straight)';
    this.el.tdMassCog.textContent = `${p.mass.toFixed(0)} kg | CoG (${p.cogLocal.x.toFixed(2)}, ${p.cogLocal.y.toFixed(2)}, ${p.cogLocal.z.toFixed(2)}) m`;
    this.el.tdForcesLongLat.textContent = `F_long: ${p.totalLongitudinalForceN.toFixed(0)} N | F_lat: ${p.totalLateralForceN.toFixed(0)} N`;
    this.el.tdForcesRrBrk.textContent = `F_rr: ${p.totalRollingResistanceN.toFixed(0)} N | F_brk: ${p.totalBrakingForceN.toFixed(0)} N`;
    this.el.tdSlopeGrav.textContent = `${p.slopeGravityForceN.toFixed(0)} N (Az ${p.slopeDirectionDeg.toFixed(0)}°)`;
    this.el.tdTracLimit.textContent = `${p.totalTractionLimitN.toFixed(0)} N`;
    this.el.tdStability.textContent = `${p.stabilityMarginPct.toFixed(0)}% (${p.groundedWheels}/6 Grounded)`;
    this.el.tdStability.style.color = p.stabilityMarginPct < 40 ? '#ff5252' : (p.stabilityMarginPct < 68 ? '#ffd740' : '#00ff88');

    if (this.el.btnToggleCreep) {
      this.el.btnToggleCreep.textContent = p.lowRangeCreepMode ? '⚙ CREEP GEAR: ON [X]' : '⚙ CREEP GEAR: OFF [X]';
      this.el.btnToggleCreep.classList.toggle('active', p.lowRangeCreepMode);
    }

    // 2. Six-Wheel Matrix
    for (let i = 0; i < 6; i++) {
      const w = p.wheels[i];
      const c = this.wheelCells[i];
      c.dot.className = `contact-dot ${w.grounded ? 'on' : 'off'}`;
      c.rpm.textContent = w.rpm.toFixed(1);
      c.omg.textContent = w.angularSpeed.toFixed(1);
      c.trq.textContent = w.driveTorqueNm.toFixed(0);
      c.str.textContent = `${w.steerDeg.toFixed(0)}°`;
      c.fn.textContent = w.normalForce.toFixed(0);
      const slpPct = Math.round(w.slipRatio * 100);
      c.slp.textContent = `${slpPct}%`;
      c.slp.style.color = slpPct > 42 ? '#ff5252' : (slpPct > 20 ? '#ffd740' : '#d8e4f0');
      c.snk.textContent = w.sinkageCm.toFixed(1);
      c.ftr.textContent = w.tractionForceN.toFixed(0);
      c.sus.textContent = w.suspensionTravelCm.toFixed(1);
    }

    // 3. Mars Environment Physics
    this.el.tdEnvGravPress.textContent = `g = ${s.gravity.toFixed(2)} m/s² | P = ${s.pressurePa.toFixed(1)} Pa`;
    this.el.tdEnvTempDens.textContent = `T = ${s.temperatureC.toFixed(1)} °C | ρ = ${s.atmosphericDensityKgM3.toFixed(4)} kg/m³`;
    this.el.tdEnvWind.textContent = `${s.windSpeedMs.toFixed(1)} m/s from ${s.windDirectionDeg.toFixed(0)}° (F_aero ${p.aerodynamicDragN.toFixed(1)} N)`;
    this.el.tdEnvSolarDust.textContent = `${s.solarIrradianceWm2.toFixed(0)} W/m² | Dust ${s.dustConcentrationMgM3.toFixed(2)} mg/m³ (τ=${s.dustOpticalDepth.toFixed(2)})`;
    this.el.tdEnvVisElev.textContent = `Vis ${a.getVisibilityMeters()} m | MOLA ${s.molaElevationM.toFixed(1)} m`;
    const profTag = p.currentSoilProfile ? p.currentSoilProfile.modelTag : 'Bekker-Janosi Sim';
    this.el.tdEnvSoil.textContent = `${p.currentSoil} [${profTag}]`;

    // 4. Power & Thermal
    const curSign = s.batteryCurrentA >= 0 ? '+' : '';
    this.el.tdPwrSocVolt.textContent = `${s.batteryPct.toFixed(1)}% (${s.remainingEnergyWh.toFixed(0)} Wh) | ${s.batteryVoltageV.toFixed(2)} V`;
    this.el.tdPwrCurrMode.textContent = `I_bat ${curSign}${s.batteryCurrentA.toFixed(2)} A | Mode: ${s.powerModeState}`;
    this.el.tdPwrCurrMode.style.color = s.powerModeState === 'NOMINAL' ? '#00ff88' : '#ffab00';
    this.el.tdPwrGen.textContent = `Solar ${s.solarWatts.toFixed(0)} W (Clean ${(s.panelDustFactor * 100).toFixed(0)}%) + MMRTG ${s.mmrtgWatts.toFixed(0)} W`;
    this.el.tdPwrLoads.textContent = `Total ${s.powerDrawWatts.toFixed(0)} W (Drv ${s.driveMotorWatts.toFixed(0)}W • Inst ${s.instrumentWatts.toFixed(0)}W • Htr ${s.heaterWatts.toFixed(0)}W)`;
    this.el.tdPwrEndurance.textContent = Number.isFinite(s.estimatedEnduranceMin)
      ? `${s.estimatedEnduranceMin.toFixed(1)} min at current net load`
      : 'SUSTAINABLE (Net Charging)';
    this.el.tdThermNodes.textContent = `Bat ${s.tempBatteryC.toFixed(1)}°C | Mot ${s.tempMotorC.toFixed(1)}°C | WEB ${s.tempElectronicsC.toFixed(1)}°C | Mast ${s.tempInstrumentC.toFixed(1)}°C`;
    this.el.tdThermWarn.textContent = s.thermalWarnings.length > 0
      ? `⚠ ${s.thermalWarnings.join(' • ')}`
      : (s.heaterWatts > 2 ? `Survival Heaters Active (${s.heaterWatts.toFixed(0)} W)` : 'All Thermal Nodes Nominal');

    // 5. Navigation & IMU
    this.el.tdNavEnu.textContent = `X ${p.position.x.toFixed(1)}m, Y ${p.position.y.toFixed(1)}m, Z ${p.position.z.toFixed(1)}m`;
    this.el.tdNavLatLon.textContent = `${n.latitudeDeg.toFixed(5)}° N, ${n.longitudeDeg.toFixed(5)}° E [SIM]`;
    this.el.tdNavOdom.textContent = `True ${n.trueGroundDistanceM.toFixed(1)}m | Wheel Odom ${n.wheelOdometryM.toFixed(1)}m (Slip Δ ${n.odometryDriftM >= 0 ? '+' : ''}${n.odometryDriftM.toFixed(1)}m)`;
    const wpTxt = n.waypointDistanceM !== null ? `${n.waypointDistanceM.toFixed(1)} m (${n.waypointBearingDeg.toFixed(0)}°)` : 'None';
    this.el.tdNavUncert.textContent = `±${n.positionUncertaintyM.toFixed(2)} m | Waypoint: ${wpTxt}`;
    this.el.tdNavImuAcc.textContent = `Accel (${n.imuAccelBodyMs2.x.toFixed(2)}, ${n.imuAccelBodyMs2.y.toFixed(2)}, ${n.imuAccelBodyMs2.z.toFixed(2)}) m/s²`;
    this.el.tdNavImuGyr.textContent = `Gyro (${n.imuGyroBodyDegS.pitchRate.toFixed(1)}, ${n.imuGyroBodyDegS.yawRate.toFixed(1)}, ${n.imuGyroBodyDegS.rollRate.toFixed(1)}) °/s`;
    this.el.tdNavStatus.textContent = `${n.navigationStatus} | Safe Hdg ${n.recommendedSafeHeadingDeg.toFixed(0)}° (${n.forwardHazardLevel})`;

    // 6. Active Engineering Safety Warnings
    if (n.warnings.length > 0) {
      this.el.tdSafetyAlerts.innerHTML = n.warnings
        .slice(0, 3)
        .map((w) => `<div class="eng-alert-item ${w.level.toLowerCase()}">▲ ${w.text}</div>`)
        .join('');
    } else {
      this.el.tdSafetyAlerts.innerHTML = `<div class="eng-alert-item ok">✓ ALL PLANETARY MOBILITY & POWER MARGINS NOMINAL</div>`;
    }
  }

  /**
   * Renders all 7 Engineering Canvas Plots & Mission Performance Summary
   */
  renderChartsAndSummary() {
    this._syncPauseButton();
    const hist = this.game.simulation.history;
    const p = this.game.physics;
    const s = this.game.simulation;
    const n = this.game.navigation;

    // 1. Speed & Longitudinal Acceleration
    this._drawTimeSeries(this.el.cSpeedAccel, hist, [
      { key: 'speedMs', label: 'Speed (m/s)', color: '#00e5ff' },
      { key: 'accelMs2', label: 'Accel (m/s²)', color: '#ff9100' }
    ], -6, 11);

    // 2. 6-Wheel Instantaneous Comparison Bar Chart
    this._drawWheelComparisonBars(this.el.cWheels, p.wheels);

    // 3. Electrical Power Balance (Gen vs Total Load vs Drive Motors)
    this._drawTimeSeries(this.el.cPower, hist, [
      { key: 'genWatts', label: 'Gen (Solar+MMRTG W)', color: '#00ff88' },
      { key: 'loadWatts', label: 'Total Load (W)', color: '#ff5252' },
      { key: 'driveWatts', label: 'Drive Motors (W)', color: '#ffd740' }
    ], 0, 650);

    // 4. Battery SoC (%) & Bus Voltage (V)
    this._drawTimeSeries(this.el.cBattery, hist, [
      { key: 'socPct', label: 'Battery SoC (%)', color: '#00ff88' },
      { key: 'voltageV', label: 'Bus Voltage (V)', color: '#40c4ff' }
    ], 0, 105);

    // 5. Wheel Slip (%) per Axle
    this._drawTimeSeries(this.el.cSlip, hist, [
      { key: 'frontSlipPct', label: 'Front Axle Slip (%)', color: '#00e5ff' },
      { key: 'midSlipPct', label: 'Mid Axle Slip (%)', color: '#ffd740' },
      { key: 'rearSlipPct', label: 'Rear Axle Slip (%)', color: '#ff5252' }
    ], 0, 100);

    // 6. Slope Gravity Shear vs Traction Limit (N)
    this._drawTimeSeries(this.el.cSlopeTrac, hist, [
      { key: 'tracLimitN', label: 'Traction Limit (N)', color: '#00ff88' },
      { key: 'tractionN', label: 'Applied Traction (N)', color: '#00e5ff' },
      { key: 'slopeGravN', label: 'Slope Gravity Shear (N)', color: '#ff6d00' }
    ], -1500, 4200);

    // 7. 4-Node Thermal History (°C)
    this._drawTimeSeries(this.el.cThermal, hist, [
      { key: 'tempElecC', label: 'WEB Elec (°C)', color: '#00ff88' },
      { key: 'tempBatC', label: 'Battery (°C)', color: '#40c4ff' },
      { key: 'tempMotC', label: 'Motors (°C)', color: '#ffab00' },
      { key: 'tempAmbC', label: 'Mars Air (°C)', color: '#ff5252' }
    ], -90, 65);

    // 8. Mission & Terramechanics Summary
    if (this.el.summaryBox) {
      let peakSpeed = 0;
      let peakSlope = 0;
      let peakPower = 0;
      let slipAcc = 0;
      for (let i = 0; i < hist.length; i++) {
        peakSpeed = Math.max(peakSpeed, Math.abs(hist[i].speedMs));
        peakSlope = Math.max(peakSlope, hist[i].slopeDeg);
        peakPower = Math.max(peakPower, hist[i].loadWatts);
        slipAcc += hist[i].avgSlipPct;
      }
      const meanSlip = hist.length > 0 ? (slipAcc / hist.length) : 0;

      this.el.summaryBox.innerHTML = `
        <div class="sum-stat"><span>Sim Elapsed</span><strong>${s.simElapsedSec.toFixed(0)} s (${hist.length} pts)</strong></div>
        <div class="sum-stat"><span>Solver Rate</span><strong>${p.fixedStepHz} Hz Fixed-Step</strong></div>
        <div class="sum-stat"><span>Peak Speed</span><strong>${peakSpeed.toFixed(2)} m/s</strong></div>
        <div class="sum-stat"><span>Peak Slope</span><strong>${peakSlope.toFixed(1)}°</strong></div>
        <div class="sum-stat"><span>Mean Wheel Slip</span><strong>${meanSlip.toFixed(1)}%</strong></div>
        <div class="sum-stat"><span>Odometry Drift</span><strong>${n.odometryDriftM >= 0 ? '+' : ''}${n.odometryDriftM.toFixed(2)} m</strong></div>
        <div class="sum-stat"><span>Pos Uncertainty</span><strong>±${n.positionUncertaintyM.toFixed(2)} m</strong></div>
        <div class="sum-stat"><span>Peak Load</span><strong>${peakPower.toFixed(0)} W</strong></div>
        <div class="sum-stat"><span>LIBS / Cores</span><strong>${this.game.science.scannedCount} / ${this.game.science.samplesCollected.length}</strong></div>
        <div class="sum-stat"><span>Hull Integrity</span><strong>${p.hullIntegrity.toFixed(0)}%</strong></div>
      `;
    }
  }

  _drawTimeSeries(canvas, history, seriesList, minY, maxY) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background & grid
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const padL = 42;
    const padR = 12;
    const padT = 24;
    const padB = 20;
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#7f92a8';

    for (let g = 0; g <= 4; g++) {
      const gy = padT + (ph * g) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(w - padR, gy);
      ctx.stroke();

      const val = maxY - ((maxY - minY) * g) / 4;
      ctx.fillText(val.toFixed(0), 4, gy + 3);
    }

    // Legend
    let lx = padL;
    seriesList.forEach((s) => {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, 7, 10, 8);
      ctx.fillStyle = '#d2deec';
      ctx.fillText(s.label, lx + 14, 15);
      lx += ctx.measureText(s.label).width + 26;
    });

    if (history.length < 2) {
      ctx.fillStyle = '#6f8299';
      ctx.fillText('Drive rover to populate real-time telemetry history...', padL + 16, padT + ph / 2);
      return;
    }

    // Zero reference line if minY < 0 < maxY
    if (minY < 0 && maxY > 0) {
      const zy = padT + ph * (maxY / (maxY - minY));
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, zy);
      ctx.lineTo(w - padR, zy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    seriesList.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const x = padL + (i / Math.max(1, history.length - 1)) * pw;
        const raw = history[i][s.key] ?? 0;
        const clamped = Math.max(minY, Math.min(maxY, raw));
        const y = padT + ph * ((maxY - clamped) / (maxY - minY));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  _drawWheelComparisonBars(canvas, wheels) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(42, 7, 10, 8);
    ctx.fillStyle = '#d2deec';
    ctx.fillText('Normal Load F_N (N)', 56, 15);

    ctx.fillStyle = '#76ff03';
    ctx.fillRect(190, 7, 10, 8);
    ctx.fillStyle = '#d2deec';
    ctx.fillText('|Traction| (N)', 204, 15);

    ctx.fillStyle = '#ff9100';
    ctx.fillRect(305, 7, 10, 8);
    ctx.fillStyle = '#d2deec';
    ctx.fillText('Sinkage×100 (mm)', 319, 15);

    const padL = 42;
    const padB = 22;
    const padT = 26;
    const ph = h - padT - padB;
    const slotW = (w - padL - 14) / 6;
    const maxScale = 1200;

    for (let i = 0; i < 6; i++) {
      const wh = wheels[i];
      const bx = padL + i * slotW + 6;
      const bw = Math.max(8, (slotW - 18) / 3);

      const hFn = Math.min(1, wh.normalForce / maxScale) * ph;
      const hTr = Math.min(1, Math.abs(wh.tractionForceN) / maxScale) * ph;
      const hSk = Math.min(1, (wh.sinkageCm * 100) / maxScale) * ph;

      ctx.fillStyle = wh.grounded ? '#00e5ff' : '#ff1744';
      ctx.fillRect(bx, padT + ph - hFn, bw, hFn);

      ctx.fillStyle = '#76ff03';
      ctx.fillRect(bx + bw + 2, padT + ph - hTr, bw, hTr);

      ctx.fillStyle = '#ff9100';
      ctx.fillRect(bx + (bw + 2) * 2, padT + ph - hSk, bw, hSk);

      ctx.fillStyle = wh.grounded ? '#e2ecf7' : '#ff5252';
      ctx.fillText(wh.name, bx + bw - 2, h - 6);
    }
  }
}
