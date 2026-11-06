import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  CircleDot,
  Compass,
  Database,
  ExternalLink,
  Eye,
  Globe2,
  Layers,
  MapPin,
  MapPinned,
  Maximize2,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Html, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { marsSites } from "@/components/MarsExplorer";
import { NasaDataAtlas } from "@/components/NasaDataAtlas";
import { SurvivalSimulator } from "@/components/SurvivalSimulator";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Martian Map — Interplanetary Survival Guide // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Planetary exploration and survival platform: interactive 3D Mars globe, live Mars Trek WMTS GIS workspace, SWIM 2.0 subsurface water ice, and scientific hazard intelligence.",
      },
      { property: "og:title", content: "Martian Map — Interplanetary Survival Guide" },
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
  {
    id: "gale",
    name: "Gale Crater",
    mission: "Curiosity Rover & Mount Sharp",
    lat: -4.58,
    lon: 137.44,
    elevation: "−4,450 m",
    color: "#10b981", // Emerald
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
          // Boost surface roughness & relief contrast
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

function HomeMarsGlobeHero() {
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [activeLandmarkId, setActiveLandmarkId] = useState<string | null>("jezero");
  const controlsRef = useRef<any>(null);

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px] overflow-hidden rounded-[28px] border border-white/10 bg-radial from-[#0d1624] via-[#070d17] to-[#040810] p-2 shadow-2xl lg:max-w-none">
      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 2.85], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={["#040810"]} />

        {/* Space Lighting */}
        <ambientLight intensity={0.45} color="#cbd5e1" />
        {/* Sharp Solar Sunbeam */}
        <directionalLight position={[5, 3, 5]} intensity={3.5} color="#fff1e0" castShadow />
        {/* Soft Twilight Blue Fill Light on Dark Horizon */}
        <directionalLight position={[-4, -1, -3]} intensity={1.1} color="#38bdf8" />

        <Environment>
          <Lightformer intensity={1.2} color="#ffb58f" position={[4, 2, 4]} scale={[5, 5, 1]} />
          <Lightformer
            intensity={0.6}
            color="#38bdf8"
            position={[-4, 0, -2]}
            rotation-y={Math.PI / 2}
            scale={[4, 3, 1]}
          />
        </Environment>

        <Suspense
          fallback={
            <Html center>
              <div className="font-mono text-[11px] text-amber-400 uppercase tracking-widest">
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

        {/* Interactive Smooth Orbit Controls */}
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

      {/* Top Floating Controls & Telemetry */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-white backdrop-blur-md pointer-events-auto">
          <span className="beacon-dot size-2 rounded-full bg-mint animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/90">
            3D Planetary Model · 25.2° Tilt
          </span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className="flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-white/80 hover:text-white backdrop-blur-md font-mono text-[9px] uppercase transition-colors"
            title={isAutoRotating ? "Pause planet auto-rotation" : "Resume planet rotation"}
          >
            {isAutoRotating ? <Pause className="size-3 text-amber" /> : <Play className="size-3 text-mint" />}
            {isAutoRotating ? "Spinning" : "Paused"}
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            className="rounded-full border border-white/15 bg-black/60 p-1 text-white/80 hover:text-white backdrop-blur-md transition-colors"
            title="Reset globe orientation"
          >
            <RotateCcw className="size-3" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Landmark Fast-Switcher */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-white/15 bg-black/60 p-2 text-white backdrop-blur-md">
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
  );
}

function IndexPage() {
  return (
    <div className="space-y-10">
      {/* 1. HERO SECTION WITH ENHANCED 3D MARS GLOBE & MISSION STATUS */}
      <section className="hero-mars rise-in rounded-[28px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <div className="hero-orbit" aria-hidden="true" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-mint">
                <span className="size-1.5 rounded-full bg-mint animate-pulse" /> NASA Space Apps 2026
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/75 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-fog">
                <Sparkles className="size-3.5 text-amber" /> Planetary GIS &amp; Survival Hub
              </span>
            </div>
            <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[.24em] text-amber">
              Interplanetary Survival Guide
            </p>
            <h1 className="mt-2 max-w-3xl font-display text-4xl font-bold leading-[.98] tracking-[-.04em] text-bright sm:text-5xl lg:text-7xl">
              Plan a Mars mission
              <span className="block text-amber">before Mars plans for you.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fog sm:text-base">
              Unified NASA planetary intelligence workspace fusing live NASA Mars Trek WMTS orthomosaics,
              SWIM 2.0 subsurface water ice, multimodal scientific hazard analysis, and survival simulators.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/planetary-map"
                className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-3 font-display text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber/90 hover:shadow-md"
              >
                <Layers className="size-4" /> Open Planetary Map
              </Link>
              <Link
                to="/sol-by-sol"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/80 px-4 py-3 font-display text-sm font-semibold text-bright shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <Timer className="size-4 text-amber" /> Sol by Sol Station
              </Link>
              <Link
                to="/mission-lab"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/80 px-4 py-3 font-display text-sm font-semibold text-bright shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <Box className="size-4 text-cyan" /> 3D Regional Lab
              </Link>
              <a
                href="#sites"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/80 px-4 py-3 font-display text-sm font-semibold text-bright shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <MapPinned className="size-4 text-rose" /> Candidate Sites
              </a>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              <HeroMetric label="Indexed sites" value="14 surveyed" />
              <HeroMetric label="Surface gravity" value="3.72 m/s²" />
              <HeroMetric label="Martian Sol" value="24h 39m 35s" />
              <HeroMetric label="Crustal field" value="4.1B yr remnant" />
            </div>
          </div>

          {/* Right Hero: Gorgeous 3D Mars Globe */}
          <HomeMarsGlobeHero />
        </div>
      </section>

      {/* 2. PLANETARY PHYSICAL FACTS RIBBON */}
      <section className="overflow-hidden rounded-2xl border border-line bg-white/70 shadow-sm backdrop-blur-xl">
        <div className="grid divide-y divide-line/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <PlanetFact label="Solar Day (Sol)" value="24h 39m 35.24s" note="1.0275x Earth Day length" />
          <PlanetFact label="Surface Gravity" value="0.379 g (3.72 m/s²)" note="38% of Earth standard gravity" />
          <PlanetFact label="Mean Pressure" value="610 Pa (6.1 mbar)" note="Thin CO₂ atmosphere (~0.6% Earth)" />
          <PlanetFact label="Atmosphere Composition" value="95.3% CO₂ · 2.6% N₂" note="1.9% Ar · traces of O₂ & H₂O" />
        </div>
      </section>

      {/* 3. DEDICATED PLANETARY MAP CALLOUT & BRIEFING CARD */}
      <section id="planetary-map" className="scroll-mt-20">
        <div className="rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/[0.08] via-white to-cyan/[0.05] p-6 sm:p-8 shadow-sm backdrop-blur-xl">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-amber/15 text-amber">
                  <Layers className="size-4" />
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber">
                  Dedicated Planetary GIS Workspace
                </span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-bright sm:text-3xl">
                NASA Mars Trek 2D/3D Map &amp; Hazard Intelligence
              </h2>
              <p className="mt-3 text-sm text-fog leading-relaxed max-w-2xl">
                Experience the complete planetary exploration deck on its own dedicated workspace page.
                Seamlessly toggle high-resolution NASA Mars Trek WMTS mosaics (MOLA, Viking MDIM2.1, THEMIS, CTX, HiRISE),
                SWIM 2.0 subsurface water ice depth horizons, calibrated multi-mission hazard layers, distance measurement,
                route planning, and the Grounded AI Mission Advisor.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  to="/planetary-map"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-3 font-display text-sm font-semibold text-ink shadow-sm transition hover:bg-amber/90"
                >
                  <Maximize2 className="size-4" /> Launch Dedicated Planetary Map <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/hazard-layers"
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-white/80 px-4 py-3 font-display text-xs font-semibold text-bright shadow-sm hover:bg-white"
                >
                  <ShieldAlert className="size-3.5 text-rose" /> Inspect Hazard Layers
                </Link>
              </div>
            </div>

            {/* Quick Layer Highlights Preview Box */}
            <div className="rounded-xl border border-line bg-ink2/60 p-4 space-y-2.5 font-mono text-xs">
              <p className="text-[10px] uppercase tracking-wider text-fog font-bold">Integrated GIS Layers</p>
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-bright flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber" />
                  MOLA Elevation &amp; Hillshade
                </span>
                <span className="text-fog text-[10px]">128 px/deg</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-bright flex items-center gap-2">
                  <span className="size-2 rounded-full bg-cyan" />
                  SWIM 2.0 Subsurface Water Ice
                </span>
                <span className="text-cyan text-[10px]">0–1m, 1–5m, &gt;5m</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-bright flex items-center gap-2">
                  <span className="size-2 rounded-full bg-rose" />
                  MARIE / MSL RAD Radiation
                </span>
                <span className="text-rose text-[10px]">0.64 mSv/day</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-bright flex items-center gap-2">
                  <span className="size-2 rounded-full bg-mint" />
                  Viking MDIM2.1 True Color
                </span>
                <span className="text-mint text-[10px]">Global Ortho</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-bright flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber-400" />
                  THEMIS Night IR &amp; TES Tau
                </span>
                <span className="text-amber-400 text-[10px]">Thermal Inertia</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SCIENTIFIC TELEMETRY STAT CARDS */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Slope & Roughness"
          value="MOLA"
          unit="DEM"
          status="Calibrated 128 px/deg elevation & steep slope analyzer"
          color="text-amber"
          icon={<ShieldCheck className="size-4" />}
        />
        <StatCard
          label="Radiation Planning"
          value="0.64"
          unit="mSv/d"
          status="MSL RAD surface dose & Odyssey MARIE baseline"
          color="text-rose"
          icon={<ShieldAlert className="size-4" />}
        />
        <StatCard
          label="Subsurface Water Ice"
          value="SWIM"
          unit="2.0"
          status="Putzig et al. consistency across 3 depth horizons"
          color="text-cyan"
          icon={<CircleDot className="size-4" />}
        />
        <StatCard
          label="Thermal & Atmospheric"
          value="THEMIS"
          unit="TES"
          status="Night-time thermal inertia & dust opacity tau"
          color="text-mint"
          icon={<Zap className="size-4" />}
        />
      </section>

      {/* 5. MISSION CAPABILITIES FEATURE TILES */}
      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          icon={<Layers className="size-5 text-cyan" />}
          title="Layered Planetary GIS"
          text="Overlay authoritative NASA Mars Trek WMTS layers (MOLA, Viking MDIM2.1, THEMIS, CTX, HiRISE) with live opacity blending and 2D/3D dual-mode visualization on the Planetary Map page."
        />
        <FeatureCard
          icon={<ShieldAlert className="size-5 text-amber" />}
          title="Multimodal Hazard Analysis"
          text="Analyze dangerous slopes (>10°), rover trafficability risks, ionizing radiation exposure from MARIE/RAD, thermal shock, and dust storm opacity."
        />
        <FeatureCard
          icon={<Database className="size-5 text-mint" />}
          title="NASA Data Provenance"
          text="Search and filter official NASA datasets from PDS, Earthdata, Worldview, Giovanni, POWER, FIRMS, and SEDAC with one-click map activation."
        />
      </section>

      {/* 6. DEMO BRIEFING CALLOUT */}
      <section className="rounded-2xl border border-amber/30 bg-amber/[0.06] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">Demo briefing</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Build your story around one mission leg.</h2>
          </div>
          <ArrowUpRight className="size-5 text-amber" />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-fog">
          Start at a landing site (like Jezero Crater or Gale), open the dedicated Planetary Map, enable the route and hazard
          layers, inspect the SWIM 2.0 subsurface ice horizons, measure distances with the precision measurement tool, check
          the Sol by Sol survival simulation, and test an EVA.
        </p>
      </section>

      {/* 7. CANDIDATE SURFACE SECTORS (INDEXED MISSION WAYPOINTS) */}
      <section id="sites" className="scroll-mt-20">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-fog">Candidate surface sectors</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">Indexed mission waypoints</h2>
          </div>
          <span className="hidden font-mono text-[11px] text-fog sm:inline">{marsSites.length} live demo records</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {marsSites.slice(0, 3).map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      </section>

      {/* 8. NASA DATA ATLAS (SEARCHABLE DATASET REGISTRY WITH ACTIVATION) */}
      <NasaDataAtlas />

      {/* 9. MARTIAN SURFACE SURVIVAL SIMULATOR */}
      <SurvivalSimulator />
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-white backdrop-blur-md">
      <p className="font-mono text-[8px] uppercase tracking-[.15em] text-white/55">{label}</p>
      <p className="mt-1 font-display text-sm font-bold">{value}</p>
    </div>
  );
}

function PlanetFact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-panel/80 p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fog">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-bright">{value}</p>
      <p className="mt-0.5 text-[10px] text-fog">{note}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  status,
  color,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  status: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-white/80 shadow-sm p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog">{label}</p>
        <span className={color}>{icon}</span>
      </div>
      <p className={`mt-2 font-display text-2xl font-bold ${color}`}>
        {value} <span className="font-mono text-xs text-fog">{unit}</span>
      </p>
      <p className="mt-1 text-[11px] text-fog">{status}</p>
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink2/60 p-4">
      <span className="text-cyan">{icon}</span>
      <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-[12px] leading-relaxed text-fog">{text}</p>
    </div>
  );
}

function SiteCard({ site }: { site: (typeof marsSites)[number] }) {
  const tone = site.score >= 80 ? "mint" : site.score >= 60 ? "amber" : "rose";
  const scoreClasses = {
    mint: "bg-mint/15 border-mint/30 text-mint",
    amber: "bg-amber/15 border-amber/30 text-amber",
    rose: "bg-rose/15 border-rose/30 text-rose",
  } as const;

  return (
    <div className="rounded-xl border border-line bg-white/80 shadow-sm p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-fog">{site.coordinates}</span>
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${scoreClasses[tone]}`}>
          {site.score}
        </span>
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold">{site.name}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-fog">{site.terrain}</p>
      <div className="mt-4 space-y-2 border-t border-line/60 pt-3">
        <MetaRow label="Water ice" value={site.waterIce} tone="text-cyan" />
        <MetaRow label="Radiation" value={site.radiation} tone="text-rose" />
        <MetaRow label="Rover / relay" value={site.rover} tone="text-amber" />
      </div>
    </div>
  );
}

function MetaRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-4 font-mono text-[10px]">
      <span className="text-fog">{label}</span>
      <span className={tone}>{value}</span>
    </div>
  );
}
