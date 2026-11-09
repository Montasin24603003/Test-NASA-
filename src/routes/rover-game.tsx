import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Compass,
  Cpu,
  Crosshair,
  Disc,
  Eye,
  Gauge,
  Info,
  Layers,
  Navigation,
  Play,
  Radio,
  RotateCcw,
  Satellite,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Thermometer,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

export const Route = createFileRoute("/rover-game")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mars Rover Expedition — 3D Surface Physics & Flight Deck // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Interactive 3D Mars Rover exploration and robotics flight deck. Drive a Perseverance-class six-wheel rover across Jezero Crater with authentic rocker-bogie mechanics, terramechanics, SuperCam LIBS laser, and real-time telemetry.",
      },
    ],
  }),
  component: RoverGamePage,
});

interface TelemetryState {
  speedKmh: number;
  speedCms: number;
  batteryPct: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  distanceM: number;
  samplesCount: number;
  credits: number;
  regionId: string;
  regionName: string;
  cameraMode: string;
  hullIntegrity: number;
  slipRatio: number;
}

const DEFAULT_TELEMETRY: TelemetryState = {
  speedKmh: 0.12,
  speedCms: 3.3,
  batteryPct: 98,
  headingDeg: 42,
  pitchDeg: 1.8,
  rollDeg: -0.6,
  distanceM: 68,
  samplesCount: 2,
  credits: 120,
  regionId: "jezero",
  regionName: "Jezero Crater Floor",
  cameraMode: "chase",
  hullIntegrity: 100,
  slipRatio: 0.04,
};

const SAMPLE_CORES = [
  {
    id: "tube-01",
    name: "Haputa Outcrop Mudstone",
    sol: 124,
    depthCm: 6.8,
    type: "Fine-Grained Sedimentary",
    biosignaturePotential: "HIGH",
    color: "from-amber/30 to-amber/5 border-amber/40 text-amber",
    minerals: "Smectite Clays (42%), Silica (28%), Carbonates (16%)",
    context: "Deposited in ancient Jezero lacustrine delta lake. High organic matter preservation potential.",
  },
  {
    id: "tube-02",
    name: "Guillaumes Olivine Basalt",
    sol: 218,
    depthCm: 7.2,
    type: "Igneous Cumulate",
    biosignaturePotential: "MODERATE",
    color: "from-cyan/30 to-cyan/5 border-cyan/40 text-cyan",
    minerals: "Forsterite Olivine (55%), Pyroxene (26%), Plagioclase (14%)",
    context: "Floor unit magmatic crystallization. Crucial for radiometric argon dating of Jezero impact basement.",
  },
  {
    id: "tube-03",
    name: "Magee Lacustrine Carbonate",
    sol: 395,
    depthCm: 6.4,
    type: "Precipitated Carbonate",
    biosignaturePotential: "VERY HIGH",
    color: "from-mint/30 to-mint/5 border-mint/40 text-mint",
    minerals: "Magnesite (48%), Calcite (32%), Hydrated Silica (14%)",
    context: "Formed at ancient alkaline shoreline. Earth analog stromatolitic micro-texture trapping zone.",
  },
  {
    id: "tube-04",
    name: "Robine Fluvial Sandstone",
    sol: 620,
    depthCm: 7.5,
    type: "Cross-Bedded Sandstone",
    biosignaturePotential: "MODERATE",
    color: "from-indigo-500/30 to-indigo-500/5 border-indigo-500/40 text-indigo-400",
    minerals: "Quartz-like Silicates (38%), Hematite (24%), Feldspar (22%)",
    context: "High-energy river channel deposit transported from Jezero crater rim catchment highlands.",
  },
];

const STEERING_MODES = [
  {
    id: "ackermann",
    name: "4-Corner Ackermann",
    role: "Traverse & Cruise",
    desc: "Front & rear corner wheels articulate along concentric turn radiuses. Minimized tire scuffing over bedrock.",
    turningRadius: "3.8 m radius",
  },
  {
    id: "point",
    name: "Zero-Radius Point Turn",
    role: "Spot Pivot (360°)",
    desc: "Corner wheels angle opposite at ±45°. Left & right drive banks counter-rotate for instant in-place orientation.",
    turningRadius: "0.0 m (in-place)",
  },
  {
    id: "crab",
    name: "Crab Steer",
    role: "Dune Escape / Drift",
    desc: "All steered wheels lock parallel up to 45°. The chassis glides diagonally across steep aeolian sand ripples.",
    turningRadius: "Parallel slide",
  },
];

const REGIONS = [
  { id: "jezero", name: "Jezero Crater Floor", dtm: "HiRISE 1m", terrain: "Clay & Basalt Pavements" },
  { id: "delta", name: "Western Delta Fan", dtm: "HiRISE 1m", terrain: "Cross-Bedded Scarps" },
  { id: "dunes", name: "Séítah Sand Ripples", dtm: "CTX 6m", terrain: "High-Sinkage Aeolian Dunes" },
  { id: "rim", name: "Crater Rim Highlands", dtm: "MOLA 463m", terrain: "Steep Boulder Benches" },
];

function RoverGamePage() {
  const [telemetry, setTelemetry] = useState<TelemetryState>(DEFAULT_TELEMETRY);
  const [activeTab, setActiveTab] = useState<"cockpit" | "samples" | "kinematics" | "payload">("cockpit");
  const [selectedSteering, setSelectedSteering] = useState("ackermann");
  const [selectedSample, setSelectedSample] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [laserActive, setLaserActive] = useState(false);
  const [driveEngaged, setDriveEngaged] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for real-time telemetry stream from 3D physics engine inside iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "ROVER_TELEMETRY_UPDATE" && event.data.telemetry) {
        setTelemetry((prev) => ({
          ...prev,
          ...event.data.telemetry,
        }));
        setDriveEngaged(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const sendIframeCommand = (type: string, payload?: Record<string, unknown>) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type, payload }, "*");
    }
  };

  const handleEngageDrive = () => {
    setDriveEngaged(true);
    sendIframeCommand("MARS_START_EXPEDITION");
  };

  const handleFireLaser = () => {
    setLaserActive(true);
    sendIframeCommand("MARS_FIRE_LASER");
    setTimeout(() => setLaserActive(false), 950);
  };

  const handleResetRover = () => {
    sendIframeCommand("MARS_RESET_ROVER");
  };

  const handleCycleCamera = () => {
    sendIframeCommand("MARS_CYCLE_CAMERA");
  };

  const handleSetCamera = (mode: string) => {
    setTelemetry((prev) => ({ ...prev, cameraMode: mode }));
    sendIframeCommand("MARS_SET_CAMERA", { mode });
  };

  const handleDeployRegion = (regionId: string) => {
    setTelemetry((prev) => ({ ...prev, regionId }));
    sendIframeCommand("MARS_DEPLOY_REGION", { regionId });
  };

  const handleToggleAudio = () => {
    setIsMuted((prev) => !prev);
    sendIframeCommand("MARS_TOGGLE_AUDIO");
  };

  return (
    <div className="rise-in space-y-5">
      {/* 1. NASA JPL FLIGHT OPERATIONS COMMAND BAR */}
      <div className="flex flex-col gap-4 rounded-3xl border border-line/70 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between dark:bg-[#070c16]/90">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-amber border border-amber/30">
              <Compass className="size-3.5 text-amber" />
              NASA JPL Mars Surface Robotics Deck
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-mint/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-mint border border-mint/30">
              <Radio className="size-3 text-mint animate-pulse" />
              Direct Telemetry Link Active (DSN 70m)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan border border-cyan/30">
              Sol 142 · 14:18 LMST
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-bright">
            Perseverance Surface Flight Operations Deck
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-fog max-w-3xl leading-relaxed">
            Multi-body rocker-bogie terramechanics, Bekker soil sinkage, SuperCam LIBS laser ablation, and authentic NASA telemetry in Jezero Crater.
          </p>
        </div>

        {/* Action Command Deck (Replaces technical fullscreen/physics buttons with live mission controls) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleEngageDrive}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-display text-xs font-bold shadow-md transition-all ${
              driveEngaged
                ? "bg-mint text-ink hover:bg-mint/90 ring-2 ring-mint/30"
                : "bg-amber text-ink hover:bg-amber/90 ring-2 ring-amber/30"
            }`}
            title="Start or Resume Surface Drive in 3D Mars Viewport"
          >
            <Play className="size-3.5 fill-current" />
            <span>{driveEngaged ? "Drive Engaged" : "Engage Rover Drive"}</span>
          </button>

          <button
            type="button"
            onClick={handleFireLaser}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
              laserActive
                ? "border-rose-500 bg-rose-500/20 text-rose-400 shadow-lg shadow-rose-500/30 scale-95"
                : "border-mint/30 bg-mint/10 text-mint hover:bg-mint/20"
            }`}
            title="Fire SuperCam 1064 nm Laser Ablation Pulse [Key: E]"
          >
            <Zap className={`size-3.5 ${laserActive ? "text-rose-400 animate-spin" : "text-mint"}`} />
            <span>{laserActive ? "FIRING LIBS..." : "Fire SuperCam"}</span>
          </button>

          <button
            type="button"
            onClick={handleResetRover}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white/90 px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-bright hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700 shadow-sm transition-all"
            title="Level Chassis Upright and Clear Wheel Slip [Key: R]"
          >
            <RotateCcw className="size-3.5 text-amber" />
            <span>Level Rover</span>
          </button>

          <button
            type="button"
            onClick={handleToggleAudio}
            className="inline-flex items-center justify-center size-9 rounded-xl border border-line bg-white/90 text-bright hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700 shadow-sm transition-all"
            title={isMuted ? "Unmute Sound Engine" : "Mute Sound Engine"}
          >
            {isMuted ? <VolumeX className="size-4 text-rose-400" /> : <Volume2 className="size-4 text-mint" />}
          </button>
        </div>
      </div>

      {/* 2. REAL-TIME TELEMETRY STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-[11px]">
        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-fog uppercase">Speed</span>
            <Gauge className="size-3 text-amber" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <strong className="text-base text-bright font-bold">{telemetry.speedCms}</strong>
            <span className="text-[10px] text-fog">cm/s</span>
            <span className="text-[10px] text-amber ml-auto">({telemetry.speedKmh} km/h)</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-fog uppercase">MMRTG / Battery</span>
            <Zap className="size-3 text-mint" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <strong className="text-base text-bright font-bold">{telemetry.batteryPct}%</strong>
            <span className="text-[10px] text-mint ml-auto">110W Pu-238</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-fog uppercase">Chassis Pitch/Roll</span>
            <Activity className="size-3 text-cyan" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <strong className="text-base text-bright font-bold">{telemetry.pitchDeg}°</strong>
            <span className="text-[10px] text-fog">/ {telemetry.rollDeg}°</span>
            <span className="text-[9px] text-mint ml-auto">&lt;20° Safe</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-fog uppercase">Odometer</span>
            <Navigation className="size-3 text-amber" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <strong className="text-base text-bright font-bold">{telemetry.distanceM}</strong>
            <span className="text-[10px] text-fog">meters</span>
            <span className="text-[10px] text-fog ml-auto">Sols 38–44</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-fog uppercase">Core Tubes</span>
            <Disc className="size-3 text-mint" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <strong className="text-base text-bright font-bold">{telemetry.samplesCount}</strong>
            <span className="text-[10px] text-fog">/ 43</span>
            <span className="text-[10px] text-mint ml-auto">Hermetic</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-fog uppercase">Wheel Slip Ratio</span>
            <Sliders className="size-3 text-indigo-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <strong className="text-base text-bright font-bold">{telemetry.slipRatio}</strong>
            <span className="text-[10px] text-fog">s</span>
            <span className="text-[9px] text-mint ml-auto">Bekker Grip</span>
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE 3D SIMULATION VIEWPORT FRAME */}
      <div className="space-y-4">
        {/* Quick Camera & Region HUD Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
          {/* Camera View Switcher */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-fog text-[10px] uppercase mr-1">Camera:</span>
            {[
              { id: "chase", label: "Chase Cam" },
              { id: "cockpit", label: "Driver Hazcam" },
              { id: "mastcam", label: "Mastcam-Z Stereo" },
              { id: "topdown", label: "Orbit Drone" },
            ].map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => handleSetCamera(cam.id)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  telemetry.cameraMode === cam.id
                    ? "bg-amber text-ink font-bold shadow-sm"
                    : "bg-panel/60 text-fog hover:text-bright border border-line/60"
                }`}
              >
                {cam.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleCycleCamera}
              className="px-2 py-1 rounded-lg border border-line/60 text-fog hover:text-bright text-[10px]"
              title="Cycle Next Camera [Key: C]"
            >
              [C] Cycle
            </button>
          </div>

          {/* Region Warp Switcher */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-fog text-[10px] uppercase mr-1">Region:</span>
            {REGIONS.map((reg) => (
              <button
                key={reg.id}
                type="button"
                onClick={() => handleDeployRegion(reg.id)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  telemetry.regionId === reg.id
                    ? "bg-mint text-ink font-bold shadow-sm"
                    : "bg-panel/60 text-fog hover:text-bright border border-line/60"
                }`}
              >
                {reg.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 3D WebGL Canvas Embedded Frame */}
        <div className="relative overflow-hidden rounded-3xl border border-line/70 bg-[#080d14] shadow-2xl transition-all">
          <iframe
            ref={iframeRef}
            title="3D Mars Rover Expedition Simulation"
            src="/rover-game/index.html?autostart=1"
            className="block h-[min(900px,calc(100vh-220px))] min-h-[700px] w-full border-0"
            loading="eager"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; gamepad"
            allowFullScreen
          />
        </div>

        {/* Flight Controls Cheat Sheet */}
        <div className="rounded-2xl border border-line/60 bg-white/80 dark:bg-panel/50 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3 border-b border-line/50 pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-amber" />
              <h3 className="font-display text-sm font-bold text-bright">Flight &amp; Telemetry Command Reference</h3>
            </div>
            <span className="font-mono text-[10px] text-fog uppercase">Keyboard / Gamepad Compatible</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 font-mono text-[11px]">
            <div className="p-2.5 rounded-xl bg-ink2/50 border border-line/50">
              <span className="text-fog text-[9px] uppercase block">Drive &amp; Steer</span>
              <strong className="text-amber">W / A / S / D</strong> or <strong className="text-bright">Arrows</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-ink2/50 border border-line/50">
              <span className="text-fog text-[9px] uppercase block">Dynamic Brake</span>
              <strong className="text-rose">SPACEBAR</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-ink2/50 border border-line/50">
              <span className="text-fog text-[9px] uppercase block">Camera View</span>
              <strong className="text-cyan">C Key</strong> (Cycle 6 Views)
            </div>
            <div className="p-2.5 rounded-xl bg-ink2/50 border border-line/50">
              <span className="text-fog text-[9px] uppercase block">SuperCam Laser</span>
              <strong className="text-mint">E Key</strong> (Sample Outcrops)
            </div>
            <div className="p-2.5 rounded-xl bg-ink2/50 border border-line/50">
              <span className="text-fog text-[9px] uppercase block">Engineering Drawer</span>
              <strong className="text-indigo-400">T Key</strong> (Live Graphs)
            </div>
            <div className="p-2.5 rounded-xl bg-ink2/50 border border-line/50">
              <span className="text-fog text-[9px] uppercase block">Wheel Normal Vectors</span>
              <strong className="text-amber">V Key</strong> (3D Forces)
            </div>
          </div>
        </div>
      </div>

      {/* 4. EXPEDITION OPERATIONS TABS */}
      <div className="flex items-center gap-2 border-b border-line/60 pb-1 mt-6">
        <button
          type="button"
          onClick={() => setActiveTab("cockpit")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === "cockpit" ? "bg-amber text-ink shadow-sm" : "text-fog hover:text-bright hover:bg-panel"
          }`}
        >
          <Navigation className="size-3.5" />
          <span>Steering Kinematics</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("samples")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === "samples" ? "bg-amber text-ink shadow-sm" : "text-fog hover:text-bright hover:bg-panel"
          }`}
        >
          <Disc className="size-3.5" />
          <span>Cached Astrobiology Sample Cores</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("kinematics")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === "kinematics" ? "bg-amber text-ink shadow-sm" : "text-fog hover:text-bright hover:bg-panel"
          }`}
        >
          <Gauge className="size-3.5" />
          <span>Rocker-Bogie Mechanical Specs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("payload")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === "payload" ? "bg-amber text-ink shadow-sm" : "text-fog hover:text-bright hover:bg-panel"
          }`}
        >
          <Zap className="size-3.5" />
          <span>Scientific Lasers &amp; Radar</span>
        </button>
      </div>

      {/* 5. TAB CONTENT PANELS */}
      {activeTab === "cockpit" ? (
        /* STEERING MODES & TERRALAB */
        <div className="grid gap-4 md:grid-cols-3">
          {STEERING_MODES.map((mode) => (
            <div
              key={mode.id}
              onClick={() => setSelectedSteering(mode.id)}
              className={`cursor-pointer rounded-2xl border p-5 transition-all backdrop-blur-xl ${
                selectedSteering === mode.id
                  ? "border-amber bg-amber/10 shadow-lg ring-1 ring-amber/40"
                  : "border-line/70 bg-white/80 dark:bg-panel/60 hover:border-line"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-amber font-bold uppercase">{mode.role}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-ink2/60 text-fog">
                  {mode.turningRadius}
                </span>
              </div>
              <h3 className="mt-2 font-display text-base font-bold text-bright">{mode.name}</h3>
              <p className="mt-2 text-xs text-fog leading-relaxed font-mono">{mode.desc}</p>
            </div>
          ))}

          {/* Deep Terramechanics Explainer Card */}
          <div className="md:col-span-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-panel/60 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="size-4 text-mint" />
              <h3 className="font-display text-base font-bold text-bright">
                Bekker–Wong Terramechanics &amp; Janosi Shear Stress Formulation
              </h3>
            </div>
            <p className="text-xs text-fog leading-relaxed font-mono">
              The rover simulation models contact patches with authentic Bekker–Wong pressure-sinkage formulations:{" "}
              <code className="text-amber">p = (k_c / b + k_phi) * z^n</code>. Wheel slip ratio{" "}
              <code className="text-amber">s = 1 - (v / (r * omega))</code> dynamically alters tractive thrust via Janosi–Hanamoto shear stress curves. 
              The six independent in-wheel drive actuators distribute normal force across the central rocker-bogie differential pivot, ensuring all 6 wheels maintain ground contact over obstacles up to 40 cm.
            </p>
          </div>
        </div>
      ) : activeTab === "samples" ? (
        /* ASTROBIOLOGY SAMPLE CAROUSEL */
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {SAMPLE_CORES.map((tube, idx) => (
              <div
                key={tube.id}
                onClick={() => setSelectedSample(idx)}
                className={`cursor-pointer rounded-2xl border p-4 transition-all backdrop-blur-xl bg-gradient-to-br ${
                  selectedSample === idx
                    ? `${tube.color} ring-2 ring-current shadow-lg`
                    : "border-line/70 bg-white/80 dark:bg-panel/60 hover:border-line"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase">Tube #{idx + 1}</span>
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-ink2/60">Sol {tube.sol}</span>
                </div>
                <h4 className="mt-2 font-display text-sm font-bold text-bright leading-tight">{tube.name}</h4>
                <div className="mt-2 text-[10px] font-mono text-fog">
                  <span>Potential: </span>
                  <strong className="text-bright">{tube.biosignaturePotential}</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Sample Inspector Detail */}
          {SAMPLE_CORES[selectedSample] && (
            <div className="rounded-2xl border border-line/70 bg-white/90 dark:bg-panel/70 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3">
                <div>
                  <span className="font-mono text-[10px] text-amber uppercase block">Selected Sample Tube</span>
                  <h3 className="font-display text-lg font-bold text-bright">{SAMPLE_CORES[selectedSample].name}</h3>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg bg-mint/15 text-mint border border-mint/30 font-bold">
                    Depth: {SAMPLE_CORES[selectedSample].depthCm} cm
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber/15 text-amber border border-amber/30 font-bold">
                    {SAMPLE_CORES[selectedSample].type}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-fog uppercase block">Mineralogical Spectrometry (SuperCam LIBS + SHERLOC):</span>
                  <p className="mt-1 text-bright font-semibold">{SAMPLE_CORES[selectedSample].minerals}</p>
                </div>
                <div>
                  <span className="text-[10px] text-fog uppercase block">Astrobiological Science Context:</span>
                  <p className="mt-1 text-fog leading-relaxed">{SAMPLE_CORES[selectedSample].context}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === "kinematics" ? (
        /* VEHICLE TECHNICAL SPECIFICATIONS */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Vehicle Class", value: "Perseverance (Mars 2020)", icon: Compass, color: "text-amber" },
            { label: "Dry Mass", value: "1,025 kg (Earth) / 380 kg (Mars equiv)", icon: Gauge, color: "text-bright" },
            { label: "Mobility Mechanism", value: "6-Wheel Rocker-Bogie (Differential Bar)", icon: Activity, color: "text-mint" },
            { label: "Surface Gravity", value: "3.71 m/s² (0.379 g)", icon: Zap, color: "text-amber" },
            { label: "Power Source", value: "MMRTG Plutonium-238 (110 W)", icon: Zap, color: "text-cyan" },
            { label: "Wheel Motors", value: "6x Brushless DC In-Hub Actuators", icon: Sliders, color: "text-indigo-400" },
          ].map((spec) => {
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
        </div>
      ) : (
        /* SCIENTIFIC INSTRUMENTS PAYLOAD */
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { name: "SuperCam LIBS", role: "Laser-Induced Breakdown Spectroscopy (1064 nm)", status: "NOMINAL", key: "Press [E] to Sample" },
            { name: "Mastcam-Z", role: "Stereoscopic Multispectral Zoom Cameras", status: "ONLINE", key: "Press [C] to Cycle View" },
            { name: "MEDA Weather", role: "Pressure (760 Pa), Temperature & Wind Sensors", status: "TELEMETRY", key: "Press [T] for Panel" },
            { name: "RIMFAX", role: "Ground-Penetrating Radar (>10m Depth Horizon)", status: "ACTIVE", key: "Subsurface Profiling" },
          ].map((inst) => (
            <div
              key={inst.name}
              className="rounded-2xl border border-line/70 bg-white/80 dark:bg-panel/60 p-5 shadow-sm backdrop-blur-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-bright">{inst.name}</h3>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-mint/20 text-mint font-bold">
                    {inst.status}
                  </span>
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

      {/* 6. RETURN STRIP */}
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
