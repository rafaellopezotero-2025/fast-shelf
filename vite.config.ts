// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { validateLocalUrl } from "./scripts/local-config.mjs";

export default defineConfig(({ mode }) => {
  const offline = mode === "offline";
  const localEnv = offline ? loadEnv(mode, process.cwd(), "VITE_") : {};
  if (offline) {
    validateLocalUrl(localEnv.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
    if (localEnv.VITE_LOCAL_ONLY !== "true" || !localEnv.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Falta la configuración offline; ejecutá scripts/local-config.mjs.");
    }
  }
  return {
  ...(offline ? {
    envDefine: false,
    nitro: { preset: "node-server" },
    vite: {
      define: Object.fromEntries(Object.entries(localEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    },
  } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  };
});
