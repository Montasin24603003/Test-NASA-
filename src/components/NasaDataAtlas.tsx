import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  Database,
  ExternalLink,
  Filter,
  Flame,
  Globe2,
  Layers3,
  Mountain,
  Orbit,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  Zap,
} from "lucide-react";
import {
  nasaDatasets,
  pipelineLayers,
  NASA_SOURCE_PORTALS,
  type NasaDataset,
} from "@/data/nasaDatasets";
import { Link } from "@tanstack/react-router";

const categoryIcons = {
  "Terrain / ML": Mountain,
  "Thermal / Heat": Thermometer,
  "Radiation / Atmosphere": ShieldCheck,
  "Mineralogy / Spectroscopy": Sparkles,
  "Solar / Energy": Sun,
  "Human Exposure / Risk": Activity,
  "Comparative Planetology": Orbit,
  "Surface Imagery": Globe2,
} as const;

export function NasaDataAtlas() {
  const [selectedPortal, setSelectedPortal] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    "all",
    "Terrain / ML",
    "Thermal / Heat",
    "Radiation / Atmosphere",
    "Mineralogy / Spectroscopy",
    "Solar / Energy",
    "Human Exposure / Risk",
    "Comparative Planetology",
    "Surface Imagery",
  ];

  const filteredDatasets = nasaDatasets.filter((d) => {
    const matchesPortal = selectedPortal === "all" || d.portal === selectedPortal;
    const matchesCategory = selectedCategory === "all" || d.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.missionApplication.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPortal && matchesCategory && matchesSearch;
  });

  return (
    <section id="data-atlas" className="mt-12 scroll-mt-24 rise-in">
      {/* Header Banner */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan">
              Multi-Source NASA Planetary Data Registry
            </span>
            <span className="rounded-full bg-cyan/15 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan">
              10 NASA &amp; ANALOG SOURCES
            </span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            From 10 NASA Portals to Real Mission Decisions
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fog">
            Connecting real observational archives across planetary, atmospheric, solar, thermal, and
            remote sensing archives to fuel our AI Hazard Surrogate Model, Rover Path Planner, and
            Survival Protocols.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-mint/20 bg-mint/5 px-3.5 py-1.5 font-mono text-[11px] text-mint">
          <Database className="size-4" /> {nasaDatasets.length} authoritative source models linked
        </div>
      </div>

      {/* ML Pipeline Callout Banner */}
      <div className="mb-6 rounded-2xl border border-cyan/30 bg-gradient-to-r from-cyan/[0.08] via-white to-amber/[0.05] p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan/15 text-cyan">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan">
                  ML Model Integration
                </span>
                <span className="rounded-full bg-mint/15 px-2 py-0.5 font-mono text-[9px] font-semibold text-mint">
                  R² = 0.998 · 98.3% Accuracy
                </span>
              </div>
              <h3 className="mt-0.5 font-display text-base font-bold text-bright">
                Trained Gradient-Boosted Terrain Hazard Surrogate
              </h3>
              <p className="mt-1 text-xs text-fog max-w-2xl">
                Trained on NASA PDS HiRISE 1m DTMs of Jezero Crater to predict surface rover traversal
                hazards directly from multi-scale elevation derivatives, avoiding 28.6% of traversal risk.
              </p>
            </div>
          </div>
          <Link
            to="/ml-terrain-lab"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cyan px-4 py-2.5 font-display text-xs font-semibold text-ink shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-cyan/90"
          >
            Open ML Terrain Lab <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* 5 Fused Planning Layers Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {pipelineLayers.map((layer) => (
          <div
            key={layer.key}
            className="rounded-xl border border-line bg-white/80 p-4 shadow-2xs backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <Layers3 className="size-4 text-amber" />
              <span className="rounded-full bg-cyan/10 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-wider text-cyan font-bold">
                FUSED
              </span>
            </div>
            <h3 className="mt-3 font-display text-sm font-bold text-bright">{layer.label}</h3>
            <p className="mt-1 font-mono text-[9.5px] text-amber font-medium">{layer.source}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-fog">{layer.effect}</p>
          </div>
        ))}
      </div>

      {/* Portals and Filter Toolbar */}
      <div className="mt-8 space-y-4 rounded-2xl border border-line bg-panel/60 p-5 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 size-4 text-fog" />
            <input
              type="text"
              placeholder="Search datasets, mission applications, or NASA instruments…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-white pl-9 pr-4 py-2 font-mono text-xs text-bright outline-none transition-all focus:border-cyan focus:ring-2 focus:ring-cyan/20"
            />
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[10px] transition-colors ${
                  selectedCategory === cat
                    ? "bg-amber text-white font-bold shadow-xs"
                    : "border border-line bg-white text-fog hover:text-bright"
                }`}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* 10 NASA Portals Horizontal Switcher */}
        <div className="border-t border-line/60 pt-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-fog block mb-2">
            Filter by NASA Portal Source:
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedPortal("all")}
              className={`rounded-lg px-2.5 py-1 font-mono text-[10px] transition-colors ${
                selectedPortal === "all"
                  ? "bg-bright text-ink font-bold shadow-xs"
                  : "border border-line bg-white text-fog hover:text-bright"
              }`}
            >
              All 10 Portals ({nasaDatasets.length})
            </button>
            {NASA_SOURCE_PORTALS.map((portal) => {
              const count = nasaDatasets.filter((d) => d.portal === portal.id).length;
              return (
                <button
                  key={portal.id}
                  type="button"
                  onClick={() => setSelectedPortal(portal.id)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[10px] transition-colors ${
                    selectedPortal === portal.id
                      ? "bg-cyan text-ink font-bold shadow-xs"
                      : "border border-line bg-white text-fog hover:text-bright"
                  }`}
                >
                  <span>{portal.name}</span>
                  <span className="text-[9px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dataset Grid */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {filteredDatasets.map((dataset) => {
          const Icon =
            categoryIcons[dataset.category as keyof typeof categoryIcons] ?? Database;
          return (
            <article
              key={dataset.id}
              className="flex flex-col justify-between rounded-2xl border border-line bg-white/80 p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan/25 bg-cyan/10">
                      <Icon className="size-5 text-cyan" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber font-semibold">
                          {dataset.category}
                        </span>
                        {dataset.badge && (
                          <span className="rounded-full bg-mint/15 px-2 py-0.5 font-mono text-[8px] font-bold text-mint">
                            {dataset.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 font-display text-base font-bold text-bright leading-snug">
                        {dataset.title}
                      </h3>
                    </div>
                  </div>
                  <a
                    href={dataset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg border border-line bg-white p-2 text-fog transition-colors hover:border-cyan hover:text-cyan shadow-2xs"
                    title={`Open source at ${dataset.source}`}
                    aria-label={`Open ${dataset.title}`}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>

                <div className="mt-3 rounded-lg border border-line/60 bg-ink2/50 px-3 py-1.5 font-mono text-[10px]">
                  <span className="text-fog">Mission Application: </span>
                  <strong className="text-bright">{dataset.missionApplication}</strong>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-fog">{dataset.description}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 font-mono text-[10px] text-fog">
                <a
                  href="#mission-map"
                  className="text-amber hover:underline flex items-center gap-1 font-semibold"
                >
                  <Layers3 className="size-3 text-amber" />
                  View on Map
                </a>
                <a
                  href={dataset.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan hover:underline flex items-center gap-1"
                >
                  {dataset.portal}
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {/* 10 Portals Directory Reference */}
      <div className="mt-8 rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan font-semibold">
          10 Master NASA &amp; Earth/Planetary Portals Index
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5 font-mono text-xs">
          {NASA_SOURCE_PORTALS.map((portal) => (
            <a
              key={portal.id}
              href={portal.url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col justify-between rounded-xl border border-line bg-ink2/40 p-3 transition hover:border-amber/50 hover:bg-amber/[0.04]"
            >
              <div>
                <p className="font-bold text-bright">{portal.name}</p>
                <p className="mt-1 text-[10px] text-fog leading-tight">{portal.desc}</p>
              </div>
              <span className="mt-2 text-[9px] text-amber flex items-center gap-1">
                {portal.id} <ExternalLink className="size-2.5" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
