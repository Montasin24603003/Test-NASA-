import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  AlertTriangle,
  Compass,
  Info,
  Layers,
  Lock,
  Maximize2,
  Navigation,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Unlock,
} from "lucide-react";
import { headingToCardinal } from "@/lib/mars-time";
import type { MarsLocation } from "@/lib/mars-locations";

interface MarsCompass3DProps {
  headingDeg: number;
  setHeadingDeg: (heading: number) => void;
  selectedLocation: MarsLocation;
}

// 3D Mars Mini Globe inside Compass Core
function MarsGlobeMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group>
      {/* Central Martian Sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.15, 36, 36]} />
        <meshStandardMaterial
          color="#c85a2b"
          roughness={0.78}
          metalness={0.08}
        />
      </mesh>

      {/* Lat/Lon Coordinate Wireframe Grid */}
      <mesh scale={1.16}>
        <sphereGeometry args={[1.15, 24, 24]} />
        <meshBasicMaterial
          color="#fbd38d"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>

      {/* Atmospheric Haze Glow */}
      <mesh scale={1.28}>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// 3D 360-degree Azimuth Ring and Floating Needle
function Compass3DNeedle({ targetHeadingDeg }: { targetHeadingDeg: number }) {
  const needleGroupRef = useRef<THREE.Group>(null);
  const currentRotation = useRef(targetHeadingDeg);

  useFrame((_, delta) => {
    if (!needleGroupRef.current) return;
    // Smooth angle interpolation handling 360 wrap
    let diff = (targetHeadingDeg - currentRotation.current) % 360;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;

    currentRotation.current += diff * Math.min(1, delta * 12);
    // Negative rotation so the needle aligns with azimuth
    needleGroupRef.current.rotation.z = -THREE.MathUtils.degToRad(currentRotation.current);
  });

  return (
    <group ref={needleGroupRef}>
      {/* North Arrow Tip (Vibrant Mars Crimson) */}
      <mesh position={[0, 1.45, 0.05]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.18, 0.75, 4]} />
        <meshStandardMaterial
          color="#dc2626"
          roughness={0.3}
          metalness={0.2}
          emissive="#7f1d1d"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* North Stem */}
      <mesh position={[0, 0.65, 0.04]}>
        <boxGeometry args={[0.08, 0.9, 0.04]} />
        <meshStandardMaterial color="#dc2626" roughness={0.3} />
      </mesh>

      {/* South Arrow Tip (Navy/White) */}
      <mesh position={[0, -1.45, 0.05]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.18, 0.75, 4]} />
        <meshStandardMaterial
          color="#334155"
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>

      {/* South Stem */}
      <mesh position={[0, -0.65, 0.04]}>
        <boxGeometry args={[0.08, 0.9, 0.04]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} />
      </mesh>

      {/* Central Golden Pivot Gimbal */}
      <mesh position={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.22, 0.22, 0.08, 24]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.2} metalness={0.8} />
      </mesh>
    </group>
  );
}

export function MarsCompass3D({
  headingDeg,
  setHeadingDeg,
  selectedLocation,
}: MarsCompass3DProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [compassMode, setCompassMode] = useState<"geographic" | "crustal">("geographic");
  const [showScienceDialog, setShowScienceDialog] = useState(false);
  const compassDialRef = useRef<HTMLDivElement>(null);

  // Effective displayed heading depends on mode:
  // Geographic Mode = True Rotational North (0° = Mars North Pole)
  // Crustal Mode = Local Remnant Crustal Anomaly Deflection
  const displayedHeading = useMemo(() => {
    if (compassMode === "geographic") {
      return headingDeg;
    }
    // Add local crustal field deflection
    let shifted = (headingDeg + selectedLocation.simulatedCrustalDeclinationDeg) % 360;
    if (shifted < 0) shifted += 360;
    return Math.round(shifted);
  }, [compassMode, headingDeg, selectedLocation.simulatedCrustalDeclinationDeg]);

  const cardinal = headingToCardinal(displayedHeading);

  // Handle pointer rotation directly on the compass dial
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateAngleFromPointer(e);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateAngleFromPointer(e);
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Safe fallback
    }
  }, []);

  const updateAngleFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!compassDialRef.current) return;
    const rect = compassDialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = e.clientX;
    const clientY = e.clientY;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    // Angle clockwise from 12 o'clock (North)
    let angleRad = Math.atan2(deltaX, -deltaY);
    let angleDeg = THREE.MathUtils.radToDeg(angleRad);
    if (angleDeg < 0) angleDeg += 360;

    setHeadingDeg(Math.round(angleDeg) % 360);
  };

  // Step adjustment helpers
  const adjustHeading = (delta: number) => {
    let next = (headingDeg + delta) % 360;
    if (next < 0) next += 360;
    setHeadingDeg(next);
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Compass Header & Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
            <Compass className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan">
                Mars 3D Compass
              </span>
              <span className="rounded-full bg-cyan/15 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan">
                GYRO AZIMUTH
              </span>
            </div>
            <p className="font-display text-xl font-bold tracking-tight text-bright">
              {displayedHeading.toString().padStart(3, "0")}° {cardinal}
            </p>
          </div>
        </div>

        {/* Geographic True North vs Simulated Crustal Magnetic Mode */}
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-ink2/70 p-1">
          <button
            type="button"
            onClick={() => setCompassMode("geographic")}
            className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${
              compassMode === "geographic"
                ? "bg-white text-bright shadow-sm font-bold"
                : "text-fog hover:text-bright"
            }`}
          >
            GEOGRAPHIC (TRUE N)
          </button>
          <button
            type="button"
            onClick={() => setCompassMode("crustal")}
            className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${
              compassMode === "crustal"
                ? "bg-rose/15 text-rose border border-rose/30 font-bold"
                : "text-fog hover:text-bright"
            }`}
          >
            CRUSTAL FIELD (SIM)
          </button>
        </div>
      </div>

      {/* Main 3D Canvas & Interactive Dial Card */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-[#0a111a] via-[#101924] to-[#0a111a] p-4 text-white shadow-xl">
        {/* NASA Notice for Planetary Magnetism */}
        <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-black/40 p-2.5 backdrop-blur-md">
          <div className="flex items-start gap-2 text-[11px] leading-tight">
            <ShieldAlert className="size-4 shrink-0 text-amber mt-0.5" />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber">
                Planetary Physics Notice: Mars Dynamo Inactive
              </p>
              <p className="text-white/70 text-[11px]">
                {compassMode === "geographic" ? (
                  <>
                    Mars lacks an active global dipolar magnetic field. Compass heading is{" "}
                    <strong className="text-white">True Geographic Azimuth</strong> guided by celestial
                    sun-sensors and inertial gyroscopes.
                  </>
                ) : (
                  <>
                    <strong className="text-rose">Crustal Remnant Mode:</strong> Needle deflects by{" "}
                    <strong>{selectedLocation.simulatedCrustalDeclinationDeg}°</strong> due to localized
                    magnetized crust at {selectedLocation.name}. Real magnetic compasses do NOT point North on Mars.
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowScienceDialog(!showScienceDialog)}
            className="shrink-0 rounded-md border border-white/20 bg-white/10 p-1 text-white/80 hover:text-white"
            title="Read planetary magnetism science background"
          >
            <Info className="size-3.5" />
          </button>
        </div>

        {/* 3D Canvas & Dial Viewport */}
        <div
          ref={compassDialRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative mx-auto aspect-square w-full max-w-[340px] cursor-grab active:cursor-grabbing select-none"
        >
          {/* 3D Three.js Scene */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <Canvas
              camera={{ position: [0, 0, 3.8], fov: 45 }}
              dpr={[1, 1.8]}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[3, 4, 3]} intensity={2.2} color="#ffd4b8" />
              <directionalLight position={[-3, -2, -2]} intensity={0.6} color="#7dd3fc" />
              <Suspense fallback={null}>
                <MarsGlobeMesh />
                <Compass3DNeedle targetHeadingDeg={displayedHeading} />
              </Suspense>
            </Canvas>
          </div>

          {/* 2D Compass Graduation Overlay (Ticks & Cardinal Labels) */}
          <svg
            viewBox="0 0 300 300"
            className="pointer-events-none absolute inset-0 size-full"
          >
            {/* Outer Graduation Ring */}
            <circle
              cx="150"
              cy="150"
              r="140"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeOpacity="0.4"
            />
            <circle
              cx="150"
              cy="150"
              r="134"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeOpacity="0.2"
            />

            {/* 360 Degree Tick Marks */}
            {Array.from({ length: 72 }).map((_, i) => {
              const deg = i * 5;
              const rad = ((deg - 90) * Math.PI) / 180;
              const isMajor = deg % 30 === 0;
              const isCardinal = deg % 90 === 0;
              const len = isCardinal ? 14 : isMajor ? 9 : 4;
              const r1 = 140 - len;
              const r2 = 140;

              const x1 = 150 + r1 * Math.cos(rad);
              const y1 = 150 + r1 * Math.sin(rad);
              const x2 = 150 + r2 * Math.cos(rad);
              const y2 = 150 + r2 * Math.sin(rad);

              const textR = 118;
              const tx = 150 + textR * Math.cos(rad);
              const ty = 150 + textR * Math.sin(rad);

              return (
                <g key={`tick-${deg}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isCardinal ? "#f97316" : isMajor ? "#38bdf8" : "#94a3b8"}
                    strokeWidth={isCardinal ? 2.5 : isMajor ? 1.5 : 0.8}
                    strokeOpacity={isCardinal ? 1 : isMajor ? 0.8 : 0.4}
                  />
                  {isMajor && !isCardinal && (
                    <text
                      x={tx}
                      y={ty + 3}
                      textAnchor="middle"
                      fontSize="8"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#94a3b8"
                    >
                      {deg}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Cardinal Letters (N, E, S, W) */}
            <text
              x="150"
              y="32"
              textAnchor="middle"
              fontSize="16"
              fontWeight="800"
              fontFamily="Space Grotesk, sans-serif"
              fill="#ef4444"
            >
              N
            </text>
            <text
              x="272"
              y="155"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fontFamily="Space Grotesk, sans-serif"
              fill="#38bdf8"
            >
              E
            </text>
            <text
              x="150"
              y="280"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fontFamily="Space Grotesk, sans-serif"
              fill="#94a3b8"
            >
              S
            </text>
            <text
              x="28"
              y="155"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fontFamily="Space Grotesk, sans-serif"
              fill="#38bdf8"
            >
              W
            </text>
          </svg>

          {/* Interactive Drag Hint Overlay */}
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 text-center">
            <span className="rounded-full border border-white/20 bg-black/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
              Drag dial or touch to steer
            </span>
          </div>
        </div>

        {/* Digital Heading Telemetry Bar */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/15 bg-black/50 px-4 py-3 backdrop-blur-md">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">
              Bearing Direction
            </p>
            <p className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {displayedHeading.toString().padStart(3, "0")}°{" "}
              <span className="text-cyan">{cardinal}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">
              Reference
            </p>
            <p className="font-mono text-xs font-semibold text-amber">
              {compassMode === "geographic" ? "TRUE SPIN AXIS" : "CRUSTAL REMNANT"}
            </p>
          </div>
        </div>
      </div>

      {/* Manual Heading Adjustment Controls */}
      <div className="rounded-xl border border-line bg-panel/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-fog">
            Manual Heading Adjustment
          </span>
          {/* Reset to North Button */}
          <button
            type="button"
            onClick={() => setHeadingDeg(0)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 font-mono text-[10px] font-semibold text-bright shadow-xs transition-colors hover:bg-ink2"
          >
            <RotateCcw className="size-3 text-rose" />
            Reset to North (000°)
          </button>
        </div>

        {/* Slider Control */}
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={359}
            value={headingDeg}
            onChange={(e) => setHeadingDeg(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-line accent-cyan"
            aria-label="Compass heading degree slider"
          />
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1">
            <input
              type="number"
              min={0}
              max={359}
              value={headingDeg}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) setHeadingDeg(((val % 360) + 360) % 360);
              }}
              className="w-12 text-center font-mono text-xs font-bold text-bright outline-none"
              aria-label="Direct degree input"
            />
            <span className="font-mono text-xs text-fog">°</span>
          </div>
        </div>

        {/* Stepper & Cardinal Snap Buttons */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/60">
          {/* Fine Steppers */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => adjustHeading(-15)}
              className="rounded-md border border-line bg-white px-2 py-1 font-mono text-[10px] hover:bg-ink2"
            >
              -15°
            </button>
            <button
              type="button"
              onClick={() => adjustHeading(-1)}
              className="rounded-md border border-line bg-white px-2 py-1 font-mono text-[10px] hover:bg-ink2"
            >
              -1°
            </button>
            <button
              type="button"
              onClick={() => adjustHeading(1)}
              className="rounded-md border border-line bg-white px-2 py-1 font-mono text-[10px] hover:bg-ink2"
            >
              +1°
            </button>
            <button
              type="button"
              onClick={() => adjustHeading(15)}
              className="rounded-md border border-line bg-white px-2 py-1 font-mono text-[10px] hover:bg-ink2"
            >
              +15°
            </button>
          </div>

          {/* Quick Cardinal Snaps */}
          <div className="flex items-center gap-1">
            {[
              { label: "N", deg: 0, color: "text-rose" },
              { label: "E", deg: 90, color: "text-cyan" },
              { label: "S", deg: 180, color: "text-bright" },
              { label: "W", deg: 270, color: "text-cyan" },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setHeadingDeg(c.deg)}
                className={`rounded-md border border-line bg-white px-2.5 py-1 font-mono text-[10px] font-bold ${c.color} hover:bg-ink2`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Planetary Magnetism Educational Modal / Expandable Details */}
      {showScienceDialog && (
        <div className="rounded-xl border border-line bg-white/95 p-4 text-xs shadow-md backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="font-display font-semibold text-bright">
              How Does Direction Work on Mars?
            </span>
            <button
              type="button"
              onClick={() => setShowScienceDialog(false)}
              className="font-mono text-fog hover:text-bright"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 space-y-2 text-fog leading-relaxed">
            <p>
              <strong className="text-bright">Why Magnetic Compasses Fail on Mars:</strong> Earth has a
              liquid outer iron core whose convective churning produces an active global gedynamo. Mars cooled
              much faster and lost its core dynamo roughly 4.0 to 4.1 billion years ago.
            </p>
            <p>
              <strong className="text-bright">Crustal Paleomagnetism:</strong> Ancient volcanic and impact rocks
              in the southern highlands (like Terra Sirenum) locked in the residual magnetization from Mars's
              extinct magnetic field. These localized crustal magnetic anomalies create patchy, uncoordinated
              magnetic patterns that would spin an Earth magnetic compass completely erratically.
            </p>
            <p>
              <strong className="text-bright">How Real Mars Rovers Navigate:</strong> NASA rovers (Curiosity,
              Perseverance) use optical sun-sensors, high-accuracy fiber-optic gyroscopes, visual wheel odometry,
              and star cameras to determine <strong className="text-amber">Geographic True North</strong>, which is
              defined by Mars's rotational spin axis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
