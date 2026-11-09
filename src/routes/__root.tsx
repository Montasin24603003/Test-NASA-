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
import { Moon, Sun, Search, Sparkles } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { calculateMarsTime } from "../lib/mars-time";
import { SearchDialog } from "../components/SearchDialog";

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
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("mars-theme");
    const shouldUseDark = saved !== "light";
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
      className="theme-toggle inline-flex h-8 items-center gap-1.5 rounded-xl border border-line/80 bg-panel/80 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-bright shadow-sm transition-all hover:border-amber/40 backdrop-blur-xl"
    >
      {dark ? <Sun className="size-3.5 text-amber" /> : <Moon className="size-3.5 text-cyan" />}
      <span className="hidden xl:inline">{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

function SiteLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isMissionLab = location.pathname === "/mission-lab";
  const isPlanetaryMap = location.pathname === "/planetary-map";
  const isFullBleed = isMissionLab;
  const [searchOpen, setSearchOpen] = useState(false);

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
      {/* Deep Space Atmosphere Background Gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_70%_-10%,rgba(234,88,12,.08)_0%,transparent_52%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_80%_at_20%_110%,rgba(6,182,212,.05)_0%,transparent_48%)]" />
      <div
        className="grid-drift pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,140,180,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(100,140,180,.04) 1px,transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* A. PREMIUM NASA NAVIGATION BAR */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 dark:bg-[#070c16]/90 shadow-xl backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          {/* Logo & NASA Space Apps Badge */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="grid size-8 place-items-center rounded-xl border border-amber/40 bg-amber/15 shadow-sm group-hover:scale-105 transition-transform">
              <span className="beacon-dot size-2.5 rounded-full bg-amber shadow-lg shadow-amber/50" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="font-display text-sm font-bold tracking-tight text-bright group-hover:text-amber transition-colors">
                  MARS // SURVIVE
                </p>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-amber/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber border border-amber/30">
                  NASA 2026
                </span>
              </div>
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-fog">
                Interplanetary Survival Guide
              </p>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden items-center gap-0.5 rounded-2xl border border-line/80 bg-panel/80 p-1 shadow-sm backdrop-blur-xl lg:flex">
            <Link
              to="/"
              className="rounded-xl px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fog hover:text-bright hover:bg-ink2 transition-colors"
              activeProps={{ className: "rounded-xl bg-amber/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-amber border border-amber/30" }}
            >
              Home
            </Link>
            <Link
              to="/planetary-map"
              className="rounded-xl px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fog hover:text-bright hover:bg-ink2 transition-colors"
              activeProps={{ className: "rounded-xl bg-amber/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-amber border border-amber/30" }}
            >
              Planetary Map
            </Link>
            <Link
              to="/ml-terrain-lab"
              className="rounded-xl px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fog hover:text-bright hover:bg-indigo-500/10 transition-colors"
              activeProps={{ className: "rounded-xl bg-indigo-500/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-indigo-400 border border-indigo-500/30" }}
            >
              ML Terrain Lab
            </Link>
            <Link
              to="/hazard-layers"
              className="rounded-xl px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fog hover:text-bright hover:bg-rose/10 transition-colors"
              activeProps={{ className: "rounded-xl bg-rose/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-rose border border-rose/30" }}
            >
              Hazard Analysis
            </Link>
            <Link
              to="/resources"
              className="rounded-xl px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fog hover:text-bright hover:bg-cyan/10 transition-colors"
              activeProps={{ className: "rounded-xl bg-cyan/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-cyan border border-cyan/30" }}
            >
              Resource Explorer
            </Link>
            <Link
              to="/mission-lab"
              className="rounded-xl px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fog hover:text-bright hover:bg-amber/10 transition-colors"
              activeProps={{ className: "rounded-xl bg-amber/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-amber border border-amber/30" }}
            >
              3D Regional Lab
            </Link>
            <Link
              to="/rover-game"
              className="rounded-xl px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fog hover:text-bright hover:bg-mint/10 transition-colors"
              activeProps={{ className: "rounded-xl bg-mint/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-mint border border-mint/30" }}
            >
              Rover Expedition
            </Link>
            <Link
              to="/sol-by-sol"
              className="rounded-xl px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fog hover:text-bright hover:bg-mint/10 transition-colors"
              activeProps={{ className: "rounded-xl bg-mint/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-mint border border-mint/30" }}
            >
              Sol by Sol
            </Link>
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2">
            {/* Quick Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-line/80 bg-panel/80 px-2.5 py-1.5 font-mono text-[10px] text-fog hover:text-bright hover:border-amber/40 transition-all shadow-sm backdrop-blur-xl"
              title="Search Mars Platform (⌘K / Ctrl+K)"
            >
              <Search className="size-3.5 text-amber" />
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden sm:inline-flex items-center rounded bg-ink2/60 px-1.5 py-0.2 font-mono text-[9px] text-fog border border-line/60">
                ⌘K
              </kbd>
            </button>

            {/* NASA Data Attribution Badge */}
            <span className="hidden xl:inline-flex items-center gap-1.5 rounded-xl border border-mint/30 bg-mint/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-mint">
              <span className="size-1.5 rounded-full bg-mint animate-pulse" />
              NASA PDS &amp; Trek
            </span>

            {/* Mars Clock Navigation Button */}
            <MarsClockNavButton />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Direct Planetary Map CTA */}
            <Link
              to="/planetary-map"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-amber hover:bg-amber/90 px-3.5 py-1.5 font-display text-xs font-bold text-ink shadow-sm transition-all"
            >
              <span>Open Map</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Links */}
      <div className="sticky top-[53px] z-30 border-b border-line/70 bg-panel/85 px-4 py-1.5 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-medium whitespace-nowrap scrollbar-none">
          <Link to="/" activeProps={{ className: "bg-amber/15 text-amber font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">Home</Link>
          <Link to="/planetary-map" activeProps={{ className: "bg-amber/15 text-amber font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">Planetary Map</Link>
          <Link to="/rover-game" activeProps={{ className: "bg-mint/15 text-mint font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">Rover 3D</Link>
          <Link to="/ml-terrain-lab" activeProps={{ className: "bg-indigo-500/15 text-indigo-400 font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">ML AI Lab</Link>
          <Link to="/hazard-layers" activeProps={{ className: "bg-rose/15 text-rose font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">Hazards</Link>
          <Link to="/resources" activeProps={{ className: "bg-cyan/15 text-cyan font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">Resources</Link>
          <Link to="/mission-lab" activeProps={{ className: "bg-amber/15 text-amber font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">3D Lab</Link>
          <Link to="/sol-by-sol" activeProps={{ className: "bg-mint/15 text-mint font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">Sol by Sol</Link>
          <Link to="/mars-clock" activeProps={{ className: "bg-amber/15 text-amber font-bold" }} className="rounded-lg px-2.5 py-1 text-fog hover:text-bright">Clock</Link>
        </div>
      </div>

      {/* Main Content Area */}
      <main className={`relative z-10 ${isFullBleed ? "w-full" : "mx-auto max-w-[1480px] px-4 py-8 sm:px-6"}`}>
        {children}
      </main>

      {/* Interactive Global Search Palette */}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* NASA Platform Aerospace Footer */}
      <footer className="relative z-10 border-t border-line/70 bg-white/90 dark:bg-[#070c16]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 font-mono text-[11px] text-fog">
            <span className="size-2 rounded-full bg-amber" />
            <strong className="text-bright font-bold">MARS // SURVIVE</strong>
            <span>· NASA Space Apps Challenge 2026</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] text-fog">
            <span>NASA Planetary Data System (PDS)</span>
            <span>Mars Trek WMTS</span>
            <span>SWIM 2.0 Subsurface Ice</span>
            <span>MSL RAD &amp; MEDA Calibrated</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
