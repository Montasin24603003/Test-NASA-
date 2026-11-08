import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  HF_MARS_MODELS_CATALOG,
  MARS_BENCHMARK_TARGETS,
  MAX_IMAGE_UPLOAD_BYTES,
  buildNasaMarsTrekTileUrl,
  buildScientificValidation,
  type AiInferenceResponse,
  type BoundingBoxPrediction,
  type ClassificationResult,
  type EmbeddingPrediction,
  type HfHostingMethod,
  type HfInferenceErrorCode,
  type HfLiveVerificationRecord,
  type HfModelMetadata,
  type HfModelOperationalStatus,
  type MarsBenchmarkTarget,
  type MarsSensorType,
  type RasterMaskPrediction,
  type SegmentationPolygon,
} from '@/lib/hf-mars-models';

/**
 * Backend-Only Hugging Face Integration & Model Verification Engine
 *
 * SECURITY INVARIANT:
 *   All tokens (`HF_TOKEN` / `HUGGINGFACE_API_KEY` / `HUGGINGFACEHUB_API_TOKEN`) are read
 *   strictly on the server (`process.env`, server `.env` / `.env.local` / `.dev.vars`, or
 *   worker runtime bindings) and NEVER serialized to React frontend JavaScript.
 */

const DEFAULT_TIMEOUT_MS = 35_000;
const HUB_VERIFY_TIMEOUT_MS = 10_000;
const HUB_VERIFY_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export class HfPipelineError extends Error {
  readonly code: HfInferenceErrorCode;
  readonly httpStatus: number;
  readonly estimatedLoadingSec?: number | undefined;

  constructor(
    code: HfInferenceErrorCode,
    message: string,
    httpStatus = 500,
    estimatedLoadingSec?: number | undefined
  ) {
    super(message);
    this.name = 'HfPipelineError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.estimatedLoadingSec = estimatedLoadingSec;
  }
}

// ============================================================================
// Server-Side `.env` / `.env.local` / `.dev.vars` Synchronization
// (Fixes Vite 8 + `@lovable.dev/vite-tanstack-config` ignoring non-VITE_ keys)
// ============================================================================

interface VerifiedModelRuntimeState {
  status: HfModelOperationalStatus;
  httpStatus: number;
  updatedAt: string;
  note: string;
}

const verifiedRuntimeStateByModel = new Map<string, VerifiedModelRuntimeState>();
const watchedEnvFileMtimes = new Map<string, number>();
const envFileManagedKeys = new Map<string, string>(); // key -> filename where loaded from

function decodeEnvFileBytes(buf: Buffer): string {
  // Handle Windows PowerShell `Out-File` / `>` UTF-16LE BOM (FF FE), UTF-16BE BOM (FE FF), & UTF-8 BOM (EF BB BF)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le');
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1]!;
      swapped[i - 1] = buf[i]!;
    }
    return swapped.toString('utf16le');
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8');
  }
  return buf.toString('utf8');
}

function parseServerDotEnvContent(rawText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = rawText.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = withoutExport.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = withoutExport.slice(0, eqIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    // Never overwrite Vite client keys here; strictly manage server keys
    if (key.startsWith('VITE_')) continue;

    let val = withoutExport.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1).trim();
    } else {
      // Strip trailing inline `# comment` on unquoted values
      const hashIdx = val.indexOf(' #');
      if (hashIdx !== -1) {
        val = val.slice(0, hashIdx).trim();
      }
    }

    result[key] = val;
  }

  return result;
}

export function syncServerEnvFiles(): void {
  if (typeof process === 'undefined' || typeof process.cwd !== 'function' || !process.env) {
    return;
  }

  let cwd: string;
  try {
    cwd = process.cwd();
  } catch {
    return;
  }

  // Precedence order (highest priority last when updating managed keys, or `.env.local` > `.env` > `.dev.vars`)
  const candidateFiles = ['.dev.vars', '.env', '.env.local'];
  let anyChanged = false;

  for (const fileName of candidateFiles) {
    const fullPath = path.join(cwd, fileName);
    try {
      if (!existsSync(fullPath)) {
        if (watchedEnvFileMtimes.has(fullPath)) {
          watchedEnvFileMtimes.delete(fullPath);
          anyChanged = true;
        }
        continue;
      }
      const st = statSync(fullPath);
      if (watchedEnvFileMtimes.get(fullPath) !== st.mtimeMs) {
        anyChanged = true;
      }
    } catch {
      // Ignore fs stat failure in restricted serverless sandboxes
    }
  }

  if (!anyChanged && watchedEnvFileMtimes.size > 0) {
    return;
  }

  // Clear previously file-managed keys and stale runtime auth states when `.env` changes
  for (const managedKey of envFileManagedKeys.keys()) {
    delete process.env[managedKey];
  }
  envFileManagedKeys.clear();
  verifiedRuntimeStateByModel.clear();

  for (const fileName of candidateFiles) {
    const fullPath = path.join(cwd, fileName);
    try {
      if (!existsSync(fullPath)) continue;
      const st = statSync(fullPath);
      const rawBuf = readFileSync(fullPath);
      watchedEnvFileMtimes.set(fullPath, st.mtimeMs);

      const parsed = parseServerDotEnvContent(decodeEnvFileBytes(rawBuf));
      for (const [k, v] of Object.entries(parsed)) {
        // Respect genuine OS-level environment variables if already non-empty and not file-managed
        const existingOsVal = process.env[k];
        if (
          existingOsVal !== undefined &&
          existingOsVal.trim() !== '' &&
          !envFileManagedKeys.has(k)
        ) {
          continue;
        }
        if (v !== '') {
          process.env[k] = v;
          envFileManagedKeys.set(k, fileName);
        }
      }
    } catch {
      // Non-fatal in read-only cloud runtimes where env comes directly from process.env
    }
  }
}

function getRuntimeWorkerEnv(key: string): string | undefined {
  const bag = (globalThis as Record<string, unknown>)['__MARS_SERVER_RUNTIME_ENV__'];
  if (!bag || typeof bag !== 'object') return undefined;
  const val = (bag as Record<string, unknown>)[key];
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
}

function getEnv(key: string): string | undefined {
  syncServerEnvFiles();
  if (typeof process !== 'undefined' && process.env) {
    const raw = process.env[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return getRuntimeWorkerEnv(key);
}

function sanitizeTokenValue(rawToken: string): string {
  let cleaned = rawToken.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Strip accidental "Bearer " prefix if user pasted "Bearer hf_..." into .env
  if (/^bearer\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^bearer\s+/i, '').trim();
  }
  return cleaned;
}

export interface BackendTokenStatus {
  token: string | undefined;
  configured: boolean;
  /** Safe telemetry label describing which env var was detected (NEVER contains secret characters) */
  sourceLabel: string;
}

export function getBackendHfTokenInfo(): BackendTokenStatus {
  syncServerEnvFiles();
  const candidateKeys = [
    'HF_TOKEN',
    'HUGGINGFACE_API_KEY',
    'HUGGINGFACEHUB_API_TOKEN',
    'HUGGING_FACE_HUB_TOKEN',
  ] as const;

  for (const key of candidateKeys) {
    const raw = getEnv(key);
    if (raw) {
      const cleaned = sanitizeTokenValue(raw);
      if (cleaned.length > 0) {
        const fileOrigin = envFileManagedKeys.get(key);
        return {
          token: cleaned,
          configured: true,
          sourceLabel: fileOrigin ? `${key} (${fileOrigin})` : `process.env.${key}`,
        };
      }
    }
  }

  return {
    token: undefined,
    configured: false,
    sourceLabel: 'Not set (Add HF_TOKEN to .env or server environment)',
  };
}

export function getBackendHfToken(): string | undefined {
  return getBackendHfTokenInfo().token;
}

// ============================================================================
// Verified Live Inference State Registry
// (Guarantees NO model is marked ONLINE until an actual inference call succeeds!)
// ============================================================================

function recordModelInferenceOutcome(
  modelId: string,
  status: HfModelOperationalStatus,
  httpStatus: number,
  note: string
): void {
  verifiedRuntimeStateByModel.set(modelId, {
    status,
    httpStatus,
    updatedAt: new Date().toISOString(),
    note,
  });
}

function getRequestTimeoutMs(): number {
  const configured = Number(getEnv('HF_REQUEST_TIMEOUT_MS'));
  if (Number.isFinite(configured) && configured >= 5_000 && configured <= 120_000) {
    return configured;
  }
  return DEFAULT_TIMEOUT_MS;
}

/**
 * Strip credentials or query tokens from any URL before displaying in telemetry
 */
function sanitizeEndpointForDisplay(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return rawUrl;
  }
}

export interface ResolvedModelHosting {
  hfRepoId: string;
  hostingMethod: HfHostingMethod;
  /** Actual target URL used server-side */
  targetEndpoint: string;
  /** Sanitized URL safe for UI telemetry */
  displayEndpoint: string;
  customConfigured: boolean;
  modelStatus: HfModelOperationalStatus;
  inferenceAvailability: string;
}

/**
 * Resolve the active Hugging Face hosting method & endpoint for a model.
 * CRITICAL RULE: Never mark `modelStatus: 'online'` until an actual inference request
 * for this model has returned HTTP 200 `status === 'success'`.
 */
export function resolveModelHostingConfig(
  model: HfModelMetadata,
  liveProvidersOverride?: string[] | undefined
): ResolvedModelHosting {
  const tokenInfo = getBackendHfTokenInfo();
  const tokenPresent = tokenInfo.configured;
  const customRepoId = getEnv(model.envVarKeys.repoId);
  const hfRepoId = customRepoId ?? model.hfRepoId;
  const runtimeState = verifiedRuntimeStateByModel.get(model.id);

  const computeEffectiveStatus = (
    requiresToken: boolean,
    defaultConfiguredDesc: string,
    missingTokenDesc: string
  ): { modelStatus: HfModelOperationalStatus; inferenceAvailability: string } => {
    if (requiresToken && !tokenPresent) {
      return {
        modelStatus: 'token_required',
        inferenceAvailability: missingTokenDesc,
      };
    }
    if (runtimeState && !(tokenPresent && runtimeState.status === 'token_required')) {
      return {
        modelStatus: runtimeState.status,
        inferenceAvailability: runtimeState.note,
      };
    }
    return {
      modelStatus: 'configured',
      inferenceAvailability: defaultConfiguredDesc,
    };
  };

  const dedicatedEndpoint = getEnv(model.envVarKeys.endpointUrl);
  if (dedicatedEndpoint) {
    const st = computeEffectiveStatus(
      true,
      `Dedicated Endpoint configured (${tokenInfo.sourceLabel}) — Run live inference test to verify ONLINE`,
      'Dedicated Endpoint URL set — requires HF_TOKEN on backend server'
    );
    return {
      hfRepoId,
      hostingMethod: 'dedicated-endpoint',
      targetEndpoint: dedicatedEndpoint.replace(/\/+$/, ''),
      displayEndpoint: sanitizeEndpointForDisplay(dedicatedEndpoint),
      customConfigured: true,
      modelStatus: st.modelStatus,
      inferenceAvailability: st.inferenceAvailability,
    };
  }

  const spaceUrl = getEnv(model.envVarKeys.spaceUrl) ?? getEnv('HF_SPACE_URL');
  if (spaceUrl) {
    const normalized = spaceUrl.replace(/\/+$/, '');
    const st = computeEffectiveStatus(
      false,
      'Hugging Face Space backend configured — Run live inference test to verify ONLINE',
      ''
    );
    return {
      hfRepoId,
      hostingMethod: 'hf-space',
      targetEndpoint: normalized,
      displayEndpoint: `${sanitizeEndpointForDisplay(normalized)}/infer`,
      customConfigured: true,
      modelStatus: st.modelStatus,
      inferenceAvailability: st.inferenceAvailability,
    };
  }

  const customApiUrl = getEnv(model.envVarKeys.customUrl) ?? getEnv('HF_CUSTOM_API_URL');
  if (customApiUrl) {
    const normalized = customApiUrl.replace(/\/+$/, '');
    const st = computeEffectiveStatus(
      false,
      'Custom hosted model API configured — Run live inference test to verify ONLINE',
      ''
    );
    return {
      hfRepoId,
      hostingMethod: 'custom-api',
      targetEndpoint: normalized,
      displayEndpoint: sanitizeEndpointForDisplay(normalized),
      customConfigured: true,
      modelStatus: st.modelStatus,
      inferenceAvailability: st.inferenceAvailability,
    };
  }

  const hasLiveProvider =
    model.hostingMethod === 'inference-providers' ||
    Boolean(customRepoId) ||
    Boolean(liveProvidersOverride && liveProvidersOverride.length > 0);

  if (hasLiveProvider) {
    const routerUrl =
      model.task === 'image-text-to-text'
        ? 'https://router.huggingface.co/v1/chat/completions'
        : `https://router.huggingface.co/hf-inference/models/${hfRepoId}`;

    const providersName =
      liveProvidersOverride && liveProvidersOverride.length > 0
        ? liveProvidersOverride.join(', ')
        : 'Hugging Face Router';

    const st = computeEffectiveStatus(
      true,
      `HF_TOKEN loaded (${tokenInfo.sourceLabel}) · Provider: ${providersName} — Execute live inference to mark ONLINE`,
      `HF_TOKEN missing on server — Set HF_TOKEN in .env (with "Make calls to Inference Providers" enabled)`
    );

    return {
      hfRepoId,
      hostingMethod: 'inference-providers',
      targetEndpoint: routerUrl,
      displayEndpoint: routerUrl,
      customConfigured: Boolean(customRepoId),
      modelStatus: st.modelStatus,
      inferenceAvailability: st.inferenceAvailability,
    };
  }

  return {
    hfRepoId,
    hostingMethod: 'hub-weights-only',
    targetEndpoint: `https://router.huggingface.co/hf-inference/models/${hfRepoId}`,
    displayEndpoint: `Requires HF_SPACE_URL or ${model.envVarKeys.endpointUrl}`,
    customConfigured: false,
    modelStatus: 'endpoint_required',
    inferenceAvailability: model.inferenceAvailability,
  };
}

// ============================================================================
// Pure-TypeScript Binary Image Header Validation & Dimension Extraction
// ============================================================================

export interface ValidatedImagePayload {
  bytes: Uint8Array;
  mimeType: (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
  width: number;
  height: number;
  byteLength: number;
  sourceLabel: string;
}

export function validateAndInspectImageBytes(
  bytes: Uint8Array,
  sourceLabel: string
): ValidatedImagePayload {
  if (!bytes || bytes.byteLength < 24) {
    throw new HfPipelineError(
      'INVALID_IMAGE_FORMAT',
      'Image payload is empty or truncated (< 24 bytes). Provide a valid JPEG, PNG, or WebP Mars image.',
      400
    );
  }

  if (bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    const mb = (bytes.byteLength / (1024 * 1024)).toFixed(2);
    throw new HfPipelineError(
      'PAYLOAD_TOO_LARGE',
      `Image size (${mb} MB) exceeds the 4.00 MB limit. Please upload a cropped or compressed JPEG/PNG/WebP tile.`,
      413
    );
  }

  // 1. PNG Magic Signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width <= 0 || height <= 0 || width > 16384 || height > 16384) {
      throw new HfPipelineError('INVALID_IMAGE_FORMAT', 'Corrupt PNG IHDR dimensions.', 415);
    }
    return {
      bytes,
      mimeType: 'image/png',
      width,
      height,
      byteLength: bytes.byteLength,
      sourceLabel,
    };
  }

  // 2. JPEG Magic Signature: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let offset = 2;
    const len = bytes.byteLength;
    while (offset + 9 < len) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1]!;
      // Skip padding 0xFF bytes
      if (marker === 0xff) {
        offset++;
        continue;
      }
      // Standalone markers without length
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        offset += 2;
        continue;
      }
      const segmentLen = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
      if (segmentLen < 2 || offset + 2 + segmentLen > len) break;

      // SOF0..SOF15 markers (excluding DHT 0xC4, JPG 0xC8, DAC 0xCC)
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        const height = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
        const width = (bytes[offset + 7]! << 8) | bytes[offset + 8]!;
        if (width > 0 && height > 0) {
          return {
            bytes,
            mimeType: 'image/jpeg',
            width,
            height,
            byteLength: bytes.byteLength,
            sourceLabel,
          };
        }
      }
      offset += 2 + segmentLen;
    }
    // Valid JPEG header even if SOF was progressive/unusual
    return {
      bytes,
      mimeType: 'image/jpeg',
      width: 512,
      height: 512,
      byteLength: bytes.byteLength,
      sourceLabel,
    };
  }

  // 3. WebP Magic Signature: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    let width = 512;
    let height = 512;
    const chunkFourCC = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
    if (chunkFourCC === 'VP8X' && bytes.byteLength >= 30) {
      width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
      height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    } else if (chunkFourCC === 'VP8L' && bytes.byteLength >= 25) {
      const b0 = bytes[21]!;
      const b1 = bytes[22]!;
      const b2 = bytes[23]!;
      const b3 = bytes[24]!;
      width = 1 + (((b1 & 0x3f) << 8) | b0);
      height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    } else if (chunkFourCC === 'VP8 ' && bytes.byteLength >= 30) {
      width = ((bytes[26]! | (bytes[27]! << 8)) & 0x3fff) || 512;
      height = ((bytes[28]! | (bytes[29]! << 8)) & 0x3fff) || 512;
    }
    return {
      bytes,
      mimeType: 'image/webp',
      width,
      height,
      byteLength: bytes.byteLength,
      sourceLabel,
    };
  }

  throw new HfPipelineError(
    'INVALID_IMAGE_FORMAT',
    'Unsupported file signature. Only authentic JPEG (.jpg), PNG (.png), and WebP (.webp) Mars imagery is permitted.',
    415
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HfPipelineError(
        'REQUEST_TIMEOUT',
        `Request timed out after ${Math.round(timeoutMs / 1000)}s while contacting ${sanitizeEndpointForDisplay(url)}.`,
        504
      );
    }
    throw new HfPipelineError(
      'UPSTREAM_ERROR',
      `Network error contacting ${sanitizeEndpointForDisplay(url)}: ${err instanceof Error ? err.message : String(err)}`,
      502
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface ImageLoadOptions {
  imageSource: 'benchmark' | 'nasa-wmts' | 'upload';
  target: MarsBenchmarkTarget;
  customLat?: number | undefined;
  customLon?: number | undefined;
  sensor: MarsSensorType;
  uploadedBase64?: string | undefined;
  uploadedBytes?: Uint8Array | undefined;
  uploadedFileName?: string | undefined;
  requestOrigin: string;
}

export async function loadTargetImageBytes(opts: ImageLoadOptions): Promise<{
  image: ValidatedImagePayload;
  geoBounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  groundSampleDistanceM: number;
  spatialResolution: string;
}> {
  const lat = opts.customLat ?? opts.target.lat;
  const lon = opts.customLon ?? opts.target.lon;

  // 1. Direct User Upload (Base64 Data URI or Multipart File Bytes)
  if (opts.imageSource === 'upload') {
    let rawBytes: Uint8Array | undefined = opts.uploadedBytes;
    if (!rawBytes && opts.uploadedBase64) {
      const cleaned = opts.uploadedBase64.includes(',')
        ? opts.uploadedBase64.slice(opts.uploadedBase64.indexOf(',') + 1)
        : opts.uploadedBase64;
      // Pre-check approximate decoded size before allocating huge buffers
      const estimatedBytes = Math.floor((cleaned.length * 3) / 4);
      if (estimatedBytes > MAX_IMAGE_UPLOAD_BYTES + 4096) {
        throw new HfPipelineError(
          'PAYLOAD_TOO_LARGE',
          `Uploaded image (~${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds the 4.00 MB maximum upload limit.`,
          413
        );
      }
      rawBytes = new Uint8Array(Buffer.from(cleaned, 'base64'));
    }

    if (!rawBytes) {
      throw new HfPipelineError(
        'INVALID_IMAGE_FORMAT',
        'Image source set to "upload", but no image file or base64 data was provided.',
        400
      );
    }

    const gsd = opts.sensor === 'HiRISE' ? 0.25 : opts.sensor === 'CTX' ? 5.0 : opts.sensor === 'THEMIS' ? 100 : 463;
    const validated = validateAndInspectImageBytes(
      rawBytes,
      opts.uploadedFileName ? `Uploaded (${opts.uploadedFileName})` : 'User-Uploaded Mars Image'
    );

    return {
      image: validated,
      geoBounds: opts.target.bounds,
      groundSampleDistanceM: gsd,
      spatialResolution: `${gsd} m/pixel (${opts.sensor} User Scene)`,
    };
  }

  // 2. Live Georeferenced NASA Mars Trek WMTS Tile
  if (opts.imageSource === 'nasa-wmts') {
    const wmts = buildNasaMarsTrekTileUrl(lat, lon, opts.sensor);
    const res = await fetchWithTimeout(
      wmts.tileUrl,
      {
        method: 'GET',
        headers: { Accept: 'image/jpeg,image/png,*/*' },
      },
      15_000
    );

    if (!res.ok) {
      throw new HfPipelineError(
        'IMAGE_FETCH_FAILED',
        `NASA Mars Trek WMTS returned HTTP ${res.status} for layer ${wmts.wmtsLayerId} at (${lat.toFixed(2)}°, ${lon.toFixed(2)}°). Try switching sensor or using the Benchmark Scene.`,
        502
      );
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    const validated = validateAndInspectImageBytes(
      buf,
      `NASA Mars Trek WMTS (${wmts.wmtsLayerId} z${wmts.zoom})`
    );

    return {
      image: validated,
      geoBounds: wmts.tileBounds,
      groundSampleDistanceM: wmts.groundSampleDistanceM,
      spatialResolution: wmts.spatialResolution,
    };
  }

  // 3. Benchmark Scene inside `public/` (Local FS in dev + Origin Fetch fallback on Vercel Serverless)
  const relPath = opts.target.imageUrl.replace(/^\/+/, '');
  let sceneBytes: Uint8Array | null = null;

  try {
    const localDiskPath = path.join(process.cwd(), 'public', relPath);
    const fileBuf = await readFile(localDiskPath);
    sceneBytes = new Uint8Array(fileBuf);
  } catch {
    // On Vercel Serverless, static public assets are hosted on the deployment origin CDN
    const assetUrl = new URL(opts.target.imageUrl, opts.requestOrigin).toString();
    const res = await fetchWithTimeout(assetUrl, { method: 'GET' }, 12_000);
    if (!res.ok) {
      throw new HfPipelineError(
        'IMAGE_FETCH_FAILED',
        `Unable to load NASA benchmark scene ${opts.target.imageUrl} (HTTP ${res.status}).`,
        502
      );
    }
    sceneBytes = new Uint8Array(await res.arrayBuffer());
  }

  const gsd =
    opts.sensor === 'HiRISE'
      ? 0.25
      : opts.sensor === 'CTX'
        ? 5.0
        : opts.sensor === 'THEMIS'
          ? 100
          : 463;
  const validated = validateAndInspectImageBytes(
    sceneBytes,
    `NASA Benchmark (${opts.target.name})`
  );

  return {
    image: validated,
    geoBounds: opts.target.bounds,
    groundSampleDistanceM: gsd,
    spatialResolution: `${gsd} m/pixel (NASA ${opts.sensor})`,
  };
}

// ============================================================================
// Live Hugging Face Hub 7-Model Registry Verification
// ============================================================================

let cachedVerification: {
  timestamp: number;
  records: HfLiveVerificationRecord[];
} | null = null;

const HfHubModelApiSchema = z
  .object({
    id: z.string().optional(),
    pipeline_tag: z.string().nullable().optional(),
    library_name: z.string().nullable().optional(),
    inference: z.string().nullable().optional(),
    inferenceProviderMapping: z
      .record(
        z.string(),
        z.object({
          status: z.string().optional(),
          providerId: z.string().optional(),
          task: z.string().optional(),
        })
      )
      .optional(),
    siblings: z
      .array(
        z.object({
          rfilename: z.string(),
        })
      )
      .optional(),
  })
  .passthrough();

export async function verifyAllSevenModelsLive(
  forceRefresh = false
): Promise<HfLiveVerificationRecord[]> {
  if (
    !forceRefresh &&
    cachedVerification &&
    Date.now() - cachedVerification.timestamp < HUB_VERIFY_CACHE_TTL_MS
  ) {
    // Re-evaluate token/env status dynamically even when Hub metadata is cached
    return cachedVerification.records.map((rec) => {
      const catalogModel = HF_MARS_MODELS_CATALOG.find((m) => m.id === rec.id);
      if (!catalogModel) return rec;
      const resolved = resolveModelHostingConfig(
        catalogModel,
        rec.hubVerification.liveProviders
      );
      return {
        ...rec,
        hfRepoId: resolved.hfRepoId,
        hostingMethod: resolved.hostingMethod,
        apiEndpoint: resolved.displayEndpoint,
        modelStatus: resolved.modelStatus,
        inferenceAvailability: resolved.inferenceAvailability,
      };
    });
  }

  const token = getBackendHfToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const checkedAt = new Date().toISOString();

  const records = await Promise.all(
    HF_MARS_MODELS_CATALOG.map(async (model): Promise<HfLiveVerificationRecord> => {
      const initialResolved = resolveModelHostingConfig(model);
      const repoToProbe = initialResolved.hfRepoId;
      const hubUrl = `https://huggingface.co/api/models/${repoToProbe}?expand[]=inferenceProviderMapping&expand[]=inference&expand[]=pipeline_tag&expand[]=library_name&expand[]=siblings`;

      let hubHttpStatus = 0;
      let repoExists = false;
      let pipelineTag: string | null = null;
      let libraryName: string | null = null;
      let checkpointFiles: string[] = [];
      let liveProviders: string[] = [];
      let diagnosticNote = '';

      try {
        const res = await fetchWithTimeout(hubUrl, { method: 'GET', headers }, HUB_VERIFY_TIMEOUT_MS);
        hubHttpStatus = res.status;

        if (res.ok) {
          repoExists = true;
          const rawJson: unknown = await res.json();
          const parsed = HfHubModelApiSchema.safeParse(rawJson);
          if (parsed.success) {
            pipelineTag = parsed.data.pipeline_tag ?? null;
            libraryName = parsed.data.library_name ?? null;
            checkpointFiles = (parsed.data.siblings ?? [])
              .map((s) => s.rfilename)
              .filter((f) => /\.(safetensors|bin|pth|pt|ckpt|onnx|json)$/i.test(f))
              .slice(0, 8);

            const provMap = parsed.data.inferenceProviderMapping ?? {};
            liveProviders = Object.entries(provMap)
              .filter(([, v]) => v.status === 'live' || v.status === 'staging')
              .map(([provName]) => provName);
          }

          if (liveProviders.length > 0) {
            diagnosticNote = `Verified live on Hugging Face Inference Providers: ${liveProviders.join(', ')}.`;
          } else if (initialResolved.customConfigured) {
            diagnosticNote = `Custom ${initialResolved.hostingMethod} endpoint configured on backend.`;
          } else {
            const hasConfigJson = checkpointFiles.includes('config.json');
            diagnosticNote = hasConfigJson
              ? 'Repo exists with config.json, but no serverless Inference Provider is currently active. Deploy to Dedicated Endpoint or HF Space.'
              : `Repo verified on Hub (${checkpointFiles.join(', ') || 'raw weights'}), but lacks Transformers config.json & active Inference Provider. Requires HF Space (HF_SPACE_URL) or Dedicated Endpoint (${model.envVarKeys.endpointUrl}).`;
          }
        } else {
          diagnosticNote = `Hugging Face Hub returned HTTP ${res.status} for model "${repoToProbe}". Verify repository ID or private repo HF_TOKEN permissions.`;
        }
      } catch (err) {
        diagnosticNote = `Hub metadata probe failed: ${err instanceof Error ? err.message : String(err)}`;
      }

      const finalResolved = resolveModelHostingConfig(model, liveProviders);

      return {
        id: model.id,
        name: model.name,
        shortName: model.shortName,
        hfRepoId: finalResolved.hfRepoId,
        task: model.task,
        hostingMethod: finalResolved.hostingMethod,
        apiEndpoint: finalResolved.displayEndpoint,
        inputFormat: model.inputFormat,
        outputFormat: model.outputFormat,
        modelStatus: repoExists || finalResolved.customConfigured ? finalResolved.modelStatus : 'error',
        inferenceAvailability: finalResolved.inferenceAvailability,
        hubVerification: {
          checkedAt,
          repoExists,
          hubHttpStatus,
          pipelineTag,
          libraryName,
          checkpointFiles,
          liveProviders,
          customEndpointConfigured: finalResolved.customConfigured,
          diagnosticNote,
        },
      };
    })
  );

  cachedVerification = {
    timestamp: Date.now(),
    records,
  };

  return records;
}

export function getSanitizedModelsRegistryForClient(): {
  models: HfModelMetadata[];
  hfTokenConfigured: boolean;
  hfTokenSource: string;
  spaceUrlConfigured: boolean;
} {
  const tokenInfo = getBackendHfTokenInfo();
  const spaceUrlConfigured = Boolean(getEnv('HF_SPACE_URL'));

  const models = HF_MARS_MODELS_CATALOG.map((m) => {
    const cachedRec = cachedVerification?.records.find((r) => r.id === m.id);
    const resolved = resolveModelHostingConfig(
      m,
      cachedRec?.hubVerification.liveProviders
    );
    return {
      ...m,
      hfRepoId: resolved.hfRepoId,
      hfRepo: resolved.hfRepoId,
      hostingMethod: resolved.hostingMethod,
      apiEndpoint: resolved.displayEndpoint,
      modelStatus: resolved.modelStatus,
      inferenceAvailability: resolved.inferenceAvailability,
    };
  });

  return {
    models,
    hfTokenConfigured: tokenInfo.configured,
    hfTokenSource: tokenInfo.sourceLabel,
    spaceUrlConfigured,
  };
}

// ============================================================================
// Zod Schemas for Validating Real Hugging Face API Responses
// ============================================================================

const HfSegmentationItemSchema = z.object({
  label: z.string(),
  score: z.number().nullable().optional(),
  mask: z.string().min(16),
});
const HfSegmentationArraySchema = z.array(HfSegmentationItemSchema);

const HfDetectionItemSchema = z.object({
  label: z.string(),
  score: z.number(),
  box: z.object({
    xmin: z.number(),
    ymin: z.number(),
    xmax: z.number(),
    ymax: z.number(),
  }),
});
const HfDetectionArraySchema = z.array(HfDetectionItemSchema);

const HfClassificationItemSchema = z.object({
  label: z.string(),
  score: z.number(),
});
const HfClassificationArraySchema = z.array(HfClassificationItemSchema);

const HfChatCompletionSchema = z
  .object({
    id: z.string().optional(),
    model: z.string().optional(),
    choices: z
      .array(
        z.object({
          finish_reason: z.string().nullable().optional(),
          message: z.object({
            content: z.union([
              z.string(),
              z.array(
                z
                  .object({
                    type: z.string().optional(),
                    text: z.string().optional(),
                  })
                  .passthrough()
              ),
            ]),
          }),
        })
      )
      .min(1),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();

const HfSpaceUnifiedResponseSchema = z
  .object({
    provider: z.string().optional(),
    masks: HfSegmentationArraySchema.optional(),
    polygons: z
      .array(
        z.object({
          id: z.string(),
          classId: z.number(),
          className: z.string(),
          color: z.string(),
          confidence: z.number(),
          points: z.array(z.tuple([z.number(), z.number()])),
          areaSqMeters: z.number().optional(),
        })
      )
      .optional(),
    boxes: HfDetectionArraySchema.optional(),
    classifications: HfClassificationArraySchema.optional(),
    embedding: z.array(z.number()).optional(),
    text: z.string().optional(),
  })
  .passthrough();

// ============================================================================
// Token Permission & Upstream HTTP Error Parser (Explicit 401/403/404/429/500)
// ============================================================================

async function diagnoseHfTokenPermissions(hfToken: string | undefined): Promise<{
  tokenValidOnHub: boolean;
  missingInferenceProvidersScope: boolean;
  diagnosticDetail: string;
}> {
  if (!hfToken) {
    return {
      tokenValidOnHub: false,
      missingInferenceProvidersScope: false,
      diagnosticDetail: 'HF_TOKEN is not set on server.',
    };
  }

  try {
    const res = await fetchWithTimeout(
      'https://huggingface.co/api/whoami-v2',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          Accept: 'application/json',
        },
      },
      5_000
    );

    if (res.status === 401) {
      return {
        tokenValidOnHub: false,
        missingInferenceProvidersScope: false,
        diagnosticDetail:
          'Token failed Hugging Face /api/whoami-v2 check (invalid, malformed, expired, or revoked token).',
      };
    }

    if (res.ok) {
      const info = (await res.json()) as {
        auth?: {
          accessToken?: {
            role?: string;
            fineGrained?: {
              global?: string[];
              scoped?: Array<{ permissions?: string[] }>;
            };
          };
        };
      };
      const accessToken = info.auth?.accessToken;
      if (accessToken?.role === 'fineGrained' && accessToken.fineGrained) {
        const globalPerms = accessToken.fineGrained.global ?? [];
        const scopedPerms = (accessToken.fineGrained.scoped ?? []).flatMap(
          (s) => s.permissions ?? []
        );
        const hasInferencePerm =
          globalPerms.includes('inference.serverless.write') ||
          scopedPerms.includes('inference.serverless.write') ||
          globalPerms.includes('inference.endpoints.infer.write') ||
          scopedPerms.includes('inference.endpoints.infer.write');

        if (!hasInferencePerm) {
          return {
            tokenValidOnHub: true,
            missingInferenceProvidersScope: true,
            diagnosticDetail:
              'Fine-grained HF_TOKEN authenticated on Hub, but is missing the "Make calls to Inference Providers" (inference.serverless.write) permission.',
          };
        }
      }
      return {
        tokenValidOnHub: true,
        missingInferenceProvidersScope: false,
        diagnosticDetail:
          'Token is valid and carries Inference Providers scope; check Hugging Face Inference credit balance or gated model terms.',
      };
    }
  } catch {
    // Non-fatal fallback if whoami-v2 cannot be reached
  }

  return {
    tokenValidOnHub: false,
    missingInferenceProvidersScope: false,
    diagnosticDetail: '',
  };
}

async function parseUpstreamHttpError(
  res: Response,
  model: HfModelMetadata,
  resolved: ResolvedModelHosting,
  hfToken?: string | undefined
): Promise<HfPipelineError> {
  const rawBody = await res.text().catch(() => '');
  let detailMsg = rawBody.slice(0, 320).trim();
  let estimatedTime: number | undefined;

  try {
    const parsed = JSON.parse(rawBody) as {
      error?: string | { message?: string; code?: string };
      message?: string;
      estimated_time?: number;
    };
    if (typeof parsed.estimated_time === 'number') {
      estimatedTime = Math.ceil(parsed.estimated_time);
    }
    if (typeof parsed.error === 'string') {
      detailMsg = parsed.error;
    } else if (parsed.error && typeof parsed.error.message === 'string') {
      detailMsg = parsed.error.message;
    } else if (typeof parsed.message === 'string') {
      detailMsg = parsed.message;
    }
  } catch {
    if (rawBody.trim().startsWith('<!DOCTYPE') || rawBody.trim().startsWith('<html')) {
      detailMsg = `Upstream HTML ${res.status} gateway response`;
    }
  }

  // HTTP 401 — Unauthorized (Invalid, missing, expired, or revoked HF_TOKEN)
  if (res.status === 401) {
    const probe = await diagnoseHfTokenPermissions(hfToken);
    const scopeHint = probe.missingInferenceProvidersScope
      ? ` ${probe.diagnosticDetail}`
      : ' Verify that HF_TOKEN in .env starts with "hf_", has no extra quotes/spaces, is not expired or revoked, and has "Make calls to Inference Providers" enabled at https://huggingface.co/settings/tokens.';
    return new HfPipelineError(
      'HTTP_401_UNAUTHORIZED',
      `HTTP 401 Unauthorized — Hugging Face rejected authentication for "${resolved.hfRepoId}" on ${resolved.displayEndpoint}.${scopeHint}${detailMsg ? ` (Upstream: ${detailMsg})` : ''}`,
      401
    );
  }

  // HTTP 402 — Payment Required (Pre-paid Inference Credits / PRO Subscription Required)
  if (res.status === 402) {
    return new HfPipelineError(
      'HTTP_402_PAYMENT_REQUIRED',
      `HTTP 402 Payment Required — Hugging Face Inference Providers require pre-paid compute credits or a PRO subscription on account to query "${resolved.hfRepoId}". Add credits at https://huggingface.co/settings/billing or deploy the included free Hugging Face Space (./hf-mars-space) and configure HF_SPACE_URL.${detailMsg ? ` (Upstream: ${detailMsg})` : ''}`,
      402
    );
  }

  // HTTP 403 — Forbidden (Missing Inference Providers scope, gated model, or out of credits)
  if (res.status === 403) {
    const probe = await diagnoseHfTokenPermissions(hfToken);
    const scopeHint = probe.diagnosticDetail
      ? ` ${probe.diagnosticDetail}`
      : ' Your HF_TOKEN lacks permission for this endpoint.';
    return new HfPipelineError(
      'HTTP_403_FORBIDDEN',
      `HTTP 403 Forbidden — Access denied by Hugging Face Inference Providers for "${resolved.hfRepoId}".${scopeHint} Open https://huggingface.co/settings/tokens, edit your Fine-Grained Token to enable "Make calls to Inference Providers", and verify your Hugging Face Inference credits / model license agreement.${detailMsg ? ` (Upstream: ${detailMsg})` : ''}`,
      403
    );
  }

  // HTTP 404 — Not Found (Model repo missing or no Inference Provider route deployed)
  if (res.status === 404) {
    return new HfPipelineError(
      'HTTP_404_NOT_FOUND',
      `HTTP 404 Not Found — Model "${resolved.hfRepoId}" or route ${resolved.displayEndpoint} was not found on any active Hugging Face Inference Provider. Hosting raw checkpoints (${model.checkpointFormat}) on Hugging Face Hub does not automatically deploy an HTTP Inference API; deploy ./hf-mars-space (HF_SPACE_URL) or a Dedicated Endpoint (${model.envVarKeys.endpointUrl}).${detailMsg ? ` (Upstream: ${detailMsg})` : ''}`,
      404
    );
  }

  // HTTP 429 — Too Many Requests (Rate limit or compute credit quota exceeded)
  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    const retryHint = retryAfter ? ` Retry after ${retryAfter}s.` : ' Wait 30–60 seconds before retrying.';
    return new HfPipelineError(
      'HTTP_429_RATE_LIMITED',
      `HTTP 429 Too Many Requests — Hugging Face Inference Provider rate limit or monthly compute quota exceeded on "${resolved.hfRepoId}".${retryHint} Consider upgrading Hugging Face Inference credits or configuring a Dedicated Endpoint.${detailMsg ? ` (Upstream: ${detailMsg})` : ''}`,
      429
    );
  }

  // HTTP 503 — Model Cold-Starting / Warming Up
  if (res.status === 503) {
    const waitNote = estimatedTime ? ` (~${estimatedTime}s estimated warm-up)` : '';
    return new HfPipelineError(
      'MODEL_LOADING',
      `HTTP 503 Service Warming Up — Model "${resolved.hfRepoId}" is cold-starting on Hugging Face${waitNote}. Retry in a few seconds.`,
      503,
      estimatedTime
    );
  }

  // HTTP 500 / 502 / 504 — Upstream Inference Server / Runtime Error
  if (res.status >= 500) {
    return new HfPipelineError(
      'HTTP_500_SERVER_ERROR',
      `HTTP ${res.status} Server Error — Hugging Face's upstream inference runtime failed while executing "${resolved.hfRepoId}" at ${resolved.displayEndpoint}: ${detailMsg || res.statusText || 'Internal provider runtime error'}. Retry the request or check provider status.`,
      res.status
    );
  }

  return new HfPipelineError(
    'UPSTREAM_ERROR',
    `HTTP ${res.status} Request Error for "${resolved.hfRepoId}": ${detailMsg || res.statusText}`,
    res.status
  );
}

// ============================================================================
// Planetary Domain Mapping Helpers (Applied ONLY to Real Validated HF Outputs)
// ============================================================================

const SEGMENTATION_PALETTE = [
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#a855f7', // Violet
  '#3b82f6', // Blue
  '#ec4899', // Pink
];

function interpretSegmentationLabelForMars(rawLabel: string): {
  interpretation: string;
  color: string;
} {
  const lower = rawLabel.toLowerCase();
  if (lower.includes('crater') || lower.includes('pit') || lower.includes('hole')) {
    return { interpretation: 'Impact Crater Rim / Cavity Morphology', color: '#f59e0b' };
  }
  if (lower.includes('mountain') || lower.includes('cliff') || lower.includes('hill') || lower.includes('rock') || lower.includes('stone') || lower.includes('boulder')) {
    return { interpretation: 'High-Relief Scarp / Exposed Bedrock Outcrop (Elevated Slope Risk)', color: '#ef4444' };
  }
  if (lower.includes('sand') || lower.includes('dune') || lower.includes('field') || lower.includes('dirt')) {
    return { interpretation: 'Unconsolidated Aeolian Regolith / Sand Drift (Wheel Slip Caution)', color: '#eab308' };
  }
  if (lower.includes('earth') || lower.includes('ground') || lower.includes('floor') || lower.includes('road') || lower.includes('path') || lower.includes('land') || lower.includes('plain')) {
    return { interpretation: 'Consolidated Planar Regolith Surface (Candidate Rover Corridor)', color: '#10b981' };
  }
  if (lower.includes('sky') || lower.includes('horizon') || lower.includes('background') || lower.includes('wall')) {
    return { interpretation: 'Shadowed Basin / Upper Horizon Boundary', color: '#06b6d4' };
  }
  return { interpretation: `Segmented Optical Surface Unit ("${rawLabel}")`, color: '#a855f7' };
}

function interpretClassificationForMars(rawLabel: string, modelId: string): {
  scientificDescription: string;
  geologicalInterpretation: string;
} {
  const lower = rawLabel.toLowerCase();
  if (modelId === 'mars-bench-frost' || lower.includes('frost') || lower.includes('ice') || lower.includes('snow')) {
    const isFrost = lower.includes('frost') || lower.includes('ice') || lower.includes('positive');
    return {
      scientificDescription: isFrost
        ? 'High-albedo optical surface volatile signature'
        : 'Low/moderate optical reflectance regolith background',
      geologicalInterpretation: isFrost
        ? 'Consistent with thin seasonal CO2/H2O surface frost; verify subsurface ice independently via SHARAD/SWIM'
        : 'Bare basaltic or dust-mantled Martian surface without visible frost condensation',
    };
  }
  if (lower.includes('crater')) {
    return {
      scientificDescription: 'Circular impact depression and ejecta rim morphology',
      geologicalInterpretation: 'Ballistic impact excavation into crustal stratigraphy',
    };
  }
  if (lower.includes('dune') || lower.includes('ripple') || lower.includes('sand')) {
    return {
      scientificDescription: 'Wind-transported aeolian bedforms',
      geologicalInterpretation: 'Active or indurated basaltic sand transport corridor; slip hazard for wheeled rovers',
    };
  }
  if (lower.includes('streak') || lower.includes('gully') || lower.includes('landslide') || lower.includes('scarp')) {
    return {
      scientificDescription: 'Gravity-driven mass wasting slope feature',
      geologicalInterpretation: 'Steep topographic gradient (>15°) experiencing dry dust avalanching or debris flow',
    };
  }
  return {
    scientificDescription: `Optical classification label: ${rawLabel}`,
    geologicalInterpretation: 'Probabilistic visual surface pattern extracted by Hugging Face classifier',
  };
}

function flattenAndPoolEmbedding(raw: unknown): EmbeddingPrediction {
  // Handle 1D `number[]`, 2D `number[][]` ([tokens, dim]), or 3D `number[][][]` ([batch, tokens, dim])
  let vectors2D: number[][] = [];

  if (Array.isArray(raw) && raw.length > 0) {
    if (typeof raw[0] === 'number') {
      vectors2D = [raw as number[]];
    } else if (Array.isArray(raw[0]) && raw[0].length > 0) {
      if (typeof raw[0][0] === 'number') {
        vectors2D = raw as number[][];
      } else if (Array.isArray(raw[0][0]) && typeof raw[0][0][0] === 'number') {
        vectors2D = raw[0] as number[][];
      }
    }
  }

  if (vectors2D.length === 0 || vectors2D[0]!.length === 0) {
    throw new HfPipelineError(
      'INVALID_RESPONSE_SCHEMA',
      'Feature extraction endpoint did not return a valid numeric embedding tensor.',
      502
    );
  }

  const dim = vectors2D[0]!.length;
  const pooled = new Array<number>(dim).fill(0);
  for (const tokenVec of vectors2D) {
    for (let i = 0; i < dim; i++) {
      pooled[i] = (pooled[i] ?? 0) + (Number(tokenVec[i]) || 0);
    }
  }
  for (let i = 0; i < dim; i++) {
    pooled[i] = pooled[i]! / vectors2D.length;
  }

  let sumSq = 0;
  for (const v of pooled) sumSq += v * v;
  const l2Norm = Math.sqrt(sumSq) || 1;
  const normalized = pooled.map((v) => +(v / l2Norm).toFixed(5));

  return {
    dimensions: dim,
    l2Norm: +l2Norm.toFixed(4),
    sampleVector: normalized.slice(0, 16),
    poolingStrategy:
      vectors2D.length > 1
        ? `Mean-pooled across ${vectors2D.length} spatial ViT tokens + L2 normalized`
        : 'CLS / Global representation L2 normalized',
  };
}

// ============================================================================
// Main Real Hugging Face Inference Execution Function
// ============================================================================

export interface RunRealInferenceParams {
  modelId: string;
  targetId: string;
  sensor: MarsSensorType;
  imageSource: 'benchmark' | 'nasa-wmts' | 'upload';
  userPrompt?: string | undefined;
  customLat?: number | undefined;
  customLon?: number | undefined;
  customLocationName?: string | undefined;
  uploadedBase64?: string | undefined;
  uploadedBytes?: Uint8Array | undefined;
  uploadedFileName?: string | undefined;
  requestOrigin: string;
}

export async function runRealHfModelInference(
  params: RunRealInferenceParams
): Promise<AiInferenceResponse> {
  const startTime = Date.now();
  const model = HF_MARS_MODELS_CATALOG.find((m) => m.id === params.modelId);
  if (!model) {
    throw new HfPipelineError(
      'MODEL_NOT_FOUND',
      `Unknown model ID "${params.modelId}" requested.`,
      400
    );
  }

  const target =
    MARS_BENCHMARK_TARGETS.find((t) => t.id === params.targetId) ??
    MARS_BENCHMARK_TARGETS[0]!;

  const targetLat = params.customLat ?? target.lat;
  const targetLon = params.customLon ?? target.lon;
  const targetName = params.customLocationName ?? target.name;
  const scientificValidation = buildScientificValidation(
    targetLat,
    targetLon,
    params.customLat !== undefined ? undefined : target
  );

  // Step 1: Load & strictly validate real Mars image bytes on backend
  const loaded = await loadTargetImageBytes({
    imageSource: params.imageSource,
    target,
    customLat: params.customLat,
    customLon: params.customLon,
    sensor: params.sensor,
    uploadedBase64: params.uploadedBase64,
    uploadedBytes: params.uploadedBytes,
    uploadedFileName: params.uploadedFileName,
    requestOrigin: params.requestOrigin,
  });

  // Compute SHA-256 digest prefix of the exact validated image bytes
  const imageSha256Prefix = createHash('sha256')
    .update(loaded.image.bytes)
    .digest('hex')
    .slice(0, 12);

  // Step 2: Resolve Hosting Method & Check Live Hub Providers
  let liveProviders: string[] | undefined;
  const cachedRec = cachedVerification?.records.find((r) => r.id === model.id);
  if (cachedRec) {
    liveProviders = cachedRec.hubVerification.liveProviders;
  }
  let resolved = resolveModelHostingConfig(model, liveProviders);

  // Probe Hub provider mapping once if uncached (both for hub-weights-only and provider fallback tags)
  if (!cachedRec) {
    const records = await verifyAllSevenModelsLive(false);
    const freshRec = records.find((r) => r.id === model.id);
    liveProviders = freshRec?.hubVerification.liveProviders;
    resolved = resolveModelHostingConfig(model, liveProviders);
  }

  const tokenInfo = getBackendHfTokenInfo();
  const hfToken = tokenInfo.token;
  const timeoutMs = getRequestTimeoutMs();

  // Helper to construct unavailable/error response without fabricating predictions or fake green latency
  const buildNonSuccessResponse = (
    status: 'unavailable' | 'loading' | 'error',
    errorCode: HfInferenceErrorCode,
    reason: string,
    httpStatus?: number | undefined,
    upstreamCalled = false,
    estimatedLoadingSec?: number | undefined
  ): AiInferenceResponse => ({
    modelId: model.id,
    modelName: model.name,
    hfRepoUsed: resolved.hfRepoId,
    task: model.task,
    hostingMethodUsed: resolved.hostingMethod,
    endpointUsed: resolved.displayEndpoint,
    httpStatus,
    upstreamCalled,
    modelOnlineVerified: false,
    status,
    errorCode,
    estimatedLoadingSec,
    executionTimeMs: Date.now() - startTime,
    deviceUsed: upstreamCalled
      ? `Hugging Face Upstream Error (HTTP ${httpStatus ?? 500})`
      : 'Request Blocked Before Upstream Call',
    timestamp: new Date().toISOString(),
    isCached: false,
    unavailableReason: reason,
    imageDimensions: {
      width: loaded.image.width,
      height: loaded.image.height,
      mimeType: loaded.image.mimeType,
      byteLength: loaded.image.byteLength,
      sourceLabel: loaded.image.sourceLabel,
      sha256Prefix: imageSha256Prefix,
      sentToModel: upstreamCalled,
    },
    targetLocation: {
      lat: targetLat,
      lon: targetLon,
      name: params.imageSource === 'upload' ? loaded.image.sourceLabel : targetName,
      elevationM: target.elevationMeters,
    },
    sensorUsed: params.sensor,
    spatialResolution: loaded.spatialResolution,
    groundSampleDistanceM: loaded.groundSampleDistanceM,
    predictions: {
      summary: reason,
      overallConfidence: 0,
    },
    scientificValidation,
  });

  // Step 3: Guard against weights-only Hub checkpoints when no Space/Endpoint is configured
  if (resolved.hostingMethod === 'hub-weights-only') {
    const msg = `HTTP 404 Not Found (No Active Inference Provider) — Repository "${resolved.hfRepoId}" exists on Hugging Face Hub (${model.checkpointFormat}), but lacks a Transformers config.json pipeline and has 0 active serverless Inference Providers. Deploy the included Space server (./hf-mars-space) and set HF_SPACE_URL, or configure a Dedicated Endpoint (${model.envVarKeys.endpointUrl}).`;
    recordModelInferenceOutcome(model.id, 'endpoint_required', 404, msg);
    return buildNonSuccessResponse('unavailable', 'HTTP_404_NOT_FOUND', msg, 404, false);
  }

  // Step 4: Require HF_TOKEN for Hugging Face Inference Providers & Dedicated Endpoints
  if (
    (resolved.hostingMethod === 'inference-providers' ||
      resolved.hostingMethod === 'dedicated-endpoint') &&
    !hfToken
  ) {
    const msg = `HTTP 401 Unauthorized (MISSING_HF_TOKEN) — HF_TOKEN was not detected in backend server environment. Add HF_TOKEN=hf_... (with "Make calls to Inference Providers" enabled at https://huggingface.co/settings/tokens) to .env in your project root (or Vercel Environment Variables) and run inference again.`;
    recordModelInferenceOutcome(model.id, 'token_required', 401, msg);
    return buildNonSuccessResponse('unavailable', 'MISSING_HF_TOKEN', msg, 401, false);
  }

  let upstreamDispatched = false;

  try {
    const base64Image = Buffer.from(loaded.image.bytes).toString('base64');
    const dataUri = `data:${loaded.image.mimeType};base64,${base64Image}`;

    let rawResult: unknown;
    let httpStatus = 200;
    let providerUsed: string = resolved.hostingMethod;
    let upstreamModelIdUsed = resolved.hfRepoId;
    let tokenUsage:
      | { promptTokens: number; completionTokens: number; totalTokens: number }
      | undefined;

    // ========================================================================
    // HOSTING PATH A: Hugging Face Space (`/infer` FastAPI or Gradio v4/v5)
    // ========================================================================
    if (resolved.hostingMethod === 'hf-space') {
      const spaceHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (hfToken) {
        spaceHeaders['Authorization'] = `Bearer ${hfToken}`;
      }

      upstreamDispatched = true;
      const fastApiUrl = `${resolved.targetEndpoint}/infer`;
      const spaceRes = await fetchWithTimeout(
        fastApiUrl,
        {
          method: 'POST',
          headers: spaceHeaders,
          body: JSON.stringify({
            model_id: model.id,
            hf_repo_id: resolved.hfRepoId,
            task: model.task,
            image_base64: base64Image,
            mime_type: loaded.image.mimeType,
            sensor: params.sensor,
            prompt:
              params.userPrompt ||
              `Analyze Martian ${params.sensor} orbital terrain.`,
          }),
        },
        timeoutMs
      );

      if (spaceRes.status === 404) {
        // Fallback to Gradio v4/v5 `/gradio_api/call/predict` protocol
        const gradioCallRes = await fetchWithTimeout(
          `${resolved.targetEndpoint}/gradio_api/call/predict`,
          {
            method: 'POST',
            headers: spaceHeaders,
            body: JSON.stringify({
              data: [model.id, dataUri, params.sensor, params.userPrompt || ''],
            }),
          },
          timeoutMs
        );
        if (!gradioCallRes.ok) {
          throw await parseUpstreamHttpError(gradioCallRes, model, resolved, hfToken);
        }
        const { event_id } = (await gradioCallRes.json()) as { event_id?: string };
        if (!event_id) {
          throw new HfPipelineError(
            'INVALID_RESPONSE_SCHEMA',
            'Gradio Space did not return an event_id.',
            502
          );
        }
        const sseRes = await fetchWithTimeout(
          `${resolved.targetEndpoint}/gradio_api/call/predict/${event_id}`,
          { method: 'GET', headers: hfToken ? { Authorization: `Bearer ${hfToken}` } : {} },
          timeoutMs
        );
        if (!sseRes.ok) {
          throw await parseUpstreamHttpError(sseRes, model, resolved, hfToken);
        }
        const sseText = await sseRes.text();
        const dataLine = sseText
          .split('\n')
          .reverse()
          .find((l) => l.startsWith('data: '));
        if (!dataLine) {
          throw new HfPipelineError(
            'INVALID_RESPONSE_SCHEMA',
            'Gradio Space stream completed without a data payload.',
            502
          );
        }
        const parsedGradio = JSON.parse(dataLine.slice(6)) as unknown[];
        rawResult = Array.isArray(parsedGradio) ? parsedGradio[0] : parsedGradio;
        providerUsed = 'hf-space (gradio)';
      } else if (!spaceRes.ok) {
        throw await parseUpstreamHttpError(spaceRes, model, resolved, hfToken);
      } else {
        httpStatus = spaceRes.status;
        rawResult = await spaceRes.json();
        providerUsed = 'hf-space (fastapi)';
      }
    }
    // ========================================================================
    // HOSTING PATH B: Custom Hosted Model REST API
    // ========================================================================
    else if (resolved.hostingMethod === 'custom-api') {
      const customKey = getEnv('HF_CUSTOM_API_KEY') ?? hfToken;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (customKey) {
        headers['Authorization'] = `Bearer ${customKey}`;
      }
      upstreamDispatched = true;
      const res = await fetchWithTimeout(
        resolved.targetEndpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            modelId: model.id,
            hfRepoId: resolved.hfRepoId,
            task: model.task,
            imageBase64: base64Image,
            mimeType: loaded.image.mimeType,
            sensor: params.sensor,
            prompt: params.userPrompt,
          }),
        },
        timeoutMs
      );
      if (!res.ok) {
        throw await parseUpstreamHttpError(res, model, resolved, customKey);
      }
      httpStatus = res.status;
      rawResult = await res.json();
      providerUsed = 'custom-api';
    }
    // ========================================================================
    // HOSTING PATH C: Multimodal Vision-Language Router (`/v1/chat/completions`)
    // Per Official Hugging Face Inference Providers Multimodal Spec (`Qwen2.5-VL`)
    // ========================================================================
    else if (
      model.task === 'image-text-to-text' &&
      (resolved.hostingMethod === 'inference-providers' ||
        resolved.targetEndpoint.endsWith('/chat/completions'))
    ) {
      const vqaPrompt =
        params.userPrompt?.trim() ||
        'Identify observable Martian geological features, craters, boulders, aeolian bedforms, and rover traversal hazards visible in this image.';

      // CRITICAL: When user uploads a custom image (`imageSource === 'upload'`), ground the prompt
      // strictly on the uploaded image pixels rather than injecting a preset crater name!
      const groundedInstruction =
        params.imageSource === 'upload'
          ? `You are a planetary geology and Mars rover operations specialist analyzing a user-uploaded image (${loaded.image.sourceLabel}, ${loaded.image.width}x${loaded.image.height}px, ${loaded.image.mimeType}). Inspect ONLY the actual visual features present in the attached image without assuming any preset location name. Describe observable landforms, craters, scarps, dunes, rocks/boulders, and rover traversal considerations. Explicitly note that optical imagery alone cannot confirm subsurface water ice without radar (SHARAD/SWIM).\n\nQuestion: ${vqaPrompt}`
          : `You are a planetary geology and Mars rover operations specialist analyzing NASA ${params.sensor} Mars imagery (${loaded.spatialResolution}) covering ${targetName} (${targetLat.toFixed(2)}°, ${targetLon.toFixed(2)}°). Describe observable optical morphology, craters, scarps, dunes, and boulders visible in the attached image. Explicitly note that optical imagery alone cannot confirm subsurface water ice without radar (SHARAD/SWIM).\n\nQuestion: ${vqaPrompt}`;

      const buildMultimodalChatPayload = (modelIdentifier: string) => ({
        model: modelIdentifier,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: groundedInstruction,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUri,
                },
              },
            ],
          },
        ],
        max_tokens: 512,
        temperature: 0.2,
        stream: false,
      });

      const sendChatCompletion = (modelIdentifier: string) =>
        fetchWithTimeout(
          resolved.targetEndpoint,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(buildMultimodalChatPayload(modelIdentifier)),
          },
          timeoutMs
        );

      upstreamDispatched = true;
      let res = await sendChatCompletion(resolved.hfRepoId);

      // If HF Router requires an explicit provider suffix (e.g. `:featherless-ai`), retry once automatically
      if (
        res.status === 400 &&
        !resolved.hfRepoId.includes(':') &&
        liveProviders &&
        liveProviders.length > 0
      ) {
        const providerTaggedModel = `${resolved.hfRepoId}:${liveProviders[0]}`;
        const retryRes = await sendChatCompletion(providerTaggedModel);
        if (retryRes.ok || retryRes.status !== 400) {
          res = retryRes;
          upstreamModelIdUsed = providerTaggedModel;
        }
      }

      if (!res.ok) {
        throw await parseUpstreamHttpError(res, model, resolved, hfToken);
      }

      httpStatus = res.status;
      rawResult = await res.json();
      providerUsed =
        res.headers.get('x-inference-provider') ??
        (liveProviders && liveProviders.length > 0
          ? `hf-router (${liveProviders[0]})`
          : 'hf-router/v1');
    }
    // ========================================================================
    // HOSTING PATH D: Inference Providers (`router.huggingface.co/hf-inference`)
    //                 OR Dedicated Inference Endpoints (`*.endpoints.huggingface.cloud`)
    // ========================================================================
    else {
      upstreamDispatched = true;
      let res = await fetchWithTimeout(
        resolved.targetEndpoint,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': loaded.image.mimeType,
            Accept: 'application/json',
          },
          body: Buffer.from(loaded.image.bytes),
        },
        timeoutMs
      );

      // Dedicated Endpoints running custom `handler.py` sometimes expect JSON `{ inputs: base64 }`
      if (
        resolved.hostingMethod === 'dedicated-endpoint' &&
        (res.status === 400 || res.status === 415 || res.status === 422)
      ) {
        res = await fetchWithTimeout(
          resolved.targetEndpoint,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              inputs: base64Image,
              parameters: {
                task: model.task,
                sensor: params.sensor,
                prompt: params.userPrompt,
              },
            }),
          },
          timeoutMs
        );
      }

      if (!res.ok) {
        throw await parseUpstreamHttpError(res, model, resolved, hfToken);
      }
      httpStatus = res.status;
      rawResult = await res.json();
      providerUsed =
        res.headers.get('x-inference-provider') ??
        (resolved.hostingMethod === 'dedicated-endpoint'
          ? 'hf-dedicated-endpoint'
          : 'hf-inference');
    }

    // ========================================================================
    // Step 5: Strict Response Schema Validation & Planetary Georeferencing
    // ========================================================================
    const { minLat, maxLat, minLon, maxLon } = loaded.geoBounds;
    const projectBoxToGeo = (ymin: number, xmin: number, ymax: number, xmax: number) => ({
      minLat: +(maxLat - ymax * (maxLat - minLat)).toFixed(4),
      maxLat: +(maxLat - ymin * (maxLat - minLat)).toFixed(4),
      minLon: +(minLon + xmin * (maxLon - minLon)).toFixed(4),
      maxLon: +(minLon + xmax * (maxLon - minLon)).toFixed(4),
    });

    let summary = '';
    let overallConfidence = 0;
    let boundingBoxes: BoundingBoxPrediction[] | undefined;
    let rasterMasks: RasterMaskPrediction[] | undefined;
    let segmentationMasks: SegmentationPolygon[] | undefined;
    let classifications: ClassificationResult[] | undefined;
    let embeddings: EmbeddingPrediction | undefined;
    let textAnswer: string | undefined;

    // Unwrap unified HF Space envelope if returned by `./hf-mars-space`
    const spaceEnvelope = HfSpaceUnifiedResponseSchema.safeParse(rawResult);
    const hasSpaceFields =
      spaceEnvelope.success &&
      (spaceEnvelope.data.masks !== undefined ||
        spaceEnvelope.data.boxes !== undefined ||
        spaceEnvelope.data.classifications !== undefined ||
        spaceEnvelope.data.embedding !== undefined ||
        spaceEnvelope.data.text !== undefined);

    if (model.task === 'image-segmentation') {
      const segSource = hasSpaceFields && spaceEnvelope.data.masks
        ? spaceEnvelope.data.masks
        : rawResult;
      const parsed = HfSegmentationArraySchema.safeParse(segSource);
      if (!parsed.success) {
        throw new HfPipelineError(
          'INVALID_RESPONSE_SCHEMA',
          `Segmentation response from "${resolved.hfRepoId}" failed schema validation: ${parsed.error.issues[0]?.message ?? 'Invalid mask array'}`,
          502
        );
      }

      rasterMasks = parsed.data.slice(0, 8).map((item, idx) => {
        const mapped = interpretSegmentationLabelForMars(item.label);
        const color = SEGMENTATION_PALETTE[idx % SEGMENTATION_PALETTE.length] ?? mapped.color;
        const cleanMask = item.mask.startsWith('data:image/')
          ? item.mask
          : `data:image/png;base64,${item.mask}`;
        return {
          id: `mask-${idx}-${item.label.replace(/\s+/g, '-').toLowerCase()}`,
          label: item.label,
          marsTerrainInterpretation: mapped.interpretation,
          confidence: item.score !== null && item.score !== undefined ? +item.score.toFixed(4) : 1.0,
          color,
          maskDataUri: cleanMask,
        };
      });

      if (hasSpaceFields && spaceEnvelope.data.polygons) {
        segmentationMasks = spaceEnvelope.data.polygons;
      }

      const scored = rasterMasks.filter((m) => m.confidence > 0);
      overallConfidence =
        scored.length > 0
          ? +(scored.reduce((acc, m) => acc + m.confidence, 0) / scored.length).toFixed(4)
          : 0;

      summary =
        rasterMasks.length > 0
          ? `Live Hugging Face segmentation (${resolved.hfRepoId}) partitioned ${loaded.image.width}x${loaded.image.height} image (${loaded.image.sourceLabel}) into ${rasterMasks.length} semantic mask layer(s): ${rasterMasks.map((m) => `${m.label}`).join(', ')}.`
          : `Live Hugging Face segmentation (${resolved.hfRepoId}) completed cleanly with 0 foreground mask regions above threshold.`;
    } else if (model.task === 'object-detection') {
      const detSource = hasSpaceFields && spaceEnvelope.data.boxes
        ? spaceEnvelope.data.boxes
        : rawResult;
      const parsed = HfDetectionArraySchema.safeParse(detSource);
      if (!parsed.success) {
        throw new HfPipelineError(
          'INVALID_RESPONSE_SCHEMA',
          `Object detection response from "${resolved.hfRepoId}" failed schema validation: ${parsed.error.issues[0]?.message ?? 'Invalid box array'}`,
          502
        );
      }

      const imgW = loaded.image.width || 512;
      const imgH = loaded.image.height || 512;

      boundingBoxes = parsed.data.slice(0, 40).map((item, idx) => {
        const { xmin, ymin, xmax, ymax } = item.box;
        const alreadyNormalized = xmax <= 1.01 && ymax <= 1.01 && xmin >= 0 && ymin >= 0;
        const nXmin = Math.max(0, Math.min(1, alreadyNormalized ? xmin : xmin / imgW));
        const nYmin = Math.max(0, Math.min(1, alreadyNormalized ? ymin : ymin / imgH));
        const nXmax = Math.max(0, Math.min(1, alreadyNormalized ? xmax : xmax / imgW));
        const nYmax = Math.max(0, Math.min(1, alreadyNormalized ? ymax : ymax / imgH));

        const pixelW = (nXmax - nXmin) * imgW;
        const pixelH = (nYmax - nYmin) * imgH;
        const estDiamMeters = +((Math.max(pixelW, pixelH) * loaded.groundSampleDistanceM)).toFixed(2);
        const hazardLevel: 'Low' | 'Moderate' | 'Severe' =
          estDiamMeters >= 1.5 ? 'Severe' : estDiamMeters >= 0.6 ? 'Moderate' : 'Low';

        return {
          id: `det-${idx}`,
          label: item.label,
          confidence: +item.score.toFixed(4),
          box: [nYmin, nXmin, nYmax, nXmax],
          pixelBox: {
            xmin: Math.round(nXmin * imgW),
            ymin: Math.round(nYmin * imgH),
            xmax: Math.round(nXmax * imgW),
            ymax: Math.round(nYmax * imgH),
          },
          geoBounds: projectBoxToGeo(nYmin, nXmin, nYmax, nXmax),
          metrics: {
            estimatedDiameterMeters: estDiamMeters,
            hazardLevel,
            scientificNote: `Georeferenced from ${imgW}x${imgH} tile at GSD ${loaded.groundSampleDistanceM} m/px`,
          },
        };
      });

      overallConfidence =
        boundingBoxes.length > 0
          ? +(
              boundingBoxes.reduce((acc, b) => acc + b.confidence, 0) /
              boundingBoxes.length
            ).toFixed(4)
          : 0;

      summary =
        boundingBoxes.length > 0
          ? `Live Hugging Face detector (${resolved.hfRepoId}) localized ${boundingBoxes.length} target feature(s) in ${loaded.image.sourceLabel}.`
          : `Live Hugging Face detector (${resolved.hfRepoId}) scanned ${loaded.image.width}x${loaded.image.height} image and detected 0 objects above threshold.`;
    } else if (model.task === 'image-classification') {
      const clsSource = hasSpaceFields && spaceEnvelope.data.classifications
        ? spaceEnvelope.data.classifications
        : rawResult;
      const parsed = HfClassificationArraySchema.safeParse(clsSource);
      if (!parsed.success) {
        throw new HfPipelineError(
          'INVALID_RESPONSE_SCHEMA',
          `Classification response from "${resolved.hfRepoId}" failed schema validation: ${parsed.error.issues[0]?.message ?? 'Invalid class array'}`,
          502
        );
      }

      const sorted = [...parsed.data].sort((a, b) => b.score - a.score).slice(0, 6);
      classifications = sorted.map((c) => {
        const interp = interpretClassificationForMars(c.label, model.id);
        return {
          className: c.label,
          confidence: +c.score.toFixed(4),
          scientificDescription: interp.scientificDescription,
          geologicalInterpretation: interp.geologicalInterpretation,
        };
      });

      const top = classifications[0];
      overallConfidence = top ? top.confidence : 0;
      summary = top
        ? `Live Hugging Face classifier (${resolved.hfRepoId}) top prediction: "${top.className}" (${(top.confidence * 100).toFixed(1)}% confidence) on ${loaded.image.sourceLabel}.`
        : `Live Hugging Face classifier (${resolved.hfRepoId}) returned 0 class predictions.`;
    } else if (model.task === 'image-feature-extraction') {
      const embSource = hasSpaceFields && spaceEnvelope.data.embedding
        ? spaceEnvelope.data.embedding
        : rawResult;
      embeddings = flattenAndPoolEmbedding(embSource);
      overallConfidence = 1.0;
      summary = `Live feature extraction (${resolved.hfRepoId}) generated a ${embeddings.dimensions}-dimensional latent representation (L2 norm = ${embeddings.l2Norm}) from ${loaded.image.width}x${loaded.image.height} image (${loaded.image.sourceLabel}).`;
    } else if (model.task === 'image-text-to-text') {
      if (hasSpaceFields && typeof spaceEnvelope.data.text === 'string') {
        textAnswer = spaceEnvelope.data.text.trim();
      } else {
        const parsed = HfChatCompletionSchema.safeParse(rawResult);
        if (!parsed.success) {
          throw new HfPipelineError(
            'INVALID_RESPONSE_SCHEMA',
            `VLM response from "${resolved.hfRepoId}" failed OpenAI ChatCompletion schema validation.`,
            502
          );
        }
        if (parsed.data.model) {
          upstreamModelIdUsed = parsed.data.model;
        }
        if (parsed.data.usage) {
          const pTok = parsed.data.usage.prompt_tokens ?? 0;
          const cTok = parsed.data.usage.completion_tokens ?? 0;
          const tTok = parsed.data.usage.total_tokens ?? pTok + cTok;
          tokenUsage = {
            promptTokens: pTok,
            completionTokens: cTok,
            totalTokens: tTok,
          };
        }
        const rawContent = parsed.data.choices[0]!.message.content;
        textAnswer =
          typeof rawContent === 'string'
            ? rawContent.trim()
            : rawContent
                .map((part) => part.text ?? '')
                .join('\n')
                .trim();
      }

      if (!textAnswer) {
        throw new HfPipelineError(
          'INVALID_RESPONSE_SCHEMA',
          `VLM "${resolved.hfRepoId}" returned an empty completion.`,
          502
        );
      }

      overallConfidence = 1.0;
      summary = `Verified live multimodal inference from ${upstreamModelIdUsed} via ${providerUsed} on ${loaded.image.width}x${loaded.image.height}px image (${loaded.image.sourceLabel}, SHA-256 ${imageSha256Prefix}).`;
    }

    const totalLatencyMs = Date.now() - startTime;

    // Mark model ONLINE strictly AFTER real inference succeeded with HTTP 200 & valid schema!
    recordModelInferenceOutcome(
      model.id,
      'online',
      httpStatus,
      `ONLINE — Verified by real HTTP ${httpStatus} inference via ${providerUsed} (${totalLatencyMs} ms)`
    );

    return {
      modelId: model.id,
      modelName: model.name,
      hfRepoUsed: upstreamModelIdUsed,
      task: model.task,
      hostingMethodUsed: resolved.hostingMethod,
      endpointUsed: resolved.displayEndpoint,
      providerUsed,
      httpStatus,
      upstreamCalled: true,
      modelOnlineVerified: true,
      status: 'success',
      executionTimeMs: totalLatencyMs,
      deviceUsed: `Hugging Face (${providerUsed})`,
      timestamp: new Date().toISOString(),
      isCached: false,
      tokenUsage,
      imageDimensions: {
        width: loaded.image.width,
        height: loaded.image.height,
        mimeType: loaded.image.mimeType,
        byteLength: loaded.image.byteLength,
        sourceLabel: loaded.image.sourceLabel,
        sha256Prefix: imageSha256Prefix,
        sentToModel: true,
      },
      targetLocation: {
        lat: targetLat,
        lon: targetLon,
        name: params.imageSource === 'upload' ? loaded.image.sourceLabel : targetName,
        elevationM: target.elevationMeters,
      },
      sensorUsed: params.sensor,
      spatialResolution: loaded.spatialResolution,
      groundSampleDistanceM: loaded.groundSampleDistanceM,
      predictions: {
        summary,
        overallConfidence,
        boundingBoxes,
        rasterMasks,
        segmentationMasks,
        classifications,
        embeddings,
        textAnswer,
      },
      scientificValidation,
    };
  } catch (err) {
    if (err instanceof HfPipelineError) {
      const runtimeModelStatus: HfModelOperationalStatus =
        err.code === 'MODEL_LOADING'
          ? 'loading'
          : err.code === 'HTTP_402_PAYMENT_REQUIRED'
            ? 'credits_required'
            : err.code === 'HTTP_401_UNAUTHORIZED' ||
              err.code === 'HTTP_403_FORBIDDEN' ||
              err.code === 'AUTH_ERROR'
            ? 'auth_error'
            : err.code === 'HTTP_429_RATE_LIMITED' || err.code === 'RATE_LIMITED'
              ? 'rate_limited'
              : err.code === 'HTTP_404_NOT_FOUND' || err.code === 'NO_INFERENCE_PROVIDER'
                ? 'unavailable'
                : 'error';

      recordModelInferenceOutcome(model.id, runtimeModelStatus, err.httpStatus, err.message);

      const mappedResponseStatus =
        err.code === 'MODEL_LOADING'
          ? 'loading'
          : err.code === 'NO_INFERENCE_PROVIDER' ||
              err.code === 'HTTP_404_NOT_FOUND' ||
              err.code === 'MISSING_HF_TOKEN'
            ? 'unavailable'
            : 'error';

      return buildNonSuccessResponse(
        mappedResponseStatus,
        err.code,
        err.message,
        err.httpStatus,
        upstreamDispatched,
        err.estimatedLoadingSec
      );
    }

    const unexpectedMsg = `HTTP 500 Server Error — Unexpected inference failure for "${resolved.hfRepoId}": ${err instanceof Error ? err.message : String(err)}`;
    recordModelInferenceOutcome(model.id, 'error', 500, unexpectedMsg);

    return buildNonSuccessResponse(
      'error',
      'HTTP_500_SERVER_ERROR',
      unexpectedMsg,
      500,
      upstreamDispatched
    );
  }
}
