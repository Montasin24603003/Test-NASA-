import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Box,
  CheckCircle2,
  CircleDot,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  Eye,
  Gauge,
  Globe2,
  Info,
  Layers,
  MapPin,
  MapPinned,
  Maximize2,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Timer,
  Wind,
  X,
  Zap,
} from "lucide-react";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Html, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { marsSites } from "@/data/marsSites";
import { NasaDataAtlas } from "@/components/NasaDataAtlas";
import { SurvivalSimulator } from "@/components/SurvivalSimulator";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MARS // SURVIVE — Interplanetary Survival Guide & Mission Intelligence // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Cinematic planetary exploration and scientific intelligence platform. Unified NASA Mars Trek WMTS GIS workspace, SWIM 2.0 subsurface water ice, multimodal hazard analysis, autonomous rover robotics, and survival decision-support.",
      },
      { property: "og:title", content: "MARS // SURVIVE — Interplanetary Survival Guide" },
      {
        property: "og:description",
        content:
          "Planetary exploration and survival platform combining live NASA Mars Trek imagery, SWIM 2.0 subsurface water ice, and scientific hazard analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

// Convert IAU Martian Lat/Lon coordinates to 3D Cartesian Vector3 on sphere
function coordsToSphere(latDeg: number, lonDeg: number, radius = 1.07): THREE.Vector3 {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Famous landmarks for interactive 3D inspection on the hero globe
const HERO_MARS_LANDMARKS = [
  {
    id: "jezero",
    name: "Jezero Crater",
    mission: "Perseverance & Ingenuity Landing",
    lat: 18.38,
    lon: 77.58,
    elevation: "−2,560 m",
    color: "#22d3ee", // Cyan
  },
  {
    id: "olympus",
    name: "Olympus Mons",
    mission: "Highest Shield Volcano (21.2 km)",
    lat: 18.65,
    lon: 226.2,
    elevation: "+21,229 m",
    color: "#f59e0b", // Amber
  },
  {
    id: "valles",
    name: "Valles Marineris",
    mission: "4,000 km Equatorial Rift Canyon",
    lat: -14.0,
    lon: 290.0,
    elevation: "−4,100 m",
    color: "#ef4444", // Crimson
  },
];

// Deep Space Starfield Background
function DeepSpaceStars() {
  const stars = useMemo(() => {
    const coords = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const radius = 9 + (i % 23) * 0.45;
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
      <pointsMaterial
        color="#c8dbee"
        size={0.022}
        transparent
        opacity={0.65}
        sizeAttenuation
      />
    </points>
  );
}

// Glowing MRO Orbit Ring and Spacecraft Beacon
function OrbiterSatellite() {
  const orbitRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y += delta * 0.45;
      orbitRef.current.rotation.z += delta * 0.08;
    }
  });

  return (
    <group ref={orbitRef} rotation={[0.4, 0.2, 0.35]}>
      {/* Orbital Path Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.42, 0.003, 16, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.3} />
      </mesh>

      {/* Satellite Beacon */}
      <group position={[1.42, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={1.8}
            roughness={0.2}
          />
        </mesh>
        {/* Glow halo */}
        <mesh scale={2.2}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.35} />
        </mesh>
      </group>
    </group>
  );
}

// High-Fidelity 3D Mars Globe Mesh with Axial Tilt & Texture Optimization
function BeautifulMarsGlobe({
  isAutoRotating,
  activeLandmarkId,
  onSelectLandmark,
}: {
  isAutoRotating: boolean;
  activeLandmarkId: string | null;
  onSelectLandmark: (id: string | null) => void;
}) {
  const { scene } = useGLTF("/models/scene.gltf");
  const model = useMemo(() => scene.clone(true), [scene]);
  const marsSpinRef = useRef<THREE.Group>(null);

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.roughness = 0.76;
          mat.metalness = 0.04;
          if (mat.normalMap) {
            mat.normalScale.set(1.4, 1.4);
          }
        }
      });
    });
  }, [model]);

  // Martian real axial obliquity (25.19°)
  const axialTiltRad = THREE.MathUtils.degToRad(25.19);

  useFrame((_, delta) => {
    if (isAutoRotating && marsSpinRef.current) {
      marsSpinRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group rotation={[0, 0, -axialTiltRad]}>
      {/* Spinning Planetary Body */}
      <group ref={marsSpinRef}>
        {/* Real 3D Mars GLTF Model */}
        <primitive object={model} scale={0.026} />

        {/* Inner Warm Martian Dust Atmosphere Haze */}
        <mesh scale={1.018}>
          <sphereGeometry args={[1.05, 48, 48]} />
          <meshBasicMaterial
            color="#e06822"
            transparent
            opacity={0.065}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Outer Twilight Blue Rayleigh Scattering Atmosphere Rim */}
        <mesh scale={1.08}>
          <sphereGeometry args={[1.05, 48, 48]} />
          <meshBasicMaterial
            color="#7dd3fc"
            transparent
            opacity={0.09}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Faint Latitude/Longitude Planetary Navigation Grid */}
        <mesh scale={1.014}>
          <sphereGeometry args={[1.05, 36, 18]} />
          <meshBasicMaterial
            color="#fbd38d"
            wireframe
            transparent
            opacity={0.04}
          />
        </mesh>

        {/* 3D Pulsing Landmark Waypoints */}
        {HERO_MARS_LANDMARKS.map((landmark) => {
          const pos = coordsToSphere(landmark.lat, landmark.lon, 1.07);
          const isSelected = activeLandmarkId === landmark.id;

          return (
            <group key={landmark.id} position={pos}>
              {/* Landmark Beacon Sphere */}
              <mesh
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLandmark(isSelected ? null : landmark.id);
                }}
              >
                <sphereGeometry args={[0.024, 16, 16]} />
                <meshStandardMaterial
                  color={landmark.color}
                  emissive={landmark.color}
                  emissiveIntensity={isSelected ? 2.5 : 1.4}
                />
              </mesh>

              {/* Pulsing Beacon Ring */}
              <mesh scale={isSelected ? 1.8 : 1.25}>
                <ringGeometry args={[0.032, 0.042, 24]} />
                <meshBasicMaterial
                  color={landmark.color}
                  transparent
                  opacity={0.8}
                  side={THREE.DoubleSide}
                />
              </mesh>

              {/* Hover / Click 3D Info Tag */}
              {isSelected && (
                <Html distanceFactor={4.2} position={[0, 0.08, 0]}>
                  <div className="pointer-events-none -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/20 bg-black/85 px-2.5 py-1.5 shadow-2xl backdrop-blur-md text-white font-mono">
                    <p className="text-[10px] font-bold text-amber-400">{landmark.name}</p>
                    <p className="text-[8px] text-white/70">{landmark.mission}</p>
                    <p className="text-[8px] text-cyan-300">
                      {Math.abs(landmark.lat).toFixed(1)}°{landmark.lat >= 0 ? "N" : "S"},{" "}
                      {landmark.lon.toFixed(1)}°E · Elev: {landmark.elevation}
                    </p>
                  </div>
                </Html>
              )}
            </group>
          );
        })}
      </group>

      {/* Orbiting Spacecraft */}
      <OrbiterSatellite />
    </group>
  );
}

// 7 MISSION MODULE DEFINITIONS (Card Grid)
const MISSION_MODULES = [
  {
    id: "planetary-map",
    title: "Planetary Map",
    category: "GIS & Route Planning",
    description: "Full-scale 2D/3D Mars Trek WMTS GIS workspace with live layer opacity and A* traverse pathfinding.",
    to: "/planetary-map",
    icon: Layers,
    color: "text-amber",
    accentBorder: "group-hover:border-amber/50",
    image: "/mars-terrain-library/major_regions/tharsis_rise.png",
    stat: "5 WMTS Layers",
  },
  {
    id: "ml-terrain-lab",
    title: "ML Terrain Lab",
    category: "AI & Neural Vision",
    description: "1m Jezero HiRISE ML surrogate and 7 Hugging Face foundation models for semantic segmentation and boulder detection.",
    to: "/ml-terrain-lab",
    icon: Cpu,
    color: "text-indigo-400",
    accentBorder: "group-hover:border-indigo-500/50",
    image: "/mars-terrain-library/craters_basins/jezero_crater.png",
    stat: "7 HF Models",
  },
  {
    id: "hazard-layers",
    title: "Hazard Analysis",
    category: "Risk Intelligence",
    description: "Radiation flux, slope stability (>10°), thermal shock, and aeolian dust storm corridors.",
    to: "/hazard-layers",
    icon: ShieldAlert,
    color: "text-rose",
    accentBorder: "group-hover:border-rose/50",
    image: "/mars-terrain-library/volcanoes/olympus_mons.png",
    stat: "4 Risk Indices",
  },
  {
    id: "resources",
    title: "Resource Explorer",
    category: "ISRU & Materials",
    description: "SWIM 2.0 subsurface water ice radar maps, atmospheric MOXIE O₂ extraction, and ISRU consumable budget calculator.",
    to: "/resources",
    icon: Sparkles,
    color: "text-cyan",
    accentBorder: "group-hover:border-cyan/50",
    image: "/mars-terrain-library/polar_regions/planum_boreum_north_pole.png",
    stat: "SWIM 2.0 Ice",
  },
  {
    id: "mission-lab",
    title: "3D Regional Lab",
    category: "Regional 3D Meshes",
    description: "Interactive 3D elevation models of 14 iconic Martian regions including Valles Marineris and Gale Crater.",
    to: "/mission-lab",
    icon: Box,
    color: "text-amber",
    accentBorder: "group-hover:border-amber/50",
    image: "/models/regions/previews/02_Valles_Marineris_3D_Model.png",
    stat: "14 Meshes",
  },
  {
    id: "rover-game",
    title: "Rover Expedition",
    category: "Surface Robotics",
    description: "Real-time 6-wheel rocker-bogie physics simulation, Bekker terramechanics, and SuperCam LIBS laser ablation.",
    to: "/rover-game",
    icon: Compass,
    color: "text-mint",
    accentBorder: "group-hover:border-mint/50",
    image: "/mars-terrain-library/mission_sites/perseverance_ingenuity.png",
    stat: "Bekker 120Hz",
  },
  {
    id: "sol-by-sol",
    title: "Sol by Sol",
    category: "Survival Simulator",
    description: "500-Sol expedition survival simulator with life-support telemetry, resource allocation, and DONKI space weather.",
    to: "/sol-by-sol",
    icon: Timer,
    color: "text-mint",
    accentBorder: "group-hover:border-mint/50",
    image: "/mars-terrain-library/mission_sites/curiosity_gale_crater.png",
    stat: "500 Sols",
  },
];

function IndexPage() {
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [activeLandmarkId, setActiveLandmarkId] = useState<string | null>("jezero");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const controlsRef = useRef<any>(null);

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="space-y-12 pb-12">
      {/* =========================================================================
          SECTION B: CINEMATIC HERO SECTION (LEFT HERO / CENTER GLOBE / RIGHT DATA)
         ========================================================================= */}
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/90 dark:border-line/80 bg-gradient-to-b from-white via-slate-50/95 to-amber-50/20 dark:from-[#0a0f1d]/90 dark:via-[#060a14]/95 dark:to-[#04070e] p-6 shadow-xl dark:shadow-2xl backdrop-blur-2xl sm:p-8 lg:p-10 transition-colors">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(234,88,12,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(234,88,12,0.12),transparent_70%)]" />

        <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_1.1fr_0.8fr] xl:grid-cols-[1.1fr_1.2fr_0.85fr]">
          {/* 1. LEFT SIDE: HERO HEADLINE & CTAS */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 dark:border-amber/30 dark:bg-amber/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber shadow-sm">
              <span className="size-1.5 rounded-full bg-amber-600 dark:bg-amber animate-pulse" />
              EXPLORE // ANALYZE // SURVIVE
            </div>

            <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl xl:text-6xl leading-[1.05]">
              MARS AWAITS.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 dark:from-amber dark:via-orange-400 dark:to-amber-200">
                SCIENCE LEADS
              </span>
              THE WAY.
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              A mission-critical planetary intelligence and survival decision-support workspace. Fusing real NASA Mars Trek orthomosaics, SWIM 2.0 subsurface ice soundings, calibrated multi-hazard vectors, and autonomous rover robotics.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/planetary-map"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-6 py-3.5 font-display text-sm font-bold shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 transition-all"
              >
                <Layers className="size-4" />
                <span>Start Exploring</span>
                <ArrowRight className="size-4 ml-1" />
              </Link>

              <button
                type="button"
                onClick={() => setBriefingOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-line/80 bg-white hover:bg-slate-50 dark:bg-panel/70 dark:hover:bg-white/15 px-5 py-3.5 font-display text-sm font-semibold text-slate-800 dark:text-bright shadow-sm backdrop-blur-xl hover:-translate-y-0.5 transition-all"
              >
                <Play className="size-3.5 fill-current text-amber-600 dark:text-amber" />
                <span>Watch Overview</span>
              </button>
            </div>

            {/* Small Statistics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-slate-200/80 dark:border-line/60 font-mono">
              <div className="p-2.5 rounded-xl bg-white dark:bg-ink2/40 border border-slate-200/90 dark:border-line/50 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-fog uppercase block">Portals</span>
                <strong className="text-sm text-slate-900 dark:text-bright font-bold">10+ NASA</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-ink2/40 border border-slate-200/90 dark:border-line/50 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-fog uppercase block">AI Suite</span>
                <strong className="text-sm text-amber-600 dark:text-amber font-bold">14 Models</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-ink2/40 border border-slate-200/90 dark:border-line/50 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-fog uppercase block">Ground Truth</span>
                <strong className="text-sm text-emerald-600 dark:text-mint font-bold">Real Data</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-ink2/40 border border-slate-200/90 dark:border-line/50 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-fog uppercase block">Mission Goal</span>
                <strong className="text-sm text-cyan-600 dark:text-cyan font-bold">Safe Horizon</strong>
              </div>
            </div>
          </div>

          {/* 2. CENTER: REALISTIC 3D MARS GLOBE (Three.js WebGL) */}
          <div className="relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden rounded-[28px] border border-slate-300/90 dark:border-line/80 bg-radial from-[#0d1624] via-[#070d17] to-[#040810] p-2 shadow-2xl">
            <Canvas camera={{ position: [0, 0, 2.85], fov: 45 }} dpr={[1, 2]}>
              <color attach="background" args={["#040810"]} />

              {/* Space Lighting */}
              <ambientLight intensity={0.45} color="#cbd5e1" />
              <directionalLight position={[5, 3, 5]} intensity={3.5} color="#fff1e0" castShadow />
              <directionalLight position={[-4, -1, -3]} intensity={1.1} color="#38bdf8" />

              <Environment>
                <Lightformer intensity={1.2} color="#ffb58f" position={[4, 2, 4]} scale={[5, 5, 1]} />
                <Lightformer intensity={0.6} color="#38bdf8" position={[-4, 0, -2]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
              </Environment>

              <Suspense
                fallback={
                  <Html center>
                    <div className="font-mono text-[11px] text-amber uppercase tracking-widest">
                      CALIBRATING ORBITAL TELEMETRY…
                    </div>
                  </Html>
                }
              >
                <DeepSpaceStars />
                <BeautifulMarsGlobe
                  isAutoRotating={isAutoRotating}
                  activeLandmarkId={activeLandmarkId}
                  onSelectLandmark={setActiveLandmarkId}
                />
              </Suspense>

              <OrbitControls
                ref={controlsRef}
                enableZoom={true}
                minDistance={2.1}
                maxDistance={4.2}
                enablePan={false}
                dampingFactor={0.06}
                rotateSpeed={0.8}
              />
            </Canvas>

            {/* Top Globe Toolbar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-white backdrop-blur-md pointer-events-auto">
                <span className="beacon-dot size-2 rounded-full bg-mint animate-pulse" />
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/90">
                  3D View · 25.2° Tilt
                </span>
              </div>

              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setIsAutoRotating(!isAutoRotating)}
                  className="flex items-center gap-1 rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-white/80 hover:text-white backdrop-blur-md font-mono text-[9px] uppercase transition-colors"
                  title={isAutoRotating ? "Pause planet rotation" : "Resume planet rotation"}
                >
                  {isAutoRotating ? <Pause className="size-3 text-amber" /> : <Play className="size-3 text-mint" />}
                  <span>{isAutoRotating ? "Spinning" : "Paused"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetCamera}
                  className="rounded-full border border-white/15 bg-black/70 p-1.5 text-white/80 hover:text-white backdrop-blur-md transition-colors"
                  title="Reset globe orientation"
                >
                  <RotateCcw className="size-3" />
                </button>
              </div>
            </div>

            {/* Bottom Landmark Fast Selector */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-white/15 bg-black/70 p-2 text-white backdrop-blur-md">
              <div className="flex items-center gap-1">
                <MapPin className="size-3 text-amber" />
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/60">
                  Landmarks:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 font-mono text-[9px]">
                {HERO_MARS_LANDMARKS.map((lm) => (
                  <button
                    key={lm.id}
                    type="button"
                    onClick={() => setActiveLandmarkId(lm.id)}
                    className={`rounded-md px-2 py-0.5 transition-colors ${
                      activeLandmarkId === lm.id
                        ? "bg-amber text-slate-950 font-bold"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    {lm.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. RIGHT SIDE: MARTIAN ENVIRONMENT LIVE-DATA PANEL */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-line/80 bg-white/95 dark:bg-[#070c16]/85 p-5 shadow-xl backdrop-blur-2xl space-y-3.5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-line/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Radio className="size-3.5 text-emerald-600 dark:text-mint animate-pulse" />
                <span className="text-[10px] text-slate-900 dark:text-bright font-bold uppercase tracking-wider">
                  Martian Environment
                </span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/25 dark:bg-mint/15 dark:text-mint dark:border-mint/30 font-semibold">
                MEDA Calibrated
              </span>
            </div>

            {/* Metric 1: Temperature */}
            <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-ink2/50 border border-slate-200/80 dark:border-line/50 hover:border-amber-500/40 transition-colors flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-fog text-[10px] uppercase">
                  <Thermometer className="size-3 text-rose-500 dark:text-rose" />
                  <span>Surface Temperature</span>
                </div>
                <strong className="text-base text-slate-900 dark:text-bright font-bold font-display mt-0.5 block">−62°C</strong>
                <span className="text-[9px] text-slate-500 dark:text-fog block">Diurnal: −125°C to +20°C</span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-fog text-right">NASA MEDA<br />ATS Sensor</span>
            </div>

            {/* Metric 2: Atmospheric Pressure */}
            <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-ink2/50 border border-slate-200/80 dark:border-line/50 hover:border-amber-500/40 transition-colors flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-fog text-[10px] uppercase">
                  <Gauge className="size-3 text-cyan-600 dark:text-cyan" />
                  <span>Atmospheric Pressure</span>
                </div>
                <strong className="text-base text-slate-900 dark:text-bright font-bold font-display mt-0.5 block">760 Pa</strong>
                <span className="text-[9px] text-slate-500 dark:text-fog block">Jezero Floor (−2,560m)</span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-fog text-right">MEDA PS<br />Barometer</span>
            </div>

            {/* Metric 3: Solar Radiation */}
            <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-ink2/50 border border-slate-200/80 dark:border-line/50 hover:border-amber-500/40 transition-colors flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-fog text-[10px] uppercase">
                  <Zap className="size-3 text-amber-600 dark:text-amber" />
                  <span>Ionizing Radiation</span>
                </div>
                <strong className="text-base text-slate-900 dark:text-bright font-bold font-display mt-0.5 block">0.64 mSv/d</strong>
                <span className="text-[9px] text-slate-500 dark:text-fog block">GCR Baseline Dose</span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-fog text-right">MSL RAD<br />Detector</span>
            </div>

            {/* Metric 4: Wind Speed */}
            <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-ink2/50 border border-slate-200/80 dark:border-line/50 hover:border-amber-500/40 transition-colors flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-fog text-[10px] uppercase">
                  <Wind className="size-3 text-indigo-500 dark:text-indigo-400" />
                  <span>Surface Wind Speed</span>
                </div>
                <strong className="text-base text-slate-900 dark:text-bright font-bold font-display mt-0.5 block">4.2 m/s</strong>
                <span className="text-[9px] text-slate-500 dark:text-fog block">Gusts up to 14.5 m/s</span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-fog text-right">WS1 &amp; WS2<br />Anemometer</span>
            </div>

            {/* Metric 5: Water Ice Potential */}
            <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-ink2/50 border border-slate-200/80 dark:border-line/50 hover:border-amber-500/40 transition-colors flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-fog text-[10px] uppercase">
                  <Sparkles className="size-3 text-emerald-600 dark:text-mint" />
                  <span>Water Ice Potential</span>
                </div>
                <strong className="text-base text-emerald-600 dark:text-mint font-bold font-display mt-0.5 block">SWIM Depth 0–1m</strong>
                <span className="text-[9px] text-emerald-700/80 dark:text-mint/80 block">84% Consistency Index</span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-fog text-right">SWIM 2.0<br />SHARAD Radar</span>
            </div>

            <div className="pt-1 text-[9px] text-slate-500 dark:text-fog flex items-center justify-between">
              <span>Timestamp: Sol 142 · 14:18 LMST</span>
              <span className="text-amber-600 dark:text-amber font-semibold">PDS Synchronized</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION C: 7 MISSION MODULE CARDS (Core Architecture Grid)
         ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-line/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber" />
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber font-bold">
                Exploration Systems
              </p>
            </div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-bright">
              Mission Modules &amp; Analytical Suites
            </h2>
          </div>
          <p className="font-mono text-xs text-fog max-w-md text-left sm:text-right">
            Seven deep scientific tools connecting orbital telemetry, foundation ML models, and live physics simulations.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MISSION_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.id}
                to={mod.to}
                className={`group relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-line/80 bg-white/90 dark:bg-[#070c16]/80 p-5 shadow-lg backdrop-blur-2xl transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between ${mod.accentBorder}`}
              >
                {/* Background Terrain Silhouette */}
                <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity">
                  <img
                    src={mod.image}
                    alt={mod.title}
                    className="size-full object-cover grayscale contrast-125"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-[#070c16] dark:via-[#070c16]/80 dark:to-transparent" />
                </div>

                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-2xl bg-slate-100/90 dark:bg-ink2/70 border border-slate-200/90 dark:border-line/60 shrink-0">
                      <Icon className={`size-5 ${mod.color}`} />
                    </div>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-ink2/80 text-slate-600 dark:text-fog border border-slate-200 dark:border-line/60">
                      {mod.stat}
                    </span>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-fog uppercase block">{mod.category}</span>
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-bright group-hover:text-amber-600 dark:group-hover:text-amber transition-colors">
                      {mod.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-fog leading-relaxed font-mono">
                    {mod.description}
                  </p>
                </div>

                <div className="relative z-10 mt-5 pt-3 border-t border-slate-200/70 dark:border-line/50 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-amber-600 dark:text-amber font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Launch Module <ArrowRight className="size-3.5" />
                  </span>
                  <span className="text-slate-500 dark:text-fog text-[10px]">Route Active</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECTION D: FEATURED DATA INSIGHT (Cinematic Spotlight on Jezero Crater)
         ========================================================================= */}
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/90 dark:border-line/80 bg-gradient-to-br from-white via-slate-50 to-orange-50/20 dark:from-[#0c1322] dark:via-[#070c16] dark:to-[#040810] p-6 shadow-xl dark:shadow-2xl backdrop-blur-2xl sm:p-8 lg:p-10 transition-colors">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
          {/* Scientific Imagery & Overlay */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-line/70 shadow-2xl group">
            <img
              src="/mars-jezero-map.jpg"
              alt="Jezero Crater HiRISE Scientific Terrain Mosaic"
              className="w-full aspect-[16/10] object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white font-mono text-xs">
              <div>
                <span className="text-[10px] text-amber uppercase font-bold block">NASA HiRISE Mosaic</span>
                <strong>Jezero Crater Delta &amp; Neretva Vallis</strong>
              </div>
              <span className="px-2 py-1 rounded bg-black/60 border border-white/20 text-[10px]">
                GSD 0.25 m/px
              </span>
            </div>
          </div>

          {/* Scientific Data & Provenance Information */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 text-amber-700 border border-amber-500/25 dark:bg-amber/15 dark:text-amber dark:border-amber/30 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider">
              <Compass className="size-3.5" />
              Featured Scientific Insight · Candidate Sector
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-bright tracking-tight">
              Jezero Crater Delta Complex
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-fog leading-relaxed font-mono">
              Ancient lacustrine lake system fed by Neretva Vallis. Preserves layered clay smectites, deltaic cross-bedded mudstones, and shoreline carbonate precipitates with the highest biosignature potential on Mars.
            </p>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-ink2/50 border border-slate-200/90 dark:border-line/60 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-fog uppercase block">Landing Site</span>
                <strong className="text-slate-900 dark:text-bright block mt-0.5">Octavia E. Butler</strong>
                <span className="text-[10px] text-slate-500 dark:text-fog">18.38°N, 77.58°E · −2,560m</span>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-ink2/50 border border-slate-200/90 dark:border-line/60 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-fog uppercase block">Water Ice &amp; Clay</span>
                <strong className="text-emerald-600 dark:text-mint block mt-0.5">Hydrated Smectite</strong>
                <span className="text-[10px] text-emerald-700/80 dark:text-mint">Bound Mineral Water</span>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-ink2/50 border border-slate-200/90 dark:border-line/60 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-fog uppercase block">Radiation Environment</span>
                <strong className="text-slate-900 dark:text-bright block mt-0.5">0.62 mSv/day</strong>
                <span className="text-[10px] text-slate-500 dark:text-fog">Delta scarp shadow protection</span>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-ink2/50 border border-slate-200/90 dark:border-line/60 shadow-sm">
                <span className="text-[10px] text-slate-500 dark:text-fog uppercase block">Rover Expedition</span>
                <strong className="text-amber-600 dark:text-amber block mt-0.5">Perseverance</strong>
                <span className="text-[10px] text-amber-700 dark:text-amber">43 Sample Tubes Cached</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/planetary-map"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-5 py-3 font-display text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
              >
                <Layers className="size-4" />
                <span>View on Planetary Map</span>
              </Link>

              <button
                type="button"
                onClick={() => setBriefingOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-line bg-white dark:bg-panel px-4 py-3 font-display text-xs font-semibold text-slate-800 dark:text-bright hover:bg-slate-50 dark:hover:bg-ink2 shadow-sm transition-all"
              >
                <Info className="size-4 text-cyan-600 dark:text-cyan" />
                <span>Learn More (Briefing)</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION E: LIVE MISSION RECORDS & NASA ATLAS
         ========================================================================= */}
      <section id="sites" className="scroll-mt-20 space-y-4">
        <div className="flex items-end justify-between border-b border-line/60 pb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-fog font-bold">
              Candidate Surface Waypoints
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-bright">
              Indexed Planetary Mission Records
            </h2>
          </div>
          <span className="font-mono text-xs text-fog hidden sm:inline">
            {marsSites.length} Surveyed Sectors
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {marsSites.slice(0, 3).map((site) => (
            <div
              key={site.id}
              className="rounded-3xl border border-slate-200/90 dark:border-line/80 bg-white/90 dark:bg-[#070c16]/80 p-5 shadow-lg backdrop-blur-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 border border-amber-500/25 dark:bg-amber/15 dark:text-amber dark:border-amber/30 font-bold uppercase">
                    {site.region}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-fog">
                    {site.latitude.toFixed(1)}°N, {site.longitude.toFixed(1)}°E
                  </span>
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-bright">{site.name}</h3>
                <p className="mt-2 text-xs text-slate-600 dark:text-fog leading-relaxed font-mono">
                  {site.significance}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200/70 dark:border-line/50 flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-500 dark:text-fog">Elevation: {site.elevation}</span>
                <Link
                  to="/planetary-map"
                  className="text-amber-600 dark:text-amber font-semibold hover:underline inline-flex items-center gap-1"
                >
                  Inspect Site <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NASA DATA ATLAS COMPONENT */}
      <NasaDataAtlas />

      {/* SURVIVAL SIMULATOR COMPONENT */}
      <SurvivalSimulator />

      {/* =========================================================================
          MISSION OVERVIEW BRIEFING MODAL (Watch Overview Trigger)
         ========================================================================= */}
      {briefingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-line/80 bg-white/95 dark:bg-[#070c16]/95 shadow-2xl backdrop-blur-2xl p-6 sm:p-8 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="size-5 text-amber" />
                <h3 className="font-display text-lg font-bold text-bright">
                  MARS // SURVIVE — Mission Overview Briefing
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBriefingOpen(false)}
                className="p-1 rounded-lg text-fog hover:text-bright transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs text-fog leading-relaxed">
              <p>
                <strong className="text-bright font-display text-sm block mb-1">
                  NASA Space Apps Challenge 2026 Mission Architecture
                </strong>
                The Interplanetary Survival Guide is an integrated aerospace decision-support platform designed for future human crewed and robotic surface operations on Mars.
              </p>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="p-3 rounded-xl bg-ink2/50 border border-line/60">
                  <span className="text-amber font-bold uppercase block text-[10px]">1. Orbital GIS &amp; Pathfinding</span>
                  <p className="mt-1">Full 2D/3D Mars Trek WMTS mosaic blending with A* multi-objective risk pathfinding.</p>
                </div>
                <div className="p-3 rounded-xl bg-ink2/50 border border-line/60">
                  <span className="text-indigo-400 font-bold uppercase block text-[10px]">2. Planetary AI Suite</span>
                  <p className="mt-1">7 Hugging Face models + 1m DTM gradient-boosted hazard surrogate for semantic terrain analysis.</p>
                </div>
                <div className="p-3 rounded-xl bg-ink2/50 border border-line/60">
                  <span className="text-cyan font-bold uppercase block text-[10px]">3. SWIM 2.0 Subsurface Ice</span>
                  <p className="mt-1">Putzig et al. radar consistency across 3 depth horizons (0–1m, 1–5m, &gt;5m).</p>
                </div>
                <div className="p-3 rounded-xl bg-ink2/50 border border-line/60">
                  <span className="text-mint font-bold uppercase block text-[10px]">4. 120 Hz Rover Terramechanics</span>
                  <p className="mt-1">Bekker–Wong soil sinkage, rocker-bogie differential kinematics, and SuperCam LIBS laser.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber/10 border border-amber/30 text-bright">
                <span className="text-amber font-bold uppercase block text-[10px]">Ground Truth Verification</span>
                All metrics, terrain elevations, and atmospheric parameters are calibrated from NASA PDS archives, Mars 2020 MEDA, MSL RAD, and NAIF SPICE kernels.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBriefingOpen(false)}
                className="px-4 py-2 rounded-xl border border-line font-mono text-xs text-fog hover:text-bright"
              >
                Dismiss
              </button>
              <Link
                to="/planetary-map"
                onClick={() => setBriefingOpen(false)}
                className="px-5 py-2 rounded-xl bg-amber text-ink font-display text-xs font-bold hover:bg-amber/90 transition-colors"
              >
                Enter Planetary Map
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
