import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  Cpu,
  Layers,
  MapPin,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Play,
  CheckCircle2,
  ExternalLink,
  Info,
  Maximize2,
  Eye,
  Database,
  Crosshair,
  BarChart3,
  Search,
  Compass,
  ArrowRight,
  RefreshCw,
  Sliders,
  Droplets,
  Mountain
} from 'lucide-react';
import {
  HF_MARS_MODELS_CATALOG,
  MARS_BENCHMARK_TARGETS,
  type HfModelMetadata,
  type MarsBenchmarkTarget,
  type AiInferenceResponse,
  type BoundingBoxPrediction,
  type SegmentationPolygon,
  detectSystemHardware,
} from '@/lib/hf-mars-models';
import { HfModelCardModal } from './HfModelCardModal';

interface HfAiAnalysisPanelProps {
  initialTargetId?: string;
  initialModelId?: string;
  onSelectCoordinates?: (lat: number, lon: number, name: string) => void;
  className?: string;
}

export function HfAiAnalysisPanel({
  initialTargetId = 'jezero-delta',
  initialModelId = 'mars-bench-boulder',
  onSelectCoordinates,
  className = '',
}: HfAiAnalysisPanelProps) {
  // State
  const [selectedTarget, setSelectedTarget] = useState<MarsBenchmarkTarget>(() => {
    return MARS_BENCHMARK_TARGETS.find((t) => t.id === initialTargetId) ?? MARS_BENCHMARK_TARGETS[0]!;
  });
  const [selectedModel, setSelectedModel] = useState<HfModelMetadata>(() => {
    return HF_MARS_MODELS_CATALOG.find((m) => m.id === initialModelId) ?? HF_MARS_MODELS_CATALOG[0]!;
  });
  const [selectedSensor, setSelectedSensor] = useState<'HiRISE' | 'CTX' | 'THEMIS' | 'MOLA'>('HiRISE');
  const [userPrompt, setUserPrompt] = useState<string>('Assess rover landing hazards, boulder distribution, and geological formation.');
  
  // Inference State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [inferenceResult, setInferenceResult] = useState<AiInferenceResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Overlay Controls
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showMasks, setShowMasks] = useState<boolean>(true);
  const [showGeoGrid, setShowGeoGrid] = useState<boolean>(true);
  const [selectedBox, setSelectedBox] = useState<BoundingBoxPrediction | null>(null);
  const [selectedPolygon, setSelectedPolygon] = useState<SegmentationPolygon | null>(null);
  const [inspectingModelCard, setInspectingModelCard] = useState<HfModelMetadata | null>(null);

  // Hardware Status
  const hardware = detectSystemHardware();

  // Canvas Ref for Overlay
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Run Inference Function
  const handleRunInference = async (bypassCache = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSelectedBox(null);
    setSelectedPolygon(null);

    try {
      const response = await fetch('/api/hf-inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.id,
          targetId: selectedTarget.id,
          sensor: selectedSensor,
          userPrompt: selectedModel.category === 'vqa' ? userPrompt : undefined,
          bypassCache,
        }),
      });

      if (!response.ok) {
        throw new Error(`Inference HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as AiInferenceResponse;
      setInferenceResult(data);
    } catch (err: any) {
      console.error('Inference execution error:', err);
      setErrorMsg(err.message || 'Failed to complete model inference');
    } finally {
      setIsLoading(false);
    }
  };

  // Run inference initially on mount or target change
  useEffect(() => {
    handleRunInference(false);
  }, [selectedTarget.id, selectedModel.id, selectedSensor]);

  // Redraw Canvas Overlay whenever inferenceResult, bounding boxes, or masks change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!inferenceResult || inferenceResult.status !== 'success') return;

    const w = canvas.width;
    const h = canvas.height;

    // Draw Segmentation Masks
    if (showMasks && inferenceResult.predictions.segmentationMasks) {
      inferenceResult.predictions.segmentationMasks.forEach((poly) => {
        if (!poly.points || poly.points.length < 3) return;
        ctx.beginPath();
        poly.points.forEach(([px, py], i) => {
          const x = px * w;
          const y = py * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = poly.color + '44'; // 25% opacity
        ctx.fill();
        ctx.lineWidth = selectedPolygon?.id === poly.id ? 2.5 : 1.5;
        ctx.strokeStyle = poly.color;
        ctx.stroke();

        // Polygon Label
        const [firstX, firstY] = poly.points[0]!;
        ctx.fillStyle = poly.color;
        ctx.font = 'bold 9px IBM Plex Mono, monospace';
        ctx.fillText(poly.className.split('(')[0]!.trim(), firstX * w + 4, firstY * h - 4);
      });
    }

    // Draw Bounding Boxes
    if (showBoundingBoxes && inferenceResult.predictions.boundingBoxes) {
      inferenceResult.predictions.boundingBoxes.forEach((b) => {
        const [ymin, xmin, ymax, xmax] = b.box;
        const x = xmin * w;
        const y = ymin * h;
        const boxW = (xmax - xmin) * w;
        const boxH = (ymax - ymin) * h;
        const isSelected = selectedBox?.id === b.id;

        // Box border
        ctx.strokeStyle = isSelected ? '#00f0ff' : b.metrics?.hazardLevel === 'Severe' ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(x, y, boxW, boxH);

        // Fill tint on hover/select
        if (isSelected) {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
          ctx.fillRect(x, y, boxW, boxH);
        }

        // Box Tag
        ctx.fillStyle = isSelected ? '#00f0ff' : b.metrics?.hazardLevel === 'Severe' ? '#ef4444' : '#f59e0b';
        ctx.fillRect(x, Math.max(0, y - 16), Math.min(boxW + 30, 160), 16);
        ctx.fillStyle = '#05080f';
        ctx.font = 'bold 9px IBM Plex Mono, monospace';
        const labelText = `${b.label} (${Math.round(b.confidence * 100)}%)`;
        ctx.fillText(labelText, x + 3, Math.max(11, y - 4));
      });
    }

    // Draw Georeferenced Coordinates Grid
    if (showGeoGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Crosshairs & Grid Lines
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Corner coordinates
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '8px IBM Plex Mono, monospace';
      const b = selectedTarget.bounds;
      ctx.fillText(`${b.maxLat.toFixed(2)}°N, ${b.minLon.toFixed(2)}°E`, 6, 12);
      ctx.fillText(`${b.minLat.toFixed(2)}°N, ${b.maxLon.toFixed(2)}°E`, w - 110, h - 6);
    }
  }, [inferenceResult, showBoundingBoxes, showMasks, showGeoGrid, selectedBox, selectedPolygon, selectedTarget]);

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {/* 1. Header & Location Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl text-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
              NASA &amp; Hugging Face Planetary AI System
            </span>
          </div>
          <h1 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            <BrainCircuit className="size-5 text-amber-400" />
            Mars-Specific AI Model Analysis Hub
          </h1>
          <p className="text-xs text-slate-400">
            Modular Martian foundation models, Mars-Bench geological vision tasks, and physical NASA ground-truth cross-validation.
          </p>
        </div>

        {/* Location Picker */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <MapPin className="size-3.5 text-amber-400 ml-2" />
            <select
              value={selectedTarget.id}
              onChange={(e) => {
                const target = MARS_BENCHMARK_TARGETS.find((t) => t.id === e.target.value);
                if (target) {
                  setSelectedTarget(target);
                  if (onSelectCoordinates) {
                    onSelectCoordinates(target.lat, target.lon, target.name);
                  }
                }
              }}
              className="bg-transparent text-xs font-mono text-slate-200 py-1.5 pr-3 pl-1 outline-none cursor-pointer"
            >
              {MARS_BENCHMARK_TARGETS.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                  {t.name} ({t.lat >= 0 ? `${t.lat}°N` : `${Math.abs(t.lat)}°S`}, {t.lon}°E)
                </option>
              ))}
            </select>
          </div>

          {/* Quick Fly-To Button */}
          {onSelectCoordinates && (
            <button
              type="button"
              onClick={() => onSelectCoordinates(selectedTarget.lat, selectedTarget.lon, selectedTarget.name)}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 transition-colors flex items-center gap-1"
              title="Fly to location on 3D Planetary Map"
            >
              <Compass className="size-3 text-cyan-400" />
              <span>Map View</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main 2-Column AI Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Real NASA Imagery & Model Prediction Overlays */}
        <div className="xl:col-span-7 flex flex-col gap-3">
          {/* Imagery Canvas Container */}
          <div className="relative rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl aspect-[4/3] flex items-center justify-center group">
            {/* Real NASA Imagery Source Tile */}
            <img
              ref={imageRef}
              src={selectedTarget.imageUrl}
              alt={selectedTarget.name}
              className="w-full h-full object-cover select-none"
            />

            {/* Canvas Overlay for Masks, Bounding Boxes, and Georeferencing */}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full pointer-events-auto cursor-crosshair z-10"
              onClick={(e) => {
                const canvas = canvasRef.current;
                if (!canvas || !inferenceResult) return;
                const rect = canvas.getBoundingClientRect();
                const clickX = (e.clientX - rect.left) / rect.width;
                const clickY = (e.clientY - rect.top) / rect.height;

                // Check bounding boxes
                if (inferenceResult.predictions.boundingBoxes) {
                  const clicked = inferenceResult.predictions.boundingBoxes.find((b) => {
                    const [ymin, xmin, ymax, xmax] = b.box;
                    return clickX >= xmin && clickX <= xmax && clickY >= ymin && clickY <= ymax;
                  });
                  if (clicked) {
                    setSelectedBox(clicked);
                    setSelectedPolygon(null);
                    return;
                  }
                }

                // Check polygons
                if (inferenceResult.predictions.segmentationMasks) {
                  const clickedPoly = inferenceResult.predictions.segmentationMasks.find((p) => {
                    // Simple bounding check
                    const xs = p.points.map((pt) => pt[0]);
                    const ys = p.points.map((pt) => pt[1]);
                    return (
                      clickX >= Math.min(...xs) &&
                      clickX <= Math.max(...xs) &&
                      clickY >= Math.min(...ys) &&
                      clickY <= Math.max(...ys)
                    );
                  });
                  if (clickedPoly) {
                    setSelectedPolygon(clickedPoly);
                    setSelectedBox(null);
                    return;
                  }
                }

                setSelectedBox(null);
                setSelectedPolygon(null);
              }}
            />

            {/* Top Overlay Badges: Sensor & Resolution Telemetry */}
            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
              <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 border border-slate-700/80 text-white font-mono text-[10px] font-bold backdrop-blur-md">
                NASA {selectedSensor}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[9px] font-semibold backdrop-blur-md">
                {selectedSensor === 'HiRISE' ? '0.25 m/pixel' : selectedSensor === 'CTX' ? '5.0 m/pixel' : '100 m/pixel'}
              </span>
              {inferenceResult?.isCached && (
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[9px]">
                  Cached Result
                </span>
              )}
            </div>

            {/* Bottom Overlay Controls (Toggles: BBoxes, Masks, Grid) */}
            <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/90 border border-slate-800 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                className={`px-2 py-1 rounded-lg font-mono text-[10px] transition-colors ${
                  showBoundingBoxes ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle Bounding Boxes"
              >
                Boxes
              </button>
              <button
                type="button"
                onClick={() => setShowMasks(!showMasks)}
                className={`px-2 py-1 rounded-lg font-mono text-[10px] transition-colors ${
                  showMasks ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle Segmentation Masks"
              >
                Masks
              </button>
              <button
                type="button"
                onClick={() => setShowGeoGrid(!showGeoGrid)}
                className={`px-2 py-1 rounded-lg font-mono text-[10px] transition-colors ${
                  showGeoGrid ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle Coordinate Grid"
              >
                Grid
              </button>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="size-6 text-amber-400 animate-spin" />
                <span className="font-mono text-xs text-amber-300 font-bold">
                  Running {selectedModel.shortName} Inference...
                </span>
              </div>
            )}
          </div>

          {/* Sensor Selector & Target Telemetry Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-slate-400 font-bold">Sensor:</span>
              {(['HiRISE', 'CTX', 'THEMIS', 'MOLA'] as const).map((sensor) => (
                <button
                  key={sensor}
                  type="button"
                  onClick={() => setSelectedSensor(sensor)}
                  className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-semibold ${
                    selectedSensor === sensor
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {sensor}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-3">
              <span>Elev: <strong className="text-slate-200">{selectedTarget.elevationMeters}m</strong></span>
              <span>Slope: <strong className="text-slate-200">{selectedTarget.scientificFacts.molaSlopeMeanDeg}°</strong></span>
              <span>Inertia: <strong className="text-slate-200">{selectedTarget.scientificFacts.themisThermalInertia}</strong></span>
            </div>
          </div>

          {/* Inspection Inspector for Selected Prediction Box or Polygon */}
          {selectedBox && (
            <div className="p-3.5 rounded-xl border border-cyan-500/40 bg-slate-900/90 shadow-lg text-xs font-mono space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <Crosshair className="size-3.5 text-cyan-400" />
                  Target Object: {selectedBox.label}
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-bold">
                  Confidence: {Math.round(selectedBox.confidence * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-300 pt-1">
                <div>
                  <span className="text-slate-500">Est. Diameter: </span>
                  <strong className="text-slate-100">{selectedBox.metrics?.estimatedDiameterMeters}m</strong>
                </div>
                <div>
                  <span className="text-slate-500">Hazard: </span>
                  <strong className={selectedBox.metrics?.hazardLevel === 'Severe' ? 'text-rose-400' : 'text-amber-400'}>
                    {selectedBox.metrics?.hazardLevel}
                  </strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">GeoBounds: </span>
                  <span>{selectedBox.geoBounds.minLat}°N – {selectedBox.geoBounds.maxLat}°N</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                {selectedBox.metrics?.scientificNote}
              </p>
            </div>
          )}

          {selectedPolygon && (
            <div className="p-3.5 rounded-xl border border-amber-500/40 bg-slate-900/90 shadow-lg text-xs font-mono space-y-1 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-amber-300 font-bold">{selectedPolygon.className}</span>
                <span className="text-slate-400 text-[10px]">Confidence: {Math.round(selectedPolygon.confidence * 100)}%</span>
              </div>
              <p className="text-[10px] text-slate-300">
                Segmented Area: <strong className="text-white">{(selectedPolygon.areaSqMeters || 0).toLocaleString()} m²</strong>
              </p>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Hugging Face Model Selection & Scientific Evidence Matrix */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Model Selection Card */}
          <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Cpu className="size-3.5 text-amber-400" />
                Select Hugging Face Model
              </h2>
              <button
                type="button"
                onClick={() => setInspectingModelCard(selectedModel)}
                className="text-[11px] font-mono text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
              >
                <span>Model Card</span>
                <ExternalLink className="size-3" />
              </button>
            </div>

            {/* Model Selector Tabs / Pills */}
            <div className="grid grid-cols-2 gap-1.5">
              {HF_MARS_MODELS_CATALOG.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModel(m)}
                  className={`p-2 rounded-xl text-left font-mono transition-all border ${
                    selectedModel.id === m.id
                      ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <p className="text-[11px] font-bold line-clamp-1">{m.shortName}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5 uppercase">{m.category} · {m.parameterCount}</p>
                </button>
              ))}
            </div>

            {/* Model Architecture & Guardrail Status */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">HF Repository:</span>
                <a
                  href={selectedModel.hfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>{selectedModel.hfRepo}</span>
                  <ExternalLink className="size-2.5" />
                </a>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">License:</span>
                <span className="text-slate-200">{selectedModel.license}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">VRAM Requirement:</span>
                <span className={selectedModel.inferenceRequirements.minVramGb > 4 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {selectedModel.inferenceRequirements.minVramGb} GB ({selectedModel.inferenceRequirements.supportsCpu ? 'CPU Compatible' : 'GPU / Cloud API Only'})
                </span>
              </div>
            </div>

            {/* Natural Language Prompt (for VQA Model) */}
            {selectedModel.category === 'vqa' && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Planetary VQA Prompt:</label>
                <input
                  type="text"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Ask a question about this Martian terrain..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Run Inference Action Button */}
            <button
              type="button"
              onClick={() => handleRunInference(true)}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  <span>Processing Orbital Imagery...</span>
                </>
              ) : (
                <>
                  <Play className="size-4 fill-slate-950" />
                  <span>Execute {selectedModel.shortName}</span>
                </>
              )}
            </button>
          </div>

          {/* Model Inference Output Summary */}
          {inferenceResult && (
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="size-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    Model Output &amp; Telemetry
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  Latency: <strong className="text-emerald-400">{inferenceResult.executionTimeMs} ms</strong>
                </span>
              </div>

              {/* Status Warning if Unavailable */}
              {inferenceResult.status === 'unavailable' ? (
                <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/20 text-rose-200 font-mono text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-rose-300">
                    <AlertTriangle className="size-4 text-rose-400" />
                    <span>Model Execution Status: UNAVAILABLE</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-200/90">
                    {inferenceResult.unavailableReason}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                    {inferenceResult.predictions.summary}
                  </p>

                  {/* VQA Text Answer */}
                  {inferenceResult.predictions.textAnswer && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <p className="text-[10px] text-amber-400 uppercase font-bold">Multimodal Reasoning:</p>
                      <p className="text-[11px] text-slate-300 whitespace-pre-line leading-relaxed">
                        {inferenceResult.predictions.textAnswer}
                      </p>
                    </div>
                  )}

                  {/* Classifications Output */}
                  {inferenceResult.predictions.classifications && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Predicted Classes:</p>
                      {inferenceResult.predictions.classifications.map((c, i) => (
                        <div key={i} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-bold">{c.className}</span>
                            <span className="text-amber-400">{Math.round(c.confidence * 100)}%</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{c.geologicalInterpretation}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MOMO Embedding Vectors */}
                  {inferenceResult.predictions.embeddings && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Latent Vector ({inferenceResult.predictions.embeddings.dimensions}-D):</span>
                        <span className="text-emerald-400 font-bold">Normalized L2</span>
                      </div>
                      <div className="flex flex-wrap gap-1 font-mono text-[9px]">
                        {inferenceResult.predictions.embeddings.sampleVector.map((val, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {val.toFixed(3)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. SCIENTIFIC EVIDENCE VS AI PREDICTIONS (CRITICAL SEPARATION) */}
          {inferenceResult && (
            <div className="p-4 rounded-2xl border border-cyan-500/30 bg-slate-900/90 backdrop-blur-md shadow-xl flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Database className="size-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    NASA Ground-Truth Evidence Cross-Check
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[9px] font-bold">
                  Empirical Science
                </span>
              </div>

              {/* NASA SWIM Radar & Water Ice Consistency */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Droplets className="size-3 text-cyan-400" />
                    NASA SWIM 2.0 Subsurface Ice:
                  </span>
                  <span className={`font-bold ${inferenceResult.scientificValidation.swimIceConsistency.compositeScore > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    CI = {inferenceResult.scientificValidation.swimIceConsistency.compositeScore}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">
                  {inferenceResult.scientificValidation.swimIceConsistency.category}
                </p>
                <p className="text-[9px] text-slate-400 italic">
                  SHARAD Radar: {inferenceResult.scientificValidation.swimIceConsistency.radarAgreement}
                </p>
              </div>

              {/* MOLA Topography & Slope */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Mountain className="size-3 text-amber-400" />
                    MGS MOLA Laser Altimetry:
                  </span>
                  <span className="text-white font-bold">
                    Slope {inferenceResult.scientificValidation.molaTopography.slopeDegrees}°
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">
                  Datum Elevation: {inferenceResult.scientificValidation.molaTopography.datumElevationM}m · {inferenceResult.scientificValidation.molaTopography.terrainRoughness}
                </p>
              </div>

              {/* PROVENANCE WARNING BANNER */}
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300/90 text-[10px] leading-relaxed">
                <div className="flex items-center gap-1 font-bold text-amber-300 mb-0.5">
                  <ShieldAlert className="size-3.5 text-amber-400" />
                  <span>SCIENTIFIC INTEGRITY NOTICE</span>
                </div>
                {inferenceResult.scientificValidation.scientificDisclaimer}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model Card Modal */}
      <HfModelCardModal
        model={inspectingModelCard}
        onClose={() => setInspectingModelCard(null)}
      />
    </div>
  );
}
