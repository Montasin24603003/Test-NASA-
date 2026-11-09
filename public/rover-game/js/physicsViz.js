import * as THREE from 'three';

/**
 * Real-Time 3D Physics Visualization Overlay System ('V' key or Telemetry Panel Toggle)
 *
 * Visualizes internal planetary robotics & terramechanics vectors directly in 3D space:
 * 1. Gravity vector (F_g) & Downhill Slope Gravity Shear component (F_g,parallel)
 * 2. Center of Gravity (CoG) 3D marker + Vertical Stability Plumb & 6-Wheel Support Polygon
 * 3. Individual Wheel Contact Points (green=contact, crimson=airborne) + Ground Reaction Force Vectors (F_N)
 * 4. Individual Wheel Traction & Slip Force Vectors (F_trac)
 * 5. Wheel Ackermann Steering & Rotation Speed Indicators
 * 6. Rocker-Bogie Suspension Articulation Kinematic Skeleton
 * 7. Forward Terrain Elevation Profile Ribbon & Safe-Path Fan
 * 8. Slip-Colored Rover Movement Trajectory Breadcrumb Curve
 */
export class PhysicsVisualizer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.enabled = false;

    // Individual toggleable sub-overlays
    this.layers = {
      gravity: true,
      cog: true,
      contacts: true,
      traction: true,
      wheelIndicators: true,
      suspension: true,
      terrainProfile: true,
      trajectory: true
    };

    this.root = new THREE.Group();
    this.root.name = 'physicsVisualizationRoot';
    this.root.visible = false;
    this.scene.add(this.root);

    this._initGravityAndCoG();
    this._initWheelVectorsAndContacts();
    this._initSuspensionSkeleton();
    this._initTerrainProfileAndSlope();
    this._initTrajectoryRibbon();
  }

  setEnabled(flag = null) {
    this.enabled = flag !== null ? Boolean(flag) : !this.enabled;
    this.root.visible = this.enabled;
    return this.enabled;
  }

  setLayer(layerKey, visible) {
    if (layerKey in this.layers) {
      this.layers[layerKey] = Boolean(visible);
    }
  }

  _createArrow(hexColor, headLen = 0.22, headWidth = 0.13) {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      1.0,
      hexColor,
      headLen,
      headWidth
    );
    arrow.frustumCulled = false;
    return arrow;
  }

  _initGravityAndCoG() {
    this.gravityGroup = new THREE.Group();
    // Total Mars gravity vector F_g = m*g downward (magenta)
    this.gravityArrow = this._createArrow(0xe040fb, 0.28, 0.16);
    // Slope-parallel downhill shear component m*g*sin(theta) (amber-orange)
    this.slopeShearArrow = this._createArrow(0xff9100, 0.24, 0.14);
    this.gravityGroup.add(this.gravityArrow, this.slopeShearArrow);
    this.root.add(this.gravityGroup);

    // Center of Gravity marker + stability plumb line + support polygon
    this.cogGroup = new THREE.Group();
    const cogSphereGeo = new THREE.SphereGeometry(0.11, 16, 16);
    this.cogMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b, depthTest: false, transparent: true, opacity: 0.95 });
    this.cogSphere = new THREE.Mesh(cogSphereGeo, this.cogMat);
    this.cogSphere.renderOrder = 10;

    // Plumb line from CoG straight down to support polygon plane
    const plumbGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -1, 0)]);
    this.plumbMat = new THREE.LineBasicMaterial({ color: 0xffeb3b, depthTest: false, transparent: true, opacity: 0.9 });
    this.plumbLine = new THREE.Line(plumbGeo, this.plumbMat);
    this.plumbLine.frustumCulled = false;

    // Support polygon connecting FL -> FR -> MR -> RR -> RL -> ML -> FL
    const polyPts = Array.from({ length: 7 }, () => new THREE.Vector3());
    const polyGeo = new THREE.BufferGeometry().setFromPoints(polyPts);
    this.supportPolyMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.75 });
    this.supportPolyLine = new THREE.Line(polyGeo, this.supportPolyMat);
    this.supportPolyLine.frustumCulled = false;

    this.cogGroup.add(this.cogSphere, this.plumbLine, this.supportPolyLine);
    this.root.add(this.cogGroup);
  }

  _initWheelVectorsAndContacts() {
    this.contactsGroup = new THREE.Group();
    this.tractionGroup = new THREE.Group();
    this.wheelIndGroup = new THREE.Group();

    this.contactSpheres = [];
    this.normalArrows = [];
    this.tractionArrows = [];
    this.steerArrows = [];
    this.spinRings = [];

    const sphereGeo = new THREE.SphereGeometry(0.075, 12, 12);
    const ringGeo = new THREE.RingGeometry(0.28, 0.315, 20, 1, 0, Math.PI * 1.45);
    ringGeo.rotateY(Math.PI / 2);

    for (let i = 0; i < 6; i++) {
      const cMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, depthTest: false, transparent: true, opacity: 0.92 });
      const cMesh = new THREE.Mesh(sphereGeo, cMat);
      cMesh.renderOrder = 9;
      this.contactSpheres.push(cMesh);
      this.contactsGroup.add(cMesh);

      const nArrow = this._createArrow(0x00e5ff, 0.20, 0.11);
      this.normalArrows.push(nArrow);
      this.contactsGroup.add(nArrow);

      const tArrow = this._createArrow(0x76ff03, 0.20, 0.11);
      this.tractionArrows.push(tArrow);
      this.tractionGroup.add(tArrow);

      const sArrow = this._createArrow(0xffffff, 0.14, 0.08);
      this.steerArrows.push(sArrow);
      this.wheelIndGroup.add(sArrow);

      const rMat = new THREE.MeshBasicMaterial({ color: 0x40c4ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const rMesh = new THREE.Mesh(ringGeo, rMat);
      this.spinRings.push(rMesh);
      this.wheelIndGroup.add(rMesh);
    }

    this.root.add(this.contactsGroup, this.tractionGroup, this.wheelIndGroup);
  }

  _initSuspensionSkeleton() {
    this.suspensionGroup = new THREE.Group();
    // 10 kinematic segments (20 vertices) representing differential bar + left/right rockers & bogies
    const segPositions = new Float32Array(20 * 3);
    const segGeo = new THREE.BufferGeometry();
    segGeo.setAttribute('position', new THREE.BufferAttribute(segPositions, 3));
    const segMat = new THREE.LineBasicMaterial({ color: 0xffd740, depthTest: false, transparent: true, opacity: 0.92 });
    this.suspLines = new THREE.LineSegments(segGeo, segMat);
    this.suspLines.frustumCulled = false;
    this.suspLines.renderOrder = 8;
    this.suspensionGroup.add(this.suspLines);
    this.root.add(this.suspensionGroup);
  }

  _initTerrainProfileAndSlope() {
    this.profileGroup = new THREE.Group();
    this.profileSampleCount = 26;
    const profPts = Array.from({ length: this.profileSampleCount }, () => new THREE.Vector3());
    const profGeo = new THREE.BufferGeometry().setFromPoints(profPts);
    const profMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.9 });
    this.profileLine = new THREE.Line(profGeo, profMat);
    this.profileLine.frustumCulled = false;

    // Safe heading recommendation arrow ahead of rover
    this.safeHeadingArrow = this._createArrow(0x00ff88, 0.30, 0.18);
    // Rover instantaneous velocity vector arrow
    this.velocityArrow = this._createArrow(0x18ffff, 0.26, 0.15);

    this.profileGroup.add(this.profileLine, this.safeHeadingArrow, this.velocityArrow);
    this.root.add(this.profileGroup);
  }

  _initTrajectoryRibbon() {
    this.trajectoryGroup = new THREE.Group();
    this.maxTrajPoints = 220;
    this.trajHistory = [];
    this._lastTrajSample = new THREE.Vector3(9999, 9999, 9999);

    const posArr = new Float32Array(this.maxTrajPoints * 3);
    const colArr = new Float32Array(this.maxTrajPoints * 3);
    this.trajGeo = new THREE.BufferGeometry();
    this.trajGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    this.trajGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    this.trajGeo.setDrawRange(0, 0);

    const trajMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92 });
    this.trajLine = new THREE.Line(this.trajGeo, trajMat);
    this.trajLine.frustumCulled = false;
    this.trajectoryGroup.add(this.trajLine);
    this.root.add(this.trajectoryGroup);
  }

  clearTrajectory() {
    this.trajHistory = [];
    this.trajGeo.setDrawRange(0, 0);
    this._lastTrajSample.set(9999, 9999, 9999);
  }

  update(physics, navigation) {
    // Always record trajectory breadcrumbs gently even when hidden so toggling V immediately shows recent path!
    if (physics.position.distanceToSquared(this._lastTrajSample) > 0.36) {
      this._lastTrajSample.copy(physics.position);
      this.trajHistory.push({
        x: physics.position.x,
        y: physics.position.y + 0.12,
        z: physics.position.z,
        slip: physics.averageSlip
      });
      if (this.trajHistory.length > this.maxTrajPoints) {
        this.trajHistory.shift();
      }
      this._rebuildTrajectoryBuffer();
    }

    if (!this.enabled) return;

    this.gravityGroup.visible = this.layers.gravity;
    this.cogGroup.visible = this.layers.cog;
    this.contactsGroup.visible = this.layers.contacts;
    this.tractionGroup.visible = this.layers.traction;
    this.wheelIndGroup.visible = this.layers.wheelIndicators;
    this.suspensionGroup.visible = this.layers.suspension;
    this.profileGroup.visible = this.layers.terrainProfile;
    this.trajectoryGroup.visible = this.layers.trajectory;

    const cog = physics.cogWorld;

    // 1. Gravity & Slope-Parallel Shear Vectors
    if (this.layers.gravity) {
      this.gravityArrow.position.copy(cog);
      this.gravityArrow.setDirection(new THREE.Vector3(0, -1, 0));
      // Scale: 3802 N (~Mars weight) -> 1.45 m arrow
      const gravLen = THREE.MathUtils.clamp((physics.mass * physics.gravity) / 2600.0, 0.5, 2.6);
      this.gravityArrow.setLength(gravLen, 0.24, 0.14);

      if (physics.slopeGravityForceN > 35.0) {
        this.slopeShearArrow.visible = true;
        this.slopeShearArrow.position.copy(cog);
        const surfNorm = this.world.getNormalAt(cog.x, cog.z, new THREE.Vector3());
        // Downhill tangent vector = g_vec - (g_vec . n)*n
        const gUnit = new THREE.Vector3(0, -1, 0);
        const downTangent = gUnit.clone().addScaledVector(surfNorm, -gUnit.dot(surfNorm)).normalize();
        this.slopeShearArrow.setDirection(downTangent);
        this.slopeShearArrow.setLength(THREE.MathUtils.clamp(physics.slopeGravityForceN / 650.0, 0.35, 2.4), 0.22, 0.13);
      } else {
        this.slopeShearArrow.visible = false;
      }
    }

    // 2. Center of Gravity, Stability Plumb & 6-Wheel Support Polygon
    if (this.layers.cog) {
      this.cogSphere.position.copy(cog);
      const groundAtCog = this.world.getElevationAt(cog.x, cog.z);
      const plumbAttr = this.plumbLine.geometry.attributes.position;
      plumbAttr.setXYZ(0, cog.x, cog.y, cog.z);
      plumbAttr.setXYZ(1, cog.x, groundAtCog + 0.04, cog.z);
      plumbAttr.needsUpdate = true;

      const warnColor = physics.stabilityMarginPct < 40 ? 0xff1744 : (physics.stabilityMarginPct < 65 ? 0xffab00 : 0xffeb3b);
      this.cogMat.color.setHex(warnColor);
      this.plumbMat.color.setHex(warnColor);

      // Perimeter order: FL(0) -> FR(1) -> MR(3) -> RR(5) -> RL(4) -> ML(2) -> FL(0)
      const order = [0, 1, 3, 5, 4, 2, 0];
      const polyAttr = this.supportPolyLine.geometry.attributes.position;
      for (let k = 0; k < order.length; k++) {
        const w = physics.wheels[order[k]];
        const pt = w.grounded ? w.contactPoint : w.wheelHubWorld;
        polyAttr.setXYZ(k, pt.x, pt.y + 0.05, pt.z);
      }
      polyAttr.needsUpdate = true;
    }

    // 3, 4 & 5. Per-Wheel Contact Points, Normal Forces, Traction Vectors & Steer/Spin Indicators
    for (let i = 0; i < 6; i++) {
      const w = physics.wheels[i];

      if (this.layers.contacts) {
        const cSphere = this.contactSpheres[i];
        const nArrow = this.normalArrows[i];
        if (w.grounded) {
          cSphere.position.copy(w.contactPoint).add(new THREE.Vector3(0, 0.04, 0));
          cSphere.material.color.setHex(0x00ff88);
          nArrow.visible = w.normalForce > 15;
          if (nArrow.visible) {
            nArrow.position.copy(w.contactPoint);
            const nDir = w.normalVecWorld.clone().normalize();
            nArrow.setDirection(nDir);
            // 634 N nominal load -> ~0.95m vector
            nArrow.setLength(THREE.MathUtils.clamp(w.normalForce / 680.0, 0.22, 2.2), 0.18, 0.10);
          }
        } else {
          // Airborne wheel contact loss indicator!
          cSphere.position.copy(w.wheelHubWorld).add(new THREE.Vector3(0, -physics.wheelRadius, 0));
          cSphere.material.color.setHex(0xff1744);
          nArrow.visible = false;
        }
      }

      if (this.layers.traction) {
        const tArrow = this.tractionArrows[i];
        const tMag = w.tractionVecWorld.length();
        if (w.grounded && tMag > 18.0) {
          tArrow.visible = true;
          tArrow.position.copy(w.contactPoint).add(new THREE.Vector3(0, 0.08, 0));
          tArrow.setDirection(w.tractionVecWorld.clone().divideScalar(tMag));
          tArrow.setLength(THREE.MathUtils.clamp(tMag / 420.0, 0.22, 2.1), 0.18, 0.10);
          const slipHex = w.slipRatio > 0.42 ? 0xff1744 : (w.slipRatio > 0.18 ? 0xffab00 : 0x76ff03);
          tArrow.setColor(new THREE.Color(slipHex));
        } else {
          tArrow.visible = false;
        }
      }

      if (this.layers.wheelIndicators) {
        const sArrow = this.steerArrows[i];
        sArrow.position.copy(w.wheelHubWorld).add(new THREE.Vector3(0, 0.34, 0));
        sArrow.setDirection(w.wheelFwdWorld);
        sArrow.setLength(0.52, 0.13, 0.08);
        sArrow.setColor(new THREE.Color(w.canSteer ? 0x00e5ff : 0xb0bec5));

        const rMesh = this.spinRings[i];
        rMesh.position.copy(w.wheelHubWorld);
        rMesh.quaternion.copy(physics.quaternion);
        rMesh.rotateY(w.steerRad);
        rMesh.rotateX(-w.spinRad);
      }
    }

    // 6. Rocker-Bogie Suspension Articulation Kinematic Skeleton
    if (this.layers.suspension) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(physics.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(physics.quaternion);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(physics.quaternion);

      const diffCenter = physics.position.clone().addScaledVector(up, 0.38);
      const rockerL = physics.position.clone().addScaledVector(right, -0.76).addScaledVector(up, 0.24).addScaledVector(fwd, 0.18);
      const rockerR = physics.position.clone().addScaledVector(right, 0.76).addScaledVector(up, 0.24).addScaledVector(fwd, 0.18);
      const bogieL = physics.wheels[2].wheelHubWorld.clone().lerp(physics.wheels[4].wheelHubWorld, 0.5).addScaledVector(up, 0.26);
      const bogieR = physics.wheels[3].wheelHubWorld.clone().lerp(physics.wheels[5].wheelHubWorld, 0.5).addScaledVector(up, 0.26);

      const pairs = [
        [cog, diffCenter],
        [diffCenter, rockerL],
        [diffCenter, rockerR],
        [rockerL, physics.wheels[0].wheelHubWorld],
        [rockerL, bogieL],
        [bogieL, physics.wheels[2].wheelHubWorld],
        [bogieL, physics.wheels[4].wheelHubWorld],
        [rockerR, physics.wheels[1].wheelHubWorld],
        [rockerR, bogieR],
        [bogieR, physics.wheels[3].wheelHubWorld],
        // Connect RR via extra overwrite if needed; 10 segments total: let's replace cog->diff with bogieR->RR!
      ];
      pairs[0] = [bogieR, physics.wheels[5].wheelHubWorld];

      const posAttr = this.suspLines.geometry.attributes.position;
      for (let s = 0; s < 10; s++) {
        const [a, b] = pairs[s];
        posAttr.setXYZ(s * 2, a.x, a.y, a.z);
        posAttr.setXYZ(s * 2 + 1, b.x, b.y, b.z);
      }
      posAttr.needsUpdate = true;
    }

    // 7. Forward Terrain Elevation Profile & Velocity / Safe-Path Vectors
    if (this.layers.terrainProfile) {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(physics.quaternion);
      fwd.y = 0;
      if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1);
      fwd.normalize();

      const profAttr = this.profileLine.geometry.attributes.position;
      for (let k = 0; k < this.profileSampleCount; k++) {
        const dist = 1.2 + (k / (this.profileSampleCount - 1)) * 15.0;
        const px = physics.position.x + fwd.x * dist;
        const pz = physics.position.z + fwd.z * dist;
        const py = this.world.getWheelContactHeight(px, pz) + 0.09;
        profAttr.setXYZ(k, px, py, pz);
      }
      profAttr.needsUpdate = true;

      if (physics.speedMagnitude > 0.15) {
        this.velocityArrow.visible = true;
        this.velocityArrow.position.copy(cog).add(new THREE.Vector3(0, 0.55, 0));
        this.velocityArrow.setDirection(physics.linearVelocity.clone().normalize());
        this.velocityArrow.setLength(THREE.MathUtils.clamp(physics.speedMagnitude * 0.35, 0.35, 3.0), 0.24, 0.13);
      } else {
        this.velocityArrow.visible = false;
      }

      if (navigation) {
        this.safeHeadingArrow.visible = true;
        const safeRad = navigation.recommendedSafeHeadingDeg * THREE.MathUtils.DEG2RAD;
        const safeDir = new THREE.Vector3(Math.sin(safeRad), 0, -Math.cos(safeRad));
        const basePt = physics.position.clone().add(new THREE.Vector3(0, 0.25, 0));
        this.safeHeadingArrow.position.copy(basePt);
        this.safeHeadingArrow.setDirection(safeDir);
        this.safeHeadingArrow.setLength(2.6, 0.28, 0.16);
        const hazCol = navigation.forwardHazardLevel === 'HAZARD'
          ? 0xff5252
          : (navigation.forwardHazardLevel === 'CAUTION' ? 0xffd740 : 0x00ff88);
        this.safeHeadingArrow.setColor(new THREE.Color(hazCol));
      }
    }
  }

  _rebuildTrajectoryBuffer() {
    const n = this.trajHistory.length;
    if (n < 2) {
      this.trajGeo.setDrawRange(0, 0);
      return;
    }
    const posAttr = this.trajGeo.attributes.position;
    const colAttr = this.trajGeo.attributes.color;
    const colLow = new THREE.Color(0x00ff88);
    const colMid = new THREE.Color(0xffab00);
    const colHigh = new THREE.Color(0xff1744);
    const tmp = new THREE.Color();

    for (let i = 0; i < n; i++) {
      const pt = this.trajHistory[i];
      posAttr.setXYZ(i, pt.x, pt.y, pt.z);
      if (pt.slip < 0.22) {
        tmp.copy(colLow).lerp(colMid, pt.slip / 0.22);
      } else {
        tmp.copy(colMid).lerp(colHigh, Math.min(1, (pt.slip - 0.22) / 0.38));
      }
      colAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.trajGeo.setDrawRange(0, n);
  }
}
