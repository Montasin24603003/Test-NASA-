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
          "Modular Mars AI system featuring Hugging Face models: MOMO multi-sensor foundation model, Mars-Bench crater and boulder segmentation, surface classification, SegFormer traversability, and Jezero HiRISE gradient-boosted hazard surrogate.",
      },
      { property: "og:title", content: "Planetary AI Lab — Hugging Face Mars Models" },
      {
        property: "og:description",
        content:
          "Inspect NASA HiRISE, CTX, and THEMIS imagery with Mars-specific Hugging Face models, prediction masks, bounding boxes, and scientific ground-truth cross-checks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MlTerrainLabPage,
});

function MlTerrainLabPage() {
  const [activeTab, setActiveTab] = useState<"hf-models" | "jezero-surrogate">("hf-models");

  return (
    <div className="rise-in space-y-6">
      {/* Top AI System Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-2xl border border-line/70 bg-white/70 dark:bg-panel/70 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
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
            <span>Jezero HiRISE ML Surrogate</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-900/20 text-slate-900 font-normal">
              1m DTM
            </span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-fog pr-3">
          <Sparkles className="size-3.5 text-amber" />
          <span>NASA PDS HiRISE · CTX · THEMIS · MOLA Provenance</span>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === "hf-models" ? (
        <HfAiAnalysisPanel />
      ) : (
        <MlTerrainLab />
      )}
    </div>
  );
}
