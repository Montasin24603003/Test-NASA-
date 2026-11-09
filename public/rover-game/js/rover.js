import * as THREE from 'three';

export const ROVER_LIVERIES = {
  nasa_white: { name: 'NASA Perseverance White', primary: 0xe6e8ec, accent: 0xd4af37, frame: 0x23262b },
  jpl_gold:   { name: 'JPL Deep Space Gold',     primary: 0xd8b24c, accent: 0xf4f4f6, frame: 0x1c1e22 },
  ares_red:   { name: 'Ares Expedition Crimson', primary: 0xb93829, accent: 0xe2b04a, frame: 0x1e2024 },
  carbon_ops: { name: 'Night Recon Carbon',      primary: 0x353942, accent: 0x00d4ff, frame: 0x17191d }
};

/**
 * High-Detail Articulated Perseverance Rover 3D Assembly
 * Driven directly by RoverPhysicsEngine 6-DOF state & individual wheel suspension kinematics.
 */
export class MarsRover {
  constructor(scene, preset) {
    this.scene = scene;
    this.preset = preset;

    this.group = new THREE.Group();
    this.group.name = 'perseveranceRover';

    this.wheelNodes = [];
    this.headlightsOn = false;
    this.armDeployProgress = 0; // 0 = stowed, 1 = extended drilling
    this.targetArmDeploy = 0;
    this.drillSpin = 0;

    this._initMaterials();
    this._buildChassisAndSolar();
    this._buildMMRTG();
    this._buildRockerBogieLinkages();
    this._buildSixWheels();
    this._buildMastAndCameras();
    this._buildRoboticArm();
    this._buildAntennas();
    this._buildHeadlightsAndTaillights();
    this._buildCameraAnchors();

    this.scene.add(this.group);
  }

  _initMaterials() {
    this.chassisMat = new THREE.MeshStandardMaterial({
      color: 0xe6e8ec,
      roughness: 0.38,
      metalness: 0.25
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.26,
      metalness: 0.85
    });

    this.frameMat = new THREE.MeshStandardMaterial({
      color: 0x23262b,
      roughness: 0.52,
      metalness: 0.72
    });

    this.titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x8f96a0,
      roughness: 0.35,
      metalness: 0.82
    });

    this.wheelMat = new THREE.MeshStandardMaterial({
      color: 0x24262b,
      roughness: 0.48,
      metalness: 0.68
    });

    this.solarMat = new THREE.MeshStandardMaterial({
      color: 0x102548,
      roughness: 0.2,
      metalness: 0.75,
      emissive: 0x061228,
      emissiveIntensity: 0.35
    });

    this.lensMat = new THREE.MeshStandardMaterial({
      color: 0x06152d,
      roughness: 0.08,
      metalness: 0.92,
      emissive: 0x0a2540,
      emissiveIntensity: 0.3
    });

    this.headlightLensMat = new THREE.MeshBasicMaterial({ color: 0x333840 });
    this.taillightMat = new THREE.MeshBasicMaterial({ color: 0x440808 });
  }

  setLivery(liveryId) {
    const liv = ROVER_LIVERIES[liveryId] || ROVER_LIVERIES.nasa_white;
    this.chassisMat.color.setHex(liv.primary);
    this.accentMat.color.setHex(liv.accent);
    this.frameMat.color.setHex(liv.frame);
  }

  applyGraphicsPreset(preset) {
    this.preset = preset;
    if (this.coneLeft && this.coneRight) {
      const showCones = this.headlightsOn && preset.headlightVolumetrics;
      this.coneLeft.visible = showCones;
      this.coneRight.visible = showCones;
    }
  }

  _buildChassisAndSolar() {
    // Note: Physics CoM is at group (0,0,0). Chassis box sits neatly around CoM!
    const bodyGroup = new THREE.Group();

    // Main Warm Electronics Box (WEB)
    const webGeo = new THREE.BoxGeometry(1.26, 0.56, 2.12);
    const webMesh = new THREE.Mesh(webGeo, this.chassisMat);
    webMesh.position.set(0, 0.14, 0);
    webMesh.castShadow = true;
    webMesh.receiveShadow = true;
    bodyGroup.add(webMesh);

    // Angled Lower Belly Pan (rock guard)
    const bellyGeo = new THREE.BoxGeometry(1.14, 0.14, 1.92);
    const belly = new THREE.Mesh(bellyGeo, this.frameMat);
    belly.position.set(0, -0.18, 0);
    bodyGroup.add(belly);

    // Top Equipment Deck + Gold MLI Kapton Foil Trim
    const deckGeo = new THREE.BoxGeometry(1.28, 0.05, 2.08);
    const deck = new THREE.Mesh(deckGeo, this.accentMat);
    deck.position.set(0, 0.43, 0);
    deck.castShadow = true;
    bodyGroup.add(deck);

    // Auxiliary High-Efficiency Solar Deck Panels (left & right wings on mid-aft deck)
    const panelFrameGeo = new THREE.BoxGeometry(0.56, 0.025, 0.92);
    const panelCellGeo = new THREE.PlaneGeometry(0.50, 0.86);
    panelCellGeo.rotateX(-Math.PI / 2);

    [-0.44, 0.44].forEach((px) => {
      const wing = new THREE.Group();
      wing.position.set(px, 0.465, 0.18);
      const pf = new THREE.Mesh(panelFrameGeo, this.frameMat);
      const pc = new THREE.Mesh(panelCellGeo, this.solarMat);
      pc.position.y = 0.015;
      wing.add(pf, pc);
      bodyGroup.add(wing);
    });

    // Heavy Front Bumper & RIMFAX Rear Subsurface Radar Bar
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.10, 0.12), this.frameMat);
    frontBumper.position.set(0, -0.02, -1.12);
    bodyGroup.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.10, 0.12), this.frameMat);
    rearBumper.position.set(0, -0.02, 1.12);
    bodyGroup.add(rearBumper);

    // Front & Rear Hazcam Housings
    const fHaz = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.09), this.frameMat);
    fHaz.position.set(0, 0.08, -1.09);
    const fHazLens = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 12), this.lensMat);
    fHazLens.rotation.x = Math.PI / 2;
    fHazLens.position.set(0, 0.08, -1.10);
    bodyGroup.add(fHaz, fHazLens);

    const rHaz = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.09), this.frameMat);
    rHaz.position.set(0, 0.08, 1.09);
    bodyGroup.add(rHaz);

    this.group.add(bodyGroup);
  }

  _buildMMRTG() {
    const rtgGroup = new THREE.Group();
    rtgGroup.position.set(0, 0.28, 1.18);
    rtgGroup.rotation.x = THREE.MathUtils.degToRad(26);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.72, 16).rotateX(Math.PI / 2),
      this.frameMat
    );
    core.castShadow = true;
    rtgGroup.add(core);

    // Glowing thermal heat-exchanger ring
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff5518 });
    const glowRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.215, 0.08, 16).rotateX(Math.PI / 2),
      glowMat
    );
    rtgGroup.add(glowRing);

    const finGeo = new THREE.BoxGeometry(0.76, 0.028, 0.66);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeo, this.chassisMat);
      fin.rotation.z = (Math.PI / 4) * i;
      rtgGroup.add(fin);
    }

    this.group.add(rtgGroup);
  }

  _buildRockerBogieLinkages() {
    // Top differential balance bar across deck
    this.diffBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 1.56, 10).rotateZ(Math.PI / 2),
      this.titaniumMat
    );
    this.diffBar.position.set(0, 0.49, -0.08);
    this.group.add(this.diffBar);

    const buildSideSuspension = (sideSign) => {
      const rockerPivot = new THREE.Group();
      rockerPivot.position.set(sideSign * 0.76, 0.16, -0.15);

      // Forward titanium rocker tube reaching toward front wheel
      const fwdArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.98, 10).rotateX(Math.PI / 2),
        this.titaniumMat
      );
      fwdArm.position.set(sideSign * 0.20, -0.10, -0.45);
      fwdArm.rotation.x = 0.22;
      fwdArm.castShadow = true;
      rockerPivot.add(fwdArm);

      // Rearward rocker tube reaching to bogie pivot
      const aftArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.78, 10).rotateX(Math.PI / 2),
        this.titaniumMat
      );
      aftArm.position.set(sideSign * 0.22, -0.06, 0.36);
      aftArm.rotation.x = -0.15;
      rockerPivot.add(aftArm);

      // Articulated rear bogie sub-frame between ML/MR and RL/RR
      const bogiePivot = new THREE.Group();
      bogiePivot.position.set(sideSign * 0.24, -0.18, 0.56);

      const bogieBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.04, 10).rotateX(Math.PI / 2),
        this.titaniumMat
      );
      bogiePivot.add(bogieBeam);
      rockerPivot.add(bogiePivot);

      this.group.add(rockerPivot);
      return { rockerPivot, bogiePivot };
    };

    this.leftLinkage = buildSideSuspension(-1);
    this.rightLinkage = buildSideSuspension(1);
  }

  _buildSixWheels() {
    const r = 0.2625;
    const width = 0.30;

    // Outer tire cylinder + inner rim + 16 machined aluminum traction cleats
    const tireGeo = new THREE.CylinderGeometry(r, r, width, 24, 1, false);
    tireGeo.rotateZ(Math.PI / 2);

    const innerRimGeo = new THREE.CylinderGeometry(r * 0.72, r * 0.72, width + 0.01, 16);
    innerRimGeo.rotateZ(Math.PI / 2);

    const hubGeo = new THREE.CylinderGeometry(0.075, 0.075, width + 0.05, 12);
    hubGeo.rotateZ(Math.PI / 2);

    const cleatGeo = new THREE.BoxGeometry(width + 0.015, 0.022, 0.028);

    const configs = [
      { name: 'FL', x: -1.04, z: -1.02, steerable: true },
      { name: 'FR', x:  1.04, z: -1.02, steerable: true },
      { name: 'ML', x: -1.10, z:  0.06, steerable: false },
      { name: 'MR', x:  1.10, z:  0.06, steerable: false },
      { name: 'RL', x: -1.04, z:  1.04, steerable: true },
      { name: 'RR', x:  1.04, z:  1.04, steerable: true }
    ];

    configs.forEach((cfg) => {
      // Steering knuckle group (rotates around Y for steerable corner wheels)
      const steerGroup = new THREE.Group();
      steerGroup.position.set(cfg.x, -0.38, cfg.z);

      // Vertical steering actuator yoke + vertical telescoping strut
      const yoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.44, 10),
        this.frameMat
      );
      yoke.position.set(cfg.x > 0 ? -0.12 : 0.12, 0.24, 0);
      steerGroup.add(yoke);

      if (cfg.steerable) {
        const servoCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.065, 0.065, 0.11, 12),
          this.accentMat
        );
        servoCap.position.set(0, 0.36, 0);
        steerGroup.add(servoCap);
      }

      // Spinning wheel group (rotates around X)
      const spinGroup = new THREE.Group();

      const tire = new THREE.Mesh(tireGeo, this.wheelMat);
      tire.castShadow = true;
      tire.receiveShadow = true;
      spinGroup.add(tire);

      const innerRim = new THREE.Mesh(innerRimGeo, this.frameMat);
      spinGroup.add(innerRim);

      const hub = new THREE.Mesh(hubGeo, this.accentMat);
      spinGroup.add(hub);

      // 14 radial cleats so wheel spin is unmistakably crisp and visible!
      for (let c = 0; c < 14; c++) {
        const angle = (c / 14) * Math.PI * 2;
        const cleat = new THREE.Mesh(cleatGeo, this.titaniumMat);
        cleat.position.set(0, Math.cos(angle) * (r + 0.006), Math.sin(angle) * (r + 0.006));
        cleat.rotation.x = -angle;
        spinGroup.add(cleat);
      }

      steerGroup.add(spinGroup);
      this.group.add(steerGroup);

      this.wheelNodes.push({
        steerGroup,
        spinGroup,
        baseX: cfg.x,
        baseZ: cfg.z
      });
    });
  }

  _buildMastAndCameras() {
    this.mastBase = new THREE.Group();
    this.mastBase.position.set(0.36, 0.45, -0.68);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.052, 1.06, 14),
      this.chassisMat
    );
    pole.position.y = 0.53;
    pole.castShadow = true;
    this.mastBase.add(pole);

    // Gold cable conduit along mast
    const cable = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.96, 0.03),
      this.accentMat
    );
    cable.position.set(-0.045, 0.50, 0.02);
    this.mastBase.add(cable);

    // Pan/Tilt Camera Head
    this.mastHead = new THREE.Group();
    this.mastHead.position.set(0, 1.10, 0);

    const headBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.16, 0.18),
      this.chassisMat
    );
    headBox.castShadow = true;
    this.mastHead.add(headBox);

    // SuperCam Cyclops Laser Unit (top center)
    const superHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.14, 0.20),
      this.chassisMat
    );
    superHousing.position.set(0, 0.14, 0);
    this.mastHead.add(superHousing);

    this.superCamLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.06, 16).rotateX(Math.PI / 2),
      this.lensMat
    );
    this.superCamLens.position.set(0, 0.14, -0.09);
    this.mastHead.add(this.superCamLens);

    // Mastcam-Z Left & Right Stereo Zoom Barrels
    [-0.16, 0.16].forEach((lx) => {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.14, 14).rotateX(Math.PI / 2),
        this.lensMat
      );
      barrel.position.set(lx, -0.01, -0.08);
      this.mastHead.add(barrel);
    });

    // Wide-angle Navcams
    [-0.21, 0.21].forEach((nx) => {
      const nav = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.06), this.frameMat);
      nav.position.set(nx, 0.05, -0.08);
      this.mastHead.add(nav);
    });

    this.mastBase.add(this.mastHead);
    this.group.add(this.mastBase);
  }

  _buildRoboticArm() {
    this.armShoulder = new THREE.Group();
    this.armShoulder.position.set(-0.42, 0.36, -0.92);

    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.16, 12), this.frameMat);
    this.armShoulder.add(mount);

    // Boom 1 (Upper Arm)
    this.armUpper = new THREE.Group();
    const upperBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.78, 10), this.chassisMat);
    upperBeam.position.y = 0.39;
    upperBeam.castShadow = true;
    this.armUpper.add(upperBeam);

    // Boom 2 (Forearm)
    this.armFore = new THREE.Group();
    this.armFore.position.set(0, 0.78, 0);
    const foreBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.72, 10), this.chassisMat);
    foreBeam.position.y = 0.36;
    this.armFore.add(foreBeam);

    // Instrument Turret (PIXL + SHERLOC + Rotary Percussive Core Drill)
    this.armTurret = new THREE.Group();
    this.armTurret.position.set(0, 0.72, 0);
    const turretBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.24, 14), this.frameMat);
    turretBody.castShadow = true;
    this.armTurret.add(turretBody);

    this.drillBit = new THREE.Mesh(
      new THREE.ConeGeometry(0.032, 0.24, 10),
      this.titaniumMat
    );
    this.drillBit.position.set(0, -0.18, 0);
    this.drillBit.rotation.x = Math.PI;
    this.armTurret.add(this.drillBit);

    this.armFore.add(this.armTurret);
    this.armUpper.add(this.armFore);
    this.armShoulder.add(this.armUpper);
    this.group.add(this.armShoulder);

    this._applyArmPose(0);
  }

  _applyArmPose(t) {
    // t=0: compactly stowed across front-left deck; t=1: unfolded forward & down onto rock target!
    this.armShoulder.rotation.y = THREE.MathUtils.lerp(-0.55, 0.12, t);
    this.armUpper.rotation.x = THREE.MathUtils.lerp(1.22, -0.88, t);
    this.armUpper.rotation.z = THREE.MathUtils.lerp(-0.68, 0.0, t);
    this.armFore.rotation.x = THREE.MathUtils.lerp(-2.35, -1.15, t);
    this.armTurret.rotation.x = THREE.MathUtils.lerp(0.5, 0.42, t);
  }

  triggerSampleDrillAnimation(duration = 1.6) {
    this.targetArmDeploy = 1;
    this._armTimer = duration;
  }

  _buildAntennas() {
    // High-Gain Parabolic Dish Antenna
    this.hgaDish = new THREE.Group();
    this.hgaDish.position.set(-0.36, 0.56, 0.56);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.6),
      this.chassisMat
    );
    dish.rotation.x = THREE.MathUtils.degToRad(-135);
    this.hgaDish.add(dish);
    this.group.add(this.hgaDish);

    // UHF Monopole Antenna
    const uhf = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.78, 8), this.frameMat);
    uhf.position.set(0.46, 0.82, 0.68);
    this.group.add(uhf);
  }

  _buildHeadlightsAndTaillights() {
    // Dual high-output LED rover headlights ('F' key)
    this.spotLeft = new THREE.SpotLight(0xfff6e5, 0, 78, THREE.MathUtils.degToRad(36), 0.45, 1.3);
    this.spotLeft.position.set(-0.48, 0.26, -1.08);
    this.spotLeftTarget = new THREE.Object3D();
    this.spotLeftTarget.position.set(-0.48, -0.65, -14.0);
    this.group.add(this.spotLeft, this.spotLeftTarget);
    this.spotLeft.target = this.spotLeftTarget;

    this.spotRight = new THREE.SpotLight(0xfff6e5, 0, 78, THREE.MathUtils.degToRad(36), 0.45, 1.3);
    this.spotRight.position.set(0.48, 0.26, -1.08);
    this.spotRightTarget = new THREE.Object3D();
    this.spotRightTarget.position.set(0.48, -0.65, -14.0);
    this.group.add(this.spotRight, this.spotRightTarget);
    this.spotRight.target = this.spotRightTarget;

    // LED emitter housings on front WEB corners
    const lampGeo = new THREE.BoxGeometry(0.14, 0.07, 0.06);
    [-0.48, 0.48].forEach((lx) => {
      const lamp = new THREE.Mesh(lampGeo, this.headlightLensMat);
      lamp.position.set(lx, 0.26, -1.07);
      this.group.add(lamp);
    });

    // Subtle volumetric dust light cones
    const coneGeo = new THREE.ConeGeometry(2.6, 9.5, 18, 1, true);
    coneGeo.translate(0, -4.75, 0);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff3db,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.coneLeft = new THREE.Mesh(coneGeo, coneMat);
    this.coneLeft.position.set(-0.48, 0.26, -1.1);
    this.coneLeft.rotation.x = -0.07;
    this.coneLeft.visible = false;

    this.coneRight = new THREE.Mesh(coneGeo, coneMat);
    this.coneRight.position.set(0.48, 0.26, -1.1);
    this.coneRight.rotation.x = -0.07;
    this.coneRight.visible = false;

    this.group.add(this.coneLeft, this.coneRight);

    // Rear Brake / Reverse LED strips
    [-0.48, 0.48].forEach((tx) => {
      const tail = new THREE.Mesh(lampGeo, this.taillightMat);
      tail.position.set(tx, 0.22, 1.07);
      this.group.add(tail);
    });
  }

  toggleHeadlights(forceState = null) {
    this.headlightsOn = forceState !== null ? forceState : !this.headlightsOn;
    const intensity = this.headlightsOn ? 8.5 : 0;
    this.spotLeft.intensity = intensity;
    this.spotRight.intensity = intensity;
    this.headlightLensMat.color.setHex(this.headlightsOn ? 0xfff8e8 : 0x333840);

    const showCones = this.headlightsOn && this.preset.headlightVolumetrics;
    this.coneLeft.visible = showCones;
    this.coneRight.visible = showCones;
    return this.headlightsOn;
  }

  _buildCameraAnchors() {
    // 1. Third-person reference
    this.chaseAnchor = new THREE.Object3D();
    this.chaseAnchor.position.set(0, 2.35, 5.6);
    this.group.add(this.chaseAnchor);

    // 2. First-person rover deck camera (looks out over robotic arm & front wheels!)
    this.firstPersonAnchor = new THREE.Object3D();
    this.firstPersonAnchor.position.set(-0.18, 0.78, -0.45);
    this.group.add(this.firstPersonAnchor);

    // 3. Front Hazcam (low bumper wide-angle)
    this.frontHazcamAnchor = new THREE.Object3D();
    this.frontHazcamAnchor.position.set(0, 0.08, -1.16);
    this.group.add(this.frontHazcamAnchor);

    // 4. Rear Hazcam (aft bumper wide-angle looking behind rover, clear of MMRTG)
    this.rearHazcamAnchor = new THREE.Object3D();
    this.rearHazcamAnchor.position.set(0, 0.28, 1.72);
    this.group.add(this.rearHazcamAnchor);

    // 5. Mastcam-Z & SuperCam optical origin (high 1.55m above CoM = ~2.3m above ground)
    this.mastcamAnchor = new THREE.Object3D();
    this.mastcamAnchor.position.set(0, 0.02, -0.14);
    this.mastHead.add(this.mastcamAnchor);

    this.laserOriginAnchor = new THREE.Object3D();
    this.laserOriginAnchor.position.set(0, 0.14, -0.14);
    this.mastHead.add(this.laserOriginAnchor);
  }

  /**
   * Synchronize 3D visual assembly with 6-DOF Physics Engine + emit wheel dust
   */
  syncFromPhysics(physics, controls, dt, particles) {
    // 1. Chassis Rigid-Body Transform
    this.group.position.copy(physics.position);
    this.group.quaternion.copy(physics.quaternion);

    // 2. Rocker-Bogie Differential Linkages
    this.leftLinkage.rockerPivot.rotation.x = physics.rockerAngleLeft;
    this.rightLinkage.rockerPivot.rotation.x = physics.rockerAngleRight;
    this.leftLinkage.bogiePivot.rotation.x = physics.bogieAngleLeft;
    this.rightLinkage.bogiePivot.rotation.x = physics.bogieAngleRight;
    this.diffBar.rotation.y = (physics.rockerAngleLeft - physics.rockerAngleRight) * 0.5;

    // 3. Individual 6-Wheel Suspension Travel, Ackermann Steering & Tire Spin
    for (let i = 0; i < 6; i++) {
      const pw = physics.wheels[i];
      const vn = this.wheelNodes[i];

      // Local Y of wheel center = anchor.y - suspensionLength
      vn.steerGroup.position.y = pw.localAnchor.y - pw.suspensionLength;
      vn.steerGroup.rotation.y = pw.steerRad;
      vn.spinGroup.rotation.x = -pw.spinRad;

      // Kick up Martian dust plumes when driving fast or experiencing wheel slip!
      if (particles && pw.grounded) {
        const wheelGroundSpeed = Math.abs(pw.angularSpeed * physics.wheelRadius);
        const dustChance = (wheelGroundSpeed * 0.045 + pw.slipRatio * 0.55) * pw.soilDustiness;
        if (wheelGroundSpeed > 0.7 && Math.random() < dustChance) {
          particles.spawnDust(
            pw.contactPoint.x,
            pw.contactPoint.y,
            pw.contactPoint.z,
            -physics.linearVelocity.x * 0.25,
            0.45 + pw.slipRatio * 1.1,
            -physics.linearVelocity.z * 0.25,
            0.85 + Math.random() * 0.45
          );
        }
      }
    }

    // 4. Brake & Reverse Taillight feedback
    if (controls.brake) {
      this.taillightMat.color.setHex(0xff1e1e);
    } else if (controls.reverse > 0.1) {
      this.taillightMat.color.setHex(0xffe4b5);
    } else {
      this.taillightMat.color.setHex(0x4a0a0a);
    }

    // 5. Robotic Arm Sample Collection Animation
    if (this._armTimer > 0) {
      this._armTimer -= dt;
      this.drillSpin += dt * 28.0;
      this.drillBit.rotation.y = this.drillSpin;
      if (this._armTimer <= 0) {
        this.targetArmDeploy = 0;
      }
    }
    this.armDeployProgress = THREE.MathUtils.lerp(
      this.armDeployProgress,
      this.targetArmDeploy,
      Math.min(1, dt * 4.5)
    );
    physics.armDeployedFactor = this.armDeployProgress;
    this._applyArmPose(this.armDeployProgress);

    // Slow telemetry dish tracking
    this.hgaDish.rotation.y += dt * 0.08;
    this.group.updateMatrixWorld(true);
  }

  getLaserOriginWorld(out = new THREE.Vector3()) {
    return this.laserOriginAnchor.getWorldPosition(out);
  }
}
