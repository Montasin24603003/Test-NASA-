import * as THREE from 'three';
import { RegionTerrainSampler, MARS_REGIONS } from './regions.js';

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Open-World Chunked Martian Terrain, LOD System, GPU Instanced Rocks & Spatial Colliders
 */
export class MarsWorld {
  constructor(scene, preset, initialRegion = 'jezero') {
    this.scene = scene;
    this.preset = preset;
    this.sampler = new RegionTerrainSampler(initialRegion);

    this.chunkSize = 80; // 80m x 80m per chunk
    this.chunks = new Map(); // key "cx,cz" -> chunk object
    this.lastCenterChunk = { cx: null, cz: null };
    this.slopeHazardMode = false;

    this.worldGroup = new THREE.Group();
    this.worldGroup.name = 'marsOpenWorld';
    this.scene.add(this.worldGroup);

    // Build shared PBR textures & materials once (zero runtime GC churn)
    this.textures = this._buildPBRTextures();
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.albedo,
      normalMap: this.textures.normal,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: this.textures.roughness,
      roughness: 0.92,
      metalness: 0.04,
      vertexColors: true
    });

    this.hazardMaterial = this._buildSlopeHazardMaterial();

    // Shared rock archetype geometries & materials for GPU InstancedMesh
    this._initRockArchetypes();

    // Distant 2.4km Mountain Horizon Ring + Iconic Mesa Landmarks
    this._buildMacroHorizon();

    // Dual wheel track ribbons
    this._initWheelTracks();

    // Initial chunk load around spawn
    const sp = this.sampler.config.spawn;
    this.updateChunks(sp.x, sp.z, true);
  }

  setRegion(regionId) {
    this.sampler.setRegion(regionId);
    this.clearAllChunks();
    this.resetWheelTracks();
    this._rebuildMacroHorizon();
    const sp = this.sampler.config.spawn;
    this.updateChunks(sp.x, sp.z, true);
  }

  applyGraphicsPreset(preset) {
    this.preset = preset;
    const cx = (this.lastCenterChunk.cx ?? 0) * this.chunkSize;
    const cz = (this.lastCenterChunk.cz ?? 0) * this.chunkSize;
    this.clearAllChunks();
    this.updateChunks(cx, cz, true);
  }

  setSlopeHazardMode(enabled) {
    this.slopeHazardMode = enabled;
    const mat = enabled ? this.hazardMaterial : this.terrainMaterial;
    for (const chunk of this.chunks.values()) {
      chunk.mesh.material = mat;
    }
  }

  /**
   * Queries exact ground height + climbable rock cap height at (x, z) for wheel raycasts
   */
  getWheelContactHeight(x, z) {
    let h = this.sampler.getElevation(x, z);

    // Check rocks in current chunk so wheels physically climb over small/medium rocks!
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (chunk && chunk.colliders) {
      const colliders = chunk.colliders;
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (!c.climbable) continue; // Large boulders are solid obstacles handled by rigid body bumper collision
        const dx = x - c.x;
        const dz = z - c.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < c.radiusSq) {
          const dome = Math.sqrt(1.0 - d2 / c.radiusSq) * c.height;
          if (c.baseY + dome > h) {
            h = c.baseY + dome;
          }
        }
      }
    }
    return h;
  }

  getElevationAt(x, z) {
    return this.sampler.getElevation(x, z);
  }

  getNormalAt(x, z, out) {
    return this.sampler.getNormal(x, z, out);
  }

  getSurfaceProperties(x, z) {
    return this.sampler.getSurfaceProperties(x, z);
  }

  /**
   * Returns nearby solid obstacle colliders (large boulders & monuments) around (x, z)
   */
  getNearbySolidObstacles(x, z, outArray = []) {
    outArray.length = 0;
    const minCx = Math.floor((x - 6) / this.chunkSize);
    const maxCx = Math.floor((x + 6) / this.chunkSize);
    const minCz = Math.floor((z - 6) / this.chunkSize);
    const maxCz = Math.floor((z + 6) / this.chunkSize);

    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const chunk = this.chunks.get(`${cx},${cz}`);
        if (!chunk) continue;
        const cols = chunk.colliders;
        for (let i = 0; i < cols.length; i++) {
          if (!cols[i].climbable) {
            outArray.push(cols[i]);
          }
        }
      }
    }
    return outArray;
  }

  /**
   * Streams chunks in/out and updates LODs smoothly around (roverX, roverZ)
   */
  updateChunks(roverX, roverZ, forceImmediate = false) {
    const centerCx = Math.floor(roverX / this.chunkSize);
    const centerCz = Math.floor(roverZ / this.chunkSize);

    // Keep macro mountain horizon centered gently so player never hits world edge
    if (this.horizonGroup) {
      this.horizonGroup.position.set(roverX, 0, roverZ);
    }

    if (!forceImmediate && centerCx === this.lastCenterChunk.cx && centerCz === this.lastCenterChunk.cz) {
      return;
    }

    this.lastCenterChunk.cx = centerCx;
    this.lastCenterChunk.cz = centerCz;

    const R = this.preset.chunkRadius;
    const neededKeys = new Set();

    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        const dist = Math.max(Math.abs(dx), Math.abs(dz));
        const desiredLod = dist <= 1 ? 0 : (dist === 2 ? 1 : 2);
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        const existing = this.chunks.get(key);
        if (!existing) {
          this.chunks.set(key, this._createChunk(cx, cz, desiredLod));
        } else if (existing.lod !== desiredLod) {
          this._disposeChunk(existing);
          this.chunks.set(key, this._createChunk(cx, cz, desiredLod));
        }
      }
    }

    // Recycle chunks out of view range
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        this._disposeChunk(chunk);
        this.chunks.delete(key);
      }
    }
  }

  _createChunk(cx, cz, lod) {
    const segs = lod === 0
      ? this.preset.lod0Segments
      : (lod === 1 ? this.preset.lod1Segments : this.preset.lod2Segments);

    const size = this.chunkSize;
    const originX = cx * size + size * 0.5;
    const originZ = cz * size + size * 0.5;

    // Build grid with 1-ring perimeter skirt to prevent any LOD seam cracks
    const gridN = segs + 1;
    const skirtN = gridN + 2;
    const vertCount = skirtN * skirtN;

    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);

    const pal = this.sampler.config.palette;
    const tmpCol = new THREE.Color();

    for (let rz = 0; rz < skirtN; rz++) {
      const isSkirtZ = (rz === 0 || rz === skirtN - 1);
      const clampedRz = Math.max(0, Math.min(segs, rz - 1));
      const localZ = (clampedRz / segs - 0.5) * size;
      const worldZ = originZ + localZ;

      for (let rx = 0; rx < skirtN; rx++) {
        const isSkirtX = (rx === 0 || rx === skirtN - 1);
        const clampedRx = Math.max(0, Math.min(segs, rx - 1));
        const localX = (clampedRx / segs - 0.5) * size;
        const worldX = originX + localX;

        const idx = rz * skirtN + rx;
        const h = this.sampler.getElevation(worldX, worldZ);
        const isSkirt = isSkirtX || isSkirtZ;

        positions[idx * 3] = localX;
        positions[idx * 3 + 1] = isSkirt ? h - 0.85 : h;
        positions[idx * 3 + 2] = localZ;

        // Seamless world-space tiling UVs
        uvs[idx * 2] = worldX * 0.085;
        uvs[idx * 2 + 1] = worldZ * 0.085;

        // Vertex biome coloring (altitude + slope stratification)
        const slope = this.sampler.getSlopeDegrees(worldX, worldZ);
        const hFactor = Math.max(0, Math.min(1, (h + 4.0) / 18.0));

        if (slope > 15.0) {
          // Exposed sedimentary / breccia scarp strata
          const strataBand = 0.5 + 0.5 * Math.sin(h * 3.4);
          tmpCol.copy(pal.mid).lerp(pal.high, 0.45 + 0.45 * strataBand);
        } else if (hFactor < 0.45) {
          tmpCol.copy(pal.low).lerp(pal.mid, hFactor / 0.45);
        } else {
          tmpCol.copy(pal.mid).lerp(pal.high, (hFactor - 0.45) / 0.55);
        }

        colors[idx * 3] = tmpCol.r;
        colors[idx * 3 + 1] = tmpCol.g;
        colors[idx * 3 + 2] = tmpCol.b;
      }
    }

    const indexCount = (skirtN - 1) * (skirtN - 1) * 6;
    const indices = vertCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let ptr = 0;
    for (let rz = 0; rz < skirtN - 1; rz++) {
      for (let rx = 0; rx < skirtN - 1; rx++) {
        const a = rz * skirtN + rx;
        const b = a + 1;
        const c = a + skirtN;
        const d = c + 1;
        indices[ptr++] = a;
        indices[ptr++] = c;
        indices[ptr++] = b;
        indices[ptr++] = b;
        indices[ptr++] = c;
        indices[ptr++] = d;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();

    // Override interior border normals using exact analytical sampler so chunk seams have ZERO lighting crease
    const normAttr = geo.attributes.normal;
    const tmpN = new THREE.Vector3();
    for (let rz = 1; rz < skirtN - 1; rz++) {
      for (let rx = 1; rx < skirtN - 1; rx++) {
        if (rx === 1 || rx === skirtN - 2 || rz === 1 || rz === skirtN - 2) {
          const idx = rz * skirtN + rx;
          const wx = originX + positions[idx * 3];
          const wz = originZ + positions[idx * 3 + 2];
          this.sampler.getNormal(wx, wz, tmpN);
          normAttr.setXYZ(idx, tmpN.x, tmpN.y, tmpN.z);
        }
      }
    }
    normAttr.needsUpdate = true;

    const mesh = new THREE.Mesh(
      geo,
      this.slopeHazardMode ? this.hazardMaterial : this.terrainMaterial
    );
    mesh.position.set(originX, 0, originZ);
    mesh.receiveShadow = this.preset.shadows && lod <= 1;

    const chunkGroup = new THREE.Group();
    chunkGroup.add(mesh);

    // Populate GPU-instanced boulders, outcrops & pebbles + physical colliders
    const { instancedMeshes, colliders } = this._populateChunkRocks(cx, cz, originX, originZ, lod);
    for (let i = 0; i < instancedMeshes.length; i++) {
      chunkGroup.add(instancedMeshes[i]);
    }

    this.worldGroup.add(chunkGroup);

    return {
      cx,
      cz,
      lod,
      group: chunkGroup,
      mesh,
      geometry: geo,
      instancedMeshes,
      colliders
    };
  }

  _populateChunkRocks(cx, cz, originX, originZ, lod) {
    const seed = ((cx * 73856093) ^ (cz * 19349663) ^ (this.sampler.regionId.length * 83492791)) >>> 0;
    const rand = seededRand(seed);

    const regionMult = this.sampler.config.rockMultiplier;
    const lodFactor = lod === 0 ? 1.0 : (lod === 1 ? 0.55 : 0.2);
    const totalRocks = Math.floor(38 * regionMult * this.preset.rockDensity * lodFactor);

    const colliders = [];
    const buckets = [[], [], []];
    const spawn = this.sampler.config.spawn;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < totalRocks; i++) {
      const lx = (rand() - 0.5) * this.chunkSize;
      const lz = (rand() - 0.5) * this.chunkSize;
      const wx = originX + lx;
      const wz = originZ + lz;

      // Keep immediate 6.5m spawn zone clear of big obstacles
      if (Math.hypot(wx - spawn.x, wz - spawn.z) < 6.5) continue;

      const rPick = rand();
      // Power-law size distribution: small cobbles, medium climbable rocks, occasional massive boulders
      const scale = 0.16 + Math.pow(rand(), 3.1) * 2.15;
      const groundY = this.sampler.getElevation(wx, wz);

      const archIdx = rPick < 0.45 ? 0 : (rPick < 0.8 ? 1 : 2);
      const sx = scale * (0.8 + rand() * 0.5);
      const sy = scale * (0.48 + rand() * 0.48);
      const sz = scale * (0.8 + rand() * 0.5);

      dummy.position.set(wx, groundY + sy * 0.34, wz);
      dummy.rotation.set(rand() * 0.5 - 0.25, rand() * Math.PI * 2, rand() * 0.5 - 0.25);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();

      buckets[archIdx].push(dummy.matrix.clone());

      // Register physics collider for medium & large rocks on near/mid chunks
      if (lod <= 1 && scale >= 0.25) {
        const radius = Math.max(sx, sz) * 0.78;
        const protrudeHeight = sy * 0.68;
        const climbable = protrudeHeight <= 0.42; // <=42cm rover wheels can climb; larger boulders deflect bumper!
        colliders.push({
          x: wx,
          z: wz,
          baseY: groundY,
          height: protrudeHeight,
          radius,
          radiusSq: radius * radius,
          climbable
        });
      }
    }

    const instancedMeshes = [];
    for (let a = 0; a < 3; a++) {
      const matrices = buckets[a];
      if (matrices.length === 0) continue;
      const imesh = new THREE.InstancedMesh(
        this.rockGeometries[a],
        this.rockMaterials[a],
        matrices.length
      );
      for (let j = 0; j < matrices.length; j++) {
        imesh.setMatrixAt(j, matrices[j]);
      }
      imesh.instanceMatrix.needsUpdate = true;
      imesh.castShadow = this.preset.shadows && lod === 0;
      imesh.receiveShadow = this.preset.shadows && lod <= 1;
      instancedMeshes.push(imesh);
    }

    return { instancedMeshes, colliders };
  }

  _disposeChunk(chunk) {
    this.worldGroup.remove(chunk.group);
    chunk.geometry.dispose();
    for (let i = 0; i < chunk.instancedMeshes.length; i++) {
      chunk.instancedMeshes[i].dispose();
    }
  }

  clearAllChunks() {
    for (const chunk of this.chunks.values()) {
      this._disposeChunk(chunk);
    }
    this.chunks.clear();
    this.lastCenterChunk = { cx: null, cz: null };
  }

  _initRockArchetypes() {
    // Perturb vertices of polyhedra to look like natural fractured Martian basalt & sedimentary blocks
    const sculptRock = (geo, seed, roughnessAmp = 0.22) => {
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const dir = v.clone().normalize();
        // Deterministic spatial hash so shared vertices stay welded!
        const h = Math.sin(dir.x * 12.7 + seed) * Math.cos(dir.y * 9.3 - seed) * Math.sin(dir.z * 14.1 + seed * 0.5);
        const scale = 1.0 + h * roughnessAmp;
        pos.setXYZ(i, v.x * scale, v.y * scale, v.z * scale);
      }
      geo.computeVertexNormals();
      return geo;
    };

    this.rockGeometries = [
      sculptRock(new THREE.DodecahedronGeometry(0.85, 1), 1.3, 0.24),
      sculptRock(new THREE.IcosahedronGeometry(0.82, 1), 4.7, 0.28),
      sculptRock(new THREE.BoxGeometry(1.15, 0.72, 0.95, 2, 2, 2), 8.2, 0.18)
    ];

    this.rockMaterials = [
      new THREE.MeshStandardMaterial({
        color: 0x5c301e,
        roughness: 0.88,
        metalness: 0.08,
        normalMap: this.textures.normal,
        normalScale: new THREE.Vector2(0.7, 0.7)
      }),
      new THREE.MeshStandardMaterial({
        color: 0x472619,
        roughness: 0.82,
        metalness: 0.12,
        normalMap: this.textures.normal,
        normalScale: new THREE.Vector2(0.8, 0.8)
      }),
      new THREE.MeshStandardMaterial({
        color: 0x7a4329,
        roughness: 0.92,
        metalness: 0.05,
        normalMap: this.textures.normal,
        normalScale: new THREE.Vector2(0.6, 0.6)
      })
    ];
  }

  _buildMacroHorizon() {
    this.horizonGroup = new THREE.Group();
    this.horizonGroup.name = 'marsMacroHorizon';
    this.scene.add(this.horizonGroup);
    this._rebuildMacroHorizon();
  }

  _rebuildMacroHorizon() {
    while (this.horizonGroup.children.length > 0) {
      const child = this.horizonGroup.children[0];
      this.horizonGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    const pal = this.sampler.config.palette;
    const ringGeo = new THREE.RingGeometry(310, 1450, 72, 10);
    ringGeo.rotateX(-Math.PI / 2);

    const pos = ringGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const angle = Math.atan2(z, x);

      const t = Math.max(0, (r - 315) / 1135);
      // Dramatic sculpted Martian mountain silhouettes around 360° horizon
      const peak1 = Math.pow(0.5 + 0.5 * Math.sin(angle * 5.0 + 0.8), 2.0) * 145.0;
      const peak2 = Math.abs(Math.cos(angle * 11.0 - 1.4)) * 68.0;
      const craggy = Math.abs(Math.sin(angle * 23.0 + r * 0.01)) * 26.0;
      const y = -3.0 + Math.pow(t, 1.25) * (peak1 + peak2 + craggy);
      pos.setY(i, y);

      c.copy(pal.mid).lerp(pal.high, Math.min(1, y / 130.0));
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    ringGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    ringGeo.computeVertexNormals();

    const ringMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.02
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.horizonGroup.add(ringMesh);

    // Iconic flat-topped Kodiak Mesa silhouette in SW sector
    const mesaGeo = new THREE.CylinderGeometry(36, 72, 54, 24, 3);
    const mPos = mesaGeo.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      const vx = mPos.getX(i);
      const vy = mPos.getY(i);
      const vz = mPos.getZ(i);
      const fluted = 1.0 + 0.12 * Math.sin(Math.atan2(vz, vx) * 14.0);
      mPos.setXYZ(i, vx * fluted * 1.4, vy, vz * fluted);
    }
    mesaGeo.computeVertexNormals();
    const mesaMat = new THREE.MeshStandardMaterial({
      color: pal.mid,
      roughness: 0.95
    });
    const mesa = new THREE.Mesh(mesaGeo, mesaMat);
    mesa.position.set(-340, 22, -460);
    this.horizonGroup.add(mesa);
  }

  /**
   * Generates seamless 1024x1024 Martian Albedo + True Sobel Normal Map + Roughness Map
   */
  _buildPBRTextures() {
    const size = 512;
    const heightField = new Float32Array(size * size);

    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext('2d');
    const aImg = aCtx.createImageData(size, size);
    const aData = aImg.data;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');
    const rImg = rCtx.createImageData(size, size);
    const rData = rImg.data;

    // Tileable multi-frequency soil + ripple + pebble micro-height
    const TAU = Math.PI * 2;
    const rand = seededRand(2020);
    // Scatter micro-pebbles on tileable grid
    const pebbles = [];
    for (let i = 0; i < 420; i++) {
      pebbles.push({
        x: rand() * size,
        y: rand() * size,
        r: 1.5 + rand() * 4.2,
        h: 0.35 + rand() * 0.65
      });
    }

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const w1 = Math.sin(u * TAU * 3 + Math.sin(v * TAU * 2) * 0.7) * 0.35;
        const w2 = Math.sin((u * 8 + v * 6) * TAU) * 0.18;
        const ripple = Math.sin((v * 18 + Math.sin(u * TAU * 3) * 0.6) * TAU) * 0.16;
        const grain = (rand() - 0.5) * 0.22;
        heightField[y * size + x] = 0.5 + (w1 + w2 + ripple + grain) * 0.5;
      }
    }

    // Stamp tileable pebbles
    for (let p = 0; p < pebbles.length; p++) {
      const pb = pebbles[p];
      const rInt = Math.ceil(pb.r);
      for (let dy = -rInt; dy <= rInt; dy++) {
        for (let dx = -rInt; dx <= rInt; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= pb.r * pb.r) {
            const px = ((Math.floor(pb.x) + dx) % size + size) % size;
            const py = ((Math.floor(pb.y) + dy) % size + size) % size;
            const bump = Math.sqrt(1 - d2 / (pb.r * pb.r)) * pb.h * 0.42;
            heightField[py * size + px] = Math.min(1.0, heightField[py * size + px] + bump);
          }
        }
      }
    }

    // Build Albedo & Roughness from micro-height
    for (let i = 0; i < size * size; i++) {
      const h = heightField[i];
      const idx = i * 4;
      // Subtle greyscale-warm detail multiplied against vertex biome colors
      const shade = 195 + Math.floor((h - 0.5) * 95);
      aData[idx] = Math.min(255, Math.max(120, shade + 12));
      aData[idx + 1] = Math.min(255, Math.max(110, shade));
      aData[idx + 2] = Math.min(255, Math.max(100, shade - 10));
      aData[idx + 3] = 255;

      const rough = Math.floor(238 - h * 35);
      rData[idx] = rough;
      rData[idx + 1] = rough;
      rData[idx + 2] = rough;
      rData[idx + 3] = 255;
    }
    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    // Compute true Sobel Tangent-Space Normal Map
    const normCanvas = document.createElement('canvas');
    normCanvas.width = size;
    normCanvas.height = size;
    const nCtx = normCanvas.getContext('2d');
    const nImg = nCtx.createImageData(size, size);
    const nData = nImg.data;
    const strength = 3.2;

    const sampleH = (sx, sy) => {
      const wx = (sx + size) % size;
      const wy = (sy + size) % size;
      return heightField[wy * size + wx];
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tl = sampleH(x - 1, y - 1);
        const l  = sampleH(x - 1, y);
        const bl = sampleH(x - 1, y + 1);
        const t  = sampleH(x, y - 1);
        const b  = sampleH(x, y + 1);
        const tr = sampleH(x + 1, y - 1);
        const r  = sampleH(x + 1, y);
        const br = sampleH(x + 1, y + 1);

        const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

        let nx = -dX * strength;
        let ny = -dY * strength;
        let nz = 1.0;
        const len = Math.hypot(nx, ny, nz);
        nx /= len; ny /= len; nz /= len;

        const idx = (y * size + x) * 4;
        nData[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        nData[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        nData[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        nData[idx + 3] = 255;
      }
    }
    nCtx.putImageData(nImg, 0, 0);

    const makeTex = (canvas, isSRGB) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    return {
      albedo: makeTex(albedoCanvas, true),
      normal: makeTex(normCanvas, false),
      roughness: makeTex(roughCanvas, false)
    };
  }

  _buildSlopeHazardMaterial() {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          float slopeDeg = acos(clamp(abs(vWorldNormal.y), 0.0, 1.0)) * 57.2958;
          vec3 col = vec3(0.12, 0.82, 0.32); // Safe < 10 deg
          if (slopeDeg > 20.0) {
            col = vec3(0.95, 0.16, 0.12);    // Critical > 20 deg
          } else if (slopeDeg > 10.0) {
            float t = (slopeDeg - 10.0) / 10.0;
            col = mix(vec3(0.12, 0.82, 0.32), vec3(0.98, 0.78, 0.12), t);
          }
          // 2m topographic contour lines
          float cLine = fract(vWorldPos.y * 0.5);
          if (cLine < 0.035) col *= 0.48;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
  }

  _initWheelTracks() {
    this.maxTrackSegments = 900;
    this.trackPointsL = [];
    this.trackPointsR = [];

    const trackMat = new THREE.MeshBasicMaterial({
      color: 0x3f1d0e,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.trackGeoL = new THREE.BufferGeometry();
    this.trackGeoR = new THREE.BufferGeometry();
    this.trackMeshL = new THREE.Mesh(this.trackGeoL, trackMat);
    this.trackMeshR = new THREE.Mesh(this.trackGeoR, trackMat);
    this.trackMeshL.frustumCulled = false;
    this.trackMeshR.frustumCulled = false;

    this.scene.add(this.trackMeshL);
    this.scene.add(this.trackMeshR);
    this._lastTrackPos = new THREE.Vector3(9999, 9999, 9999);
  }

  recordWheelTracks(roverPos, rightVec, groundedCount) {
    if (groundedCount < 2) return;
    if (roverPos.distanceToSquared(this._lastTrackPos) < 0.18) return;
    this._lastTrackPos.copy(roverPos);

    const halfWidth = 0.14;
    const gauge = 1.04;

    const pushRibbon = (arr, geo, sideSign) => {
      const cx = roverPos.x + rightVec.x * gauge * sideSign;
      const cz = roverPos.z + rightVec.z * gauge * sideSign;
      const cy = this.sampler.getElevation(cx, cz) + 0.028;

      arr.push({
        lx: cx - rightVec.x * halfWidth,
        ly: cy,
        lz: cz - rightVec.z * halfWidth,
        rx: cx + rightVec.x * halfWidth,
        ry: cy,
        rz: cz + rightVec.z * halfWidth
      });

      if (arr.length > this.maxTrackSegments) {
        arr.shift();
      }
      if (arr.length < 2) return;

      const n = arr.length;
      const verts = new Float32Array(n * 2 * 3);
      const indices = [];
      for (let i = 0; i < n; i++) {
        const p = arr[i];
        verts[i * 6] = p.lx;
        verts[i * 6 + 1] = p.ly;
        verts[i * 6 + 2] = p.lz;
        verts[i * 6 + 3] = p.rx;
        verts[i * 6 + 4] = p.ry;
        verts[i * 6 + 5] = p.rz;
        if (i < n - 1) {
          const a = i * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          indices.push(a, c, b, b, c, d);
        }
      }
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setIndex(indices);
    };

    pushRibbon(this.trackPointsL, this.trackGeoL, -1);
    pushRibbon(this.trackPointsR, this.trackGeoR, 1);
  }

  resetWheelTracks() {
    this.trackPointsL = [];
    this.trackPointsR = [];
    this.trackGeoL.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    this.trackGeoR.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    this._lastTrackPos.set(9999, 9999, 9999);
  }
}
