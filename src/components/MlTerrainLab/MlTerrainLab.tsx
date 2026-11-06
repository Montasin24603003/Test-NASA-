import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Box,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  Eye,
  Layers,
  MapPin,
  Maximize2,
  Route as RouteIcon,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import jezeroData from "@/data/jezero_data.json";

type LayerMode = "dem" | "ml" | "haz" | "cl" | "slope";

export function MlTerrainLab() {
  const [activeLayer, setActiveLayer] = useState<LayerMode>("ml");
  const [showShortRoute, setShowShortRoute] = useState(true);
  const [showTrueRoute, setShowTrueRoute] = useState(true);
  const [showMlRoute, setShowMlRoute] = useState(true);
  const [hoverPixel, setHoverPixel] = useState<{ r: number; c: number } | null>(null);
  const [showEmbedded3D, setShowEmbedded3D] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Decode base64 uint8 arrays for the 128x128 rasters
  const rasters = React.useMemo(() => {
    const decode = (b64: string): Uint8Array => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
      }
      return arr;
    };

    return {
      dem: decode(jezeroData.dem),
      ml: decode(jezeroData.ml),
      haz: decode(jezeroData.haz),
      cl: decode(jezeroData.cl),
      slope: decode(jezeroData.slope),
    };
  }, []);

  // Draw the selected raster layer and route overlays onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const n = jezeroData.n; // 128
    const imgData = ctx.createImageData(n, n);
    const data = imgData.data;
    const currentArray = rasters[activeLayer];

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const idx = r * n + c;
        const val = currentArray[idx] ?? 0;
        const pIdx = idx * 4;

        if (activeLayer === "dem") {
          // Elevation color ramp (deep Martian basalt to high rim)
          const norm = val / 255;
          data[pIdx] = Math.round(50 + 190 * norm); // R
          data[pIdx + 1] = Math.round(25 + 130 * norm); // G
          data[pIdx + 2] = Math.round(20 + 80 * norm); // B
          data[pIdx + 3] = 255;
        } else if (activeLayer === "ml" || activeLayer === "haz") {
          // Hazard color ramp: Green (safe 0.0) -> Yellow (moderate 0.5) -> Red (extreme 1.0)
          const norm = val / 255;
          if (norm < 0.33) {
            // Safe plain (Green to Teal)
            data[pIdx] = Math.round(20 + 40 * (norm / 0.33));
            data[pIdx + 1] = Math.round(180 + 40 * (norm / 0.33));
            data[pIdx + 2] = Math.round(120);
          } else if (norm < 0.66) {
            // Moderate slope (Yellow / Amber)
            const t = (norm - 0.33) / 0.33;
            data[pIdx] = Math.round(240);
            data[pIdx + 1] = Math.round(180 - 60 * t);
            data[pIdx + 2] = Math.round(30);
          } else {
            // Extreme scarp / hazard (Crimson Red)
            const t = (norm - 0.66) / 0.34;
            data[pIdx] = Math.round(220 + 35 * t);
            data[pIdx + 1] = Math.round(40 * (1 - t));
            data[pIdx + 2] = Math.round(40 * (1 - t));
          }
          data[pIdx + 3] = 255;
        } else if (activeLayer === "cl") {
          // K-Means clusters: 0 (Plain), 1 (Undulation), 2 (Scarp), 3 (Rim)
          const colors = [
            [46, 204, 113], // 0: Safe Plain (Emerald)
            [52, 152, 219], // 1: Low Undulation (Cyan/Blue)
            [243, 156, 18], // 2: Moderate Slope (Amber)
            [231, 76, 60], // 3: Extreme Rim (Red)
          ];
          const col = colors[val] ?? [150, 150, 150];
          data[pIdx] = col[0] ?? 150;
          data[pIdx + 1] = col[1] ?? 150;
          data[pIdx + 2] = col[2] ?? 150;
          data[pIdx + 3] = 255;
        } else if (activeLayer === "slope") {
          // Slope degrees: 0° (black) to 15°+ (white)
          data[pIdx] = val;
          data[pIdx + 1] = val;
          data[pIdx + 2] = val;
          data[pIdx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw Routes on canvas overlay
    const drawRoute = (pts: number[][], color: string, lineWidth: number, isDashed = false) => {
      if (!pts || pts.length < 2) return;
      ctx.beginPath();
      if (isDashed) ctx.setLineDash([2, 2]);
      else ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (!pt) continue;
        const [r, c] = pt;
        if (r === undefined || c === undefined) continue;
        if (i === 0) ctx.moveTo(c, r);
        else ctx.lineTo(c, r);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    if (showShortRoute) {
      drawRoute(jezeroData.routes.short, "#dc2626", 1.8, true); // Shortest: Red Dashed
    }
    if (showTrueRoute) {
      drawRoute(jezeroData.routes.true, "#f59e0b", 2.2); // True Risk-Aware: Amber
    }
    if (showMlRoute) {
      drawRoute(jezeroData.routes.ml, "#06b6d4", 2.2); // ML Predicted Route: Cyan
    }

    // Draw Start & Goal markers
    const sr = jezeroData.start[0] ?? 0;
    const sc = jezeroData.start[1] ?? 0;
    const gr = jezeroData.goal[0] ?? 0;
    const gc = jezeroData.goal[1] ?? 0;

    // Start: Green dot
    ctx.beginPath();
    ctx.arc(sc, sr, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#10b981";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // Goal: Star / Blue dot
    ctx.beginPath();
    ctx.arc(gc, gr, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }, [activeLayer, showShortRoute, showTrueRoute, showMlRoute, rasters]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 128 / rect.width;
    const scaleY = 128 / rect.height;
    const c = Math.floor((e.clientX - rect.left) * scaleX);
    const r = Math.floor((e.clientY - rect.top) * scaleY);
    if (r >= 0 && r < 128 && c >= 0 && c < 128) {
      setHoverPixel({ r, c });
    }
  };

  const getHoverMetrics = () => {
    if (!hoverPixel) return null;
    const idx = hoverPixel.r * 128 + hoverPixel.c;
    const demVal = (rasters.dem[idx] ?? 0) / 255;
    const elev = jezeroData.hmin + demVal * (jezeroData.hmax - jezeroData.hmin);
    const hazVal = ((rasters.haz[idx] ?? 0) / 255).toFixed(2);
    const mlVal = ((rasters.ml[idx] ?? 0) / 255).toFixed(2);
    const clVal = rasters.cl[idx] ?? 0;
    const slopeVal = (((rasters.slope[idx] ?? 0) / 255) * 15).toFixed(1);
    const clusterLabels = ["Safe Plain", "Moderate Slope", "Rough Terrain", "Extreme Hazard"];

    return {
      elev: elev.toFixed(1),
      hazVal,
      mlVal,
      slopeVal,
      cluster: clusterLabels[clVal] ?? "Unknown",
    };
  };

  const hoverData = getHoverMetrics();

  return (
    <div className="space-y-6 rise-in">
      {/* Top Header Banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/25 bg-cyan/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan">
              <BrainCircuit className="size-3" /> HistGradientBoosting + K-Means
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mint">
              <span className="size-1.5 rounded-full bg-mint animate-pulse" /> HiRISE 1m DTM
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-bright sm:text-3xl">
            Jezero Crater ML Terrain &amp; Hazard Model
          </h1>
          <p className="mt-1 text-xs text-fog max-w-2xl">
            Trained gradient-boosted regression surrogate predicting surface traversal hazards directly
            from elevation derivatives, paired with unsupervised K-Means terrain clustering and Dijkstra route optimization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/ml-terrain-lab/index.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2.5 font-display text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-amber/90"
          >
            <Maximize2 className="size-3.5" /> Launch Full 3D Lab
          </a>
          <button
            type="button"
            onClick={() => setShowEmbedded3D(!showEmbedded3D)}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 font-display text-xs font-semibold text-bright shadow-xs transition-colors hover:bg-ink2"
          >
            <Box className="size-3.5 text-cyan" />
            {showEmbedded3D ? "Hide 3D View" : "Embed 3D View"}
          </button>
        </div>
      </div>

      {/* Embedded 3D View (If toggled) */}
      {showEmbedded3D && (
        <div className="overflow-hidden rounded-2xl border border-line/80 bg-[#0b0807] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/80">
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber">
              WebGL 3D Jezero Elevation Mesh &amp; Rover Traversal
            </span>
            <button
              type="button"
              onClick={() => setShowEmbedded3D(false)}
              className="text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
          <iframe
            src="/ml-terrain-lab/index.html"
            title="3D Jezero Terrain Lab"
            className="h-[540px] w-full border-0"
          />
        </div>
      )}

      {/* Main Grid: Interactive Raster View & Model Metrics */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive 128x128 Raster Canvas (7 Cols) */}
        <div className="rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-6 lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 pb-3">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan">
                  Interactive Grid Canvas (128 × 128)
                </p>
                <h2 className="font-display text-lg font-bold text-bright">
                  Jezero Delta Surface Raster
                </h2>
              </div>

              {/* Layer Selection Pills */}
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-ink2/70 p-1">
                {(
                  [
                    { id: "ml", label: "ML Hazard", color: "text-cyan" },
                    { id: "haz", label: "True Hazard", color: "text-rose" },
                    { id: "dem", label: "Elevation", color: "text-amber" },
                    { id: "cl", label: "K-Means", color: "text-mint" },
                    { id: "slope", label: "Slope", color: "text-bright" },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setActiveLayer(l.id)}
                    className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold transition-all ${
                      activeLayer === l.id
                        ? "bg-white text-bright shadow-xs font-bold"
                        : "text-fog hover:text-bright"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas Viewport and Hover Inspector */}
            <div className="mt-4 flex flex-col items-center">
              <div className="relative aspect-square w-full max-w-[360px] overflow-hidden rounded-xl border-2 border-line bg-black shadow-md cursor-crosshair">
                <canvas
                  ref={canvasRef}
                  width={128}
                  height={128}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setHoverPixel(null)}
                  className="size-full image-rendering-pixelated"
                />

                {/* Canvas Overlay Legend */}
                <div className="absolute left-2 top-2 rounded-lg border border-black/40 bg-black/60 px-2 py-1 font-mono text-[9px] text-white/90 backdrop-blur-md">
                  Active: <strong className="text-amber uppercase">{activeLayer}</strong> · 1m HiRISE
                </div>

                <div className="absolute right-2 top-2 rounded-lg border border-black/40 bg-black/60 px-2 py-1 font-mono text-[9px] text-white/90 backdrop-blur-md">
                  Green: Start · Blue: Goal
                </div>
              </div>

              {/* Hover Coordinates Telemetry */}
              <div className="mt-3 w-full max-w-[360px] rounded-xl border border-line bg-panel p-2.5 text-xs font-mono">
                {hoverData ? (
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-fog">Elevation: </span>
                      <strong className="text-bright">{hoverData.elev} m</strong>
                    </div>
                    <div>
                      <span className="text-fog">Slope: </span>
                      <strong className="text-bright">{hoverData.slopeVal}°</strong>
                    </div>
                    <div>
                      <span className="text-fog">True Hazard: </span>
                      <strong className="text-rose">{hoverData.hazVal}</strong>
                    </div>
                    <div>
                      <span className="text-fog">ML Predicted: </span>
                      <strong className="text-cyan">{hoverData.mlVal}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-[10px] text-fog">
                    Hover cursor over map to inspect terrain &amp; hazard values
                  </p>
                )}
              </div>
            </div>

            {/* Route Overlay Toggles */}
            <div className="mt-4 border-t border-line/70 pt-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-fog">
                Compare Path Traversal Algorithms:
              </span>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowShortRoute(!showShortRoute)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                    showShortRoute
                      ? "border-rose/40 bg-rose/10 text-rose font-bold"
                      : "border-line bg-white text-fog"
                  }`}
                >
                  <span className="size-2 rounded-full bg-rose" />
                  Shortest Dijkstra (Cost: 782.5)
                </button>
                <button
                  type="button"
                  onClick={() => setShowTrueRoute(!showTrueRoute)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                    showTrueRoute
                      ? "border-amber/40 bg-amber/10 text-amber font-bold"
                      : "border-line bg-white text-fog"
                  }`}
                >
                  <span className="size-2 rounded-full bg-amber" />
                  True Risk-Aware (Cost: 559.0)
                </button>
                <button
                  type="button"
                  onClick={() => setShowMlRoute(!showMlRoute)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                    showMlRoute
                      ? "border-cyan/40 bg-cyan/10 text-cyan font-bold"
                      : "border-line bg-white text-fog"
                  }`}
                >
                  <span className="size-2 rounded-full bg-cyan" />
                  ML Risk-Aware (Cost: 559.8)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-mint/20 bg-mint/[0.05] p-3 text-[11px] leading-relaxed text-fog">
            <strong className="text-mint">Key ML Route Finding:</strong> Planning on the ML hazard surrogate
            yields a path with virtually identical safety (<strong className="text-bright">559.8</strong> vs <strong className="text-bright">559.0</strong>),
            saving <strong>28.6% of risk-weighted cost</strong> compared to standard shortest-distance Dijkstra.
          </div>
        </div>

        {/* Right Column: Model Metrics, Feature Importance & Clusters (5 Cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Metrics Card */}
          <div className="rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-line/70 pb-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
                <Activity className="size-4" />
              </span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan">Cross-Validation</p>
                <h3 className="font-display text-base font-bold text-bright">Model Performance</h3>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-center">
              <div className="rounded-xl border border-line bg-ink2/50 p-3">
                <p className="text-[9px] uppercase tracking-wider text-fog">Variance Explained</p>
                <p className="mt-1 text-2xl font-bold text-mint">
                  {(jezeroData.ml_metrics.r2 * 100).toFixed(2)}%
                </p>
                <p className="text-[9px] text-fog">R² = {jezeroData.ml_metrics.r2.toFixed(4)}</p>
              </div>

              <div className="rounded-xl border border-line bg-ink2/50 p-3">
                <p className="text-[9px] uppercase tracking-wider text-fog">Mean Absolute Error</p>
                <p className="mt-1 text-2xl font-bold text-cyan">
                  {jezeroData.ml_metrics.mae.toFixed(4)}
                </p>
                <p className="text-[9px] text-fog">&lt; 0.9% on [0, 1] hazard scale</p>
              </div>

              <div className="rounded-xl border border-line bg-ink2/50 p-3">
                <p className="text-[9px] uppercase tracking-wider text-fog">3-Class Accuracy</p>
                <p className="mt-1 text-2xl font-bold text-bright">
                  {(jezeroData.ml_metrics.acc * 100).toFixed(1)}%
                </p>
                <p className="text-[9px] text-fog">Majority baseline: {(jezeroData.ml_metrics.base * 100).toFixed(1)}%</p>
              </div>

              <div className="rounded-xl border border-line bg-ink2/50 p-3">
                <p className="text-[9px] uppercase tracking-wider text-fog">Validation Scheme</p>
                <p className="mt-1 text-base font-bold text-amber">4 Folds</p>
                <p className="text-[9px] text-fog">16 Spatial Blocks (No leakage)</p>
              </div>
            </div>
          </div>

          {/* Permutation Feature Importances Card */}
          <div className="rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-line/70 pb-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber/15 text-amber">
                <BarChart3 className="size-4" />
              </span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber">DEM Derivatives</p>
                <h3 className="font-display text-base font-bold text-bright">Feature Importances</h3>
              </div>
            </div>

            <div className="mt-3 space-y-2.5 font-mono text-xs">
              {(jezeroData.ml_metrics.imp as [string, number][]).map(([name, val]) => {
                const numericVal = typeof val === "number" ? val : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-bright font-semibold">{name}</span>
                      <span className="text-fog">{(numericVal * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber to-rose"
                        style={{ width: `${Math.min(100, Math.max(2, numericVal * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* K-Means Clusters Card */}
          <div className="rounded-2xl border border-line bg-white/80 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-line/70 pb-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-mint/15 text-mint">
                <Layers className="size-4" />
              </span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mint">Unsupervised Clustering</p>
                <h3 className="font-display text-base font-bold text-bright">Terrain Classes</h3>
              </div>
            </div>

            <div className="mt-3 space-y-2 font-mono text-[11px]">
              {jezeroData.clusters.map((c) => {
                const labels = [
                  { title: "Safe Plains", color: "bg-mint" },
                  { title: "Low Slopes", color: "bg-cyan" },
                  { title: "Moderate Scarps", color: "bg-amber" },
                  { title: "Extreme Rims", color: "bg-rose" },
                ];
                const meta = labels[c.id] ?? { title: `Cluster ${c.id}`, color: "bg-fog" };
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-line/70 bg-ink2/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${meta.color}`} />
                      <span className="font-semibold text-bright">{meta.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-fog">
                      <span>{(c.share * 100).toFixed(1)}% area</span>
                      <span>Slope: {c.slope.toFixed(1)}°</span>
                      <span>Haz: {c.haz.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
