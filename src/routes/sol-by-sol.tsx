import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sol-by-sol")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sol by Sol — Mars Survival Simulator // NASA Space Apps 2026" },
      {
        name: "description",
        content:
          "Full-screen Mars expedition life-support simulator with daily ECLSS resource allocation, solar dust storm survival, space radiation mitigation, and AI Mission Advisor.",
      },
    ],
  }),
  component: SolBySolPage,
});

function SolBySolPage() {
  return (
    <div className="w-full h-full overflow-hidden bg-[#05080f] p-0 m-0">
      <iframe
        title="Sol by Sol Mars Survival Simulator"
        src="/sol-simulator/index.html"
        className="w-full h-full border-0 block p-0 m-0"
        loading="eager"
      />
    </div>
  );
}
