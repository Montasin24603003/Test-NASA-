import * as THREE from 'three';

/**
 * Martian Atmosphere, Day/Night Cycle, Authentic Blue-Halo Sunset Sky Shader,
 * Starfield, Rover-Following Shadow Frustum & Dust Storm System
 */
export class MarsAtmosphere {
  constructor(scene, preset) {
    this.scene = scene;
    this.preset = preset;

    // Martian Sol time: 0.0 = Midnight (00:00), 0.25 = Dawn (06:00), 0.54 = Early Afternoon (13:00), 0.75 = Dusk (18:00)
    this.solFraction = 0.54; // Start at crisp early afternoon sunlight (13:00 LMST)
    this.solNumber = 45;
    this.dayCycleSpeed = 1 / 900; // 1 full Martian Sol every 15 real minutes by default (adjustable in Settings!)
    this.pauseTimeCycle = false;

    // Dust Storm state (0.0 = clear sky, 1.0 = severe regional dust storm)
    this.stormIntensity = 0.0;
    this.targetStormIntensity = 0.0;
    this.baseFogDensity = 0.0022;

    this.sunDirection = new THREE.Vector3(0.4, 0.75, 0.45).normalize();

    // Fog
    this.fogColor = new THREE.Color(0xd4916a);
    this.scene.background = this.fogColor;
    this.scene.fog = new THREE.FogExp2(this.fogColor, this.baseFogDensity);

    this._initLighting();
    this._initSkyDome();
    this._initStarfield();
    this.applyGraphicsPreset(preset);
  }

  _initLighting() {
    this.ambientLight = new THREE.AmbientLight(0xd99a73, 0.55);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xe6a880, 0x4b2818, 0.45);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1de, 2.35);
    this.sunLight.castShadow = this.preset.shadows;
    this.sunLight.shadow.bias = -0.00045;
    this.sunLight.shadow.normalBias = 0.03;

    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.sunLight.target = this.sunTarget;
    this.scene.add(this.sunLight);
  }

  _initSkyDome() {
    const skyGeo = new THREE.SphereGeometry(2100, 40, 24);
    this.skyUniforms = {
      uSunDir: { value: this.sunDirection.clone() },
      uZenithColor: { value: new THREE.Color(0x94502c) },
      uHorizonColor: { value: new THREE.Color(0xe0a177) },
      uStormFactor: { value: 0.0 },
      uDayFactor: { value: 1.0 }
    };

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform float uStormFactor;
        uniform float uDayFactor;
        varying vec3 vDir;

        void main() {
          vec3 dir = normalize(vDir);
          float elev = clamp(dir.y * 1.85, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uZenithColor, pow(elev, 0.72));

          // Solar disc & authentic Martian blue twilight forward-scattering halo
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float twilight = clamp(1.0 - abs(uSunDir.y) * 2.8, 0.0, 1.0) * step(-0.12, uSunDir.y);

          vec3 warmGlow = vec3(1.0, 0.78, 0.56) * pow(sunDot, 16.0) * 0.45 * uDayFactor;
          vec3 blueHalo = vec3(0.48, 0.68, 0.95) * pow(sunDot, 10.0) * 0.52 * twilight * (1.0 - uStormFactor);
          float sunDisc = smoothstep(0.99945, 0.99985, sunDot) * step(-0.04, uSunDir.y) * (1.0 - uStormFactor * 0.92);

          sky += warmGlow + blueHalo + vec3(1.0, 0.95, 0.88) * sunDisc * 1.4;
          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });

    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);
  }

  _initStarfield() {
    const count = 1600;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random()); // Upper hemisphere
      const r = 1950;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xf4f7ff,
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.0,
      fog: false,
      depthWrite: false
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  applyGraphicsPreset(preset) {
    this.preset = preset;
    this.sunLight.castShadow = preset.shadows;
    if (preset.shadows) {
      this.sunLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      const d = preset.shadowRadius;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 340;
      this.sunLight.shadow.camera.updateProjectionMatrix();
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        this.sunLight.shadow.map = null;
      }
    }
  }

  setRegionAtmosphere(regionConfig) {
    this.baseFogDensity = regionConfig.fogDensity || 0.0022;
  }

  triggerDustStorm(intensity = 0.88) {
    this.targetStormIntensity = Math.max(0, Math.min(1, intensity));
  }

  clearDustStorm() {
    this.targetStormIntensity = 0.0;
  }

  setTimeOfDay(solFraction) {
    this.solFraction = ((solFraction % 1.0) + 1.0) % 1.0;
  }

  update(dt, roverPos) {
    // 1. Advance Martian Sol Clock
    if (!this.pauseTimeCycle) {
      this.solFraction += dt * this.dayCycleSpeed;
      if (this.solFraction >= 1.0) {
        this.solFraction -= 1.0;
        this.solNumber++;
      }
    }

    // 2. Smooth Dust Storm transition
    this.stormIntensity = THREE.MathUtils.lerp(this.stormIntensity, this.targetStormIntensity, Math.min(1, dt * 0.35));

    // 3. Calculate Sun Elevation & Azimuth from Sol fraction
    // Peak noon at solFraction = 0.50 (sun elevation ~71 deg at 18.38°N Jezero)
    const sunAngle = (this.solFraction - 0.25) * Math.PI * 2;
    const sinElev = Math.sin(sunAngle) * 0.92;
    const cosElev = Math.sqrt(Math.max(0.001, 1.0 - sinElev * sinElev));
    const azimuth = sunAngle * 0.85 + 0.6;

    this.sunDirection.set(
      Math.cos(azimuth) * cosElev,
      sinElev,
      Math.sin(azimuth) * cosElev
    ).normalize();

    const dayFactor = THREE.MathUtils.smoothstep(sinElev, -0.14, 0.22);
    const nightFactor = 1.0 - dayFactor;
    const twilightFactor = Math.max(0, 1.0 - Math.abs(sinElev) * 4.5);

    // 4. Sky & Fog Palette Blending (Day -> Blue/Crimson Sunset -> Starry Martian Night + Storm Override)
    const dayZenith = new THREE.Color(0x944e2b);
    const dayHorizon = new THREE.Color(0xe0a177);
    const duskZenith = new THREE.Color(0x2b1d2e);
    const duskHorizon = new THREE.Color(0x9c4830);
    const nightZenith = new THREE.Color(0x06070d);
    const nightHorizon = new THREE.Color(0x14111a);
    const stormColor = new THREE.Color(0x8e421e);

    const zenith = nightZenith.clone()
      .lerp(duskZenith, twilightFactor)
      .lerp(dayZenith, dayFactor)
      .lerp(stormColor, this.stormIntensity * 0.85 * Math.max(0.2, dayFactor));

    const horizon = nightHorizon.clone()
      .lerp(duskHorizon, twilightFactor)
      .lerp(dayHorizon, dayFactor)
      .lerp(stormColor, this.stormIntensity * 0.9 * Math.max(0.22, dayFactor));

    this.skyUniforms.uSunDir.value.copy(this.sunDirection);
    this.skyUniforms.uZenithColor.value.copy(zenith);
    this.skyUniforms.uHorizonColor.value.copy(horizon);
    this.skyUniforms.uStormFactor.value = this.stormIntensity;
    this.skyUniforms.uDayFactor.value = dayFactor;

    // Center sky dome & stars on rover so player never approaches dome wall
    if (roverPos) {
      this.skyDome.position.set(roverPos.x, 0, roverPos.z);
      this.stars.position.set(roverPos.x, 0, roverPos.z);
    }

    // Star visibility at night (occluded during dust storms)
    this.starMat.opacity = nightFactor * (1.0 - this.stormIntensity * 0.95) * 0.88;

    // 5. Fog Density & Visibility Distance
    this.fogColor.copy(horizon);
    this.scene.background.copy(horizon);
    const activeFog = this.baseFogDensity + Math.pow(this.stormIntensity, 1.35) * 0.032;
    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.density = activeFog;

    // 6. Sun & Ambient Light Intensity
    const stormSunAttenuation = 1.0 - this.stormIntensity * 0.78;
    this.sunLight.intensity = Math.max(0.02, dayFactor * 2.45 * stormSunAttenuation);

    // Warm sunset tint on sun directional light
    const sunTint = new THREE.Color(0xff9e68).lerp(new THREE.Color(0xfff2e0), Math.max(0, sinElev));
    this.sunLight.color.copy(sunTint);

    this.ambientLight.intensity = THREE.MathUtils.lerp(0.14, 0.58, dayFactor) * (1.0 + this.stormIntensity * 0.25);
    this.ambientLight.color.copy(horizon).lerp(new THREE.Color(0xffffff), 0.25);
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.12, 0.45, dayFactor);

    // 7. Follow rover with Sun Shadow Camera snapped to texel grid to prevent shadow swimming
    if (roverPos) {
      const snap = 2.0;
      const sx = Math.round(roverPos.x / snap) * snap;
      const sz = Math.round(roverPos.z / snap) * snap;
      this.sunTarget.position.set(sx, roverPos.y, sz);

      const lightDir = this.sunDirection.y > 0.05
        ? this.sunDirection
        : new THREE.Vector3(0.3, 0.35, 0.3).normalize();
      this.sunLight.position.set(
        sx + lightDir.x * 160,
        roverPos.y + Math.max(25, lightDir.y * 160),
        sz + lightDir.z * 160
      );
    }
  }

  /**
   * Formatted Martian LMST string (HH:MM:SS LMST)
   */
  getLMSTString() {
    const totalSeconds = Math.floor(this.solFraction * 86400);
    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss} LMST`;
  }

  /**
   * Approximate visibility distance in meters (based on Beer-Lambert optical depth)
   */
  getVisibilityMeters() {
    return Math.round(Math.min(1200, 2.8 / Math.max(0.002, this.scene.fog.density)));
  }
}
