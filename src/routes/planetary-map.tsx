import { createFileRoute } from "@tanstack/react-router";
import { MarsCockpit } from "@/components/MarsWorldview/MarsCockpit";

export const Route = createFileRoute("/planetary-map")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Planetary Map — Mars Trek GIS & Hazard Analysis // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Full-scale NASA-grade planetary exploration workspace featuring live Mars Trek WMTS tiles, 2D/3D Three.js globe, SWIM 2.0 subsurface water ice, multimodal hazard analysis, distance measurement, and safe mission route planning.",
      },
      { property: "og:title", content: "Planetary Map — Mars Trek GIS" },
      {
        property: "og:description",
        content:
          "Interactive 2D & 3D Mars exploration workspace with real NASA Mars Trek imagery, SWIM 2.0 subsurface ice, and scientific hazard layers.",
      },
    ],
  }),
  component: PlanetaryMapPage,
});

function PlanetaryMapPage() {
  return (
    <div className="w-full h-screen overflow-hidden">
      <MarsCockpit />
    </div>
  );
}
