import { createFileRoute } from "@tanstack/react-router";
import { 
  HF_MARS_MODELS_CATALOG, 
  MARS_BENCHMARK_TARGETS, 
  detectSystemHardware, 
  executeMarsModelInference,
  type AiInferenceResponse 
} from "@/lib/hf-mars-models";

// In-memory cache for fast, repeatable, and idempotent model inference
const inferenceCache = new Map<string, { response: AiInferenceResponse; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache

export const Route = createFileRoute("/api/hf-inference")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const hardware = detectSystemHardware();

        if (action === "hardware") {
          return Response.json({
            ok: true,
            hardware,
          });
        }

        if (action === "targets") {
          return Response.json({
            ok: true,
            targets: MARS_BENCHMARK_TARGETS,
          });
        }

        return Response.json({
          ok: true,
          models: HF_MARS_MODELS_CATALOG,
          hardware,
          cachedEntriesCount: inferenceCache.size,
        });
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            modelId?: string;
            targetId?: string;
            sensor?: 'HiRISE' | 'CTX' | 'THEMIS' | 'MOLA';
            userPrompt?: string;
            hfToken?: string;
            bypassCache?: boolean;
          };

          const modelId = body.modelId || 'mars-bench-boulder';
          const targetId = body.targetId || 'jezero-delta';
          const sensor = body.sensor || 'HiRISE';
          const userPrompt = body.userPrompt?.trim();
          const bypassCache = Boolean(body.bypassCache);

          const target = MARS_BENCHMARK_TARGETS.find((t) => t.id === targetId) ?? MARS_BENCHMARK_TARGETS[0]!;
          const cacheKey = `${modelId}::${target.id}::${sensor}::${userPrompt || ''}`;

          // Check Cache
          if (!bypassCache) {
            const cached = inferenceCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
              return Response.json({
                ...cached.response,
                isCached: true,
              });
            }
          }

          // Execute Model Inference with Hardware & Integrity Checks
          const result = executeMarsModelInference(modelId, target, sensor, userPrompt);

          // Store in Cache if execution was successful
          if (result.status === 'success') {
            inferenceCache.set(cacheKey, {
              response: result,
              timestamp: Date.now(),
            });
          }

          return Response.json(result);
        } catch (error) {
          console.error("Hugging Face Mars AI Inference Error:", error);
          return Response.json(
            { 
              error: "Inference failed or invalid payload", 
              detail: error instanceof Error ? error.message : String(error) 
            }, 
            { status: 500 }
          );
        }
      },
    },
  },
});
