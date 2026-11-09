/**
 * NASA MARS 2020 PERSEVERANCE SCIENTIFIC INSTRUMENT SUITE
 *
 * Implements:
 * 1. SuperCam LIBS (Laser-Induced Breakdown Spectroscopy):
 *    - Plasma plume generation and elemental oxide wt% emission model
 *    - Spectral peaks (nm) for Si, Fe, Al, Ca, Mg, Ti, Na, K
 *    - Geological rock classification
 * 2. Rotary-Percussive Coring Drill:
 *    - Progressive rock core penetration (0-65 mm)
 *    - Reaction torque on rover chassis
 *    - Bit friction heating and sample tube encapsulation
 * 3. Mastcam-Z Multispectral Imaging:
 *    - 11-band filter wheel
 *    - Atmospheric tau dust optical depth measurement
 * 4. Science Log & Data Export (CSV/JSON)
 */

export const ROCK_GEOLOGY_DATABASE = Object.freeze({
  basalt: {
    name: 'Jezero Floor Olivine Basalt',
    mohsHardness: 6.0,
    oxidesWtPct: {
      SiO2: 48.2,
      FeO: 18.5,
      Al2O3: 10.4,
      CaO: 9.1,
      MgO: 8.8,
      TiO2: 1.8,
      Na2O: 2.1,
      K2O: 0.8
    },
    spectralPeaksNm: [251.6, 259.9, 288.1, 393.3, 422.7, 518.3, 766.5, 769.9],
    description: 'Igneous cumulate basalt rich in pyroxene and olivine from the crater floor.'
  },
  mudstone: {
    name: 'Delta Front Fe-Mg Smectite Clay Mudstone',
    mohsHardness: 3.2,
    oxidesWtPct: {
      SiO2: 54.6,
      FeO: 14.2,
      Al2O3: 15.8,
      CaO: 4.2,
      MgO: 6.9,
      TiO2: 1.1,
      Na2O: 1.8,
      K2O: 1.4
    },
    spectralPeaksNm: [288.1, 308.2, 393.3, 396.8, 518.3, 589.0, 766.5],
    description: 'Fine-grained aqueous sediment preserving organic biosignature potential.'
  },
  carbonate: {
    name: 'Marginal Jezero Carbonate Rock',
    mohsHardness: 3.8,
    oxidesWtPct: {
      SiO2: 36.4,
      FeO: 11.2,
      Al2O3: 6.5,
      CaO: 24.8,
      MgO: 16.5,
      TiO2: 0.6,
      Na2O: 1.2,
      K2O: 0.5
    },
    spectralPeaksNm: [393.3, 396.8, 422.7, 518.3, 589.0, 616.2],
    description: 'Magnesite-rich precipitation from ancient alkaline lake shoreline.'
  },
  sandstone: {
    name: 'Cross-Bedded Deltaic Sandstone',
    mohsHardness: 5.0,
    oxidesWtPct: {
      SiO2: 61.2,
      FeO: 12.1,
      Al2O3: 12.8,
      CaO: 5.4,
      MgO: 4.2,
      TiO2: 1.3,
      Na2O: 2.0,
      K2O: 1.0
    },
    spectralPeaksNm: [251.6, 288.1, 393.3, 422.7, 518.3, 589.0],
    description: 'Fluvial high-energy river channel deposit exhibiting cross-bedding.'
  },
  perchlorate_crust: {
    name: 'Surface Duricrust & Sulfate Salt',
    mohsHardness: 2.5,
    oxidesWtPct: {
      SiO2: 32.1,
      FeO: 15.6,
      Al2O3: 7.2,
      CaO: 18.2,
      MgO: 12.0,
      SO3: 12.4,
      Cl: 2.5
    },
    spectralPeaksNm: [393.3, 396.8, 422.7, 589.0, 766.5],
    description: 'Evaporitic perchlorate and magnesium sulfate crust cemented by thin brine.'
  }
});

export class SuperCamLIBS {
  constructor() {
    this.name = 'SuperCam LIBS';
    this.status = 'READY'; // READY | FIRING | COOLDOWN
    this.powerWatts = 35.0; // 35 W during active laser burst
    this.fireTimer = 0.0;
    this.cooldownTimer = 0.0;
    this.pulsesPerBurst = 30;
    this.shotsFired = 0;
  }

  isReady() {
    return this.status === 'READY';
  }

  fireAtTarget(rockType = 'basalt', distanceM = 2.5, sol = 42) {
    if (this.status !== 'READY') return null;

    const rock = ROCK_GEOLOGY_DATABASE[rockType] || ROCK_GEOLOGY_DATABASE.basalt;
    this.status = 'FIRING';
    this.fireTimer = 2.0; // 2-second burst duration
    this.shotsFired += this.pulsesPerBurst;

    // Simulated elemental emission spectrum with small variance based on distance
    const distFactor = Math.max(0.6, 1.0 - (distanceM / 10.0) * 0.2);
    const measuredOxides = {};
    for (const [ox, wt] of Object.entries(rock.oxidesWtPct)) {
      measuredOxides[ox] = parseFloat((wt * (1.0 + (Math.random() - 0.5) * 0.04)).toFixed(2));
    }

    const reading = {
      instrument: 'SuperCam LIBS',
      timestampSol: sol,
      targetName: rock.name,
      targetType: rockType,
      targetDistanceM: parseFloat(distanceM.toFixed(2)),
      description: rock.description,
      oxidesWtPct: measuredOxides,
      spectralPeaksNm: rock.spectralPeaksNm,
      signalToNoiseRatio: parseFloat((48.0 * distFactor).toFixed(1)),
      provenance: '[SIMULATED-LIBS]'
    };

    return reading;
  }

  update(dt) {
    if (this.status === 'FIRING') {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.status = 'COOLDOWN';
        this.cooldownTimer = 3.0; // 3 seconds cooldown
      }
      return this.powerWatts;
    } else if (this.status === 'COOLDOWN') {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) {
        this.status = 'READY';
      }
      return 5.0; // 5 W standby
    }
    return 0.0;
  }
}

export class CoringDrill {
  constructor() {
    this.name = 'Rotary-Percussive Coring Drill';
    this.status = 'IDLE'; // IDLE | DRILLING | RETRACTING | COMPLETE
    this.powerWatts = 85.0; // 85 W motor draw during drilling
    this.currentDepthMm = 0.0;
    this.maxDepthMm = 65.0;
    this.targetDepthMm = 60.0;
    this.bitTempC = -15.0;
    this.reactionTorqueNm = 0.0;
    this.activeSampleTube = null;
    this.sealedSampleTubes = [];
    this.totalTubesAvailable = 43; // NASA Mars 2020 carries 43 sample tubes
  }

  startDrill(rockType = 'basalt', sol = 42) {
    if (this.status !== 'IDLE' || this.sealedSampleTubes.length >= this.totalTubesAvailable) return false;

    const rock = ROCK_GEOLOGY_DATABASE[rockType] || ROCK_GEOLOGY_DATABASE.basalt;
    this.status = 'DRILLING';
    this.currentDepthMm = 0.0;
    this.activeSampleTube = {
      tubeId: `ST-${(this.sealedSampleTubes.length + 1).toString().padStart(2, '0')}`,
      solCaptured: sol,
      rockType: rockType,
      rockName: rock.name,
      description: rock.description,
      coreLengthMm: 0.0,
      massGrams: 0.0,
      sealed: false
    };
    return true;
  }

  update(dt, ambientTempC = -35.0) {
    if (this.status !== 'DRILLING') {
      // Passive cooling towards ambient
      this.bitTempC += (ambientTempC - this.bitTempC) * Math.min(1.0, 0.1 * dt);
      this.reactionTorqueNm = 0.0;
      return 0.0;
    }

    // Penetration rate depends on rock hardness
    const rock = this.activeSampleTube
      ? (ROCK_GEOLOGY_DATABASE[this.activeSampleTube.rockType] || ROCK_GEOLOGY_DATABASE.basalt)
      : ROCK_GEOLOGY_DATABASE.basalt;

    const hardness = rock.mohsHardness;
    const penetrationRateMmS = (1.8 / hardness); // Harder rocks drill slower

    this.currentDepthMm += penetrationRateMmS * dt;
    this.reactionTorqueNm = 6.0 + hardness * 0.8; // Chassis reaction torque

    // Bit thermal rise: mechanical friction heating
    this.bitTempC += (3.5 * hardness - (this.bitTempC - ambientTempC) * 0.08) * dt;

    if (this.currentDepthMm >= this.targetDepthMm) {
      this.status = 'COMPLETE';
      this.currentDepthMm = this.targetDepthMm;
      this.reactionTorqueNm = 0.0;
      if (this.activeSampleTube) {
        this.activeSampleTube.coreLengthMm = parseFloat(this.targetDepthMm.toFixed(1));
        this.activeSampleTube.massGrams = parseFloat((this.targetDepthMm * 0.28).toFixed(1));
        this.activeSampleTube.sealed = true;
        this.sealedSampleTubes.push({ ...this.activeSampleTube });
      }
    }

    return this.powerWatts;
  }

  finishSample() {
    const tube = this.activeSampleTube;
    this.activeSampleTube = null;
    this.status = 'IDLE';
    this.currentDepthMm = 0.0;
    return tube;
  }
}

export class MastcamZ {
  constructor() {
    this.name = 'Mastcam-Z Multispectral Camera';
    this.powerWatts = 12.0;
    this.zoomLevelX = 1.0; // 1.0x to 3.6x optical zoom
    this.filterIndex = 0;
    this.filters = [
      'L0 (Clear / RGB)',
      'L1 (442 nm - Blue Extinction)',
      'L2 (528 nm - Fe3+ Band)',
      'L3 (676 nm - Hematite Band)',
      'L4 (754 nm - Regolith Reflectance)',
      'L5 (800 nm - Pyroxene Transition)',
      'L6 (866 nm - Ferrous Silicate)',
      'L7 (935 nm - Hydration Band)',
      'L8 (1022 nm - Olivine Absorption)',
      'Solar (Direct Tau Measurement)'
    ];
    this.lensDustFactorPct = 2.4; // Initial lens dust accumulation
  }

  setFilter(index) {
    if (index >= 0 && index < this.filters.length) {
      this.filterIndex = index;
    }
  }

  setZoom(zoom) {
    this.zoomLevelX = Math.max(1.0, Math.min(3.6, zoom));
  }

  captureFrame(sol = 42, targetName = 'Martian Horizon') {
    return {
      instrument: 'Mastcam-Z',
      timestampSol: sol,
      target: targetName,
      filter: this.filters[this.filterIndex],
      zoomLevel: `${this.zoomLevelX.toFixed(1)}x`,
      lensDustFactor: `${this.lensDustFactorPct.toFixed(1)}%`,
      focalLengthEquivalentMm: Math.round(28 * this.zoomLevelX),
      provenance: '[SIMULATED-MULTISPECTRAL]'
    };
  }

  update(dt, isDustStorm = false) {
    if (isDustStorm) {
      this.lensDustFactorPct = Math.min(35.0, this.lensDustFactorPct + 0.05 * dt);
    }
    return this.powerWatts;
  }
}

export class ScienceManager {
  constructor() {
    this.superCam = new SuperCamLIBS();
    this.drill = new CoringDrill();
    this.mastcam = new MastcamZ();
    this.scienceLog = [];
  }

  recordObservation(entry) {
    const item = {
      id: this.scienceLog.length + 1,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.scienceLog.push(item);
    return item;
  }

  update(dt, ambientTempC, isDustStorm) {
    let powerW = 0.0;
    powerW += this.superCam.update(dt);
    powerW += this.drill.update(dt, ambientTempC);
    powerW += this.mastcam.update(dt, isDustStorm);
    return powerW;
  }

  exportToCSV() {
    if (this.scienceLog.length === 0) return 'No science observations recorded.';
    const headers = ['ID', 'Instrument', 'Sol', 'Target', 'Details', 'Provenance'];
    const rows = this.scienceLog.map(item => [
      item.id,
      item.instrument,
      item.timestampSol ?? '',
      item.targetName || item.target || item.rockName || '',
      JSON.stringify(item.oxidesWtPct || item.coreLengthMm || item.filter || '').replace(/"/g, '""'),
      item.provenance || '[SIMULATED]'
    ]);
    return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  }

  exportToJSON() {
    return JSON.stringify(this.scienceLog, null, 2);
  }
}
