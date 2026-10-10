import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// Same setup as frontends/nextjs: server-rendered on every request, no caching, one Node process
// (Nitro's node_server preset: `node .output/server/index.mjs`). SolidStart's default SSR mode (streaming) is kept.
export default defineConfig({
  plugins: [solidStart(), nitro({ preset: "node_server" })],
});
