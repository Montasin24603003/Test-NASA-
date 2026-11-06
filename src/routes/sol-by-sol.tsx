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
    <div className="rise-in space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-bright">
            Sol by Sol · Mars Survival Simulator
          </h1>
          <p className="mt-0.5 text-xs text-fog">
            500-Sol expedition survival simulator with life-support telemetry, resource allocation, and AI advisor assistance.
          </p>
        </div>

        <a
          href="/sol-simulator/index.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white/80 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fog hover:text-bright shadow-xs"
        >
          <ExternalLink className="size-3.5" />
          Open Standalone
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line/70 bg-[#f3ece4] shadow-2xl">
        <iframe
          title="Sol by Sol Mars Survival Simulator"
          src="/sol-simulator/index.html"
          className="block h-[min(1100px,calc(100vh-180px))] min-h-[840px] w-full border-0"
          loading="eager"
        />
      </div>

      <div className="flex items-center gap-2 font-mono text-[10px] text-fog">
        <Radio className="size-3.5 text-mint" />
        NASA DONKI live refresh remains active; bundled mission ephemeris stays calibrated when offline.
      </div>
    </div>
  );
}
