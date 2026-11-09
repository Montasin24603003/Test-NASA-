import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import { MlTerrainLab } from "@/components/MlTerrainLab/MlTerrainLab";
import { HfAiAnalysisPanel } from "@/components/HfAiAnalysis/HfAiAnalysisPanel";
import { BrainCircuit, Cpu, Sparkles, Layers } from "lucide-react";

export const Route = createFileRoute("/ml-terrain-lab")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Planetary AI Lab — Hugging Face Mars Models & Terrain ML // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Mars terrain risk demo built from a precomputed Jezero elevation patch, with a separate suite of Hugging Face image-analysis models.",
      },
      { property: "og:title", content: "Planetary AI Lab — Hugging Face Mars Models" },
      {
        property: "og:description",
        content:
          "Explore Mars imagery with Hugging Face models and view their prediction masks and bounding boxes. Outputs are exploratory and require scientific review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MlTerrainLabPage,
});

function MlTerrainLabPage() {
  const [activeTab, setActiveTab] = useState<"jezero-surrogate" | "hf-models">("jezero-surrogate");

  return (
    <div className="rise-in space-y-6">
      {/* Top AI System Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-2xl border border-line/70 bg-white/70 dark:bg-panel/70 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("jezero-surrogate")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === "jezero-surrogate"
                ? "bg-amber text-ink shadow-md"
                : "text-fog hover:text-bright hover:bg-ink2"
            }`}
          >
            <Cpu className="size-4" />
            <span>Jezero Terrain Risk Demo</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-900/20 text-slate-900 font-normal">
              128×128 DEM Patch
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("hf-models")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === "hf-models"
                ? "bg-amber text-ink shadow-md"
                : "text-fog hover:text-bright hover:bg-ink2"
            }`}
          >
            <BrainCircuit className="size-4" />
            <span>Hugging Face Mars AI Suite</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-900/20 text-slate-900 font-normal">
              7 Models
            </span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-fog pr-3">
          <Sparkles className="size-3.5 text-amber" />
          <span>NASA PDS HiRISE · CTX · THEMIS · MOLA Provenance</span>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === "jezero-surrogate" ? (
        <MlTerrainLab />
      ) : (
        <HfAiAnalysisPanel />
      )}
    </div>
  );
}
