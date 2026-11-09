import * as THREE from 'three';

/**
 * Graphics Quality Presets tuned for NVIDIA GTX 1050 Ti + AMD Ryzen 7 7700 @ 60 FPS
 */
export const GRAPHICS_PRESETS = {
  low: {
    id: 'low',
    label: 'Low (Max FPS)',
    pixelRatioCap: 1.0,
    shadows: false,
    shadowMapSize: 512,
    shadowRadius: 40,
    chunkRadius: 2,          // 5x5 chunks (400m x 400m + horizon mountains)
    lod0Segments: 32,
    lod1Segments: 16,
    lod2Segments: 8,
    rockDensity: 0.35,
    particleScale: 0.3,
    headlightVolumetrics: false,
    exposure: 1.12
  },
  medium: {
    id: 'medium',
    label: 'Medium (Balanced)',
    pixelRatioCap: 1.15,
    shadows: true,
    shadowMapSize: 1024,
    shadowRadius: 55,
    chunkRadius: 2,          // 5x5 chunks
    lod0Segments: 44,
    lod1Segments: 20,
    lod2Segments: 10,
    rockDensity: 0.65,
    particleScale: 0.6,
    headlightVolumetrics: false,
    exposure: 1.15
  },
  high: {
    id: 'high',
    label: 'High (GTX 1050 Ti Recommended)',
    pixelRatioCap: 1.5,
    shadows: true,
    shadowMapSize: 1536,
    shadowRadius: 70,
    chunkRadius: 3,          // 7x7 chunks (560m x 560m + 2.4km mountain ring)
    lod0Segments: 56,
    lod1Segments: 24,
    lod2Segments: 10,
    rockDensity: 1.0,
    particleScale: 1.0,
    headlightVolumetrics: true,
    exposure: 1.16
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra (Cinematic)',
    pixelRatioCap: 2.0,
    shadows: true,
    shadowMapSize: 2048,
    shadowRadius: 95,
    chunkRadius: 3,          // 7x7 chunks high density
    lod0Segments: 72,
    lod1Segments: 32,
    lod2Segments: 14,
    rockDensity: 1.35,
    particleScale: 1.4,
    headlightVolumetrics: true,
    exposure: 1.18
  }
};

export class GraphicsManager {
  constructor(container, initialPreset = 'high') {
    this.container = container;
    this.currentPresetKey = GRAPHICS_PRESETS[initialPreset] ? initialPreset : 'high';
    this.preset = GRAPHICS_PRESETS[this.currentPresetKey];

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.12,
      2800
    );

    // WebGL Renderer optimized for dedicated & integrated GPUs
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: true // Allows clean Mastcam Photo Capture snapshots
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    // FPS Monitor
    this.fps = 60;
    this._frames = 0;
    this._fpsTimer = 0;

    this.applyPreset(this.currentPresetKey);

    this._boundResize = this._onResize.bind(this);
    window.addEventListener('resize', this._boundResize);
  }

  applyPreset(presetKey, onPresetChanged = null) {
    if (!GRAPHICS_PRESETS[presetKey]) return;
    this.currentPresetKey = presetKey;
    this.preset = GRAPHICS_PRESETS[presetKey];

    const dpr = Math.min(window.devicePixelRatio || 1, this.preset.pixelRatioCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = this.preset.shadows;
    this.renderer.toneMappingExposure = this.preset.exposure;

    if (onPresetChanged) {
      onPresetChanged(this.preset);
    }
  }

  updateFPS(dt) {
    this._frames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      this.fps = Math.round(this._frames / this._fpsTimer);
      this._frames = 0;
      this._fpsTimer = 0;
    }
  }

  _onResize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  captureScreenshotDataURL() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/jpeg', 0.88);
  }

  dispose() {
    window.removeEventListener('resize', this._boundResize);
    this.renderer.dispose();
  }
}
