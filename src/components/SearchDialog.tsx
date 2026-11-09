import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  Layers,
  Cpu,
  ShieldAlert,
  Sparkles,
  Box,
  Compass,
  Timer,
  MapPin,
  Database,
  ArrowRight,
  X,
  Command,
} from "lucide-react";
import { marsSites } from "@/data/marsSites";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

const SEARCHABLE_MODULES = [
  {
    title: "Planetary Map",
    category: "Mission Workspace",
    description: "2D/3D Mars Trek WMTS GIS with live layer opacity and A* route planning.",
    to: "/planetary-map",
    icon: Layers,
    color: "text-amber",
  },
  {
    title: "ML Terrain Lab",
    category: "AI & Neural Vision",
    description: "1m Jezero HiRISE ML surrogate and 7 Hugging Face foundation models.",
    to: "/ml-terrain-lab",
    icon: Cpu,
    color: "text-indigo-400",
  },
  {
    title: "Hazard Analysis",
    category: "Risk Intelligence",
    description: "Radiation flux, slope stability (>10°), thermal shock, and dust corridors.",
    to: "/hazard-layers",
    icon: ShieldAlert,
    color: "text-rose",
  },
  {
    title: "Resource Explorer",
    category: "ISRU & Materials",
    description: "SWIM 2.0 subsurface water ice radar maps and consumable budget calculator.",
    to: "/resources",
    icon: Sparkles,
    color: "text-cyan",
  },
  {
    title: "3D Regional Lab",
    category: "Regional 3D Meshes",
    description: "Interactive 3D elevation models of 14 iconic Martian regions.",
    to: "/mission-lab",
    icon: Box,
    color: "text-amber",
  },
  {
    title: "Rover Expedition",
    category: "Surface Robotics",
    description: "6-wheel rocker-bogie terramechanics simulation with SuperCam LIBS laser.",
    to: "/rover-game",
    icon: Compass,
    color: "text-mint",
  },
  {
    title: "Sol by Sol",
    category: "Survival Simulator",
    description: "500-Sol expedition survival simulator with NASA DONKI space weather.",
    to: "/sol-by-sol",
    icon: Timer,
    color: "text-mint",
  },
  {
    title: "Clock & Compass",
    category: "Ephemeris Tool",
    description: "Local Solar Time (LMST), Sun elevation, and true north orientation.",
    to: "/mars-clock",
    icon: Compass,
    color: "text-amber",
  },
];

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const cleanQuery = query.toLowerCase().trim();

  const filteredModules = SEARCHABLE_MODULES.filter(
    (m) =>
      !cleanQuery ||
      m.title.toLowerCase().includes(cleanQuery) ||
      m.category.toLowerCase().includes(cleanQuery) ||
      m.description.toLowerCase().includes(cleanQuery)
  );

  const filteredSites = marsSites.filter(
    (s) =>
      !cleanQuery ||
      s.name.toLowerCase().includes(cleanQuery) ||
      s.region.toLowerCase().includes(cleanQuery) ||
      s.significance.toLowerCase().includes(cleanQuery) ||
      s.terrain.toLowerCase().includes(cleanQuery)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-line/80 bg-white/95 dark:bg-[#070c16]/95 shadow-2xl backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3.5">
          <Search className="size-5 text-amber shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Mars modules, landing sites, hazard layers, or NASA data..."
            className="w-full bg-transparent font-mono text-sm text-bright placeholder:text-fog focus:outline-none"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-fog hover:text-bright"
            >
              <X className="size-4" />
            </button>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-line bg-ink2/50 px-2 py-0.5 font-mono text-[10px] text-fog">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
          {/* Mission Modules Section */}
          {filteredModules.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-fog mb-2 px-2">
                Mission Modules ({filteredModules.length})
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {filteredModules.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      to={item.to}
                      onClick={onClose}
                      className="group flex items-center justify-between gap-3 p-3 rounded-2xl border border-line/50 hover:border-amber/40 hover:bg-amber/5 transition-all text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-ink2/60 border border-line/60 shrink-0">
                          <Icon className={`size-4 ${item.color}`} />
                        </div>
                        <div className="min-w-0">
                          <strong className="font-display text-xs font-bold text-bright group-hover:text-amber block truncate">
                            {item.title}
                          </strong>
                          <span className="font-mono text-[10px] text-fog block truncate">
                            {item.category}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="size-3.5 text-fog group-hover:text-amber group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Surveyed Mars Sites Section */}
          {filteredSites.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-fog mb-2 px-2">
                Indexed Surface Sectors &amp; Craters ({filteredSites.length})
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {filteredSites.slice(0, 6).map((site) => (
                  <Link
                    key={site.id}
                    to="/planetary-map"
                    onClick={onClose}
                    className="group flex items-center justify-between gap-3 p-3 rounded-2xl border border-line/50 hover:border-mint/40 hover:bg-mint/5 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-ink2/60 border border-line/60 shrink-0">
                        <MapPin className="size-4 text-mint" />
                      </div>
                      <div className="min-w-0">
                        <strong className="font-display text-xs font-bold text-bright group-hover:text-mint block truncate">
                          {site.name}
                        </strong>
                        <span className="font-mono text-[10px] text-fog block truncate">
                          {site.latitude.toFixed(1)}°N, {site.longitude.toFixed(1)}°E · Elev: {site.elevation}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="size-3.5 text-fog group-hover:text-mint group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {filteredModules.length === 0 && filteredSites.length === 0 && (
            <div className="py-12 text-center font-mono">
              <Search className="size-8 text-fog mx-auto mb-2 opacity-50" />
              <p className="text-sm text-bright font-bold">No telemetry records match "{query}"</p>
              <p className="text-xs text-fog mt-1">Try searching for "Jezero", "Ice", "Radiation", or "Rover"</p>
            </div>
          )}
        </div>

        {/* Footer Shortcut Helper */}
        <div className="flex items-center justify-between border-t border-line/70 px-4 py-2.5 bg-panel/60 font-mono text-[10px] text-fog">
          <span>MARS // SURVIVE · Planetary Navigation Index</span>
          <span className="hidden sm:inline">Press ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
}
