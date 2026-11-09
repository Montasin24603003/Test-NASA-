import * as THREE from 'three';

/**
 * High-Performance GPU Particle & Visual FX Manager:
 * - Wheel regolith dust plumes & slip rooster-tails
 * - Ambient floating Martian dust & whipping Dust Storm streaks
 * - SuperCam LIBS laser ablation beam + plasma sparks
 * - Core drill rock powder puffs
 */
export class MarsParticles {
  constructor(scene, preset) {
    this.scene = scene;
    this.preset = preset;

    this.spriteTex = this._createSoftDustTexture();

    this._initWheelDustPool();
    this._initAmbientStormParticles();
    this._initLaserFX();
  }

  _createSoftDustTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(232, 148, 102, 0.85)');
    grad.addColorStop(0.45, 'rgba(196, 104, 60, 0.42)');
    grad.addColorStop(1, 'rgba(160, 75, 38, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _initWheelDustPool() {
    this.maxDust = 320;
    this.dustCursor = 0;
    this.dustPos = new Float32Array(this.maxDust * 3);
    this.dustVel = new Float32Array(this.maxDust * 3);
    this.dustLife = new Float32Array(this.maxDust);
    this.dustMaxLife = new Float32Array(this.maxDust);

    for (let i = 0; i < this.maxDust; i++) {
      this.dustPos[i * 3 + 1] = -9999;
      this.dustLife[i] = 0;
      this.dustMaxLife[i] = 1;
    }

    this.dustGeo = new THREE.BufferGeometry();
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));

    this.dustMat = new THREE.PointsMaterial({
      map: this.spriteTex,
      size: 0.95,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.dustPoints = new THREE.Points(this.dustGeo, this.dustMat);
    this.dustPoints.frustumCulled = false;
    this.scene.add(this.dustPoints);
  }

  _initAmbientStormParticles() {
    this.stormCount = 650;
    this.stormPos = new Float32Array(this.stormCount * 3);
    for (let i = 0; i < this.stormCount; i++) {
      this.stormPos[i * 3] = (Math.random() - 0.5) * 70;
      this.stormPos[i * 3 + 1] = Math.random() * 18;
      this.stormPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    this.stormGeo = new THREE.BufferGeometry();
    this.stormGeo.setAttribute('position', new THREE.BufferAttribute(this.stormPos, 3));

    this.stormMat = new THREE.PointsMaterial({
      map: this.spriteTex,
      size: 0.55,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });

    this.stormPoints = new THREE.Points(this.stormGeo, this.stormMat);
    this.stormPoints.frustumCulled = false;
    this.scene.add(this.stormPoints);
  }

  _initLaserFX() {
    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ]);
    this.laserMat = new THREE.LineBasicMaterial({
      color: 0x22ff88,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    this.laserLine = new THREE.Line(beamGeo, this.laserMat);
    this.laserLine.visible = false;
    this.laserLine.frustumCulled = false;
    this.scene.add(this.laserLine);

    const flashGeo = new THREE.SphereGeometry(0.14, 12, 12);
    this.flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.9
    });
    this.laserFlash = new THREE.Mesh(flashGeo, this.flashMat);
    this.laserFlash.visible = false;
    this.scene.add(this.laserFlash);

    this.laserTimer = 0;
  }

  applyGraphicsPreset(preset) {
    this.preset = preset;
  }

  /**
   * Spawn dust puff at world coordinate (e.g. wheel contact patch, bumper impact, or drill head)
   */
  spawnDust(x, y, z, vx = 0, vy = 0.8, vz = 0, life = 1.1) {
    if (Math.random() > this.preset.particleScale) return;

    const i = this.dustCursor;
    this.dustCursor = (this.dustCursor + 1) % this.maxDust;

    this.dustPos[i * 3] = x + (Math.random() - 0.5) * 0.22;
    this.dustPos[i * 3 + 1] = y + 0.08;
    this.dustPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.22;

    this.dustVel[i * 3] = vx + (Math.random() - 0.5) * 0.9;
    this.dustVel[i * 3 + 1] = vy + Math.random() * 0.65;
    this.dustVel[i * 3 + 2] = vz + (Math.random() - 0.5) * 0.9;

    this.dustLife[i] = life;
    this.dustMaxLife[i] = life;
  }

  /**
   * Trigger SuperCam LIBS laser pulses from masthead to rock target
   */
  fireLaser(originVec, targetVec, duration = 0.95) {
    const pos = this.laserLine.geometry.attributes.position;
    pos.setXYZ(0, originVec.x, originVec.y, originVec.z);
    pos.setXYZ(1, targetVec.x, targetVec.y, targetVec.z);
    pos.needsUpdate = true;

    this.laserFlash.position.copy(targetVec);
    this.laserTimer = duration;
    this.laserLine.visible = true;
    this.laserFlash.visible = true;

    // Plasma ablation puffs
    for (let k = 0; k < 12; k++) {
      this.spawnDust(targetVec.x, targetVec.y + 0.1, targetVec.z, 0, 1.4, 0, 0.75);
    }
  }

  update(dt, cameraPos, stormIntensity = 0.0) {
    // 1. Update wheel & impact dust particles under Mars gravity (3.71 m/s^2) + wind drift
    const windX = 1.2 + stormIntensity * 18.0;
    const windZ = -0.8 + stormIntensity * 9.0;
    let dirty = false;

    for (let i = 0; i < this.maxDust; i++) {
      if (this.dustLife[i] > 0) {
        this.dustLife[i] -= dt;
        dirty = true;
        if (this.dustLife[i] <= 0) {
          this.dustPos[i * 3 + 1] = -9999;
        } else {
          this.dustVel[i * 3] += (windX * 0.35) * dt;
          this.dustVel[i * 3 + 1] -= 1.35 * dt; // Fine dust settles slowly in 3.71 m/s^2
          this.dustVel[i * 3 + 2] += (windZ * 0.35) * dt;

          this.dustPos[i * 3] += this.dustVel[i * 3] * dt;
          this.dustPos[i * 3 + 1] += this.dustVel[i * 3 + 1] * dt;
          this.dustPos[i * 3 + 2] += this.dustVel[i * 3 + 2] * dt;
        }
      }
    }
    if (dirty) {
      this.dustGeo.attributes.position.needsUpdate = true;
    }

    // 2. Update floating dust & Dust Storm particles wrapped in a 70m box around the active camera
    const activeStormCount = Math.floor(this.stormCount * Math.min(1.0, this.preset.particleScale));
    this.stormGeo.setDrawRange(0, activeStormCount);
    this.stormMat.opacity = 0.14 + stormIntensity * 0.62;
    this.stormMat.size = 0.38 + stormIntensity * 1.45;

    if (cameraPos) {
      const box = 35;
      for (let i = 0; i < activeStormCount; i++) {
        let px = this.stormPos[i * 3] + windX * dt;
        let py = this.stormPos[i * 3 + 1] + Math.sin(i + px * 0.15) * (0.25 + stormIntensity * 1.6) * dt;
        let pz = this.stormPos[i * 3 + 2] + windZ * dt;

        // Wrap around camera volume seamlessly
        if (px - cameraPos.x > box) px -= box * 2;
        if (px - cameraPos.x < -box) px += box * 2;
        if (pz - cameraPos.z > box) pz -= box * 2;
        if (pz - cameraPos.z < -box) pz += box * 2;
        if (py - cameraPos.y > 14) py -= 18;
        if (py - cameraPos.y < -4) py += 18;

        this.stormPos[i * 3] = px;
        this.stormPos[i * 3 + 1] = py;
        this.stormPos[i * 3 + 2] = pz;
      }
      this.stormGeo.attributes.position.needsUpdate = true;
    }

    // 3. Pulse SuperCam LIBS Laser
    if (this.laserTimer > 0) {
      this.laserTimer -= dt;
      // Strobe at ~15 Hz like real pulsed Nd:YAG SuperCam laser bursts!
      const pulse = Math.sin(this.laserTimer * 95) > -0.2;
      this.laserLine.visible = pulse;
      this.laserFlash.visible = pulse;
      const s = 0.8 + Math.random() * 0.9;
      this.laserFlash.scale.set(s, s, s);
      if (this.laserTimer <= 0) {
        this.laserLine.visible = false;
        this.laserFlash.visible = false;
      }
    }
  }
}
