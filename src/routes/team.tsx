import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, Database, Globe2, Mountain, Radio } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Project Team — MARS // SURVIVE" },
      { name: "description", content: "The people and work areas behind the MARS // SURVIVE Mars exploration project." },
    ],
  }),
  component: TeamPage,
});

const workAreas = [
  { title: "Mission design", description: "Scenario planning, Mars clock context, and crew survival workflows.", icon: Radio },
  { title: "Terrain and mapping", description: "Planetary map views, elevation context, and route planning tools.", icon: Globe2 },
  { title: "Data and AI prototypes", description: "Exploratory terrain analysis with clear limits on model claims.", icon: Database },
  { title: "Rover simulation", description: "A playable rover drive experience with controls and telemetry.", icon: Compass },
];

function TeamPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="rounded-3xl border border-line bg-panel/70 p-6 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[.2em] text-amber">NASA Space Apps Challenge 2026</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-bright sm:text-5xl">The project team</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-fog sm:text-base">
          MARS // SURVIVE brings together mission planning, planetary mapping, data exploration, and rover simulation in one Mars operations experience.
        </p>
      </header>

      <section aria-labelledby="work-areas-heading">
        <div className="mb-4 flex items-center gap-2">
          <Mountain className="size-5 text-amber" />
          <h2 id="work-areas-heading" className="font-display text-xl font-bold text-bright">What we built</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {workAreas.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-line bg-panel/50 p-5">
              <Icon className="size-5 text-cyan" aria-hidden="true" />
              <h3 className="mt-3 font-display font-semibold text-bright">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-fog">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/mission-lab" className="rounded-xl bg-amber px-4 py-2.5 font-display text-sm font-semibold text-ink hover:bg-amber/90">Explore the mission lab</Link>
        <Link to="/rover-game" className="rounded-xl border border-line px-4 py-2.5 font-display text-sm font-semibold text-bright hover:bg-panel">Play the rover expedition</Link>
      </div>
    </div>
  );
}
