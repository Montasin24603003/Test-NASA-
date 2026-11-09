import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Radio, Maximize2, Sparkles, Layers } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/sol-by-sol")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sol by Sol — Mars Survival Simulator // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Full-screen 100% viewport Mars expedition life-support simulator with daily ECLSS resource allocation, solar dust storm survival, space radiation mitigation, and AI Mission Advisor.",
      },
    ],
  }),
  component: SolBySolPage,
});

function SolBySolPage() {
  const [hudCollapsed, setHudCollapsed] = useState(false);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05080f] p-0 m-0">
      {/* Floating Aerospace Control Bar (100% non-blocking overlay) */}
      <header
        className={`absolute top-3 left-3 right-3 z-50 flex items-center justify-between pointer-events-none transition-all duration-300 ${
          hudCollapsed ? "opacity-0 -translate-y-8 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="flex items-center gap-2 pointer-events-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line/70 bg-[#070c16]/90 px-3 py-1.5 font-mono text-xs font-semibold text-bright shadow-lg backdrop-blur-2xl hover:border-amber/50 hover:bg-[#0c1424] transition-all"
            title="Return to Mission Control Homepage"
          >
            <ArrowLeft className="size-3.5 text-amber" />
            <span>Home</span>
          </Link>

          <Link
            to="/planetary-map"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-line/70 bg-[#070c16]/90 px-3 py-1.5 font-mono text-xs font-semibold text-bright shadow-lg backdrop-blur-2xl hover:border-amber/50 hover:bg-[#0c1424] transition-all"
            title="Switch to 3D Planetary Map"
          >
            <Layers className="size-3.5 text-cyan" />
            <span>Planetary Map</span>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-xl border border-line/70 bg-[#070c16]/90 px-3 py-1.5 font-mono text-xs text-bright shadow-lg backdrop-blur-2xl">
            <span className="beacon-dot size-2 rounded-full bg-mint animate-pulse" />
            <span className="font-bold tracking-wider text-amber uppercase">SOL BY SOL</span>
            <span className="hidden md:inline text-fog">| ECLSS 100% Viewport Mode</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <a
            href="/sol-simulator/index.html"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-line/70 bg-[#070c16]/90 px-3 py-1.5 font-mono text-xs font-semibold text-bright shadow-lg backdrop-blur-2xl hover:border-amber/50 hover:bg-[#0c1424] transition-all"
            title="Open simulation in new browser tab"
          >
            <ExternalLink className="size-3.5 text-cyan" />
            <span>Popout</span>
          </a>

          <button
            type="button"
            onClick={() => setHudCollapsed(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line/70 bg-[#070c16]/90 px-3 py-1.5 font-mono text-xs font-semibold text-fog hover:text-bright shadow-lg backdrop-blur-2xl hover:border-amber/50 transition-all cursor-pointer"
            title="Hide floating bar for 100% clean simulation screen"
          >
            <Maximize2 className="size-3.5" />
            <span className="hidden sm:inline">Clean View</span>
          </button>
        </div>
      </header>

      {/* Floating Restore HUD Button (shown when collapsed) */}
      {hudCollapsed && (
        <button
          type="button"
          onClick={() => setHudCollapsed(false)}
          className="absolute top-3 left-3 z-50 inline-flex items-center gap-1.5 rounded-xl border border-amber/40 bg-[#070c16]/90 px-3 py-1.5 font-mono text-xs font-bold text-amber shadow-xl backdrop-blur-2xl hover:bg-[#0c1424] transition-all cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Show Nav &amp; Tools</span>
        </button>
      )}

      {/* 100% Height & Width Simulation Viewport (Edge to Edge) */}
      <iframe
        title="Sol by Sol Mars Survival Simulator"
        src="/sol-simulator/index.html"
        className="w-full h-full border-0 block p-0 m-0"
        loading="eager"
      />
    </div>
  );
}
