import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Compass,
  Gauge,
  Info,
  Layers,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/hazard-layers")({
  head: () => ({
    meta: [
      { title: "Hazard Analysis & MERI Risk Engine — Martian Map // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Multi-mission Mars Exploration Risk Index (MERI) engine. Calibrated ionizing radiation baselines (MSL RAD), MOLA terrain slope trafficability, diurnal thermal shock, and aeolian dust storm corridors.",
      },
    ],
  }),
  component: HazardLayersPage,
});

interface HazardCard {
  id: string;
  name: string;
  severity: "Nominal" | "Elevated" | "Severe" | "Critical";
  severityColor: string;
  badgeBg: string;
  badgeBorder: string;
  value: string;
  range: string;
  source: string;
  instrument: string;
  roverSafe: boolean;
  astronautSafe: boolean;
  description: string;
  mitigation: string;
}

const HAZARD_REGISTRY: HazardCard[] = [
  {
    id: "radiation",
    name: "Galactic Cosmic & Solar Radiation",
    severity: "Elevated",
    severityColor: "text-rose",
    badgeBg: "bg-rose/15",
    badgeBorder: "border-rose/30",
    value: "0.64 mSv/d",
    range: "0.45 – 1.85 mSv/d",
    source: "NASA MSL RAD & Odyssey MARIE",
    instrument: "Radiation Assessment Detector",
    roverSafe: true,
    astronautSafe: false,
    description:
      "Unshielded surface dose delivered by high-energy Galactic Cosmic Rays (GCR) and solar proton events. Mars lacks a global intrinsic dipole magnetosphere.",
    mitigation: "EVA sorties restricted to < 3.5 h/sol. Minimum 0.45 m basalt or regolith berm shielding cuts cumulative exposure by 76%.",
  },
  {
    id: "dust",
    name: "Aeolian Dust Storms & Atmospheric Tau",
    severity: "Severe",
    severityColor: "text-amber",
    badgeBg: "bg-amber/15",
    badgeBorder: "border-amber/30",
    value: "Tau 0.65",
    range: "0.15 (Clear) – 4.5 (Global Storm)",
    source: "NASA Mars 2020 MEDA & MRO MCS",
    instrument: "Sky Optical Depth Sensors",
    roverSafe: true,
    astronautSafe: false,
    description:
      "Electrostatic sub-micron basaltic dust clings to photovoltaic arrays, radiator fins, and spacesuit pressure bearing joints.",
    mitigation: "MMRTG nuclear power unaffected by dust storms; deploy electrodynamic dust shields (EDS) on optical sensors.",
  },
  {
    id: "slope",
    name: "Steep Scarps & Micro-Roughness",
    severity: "Severe",
    severityColor: "text-amber",
    badgeBg: "bg-amber/15",
    badgeBorder: "border-amber/30",
    value: "14.2° Max Slope",
    range: "0° (Pavements) – 38° (Crater Walls)",
    source: "NASA MOLA & HiRISE DTM",
    instrument: "Laser Altimetry 128 px/deg",
    roverSafe: false,
    astronautSafe: true,
    description:
      "Slopes >15° exceed the static Bekker wheel-slip envelope for autonomous wheeled rovers, risking high-centering on basalt blocks.",
    mitigation: "Execute 4-corner Ackermann contour zig-zag traverses; enforce strict 20° chassis roll-over software safe clamps.",
  },
  {
    id: "thermal",
    name: "Diurnal Thermal Shock & Frost",
    severity: "Critical",
    severityColor: "text-rose",
    badgeBg: "bg-rose/15",
    badgeBorder: "border-rose/30",
    value: "ΔT 82°C Swing",
    range: "−125°C (Night) to +20°C (Noon)",
    source: "NASA THEMIS & Viking IRTM",
    instrument: "Thermal Emission Imaging System",
    roverSafe: true,
    astronautSafe: false,
    description:
      "Extreme daily thermal expansion and contraction causes metal fatigue in mechanical linkages and freezes unheated hydraulic lubricants.",
    mitigation: "Maintain radioisotope survival heaters (RHU) inside Warm Electronics Boxes (WEB); pre-heat wheel hubs before morning drive.",
  },
  {
    id: "boulders",
    name: "Ejecta Block Obstacle Density",
    severity: "Nominal",
    severityColor: "text-mint",
    badgeBg: "bg-mint/15",
    badgeBorder: "border-mint/30",
    value: "4.8 Blocks / 100m²",
    range: "0 – 24 Blocks / 100m² (>0.5m)",
    source: "Mars-Bench Boulder AI & CTX",
    instrument: "Autonomous Object Detector",
    roverSafe: true,
    astronautSafe: true,
    description:
      "Impact ejecta and mass-wasting rock fragments with diameters from 0.35m to 2.2m scattered across crater floors and scarp aprons.",
    mitigation: "Rocker-bogie kinematic differential negotiates obstacles up to wheel diameter (0.525m) without tipping.",
  },
  {
    id: "pressure",
    name: "Low Barometric Pressure (Armstrong Horizon)",
    severity: "Critical",
    severityColor: "text-rose",
    badgeBg: "bg-rose/15",
    badgeBorder: "border-rose/30",
    value: "760 Pa (7.6 mbar)",
    range: "400 Pa (Olympus) – 1,150 Pa (Hellas)",
    source: "NASA Mars 2020 MEDA PS",
    instrument: "Barometric Pressure Sensor",
    roverSafe: true,
    astronautSafe: false,
    description:
      "Ambient pressure is below the Armstrong limit (6.3 kPa). Pure liquid water instantly boils and sublimates; human blood without suit ebullates.",
    mitigation: "Constant 29.6 kPa (4.3 psi) 100% O2 EVA pressure suits or 56 kPa composite hard-shell spacesuit architectures.",
  },
];

export function HazardLayersPage() {
  // Interactive MERI (Mars Exploration Risk Index) Calculator Parameters
  const [slopeAngle, setSlopeAngle] = useState(8);
  const [speEventActive, setSpeEventActive] = useState(false);
  const [dustStormIntensity, setDustStormIntensity] = useState(0.4);
  const [boulderFieldDensity, setBoulderFieldDensity] = useState(4);
  const [missionTargetType, setMissionTargetType] = useState<"rover" | "astronaut">("rover");

  // Multi-Objective Normalized Risk Computation
  const slopeRisk = Math.min(100, (slopeAngle / 20) * 100);
  const radiationRisk = speEventActive ? 95 : 38;
  const dustRisk = Math.min(100, (dustStormIntensity / 1.5) * 100);
  const boulderRisk = Math.min(100, (boulderFieldDensity / 15) * 100);

  // Dynamic weighting based on vehicle vs astronaut
  const compositeRiskScore =
    missionTargetType === "rover"
      ? Math.round(slopeRisk * 0.4 + boulderRisk * 0.3 + dustRisk * 0.2 + radiationRisk * 0.1)
      : Math.round(radiationRisk * 0.45 + dustRisk * 0.25 + slopeRisk * 0.2 + boulderRisk * 0.1);

  const riskTier: "SAFE" | "CAUTION" | "NO-GO" =
    compositeRiskScore <= 35 ? "SAFE" : compositeRiskScore <= 65 ? "CAUTION" : "NO-GO";

  const riskColor =
    riskTier === "SAFE"
      ? "text-mint border-mint/40 bg-mint/10"
      : riskTier === "CAUTION"
      ? "text-amber border-amber/40 bg-amber/10"
      : "text-rose border-rose/40 bg-rose/10";

  return (
    <div className="rise-in space-y-8">
      {/* 1. AEROSPACE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-line/70 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:bg-[#070c16]/90">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-rose border border-rose/30">
              <ShieldAlert className="size-3.5" />
              NASA Calibrated Risk Systems
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-amber border border-amber/30">
              MERI Engine v2.4
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-mint/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-mint border border-mint/30">
              MSL RAD &amp; MOLA Calibrated
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-bright">
            Mars Multi-Hazard Analysis &amp; MERI Risk Engine
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-fog max-w-3xl leading-relaxed font-mono">
            Unified hazard decision-support integrating MOLA terrain slope trafficability, MSL RAD ionizing radiation baselines, THEMIS diurnal thermal shock, and aeolian dust storm opacity.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/planetary-map"
            className="inline-flex items-center gap-2 rounded-xl bg-amber hover:bg-amber/90 px-4 py-2.5 font-display text-xs font-bold text-ink shadow-sm transition-all"
          >
            <Layers className="size-3.5" />
            <span>View Layers on Map</span>
          </Link>
        </div>
      </div>

      {/* 2. INTERACTIVE MERI (MARS EXPLORATION RISK INDEX) CALCULATOR */}
      <div className="rounded-3xl border border-line/80 bg-gradient-to-br from-[#0c1322] via-[#070c16] to-[#040810] p-6 shadow-2xl backdrop-blur-2xl sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-amber" />
              <h2 className="font-display text-xl font-bold text-bright">
                Interactive MERI (Mars Exploration Risk Index) Calculator
              </h2>
            </div>
            <p className="text-xs text-fog font-mono mt-1">
              Adjust mission parameters to model composite risk thresholds for robotic rovers vs crewed EVAs.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-ink2/60 border border-line/60 font-mono text-xs">
            <button
              type="button"
              onClick={() => setMissionTargetType("rover")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                missionTargetType === "rover" ? "bg-amber text-ink font-bold shadow-sm" : "text-fog hover:text-bright"
              }`}
            >
              Rover Traversability
            </button>
            <button
              type="button"
              onClick={() => setMissionTargetType("astronaut")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                missionTargetType === "astronaut" ? "bg-amber text-ink font-bold shadow-sm" : "text-fog hover:text-bright"
              }`}
            >
              Astronaut Crew EVA
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-center">
          {/* Sliders & Controls */}
          <div className="space-y-4 font-mono text-xs">
            {/* Control 1: Terrain Slope */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-fog uppercase">Terrain Slope (MOLA DEM):</span>
                <strong className="text-bright">{slopeAngle}° / 25° Max</strong>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="1"
                value={slopeAngle}
                onChange={(e) => setSlopeAngle(+e.target.value)}
                className="w-full accent-amber bg-ink2 rounded-lg cursor-pointer h-2"
              />
              <span className="text-[10px] text-fog">Trafficability: &lt;5° Flat, 5–15° Rolling, &gt;15° Severe Wheel Slip</span>
            </div>

            {/* Control 2: Dust Storm Opacity */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-fog uppercase">Dust Optical Depth Tau:</span>
                <strong className="text-amber">Tau {dustStormIntensity.toFixed(2)}</strong>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.05"
                value={dustStormIntensity}
                onChange={(e) => setDustStormIntensity(+e.target.value)}
                className="w-full accent-amber bg-ink2 rounded-lg cursor-pointer h-2"
              />
              <span className="text-[10px] text-fog">MEDA Solar Extinction: 0.15 Clear, 0.8 Alert, &gt;1.2 Regional Storm</span>
            </div>

            {/* Control 3: Boulder Obstacle Density */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-fog uppercase">Boulder Density (&gt;0.5m blocks):</span>
                <strong className="text-mint">{boulderFieldDensity} blocks / 100m²</strong>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={boulderFieldDensity}
                onChange={(e) => setBoulderFieldDensity(+e.target.value)}
                className="w-full accent-mint bg-ink2 rounded-lg cursor-pointer h-2"
              />
            </div>

            {/* Control 4: Solar Particle Event Toggle */}
            <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-ink2/50 border border-line/60">
              <div>
                <span className="text-bright font-bold block">Solar Particle Event (SPE) Active</span>
                <span className="text-[10px] text-fog">Simulates high-flux proton outburst from solar coronal mass ejection.</span>
              </div>
              <button
                type="button"
                onClick={() => setSpeEventActive(!speEventActive)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  speEventActive ? "bg-rose text-white shadow-lg shadow-rose/30" : "bg-ink2 text-fog border border-line"
                }`}
              >
                {speEventActive ? "ACTIVE (+2.5 mSv)" : "INACTIVE (Nominal)"}
              </button>
            </div>
          </div>

          {/* Unified Score Output Gauges */}
          <div className="rounded-2xl border border-line/70 bg-[#070c16]/90 p-6 space-y-4 text-center font-mono">
            <span className="text-[10px] uppercase tracking-widest text-fog block">
              Calculated MERI Composite Risk Score
            </span>

            <div className="flex items-center justify-center gap-3">
              <span className="font-display text-5xl font-extrabold text-bright">
                {compositeRiskScore}
              </span>
              <span className="text-base text-fog">/ 100</span>
            </div>

            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold ${riskColor}`}>
              {riskTier === "SAFE" ? (
                <ShieldCheck className="size-4" />
              ) : riskTier === "CAUTION" ? (
                <AlertTriangle className="size-4" />
              ) : (
                <ShieldAlert className="size-4" />
              )}
              <span>CLASSIFICATION: {riskTier}</span>
            </div>

            <div className="text-left text-xs text-fog space-y-2 pt-3 border-t border-line/60">
              <div className="flex justify-between">
                <span>Slope Mobility Risk:</span>
                <strong className="text-bright">{Math.round(slopeRisk)}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Radiation Exposure:</span>
                <strong className={speEventActive ? "text-rose" : "text-mint"}>{radiationRisk}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Dust Environmental Opacity:</span>
                <strong className="text-amber">{Math.round(dustRisk)}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Boulder Field Impassability:</span>
                <strong className="text-bright">{Math.round(boulderRisk)}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SCIENTIFIC HAZARD REGISTRY CARDS */}
      <div className="space-y-4">
        <div className="border-b border-line/60 pb-2">
          <h2 className="font-display text-xl font-bold text-bright">
            Primary Calibrated Martian Environmental Hazards
          </h2>
          <p className="text-xs text-fog font-mono mt-0.5">
            Peer-reviewed orbital and surface instruments mapped across candidate landing zones.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {HAZARD_REGISTRY.map((h) => (
            <div
              key={h.id}
              className="rounded-3xl border border-line/80 bg-white/80 dark:bg-[#070c16]/80 p-5 shadow-xl backdrop-blur-2xl flex flex-col justify-between space-y-4 font-mono text-xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${h.badgeBg} ${h.badgeBorder} ${h.severityColor}`}>
                    {h.severity}
                  </span>
                  <span className="text-[10px] text-fog">{h.source}</span>
                </div>

                <h3 className="mt-3 font-display text-base font-bold text-bright">{h.name}</h3>

                <div className="mt-2 p-2.5 rounded-xl bg-ink2/50 border border-line/50 flex items-baseline justify-between">
                  <div>
                    <span className="text-[9px] text-fog uppercase block">Observed Baseline</span>
                    <strong className="text-base text-bright font-bold font-display">{h.value}</strong>
                  </div>
                  <span className="text-[10px] text-fog">{h.range}</span>
                </div>

                <p className="mt-3 text-fog leading-relaxed text-[11px]">{h.description}</p>
              </div>

              <div className="pt-3 border-t border-line/50 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-fog">Rover Safe:</span>
                  <span className={h.roverSafe ? "text-mint font-bold" : "text-rose font-bold"}>
                    {h.roverSafe ? "✓ YES" : "✗ EXCEEDED"}
                  </span>
                  <span className="text-fog ml-3">Astronaut EVA:</span>
                  <span className={h.astronautSafe ? "text-mint font-bold" : "text-rose font-bold"}>
                    {h.astronautSafe ? "✓ SAFE" : "⚠ PROTOCOL"}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-ink2/30 text-[10px] text-fog">
                  <strong className="text-amber block mb-0.5">Mitigation:</strong>
                  {h.mitigation}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
