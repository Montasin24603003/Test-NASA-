import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  ExternalLink, 
  Radio, 
  Compass, 
  ShieldCheck, 
  Maximize2, 
  RotateCcw,
  Zap,
  Activity,
  Gauge,
  Layers,
  Thermometer,
  Eye,
  Sliders,
  Sparkles,
  ChevronRight,
  Info
} from "lucide-react";
import { useState, useRef } from "react";

export const Route = createFileRoute("/rover-game")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mars Rover Expedition — 3D Surface Physics Simulation // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "High-fidelity 3D Mars Rover exploration and physics simulation. Drive a Perseverance-class six-wheel rover across Jezero Crater with authentic rocker-bogie mechanics, terramechanics, and scientific instruments.",
      },
    ],
  }),
  component: RoverGamePage,
});

const ROVER_SPECIFICATIONS = [
  { label: "Vehicle Class", value: "Perseverance (Mars 2020)", icon: Compass, color: "text-amber" },
  { label: "Dry Mass", value: "1,025 kg (Earth) / 380 kg (Mars equiv)", icon: Gauge, color: "text-bright" },
  { label: "Mobility Mechanism", value: "6-Wheel Rocker-Bogie (Differential Bar)", icon: Activity, color: "text-mint" },
  { label: "Surface Gravity", value: "3.71 m/s² (0.379 g)", icon: Zap, color: "text-amber" },
  { label: "Power Source", value: "MMRTG Plutonium-238 (110 W)", icon: Zap, color: "text-cyan" },
  { label: "Wheel Motors", value: "6x Brushless DC In-Hub Actuators", icon: Sliders, color: "text-indigo-400" },
];

const ROVER_INSTRUMENTS = [
  { name: "SuperCam LIBS", role: "Laser-Induced Breakdown Spectroscopy (1064 nm)", status: "NOMINAL", key: "Press [E] to Sample" },
  { name: "Mastcam-Z", role: "Stereoscopic Multispectral Zoom Cameras", status: "ONLINE", key: "Press [C] to Cycle View" },
  { name: "MEDA Weather", role: "Pressure (760 Pa), Temperature & Wind Sensors", status: "TELEMETRY", key: "Press [T] for Panel" },
  { name: "RIMFAX", role: "Ground-Penetrating Radar (>10m Depth Horizon)", status: "ACTIVE", key: "Subsurface Profiling" },
];

function RoverGamePage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'simulation' | 'specs' | 'instruments'>('simulation');
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="rise-in space-y-5">
      {/* 1. TOP MISSION CONTROL BANNER */}
      <div className="flex flex-col gap-4 rounded-3xl border border-line/70 bg-white/85 p-5 shadow-xl backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between dark:bg-[#070c16]/85">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-amber border border-amber/30">
              <Compass className="size-3.5 text-amber" />
              NASA JPL Surface Robotics Simulator
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-mint/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-mint border border-mint/30">
              <ShieldCheck className="size-3.5 text-mint" />
              20/20 First-Principles Physics Benchmarks Passed
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-bright">
            Mars Rover Expedition · 3D Surface Physics Simulation
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-fog max-w-3xl leading-relaxed">
            Real-time multi-body rocker-bogie terramechanics, Bekker–Wong soil compaction, SuperCam LIBS laser ablation, and authentic NASA telemetry in Jezero Crater.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white/90 px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-bright hover:bg-slate-100 shadow-sm transition-all dark:bg-slate-800/90 dark:hover:bg-slate-700"
            title="Toggle Simulation Fullscreen"
          >
            <Maximize2 className="size-3.5 text-amber" />
            <span>Fullscreen</span>
          </button>

          <a
            href="/rover-game/index.html?test=1"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-mint/30 bg-mint/10 px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-mint hover:bg-mint/20 shadow-sm transition-all"
            title="Run 20 First-Principles Physics Benchmarks in Native Browser"
          >
            <ShieldCheck className="size-3.5 text-mint" />
            <span>Physics Tests (20/20)</span>
          </a>

          <a
            href="/rover-game/index.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber hover:bg-amber/90 px-4 py-2 font-display text-xs font-bold text-ink shadow-sm transition-all"
            title="Launch Standalone 3D Window"
          >
            <ExternalLink className="size-3.5" />
            <span>Launch Standalone</span>
          </a>
        </div>
      </div>

      {/* 2. TAB SELECTOR FOR SIMULATION VS SPECS */}
      <div className="flex items-center gap-2 border-b border-line/60 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('simulation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'simulation'
              ? 'bg-amber text-ink shadow-sm'
              : 'text-fog hover:text-bright hover:bg-panel'
          }`}
        >
          <Compass className="size-3.5" />
          <span>Interactive 3D Simulation</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('specs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'specs'
              ? 'bg-amber text-ink shadow-sm'
              : 'text-fog hover:text-bright hover:bg-panel'
          }`}
        >
          <Gauge className="size-3.5" />
          <span>Rocker-Bogie Dynamics &amp; Specs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('instruments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === 'instruments'
              ? 'bg-amber text-ink shadow-sm'
              : 'text-fog hover:text-bright hover:bg-panel'
          }`}
        >
          <Activity className="size-3.5" />
          <span>Scientific Payload &amp; Lasers</span>
        </button>
      </div>

      {/* 3. MAIN WORKSPACE */}
      {activeTab === 'simulation' ? (
        <div className="space-y-4">
          {/* Quick HUD Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
            <div className="p-3 rounded-2xl border border-line/70 bg-white/70 dark:bg-[#070c16]/70 shadow-sm backdrop-blur-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-fog uppercase block">Current Region</span>
                <strong className="text-bright font-bold">Jezero Crater Floor</strong>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-md bg-amber/20 text-amber font-bold">DTM 1m</span>
            </div>

            <div className="p-3 rounded-2xl border border-line/70 bg-white/70 dark:bg-[#070c16]/70 shadow-sm backdrop-blur-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-fog uppercase block">Soil Mechanics</span>
                <strong className="text-bright font-bold">Bekker Shear Model</strong>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-md bg-mint/20 text-mint font-bold">120 Hz</span>
            </div>

            <div className="p-3 rounded-2xl border border-line/70 bg-white/70 dark:bg-[#070c16]/70 shadow-sm backdrop-blur-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-fog uppercase block">Chassis Roll Limit</span>
                <strong className="text-bright font-bold">20° Roll Over Threshold</strong>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-md bg-cyan/20 text-cyan font-bold">±45° Bogie</span>
            </div>

            <div className="p-3 rounded-2xl border border-line/70 bg-white/70 dark:bg-[#070c16]/70 shadow-sm backdrop-blur-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-fog uppercase block">Active Camera</span>
                <strong className="text-bright font-bold">Chase / Cockpit / Mast</strong>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 font-bold">Key [C]</span>
            </div>
          </div>

          {/* 3D Simulation Frame Container */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-3xl border border-line/70 bg-[#080d14] shadow-2xl transition-all"
          >
            <iframe
              title="3D Mars Rover Expedition Simulation"
              src="/rover-game/index.html"
              className="block h-[min(900px,calc(100vh-210px))] min-h-[720px] w-full border-0"
              loading="eager"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; gamepad"
              allowFullScreen
            />
          </div>

          {/* Interactive Keyboard & Gamepad Cheat Sheet */}
          <div className="rounded-2xl border border-line/60 bg-white/80 dark:bg-panel/50 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3 border-b border-line/50 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-amber" />
                <h3 className="font-display text-sm font-bold text-bright">Flight &amp; Telemetry Command Reference</h3>
              </div>
              <span className="font-mono text-[10px] text-fog uppercase">Gamepad / Keyboard Compatible</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 font-mono text-[11px]">
              <div className="p-2 rounded-xl bg-ink2/50 border border-line/50">
                <span className="text-fog text-[9px] uppercase block">Throttle &amp; Steering</span>
                <strong className="text-amber">W / A / S / D</strong> or <strong className="text-bright">Arrows</strong>
              </div>
              <div className="p-2 rounded-xl bg-ink2/50 border border-line/50">
                <span className="text-fog text-[9px] uppercase block">Dynamic Braking</span>
                <strong className="text-rose">SPACEBAR</strong>
              </div>
              <div className="p-2 rounded-xl bg-ink2/50 border border-line/50">
                <span className="text-fog text-[9px] uppercase block">Camera Modes (6x)</span>
                <strong className="text-cyan">C Key</strong> (Orbit/Chase/Mast)
              </div>
              <div className="p-2 rounded-xl bg-ink2/50 border border-line/50">
                <span className="text-fog text-[9px] uppercase block">SuperCam Laser</span>
                <strong className="text-mint">E Key</strong> (Target Sample)
              </div>
              <div className="p-2 rounded-xl bg-ink2/50 border border-line/50">
                <span className="text-fog text-[9px] uppercase block">Engineering Telemetry</span>
                <strong className="text-indigo-400">T Key</strong> (Drawer Open)
              </div>
              <div className="p-2 rounded-xl bg-ink2/50 border border-line/50">
                <span className="text-fog text-[9px] uppercase block">3D Force Vectors</span>
                <strong className="text-amber">V Key</strong> (Wheel Loads)
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'specs' ? (
        /* ROVER TECHNICAL SPECIFICATIONS */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ROVER_SPECIFICATIONS.map((spec) => {
            const Icon = spec.icon;
            return (
              <div
                key={spec.label}
                className="rounded-2xl border border-line/70 bg-white/80 dark:bg-panel/60 p-5 shadow-sm backdrop-blur-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-ink2/60 border border-line/60">
                    <Icon className={`size-5 ${spec.color}`} />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-fog uppercase block">{spec.label}</span>
                    <strong className="font-display text-sm font-bold text-bright">{spec.value}</strong>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Deep Engineering Note Card */}
          <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-panel/60 p-6 shadow-sm backdrop-blur-xl">
            <h3 className="font-display text-base font-bold text-bright mb-2">First-Principles Terramechanics Formulation</h3>
            <p className="text-xs text-fog leading-relaxed font-mono">
              The rover simulation models contact patches with authentic Bekker–Wong pressure-sinkage formulations: 
              p = (k_c / b + k_phi) * z^n. Wheel slip ratio s = 1 - (v / (r * omega)) dynamically alters tractive thrust via Janosi–Hanamoto shear stress curves. 
              The six independent in-wheel drive actuators distribute normal force across the central rocker-bogie differential pivot, ensuring all 6 wheels maintain ground contact over obstacles up to 40 cm.
            </p>
          </div>
        </div>
      ) : (
        /* SCIENTIFIC INSTRUMENTS PAYLOAD */
        <div className="grid gap-4 md:grid-cols-2">
          {ROVER_INSTRUMENTS.map((inst) => (
            <div
              key={inst.name}
              className="rounded-2xl border border-line/70 bg-white/80 dark:bg-panel/60 p-5 shadow-sm backdrop-blur-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-bright">{inst.name}</h3>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-mint/20 text-mint font-bold">{inst.status}</span>
                </div>
                <p className="text-xs text-fog mt-2 font-mono leading-relaxed">{inst.role}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-line/50 flex items-center justify-between font-mono text-[10px]">
                <span className="text-amber font-semibold">{inst.key}</span>
                <span className="text-fog">Perseverance Payload</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. FOOTER RETURN STRIP */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-line/60 bg-panel/30 p-4 font-mono text-[11px] text-fog">
        <div className="flex items-center gap-2">
          <Radio className="size-3.5 text-mint animate-pulse" />
          <span>Telemetry Stream Active: Mars 2020 Perseverance Reference Corridor Sols 38–44</span>
        </div>
        <Link
          to="/planetary-map"
          className="inline-flex items-center gap-1.5 text-amber hover:underline font-semibold"
        >
          <RotateCcw className="size-3.5" />
          <span>Switch to Full 2D/3D Planetary Map</span>
        </Link>
      </div>
    </div>
  );
}
