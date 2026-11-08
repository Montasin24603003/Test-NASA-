// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// @lovable.dev/vite-tanstack-config only calls loadEnv(mode, cwd, "VITE_") for client `import.meta.env.VITE_*`.
// Populate Node.js server `process.env` with server-only `.env` / `.env.local` keys (e.g., HF_TOKEN)
// WITHOUT adding them to Vite `define`, ensuring secrets NEVER leak into React client bundles.
const currentMode = process.env["NODE_ENV"] || "development";
const serverEnvVars = loadEnv(currentMode, process.cwd(), "");
for (const [key, value] of Object.entries(serverEnvVars)) {
  if (process.env[key] === undefined && value !== "") {
    process.env[key] = value;
  }
}

const isVercel = Boolean(process.env["VERCEL"] || process.env["NITRO_PRESET"] === "vercel");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(isVercel
    ? {
        nitro: {
          preset: "vercel",
        },
      }
    : {}),
});
