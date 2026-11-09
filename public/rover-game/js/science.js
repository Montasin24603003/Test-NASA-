import * as THREE from 'three';

/**
 * Mineralogical & Astrobiological Target Classes
 * Note: Elemental compositions (Si, Fe, Mg, Ca, Al, Na wt%) and oxide wt% are
 * SIMULATED GEOCHEMICAL PROFILES inspired by Mars 2020 Jezero crater lithologies
 * (Máaz basalt, Séítah olivine cumulate, Shenck/Hogwallow mudstone, marginal carbonate).
 */
export const MINERAL_CLASSES = [
  {
    id: 'olivine_basalt',
    name: 'Olivine-Rich Cumulate Basalt',
    category: 'Igneous (Mafic Cumulate)',
    color: 0x4b533b,
    emissive: 0x162210,
    elementsWtPct: { Si: 20.9, Fe: 15.1, Mg: 14.5, Ca: 4.8, Al: 3.9, Na: 1.4 },
    chemistry: { SiO2: '44.8%', FeO: '19.4%', MgO: '24.1%', CaO: '6.7%', Al2O3: '7.4%', Na2O: '1.9%' },
    rockHardnessMPa: 145,
    hydration: '1.8%',
    biosignatureIndex: 'Low (0.18)',
    credits: 60,
    canSample: true,
    advisorSummary: 'SIMULATED INTERPRETATION: Mafic igneous floor unit crystallized from Mg/Fe-rich magma; trace carbonate veins indicate brief groundwater exposure.'
  },
  {
    id: 'phyllosilicate_mudstone',
    name: 'Smectite Clay Lacustrine Mudstone',
    category: 'Sedimentary (High Astrobiology Priority)',
    color: 0xa46c49,
    emissive: 0x2c180c,
    elementsWtPct: { Si: 24.8, Fe: 9.4, Mg: 4.6, Ca: 2.9, Al: 8.7, Na: 1.8 },
    chemistry: { SiO2: '53.2%', Al2O3: '16.5%', FeO: '12.1%', MgO: '7.6%', CaO: '4.1%', Na2O: '2.4%' },
    rockHardnessMPa: 58,
    hydration: '8.9%',
    biosignatureIndex: 'Very High (0.89)',
    credits: 110,
    canSample: true,
    advisorSummary: 'SIMULATED INTERPRETATION: Fine-grained lakebed smectite clay formed in low-energy standing water—prime matrix for preserving ancient organic matter.'
  },
  {
    id: 'carbonate_outcrop',
    name: 'Hydrated Mg-Carbonate Margin Unit',
    category: 'Evaporite / Marginal Lacustrine',
    color: 0xc99c72,
    emissive: 0x2e2010,
    elementsWtPct: { Si: 14.5, Fe: 11.0, Mg: 11.1, Ca: 7.0, Al: 2.4, Na: 0.9 },
    chemistry: { MgCO3: '38.4%', SiO2: '31.0%', FeO: '14.2%', CaO: '9.8%', Al2O3: '4.5%', Na2O: '1.2%' },
    rockHardnessMPa: 82,
    hydration: '6.4%',
    biosignatureIndex: 'High (0.82)',
    credits: 95,
    canSample: true,
    advisorSummary: 'SIMULATED INTERPRETATION: Marginal carbonate precipitate analogous to ancient Lake Jezero shorelines; high priority for Mars Sample Return caching.'
  },
  {
    id: 'hydrothermal_silica',
    name: 'Opaline Silica Sinter Nodule',
    category: 'Hydrothermal Alteration',
    color: 0xd8c3ab,
    emissive: 0x2a241d,
    elementsWtPct: { Si: 39.5, Fe: 3.9, Mg: 0.8, Ca: 1.1, Al: 1.6, Na: 0.7 },
    chemistry: { SiO2: '84.6%', FeO: '5.1%', Al2O3: '3.0%', CaO: '1.5%', MgO: '1.3%', Na2O: '0.9%' },
    rockHardnessMPa: 96,
    hydration: '7.2%',
    biosignatureIndex: 'Very High (0.93)',
    credits: 130,
    canSample: true,
    advisorSummary: 'SIMULATED INTERPRETATION: Amorphous hydrated silica consistent with ancient hydrothermal spring/fumarole precipitation—premier biosignature target.'
  },
  {
    id: 'iron_meteorite',
    name: 'Kamacite Iron-Nickel Meteorite',
    category: 'Exogenous Metallic Meteorite',
    color: 0x565b66,
    emissive: 0x121622,
    elementsWtPct: { Si: 0.2, Fe: 91.2, Mg: 0.1, Ca: 0.1, Al: 0.1, Na: 0.0 },
    chemistry: { Fe: '91.2%', Ni: '7.9%', Co: '0.5%', Si: '0.2%', Mg: '0.1%', Ca: '0.1%' },
    rockHardnessMPa: 310,
    hydration: '0.0%',
    biosignatureIndex: 'Calibration Target (0.02)',
    credits: 85,
    canSample: false,
    advisorSummary: 'SIMULATED INTERPRETATION: Metallic Ni-Fe asteroid fragment preserved in Mars hyper-arid air; too hard for coring bit—used for SuperCam LIBS calibration.'
  },
  {
    id: 'delta_conglomerate',
    name: 'Fluvial Rounded-Pebble Conglomerate',
    category: 'Fluvial Sedimentary Structure',
    color: 0x8e5233,
    emissive: 0x241208,
    elementsWtPct: { Si: 24.0, Fe: 12.3, Mg: 6.8, Ca: 6.2, Al: 6.9, Na: 2.1 },
    chemistry: { SiO2: '51.4%', FeO: '15.8%', Al2O3: '13.0%', MgO: '11.2%', CaO: '8.7%', Na2O: '2.8%' },
    rockHardnessMPa: 105,
    hydration: '4.5%',
    biosignatureIndex: 'Moderate-High (0.68)',
    credits: 90,
    canSample: true,
    advisorSummary: 'SIMULATED INTERPRETATION: Water-rounded cobbles cemented in sandstone matrix—diagnostic indicator of sustained ancient fluvial transport (~1.2 m/s).'
  }
];

/**
 * NASA-Style Scientific Instrument Simulation:
 * - SuperCam Pulsed 1064nm LIBS Laser Elemental Spectroscopy (Si, Fe, Mg, Ca, Al, Na)
 * - Rotary-Percussive Coring Drill (0-63.5mm depth, 420W load, Tube ID, Hermetic Sealing & Cache)
 * - Mastcam-Z Multispectral Aiming, Telephoto Zoom, Target ID & Metadata Logging
 */
export class ScienceExplorationSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.targetsGroup = new THREE.Group();
    this.targetsGroup.name = 'scienceTargetsGroup';
    this.scene.add(this.targetsGroup);

    this.targets = [];
    this.solidColliders = [];
    this.nearestTarget = null;
    this.nearestDist = Infinity;

    // Persistent Science Log Inventories
    this.scannedCount = 0;
    this.libsObservations = [];  // Stored SuperCam LIBS spectroscopy logs
    this.samplesCollected = [];  // Sealed Titanium Sample Tubes in belly cache
    this.photos = [];            // Mastcam-Z / Hazcam watermarked observations
    this.scienceCredits = 0;
    this.lastAnalysisReport = null;

    // Progressive Rotary-Percussive Drilling State
    this.drillOperation = null;  // Active when progressive coring is running

    // Optional external AI Advisor bridge hook
    this.externalAdvisorCallback = null;

    this._buildTargetReticle();
  }

  setExternalAdvisorHook(fn) {
    this.externalAdvisorCallback = fn;
  }

  _buildTargetReticle() {
    this.reticleGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.95, 1.12, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.reticleRing = new THREE.Mesh(ringGeo, ringMat);

    const beaconGeo = new THREE.OctahedronGeometry(0.18, 0);
    this.reticleDiamond = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    this.reticleDiamond.position.y = 1.65;

    this.reticleGroup.add(this.reticleRing, this.reticleDiamond);
    this.reticleGroup.visible = false;
    this.scene.add(this.reticleGroup);
  }

  populateRegionTargets(regionId) {
    while (this.targetsGroup.children.length > 0) {
      const c = this.targetsGroup.children[0];
      this.targetsGroup.remove(c);
    }
    this.targets = [];
    this.solidColliders = [];
    this.drillOperation = null;

    const coords = [
      { x: -7.5,  z: -16.0, scale: 0.95, mineralIdx: 0, code: 'TGT-ALPHA-01' },
      { x: 11.5,  z: -24.0, scale: 1.05, mineralIdx: 1, code: 'TGT-BELLE-02' },
      { x: -16.0, z: -42.0, scale: 1.25, mineralIdx: 2, code: 'TGT-MAJ-03'   },
      { x: 22.0,  z: -56.0, scale: 1.40, mineralIdx: 5, code: 'STR-DELTA-04' },
      { x: -26.0, z: -76.0, scale: 1.15, mineralIdx: 3, code: 'TGT-OPAL-05'  },
      { x: 6.0,   z: -88.0, scale: 0.90, mineralIdx: 4, code: 'MET-IRON-06'  },
      { x: -19.5, z: -112.0,scale: 1.35, mineralIdx: 1, code: 'TGT-SEITAH-07'},
      { x: 34.0,  z: -118.0,scale: 1.55, mineralIdx: 2, code: 'STR-BENCH-08' },
      { x: -15.0, z: -150.0,scale: 1.15, mineralIdx: 3, code: 'TGT-DOURBES-09'},
      { x: 18.0,  z: -168.0,scale: 1.20, mineralIdx: 5, code: 'STR-CHANNEL-10'},
      { x: -42.0, z: -30.0, scale: 1.30, mineralIdx: 1, code: 'TGT-WEST-11'  },
      { x: 46.0,  z: -18.0, scale: 1.10, mineralIdx: 0, code: 'TGT-EAST-12'  },
      { x: -58.0, z: -98.0, scale: 1.65, mineralIdx: 2, code: 'STR-SCARP-13' },
      { x: 58.0,  z: -95.0, scale: 1.30, mineralIdx: 3, code: 'TGT-SILICA-14'},
      { x: -4.0,  z: -198.0,scale: 1.45, mineralIdx: 1, code: 'TGT-CACHE-15' },
      { x: 28.0,  z: 36.0,  scale: 1.15, mineralIdx: 4, code: 'MET-SOUTH-16' },
      { x: -35.0, z: 42.0,  scale: 1.25, mineralIdx: 5, code: 'STR-FAN-17'   },
      { x: 0.0,   z: -245.0,scale: 1.75, mineralIdx: 3, code: 'STR-EXPED-18' }
    ];

    coords.forEach((pt, idx) => {
      const mineral = MINERAL_CLASSES[(pt.mineralIdx + regionId.length) % MINERAL_CLASSES.length];
      const y = this.world.getElevationAt(pt.x, pt.z);

      const group = new THREE.Group();
      group.position.set(pt.x, y, pt.z);

      const geo = new THREE.DodecahedronGeometry(0.75 * pt.scale, 1);
      const pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const vx = pos.getX(v);
        const vy = pos.getY(v);
        const vz = pos.getZ(v);
        const terrace = 1.0 + 0.18 * Math.sin(vy * 7.0 + idx);
        pos.setXYZ(v, vx * terrace * 1.15, vy * 0.72, vz * terrace);
      }
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: mineral.color,
        emissive: mineral.emissive,
        emissiveIntensity: 0.45,
        roughness: 0.78,
        metalness: mineral.id === 'iron_meteorite' ? 0.65 : 0.12
      });

      const rockMesh = new THREE.Mesh(geo, mat);
      rockMesh.position.y = 0.32 * pt.scale;
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      group.add(rockMesh);

      const pinGeo = new THREE.RingGeometry(0.16, 0.23, 16);
      const pinMat = new THREE.MeshBasicMaterial({
        color: mineral.canSample ? 0xffb830 : 0x00e5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.y = 1.15 * pt.scale + 0.45;
      group.add(pin);

      const boreGeo = new THREE.CircleGeometry(0.14, 16);
      boreGeo.rotateX(-Math.PI / 2);
      const borePatch = new THREE.Mesh(
        boreGeo,
        new THREE.MeshBasicMaterial({ color: 0xe6dfd5 })
      );
      borePatch.position.set(0, 0.68 * pt.scale, 0);
      borePatch.visible = false;
      group.add(borePatch);

      this.targetsGroup.add(group);

      this.targets.push({
        id: `${regionId}_${pt.code}`,
        index: idx,
        code: pt.code,
        mineral,
        position: new THREE.Vector3(pt.x, y + 0.35 * pt.scale, pt.z),
        scale: pt.scale,
        group,
        rockMesh,
        pin,
        borePatch,
        scanned: false,
        sampled: false,
        lastObservation: null
      });

      this.solidColliders.push({
        x: pt.x,
        z: pt.z,
        baseY: y,
        height: 0.85 * pt.scale,
        radius: 0.75 * pt.scale,
        radiusSq: Math.pow(0.75 * pt.scale, 2),
        climbable: false
      });
    });
  }

  /**
   * Deterministic specimen-specific elemental analysis (Si, Fe, Mg, Ca, Al, Na wt%)
   * Explicitly tagged as a simulated geochemical estimate.
   */
  _generateSimulatedLIBS(target, distanceM, simulation, atmosphere) {
    const base = target.mineral.elementsWtPct || { Si: 22.0, Fe: 13.0, Mg: 8.0, Ca: 5.0, Al: 5.5, Na: 1.5 };
    const seed = target.index * 13.7 + target.position.x * 0.31;
    const vary = (val, k) => Math.max(0, Number((val + Math.sin(seed + k * 2.1) * Math.min(0.6, val * 0.04)).toFixed(1)));

    const elements = {
      Si: `${vary(base.Si, 1)}%`,
      Fe: `${vary(base.Fe, 2)}%`,
      Mg: `${vary(base.Mg, 3)}%`,
      Ca: `${vary(base.Ca, 4)}%`,
      Al: `${vary(base.Al, 5)}%`,
      Na: `${vary(base.Na, 6)}%`
    };

    const tau = simulation ? simulation.dustOpticalDepth : 0.45;
    const pressurePa = simulation ? simulation.pressurePa : 745.0;
    const visM = atmosphere && atmosphere.getVisibilityMeters ? atmosphere.getVisibilityMeters() : 850;
    // LIBS signal-to-noise degrades with stand-off range (1/r^2) and suspended dust extinction
    const snrDb = Math.max(8.5, 36.0 - distanceM * 1.45 - tau * 3.8);

    return {
      provenance: 'SIMULATED SUPERCAM 1064nm LIBS ANALYSIS (Not Real NASA Measurement)',
      targetCode: target.code,
      mineralName: target.mineral.name,
      category: target.mineral.category,
      distanceM: Number(distanceM.toFixed(2)),
      laserShots: 30,
      laserEnergyMj: 14.2,
      conditions: {
        pressurePa: Number(pressurePa.toFixed(1)),
        opticalDepthTau: Number(tau.toFixed(2)),
        visibilityM: visM,
        spectralSnrDb: Number(snrDb.toFixed(1)),
        sol: atmosphere ? atmosphere.solNumber : 45,
        lmst: atmosphere && atmosphere.getLMSTString ? atmosphere.getLMSTString() : '13:00:00 LMST'
      },
      elements,
      oxides: target.mineral.chemistry
    };
  }

  /**
   * Updates proximity target scanner & progressive rotary-percussive drill sequence
   */
  update(dt, roverPos, camera, physics = null, simulation = null, particles = null, onDrillFinished = null) {
    let closest = null;
    let minDist = 9.5; // SuperCam LIBS max stand-off range (~7-9.5m)

    const tNow = performance.now() * 0.0025;
    for (let i = 0; i < this.targets.length; i++) {
      const tgt = this.targets[i];
      if (tgt.pin.visible && camera) {
        tgt.pin.lookAt(camera.position);
        tgt.pin.position.y = (1.15 * tgt.scale + 0.45) + Math.sin(tNow + i) * 0.08;
      }

      const d = roverPos.distanceTo(tgt.position);
      if (d < minDist) {
        minDist = d;
        closest = tgt;
      }
    }

    this.nearestTarget = closest;
    this.nearestDist = closest ? minDist : Infinity;

    if (closest) {
      this.reticleGroup.visible = true;
      this.reticleGroup.position.set(
        closest.position.x,
        this.world.getElevationAt(closest.position.x, closest.position.z) + 0.06,
        closest.position.z
      );
      this.reticleRing.rotation.z += dt * 1.4;
      this.reticleDiamond.rotation.y += dt * 2.5;

      const canDrillNow = closest.scanned && closest.mineral.canSample && !closest.sampled && minDist <= 5.2;
      const colHex = canDrillNow ? 0xffaa00 : (closest.scanned ? 0x00ff88 : 0x00f0ff);
      this.reticleRing.material.color.setHex(colHex);
      this.reticleDiamond.material.color.setHex(colHex);
    } else {
      this.reticleGroup.visible = false;
    }

    // Advance active progressive rotary-percussive coring operation
    if (this.drillOperation) {
      this._stepDrillOperation(dt, roverPos, physics, simulation, particles, onDrillFinished);
    }
  }

  _stepDrillOperation(dt, roverPos, physics, simulation, particles, onDrillFinished) {
    const op = this.drillOperation;
    const tgt = op.target;

    // Safety interlock: abort if rover moves > 0.65 m/s or leaves 5.6m arm reach or enters Safe Mode!
    if ((physics && physics.speedMagnitude > 0.65) || roverPos.distanceTo(tgt.position) > 5.6 || (simulation && simulation.areInstrumentsRestricted())) {
      if (simulation) simulation.activeDrillPowerW = 0.0;
      this.drillOperation = null;
      if (onDrillFinished) {
        onDrillFinished({
          action: 'DRILL_ABORTED',
          reason: 'Coring safety interlock tripped (rover motion or critical power lockout)!'
        });
      }
      return;
    }

    // Continuous 420W rotary-percussive coring load modulated by rock compressive hardness
    const hardnessFactor = THREE.MathUtils.clamp((tgt.mineral.rockHardnessMPa || 90) / 95.0, 0.75, 1.35);
    const drillWatts = 390.0 * hardnessFactor;
    if (simulation) simulation.activeDrillPowerW = drillWatts;
    op.powerWatts = drillWatts;

    op.elapsed += dt;
    const frac = Math.min(1.0, op.elapsed / op.duration);
    op.progressPct = frac * 100.0;

    if (frac < 0.20) {
      op.phase = 'TURRET PRELOAD & STABILIZER CONTACT';
      op.depthMm = 0.0;
    } else if (frac < 0.78) {
      op.phase = 'ROTARY-PERCUSSIVE CORING';
      const coreFrac = (frac - 0.20) / 0.58;
      op.depthMm = coreFrac * op.targetDepthMm;
      if (particles && Math.random() < 0.45) {
        particles.spawnDust(tgt.position.x, tgt.position.y + 0.14, tgt.position.z, 0, 0.95, 0, 0.85);
      }
    } else if (frac < 0.92) {
      op.phase = 'CORE SHEAR BREAKOFF & EXTRACTION';
      op.depthMm = op.targetDepthMm;
    } else {
      op.phase = `HERMETIC TUBE SEALING (${op.tubeId})`;
      op.depthMm = op.targetDepthMm;
    }

    if (frac >= 1.0) {
      if (simulation) simulation.activeDrillPowerW = 0.0;
      const report = this._finalizeSampleCollection(tgt, op.tubeId, op.targetDepthMm, drillWatts, op.solNumber, op.lmst);
      this.drillOperation = null;
      if (onDrillFinished) {
        onDrillFinished(report);
      }
    }
  }

  _finalizeSampleCollection(t, tubeId, depthMm, avgPowerW, solNumber = 45, lmst = '13:00:00 LMST') {
    t.sampled = true;
    t.borePatch.visible = true;
    t.pin.visible = false;
    const bonus = 125;
    this.scienceCredits += bonus;

    const tubeNum = this.samplesCollected.length + 1;
    const sampleRecord = {
      tubeNumber: tubeNum,
      tubeId: tubeId || `M2020-TUBE-${String(tubeNum).padStart(2, '0')}`,
      code: t.code,
      mineralName: t.mineral.name,
      category: t.mineral.category,
      coreDepthMm: Number(depthMm.toFixed(1)),
      avgDrillPowerW: Math.round(avgPowerW),
      sealStatus: 'HERMETICALLY SEALED (CACHE STORED)',
      biosignatureIndex: t.mineral.biosignatureIndex,
      sol: solNumber,
      lmst,
      coordinatesENU: {
        x: Number(t.position.x.toFixed(1)),
        y: Number(t.position.y.toFixed(1)),
        z: Number(t.position.z.toFixed(1))
      },
      timestamp: new Date().toISOString()
    };
    this.samplesCollected.push(sampleRecord);

    const report = {
      action: 'SAMPLE_COLLECTED',
      targetCode: t.code,
      mineral: t.mineral,
      observation: t.lastObservation,
      sampleRecord,
      creditsEarned: bonus
    };
    this.lastAnalysisReport = report;
    this._notifyAdvisor(report);
    return report;
  }

  getInteractionPrompt() {
    if (this.drillOperation) {
      const op = this.drillOperation;
      return {
        type: 'drilling',
        key: `${op.progressPct.toFixed(0)}%`,
        label: `${op.phase} • DEPTH ${op.depthMm.toFixed(1)}/${op.targetDepthMm}mm • ${Math.round(op.powerWatts)}W (HOLD POSITION)`
      };
    }

    if (!this.nearestTarget) return null;
    const t = this.nearestTarget;
    if (!t.scanned) {
      return {
        type: 'scan',
        key: 'E',
        label: `SUPERCAM LIBS LASER SCAN ${t.code} (${this.nearestDist.toFixed(1)}m)`
      };
    }
    if (t.mineral.canSample && !t.sampled) {
      if (this.nearestDist <= 5.2) {
        return {
          type: 'sample',
          key: 'E',
          label: `DEPLOY CORING DRILL (63.5mm / ~400W): ${t.mineral.name}`
        };
      } else {
        return {
          type: 'approach',
          key: 'DRIVE CLOSER',
          label: `APPROACH <= 5.0m FOR ROBOTIC ARM CORING (${this.nearestDist.toFixed(1)}m)`
        };
      }
    }
    return {
      type: 'inspect',
      key: 'E',
      label: `INSPECT LIBS & SAMPLE LOG: ${t.mineral.name}`
    };
  }

  /**
   * Executes player 'E' scientific interaction.
   * Pass options.asyncDrill = true during live 60 FPS gameplay for progressive 2.6s coring simulation!
   */
  interact(rover, particles, audio, simulation, options = {}) {
    if (this.drillOperation) {
      return { action: 'DRILL_IN_PROGRESS', drillOperation: this.drillOperation };
    }
    if (!this.nearestTarget) return null;

    // Enforce Electrical Power Bus Restrictions (<10% SoC or Safe Mode)
    if (simulation && typeof simulation.areInstrumentsRestricted === 'function' && simulation.areInstrumentsRestricted()) {
      return {
        action: 'POWER_RESTRICTED',
        reason: `Instrument Power Lockout (${simulation.batteryPct.toFixed(1)}% SoC). Recharge >= 10% before firing LIBS or Coring Drill.`
      };
    }

    const t = this.nearestTarget;
    const atmosphere = options.atmosphere || null;

    if (!t.scanned) {
      // 1. Perform Simulated SuperCam 1064nm LIBS Elemental Spectroscopy!
      t.scanned = true;
      this.scannedCount++;
      this.scienceCredits += t.mineral.credits;
      t.pin.material.color.setHex(t.mineral.canSample ? 0x00ff88 : 0x7a8a99);
      if (!t.mineral.canSample) t.pin.visible = false;

      const laserOrig = rover.getLaserOriginWorld();
      const slantDist = laserOrig.distanceTo(t.position);
      particles.fireLaser(laserOrig, t.position, 0.95);
      audio.playLaserZap();
      simulation.consumeInstantEnergy(420);
      if (typeof simulation.triggerLaserCapacitorLoad === 'function') {
        simulation.triggerLaserCapacitorLoad();
      }

      const observation = this._generateSimulatedLIBS(t, slantDist, simulation, atmosphere);
      t.lastObservation = observation;
      this.libsObservations.unshift(observation);

      const report = {
        action: 'SCAN_COMPLETE',
        targetCode: t.code,
        mineral: t.mineral,
        observation,
        creditsEarned: t.mineral.credits
      };
      this.lastAnalysisReport = report;
      this._notifyAdvisor(report);
      return report;
    }

    if (t.mineral.canSample && !t.sampled && this.nearestDist <= 5.2) {
      const nextNum = this.samplesCollected.length + 1;
      const tubeId = `M2020-TUBE-${String(nextNum).padStart(2, '0')}`;
      const solNum = atmosphere ? atmosphere.solNumber : 45;
      const lmstStr = atmosphere && atmosphere.getLMSTString ? atmosphere.getLMSTString() : '13:00:00 LMST';

      if (options.asyncDrill) {
        // Progressive real-time 2.6s rotary-percussive drilling sequence!
        rover.triggerSampleDrillAnimation(2.75);
        audio.playDrillSound();
        this.drillOperation = {
          target: t,
          tubeId,
          elapsed: 0.0,
          duration: 2.6,
          progressPct: 0.0,
          depthMm: 0.0,
          targetDepthMm: 63.5,
          powerWatts: 410.0,
          phase: 'TURRET PRELOAD & STABILIZER CONTACT',
          solNumber: solNum,
          lmst: lmstStr
        };
        return {
          action: 'DRILLING_STARTED',
          targetCode: t.code,
          tubeId,
          mineral: t.mineral
        };
      }

      // Synchronous completion path (used by automated test suite)
      rover.triggerSampleDrillAnimation(1.65);
      audio.playDrillSound();
      simulation.consumeInstantEnergy(780);
      for (let i = 0; i < 18; i++) {
        particles.spawnDust(t.position.x, t.position.y + 0.15, t.position.z, 0, 1.2, 0, 1.1);
      }
      return this._finalizeSampleCollection(t, tubeId, 63.5, 415.0, solNum, lmstStr);
    }

    return {
      action: 'INSPECT_REPORT',
      targetCode: t.code,
      mineral: t.mineral,
      observation: t.lastObservation,
      creditsEarned: 0
    };
  }

  /**
   * Identifies any geological target currently framed inside camera FOV
   */
  findTargetInCameraView(camera, maxRangeM = 55.0) {
    if (!camera) return null;
    const camPos = camera.position;
    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      const toTgt = t.position.clone().sub(camPos);
      const dist = toTgt.length();
      if (dist > maxRangeM || dist < 0.5) continue;
      toTgt.divideScalar(dist);
      const cosAng = camDir.dot(toTgt);
      if (cosAng > 0.90) { // Within ~25 deg cone of optical axis
        const score = dist * (1.05 - cosAng);
        if (score < bestScore) {
          bestScore = score;
          best = { target: t, distanceM: Number(dist.toFixed(1)) };
        }
      }
    }
    return best;
  }

  /**
   * Captures a Mastcam-Z / Hazcam engineering observation with optical zoom,
   * dust degradation metadata, coordinates, Sol timestamp & target identification.
   */
  capturePhoto(graphics, regionName, solNumber, lmstStr, cameraLabel, roverPos, audio, extraMeta = {}) {
    const rawUrl = graphics.captureScreenshotDataURL();
    audio.playCameraShutter();

    const focalMm = extraMeta.focalLengthMm || 34;
    const stormInt = extraMeta.stormIntensity || 0;
    const latStr = typeof extraMeta.latDeg === 'number' ? `${extraMeta.latDeg.toFixed(4)}°N` : '';
    const lonStr = typeof extraMeta.lonDeg === 'number' ? `${extraMeta.lonDeg.toFixed(4)}°E` : '';
    const framed = this.findTargetInCameraView(graphics.camera);
    const targetTag = framed ? `${framed.target.code} (${framed.distanceM}m)` : 'TERRAIN SURVEY';
    const opticalQuality = stormInt > 0.45
      ? `DUST DEGRADED (τ=${(extraMeta.tau || 2.1).toFixed(2)})`
      : 'NOMINAL SNR';

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 960;
        c.height = Math.round(960 * (img.height / Math.max(1, img.width)));
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);

        // Simulated dust-storm optical haze/grain degradation on raw sensor frame
        if (stormInt > 0.25) {
          ctx.fillStyle = `rgba(178, 92, 48, ${(stormInt * 0.24).toFixed(2)})`;
          ctx.fillRect(0, 0, c.width, c.height);
        }

        // Stamp bottom 2-line NASA-style Engineering Metadata Strip
        ctx.fillStyle = 'rgba(7, 10, 17, 0.84)';
        ctx.fillRect(0, c.height - 52, c.width, 52);

        ctx.fillStyle = '#00d4ff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(
          `SIMULATED OBSERVATION | ${regionName.toUpperCase()} | SOL ${solNumber} ${lmstStr} | ${cameraLabel} (${focalMm}mm)`,
          12,
          c.height - 31
        );

        ctx.fillStyle = '#d4e2f0';
        ctx.font = '11px monospace';
        ctx.fillText(
          `TARGET: ${targetTag} | OPTICS: ${opticalQuality}`,
          12,
          c.height - 12
        );

        ctx.textAlign = 'right';
        ctx.fillText(
          `${latStr && lonStr ? `${latStr}, ${lonStr} | ` : ''}ENU (${roverPos.x.toFixed(1)}m, ${roverPos.y.toFixed(1)}m, ${roverPos.z.toFixed(1)}m)`,
          c.width - 12,
          c.height - 12
        );

        const stampedUrl = c.toDataURL('image/jpeg', 0.86);
        const photoEntry = {
          id: Date.now(),
          url: stampedUrl,
          region: regionName,
          sol: solNumber,
          lmst: lmstStr,
          camera: cameraLabel,
          focalLengthMm: focalMm,
          targetIdentified: targetTag,
          opticalQuality,
          coordinatesENU: {
            x: Number(roverPos.x.toFixed(1)),
            y: Number(roverPos.y.toFixed(1)),
            z: Number(roverPos.z.toFixed(1))
          },
          latLonSim: latStr && lonStr ? `${latStr}, ${lonStr}` : null
        };
        this.photos.unshift(photoEntry);
        if (this.photos.length > 14) this.photos.pop();
        resolve(photoEntry);
      };
      img.src = rawUrl;
    });
  }

  _notifyAdvisor(payload) {
    if (typeof this.externalAdvisorCallback === 'function') {
      this.externalAdvisorCallback(payload);
    }
    if (typeof window !== 'undefined' && typeof window.onMarsRoverScienceEvent === 'function') {
      window.onMarsRoverScienceEvent(payload);
    }
  }
}
