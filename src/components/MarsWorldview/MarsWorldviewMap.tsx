import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Ruler, 
  Navigation, 
  ShieldAlert, 
  Droplets, 
  Globe2, 
  Map as MapIcon, 
  Download,
  Crosshair,
  Layers,
  Sparkles,
  Info,
  Pause,
  Play
} from 'lucide-react';
import { 
  MARS_SCIENTIFIC_LAYERS, 
  MARS_LANDING_SITES, 
  type MarsScientificLayer, 
  type MarsLandingSite 
} from '@/lib/mars-trek';
import { querySwimWaterIce, type SwimAssessment } from '@/lib/swim-data';
import { getMarsTopography } from '@/lib/mars-dem-engine';
import { calculateMeri } from '@/lib/mars-meri';
import { getMarsRadiationDose, getMarsDustOpacity, getMarsEnergyAndComms } from '@/lib/mars-environment';
import { Canvas, useFrame } from '@react-three/fiber';
import { ThreeSceneBoundary } from '@/components/ThreeSceneBoundary';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

export interface RouteWaypoint {
  lat: number;
  lon: number;
  name: string;
}

export interface MeasurePoint {
  lat: number;
  lon: number;
}

export interface MarsMapProps {
  selectedLocation: { lat: number; lon: number; name?: string; elevationM?: number } | null;
  onSelectLocation: (loc: { lat: number; lon: number; name?: string; elevationM?: number }) => void;
  activeLayers: Record<string, { visible: boolean; opacity: number }>;
  swimDepthFilter: 'all' | '0-1m' | '1-5m' | '>5m';
  isMeasuring: boolean;
  onMeasureComplete?: (measurement: { distanceKm: number; start: MeasurePoint; end: MeasurePoint }) => void;
  routeWaypoints?: RouteWaypoint[];
  onWaypointAdd?: (wp: RouteWaypoint) => void;
  isRoutingMode?: boolean;
  className?: string;
  onExportTrigger?: () => void;
}

// Global in-memory tile cache
const tileCache = new Map<string, HTMLImageElement>();

function getTileImage(url: string, onLoaded: () => void): HTMLImageElement | null {
  const cached = tileCache.get(url);
  if (cached) {
    if (cached.complete && cached.naturalWidth > 0) return cached;
    return null;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  img.onload = () => onLoaded();
  img.onerror = () => {};
  tileCache.set(url, img);
  return null;
}

// High-resolution Mars model loaded from 4K GLTF dataset with surface normal relief
function TexturedMarsModelMesh() {
  const { scene } = useGLTF("/models/scene.gltf");
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 5.0; // radius 2.5 * 2
    const scale = targetSize / maxDimension;

    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.roughness = 0.74;
          mat.metalness = 0.04;
          if (mat.normalMap) {
            mat.normalScale.set(1.6, 1.6);
          }
        }
      });
    });
  }, [model]);

  return <primitive object={model} />;
}

// Preload the GLTF 3D Mars model asset
useGLTF.preload("/models/scene.gltf");

// Deep Space Starfield in 3D View
function GlobeStarfield() {
  const stars = useMemo(() => {
    const coords = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const radius = 12 + (i % 19) * 0.45;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      coords[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      coords[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      coords[i * 3 + 2] = radius * Math.cos(phi);
    }
    return coords;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[stars, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#94a3b8" size={0.032} transparent opacity={0.65} sizeAttenuation />
    </points>
  );
}

// MRO Reconnaissance Orbiter
function GlobeOrbiter() {
  const orbitRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y += delta * 0.35;
      orbitRef.current.rotation.x += delta * 0.06;
    }
  });

  return (
    <group ref={orbitRef} rotation={[0.42, 0.22, 0.3]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.2, 0.005, 16, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.3} />
      </mesh>
      <group position={[3.2, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={2.2} />
        </mesh>
      </group>
    </group>
  );
}

// 3D Realistic Mars Globe View using Three.js with High-Resolution Planetary Model
function MarsGlobe3DView({ 
  selectedLocation, 
  onSelectLocation,
  isAutoRotating = true,
}: { 
  selectedLocation: { lat: number; lon: number } | null; 
  onSelectLocation: (loc: { lat: number; lon: number; name: string; elevationM: number }) => void;
  isAutoRotating?: boolean;
}) {
  const globeRef = useRef<THREE.Group>(null);
  const axialTiltRad = THREE.MathUtils.degToRad(25.19);
  
  useFrame((_, delta) => {
    if (isAutoRotating && globeRef.current) {
      globeRef.current.rotation.y += delta * 0.06;
    }
  });

  return (
    <group rotation={[0, 0, -axialTiltRad]}>
      <ambientLight intensity={0.5} color="#cbd5e1" />
      <directionalLight position={[7, 4, 6]} intensity={3.2} color="#fff4eb" castShadow />
      <directionalLight position={[-7, -1, -4]} intensity={1.1} color="#38bdf8" />

      <GlobeStarfield />

      {/* Rotating Planet Body Group */}
      <group ref={globeRef}>
        <Suspense fallback={
          <mesh>
            <sphereGeometry args={[2.5, 48, 48]} />
            <meshStandardMaterial color="#c25e36" roughness={0.88} />
          </mesh>
        }>
          <TexturedMarsModelMesh />
        </Suspense>

        {/* Inner Warm Dust Atmosphere Haze */}
        <mesh scale={1.016}>
          <sphereGeometry args={[2.5, 48, 48]} />
          <meshBasicMaterial color="#e06822" transparent opacity={0.07} side={THREE.BackSide} />
        </mesh>

        {/* Outer Twilight Blue Rayleigh Scattering Atmosphere Rim */}
        <mesh scale={1.07}>
          <sphereGeometry args={[2.5, 48, 48]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.095} side={THREE.BackSide} />
        </mesh>

        {/* Faint Planetary Navigation Coordinate Grid */}
        <mesh scale={1.012}>
          <sphereGeometry args={[2.5, 36, 18]} />
          <meshBasicMaterial color="#fbd38d" wireframe transparent opacity={0.035} />
        </mesh>

        {/* 3D Surface Coordinate Raycasting Sphere */}
        <mesh
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!globeRef.current) return;
            const localPt = globeRef.current.worldToLocal(e.point.clone());
            const r = localPt.length();
            if (r > 0) {
              const phi = Math.acos(Math.max(-1, Math.min(1, localPt.y / r)));
              const lat = 90 - (phi * 180) / Math.PI;
              const theta = Math.atan2(localPt.z, -localPt.x);
              let lon = (theta * 180) / Math.PI - 180;
              while (lon > 180) lon -= 360;
              while (lon < -180) lon += 360;
              const topo = getMarsTopography(lat, lon);
              onSelectLocation({
                lat: Number(lat.toFixed(4)),
                lon: Number(lon.toFixed(4)),
                name: `Planetary Target (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
                elevationM: topo.elevationM,
              });
            }
          }}
        >
          <sphereGeometry args={[2.53, 36, 36]} />
          <meshBasicMaterial transparent opacity={0.0} />
        </mesh>

        {/* Landing Site Pins on Globe */}
        {MARS_LANDING_SITES.map((site) => {
          const phi = (90 - site.lat) * (Math.PI / 180);
          const theta = (site.lon + 180) * (Math.PI / 180);
          const r = 2.54;
          const x = -r * Math.sin(phi) * Math.cos(theta);
          const y = r * Math.cos(phi);
          const z = r * Math.sin(phi) * Math.sin(theta);

          const isSelected = selectedLocation && 
            Math.abs(selectedLocation.lat - site.lat) < 0.6 && 
            Math.abs(selectedLocation.lon - site.lon) < 0.6;

          return (
            <group 
              key={site.id} 
              position={[x, y, z]} 
              onClick={(e) => {
                e.stopPropagation();
                onSelectLocation({ lat: site.lat, lon: site.lon, name: site.name, elevationM: site.elevationM });
              }}
            >
              {/* Emissive Beacon */}
              <mesh>
                <sphereGeometry args={[isSelected ? 0.08 : 0.045, 16, 16]} />
                <meshStandardMaterial 
                  color={isSelected ? '#00f0ff' : '#f59e0b'} 
                  emissive={isSelected ? '#00f0ff' : '#ea580c'} 
                  emissiveIntensity={isSelected ? 2.5 : 1.2} 
                />
              </mesh>
              {/* Pulsing Outer Ring */}
              <mesh scale={isSelected ? 1.7 : 1.2}>
                <ringGeometry args={[0.06, 0.08, 24]} />
                <meshBasicMaterial 
                  color={isSelected ? '#00f0ff' : '#f59e0b'} 
                  transparent 
                  opacity={0.75} 
                  side={THREE.DoubleSide} 
                />
              </mesh>

              {/* 3D Target Info Tooltip for Selected Site */}
              {isSelected && (
                <Html distanceFactor={6} position={[0, 0.18, 0]}>
                  <div className="pointer-events-none -translate-x-1/2 whitespace-nowrap rounded-lg border border-cyan-400/50 bg-slate-950/90 px-2.5 py-1.5 shadow-2xl backdrop-blur-md text-white font-mono">
                    <p className="text-[10px] font-bold text-cyan-300">{site.name}</p>
                    <p className="text-[8px] text-slate-400">{site.terrainType.toUpperCase()} · Elev: {site.elevationM}m</p>
                    <p className="text-[8px] text-amber-400">
                      {Math.abs(site.lat).toFixed(2)}°{site.lat >= 0 ? "N" : "S"}, {site.lon.toFixed(2)}°E
                    </p>
                  </div>
                </Html>
              )}
            </group>
          );
        })}
      </group>

      <GlobeOrbiter />
    </group>
  );
}

export function MarsWorldviewMap({
  selectedLocation,
  onSelectLocation,
  activeLayers,
  swimDepthFilter,
  isMeasuring = false,
  onMeasureComplete,
  routeWaypoints = [],
  onWaypointAdd,
  isRoutingMode = false,
  className = '',
}: MarsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport State: Center in degrees [-180, 180], [-90, 90]
  const [centerLon, setCenterLon] = useState(0);
  const [centerLat, setCenterLat] = useState(0);
  const [zoom, setZoom] = useState(1); // 0 = global, 7 = high resolution
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, lon: 0, lat: 0 });
  const [hoverCoord, setHoverCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [isGlobeRotating, setIsGlobeRotating] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);

  // Measurement tool state
  const [measureStart, setMeasureStart] = useState<MeasurePoint | null>(null);
  const [measureCurrent, setMeasureCurrent] = useState<MeasurePoint | null>(null);

  const triggerRedraw = useCallback(() => {
    setRenderTrigger((prev) => (prev + 1) % 100000);
  }, []);

  // Update center smoothly when selectedLocation is updated externally
  useEffect(() => {
    if (selectedLocation) {
      setCenterLon(selectedLocation.lon);
      setCenterLat(selectedLocation.lat);
      if (zoom < 2) setZoom(2.5);
      triggerRedraw();
    }
  }, [selectedLocation, triggerRedraw]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Convert Lon/Lat to Canvas Pixel Coordinates (Equirectangular)
  const projectToPixel = useCallback((lon: number, lat: number, width: number, height: number) => {
    const basePixelsPerDeg = (width / 360) * Math.pow(2, zoom);
    const cx = width / 2;
    const cy = height / 2;

    const px = cx + (lon - centerLon) * basePixelsPerDeg;
    const py = cy - (lat - centerLat) * basePixelsPerDeg;
    return { x: px, y: py, scale: basePixelsPerDeg };
  }, [centerLon, centerLat, zoom]);

  // Convert Canvas Pixel to Lon/Lat
  const unprojectFromPixel = useCallback((px: number, py: number, width: number, height: number) => {
    const basePixelsPerDeg = (width / 360) * Math.pow(2, zoom);
    const cx = width / 2;
    const cy = height / 2;

    const lon = centerLon + (px - cx) / basePixelsPerDeg;
    const lat = centerLat - (py - cy) / basePixelsPerDeg;

    let normLon = ((lon + 180) % 360 + 360) % 360 - 180;
    let normLat = Math.max(-88, Math.min(88, lat));

    return { lon: normLon, lat: normLat };
  }, [centerLon, centerLat, zoom]);

  // Great-Circle distance formula for Mars (mean radius 3,389.5 km)
  const calculateDistanceKm = (p1: MeasurePoint, p2: MeasurePoint) => {
    const r = 3389.5;
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLon = (p2.lon - p1.lon) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((r * c).toFixed(1));
  };

  // Export Map Canvas Image to PNG
  const handleExportMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `mars_exploration_map_${Date.now()}.png`;
    a.click();
  };

  // Render 2D Equirectangular Canvas View
  useEffect(() => {
    if (viewMode !== '2d') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina display resolution
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 1. Planetary Space Dark Background
    ctx.fillStyle = '#060a10';
    ctx.fillRect(0, 0, w, h);

    // 2. NASA Mars Trek WMTS Tile Layer Rendering with Viewport Culling & Bounds Checking
    const pViewTL = unprojectFromPixel(0, 0, w, h);
    const pViewBR = unprojectFromPixel(w, h, w, h);
    const viewWest = Math.min(pViewTL.lon, pViewBR.lon) - 1.0;
    const viewEast = Math.max(pViewTL.lon, pViewBR.lon) + 1.0;
    const viewNorth = Math.max(pViewTL.lat, pViewBR.lat) + 1.0;
    const viewSouth = Math.min(pViewTL.lat, pViewBR.lat) - 1.0;

    // Render active NASA Mars Trek WMTS Raster Layers
    MARS_SCIENTIFIC_LAYERS.forEach((layer) => {
      if (!layer.wmtsLayerId || layer.isVectorOverlay) return;
      const state = activeLayers[layer.id];
      if (!state || !state.visible || state.opacity <= 0) return;

      const maxZ = layer.maxZoom ?? 7;
      const minZ = layer.minZoom ?? 0;
      const effectiveTileZoom = Math.min(maxZ, Math.max(minZ, Math.floor(zoom)));
      const cols = Math.pow(2, effectiveTileZoom + 1);
      const rows = Math.pow(2, effectiveTileZoom);

      // Bounds checking for localized high-resolution layers (HiRISE, CTX)
      let lWest = -180, lEast = 180, lSouth = -90, lNorth = 90;
      if (layer.bounds) {
        [[lSouth, lWest], [lNorth, lEast]] = layer.bounds;
        if (viewNorth < lSouth || viewSouth > lNorth || viewEast < lWest || viewWest > lEast) {
          return; // Skip layer completely if outside viewport
        }
      }

      const effWest = Math.max(-180, Math.max(viewWest, lWest));
      const effEast = Math.min(180, Math.min(viewEast, lEast));
      const effNorth = Math.min(90, Math.min(viewNorth, lNorth));
      const effSouth = Math.max(-90, Math.max(viewSouth, lSouth));

      const colMin = Math.max(0, Math.floor(((effWest + 180) / 360) * cols));
      const colMax = Math.min(cols - 1, Math.floor(((effEast + 180) / 360) * cols));
      const rowMin = Math.max(0, Math.floor(((90 - effNorth) / 180) * rows));
      const rowMax = Math.min(rows - 1, Math.floor(((90 - effSouth) / 180) * rows));

      ctx.save();
      ctx.globalAlpha = state.opacity;

      for (let col = colMin; col <= colMax; col++) {
        const tileWest = -180 + (col / cols) * 360;
        const tileEast = -180 + ((col + 1) / cols) * 360;

        for (let row = rowMin; row <= rowMax; row++) {
          const tileNorth = 90 - (row / rows) * 180;
          const tileSouth = 90 - ((row + 1) / rows) * 180;

          const p1 = projectToPixel(tileWest, tileNorth, w, h);
          const p2 = projectToPixel(tileEast, tileSouth, w, h);

          const tileW = p2.x - p1.x;
          const tileH = p2.y - p1.y;

          if (p2.x < 0 || p1.x > w || p2.y < 0 || p1.y > h) continue;

          const tileUrl = `https://trek.nasa.gov/tiles/Mars/EQ/${layer.wmtsLayerId}/1.0.0/default/default028mm/${effectiveTileZoom}/${row}/${col}.${layer.format || 'jpg'}`;
          const img = getTileImage(tileUrl, triggerRedraw);

          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, p1.x, p1.y, tileW + 0.5, tileH + 0.5);
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(p1.x, p1.y, tileW, tileH);
            ctx.strokeStyle = '#1e293b';
            ctx.strokeRect(p1.x, p1.y, tileW, tileH);
          }
        }
      }
      ctx.restore();
    });

    // 2B. MERI Composite Risk Heatmap Vector Overlay
    const meriLayerState = activeLayers['hazard-meri-risk'];
    if (meriLayerState?.visible && meriLayerState.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = meriLayerState.opacity;
      const stepDeg = zoom > 3.5 ? 1.5 : zoom > 1.8 ? 3.0 : 6.0;
      const latStart = Math.max(-85, Math.floor(viewSouth / stepDeg) * stepDeg);
      const latEnd = Math.min(85, Math.ceil(viewNorth / stepDeg) * stepDeg);
      const lonStart = Math.max(-180, Math.floor(viewWest / stepDeg) * stepDeg);
      const lonEnd = Math.min(180, Math.ceil(viewEast / stepDeg) * stepDeg);

      for (let rLat = latStart; rLat <= latEnd; rLat += stepDeg) {
        for (let rLon = lonStart; rLon <= lonEnd; rLon += stepDeg) {
          const m = calculateMeri(rLat + stepDeg / 2, rLon + stepDeg / 2);
          const p1 = projectToPixel(rLon, rLat + stepDeg, w, h);
          const p2 = projectToPixel(rLon + stepDeg, rLat, w, h);
          const cellW = p2.x - p1.x;
          const cellH = p2.y - p1.y;

          if (m.classification === 'SAFE') {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.35)'; // emerald
          } else if (m.classification === 'CAUTION') {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.40)'; // amber
          } else {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.48)'; // rose red
          }
          ctx.fillRect(p1.x, p1.y, cellW, cellH);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(p1.x, p1.y, cellW, cellH);
        }
      }
      ctx.restore();
    }

    // 2C. Historical Radiation Environment (MARIE & MSL RAD) Vector Overlay
    const radLayerState = activeLayers['hazard-radiation-environment'];
    if (radLayerState?.visible && radLayerState.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = radLayerState.opacity;
      const stepDeg = zoom > 2.5 ? 2.5 : 5.0;
      const latStart = Math.max(-85, Math.floor(viewSouth / stepDeg) * stepDeg);
      const latEnd = Math.min(85, Math.ceil(viewNorth / stepDeg) * stepDeg);
      const lonStart = Math.max(-180, Math.floor(viewWest / stepDeg) * stepDeg);
      const lonEnd = Math.min(180, Math.ceil(viewEast / stepDeg) * stepDeg);

      for (let rLat = latStart; rLat <= latEnd; rLat += stepDeg) {
        for (let rLon = lonStart; rLon <= lonEnd; rLon += stepDeg) {
          const topo = getMarsTopography(rLat + stepDeg / 2, rLon + stepDeg / 2);
          const rad = getMarsRadiationDose(topo.elevationM);
          const p1 = projectToPixel(rLon, rLat + stepDeg, w, h);
          const p2 = projectToPixel(rLon + stepDeg, rLat, w, h);

          if (rad.surfaceGcrDoseMsvYear < 215) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.38)'; // deep basin shielding
          } else if (rad.surfaceGcrDoseMsvYear < 265) {
            ctx.fillStyle = 'rgba(234, 179, 8, 0.38)'; // nominal plains
          } else {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.44)'; // thin atmosphere peaks
          }
          ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        }
      }
      ctx.restore();
    }

    // 2D. Historical Atmospheric Dust Opacity (tau) Vector Overlay
    const dustLayerState = activeLayers['hazard-dust-opacity'];
    if (dustLayerState?.visible && dustLayerState.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = dustLayerState.opacity;
      for (let latB = -80; latB <= 80; latB += 10) {
        const d = getMarsDustOpacity(75, latB);
        const p1 = projectToPixel(-180, latB + 10, w, h);
        const p2 = projectToPixel(180, latB, w, h);
        const alpha = Math.min(0.60, Math.max(0.12, d.tau * 0.35));
        ctx.fillStyle = `rgba(217, 119, 6, ${alpha})`;
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      }
      ctx.restore();
    }

    // 2E. Solar Energy Potential (Insolation) Vector Overlay
    const solarLayerState = activeLayers['resource-solar-insolation'];
    if (solarLayerState?.visible && solarLayerState.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = solarLayerState.opacity;
      for (let latB = -80; latB <= 80; latB += 10) {
        const solar = getMarsEnergyAndComms(latB, 0, 75, 0.25);
        const p1 = projectToPixel(-180, latB + 10, w, h);
        const p2 = projectToPixel(180, latB, w, h);
        const alpha = Math.min(0.55, (solar.solarInsolationWm2 / 580) * 0.45);
        ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      }
      ctx.restore();
    }

    // 3. NASA SWIM 2.0 Subsurface Water Ice Overlay (Vector Evidence Layer)
    const swimLayerState = activeLayers['resource-swim-ice'];
    if (swimLayerState?.visible && swimLayerState.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = swimLayerState.opacity;

      // Real SWIM 2.0 ground-truth ice consistency zones
      const swimZones = [
        { name: 'Arcadia Planitia Sheet Ice', latMin: 35, latMax: 50, lonMin: -180, lonMax: -140, ci: 0.94, depth: '0-1m' },
        { name: 'Utopia Planitia Permafrost', latMin: 40, latMax: 55, lonMin: 100, lonMax: 140, ci: 0.86, depth: '1-5m' },
        { name: 'Deuteronilus Glacial Aprons', latMin: 38, latMax: 48, lonMin: 15, lonMax: 35, ci: 0.92, depth: '1-5m' },
        { name: 'Protonilus Relict Glaciers', latMin: 38, latMax: 48, lonMin: 40, lonMax: 65, ci: 0.89, depth: '1-5m' },
        { name: 'Acidalia Tundra Mantle', latMin: 45, latMax: 60, lonMin: -60, lonMax: -20, ci: 0.74, depth: '0-1m' },
        { name: 'Planum Boreum Water Ice Dome', latMin: 70, latMax: 90, lonMin: -180, lonMax: 180, ci: 1.0, depth: '0-1m' },
        { name: 'Planum Australe South Ice Sheet', latMin: -90, latMax: -70, lonMin: -180, lonMax: 180, ci: 0.98, depth: '0-1m' },
        { name: 'Hellas Eastern Rim Glaciers', latMin: -48, latMax: -35, lonMin: 55, lonMax: 85, ci: 0.48, depth: '>5m' },
      ];

      swimZones.forEach((zone) => {
        if (swimDepthFilter !== 'all' && zone.depth !== swimDepthFilter) return;

        const pTL = projectToPixel(zone.lonMin, zone.latMax, w, h);
        const pBR = projectToPixel(zone.lonMax, zone.latMin, w, h);

        const rw = pBR.x - pTL.x;
        const rh = pBR.y - pTL.y;

        const fillGrad = ctx.createLinearGradient(pTL.x, pTL.y, pBR.x, pBR.y);
        if (zone.depth === '0-1m') {
          fillGrad.addColorStop(0, 'rgba(0, 240, 255, 0.55)');
          fillGrad.addColorStop(1, 'rgba(0, 150, 255, 0.35)');
        } else if (zone.depth === '1-5m') {
          fillGrad.addColorStop(0, 'rgba(37, 99, 235, 0.55)');
          fillGrad.addColorStop(1, 'rgba(30, 64, 175, 0.35)');
        } else {
          fillGrad.addColorStop(0, 'rgba(147, 51, 234, 0.55)');
          fillGrad.addColorStop(1, 'rgba(107, 33, 168, 0.35)');
        }

        ctx.fillStyle = fillGrad;
        ctx.fillRect(pTL.x, pTL.y, rw, rh);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(pTL.x, pTL.y, rw, rh);
        ctx.setLineDash([]);

        if (zoom >= 1.5 && rw > 70 && rh > 35) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`SWIM: ${zone.name}`, pTL.x + 6, pTL.y + 14);
        }
      });
      ctx.restore();
    }

    // 4. CRISM Hydrated Mineral Detections Overlay
    const crismLayerState = activeLayers['resource-crism-minerals'];
    if (crismLayerState?.visible && crismLayerState.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = crismLayerState.opacity;
      const crismSites = [
        { name: 'Mawrth Vallis Clays (Smectite)', lat: 24.0, lon: -19.0, type: 'Phyllosilicate' },
        { name: 'Nili Fossae Carbonates', lat: 21.0, lon: 78.5, type: 'Carbonate' },
        { name: 'Valles Marineris Sulfates', lat: -12.0, lon: -60.0, type: 'Hydrated Sulfate' },
        { name: 'Oxia Planum Clays (ExoMars)', lat: 18.27, lon: -24.37, type: 'Clay Strata' },
      ];
      crismSites.forEach((cs) => {
        const p = projectToPixel(cs.lon, cs.lat, w, h);
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(cs.name, p.x + 8, p.y + 3);
      });
      ctx.restore();
    }

    // 5. Scientific Coordinate Graticule (15° Latitude, 30° Longitude)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    for (let lat = -75; lat <= 75; lat += 15) {
      const p = projectToPixel(0, lat, w, h);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(w, p.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px monospace';
      ctx.fillText(`${lat >= 0 ? lat + '°N' : Math.abs(lat) + '°S'}`, 8, p.y - 3);
    }

    for (let lon = -180; lon <= 180; lon += 30) {
      const p = projectToPixel(lon, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, h);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px monospace';
      ctx.fillText(`${lon >= 0 ? lon + '°E' : Math.abs(lon) + '°W'}`, p.x + 4, h - 8);
    }
    ctx.restore();

    // 6. Geological Landmarks (Volcanoes, Canyons, Basins)
    const landmarksLayerState = activeLayers['geology-landmarks'];
    if (landmarksLayerState?.visible) {
      ctx.save();
      const landmarks = [
        { name: 'Olympus Mons (+21.9 km)', lat: 18.65, lon: -133.8, type: 'Volcano' },
        { name: 'Ascraeus Mons (+18.2 km)', lat: 11.9, lon: -104.5, type: 'Volcano' },
        { name: 'Pavonis Mons (+14.0 km)', lat: 0.8, lon: -113.0, type: 'Volcano' },
        { name: 'Arsia Mons (+17.7 km)', lat: -8.4, lon: -121.0, type: 'Volcano' },
        { name: 'Valles Marineris (-7 km)', lat: -14.0, lon: -59.0, type: 'Canyon' },
        { name: 'Hellas Basin (-8.2 km)', lat: -42.0, lon: 70.0, type: 'Basin' },
        { name: 'Elysium Mons (+14.1 km)', lat: 25.0, lon: 147.2, type: 'Volcano' },
      ];
      landmarks.forEach((lm) => {
        const p = projectToPixel(lm.lon, lm.lat, w, h);
        if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) return;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (zoom >= 1.2) {
          ctx.fillStyle = '#fed7aa';
          ctx.font = 'bold 9px monospace';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.fillText(lm.name, p.x + 7, p.y + 3);
        }
      });
      ctx.restore();
    }

    // 7. NASA & International Landed Missions
    const landingSitesLayerState = activeLayers['mission-landing-sites'];
    if (landingSitesLayerState?.visible) {
      MARS_LANDING_SITES.forEach((site) => {
        const p = projectToPixel(site.lon, site.lat, w, h);
        if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) return;

        const isSelected = selectedLocation && 
          Math.abs(selectedLocation.lat - site.lat) < 0.2 && 
          Math.abs(selectedLocation.lon - site.lon) < 0.2;

        ctx.save();
        if (isSelected) {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = site.status === 'active' ? '#22c55e' : site.status === 'future' ? '#38bdf8' : '#eab308';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (zoom >= 1.1 || isSelected) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.fillText(site.name, p.x + 8, p.y + 3);
        }
        ctx.restore();
      });
    }

    // 8. Distance Measurement Line (if tool active)
    if (measureStart && measureCurrent) {
      const p1 = projectToPixel(measureStart.lon, measureStart.lat, w, h);
      const p2 = projectToPixel(measureCurrent.lon, measureCurrent.lat, w, h);
      const dist = calculateDistanceKm(measureStart, measureCurrent);

      ctx.save();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Measurement Endpoints
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2);
      ctx.arc(p2.x, p2.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Distance Tag at Midpoint
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.fillRect(mx - 35, my - 12, 70, 20);
      ctx.strokeRect(mx - 35, my - 12, 70, 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${dist} km`, mx - 25, my + 2);
      ctx.restore();
    }

    // 9. Mission Route Waypoints & Polyline
    if (routeWaypoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      routeWaypoints.forEach((wp, idx) => {
        const p = projectToPixel(wp.lon, wp.lat, w, h);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      routeWaypoints.forEach((wp, idx) => {
        const p = projectToPixel(wp.lon, wp.lat, w, h);
        ctx.fillStyle = idx === 0 ? '#22c55e' : idx === routeWaypoints.length - 1 ? '#ef4444' : '#00f0ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      ctx.restore();
    }

    // 10. Selected Location Reticle
    if (selectedLocation) {
      const p = projectToPixel(selectedLocation.lon, selectedLocation.lat, w, h);
      ctx.save();
      ctx.strokeStyle = '#ff7849';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p.x - 24, p.y);
      ctx.lineTo(p.x - 6, p.y);
      ctx.moveTo(p.x + 6, p.y);
      ctx.lineTo(p.x + 24, p.y);
      ctx.moveTo(p.x, p.y - 24);
      ctx.lineTo(p.x, p.y - 6);
      ctx.moveTo(p.x, p.y + 6);
      ctx.lineTo(p.x, p.y + 24);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 5;
      const tag = `${selectedLocation.lat >= 0 ? selectedLocation.lat.toFixed(2) + '°N' : Math.abs(selectedLocation.lat).toFixed(2) + '°S'}, ${selectedLocation.lon >= 0 ? selectedLocation.lon.toFixed(2) + '°E' : Math.abs(selectedLocation.lon).toFixed(2) + '°W'}`;
      ctx.fillText(tag, p.x + 20, p.y - 10);
      ctx.restore();
    }

  }, [viewMode, centerLon, centerLat, zoom, activeLayers, swimDepthFilter, measureStart, measureCurrent, routeWaypoints, selectedLocation, projectToPixel, unprojectFromPixel, triggerRedraw, renderTrigger]);

  // Mouse & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== '2d') return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      lon: centerLon,
      lat: centerLat,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (viewMode !== '2d') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const coord = unprojectFromPixel(px, py, rect.width, rect.height);
    setHoverCoord(coord);

    if (isMeasuring && measureStart) {
      setMeasureCurrent(coord);
    }

    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const basePixelsPerDeg = (rect.width / 360) * Math.pow(2, zoom);

      let nextLon = dragStart.lon - dx / basePixelsPerDeg;
      let nextLat = dragStart.lat + dy / basePixelsPerDeg;

      nextLon = ((nextLon + 180) % 360 + 360) % 360 - 180;
      nextLat = Math.max(-85, Math.min(85, nextLat));

      setCenterLon(nextLon);
      setCenterLat(nextLat);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Click on Canvas
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (viewMode !== '2d') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const coord = unprojectFromPixel(px, py, rect.width, rect.height);

    // Measurement tool click
    if (isMeasuring) {
      if (!measureStart) {
        setMeasureStart(coord);
        setMeasureCurrent(coord);
      } else {
        const finalDist = calculateDistanceKm(measureStart, coord);
        onMeasureComplete?.({ distanceKm: finalDist, start: measureStart, end: coord });
        setMeasureStart(null);
        setMeasureCurrent(null);
      }
      return;
    }

    // Check if clicked near an existing landing site
    for (const site of MARS_LANDING_SITES) {
      const p = projectToPixel(site.lon, site.lat, rect.width, rect.height);
      const dist = Math.hypot(p.x - px, p.y - py);
      if (dist < 16) {
        onSelectLocation({ lat: site.lat, lon: site.lon, name: site.name, elevationM: site.elevationM });
        return;
      }
    }

    // Otherwise select raw coordinate
    if (isRoutingMode && onWaypointAdd) {
      onWaypointAdd({ lat: Number(coord.lat.toFixed(4)), lon: Number(coord.lon.toFixed(4)), name: `Waypoint (${coord.lat.toFixed(2)}°, ${coord.lon.toFixed(2)}°)` });
    } else {
      onSelectLocation({ lat: Number(coord.lat.toFixed(4)), lon: Number(coord.lon.toFixed(4)) });
    }
  };

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (viewMode !== '2d') return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.35 : -0.35;
    setZoom((prev) => Math.max(0.5, Math.min(14.0, prev + delta)));
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full min-h-[580px] bg-[#05080f] select-none overflow-hidden ${className}`}
    >
      {/* 2D Equirectangular Canvas View */}
      {viewMode === '2d' ? (
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          className={`w-full h-full block ${isMeasuring ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        />
      ) : (
        /* 3D Interactive Mars Globe View */
        <div className="w-full h-full">
          <ThreeSceneBoundary label="3D Mars globe" className="h-full w-full">
          <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
            <MarsGlobe3DView 
              selectedLocation={selectedLocation} 
              onSelectLocation={onSelectLocation} 
              isAutoRotating={isGlobeRotating}
            />
            <OrbitControls enablePan enableZoom enableRotate maxDistance={12} minDistance={3.2} />
          </Canvas>
          </ThreeSceneBoundary>
        </div>
      )}

      {/* Top Left: Active Engine Badges */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 text-slate-100 backdrop-blur-md border border-slate-700/80 shadow-md">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-slate-200">
            NASA Mars Trek WMTS
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">
            EPSG:4326
          </span>
        </div>

        {isMeasuring && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-300 backdrop-blur-md shadow-md text-[11px] font-mono animate-pulse">
            <Ruler className="size-3.5" />
            <span>MEASURING MODE: Click point A and B</span>
          </div>
        )}
      </div>

      {/* Top Right: View Controls (2D/3D Switcher, Zoom, Reset, Screenshot, Fullscreen) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        {/* 2D / 3D Switch */}
        <div className="flex items-center p-0.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-md">
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              viewMode === '2d' 
                ? 'bg-amber-500 text-slate-950 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapIcon className="size-3.5" />
            <span>2D Equirectangular</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              viewMode === '3d' 
                ? 'bg-amber-500 text-slate-950 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe2 className="size-3.5" />
            <span>3D Globe</span>
          </button>
        </div>

        {/* View Tools */}
        <div className="flex items-center rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-md p-0.5">
          {viewMode === '3d' && (
            <button
              type="button"
              onClick={() => setIsGlobeRotating((prev) => !prev)}
              title={isGlobeRotating ? "Pause Globe Rotation" : "Resume Globe Rotation"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 rounded transition-colors text-xs font-mono"
            >
              {isGlobeRotating ? <Pause className="size-3.5 text-amber-400" /> : <Play className="size-3.5 text-emerald-400" />}
              <span className="hidden sm:inline text-[11px] font-medium">{isGlobeRotating ? "Rotate: ON" : "Rotate: OFF"}</span>
            </button>
          )}
          {viewMode === '2d' && (
            <>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(14.0, prev + 0.5))}
                title="Zoom In"
                className="p-2 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.5))}
                title="Zoom Out"
                className="p-2 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCenterLon(0);
                  setCenterLat(0);
                  setZoom(1);
                }}
                title="Reset Global View"
                className="p-2 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleExportMap}
                title="Export High-Res Map PNG"
                className="p-2 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              >
                <Download className="size-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-2 text-slate-300 hover:bg-slate-800 rounded transition-colors"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
