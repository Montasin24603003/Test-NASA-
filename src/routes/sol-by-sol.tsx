import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Radio } from "lucide-react";

export const Route = createFileRoute("/sol-by-sol")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sol by Sol — Mars Survival Simulator // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Faithful integration of the original Sol by Sol Mars survival simulator with NASA DONKI data access and an AI mission advisor.",
      },
    ],
  }),
  component: SolBySolPage,
});

function SolBySolPage() {
  return (
    <div className="rise-in space-y-5">
      {/* 1. AEROSPACE MISSION HEADER */}
      <div className="flex flex-col gap-3 rounded-3xl border border-line/70 bg-white/90 p-5 shadow-2xl backdrop-blur-2xl dark:bg-[#070c16]/90 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-mint/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-mint border border-mint/30">
              <Radio className="size-3 text-mint animate-pulse" />
              NASA DONKI Live Space Weather Link
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-amber border border-amber/30">
              500-Sol Survival Sandbox
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-bright">
            Sol by Sol · Mars Surface Survival Simulator
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-fog max-w-2xl font-mono leading-relaxed">
            Multi-system expedition life-support simulator with daily ECLSS resource allocation, solar dust storm survival, space radiation mitigation, and AI Mission Advisor.
          </p>
        </div>

        <a
          href="/sol-simulator/index.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber hover:bg-amber/90 px-4 py-2.5 font-display text-xs font-bold text-ink shadow-sm transition-all"
        >
          <ExternalLink className="size-3.5" />
          <span>Launch Standalone Window</span>
        </a>
      </div>

      {/* 2. ECLSS TELEMETRY STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <span className="text-[10px] text-fog uppercase block">ECLSS Oxygen</span>
          <strong className="text-base text-bright font-bold block mt-0.5">21.0% O₂</strong>
          <span className="text-[10px] text-mint">Cabin 101.3 kPa</span>
        </div>
        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <span className="text-[10px] text-fog uppercase block">Water Loop Recovery</span>
          <strong className="text-base text-cyan font-bold block mt-0.5">93.4% Recycled</strong>
          <span className="text-[10px] text-fog">Urine + Condensate</span>
        </div>
        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <span className="text-[10px] text-fog uppercase block">Calorie Rationing</span>
          <strong className="text-base text-amber font-bold block mt-0.5">2,650 kcal/sol</strong>
          <span className="text-[10px] text-fog">Hydroponic Greenery</span>
        </div>
        <div className="p-3 rounded-2xl border border-line/70 bg-white/80 dark:bg-[#070c16]/80 shadow-sm backdrop-blur-xl">
          <span className="text-[10px] text-fog uppercase block">DONKI Solar Flux</span>
          <strong className="text-base text-mint font-bold block mt-0.5">B-Class Baseline</strong>
          <span className="text-[10px] text-mint">No CME Alert</span>
        </div>
      </div>

      {/* 3. SIMULATION VIEWPORT FRAME */}
      <div className="overflow-hidden rounded-3xl border border-line/80 bg-[#080d14] shadow-2xl">
        <iframe
          title="Sol by Sol Mars Survival Simulator"
          src="/sol-simulator/index.html"
          className="block h-[min(1100px,calc(100vh-190px))] min-h-[840px] w-full border-0"
          loading="eager"
        />
      </div>

      {/* 4. FOOTER NOTE */}
      <div className="flex items-center justify-between rounded-2xl border border-line/60 bg-panel/30 p-3.5 font-mono text-[11px] text-fog">
        <div className="flex items-center gap-2">
          <Radio className="size-3.5 text-mint animate-pulse" />
          <span>NASA DONKI space weather link synchronized; bundled mission ephemeris active offline.</span>
        </div>
        <span className="text-amber">Mission Day: Sol 142</span>
      </div>
    </div>
  );
}
