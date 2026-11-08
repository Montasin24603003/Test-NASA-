import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Layers, ShieldAlert, Sparkles } from "lucide-react";

export const Route = createFileRoute("/hazard-layers")({
  head: () => ({
    meta: [
      { title: "Hazard Layers — Martian Map" },
      {
        name: "description",
        content:
          "Martian hazard overlay data — radiation flux zones, dust storm corridors, crater density, and thermal extremes mapped across candidate landing regions.",
      },
      { property: "og:title", content: "Hazard Layers — Martian Map" },
      {
        property: "og:description",
        content:
          "Martian hazard overlay data — radiation flux zones, dust storm corridors, crater density, and thermal extremes mapped across candidate landing regions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HazardLayersPage,
});

const hazards = [
  {
    name: "Radiation Flux",
    severity: "Elevated",
    severityColor: "text-rose",
    value: "0.67 mSv/d",
    range: "0.3 – 1.2 mSv/d",
    description:
      "Galactic cosmic rays and solar particle events deliver chronic radiation. Surface exposure limited to 2.5h per sol without shielding. 0.4m regolith or basalt overhang reduces dose by 75%.",
    layers: ["GCR baseline", "SPE event corridors", "Shield depth contours"],
  },
  {
    name: "Dust Storm Corridors",
    severity: "Active",
    severityColor: "text-amber",
    value: "3 days out",
    range: "Opacity 0.0 – 1.4",
    description:
      "Regional dust storms can last weeks and reduce solar output by up to 41%. Fine regolith (< 3µm) abrades seals and infiltrates intakes. Close vents and shelter when opacity exceeds 0.8.",
  },
  {
    name: "Crater Density",
    severity: "Moderate",
    severityColor: "text-amber",
    value: "12 per 100km²",
    range: "0 – 40 per 100km²",
    description:
      "Impact craters create both hazards (unstable terrain, ejecta fields) and opportunities (exposed subsurface strata). Low-density zones preferred for landing; high-density zones avoided for EVA routes.",
  },
  {
    name: "Thermal Extremes",
    severity: "Critical",
    severityColor: "text-rose",
    value: "−125 to 20 °C",
    range: "Diurnal swing ~80°C",
    description:
      "Equatorial surface temperatures swing dramatically between sol and night. Habitat thermal loop must preheat before dusk. Night operations require heated suit loops and sealed airlocks.",
  },
  {
    name: "Slope & Terrain",
    severity: "Low",
    severityColor: "text-mint",
    value: "< 5° mean",
    range: "0° – 35° local",
    description:
      "Landing zone slope under 5° ensures stable touchdown and rover traverse. Steep scarps and canyon walls flagged as no-go for uncrewed rover paths. Terrain roughness index mapped at 250m resolution.",
  },
  {
    name: "Seismic Activity",
    severity: "Low",
    severityColor: "text-mint",
    value: "M < 2.0 typical",
    range: "Up to M 4.0 (rare)",
    description:
      "InSight recorded ~1,300 marsquakes over 4 years. Most are minor; tectonic faults near Tharsis and Cerberus Fossae show higher activity. Habitat foundations designed for M 5.0 tolerance.",
  },
];

function HazardLayersPage() {
  return (
    <div className="rise-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-rose/15 text-rose">
              <ShieldAlert className="size-4" />
            </span>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-fog">
              Surface hazard overlays · Calibrated Mars Data
            </p>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance">
            Scientific Hazard Analysis
          </h1>
          <p className="mt-2 max-w-xl text-[14px] text-fog leading-relaxed">
            Multi-mission hazard intelligence combining MOLA laser altimetry slopes, Odyssey MARIE and MSL RAD
            ionizing radiation baselines, THEMIS night-time thermal inertia, and TES atmospheric dust opacity.
          </p>
        </div>

        <Link
          to="/planetary-map"
          className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2.5 font-display text-xs font-semibold text-ink shadow-sm transition hover:bg-amber/90"
        >
          <Layers className="size-3.5" /> Open on Planetary Map <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {hazards.map((h) => (
          <div
            key={h.name}
            className="rounded-xl border border-line/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-bright">{h.name}</h3>
                <span className={`font-mono text-[11px] font-bold ${h.severityColor}`}>{h.severity}</span>
              </div>
              <div className="mt-3 flex items-baseline gap-4">
                <p className="font-display text-2xl font-bold text-bright">{h.value}</p>
                <p className="font-mono text-[11px] text-fog">Range: {h.range}</p>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-fog">{h.description}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
              <span className="font-mono text-[10px] text-fog">Calibrated layer available on Map</span>
              <Link
                to="/planetary-map"
                className="font-mono text-[11px] font-semibold text-amber hover:underline inline-flex items-center gap-1"
              >
                Inspect layer →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
