import { createFileRoute } from '@tanstack/react-router';
import { createHash } from 'node:crypto';
import {
  MARS_BENCHMARK_TARGETS,
  MAX_IMAGE_UPLOAD_BYTES,
  type AiInferenceResponse,
  type MarsSensorType,
} from '@/lib/hf-mars-models';
import {
  HfPipelineError,
  getSanitizedModelsRegistryForClient,
  runRealHfModelInference,
  verifyAllSevenModelsLive,
} from '@/lib/hf-inference-server';

// Server-side idempotent cache (only caches verified successful HF responses)
const inferenceCache = new Map<string, { response: AiInferenceResponse; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 20; // 20 minutes
const MAX_CACHE_ENTRIES = 64;

function pruneCacheIfNeeded() {
  if (inferenceCache.size <= MAX_CACHE_ENTRIES) return;
  const oldestKey = inferenceCache.keys().next().value;
  if (oldestKey !== undefined) {
    inferenceCache.delete(oldestKey);
  }
}

function parseSensor(raw: unknown): MarsSensorType {
  if (raw === 'HiRISE' || raw === 'CTX' || raw === 'THEMIS' || raw === 'MOLA') {
    return raw;
  }
  return 'HiRISE';
}

function parseImageSource(raw: unknown): 'benchmark' | 'nasa-wmts' | 'upload' {
  if (raw === 'nasa-wmts' || raw === 'upload' || raw === 'benchmark') {
    return raw;
  }
  return 'benchmark';
}

export const Route = createFileRoute('/api/hf-inference')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const action = url.searchParams.get('action');

          if (action === 'targets') {
            return Response.json({
              ok: true,
              targets: MARS_BENCHMARK_TARGETS,
            });
          }

          if (action === 'verify') {
            const forceRefresh = url.searchParams.get('refresh') === '1';
            const verification = await verifyAllSevenModelsLive(forceRefresh);
            const sanitized = getSanitizedModelsRegistryForClient();
            return Response.json({
              ok: true,
              hfTokenConfigured: sanitized.hfTokenConfigured,
              hfTokenSource: sanitized.hfTokenSource,
              spaceUrlConfigured: sanitized.spaceUrlConfigured,
              verification,
            });
          }

          const sanitized = getSanitizedModelsRegistryForClient();
          return Response.json({
            ok: true,
            models: sanitized.models,
            targets: MARS_BENCHMARK_TARGETS,
            hfTokenConfigured: sanitized.hfTokenConfigured,
            hfTokenSource: sanitized.hfTokenSource,
            spaceUrlConfigured: sanitized.spaceUrlConfigured,
            maxUploadBytes: MAX_IMAGE_UPLOAD_BYTES,
            cachedEntriesCount: inferenceCache.size,
          });
        } catch (err) {
          console.error('[GET /api/hf-inference] Error:', err);
          return Response.json(
            {
              ok: false,
              error: 'Failed to inspect Hugging Face model registry',
              detail: err instanceof Error ? err.message : String(err),
            },
            { status: 500 }
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const requestUrl = new URL(request.url);
          const requestOrigin = requestUrl.origin;
          const contentType = request.headers.get('content-type') || '';

          let modelId = 'segformer-terrain';
          let targetId = 'jezero-delta';
          let sensor: MarsSensorType = 'HiRISE';
          let imageSource: 'benchmark' | 'nasa-wmts' | 'upload' = 'benchmark';
          let userPrompt: string | undefined;
          let customLat: number | undefined;
          let customLon: number | undefined;
          let customLocationName: string | undefined;
          let uploadedBase64: string | undefined;
          let uploadedBytes: Uint8Array | undefined;
          let uploadedFileName: string | undefined;
          let bypassCache = false;

          if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            const rawModel = form.get('modelId');
            if (typeof rawModel === 'string' && rawModel.trim()) modelId = rawModel.trim();

            const rawTarget = form.get('targetId');
            if (typeof rawTarget === 'string' && rawTarget.trim()) targetId = rawTarget.trim();

            sensor = parseSensor(form.get('sensor'));
            imageSource = parseImageSource(form.get('imageSource'));

            const rawPrompt = form.get('userPrompt');
            if (typeof rawPrompt === 'string' && rawPrompt.trim()) userPrompt = rawPrompt.trim();

            const rawLat = form.get('customLat');
            if (typeof rawLat === 'string' && rawLat.trim() !== '') {
              const n = Number(rawLat);
              if (Number.isFinite(n)) customLat = n;
            }
            const rawLon = form.get('customLon');
            if (typeof rawLon === 'string' && rawLon.trim() !== '') {
              const n = Number(rawLon);
              if (Number.isFinite(n)) customLon = n;
            }
            const rawLocName = form.get('customLocationName');
            if (typeof rawLocName === 'string' && rawLocName.trim()) {
              customLocationName = rawLocName.trim();
            }

            bypassCache = form.get('bypassCache') === 'true';

            const fileField = form.get('file');
            if (fileField instanceof File) {
              if (fileField.size > MAX_IMAGE_UPLOAD_BYTES) {
                return Response.json(
                  {
                    error: 'PAYLOAD_TOO_LARGE',
                    detail: `Uploaded file "${fileField.name}" (${(fileField.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 4.00 MB limit.`,
                  },
                  { status: 413 }
                );
              }
              uploadedBytes = new Uint8Array(await fileField.arrayBuffer());
              uploadedFileName = fileField.name;
              imageSource = 'upload';
            }
          } else {
            const body = (await request.json()) as {
              modelId?: unknown;
              targetId?: unknown;
              sensor?: unknown;
              imageSource?: unknown;
              userPrompt?: unknown;
              customLat?: unknown;
              customLon?: unknown;
              customLocationName?: unknown;
              uploadedBase64?: unknown;
              uploadedFileName?: unknown;
              bypassCache?: unknown;
            };

            if (typeof body.modelId === 'string' && body.modelId.trim()) {
              modelId = body.modelId.trim();
            }
            if (typeof body.targetId === 'string' && body.targetId.trim()) {
              targetId = body.targetId.trim();
            }
            sensor = parseSensor(body.sensor);
            imageSource = parseImageSource(body.imageSource);
            if (typeof body.userPrompt === 'string' && body.userPrompt.trim()) {
              userPrompt = body.userPrompt.trim();
            }
            if (typeof body.customLat === 'number' && Number.isFinite(body.customLat)) {
              customLat = body.customLat;
            }
            if (typeof body.customLon === 'number' && Number.isFinite(body.customLon)) {
              customLon = body.customLon;
            }
            if (typeof body.customLocationName === 'string' && body.customLocationName.trim()) {
              customLocationName = body.customLocationName.trim();
            }
            if (typeof body.uploadedBase64 === 'string' && body.uploadedBase64.trim()) {
              uploadedBase64 = body.uploadedBase64.trim();
              imageSource = 'upload';
            }
            if (typeof body.uploadedFileName === 'string' && body.uploadedFileName.trim()) {
              uploadedFileName = body.uploadedFileName.trim();
            }
            bypassCache = Boolean(body.bypassCache);
          }

          // Compute deterministic cache key including image digest when uploaded
          let imageDigest = `${targetId}:${customLat ?? 'std'}:${customLon ?? 'std'}`;
          if (imageSource === 'upload') {
            const h = createHash('sha256');
            if (uploadedBytes) {
              h.update(uploadedBytes);
            } else if (uploadedBase64) {
              h.update(uploadedBase64);
            }
            imageDigest = `upload:${h.digest('hex').slice(0, 20)}`;
          }

          const cacheKey = `${modelId}::${imageSource}::${imageDigest}::${sensor}::${userPrompt ?? ''}`;

          if (!bypassCache) {
            const cached = inferenceCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
              return Response.json({
                ...cached.response,
                isCached: true,
              });
            }
          }

          const result = await runRealHfModelInference({
            modelId,
            targetId,
            sensor,
            imageSource,
            userPrompt,
            customLat,
            customLon,
            customLocationName,
            uploadedBase64,
            uploadedBytes,
            uploadedFileName,
            requestOrigin,
          });

          if (result.status === 'success') {
            pruneCacheIfNeeded();
            inferenceCache.set(cacheKey, {
              response: result,
              timestamp: Date.now(),
            });
          }

          const responseHttpStatus =
            result.status === 'success' ? 200 : (result.httpStatus ?? 500);

          return Response.json(result, { status: responseHttpStatus });
        } catch (err) {
          if (err instanceof HfPipelineError) {
            return Response.json(
              {
                error: err.code,
                detail: err.message,
              },
              { status: err.httpStatus }
            );
          }
          console.error('[POST /api/hf-inference] Unhandled Error:', err);
          return Response.json(
            {
              error: 'UPSTREAM_ERROR',
              detail: err instanceof Error ? err.message : String(err),
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
