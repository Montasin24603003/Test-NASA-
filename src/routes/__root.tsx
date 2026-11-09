import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { calculateMarsTime } from "../lib/mars-time";

function MarsClockNavButton() {
  const [solTime, setSolTime] = useState<{ sol: number; lst: string } | null>(null);

  useEffect(() => {
    const update = () => {
      // Jezero Crater (77.58°E, 18.38°N) standard mission baseline
      const data = calculateMarsTime(new Date(), 77.58, 18.38);
      setSolTime({ sol: data.solNumber, lst: data.ltstFormatted });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      to="/mars-clock"
      title="Open Mars Clock & 3D Compass"
      className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-amber/40 sm:flex"
      activeProps={{ className: "border-amber bg-amber/10 text-bright font-medium" }}
    >
      <span className="beacon-dot size-1.5 rounded-full bg-mint" />
      <span className="font-mono text-[11px] text-fog transition-colors hover:text-bright">
        {solTime ? `SOL ${solTime.sol} · ${solTime.lst} LST` : "SOL 214 · 06:42 LST"}
      </span>
    </Link>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-bright">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-bright">Signal lost</h2>
        <p className="mt-2 font-mono text-sm text-fog">
          The waypoint you're looking for is outside the survey grid.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-amber px-4 py-2 font-display text-sm font-semibold text-ink transition-colors hover:bg-amber/90"
          >
            Return to console
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-bright">
          Telemetry interrupted
        </h1>
        <p className="mt-2 font-mono text-sm text-fog">
          Something failed on our end. You can retry or head back to the console.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-amber px-4 py-2 font-display text-sm font-semibold text-ink transition-colors hover:bg-amber/90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-line bg-panel/40 px-4 py-2 font-display text-sm text-fog transition-colors hover:text-bright"
          >
            Return to console
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Mars // Survive" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SiteLayout>
        <Outlet />
      </SiteLayout>
    </QueryClientProvider>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mars-theme");
    const shouldUseDark = saved === "dark";
    setDark(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    localStorage.setItem("mars-theme", nextDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", nextDark);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="theme-toggle inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-bright shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {dark ? <Sun className="size-4 text-amber" /> : <Moon className="size-4 text-cyan" />}
      <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

function SiteLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isMissionLab = location.pathname === "/mission-lab";
  const isPlanetaryMap = location.pathname === "/planetary-map";
  const isFullBleed = isMissionLab;

  // On Planetary Map, provide a full-bleed mission workspace with no global site header or footer
  if (isPlanetaryMap) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#05080f] text-slate-200">
        <main className="w-full h-full overflow-hidden p-0 m-0">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-bright">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_70%_-10%,rgba(247,185,86,.10)_0%,transparent_48%)]" />
      <div
        className="grid-drift pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(40,60,80,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(40,60,80,.045) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <header className="relative z-10 border-b border-line bg-white/85 shadow-[0_4px_20px_rgba(30,45,65,.05)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl border border-amber/30 bg-amber/10 shadow-sm">
              <span className="beacon-dot size-3 rounded-full bg-amber" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold tracking-tight text-bright">
                MARS // SURVIVE
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                Interplanetary Survival Guide · NASA Space Apps 2026
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 rounded-2xl border border-line/80 bg-panel/70 p-1.5 shadow-sm backdrop-blur-xl md:flex">
            <Link
              to="/planetary-map"
              className="rounded-xl px-3 py-2 transition-colors hover:bg-ink2 hover:text-bright"
              activeProps={{ className: "rounded-xl bg-amber/10 px-3 py-2 font-medium text-bright" }}
            >
              Planetary Map
            </Link>
            <Link
              to="/rover-game"
              className="rounded-xl px-3 py-2 transition-colors hover:bg-amber/10 hover:text-bright"
              activeProps={{ className: "rounded-xl bg-amber/10 px-3 py-2 font-medium text-bright" }}
            >
              Rover Expedition
            </Link>
            <Link to="/ml-terrain-lab" className="rounded-xl px-3 py-2 transition-colors hover:bg-indigo-500/10 hover:text-bright" activeProps={{ className: "rounded-xl bg-indigo-500/15 px-3 py-2 font-medium text-bright" }}>
              ML Terrain Lab
            </Link>
            <Link to="/hazard-layers" className="rounded-xl px-3 py-2 transition-colors hover:bg-ink2 hover:text-bright" activeProps={{ className: "rounded-xl bg-rose/10 px-3 py-2 font-medium text-bright" }}>
              Hazard Analysis
            </Link>
            <Link to="/resources" className="rounded-xl px-3 py-2 transition-colors hover:bg-ink2 hover:text-bright" activeProps={{ className: "rounded-xl bg-cyan/10 px-3 py-2 font-medium text-bright" }}>
              Resource Explorer
            </Link>
            <Link to="/mission-lab" className="rounded-xl px-3 py-2 transition-colors hover:bg-amber/10 hover:text-bright" activeProps={{ className: "rounded-xl bg-amber/10 px-3 py-2 font-medium text-bright" }}>
              3D Regional Lab
            </Link>
            <Link to="/sol-by-sol" className="rounded-xl px-3 py-2 transition-colors hover:bg-mint/10 hover:text-bright" activeProps={{ className: "rounded-xl bg-mint/10 px-3 py-2 font-medium text-bright" }}>
              Sol by Sol
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <MarsClockNavButton />
            <ThemeToggle />
            <Link
              to="/planetary-map"
              className="rounded-md bg-amber px-4 py-2 font-display text-[13px] font-semibold text-ink transition-colors hover:bg-amber/90"
            >
              Open Map
            </Link>
          </div>
        </div>
      </header>
      <div className="relative z-10 border-b border-line/70 bg-panel/70 px-5 py-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto pb-0.5 text-[11px] font-medium whitespace-nowrap">
          <Link to="/planetary-map" activeProps={{ className: "bg-amber/10 text-bright" }} className="rounded-lg px-3 py-1.5 text-fog">Planetary Map</Link>
          <Link to="/rover-game" activeProps={{ className: "bg-amber/10 text-bright" }} className="rounded-lg px-3 py-1.5 text-fog">Rover 3D</Link>
          <Link to="/ml-terrain-lab" activeProps={{ className: "bg-indigo-500/15 text-bright" }} className="rounded-lg px-3 py-1.5 text-fog">ML Terrain Lab</Link>
          <Link to="/hazard-layers" activeProps={{ className: "bg-rose/10 text-bright" }} className="rounded-lg px-3 py-1.5 text-fog">Hazards</Link>
          <Link to="/resources" activeProps={{ className: "bg-cyan/10 text-bright" }} className="rounded-lg px-3 py-1.5 text-fog">Resources</Link>
          <Link to="/mission-lab" activeProps={{ className: "bg-amber/10 text-bright" }} className="rounded-lg px-3 py-1.5 text-fog">3D Lab</Link>
          <Link to="/sol-by-sol" activeProps={{ className: "bg-mint/10 text-bright" }} className="rounded-lg px-3 py-1.5 text-fog">Sol by Sol</Link>
          <Link to="/mars-clock" activeProps={{ className: "bg-amber/10 text-bright" }} className="rounded-lg px-3 py-1.5 text-fog">Clock &amp; Compass</Link>
        </div>
      </div>

      <main className={`relative z-10 ${isFullBleed ? "w-full" : "mx-auto max-w-7xl px-5 py-8"}`}>{children}</main>

      <footer className="relative z-10 border-t border-line bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-4 sm:flex-row">
          <p className="font-mono text-[11px] text-fog">
            MARS // SURVIVE · Interplanetary Survival Guide
          </p>
          <p className="font-mono text-[11px] text-fog">
            NASA archive provenance · planning sandbox · demo-ready
          </p>
        </div>
      </footer>
    </div>
  );
}
