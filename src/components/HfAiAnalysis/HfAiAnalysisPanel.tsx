import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BrainCircuit,
  Cpu,
  MapPin,
  ShieldAlert,
  AlertTriangle,
  Play,
  CheckCircle2,
  ExternalLink,
  Database,
  Crosshair,
  Compass,
  RefreshCw,
  Droplets,
  Mountain,
  Upload,
  Globe2,
  Image as ImageIcon,
  TableProperties,
  Server,
  Clock,
  KeyRound,
} from 'lucide-react';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  HF_MARS_MODELS_CATALOG,
  MARS_BENCHMARK_TARGETS,
  MAX_IMAGE_UPLOAD_BYTES,
  buildNasaMarsTrekTileUrl,
  type HfModelMetadata,
  type HfLiveVerificationRecord,
  type MarsBenchmarkTarget,
  type MarsSensorType,
  type AiInferenceResponse,
  type BoundingBoxPrediction,
  type SegmentationPolygon,
  type RasterMaskPrediction,
} from '@/lib/hf-mars-models';
import { HfModelCardModal } from './HfModelCardModal';

interface HfAiAnalysisPanelProps {
  initialTargetId?: string | undefined;
  initialModelId?: string | undefined;
  externalLocation?: {
    lat: number;
    lon: number;
    name?: string | undefined;
    elevationM?: number | undefined;
  } | undefined;
  onSelectCoordinates?: ((lat: number, lon: number, name: string) => void) | undefined;
  className?: string | undefined;
}

interface DecodedMaskLayer {
  meta: RasterMaskPrediction;
  offscreen: HTMLCanvasElement;
  alphaGrid: Uint8Array;
  gridW: number;
  gridH: number;
  coveragePercent: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [245, 158, 11];
  const r = parseInt(clean.slice(0, 2), 16) || 245;
  const g = parseInt(clean.slice(2, 4), 16) || 158;
  const b = parseInt(clean.slice(4, 6), 16) || 11;
  return [r, g, b];
}

export function HfAiAnalysisPanel({
  initialTargetId = 'jezero-delta',
  initialModelId = 'segformer-terrain',
  externalLocation,
  onSelectCoordinates,
  className = '',
}: HfAiAnalysisPanelProps) {
  // Registry & Backend Config State
  const [modelsCatalog, setModelsCatalog] = useState<HfModelMetadata[]>(HF_MARS_MODELS_CATALOG);
  const [hfTokenConfigured, setHfTokenConfigured] = useState<boolean | null>(null);
  const [hfTokenSource, setHfTokenSource] = useState<string | null>(null);
  const [spaceUrlConfigured, setSpaceUrlConfigured] = useState<boolean>(false);
  const [showRegistryTable, setShowRegistryTable] = useState<boolean>(false);
  const [verificationRecords, setVerificationRecords] = useState<HfLiveVerificationRecord[] | null>(null);
  const [isVerifyingHub, setIsVerifyingHub] = useState<boolean>(false);

  // Target, Image Source, Model & Sensor State
  const [selectedTarget, setSelectedTarget] = useState<MarsBenchmarkTarget>(() => {
    return MARS_BENCHMARK_TARGETS.find((t) => t.id === initialTargetId) ?? MARS_BENCHMARK_TARGETS[0]!;
  });
  const [selectedModelId, setSelectedModelId] = useState<string>(initialModelId);
  const selectedModel =
    modelsCatalog.find((m) => m.id === selectedModelId) ?? modelsCatalog[0]!;

  const [selectedSensor, setSelectedSensor] = useState<MarsSensorType>('HiRISE');
  const [imageSource, setImageSource] = useState<'benchmark' | 'nasa-wmts' | 'upload'>('benchmark');
  const [userPrompt, setUserPrompt] = useState<string>(
    'Identify Martian geological landforms, craters, boulders, and rover traversal risks visible in this scene.'
  );

  // Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [uploadValidationError, setUploadValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inference Execution State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [inferenceResult, setInferenceResult] = useState<AiInferenceResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Decoded Raster Masks & Interactive Inspection State
  const [decodedMasks, setDecodedMasks] = useState<DecodedMaskLayer[]>([]);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showMasks, setShowMasks] = useState<boolean>(true);
  const [showGeoGrid, setShowGeoGrid] = useState<boolean>(true);
  const [selectedBox, setSelectedBox] = useState<BoundingBoxPrediction | null>(null);
  const [selectedPolygon, setSelectedPolygon] = useState<SegmentationPolygon | null>(null);
  const [selectedMaskLayer, setSelectedMaskLayer] = useState<DecodedMaskLayer | null>(null);
  const [inspectingModelCard, setInspectingModelCard] = useState<HfModelMetadata | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active Coordinates (uses external map selection when in nasa-wmts mode if available)
  const activeLat =
    imageSource === 'nasa-wmts' && externalLocation ? externalLocation.lat : selectedTarget.lat;
  const activeLon =
    imageSource === 'nasa-wmts' && externalLocation ? externalLocation.lon : selectedTarget.lon;
  const activeLocationName =
    imageSource === 'nasa-wmts' && externalLocation?.name
      ? externalLocation.name
      : selectedTarget.name;

  const liveWmtsMeta = buildNasaMarsTrekTileUrl(activeLat, activeLon, selectedSensor);

  const displayedImageUrl =
    imageSource === 'upload' && uploadedPreviewUrl
      ? uploadedPreviewUrl
      : imageSource === 'nasa-wmts'
        ? liveWmtsMeta.tileUrl
        : selectedTarget.imageUrl;

  // Clean up object URL on unmount / change
  useEffect(() => {
    return () => {
      if (uploadedPreviewUrl) {
        URL.revokeObjectURL(uploadedPreviewUrl);
      }
    };
  }, [uploadedPreviewUrl]);

  // Fetch initial sanitized backend registry status on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/hf-inference');
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          models?: HfModelMetadata[];
          hfTokenConfigured?: boolean;
          hfTokenSource?: string;
          spaceUrlConfigured?: boolean;
        };
        if (!cancelled && data.ok) {
          if (Array.isArray(data.models) && data.models.length > 0) {
            setModelsCatalog(data.models);
          }
          if (typeof data.hfTokenConfigured === 'boolean') {
            setHfTokenConfigured(data.hfTokenConfigured);
          }
          if (typeof data.hfTokenSource === 'string') {
            setHfTokenSource(data.hfTokenSource);
          }
          if (typeof data.spaceUrlConfigured === 'boolean') {
            setSpaceUrlConfigured(data.spaceUrlConfigured);
          }
        }
      } catch {
        // Non-fatal initial metadata probe
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Run live 7-model verification against Hugging Face Hub API
  const handleVerifyAllModels = useCallback(async (forceRefresh = true) => {
    setIsVerifyingHub(true);
    try {
      const res = await fetch(`/api/hf-inference?action=verify${forceRefresh ? '&refresh=1' : ''}`);
      if (!res.ok) {
        throw new Error(`Hub verification HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        ok?: boolean;
        hfTokenConfigured?: boolean;
        hfTokenSource?: string;
        spaceUrlConfigured?: boolean;
        verification?: HfLiveVerificationRecord[];
      };
      if (data.verification) {
        setVerificationRecords(data.verification);
        // Sync updated status back into catalog pills
        setModelsCatalog((prev) =>
          prev.map((m) => {
            const v = data.verification?.find((rec) => rec.id === m.id);
            if (!v) return m;
            return {
              ...m,
              hfRepoId: v.hfRepoId,
              hfRepo: v.hfRepoId,
              hostingMethod: v.hostingMethod,
              apiEndpoint: v.apiEndpoint,
              modelStatus: v.modelStatus,
              inferenceAvailability: v.inferenceAvailability,
            };
          })
        );
      }
      if (typeof data.hfTokenConfigured === 'boolean') {
        setHfTokenConfigured(data.hfTokenConfigured);
      }
      if (typeof data.hfTokenSource === 'string') {
        setHfTokenSource(data.hfTokenSource);
      }
      if (typeof data.spaceUrlConfigured === 'boolean') {
        setSpaceUrlConfigured(data.spaceUrlConfigured);
      }
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Failed to verify models on Hugging Face Hub');
    } finally {
      setIsVerifyingHub(false);
    }
  }, []);

  // Handle Client-Side File Selection & Strict Validation
  const handleFileChange = (file: File | undefined) => {
    setUploadValidationError(null);
    if (!file) return;

    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setUploadValidationError(
        `Invalid image format "${file.type || file.name}". Only JPEG (.jpg), PNG (.png), and WebP (.webp) files are supported.`
      );
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadValidationError(
        `File "${file.name}" is ${mb} MB, exceeding the 4.00 MB upload limit. Please select a smaller Mars image tile.`
      );
      return;
    }

    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setUploadedFile(file);
    setUploadedPreviewUrl(nextUrl);
    setImageSource('upload');
    setInferenceResult(null);
    setDecodedMasks([]);
  };

  // Execute Real Backend Hugging Face Inference
  const handleRunInference = useCallback(
    async (bypassCache = false) => {
      if (imageSource === 'upload' && !uploadedFile) {
        setUploadValidationError('Please select a JPEG, PNG, or WebP Mars image before running inference.');
        return;
      }

      setIsLoading(true);
      setRequestError(null);
      setSelectedBox(null);
      setSelectedPolygon(null);
      setSelectedMaskLayer(null);
      setLoadingStage('Validating Mars imagery & dispatching to /api/hf-inference...');

      const stageTimer = setTimeout(() => {
        setLoadingStage(`Awaiting Hugging Face (${selectedModel.hfRepoId}) inference...`);
      }, 900);

      try {
        let response: Response;

        if (imageSource === 'upload' && uploadedFile) {
          const form = new FormData();
          form.set('modelId', selectedModel.id);
          form.set('targetId', selectedTarget.id);
          form.set('sensor', selectedSensor);
          form.set('imageSource', 'upload');
          if (selectedModel.task === 'image-text-to-text') {
            form.set('userPrompt', userPrompt);
          }
          form.set('bypassCache', bypassCache ? 'true' : 'false');
          form.set('file', uploadedFile);

          response = await fetch('/api/hf-inference', {
            method: 'POST',
            body: form,
          });
        } else {
          response = await fetch('/api/hf-inference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              modelId: selectedModel.id,
              targetId: selectedTarget.id,
              sensor: selectedSensor,
              imageSource,
              customLat: imageSource === 'nasa-wmts' ? activeLat : undefined,
              customLon: imageSource === 'nasa-wmts' ? activeLon : undefined,
              customLocationName: imageSource === 'nasa-wmts' ? activeLocationName : undefined,
              userPrompt: selectedModel.task === 'image-text-to-text' ? userPrompt : undefined,
              bypassCache,
            }),
          });
        }

        const payload = (await response.json()) as AiInferenceResponse & {
          error?: string;
          detail?: string;
        };

        if (!response.ok && !payload.modelId) {
          throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
        }

        setInferenceResult(payload);

        // Update model operational status strictly based on real inference outcome:
        // ONLY mark a model 'online' when an actual inference call returns HTTP 200 & status === 'success'
        setModelsCatalog((prev) =>
          prev.map((m) => {
            if (m.id !== payload.modelId) return m;
            if (payload.status === 'success' && payload.modelOnlineVerified) {
              return {
                ...m,
                modelStatus: 'online',
                inferenceAvailability: `ONLINE — Verified by real HTTP ${payload.httpStatus ?? 200} inference (${payload.executionTimeMs} ms)`,
              };
            }
            if (payload.errorCode === 'MISSING_HF_TOKEN') {
              return {
                ...m,
                modelStatus: 'token_required',
                inferenceAvailability: payload.unavailableReason ?? m.inferenceAvailability,
              };
            }
            if (payload.httpStatus === 401 || payload.httpStatus === 403) {
              return {
                ...m,
                modelStatus: 'auth_error',
                inferenceAvailability: payload.unavailableReason ?? m.inferenceAvailability,
              };
            }
            if (payload.httpStatus === 429) {
              return {
                ...m,
                modelStatus: 'rate_limited',
                inferenceAvailability: payload.unavailableReason ?? m.inferenceAvailability,
              };
            }
            if (payload.status === 'loading') {
              return {
                ...m,
                modelStatus: 'loading',
                inferenceAvailability: payload.unavailableReason ?? m.inferenceAvailability,
              };
            }
            if (payload.hostingMethodUsed === 'hub-weights-only') {
              return {
                ...m,
                modelStatus: 'endpoint_required',
                inferenceAvailability: payload.unavailableReason ?? m.inferenceAvailability,
              };
            }
            return {
              ...m,
              modelStatus: payload.httpStatus === 404 ? 'unavailable' : 'error',
              inferenceAvailability: payload.unavailableReason ?? m.inferenceAvailability,
            };
          })
        );

        if (payload.errorCode === 'MISSING_HF_TOKEN') {
          setHfTokenConfigured(false);
        } else if (
          payload.upstreamCalled &&
          (payload.hostingMethodUsed === 'inference-providers' ||
            payload.hostingMethodUsed === 'dedicated-endpoint')
        ) {
          setHfTokenConfigured(true);
        }
      } catch (err) {
        setRequestError(
          err instanceof Error ? err.message : 'Network error communicating with backend AI service'
        );
      } finally {
        clearTimeout(stageTimer);
        setIsLoading(false);
      }
    },
    [
      imageSource,
      uploadedFile,
      selectedModel.id,
      selectedModel.hfRepoId,
      selectedModel.task,
      selectedTarget.id,
      selectedSensor,
      userPrompt,
      activeLat,
      activeLon,
      activeLocationName,
    ]
  );

  // Auto-run when switching target, model, sensor, or uploaded image file
  useEffect(() => {
    if (imageSource === 'upload' && !uploadedFile) return;
    void handleRunInference(false);
  }, [selectedTarget.id, selectedModel.id, selectedSensor, imageSource, uploadedFile]);

  // Decode base64 PNG segmentation masks returned by Hugging Face into colorized offscreen canvases
  useEffect(() => {
    const rawMasks = inferenceResult?.predictions.rasterMasks;
    if (!rawMasks || rawMasks.length === 0 || inferenceResult?.status !== 'success') {
      setDecodedMasks([]);
      return;
    }

    let cancelled = false;
    const W = 640;
    const H = 480;

    Promise.all(
      rawMasks.map(
        (maskMeta) =>
          new Promise<DecodedMaskLayer | null>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const off = document.createElement('canvas');
              off.width = W;
              off.height = H;
              const octx = off.getContext('2d');
              if (!octx) {
                resolve(null);
                return;
              }
              octx.drawImage(img, 0, 0, W, H);
              const imgData = octx.getImageData(0, 0, W, H);
              const px = imgData.data;
              const [cr, cg, cb] = hexToRgb(maskMeta.color);
              const alphaGrid = new Uint8Array(W * H);
              let activeCount = 0;

              for (let i = 0, p = 0; i < px.length; i += 4, p++) {
                const intensity = px[i]!;
                if (intensity > 120) {
                  alphaGrid[p] = 1;
                  activeCount++;
                }
              }

              // Colorize fill + crisp 1-pixel contour edge
              for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                  const idx = y * W + x;
                  const out = idx * 4;
                  if (alphaGrid[idx] === 1) {
                    const isEdge =
                      x === 0 ||
                      x === W - 1 ||
                      y === 0 ||
                      y === H - 1 ||
                      alphaGrid[idx - 1] === 0 ||
                      alphaGrid[idx + 1] === 0 ||
                      alphaGrid[idx - W] === 0 ||
                      alphaGrid[idx + W] === 0;
                    px[out] = cr;
                    px[out + 1] = cg;
                    px[out + 2] = cb;
                    px[out + 3] = isEdge ? 235 : 92;
                  } else {
                    px[out + 3] = 0;
                  }
                }
              }

              octx.putImageData(imgData, 0, 0);
              resolve({
                meta: maskMeta,
                offscreen: off,
                alphaGrid,
                gridW: W,
                gridH: H,
                coveragePercent: +((activeCount / (W * H)) * 100).toFixed(1),
              });
            };
            img.onerror = () => resolve(null);
            img.src = maskMeta.maskDataUri;
          })
      )
    ).then((layers) => {
      if (!cancelled) {
        setDecodedMasks(layers.filter((l): l is DecodedMaskLayer => l !== null));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [inferenceResult]);

  // Redraw Main Canvas Overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Georeferenced Coordinate Graticule
    if (showGeoGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const b = imageSource === 'nasa-wmts' ? liveWmtsMeta.tileBounds : selectedTarget.bounds;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.font = '8px IBM Plex Mono, monospace';
      ctx.fillText(`${b.maxLat.toFixed(2)}°, ${b.minLon.toFixed(2)}°E`, 6, 12);
      ctx.fillText(`${b.minLat.toFixed(2)}°, ${b.maxLon.toFixed(2)}°E`, w - 118, h - 6);
    }

    if (!inferenceResult || inferenceResult.status !== 'success') return;

    // 2. Real Pixel-Level Hugging Face Raster Segmentation Masks
    if (showMasks && decodedMasks.length > 0) {
      decodedMasks.forEach((layer) => {
        ctx.save();
        if (selectedMaskLayer && selectedMaskLayer.meta.id !== layer.meta.id) {
          ctx.globalAlpha = 0.35;
        }
        ctx.drawImage(layer.offscreen, 0, 0, w, h);
        ctx.restore();
      });
    }

    // 3. Vector Polygon Segmentation Masks (when returned by custom HF Space)
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
        ctx.fillStyle = poly.color + '44';
        ctx.fill();
        ctx.lineWidth = selectedPolygon?.id === poly.id ? 2.5 : 1.5;
        ctx.strokeStyle = poly.color;
        ctx.stroke();
      });
    }

    // 4. Real Object Detection Bounding Boxes
    if (showBoundingBoxes && inferenceResult.predictions.boundingBoxes) {
      inferenceResult.predictions.boundingBoxes.forEach((b) => {
        const [ymin, xmin, ymax, xmax] = b.box;
        const x = xmin * w;
        const y = ymin * h;
        const boxW = Math.max(4, (xmax - xmin) * w);
        const boxH = Math.max(4, (ymax - ymin) * h);
        const isSelected = selectedBox?.id === b.id;

        const strokeColor = isSelected
          ? '#00f0ff'
          : b.metrics?.hazardLevel === 'Severe'
            ? '#ef4444'
            : '#f59e0b';

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(x, y, boxW, boxH);

        if (isSelected) {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
          ctx.fillRect(x, y, boxW, boxH);
        }

        const labelText = `${b.label} (${Math.round(b.confidence * 100)}%)`;
        const tagW = Math.min(180, Math.max(78, labelText.length * 5.8));
        ctx.fillStyle = strokeColor;
        ctx.fillRect(x, Math.max(0, y - 16), tagW, 16);
        ctx.fillStyle = '#05080f';
        ctx.font = 'bold 9px IBM Plex Mono, monospace';
        ctx.fillText(labelText, x + 4, Math.max(11, y - 4));
      });
    }
  }, [
    inferenceResult,
    decodedMasks,
    showBoundingBoxes,
    showMasks,
    showGeoGrid,
    selectedBox,
    selectedPolygon,
    selectedMaskLayer,
    selectedTarget,
    imageSource,
    liveWmtsMeta.tileBounds,
  ]);

  const statusBadgeForModel = (m: HfModelMetadata) => {
    if (m.modelStatus === 'online') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          ONLINE
        </span>
      );
    }
    if (m.modelStatus === 'configured') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
          STANDBY
        </span>
      );
    }
    if (m.modelStatus === 'token_required') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          HF_TOKEN
        </span>
      );
    }
    if (m.modelStatus === 'auth_error') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          AUTH ERR
        </span>
      );
    }
    if (m.modelStatus === 'credits_required') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
          CREDITS 402
        </span>
      );
    }
    if (m.modelStatus === 'rate_limited') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          429 LIMIT
        </span>
      );
    }
    if (m.modelStatus === 'loading') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          LOADING
        </span>
      );
    }
    if (m.modelStatus === 'unavailable' || m.modelStatus === 'error') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          OFFLINE
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
        SPACE/ENDPOINT
      </span>
    );
  };

  const describeHttpErrorDetails = (res: AiInferenceResponse): {
    title: string;
    remediation: string;
  } => {
    const code = res.httpStatus;
    if (res.errorCode === 'MISSING_HF_TOKEN') {
      return {
        title: 'HTTP 401 Unauthorized — HF_TOKEN Not Set on Backend Server',
        remediation:
          'Open .env in the project root, set HF_TOKEN=hf_your_token_here (create a Fine-Grained Token with "Make calls to Inference Providers" enabled at huggingface.co/settings/tokens), save .env, and click Execute.',
      };
    }
    if (code === 401) {
      return {
        title: 'HTTP 401 Unauthorized — Invalid, Malformed, or Expired HF_TOKEN',
        remediation:
          'Hugging Face rejected HF_TOKEN. Verify the token starts with "hf_", contains no extra quotes or spaces, has not been revoked, and is stored only in server .env (never VITE_HF_TOKEN).',
      };
    }
    if (code === 402 || res.errorCode === 'HTTP_402_PAYMENT_REQUIRED') {
      return {
        title: 'HTTP 402 Payment Required — Hugging Face Inference Compute Credits Needed',
        remediation:
          'Your HF_TOKEN is valid (authenticated on Hub with Inference scope), but Hugging Face now enforces pre-paid compute credits ($5-$10 at huggingface.co/settings/billing) or a PRO subscription to run models through Inference Providers. Alternatively, deploy the included free Hugging Face Space (./hf-mars-space) and set HF_SPACE_URL in .env.',
      };
    }
    if (code === 403) {
      return {
        title: 'HTTP 403 Forbidden — Missing "Make calls to Inference Providers" Permission',
        remediation:
          'Your HF_TOKEN authenticated on Hugging Face Hub, but lacks Inference Providers permission (or inference credits / gated license). Visit huggingface.co/settings/tokens, edit your Fine-Grained Token, and enable "Make calls to Inference Providers".',
      };
    }
    if (code === 404) {
      return {
        title: 'HTTP 404 Not Found — Model Route or Inference Provider Unavailable',
        remediation:
          'The requested model repository or provider endpoint does not expose an active serverless HTTP route. Verify the repository ID or configure HF_SPACE_URL / Dedicated Endpoint.',
      };
    }
    if (code === 429) {
      return {
        title: 'HTTP 429 Too Many Requests — Hugging Face Rate Limit / Quota Reached',
        remediation:
          'Your Hugging Face account or provider tier hit its request rate limit or compute credit allowance. Wait 30–60 seconds before retrying or check your Hugging Face billing/credits.',
      };
    }
    if (code !== undefined && code >= 500) {
      return {
        title: `HTTP ${code} Server Error — Hugging Face Upstream Runtime Failure`,
        remediation:
          'Hugging Face or its backing Inference Provider encountered an internal execution failure. Retry the inference request in a few seconds.',
      };
    }
    return {
      title: `Request Failed (${res.errorCode ?? 'ERROR'})`,
      remediation: 'Verify backend server logs, image format (JPEG/PNG/WebP <= 4 MB), and Hugging Face configuration.',
    };
  };

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {/* 1. Header, Backend Telemetry & 7-Model Registry Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-900/85 backdrop-blur-md shadow-xl text-slate-200">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`flex size-2 rounded-full ${
                inferenceResult?.status === 'success' && inferenceResult.modelOnlineVerified
                  ? 'bg-emerald-400 animate-pulse'
                  : hfTokenConfigured
                    ? 'bg-cyan-400'
                    : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Backend-Routed Hugging Face Planetary AI Architecture
            </span>
            {hfTokenConfigured !== null && (
              <span
                className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-semibold border ${
                  hfTokenConfigured
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {hfTokenConfigured
                  ? `HF_TOKEN Loaded (${hfTokenSource ?? 'Server'})`
                  : 'HF_TOKEN Not Set on Server'}
              </span>
            )}
            {spaceUrlConfigured && (
              <span className="px-2 py-0.5 rounded-md font-mono text-[9px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                HF Space Connected
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            <BrainCircuit className="size-5 text-amber-400" />
            Mars-Specific AI Model Analysis Hub
          </h1>
          <p className="text-xs text-slate-400">
            Real Hugging Face Inference Providers, Dedicated Endpoints, &amp; Space routing with NASA SWIM 2.0 / MOLA ground-truth validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 7-Model Verification Registry Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !showRegistryTable;
              setShowRegistryTable(next);
              if (next && !verificationRecords) {
                void handleVerifyAllModels(false);
              }
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              showRegistryTable
                ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                : 'border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-200'
            }`}
          >
            <TableProperties className="size-3.5 text-amber-400" />
            <span>7-Model Registry</span>
          </button>

          {/* Location Picker */}
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
              className="bg-transparent text-xs font-mono text-slate-200 py-1 pr-3 pl-1 outline-none cursor-pointer"
            >
              {MARS_BENCHMARK_TARGETS.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                  {t.name} ({t.lat >= 0 ? `${t.lat}°N` : `${Math.abs(t.lat)}°S`}, {t.lon}°E)
                </option>
              ))}
            </select>
          </div>

          {onSelectCoordinates && (
            <button
              type="button"
              onClick={() => onSelectCoordinates(activeLat, activeLon, activeLocationName)}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 transition-colors flex items-center gap-1"
              title="Fly to location on 3D Planetary Map"
            >
              <Compass className="size-3 text-cyan-400" />
              <span>Map View</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Verified 7-Model Registry Matrix */}
      {showRegistryTable && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-slate-900/95 shadow-2xl space-y-3 font-mono text-xs animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="size-4 text-amber-400" />
                Verified 7-Model Hugging Face Registry &amp; Hosting Audit
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Live Hub verification of repository IDs, tasks, hosting methods, endpoints, I/O contracts, and provider availability.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleVerifyAllModels(true)}
              disabled={isVerifyingHub}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isVerifyingHub ? 'animate-spin' : ''}`} />
              <span>{isVerifyingHub ? 'Probing Hugging Face Hub...' : 'Re-Verify Live on HF Hub'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[9px]">
                  <th className="py-2 pr-3">Model Name</th>
                  <th className="py-2 pr-3">HF Repository ID</th>
                  <th className="py-2 pr-3">Task</th>
                  <th className="py-2 pr-3">Hosting Method</th>
                  <th className="py-2 pr-3">API Endpoint</th>
                  <th className="py-2 pr-3">Input / Output</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Inference Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {modelsCatalog.map((m) => {
                  const liveRec = verificationRecords?.find((r) => r.id === m.id);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedModelId(m.id)}
                      className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                        selectedModel.id === m.id ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-3 font-bold text-white whitespace-nowrap">
                        {m.shortName}
                      </td>
                      <td className="py-2.5 pr-3 text-amber-300 whitespace-nowrap">
                        <a
                          href={`https://huggingface.co/${m.hfRepoId}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline inline-flex items-center gap-1"
                        >
                          <span>{m.hfRepoId}</span>
                          <ExternalLink className="size-2.5" />
                        </a>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-300 whitespace-nowrap">{m.task}</td>
                      <td className="py-2.5 pr-3 text-cyan-300 whitespace-nowrap">{m.hostingMethod}</td>
                      <td className="py-2.5 pr-3 text-slate-400 max-w-[210px] truncate" title={m.apiEndpoint}>
                        {m.apiEndpoint}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-400 max-w-[200px]">
                        <div className="truncate" title={m.inputFormat}>In: {m.inputFormat}</div>
                        <div className="truncate text-slate-500" title={m.outputFormat}>Out: {m.outputFormat}</div>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{statusBadgeForModel(m)}</td>
                      <td className="py-2.5 text-slate-300 min-w-[220px]">
                        <div>{liveRec ? liveRec.hubVerification.diagnosticNote : m.inferenceAvailability}</div>
                        {liveRec && liveRec.hubVerification.checkpointFiles.length > 0 && (
                          <div className="text-[9px] text-slate-500 mt-0.5">
                            Files: {liveRec.hubVerification.checkpointFiles.slice(0, 3).join(', ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Main 2-Column AI Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column (7 cols): NASA Imagery Input Modes & Real Prediction Canvas */}
        <div className="xl:col-span-7 flex flex-col gap-3">
          {/* Image Source Mode Bar (Benchmark Scene / Live NASA WMTS / Custom Upload) */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/70 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setImageSource('benchmark')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  imageSource === 'benchmark'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <ImageIcon className="size-3.5" />
                <span>Benchmark Scene</span>
              </button>

              <button
                type="button"
                onClick={() => setImageSource('nasa-wmts')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  imageSource === 'nasa-wmts'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Globe2 className="size-3.5" />
                <span>Live NASA WMTS Tile</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  imageSource === 'upload'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Upload className="size-3.5" />
                <span>{uploadedFile ? `Upload: ${uploadedFile.name.slice(0, 16)}` : 'Upload Mars Image'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
            </div>

            <span className="text-[10px] text-slate-400">
              JPEG / PNG / WebP &le; 4 MB
            </span>
          </div>

          {uploadValidationError && (
            <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 font-mono text-[11px] flex items-center gap-2">
              <AlertTriangle className="size-4 text-rose-400 shrink-0" />
              <span>{uploadValidationError}</span>
            </div>
          )}

          {/* Imagery Canvas Container */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileChange(e.dataTransfer.files?.[0]);
            }}
            className="relative rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl aspect-[4/3] flex items-center justify-center group"
          >
            <img
              src={displayedImageUrl}
              alt={activeLocationName}
              className="w-full h-full object-cover select-none"
            />

            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full pointer-events-auto cursor-crosshair z-10"
              onClick={(e) => {
                const canvas = canvasRef.current;
                if (!canvas || !inferenceResult) return;
                const rect = canvas.getBoundingClientRect();
                const normX = (e.clientX - rect.left) / rect.width;
                const normY = (e.clientY - rect.top) / rect.height;

                // 1. Hit-test object detection bounding boxes
                if (showBoundingBoxes && inferenceResult.predictions.boundingBoxes) {
                  const hitBox = inferenceResult.predictions.boundingBoxes.find((b) => {
                    const [ymin, xmin, ymax, xmax] = b.box;
                    return normX >= xmin && normX <= xmax && normY >= ymin && normY <= ymax;
                  });
                  if (hitBox) {
                    setSelectedBox(hitBox);
                    setSelectedMaskLayer(null);
                    setSelectedPolygon(null);
                    return;
                  }
                }

                // 2. Hit-test pixel-accurate Hugging Face raster segmentation masks
                if (showMasks && decodedMasks.length > 0) {
                  const gx = Math.min(639, Math.max(0, Math.floor(normX * 640)));
                  const gy = Math.min(479, Math.max(0, Math.floor(normY * 480)));
                  const hitMask = [...decodedMasks]
                    .reverse()
                    .find((layer) => layer.alphaGrid[gy * layer.gridW + gx] === 1);
                  if (hitMask) {
                    setSelectedMaskLayer(hitMask);
                    setSelectedBox(null);
                    setSelectedPolygon(null);
                    return;
                  }
                }

                // 3. Hit-test vector polygons
                if (showMasks && inferenceResult.predictions.segmentationMasks) {
                  const hitPoly = inferenceResult.predictions.segmentationMasks.find((p) => {
                    const xs = p.points.map((pt) => pt[0]);
                    const ys = p.points.map((pt) => pt[1]);
                    return (
                      normX >= Math.min(...xs) &&
                      normX <= Math.max(...xs) &&
                      normY >= Math.min(...ys) &&
                      normY <= Math.max(...ys)
                    );
                  });
                  if (hitPoly) {
                    setSelectedPolygon(hitPoly);
                    setSelectedBox(null);
                    setSelectedMaskLayer(null);
                    return;
                  }
                }

                setSelectedBox(null);
                setSelectedMaskLayer(null);
                setSelectedPolygon(null);
              }}
            />

            {/* Top Telemetry Badges */}
            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
              <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 border border-slate-700/80 text-white font-mono text-[10px] font-bold backdrop-blur-md">
                NASA {selectedSensor}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[9px] font-semibold backdrop-blur-md">
                {inferenceResult?.spatialResolution || liveWmtsMeta.spatialResolution}
              </span>
              {inferenceResult?.imageDimensions && (
                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-300 border border-slate-700 font-mono text-[9px]">
                  {inferenceResult.imageDimensions.width}&times;{inferenceResult.imageDimensions.height}px
                </span>
              )}
              {inferenceResult?.isCached && (
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[9px]">
                  Server Cache Hit
                </span>
              )}
            </div>

            {/* Bottom Overlay Toggles */}
            <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/90 border border-slate-800 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                className={`px-2 py-1 rounded-lg font-mono text-[10px] transition-colors cursor-pointer ${
                  showBoundingBoxes ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Boxes
              </button>
              <button
                type="button"
                onClick={() => setShowMasks(!showMasks)}
                className={`px-2 py-1 rounded-lg font-mono text-[10px] transition-colors cursor-pointer ${
                  showMasks ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Masks
              </button>
              <button
                type="button"
                onClick={() => setShowGeoGrid(!showGeoGrid)}
                className={`px-2 py-1 rounded-lg font-mono text-[10px] transition-colors cursor-pointer ${
                  showGeoGrid ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Grid
              </button>
            </div>

            {/* Multi-Stage Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
                <RefreshCw className="size-7 text-amber-400 animate-spin" />
                <span className="font-mono text-xs text-amber-300 font-bold">
                  {loadingStage}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Target Repo: {selectedModel.hfRepoId} ({selectedModel.hostingMethod})
                </span>
              </div>
            )}
          </div>

          {/* Decoded Segmentation Mask Legend Chips */}
          {decodedMasks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/70 font-mono text-[10px]">
              <span className="text-slate-400 uppercase font-bold mr-1">Segmented Regions:</span>
              {decodedMasks.map((layer) => {
                const active = selectedMaskLayer?.meta.id === layer.meta.id;
                return (
                  <button
                    key={layer.meta.id}
                    type="button"
                    onClick={() => setSelectedMaskLayer(active ? null : layer)}
                    className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                      active
                        ? 'border-white bg-slate-800 text-white font-bold'
                        : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="size-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: layer.meta.color }}
                    />
                    <span>{layer.meta.label}</span>
                    <span className="text-slate-400">({layer.coveragePercent}%)</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sensor Selector & Target Telemetry Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-slate-400 font-bold">Sensor:</span>
              {(['HiRISE', 'CTX', 'THEMIS', 'MOLA'] as const).map((sensor) => (
                <button
                  key={sensor}
                  type="button"
                  onClick={() => setSelectedSensor(sensor)}
                  className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-semibold cursor-pointer ${
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

          {/* Click-Inspected Bounding Box Details */}
          {selectedBox && (
            <div className="p-3.5 rounded-xl border border-cyan-500/40 bg-slate-900/90 shadow-lg text-xs font-mono space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <Crosshair className="size-3.5 text-cyan-400" />
                  Detected Object: {selectedBox.label}
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-bold">
                  Confidence: {(selectedBox.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-300 pt-1">
                <div>
                  <span className="text-slate-500">Est. Span: </span>
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
                  <span>{selectedBox.geoBounds.minLat}°..{selectedBox.geoBounds.maxLat}°N</span>
                </div>
              </div>
              {selectedBox.metrics?.scientificNote && (
                <p className="text-[10px] text-slate-400 italic">{selectedBox.metrics.scientificNote}</p>
              )}
            </div>
          )}

          {/* Click-Inspected Raster Mask Details */}
          {selectedMaskLayer && (
            <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-slate-900/90 shadow-lg text-xs font-mono space-y-1 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-emerald-300 font-bold flex items-center gap-2">
                  <span className="size-3 rounded-sm" style={{ backgroundColor: selectedMaskLayer.meta.color }} />
                  HF Mask Class: {selectedMaskLayer.meta.label}
                </span>
                <span className="text-slate-300 text-[10px]">
                  Scene Coverage: <strong>{selectedMaskLayer.coveragePercent}%</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-300 pt-0.5">
                {selectedMaskLayer.meta.marsTerrainInterpretation}
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

        {/* Right Column (5 cols): 7 Hugging Face Models, Live Output & NASA Evidence */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Model Selection Card */}
          <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/85 backdrop-blur-md shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Cpu className="size-3.5 text-amber-400" />
                Select Hugging Face Model (7)
              </h2>
              <button
                type="button"
                onClick={() => setInspectingModelCard(selectedModel)}
                className="text-[11px] font-mono text-amber-400 hover:text-amber-300 underline flex items-center gap-1 cursor-pointer"
              >
                <span>Model Card &amp; Env Vars</span>
                <ExternalLink className="size-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {modelsCatalog.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModelId(m.id)}
                  className={`p-2 rounded-xl text-left font-mono transition-all border cursor-pointer ${
                    selectedModel.id === m.id
                      ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-sm'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] font-bold truncate">{m.shortName}</p>
                    {statusBadgeForModel(m)}
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5 truncate">
                    {m.hfRepoId}
                  </p>
                </button>
              ))}
            </div>

            {/* Active Model Registry Metadata Summary */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">HF Repo:</span>
                <a
                  href={`https://huggingface.co/${selectedModel.hfRepoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline flex items-center gap-1 truncate"
                >
                  <span>{selectedModel.hfRepoId}</span>
                  <ExternalLink className="size-2.5 shrink-0" />
                </a>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Task &amp; Hosting:</span>
                <span className="text-cyan-300 text-right">
                  {selectedModel.task} · {selectedModel.hostingMethod}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 shrink-0">Endpoint:</span>
                <span className="text-slate-300 text-right break-all text-[10px]">
                  {selectedModel.apiEndpoint}
                </span>
              </div>
            </div>

            {/* Natural Language Prompt (for Qwen2.5-VL VQA) */}
            {selectedModel.task === 'image-text-to-text' && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">
                  Planetary VQA Question:
                </label>
                <input
                  type="text"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Ask Qwen2.5-VL about craters, dunes, boulders, or landing safety..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs font-mono text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Execute Live Inference Button */}
            <button
              type="button"
              onClick={() => void handleRunInference(true)}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  <span>Executing Live Hugging Face Inference...</span>
                </>
              ) : (
                <>
                  <Play className="size-4 fill-slate-950" />
                  <span>Execute {selectedModel.shortName}</span>
                </>
              )}
            </button>
          </div>

          {/* Network Error Banner */}
          {requestError && (
            <div className="p-3.5 rounded-2xl border border-rose-500/40 bg-rose-950/30 text-rose-200 font-mono text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-300">
                <AlertTriangle className="size-4 text-rose-400" />
                <span>Backend API Request Failed</span>
              </div>
              <p className="text-[11px]">{requestError}</p>
            </div>
          )}

          {/* Model Inference Output & Diagnostic Telemetry */}
          {inferenceResult && (
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/85 backdrop-blur-md shadow-xl flex flex-col gap-3">
              {/* Honest Request Status Header (Replaces misleading green Latency on failed/blocked calls) */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  {inferenceResult.status === 'success' && inferenceResult.modelOnlineVerified ? (
                    <CheckCircle2 className="size-4 text-emerald-400" />
                  ) : inferenceResult.status === 'loading' ? (
                    <Clock className="size-4 text-amber-400 animate-pulse" />
                  ) : (
                    <AlertTriangle className="size-4 text-rose-400" />
                  )}
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    {inferenceResult.status === 'success' && inferenceResult.modelOnlineVerified
                      ? 'Model Status: ONLINE'
                      : inferenceResult.status === 'loading'
                        ? 'Model Status: WARMING UP'
                        : !inferenceResult.upstreamCalled
                          ? 'Request Blocked (Pre-Flight)'
                          : 'Inference Request Failed'}
                  </h3>
                </div>

                {inferenceResult.status === 'success' && inferenceResult.modelOnlineVerified ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 font-mono text-[10px] text-emerald-300 font-bold">
                    HTTP {inferenceResult.httpStatus ?? 200} · {inferenceResult.executionTimeMs} ms
                  </span>
                ) : inferenceResult.status === 'loading' ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 font-mono text-[10px] text-amber-300 font-bold">
                    HTTP {inferenceResult.httpStatus ?? 503} · Cold Start
                  </span>
                ) : !inferenceResult.upstreamCalled ? (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold">
                    HTTP {inferenceResult.httpStatus ?? 401} · Not Sent
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold">
                    HTTP {inferenceResult.httpStatus ?? 500} · Failed ({inferenceResult.executionTimeMs} ms)
                  </span>
                )}
              </div>

              {/* Case 1: Model Cold-Starting on Hugging Face (HTTP 503) */}
              {inferenceResult.status === 'loading' && (
                <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-950/25 text-amber-200 font-mono text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Clock className="size-4 text-amber-400 animate-pulse" />
                    <span>
                      Model Warming Up on Hugging Face
                      {inferenceResult.estimatedLoadingSec
                        ? ` (~${inferenceResult.estimatedLoadingSec}s)`
                        : ''}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{inferenceResult.unavailableReason}</p>
                  <button
                    type="button"
                    onClick={() => void handleRunInference(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold cursor-pointer"
                  >
                    Retry Inference Now
                  </button>
                </div>
              )}

              {/* Case 2: Clear HTTP 401 / 403 / 404 / 429 / 500 Error Diagnostics */}
              {(inferenceResult.status === 'unavailable' || inferenceResult.status === 'error') && (() => {
                const errInfo = describeHttpErrorDetails(inferenceResult);
                return (
                  <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/20 text-rose-200 font-mono text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 font-bold text-rose-300">
                        {inferenceResult.errorCode === 'MISSING_HF_TOKEN' ||
                        inferenceResult.httpStatus === 401 ||
                        inferenceResult.httpStatus === 403 ? (
                          <KeyRound className="size-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="size-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <span>{errInfo.title}</span>
                      </div>
                      {inferenceResult.httpStatus && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-500/30 text-rose-300 text-[10px] shrink-0">
                          HTTP {inferenceResult.httpStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-100/90">
                      {inferenceResult.unavailableReason}
                    </p>
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[10px] text-amber-200/90 leading-relaxed">
                      <strong className="text-amber-300">How to Resolve: </strong>
                      {errInfo.remediation}
                    </div>
                    <div className="pt-1.5 border-t border-rose-500/20 text-[10px] text-slate-300 space-y-0.5">
                      <div>Selected Model: <code className="text-amber-300">{inferenceResult.hfRepoUsed}</code></div>
                      <div>Endpoint: <code className="text-cyan-300 break-all">{inferenceResult.endpointUsed}</code></div>
                      <div>Error Code: <code className="text-rose-300">{inferenceResult.errorCode}</code></div>
                    </div>
                  </div>
                );
              })()}

              {/* Case 3: Verified Successful Hugging Face Inference */}
              {inferenceResult.status === 'success' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                    <span className="flex items-center gap-1 font-bold">
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                      ONLINE · Verified Live Output ({inferenceResult.deviceUsed})
                    </span>
                    <span>HTTP {inferenceResult.httpStatus ?? 200}</span>
                  </div>

                  {/* Verified Image & Multimodal Token Receipt */}
                  {inferenceResult.imageDimensions && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[10px] text-slate-300">
                      <span>
                        Image Sent:{' '}
                        <strong className="text-cyan-300">
                          {inferenceResult.imageDimensions.sourceLabel}
                        </strong>{' '}
                        ({inferenceResult.imageDimensions.width}&times;
                        {inferenceResult.imageDimensions.height}px ·{' '}
                        {(inferenceResult.imageDimensions.byteLength / 1024).toFixed(1)} KB
                        {inferenceResult.imageDimensions.sha256Prefix
                          ? ` · SHA-256 ${inferenceResult.imageDimensions.sha256Prefix}`
                          : ''}
                        )
                      </span>
                      {inferenceResult.tokenUsage && (
                        <span className="text-amber-300">
                          Tokens: {inferenceResult.tokenUsage.promptTokens} in /{' '}
                          {inferenceResult.tokenUsage.completionTokens} out
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                    {inferenceResult.predictions.summary}
                  </p>

                  {/* VQA Multimodal Answer */}
                  {inferenceResult.predictions.textAnswer && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 max-h-72 overflow-y-auto">
                      <p className="text-[10px] text-amber-400 uppercase font-bold">
                        {inferenceResult.hfRepoUsed} Real Multimodal Response:
                      </p>
                      <p className="text-[11px] text-slate-200 whitespace-pre-line leading-relaxed">
                        {inferenceResult.predictions.textAnswer}
                      </p>
                    </div>
                  )}

                  {/* Image Classifications */}
                  {inferenceResult.predictions.classifications &&
                    inferenceResult.predictions.classifications.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">
                          Predicted Classes (Sorted by Softmax Score):
                        </p>
                        {inferenceResult.predictions.classifications.map((c, i) => (
                          <div key={i} className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-white font-bold">{c.className}</span>
                              <span className="text-amber-400 font-bold">
                                {(c.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(2, c.confidence * 100))}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-slate-400">{c.geologicalInterpretation}</p>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Object Detection List */}
                  {inferenceResult.predictions.boundingBoxes &&
                    inferenceResult.predictions.boundingBoxes.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">
                          Detected Features ({inferenceResult.predictions.boundingBoxes.length}):
                        </p>
                        {inferenceResult.predictions.boundingBoxes.slice(0, 8).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBox(b)}
                            className="w-full text-left p-2 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-[11px] cursor-pointer"
                          >
                            <span className="text-slate-200 font-semibold">{b.label}</span>
                            <span className="text-amber-400">{(b.confidence * 100).toFixed(1)}%</span>
                          </button>
                        ))}
                      </div>
                    )}

                  {/* Feature Extraction Latent Embeddings */}
                  {inferenceResult.predictions.embeddings && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">
                          Latent Tensor ({inferenceResult.predictions.embeddings.dimensions}-D):
                        </span>
                        <span className="text-emerald-400 font-bold">
                          L2 = {inferenceResult.predictions.embeddings.l2Norm}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500">
                        {inferenceResult.predictions.embeddings.poolingStrategy}
                      </p>
                      <div className="flex flex-wrap gap-1 font-mono text-[9px]">
                        {inferenceResult.predictions.embeddings.sampleVector.map((val, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {val.toFixed(4)}
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

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Droplets className="size-3 text-cyan-400" />
                    NASA SWIM 2.0 Subsurface Ice:
                  </span>
                  <span
                    className={`font-bold ${
                      inferenceResult.scientificValidation.swimIceConsistency.compositeScore > 0
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
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
                  Datum Elevation: {inferenceResult.scientificValidation.molaTopography.datumElevationM}m ·{' '}
                  {inferenceResult.scientificValidation.molaTopography.terrainRoughness}
                </p>
              </div>

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

      <HfModelCardModal
        model={inspectingModelCard}
        onClose={() => setInspectingModelCard(null)}
      />
    </div>
  );
}
