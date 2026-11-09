import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  Database, 
  Droplets, 
  Wind, 
  Mountain, 
  Sun, 
  Zap, 
  ExternalLink, 
  Calculator, 
  CheckCircle2, 
  ShieldAlert, 
  Layers3, 
  Radio, 
  Flame, 
  Cpu, 
  FlaskConical,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { useState, useMemo } from "react";
import { nasaDatasets } from "@/data/nasaDatasets";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "ISRU & Resource Intelligence — Interplanetary Survival Guide // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Evidence-based Martian in-situ resource utilization (ISRU) intelligence. NASA SWIM 2.0 subsurface water ice, MOXIE atmospheric oxygen extraction, regolith basalt shielding, and solar-nuclear power budgets.",
      },
    ],
  }),
  component: ResourcesPage,
});

interface ResourceCategory {
  id: string;
  name: string;
  category: 'water' | 'atmosphere' | 'minerals' | 'energy';
  tagline: string;
  purityGrade: string;
  extractionMethod: string;
  nasaInstrument: string;
  missionRelevance: string;
  epistemicTier: 'OBSERVED EVIDENCE' | 'MULTI-SENSOR INTERPRETATION' | 'THERMODYNAMIC MODEL';
  dataLimitNote: string;
}

const RESOURCE_CATALOG: ResourceCategory[] = [
  {
    id: "subsurface-water-ice",
    name: "Subsurface Glacial Water Ice",
    category: "water",
    tagline: "High-purity sheet ice (>85% mass fraction) beneath 0.5–2m desiccated lag deposit.",
    purityGrade: "85–98% H₂O (Arcadia & Utopia Planitia)",
    extractionMethod: "Rodrigues Well / Thermal Melt Probe or Shallow Trencher Auger",
    nasaInstrument: "MRO SHARAD Radar, Odyssey GRS/HEND, SWIM 2.0 Multi-Sensor Consistency",
    missionRelevance: "Critical drinking water, radiation shielding blankets, and liquid H₂ propellant feed.",
    epistemicTier: "MULTI-SENSOR INTERPRETATION",
    dataLimitNote: "Confidence high at latitudes >35°N. Equatorial sites (Jezero, Gale) lack near-surface ice table; free ice sublimates rapidly.",
  },
  {
    id: "atmospheric-co2",
    name: "Atmospheric CO₂ & Dry Ice",
    category: "atmosphere",
    tagline: "95.32% Carbon Dioxide at mean surface pressure 610–760 Pa.",
    purityGrade: "95.3% CO₂, 2.6% N₂, 1.9% Ar",
    extractionMethod: "Solid Oxide Electrolysis (MOXIE) & Sabatier Methanation: CO₂ + 4H₂ → CH₄ + 2H₂O",
    nasaInstrument: "NASA Mars 2020 MOXIE (12 g O₂/hr demonstrated), MEDA Barometric Sensor",
    missionRelevance: "Autonomous oxygen production for life support breathing (0.84 kg/crew/day) and rocket oxidizer.",
    epistemicTier: "OBSERVED EVIDENCE",
    dataLimitNote: "100% globally available across all longitudes; production rate scales with ambient barometric pressure and atmospheric dust loading.",
  },
  {
    id: "smectite-clays",
    name: "Hydrated Phyllosilicates & Smectite Clays",
    category: "water",
    tagline: "Chemically bound structural water (3–7% weight fraction) in Noachian aqueous sedimentary beds.",
    purityGrade: "3–7 wt% Structural H₂O",
    extractionMethod: "Thermal Retort Desorption (Baking regolith to 450°C–600°C in pressurized seal)",
    nasaInstrument: "MRO CRISM (Compact Reconnaissance Imaging Spectrometer), Mars Express OMEGA",
    missionRelevance: "Primary water source in equatorial landing zones (Jezero Delta, Mawrth Vallis, Oxia Planum).",
    epistemicTier: "OBSERVED EVIDENCE",
    dataLimitNote: "High energy cost (~1.2 kWh/kg extracted H₂O) compared to direct glacial ice melting.",
  },
  {
    id: "basalt-regolith",
    name: "Volcanic Basalt Regolith & Glass",
    category: "minerals",
    tagline: "Silicon and Iron-rich volcanic soil suitable for sinter-brick radiation habitats.",
    purityGrade: "45% SiO₂, 18% FeO, 9% Al₂O₃, 7% CaO",
    extractionMethod: "Microwave Sintering (1000°C–1200°C) or Polymeric Sulfur Concrete (Waterless)",
    nasaInstrument: "Curiosity CheMin XRD / APXS, Perseverance PIXL (Planetary Instrument for X-ray Lithochemistry)",
    missionRelevance: "Heavy GCR/SPE ionizing radiation shielding, habitat berms, landing pad dust mitigation.",
    epistemicTier: "OBSERVED EVIDENCE",
    dataLimitNote: "High perchlorate salt content (0.5–1.0 wt% ClO₄⁻) requires chemical washing prior to human contact.",
  },
  {
    id: "solar-insolation",
    name: "Surface Solar Photovoltaic Flux",
    category: "energy",
    tagline: "Mean top-of-atmosphere solar constant 590 W/m² attenuated by atmospheric dust optical depth tau.",
    purityGrade: "Diurnal Peak: 180–420 W/m² (Variable with season Ls and dust storm events)",
    extractionMethod: "Ultra-thin triple-junction GaAs solar arrays with automated electrostatic dust removal",
    nasaInstrument: "Mars 2020 MEDA TIRS, Mars Global Surveyor TES Optical Depth Datasets",
    missionRelevance: "Primary daytime power for rover battery recharge, life support, and daytime ISRU cycles.",
    epistemicTier: "OBSERVED EVIDENCE",
    dataLimitNote: "Subject to severe seasonal dust storms (tau > 2.5) where output drops up to 85%; requires energy storage buffers.",
  },
  {
    id: "geothermal-tubes",
    name: "Subsurface Lava Tube Caverns",
    category: "minerals",
    tagline: "Natural basaltic volcanic conduits offering pristine thermal stability and radiation protection.",
    purityGrade: "10–40m basalt ceiling thickness",
    extractionMethod: "Autonomous Skylight Rapelling & Inflatable Pressurized Membrane Seals",
    nasaInstrument: "MGS MOLA Laser Altimetry, Odyssey THEMIS Thermal Infrared Skylight Pits (Tharsis / Elysium)",
    missionRelevance: "Natural cosmic ray shield (reducing 250 mSv/yr surface dose to <5 mSv/yr) with constant -40°C thermal equilibrium.",
    epistemicTier: "MULTI-SENSOR INTERPRETATION",
    dataLimitNote: "Pits identified by thermal contrast and collapse scarps; internal structural integrity requires autonomous LIDAR inspection.",
  },
];

export function ResourcesPage() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'water' | 'atmosphere' | 'minerals' | 'energy'>('all');

  // Interactive ISRU Survival Production Calculator State
  const [crewSize, setCrewSize] = useState<number>(4);
  const [missionSols, setMissionSols] = useState<number>(90);
  const [waterSourceType, setWaterSourceType] = useState<'glacial_ice' | 'hydrated_clays' | 'atmospheric_reclaim'>('glacial_ice');

  // Calculations
  const isruCalculations = useMemo(() => {
    // NASA baseline specs:
    // Water consumption per astronaut: 2.5 L/day (metabolic) + 3.0 L/day (hygiene/buffer) = 5.5 L/day
    const dailyWaterLiters = crewSize * 5.5;
    const totalWaterLiters = dailyWaterLiters * missionSols;

    // Oxygen consumption per astronaut: 0.84 kg O2/sol
    const dailyOxygenKg = crewSize * 0.84;
    const totalOxygenKg = dailyOxygenKg * missionSols;

    // MOXIE units required (1 unit = 12 g/hr = 0.288 kg/sol at 24h continuous operation)
    const moxieUnitsNeeded = Math.ceil(dailyOxygenKg / 0.288);

    // Energy requirement depending on extraction method
    // Glacial ice: ~0.15 kWh/liter; Clays: ~1.25 kWh/liter; Atmospheric reclaim: ~0.45 kWh/liter
    const energyPerLiterKwh = waterSourceType === 'glacial_ice' ? 0.18 : waterSourceType === 'hydrated_clays' ? 1.35 : 0.50;
    const totalEnergyKwh = Math.round(totalWaterLiters * energyPerLiterKwh + totalOxygenKg * 8.5);

    // Sabatier Methane fuel output if 20% of water electrolyzed for H2
    const fuelMethaneKg = Math.round((totalWaterLiters * 0.20 * 0.111) * 2.0);

    return {
      dailyWaterLiters,
      totalWaterLiters: Math.round(totalWaterLiters),
      dailyOxygenKg: Number(dailyOxygenKg.toFixed(2)),
      totalOxygenKg: Math.round(totalOxygenKg),
      moxieUnitsNeeded,
      totalEnergyKwh,
      fuelMethaneKg,
    };
  }, [crewSize, missionSols, waterSourceType]);

  const filteredResources = useMemo(() => {
    if (selectedCategory === 'all') return RESOURCE_CATALOG;
    return RESOURCE_CATALOG.filter((r) => r.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="rise-in space-y-8">
      {/* 1. HERO HEADER */}
      <div className="flex flex-col gap-4 rounded-3xl border border-line/70 bg-white/85 p-6 shadow-xl backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between dark:bg-[#070c16]/85">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan border border-cyan/30">
              <FlaskConical className="size-3.5 text-cyan" />
              NASA Planetary Materials &amp; ISRU Engine
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-amber border border-amber/30">
              <Sparkles className="size-3.5 text-amber" />
              SWIM 2.0 &bull; MOXIE &bull; CRISM Ground Truth
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-bright">
            In-Situ Resource Utilization &amp; Planetary Reserves
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-fog max-w-3xl leading-relaxed">
            Evidence-based Martian resource synthesis: Subsurface glacial water ice horizons, atmospheric oxygen cracking, basalt sintering, and solar-nuclear power budgets.
          </p>
        </div>

        <Link
          to="/planetary-map"
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-amber px-4 py-2.5 font-display text-xs font-bold text-ink shadow-sm transition hover:bg-amber/90"
        >
          <Layers3 className="size-4" />
          <span>Inspect Layers on Map</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* 2. INTERACTIVE ISRU SURVIVAL CONSUMABLE CALCULATOR */}
      <section className="rounded-3xl border border-line/80 bg-white/90 dark:bg-[#070c16]/90 p-6 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber/15 border border-amber/30 text-amber">
              <Calculator className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-bright">
                Interactive Martian ISRU Consumable Budget Calculator
              </h2>
              <p className="text-xs text-fog font-mono">
                First-principles human metabolic &amp; propellant synthesis model (NASA Life Support Baseline HIDH)
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] px-3 py-1 rounded-lg bg-mint/15 text-mint border border-mint/30 font-bold self-start sm:self-auto">
            100% Closed-Loop Feasible
          </span>
        </div>

        {/* Calculator Control Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Crew Size Selector */}
          <div className="p-4 rounded-2xl border border-line/70 bg-panel/40">
            <label className="font-mono text-[11px] text-fog uppercase block mb-2">
              Astronaut Crew Size: <strong className="text-amber text-sm">{crewSize} Humans</strong>
            </label>
            <input
              type="range"
              min="1"
              max="12"
              value={crewSize}
              onChange={(e) => setCrewSize(parseInt(e.target.value, 10))}
              className="w-full accent-amber cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[9px] text-fog mt-1">
              <span>1 Crew</span>
              <span>4 (Std Expedition)</span>
              <span>12 (Base Habitat)</span>
            </div>
          </div>

          {/* Mission Duration (Sols) */}
          <div className="p-4 rounded-2xl border border-line/70 bg-panel/40">
            <label className="font-mono text-[11px] text-fog uppercase block mb-2">
              Surface Mission Duration: <strong className="text-cyan text-sm">{missionSols} Sols</strong>
            </label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={missionSols}
              onChange={(e) => setMissionSols(parseInt(e.target.value, 10))}
              className="w-full accent-cyan cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[9px] text-fog mt-1">
              <span>10 Sols</span>
              <span>90 Sols (Season)</span>
              <span>500 Sols (Synodic)</span>
            </div>
          </div>

          {/* Water Extraction Feedstock */}
          <div className="p-4 rounded-2xl border border-line/70 bg-panel/40">
            <label className="font-mono text-[11px] text-fog uppercase block mb-2">
              Primary Water Feedstock Source
            </label>
            <select
              value={waterSourceType}
              onChange={(e) => setWaterSourceType(e.target.value as any)}
              className="w-full rounded-xl border border-line bg-ink2 px-3 py-2 font-mono text-xs text-bright focus:outline-hidden focus:ring-1 focus:ring-amber"
            >
              <option value="glacial_ice">Arcadia/Utopia Glacial Sheet Ice (0.18 kWh/L)</option>
              <option value="hydrated_clays">Equatorial Smectite Clays (1.35 kWh/L)</option>
              <option value="atmospheric_reclaim">Atmospheric Condenser Reclaim (0.50 kWh/L)</option>
            </select>
          </div>
        </div>

        {/* Real Calculated Outputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
          <div className="p-3.5 rounded-2xl border border-line/70 bg-panel/60">
            <span className="text-fog text-[10px] uppercase block">Total Water Required</span>
            <strong className="text-cyan text-base font-bold">{isruCalculations.totalWaterLiters.toLocaleString()} L</strong>
            <span className="text-[10px] text-fog block mt-0.5">{isruCalculations.dailyWaterLiters} L / Sol</span>
          </div>

          <div className="p-3.5 rounded-2xl border border-line/70 bg-panel/60">
            <span className="text-fog text-[10px] uppercase block">Total O₂ Required</span>
            <strong className="text-mint text-base font-bold">{isruCalculations.totalOxygenKg.toLocaleString()} kg</strong>
            <span className="text-[10px] text-fog block mt-0.5">{isruCalculations.dailyOxygenKg} kg / Sol</span>
          </div>

          <div className="p-3.5 rounded-2xl border border-line/70 bg-panel/60">
            <span className="text-fog text-[10px] uppercase block">MOXIE Stacks Needed</span>
            <strong className="text-amber text-base font-bold">{isruCalculations.moxieUnitsNeeded} Units</strong>
            <span className="text-[10px] text-fog block mt-0.5">12 g/hr Continuous</span>
          </div>

          <div className="p-3.5 rounded-2xl border border-line/70 bg-panel/60">
            <span className="text-fog text-[10px] uppercase block">Sabatier CH₄ Fuel</span>
            <strong className="text-indigo-400 text-base font-bold">{isruCalculations.fuelMethaneKg.toLocaleString()} kg</strong>
            <span className="text-[10px] text-fog block mt-0.5">Return Propellant</span>
          </div>

          <div className="p-3.5 rounded-2xl border border-line/70 bg-panel/60">
            <span className="text-fog text-[10px] uppercase block">Total ISRU Energy</span>
            <strong className="text-amber text-base font-bold">{isruCalculations.totalEnergyKwh.toLocaleString()} kWh</strong>
            <span className="text-[10px] text-fog block mt-0.5">Thermal + Electrolysis</span>
          </div>

          <div className="p-3.5 rounded-2xl border border-line/70 bg-panel/60">
            <span className="text-fog text-[10px] uppercase block">Power System Type</span>
            <strong className="text-bright text-xs font-bold">Kilopower + Solar</strong>
            <span className="text-[10px] text-mint block mt-0.5">10 kWe Fission Core</span>
          </div>
        </div>
      </section>

      {/* 3. CATEGORY FILTER TABS */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            selectedCategory === 'all'
              ? 'bg-amber text-ink shadow-sm'
              : 'text-fog hover:text-bright hover:bg-panel'
          }`}
        >
          All Resources ({RESOURCE_CATALOG.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('water')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            selectedCategory === 'water'
              ? 'bg-cyan text-ink shadow-sm'
              : 'text-fog hover:text-bright hover:bg-panel'
          }`}
        >
          <Droplets className="size-3.5" />
          <span>Water &amp; Glacial Ice</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('atmosphere')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            selectedCategory === 'atmosphere'
              ? 'bg-mint text-ink shadow-sm'
              : 'text-fog hover:text-bright hover:bg-panel'
          }`}
        >
          <Wind className="size-3.5" />
          <span>Atmospheric CO₂ &amp; O₂</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('minerals')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            selectedCategory === 'minerals'
              ? 'bg-amber text-ink shadow-sm'
              : 'text-fog hover:text-bright hover:bg-panel'
          }`}
        >
          <Mountain className="size-3.5" />
          <span>Basalt &amp; Minerals</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('energy')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            selectedCategory === 'energy'
              ? 'bg-indigo-400 text-ink shadow-sm'
              : 'text-fog hover:text-bright hover:bg-panel'
          }`}
        >
          <Sun className="size-3.5" />
          <span>Solar &amp; Thermal Flux</span>
        </button>
      </div>

      {/* 4. RESOURCE CARDS GRID */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredResources.map((res) => (
          <article
            key={res.id}
            className="rounded-3xl border border-line/70 bg-white/80 dark:bg-panel/50 p-6 shadow-sm backdrop-blur-xl flex flex-col justify-between hover:border-amber/40 transition-all group"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-mono text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan/15 text-cyan font-bold border border-cyan/20">
                  {res.category}
                </span>
                <span className="font-mono text-[9px] text-amber font-semibold">
                  {res.epistemicTier}
                </span>
              </div>

              <h3 className="font-display text-lg font-bold text-bright group-hover:text-amber transition-colors">
                {res.name}
              </h3>
              <p className="mt-2 text-xs text-fog leading-relaxed">
                {res.tagline}
              </p>

              {/* Technical Specifications */}
              <div className="mt-4 space-y-2 font-mono text-[11px] border-t border-line/60 pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-fog">Grade / Purity:</span>
                  <strong className="text-bright text-right">{res.purityGrade}</strong>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-fog">Extraction:</span>
                  <strong className="text-cyan text-right">{res.extractionMethod}</strong>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-fog">NASA Instrument:</span>
                  <strong className="text-amber text-right">{res.nasaInstrument}</strong>
                </div>
              </div>

              {/* Data Limitation Notice */}
              <div className="mt-3.5 rounded-xl border border-line/50 bg-ink2/50 p-2.5 font-mono text-[10px] text-fog leading-relaxed">
                <span className="text-amber font-semibold block mb-0.5">Scientific Limitation:</span>
                {res.dataLimitNote}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-line/60 flex items-center justify-between font-mono text-[11px]">
              <Link
                to="/planetary-map"
                className="text-amber hover:underline flex items-center gap-1 font-semibold"
              >
                <Layers3 className="size-3.5" />
                <span>Locate on Mars Map &rarr;</span>
              </Link>
              <span className="text-fog text-[10px]">NASA PDS Ground Truth</span>
            </div>
          </article>
        ))}
      </div>

      {/* 5. NASA DATA EVIDENCE ARCHIVES INDEX */}
      <section className="rounded-3xl border border-line/70 bg-white/85 dark:bg-[#070c16]/85 p-6 shadow-xl backdrop-blur-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Database className="size-5 text-cyan" />
          <h2 className="font-display text-xl font-bold text-bright">
            Primary NASA Planetary Science Archive Portals
          </h2>
        </div>
        <p className="text-xs text-fog font-mono mb-4">
          All resource estimates and epistemic confidence rankings are calibrated against public NASA Planetary Data System (PDS) data records.
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {nasaDatasets.map((dataset) => (
            <a
              key={dataset.id}
              href={dataset.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-ink2/40 p-3 hover:border-cyan/40 hover:bg-ink2/70 transition-all"
            >
              <div className="overflow-hidden">
                <span className="block text-xs font-semibold text-bright truncate">{dataset.title}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-fog block">{dataset.category}</span>
              </div>
              <ExternalLink className="size-3.5 text-fog shrink-0" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
