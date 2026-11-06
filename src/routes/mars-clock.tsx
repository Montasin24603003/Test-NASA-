import { createFileRoute } from "@tanstack/react-router";
import { MarsClockCompassDashboard } from "@/components/MarsClockCompass/MarsClockCompassDashboard";

export const Route = createFileRoute("/mars-clock")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mars Clock & 3D Compass // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "High-precision Mars Local Solar Time chronometer (Allison-McEwen 2000) and interactive 3D planetary compass for Martian navigation.",
      },
    ],
  }),
  component: MarsClockRoute,
});

function MarsClockRoute() {
  return (
    <div className="py-2">
      <MarsClockCompassDashboard />
    </div>
  );
}
