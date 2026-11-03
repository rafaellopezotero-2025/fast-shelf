// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readOfflineBuildEnv } from "./scripts/local-config.mjs";

export default async function config({ mode, command }: { mode: string; command: 'serve' | 'build' }) {
  const offline = mode === "offline";
  const localEnv = offline ? readOfflineBuildEnv(process.cwd()) : {};
  return defineConfig({
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
  })({ mode, command });
}
